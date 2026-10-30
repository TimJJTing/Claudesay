import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { ActiveTool, Bird, CharacterOverride, Crewmate, Drop, ToolLook } from '../types'
import {
  BUBBLE_WIDTH,
  DEFAULT_CHARACTER,
  SAY_SYSTEM,
  SNORES,
  clean,
  cut,
  drawBubble,
  lookFor,
  parseSaid,
  poseFor,
  sayPrompt,
  sanitizeOverride,
  toolLabel,
  withOverride,
} from './art.ts'
import { FAIL_HOLD, type Grid, drawAir, drawCrew, dropTo, isAirborne, stepDrop, gridOf, isSettled, newCrewmate, rowsIn, slotWidth, stepCrew } from './crew.ts'
import { drawBird, newBird, placeBird, stepBird } from './sky.ts'

const running = atom({ plugin: 'claudesay', key: 'running' } as const, [])
const saying = atom({ plugin: 'claudesay', key: 'saying' } as const, null)
const override = atom({ plugin: 'claudesay', key: 'character' } as const, null)
const working = atom({ plugin: 'claudesay', key: 'working' } as const, false)
const crew = atom({ plugin: 'claudesay', key: 'crew' } as const, [])
const landing = atom({ plugin: 'claudesay', key: 'landing' } as const, null)
const sleep = atom({ plugin: 'claudesay', key: 'sleep' } as const, null)
const flying = atom({ plugin: 'claudesay', key: 'bird' } as const, null)

// The id of the pane, and the name of the command that opens it.
const PANE = 'claudesay'
// The body the pane asks for: a whole bubble across when docked, a bubble and
// a character tall inline. The person's own size wins.
const PANE_COLUMNS = BUBBLE_WIDTH + 5
// Rows the pane keeps for the bubble: its frame and tail, and the seven lines
// that a line of 300 characters takes at the widest bubble. A longer bubble ends in "…".
const BUBBLE_ROWS = 10
// A blank row, the bubble, and the default character with its label and the crew's.
const PANE_ROWS = 1 + BUBBLE_ROWS + 8
const MAX_FILE = 64 * 1024
// The small model that writes the line about a reply, how much of the end of
// the reply it reads, and how long the mod waits for it.
const SAY_MODEL = 'haiku'
const MAX_REPLY = 8000
const SAY_TIMEOUT = 20_000
// The narrowest bubble. Below it, the art lines are cut at the right edge.
const MIN_WIDTH = 12
// Milliseconds between two steps of the crew.
const TICK = 60
// Milliseconds with no step after which the timer counts as stopped.
const STALL = TICK * 10
// The longest label under a crewmate, before it is cut to the slot.
const MAX_LABEL = 100
// Agent states that mean the agent stopped (AgentStatus).
const ENDED = new Set(['completed', 'failed', 'killed'])
// The default milliseconds with nothing to do after which the character falls
// asleep, and after which the mod starts no new animation, no snore and no
// bird, until something wakes it: an idle session then runs no timer of the
// mod's. The sleepAfter and restAfter options set them in steps of 30 seconds.
const SLEEP_AFTER = 2 * 60_000
const REST_AFTER = 5 * 60_000
// Milliseconds between two frames of the snore.
const SNORE = 1000
// The shortest and the longest wait for the next bird: one comes at least each minute.
const BIRD_MIN = 15_000
const BIRD_MAX = 60_000
// Tools that wait on the person while they run: a question, a plan to approve.
const ASKS_PERSON = new Set(['AskUserQuestion', 'ExitPlanMode'])
// What the character says when it lands in a pane that opened with nothing to say.
const GREETING = { mood: 'happy', line: "Hi! I'll sum up each reply here." } as const

// The text of character.json at the last read, so a bad file gives one toast, not one each turn.
let lastFile: string | null | undefined
let lastOverride: CharacterOverride | null = null
// Counts the tool calls with no tool_use_id, to give each one an id of its own.
let calls = 0
// The slots of the pane at the last draw. The crew floats down to them, and a
// crewmate that leaves turns into a spark there.
let grid: Grid = gridOf(80, 1, slotWidth(DEFAULT_CHARACTER))
// The timer that moves the crew, the main character's drop and the bird. It
// runs only while one of them moves.
let ticker: Timer | null = null
// The clock time of the timer's last step.
let lastTick = 0
// True when the pane opened or closed since its last draw: at its next draw,
// the main character drops in.
let arriving = true
// The drop of the main character while it floats down, and null otherwise. A
// draw may not write state, so the drop lives here, and each step of the timer
// copies it to the landing atom, which draws the pane again.
let mainDrop: Drop | null = null
// The most rows the pane drew since the main loop's turn started. Inline, the
// pane never draws fewer in that turn, so it does not jump when a bubble comes
// and goes between tool calls.
let tallest = 0
// The bird that flies across the docked pane now, or null. Like the main
// character's drop, it lives here, and each step of the timer copies it to the
// bird atom. Its first draw gives it its row.
let bird: Bird | null = null
// The timer that brings the next bird.
let birdTimer: Timer | null = null
// True when the pane drew docked last. Birds fly only there.
let inDock = false
// The timer of the next point of the idle time, and the timer of the snore.
let idleTimer: Timer | null = null
let snorer: Timer | null = null
// The clock time when the session last did something: the idle time counts from it.
let lastActive = 0
// The idle times of the options: the character sleeps from sleepAfter on, and
// the mod rests from restAfter on, until something wakes the character.
let sleepAfter = SLEEP_AFTER
let restAfter = REST_AFTER
let resting = false
// Stops the small model's call for the line about the last reply. A new turn
// or a new session stops it, so a late line never shows.
let asking: AbortController | null = null

// Reads ~/.claude/claudesay/character.json. A missing file gives null. A bad
// file gives the fields that are valid, and a toast names the others.
async function loadOverride($: EngineInterface): Promise<CharacterOverride | null> {
  const home = await $.env.get('HOME')
  if (home === undefined) return null
  const path = `${home}/.claude/claudesay/character.json`
  // A stat first, so a large file, a pipe or a device is never read.
  const info = await $.fs.stat(path).catch(() => undefined)
  if (info !== undefined && (info.kind !== 'file' || info.size > MAX_FILE)) {
    const key = `stat:${info.kind}:${info.size}`
    if (key !== lastFile) $.ui.toast(`claudesay: ${path} is not a file of 64 KB or less. The default character is used.`)
    lastFile = key
    lastOverride = null
    return null
  }
  let text: string | null = null
  if (info !== undefined) text = await $.fs.read(path).catch(() => null)
  if (text === lastFile) return lastOverride
  lastFile = text
  lastOverride = null
  if (text === null) return null
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    $.ui.toast(`claudesay: ${path} is not valid JSON. The default character is used.`)
    return null
  }
  const { override: checked, problems } = sanitizeOverride(raw)
  if (problems.length > 0) {
    const more = problems.length > 3 ? ` (and ${problems.length - 3} more)` : ''
    $.ui.toast(`claudesay: ${path}: ${problems.slice(0, 3).map(problem => cut(clean(problem), 100)).join('; ')}${more}. These fields are ignored.`)
  }
  lastOverride = checked
  return checked
}

async function character($: EngineInterface) {
  return withOverride(DEFAULT_CHARACTER, await read($, override))
}

// Reads character.json again, so an edit shows at the next draw.
async function reloadCharacter($: EngineInterface) {
  const loaded = await loadOverride($)
  await update($, override, () => loaded)
}

function stopAsking() {
  asking?.abort()
  asking = null
}

// Asks the small model for the line about a reply. The thinking face shows
// until the line comes. With no screen, or with the pane that the person
// closed, nothing draws the line, so the mod does not ask. A failed call gives no line.
function askLine($: EngineInterface, answer: string) {
  stopAsking()
  const stop = new AbortController()
  asking = stop
  const ask = async () => {
    if ((await $.session.surfaces()).length === 0 || (await $.store.get('closed')) === true) return null
    const request = { model: SAY_MODEL, system: SAY_SYSTEM, prompt: sayPrompt(answer, MAX_REPLY), maxTokens: 512, effort: 'low', timeoutMs: SAY_TIMEOUT } as const
    const reply = await $.model.complete(request, { signal: stop.signal })
    return reply.isAnswered ? parseSaid(reply.text, answer) : null
  }
  void ask()
    .catch(() => null)
    .then(async says => {
      if (asking !== stop) return
      asking = null
      await update($, saying, () => says)
      await update($, working, () => false)
      await startIdle($).catch(() => {})
    })
    .catch(() => {})
}

// Changes the crew, then starts the timer if a crewmate has to move.
async function changeCrew($: EngineInterface, change: (list: Crewmate[]) => Crewmate[]) {
  const slot = slotWidth(await character($))
  await animate($, await update($, crew, change), slot)
}

function stopTicker() {
  ticker?.cancel()
  ticker = null
}

// True when no crewmate moves, the main character has landed and no bird
// flies: the timer can stop. It reads the module's `grid`, `mainDrop` and `bird`.
const isStill = (list: readonly Crewmate[], slot: number) => isSettled(list, grid, slot) && mainDrop === null && bird === null

// Starts the timer that moves the crew, unless it runs or nobody has to move.
// A refused period ends the timer without a word, so a timer that has not ticked
// for STALL milliseconds starts again.
async function animate($: EngineInterface, list: Crewmate[], slot: number) {
  if (ticker === null && isStill(list, slot)) return
  const now = await $.clock.now()
  if (ticker !== null && now - lastTick > STALL) stopTicker()
  if (ticker !== null || isStill(list, slot)) return
  lastTick = now
  ticker = $.clock.every(TICK, () => {
    // A failed step lands the main character, so it never stays out of sight.
    stepAll($).catch(() => {
      stopTicker()
      mainDrop = null
      bird = null
    })
  })
}

// One step of the timer. It reads the slot width at each step, so a change of
// character.json while the crew moves takes effect at once.
async function stepAll($: EngineInterface) {
  lastTick = await $.clock.now()
  const slot = slotWidth(await character($))
  const list = await update($, crew, list => stepCrew(list, grid, slot))
  // The main character lands when it is down and its plane is gone.
  if (mainDrop !== null) {
    const next = stepDrop(mainDrop, grid, slot)
    mainDrop = isAirborne(next, slot) || next.plane !== null ? next : null
    await update($, landing, () => mainDrop)
  }
  if (bird !== null) {
    bird = stepBird(bird, grid.columns)
    await update($, flying, () => bird)
    if (bird === null) scheduleBird($)
  }
  if (isStill(list, slot)) stopTicker()
}

// Brings the next bird at a random time, unless a bird flies or waits, the
// pane is not docked, or the mod rests.
function scheduleBird($: EngineInterface) {
  if (birdTimer !== null || bird !== null || !inDock || resting) return
  const timer = $.clock.after(BIRD_MIN + Math.random() * (BIRD_MAX - BIRD_MIN), () => {
    if (birdTimer !== timer) return
    birdTimer = null
    launchBird($).catch(() => {
      bird = null
    })
  })
  birdTimer = timer
}

function stopBirds() {
  birdTimer?.cancel()
  birdTimer = null
}

// A bird sets off from a random edge at a random height. A pane that is no
// longer docked, or a mod that rests, gets none: the next docked draw, or the
// character waking up, schedules the next one.
async function launchBird($: EngineInterface) {
  if (!inDock || resting) return
  bird = newBird(grid.columns, Math.random() < 0.5 ? 1 : -1, Math.random())
  await update($, flying, () => bird)
  await animate($, await read($, crew), slotWidth(await character($)))
}

// True while Claude or a subagent works: the character stays awake. A main
// loop that waits on the person does not count: the idle time runs on.
async function isBusy($: EngineInterface) {
  if ((await read($, crew)).some(mate => mate.phase === 'work')) return true
  const tools = await read($, running)
  if (tools.some(tool => tool.waits === true)) return false
  return tools.length > 0 || (await read($, working))
}

function stopIdle() {
  idleTimer?.cancel()
  idleTimer = null
  snorer?.cancel()
  snorer = null
}

// Something happened: the idle time counts from now, and a sleeping character
// wakes up, with its snore and its birds.
async function stir($: EngineInterface) {
  lastActive = await $.clock.now()
  if (!resting && (await read($, sleep)) === null) return
  stopIdle()
  resting = false
  await update($, sleep, () => null)
  scheduleBird($)
}

// Arms the timer of the next point of the idle time, unless it is armed, the
// mod rests, or Claude works: the end of the work arms it.
async function armIdle($: EngineInterface) {
  if (idleTimer !== null || resting || (await isBusy($))) return
  const asleep = (await read($, sleep)) !== null
  const wait = (asleep ? restAfter : sleepAfter) - ((await $.clock.now()) - lastActive)
  // Another call, from a keystroke say, may have armed it while this one waited.
  if (idleTimer !== null || resting) return
  idleTimer = $.clock.after(Math.max(0, wait), () => {
    idleTimer = null
    doze($).catch(() => {})
  })
}

// The work ended, or the person typed: the idle time starts again.
async function startIdle($: EngineInterface) {
  await stir($)
  await armIdle($)
}

// A point of the idle time: sleepAfter puts the character to sleep, restAfter
// makes the mod rest. A turn that started meanwhile keeps it awake.
async function doze($: EngineInterface) {
  if (await isBusy($)) return
  const idle = (await $.clock.now()) - lastActive
  const asleep = (await read($, sleep)) !== null
  if (asleep && idle >= restAfter) return restNow($)
  if (!asleep && idle >= sleepAfter) await fallAsleep($)
  await armIdle($)
}

// The character closes its eyes. With a line or the label of a tool that waits
// on the person in the bubble, it stays. With neither, after a turn that ended
// without an answer, the bubble snores.
async function fallAsleep($: EngineInterface) {
  if ((await read($, saying)) !== null || (await read($, running)).length > 0) {
    await update($, sleep, () => SNORES.at(-1)!)
    return
  }
  await update($, sleep, () => SNORES[0])
  snorer?.cancel()
  let frame = 0
  const timer = $.clock.every(SNORE, () => {
    if (snorer !== timer) return
    frame = (frame + 1) % SNORES.length
    update($, sleep, () => SNORES[frame]!).catch(() => {})
  })
  snorer = timer
}

// restAfter idle: the snore stops on its last frame, and no new bird comes
// until the character wakes. A bird in the air flies on out of the pane.
async function restNow($: EngineInterface) {
  stopIdle()
  stopBirds()
  resting = true
  await update($, sleep, () => SNORES.at(-1)!)
}

// Reads an idle time option such as "1m30s" as milliseconds, or the default
// for a value that is not one.
function parseIdle(value: unknown, fallback: number): number {
  const match = typeof value === 'string' ? /^(?:(\d+)m)?(?:(\d+)s)?$/.exec(value) : null
  if (match === null) return fallback
  const ms = (Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)) * 1000
  return ms > 0 ? ms : fallback
}

// The crewmate of the agent holds the prop of a tool while `run` runs. It lets
// go after, unless a later call of the agent took its hands meanwhile.
async function holdProp<T>($: EngineInterface, agentId: string, held: { look: ToolLook; toolId: string }, run: () => Promise<T>): Promise<T> {
  const hold = (mate: Crewmate) => (mate.id === agentId && mate.phase === 'work' ? { ...mate, ...held } : mate)
  await update($, crew, list => list.map(hold))
  try {
    return await run()
  } finally {
    const drop = (mate: Crewmate) => (mate.id === agentId && mate.toolId === held.toolId ? { ...mate, look: null, toolId: null } : mate)
    await update($, crew, list => list.map(drop))
  }
}

// The end of a crewmate's run: it leaves as a spark, or first stands still when it failed.
function ending(mate: Crewmate, failed: boolean): Crewmate {
  if (mate.phase !== 'work') return mate
  return failed ? { ...mate, phase: 'failed', hold: FAIL_HOLD } : { ...mate, phase: 'done' }
}

// Opens the pane. Opened at the start of a session, the engine places it only
// on a terminal wide enough for a sidebar (UiOpenResult), and it waits for a
// wider one or for the command. Opened by the command, it shows at any width.
// With no line to say, the character greets once it landed: the bubble waits
// until then, and the next turn clears it.
const openPane = async ($: EngineInterface, greets: boolean) => {
  arriving = true
  if (greets) await update($, saying, said => said ?? GREETING)
  return $.ui.open({ id: PANE, title: 'claudesay', columns: PANE_COLUMNS, rows: PANE_ROWS })
}

// A crewmate whose end the mod did not hear (a lost event, a reload) leaves when
// the engine no longer lists its agent as one that runs. It shows the error face
// only when the engine says the agent failed or was killed: an agent that is no
// longer listed may well have finished.
async function sweepCrew($: EngineInterface) {
  const list = await read($, crew)
  if (list.length === 0) return
  const agents = await $.agent.list()
  const status = new Map(agents.map(agent => [agent.id, agent.status]))
  const gone = (id: string) => !status.has(id) || ENDED.has(status.get(id) ?? '')
  const failed = (id: string) => status.get(id) === 'failed' || status.get(id) === 'killed'
  if (!list.some(mate => mate.phase === 'work' && gone(mate.id))) return
  await changeCrew($, all => all.map(mate => (gone(mate.id) ? ending(mate, failed(mate.id)) : mate)))
}

export const register: Register = (on, options) => {
  // A change in the config menu loads the module again with the new mode.
  const mode = options.mode === 'tools' || options.mode === 'off' ? options.mode : 'on'
  if (mode === 'off') return
  // The mod never rests before the character sleeps.
  sleepAfter = parseIdle(options.sleepAfter, SLEEP_AFTER)
  restAfter = Math.max(sleepAfter, parseIdle(options.restAfter, REST_AFTER))

  // A new session loads character.json, starts with no line, no tools, no crew
  // and a pane that may shrink, and opens the pane, unless the person closed it by hand: then
  // only the command opens it again.
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: PANE, description: 'Show the claudesay character in a pane' })
    await reloadCharacter($)
    stopTicker()
    stopAsking()
    stopIdle()
    stopBirds()
    tallest = 0
    bird = null
    resting = false
    lastActive = await $.clock.now().catch(() => 0)
    await update($, sleep, () => null)
    await update($, flying, () => null)
    await update($, crew, () => [])
    await update($, running, () => [])
    await update($, working, () => false)
    await update($, saying, () => null)
    // Last: the open draws the pane, and that draw starts the drop of the main character.
    if ((await $.store.get('closed')) !== true) await openPane($, mode === 'on').catch(() => {})
    await armIdle($).catch(() => {})
    return result
  })

  // A new turn of the main loop clears the last line, because it is about the
  // reply above, or stops the call that would write it, and lets the pane
  // shrink again. The hook also reads character.json again, so an edit shows
  // on the next turn, and sends off a crewmate whose agent ended without the
  // mod hearing it. A subagent's turn changes nothing here.
  on('turn.start', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    tallest = 0
    stopAsking()
    await stir($).catch(() => {})
    await update($, working, () => true)
    await update($, saying, () => null)
    await reloadCharacter($)
    await sweepCrew($).catch(() => {})
    return result
  })

  // The command opens the pane at any width, and it opens again in later sessions.
  on('command.run', { command: PANE }, async $ => {
    await $.store.set('closed', false)
    const opened = await openPane($, mode === 'on')
    return { text: opened.isPlaced ? 'claudesay opened.' : `claudesay waits: ${opened.reason}` }
  })

  // A pane that the person closes stays closed in later sessions too. A toast
  // names the command that opens it again.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const result = await next(e)
    arriving = true
    inDock = false
    if (e.origin.kind === 'person') {
      await $.store.set('closed', true)
      $.ui.toast(`claudesay closed. Type /${PANE} to open it again.`)
    }
    return result
  })

  // Typing in the prompt box, or a recalled history entry, wakes the character,
  // and the idle time starts again. The hooks only observe: they pass every edit
  // on unchanged, and they do not wait for the clock, so the typing never waits.
  on('prompt.edit', ($, e, next) => {
    void startIdle($).catch(() => {})
    return next(e)
  }).catch(($, e, next) => next(e))
  on('prompt.change', ($, e, next) => {
    void startIdle($).catch(() => {})
    return next(e)
  }).catch(($, e, next) => next(e))

  // Each subagent that the main loop spawns floats down to a slot after the character.
  // Nested agents, workflow agents and teammates stay out of the pane: a teammate
  // goes idle between turns, and one in its own pane runs no loop here, so the
  // mod would never hear its end. An agent that goes on after it waited on its
  // own background work comes back as a resumed spawn: its crewmate stays where
  // it stands. The hook only observes: it passes every spawn on unchanged.
  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (e.parentAgentId !== undefined || e.workflow !== undefined || e.isTeammate === true || result.agentId === undefined) {
      return result
    }
    const id = result.agentId
    if (e.resume !== undefined && (await read($, crew)).some(mate => mate.id === id && mate.phase === 'work')) return result
    const label = cut(clean(e.description || e.subagentType), MAX_LABEL)
    const slot = slotWidth(await character($))
    await changeCrew($, list => [...list.filter(mate => mate.id !== id), newCrewmate(id, label, slot)])
    return result
  }).catch(($, e, next) => next(e))

  // Records each tool call of the main loop that runs now, for the pane. A
  // crewmate holds the prop of the tool that its agent runs now. A call of an
  // agent that is not in the crew shows nowhere. The hook only observes: it
  // passes every call on unchanged.
  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId !== undefined && !(await read($, crew)).some(mate => mate.id === agentId)) return next(e)
    const toolId = e.tool_use_id ?? `call-${++calls}`
    const look = lookFor(await character($), e.tool)
    if (agentId !== undefined) return holdProp($, agentId, { look, toolId }, () => next(e))
    const filePath = 'file_path' in e && typeof e.file_path === 'string' ? e.file_path : undefined
    const asks = ASKS_PERSON.has(e.tool)
    const tool: ActiveTool = { id: toolId, tool: e.tool, label: toolLabel(e.tool, filePath), look, ...(asks ? { waits: true as const } : {}) }
    await update($, running, list => [...list, tool].slice(-20))
    if (asks) await startIdle($).catch(() => {})
    try {
      return await next(e)
    } finally {
      // A call that waited on the person ends when the person acted: the
      // character wakes. The update reads the list as it is now: another hook,
      // a permission dialog's, may have marked the call since it started.
      let waited = false
      await update($, running, list => {
        waited = list.some(one => one.id === tool.id && one.waits === true)
        return list.filter(one => one.id !== tool.id)
      })
      if (waited) await stir($).catch(() => {})
    }
  }).catch(($, e, next) => next(e))

  // A permission dialog of the main loop waits on the person: the newest call
  // of the tool waits, and the idle time counts from now. A hook beneath that
  // answered the request shows no dialog. The hook only observes: it passes
  // every request on unchanged.
  on('classic.PermissionRequest', async ($, e, next) => {
    const result = await next(e)
    if (e.agent_id !== undefined || result.decision !== undefined) return result
    const waiting = (await read($, running)).findLast(one => one.tool === e.tool_name)
    if (waiting === undefined) return result
    await update($, running, list => list.map(one => (one.id === waiting.id ? { ...one, waits: true as const } : one)))
    await startIdle($).catch(() => {})
    return result
  }).catch(($, e, next) => next(e))

  // At the end of a main-loop turn, a small model writes the line about the
  // answer. A turn that ends any other way gives no line. The end of a
  // subagent's turn sends its crewmate off, unless the agent waits on its own
  // background work: then it goes on in a later turn.
  on('turn.complete', async ($, e, next) => {
    let asks = false
    try {
      const result = await next(e)
      if (e.agentId !== undefined) {
        const id = e.agentId
        if ((await read($, crew)).some(mate => mate.id === id)) {
          const status = (await $.agent.list()).find(agent => agent.id === id)?.status
          if (status === 'waiting') return result
          await changeCrew($, list => list.map(mate => (mate.id === id ? ending(mate, e.reason !== 'answer') : mate)))
          await startIdle($).catch(() => {})
        }
        return result
      }
      await update($, running, () => [])
      asks = mode === 'on' && e.reason === 'answer' && e.answer.trim() !== ''
      if (asks) askLine($, e.answer)
      else await update($, saying, () => null)
      return result
    } finally {
      // Always, so a failed hook cannot leave the thinking face. The line ends it otherwise.
      if (e.agentId === undefined && !asks) {
        await update($, working, () => false)
        await startIdle($).catch(() => {})
      }
    }
  }).catch(($, e, next) => next(e))

  // The pane: the main character as poseFor picks it, under its bubble. The
  // crew fills the slots after the character, so it stands beside it in a wide
  // pane and below it in a narrow one. Docked, the drawing sits at the bottom
  // of the pane, next to the prompt.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const mates = await read($, crew)
    const art = await character($)
    const slot = slotWidth(art)
    const columns = Math.max(MIN_WIDTH, e.props.bodyColumns)
    const room = e.props.scroll.bodyRows
    const width = Math.max(MIN_WIDTH, Math.min(BUBBLE_WIDTH, columns - 5))
    const upset = mates.some(mate => mate.phase === 'failed' && mate.hold > 0)
    const busy = await read($, working)
    const { text, body } = poseFor(art, (await read($, running)).at(-1), await read($, saying), busy, upset, await read($, sleep))
    // As many rows of slots as the room under BUBBLE_ROWS holds: a character and
    // its label each. The bubble does not count, so the crew stays put when it changes.
    const docked = e.props.placement === 'dock'
    inDock = docked
    grid = gridOf(columns, rowsIn(room - 1 - BUBBLE_ROWS, body.length), slot, body.length, grid.top, docked)
    // A new size moves the slots, so the crew may have to move.
    await animate($, mates, slot)
    // The first draw after the pane opened starts the drop of the main character.
    // It is in the air from this draw on. With no timer, it is in its slot at once.
    // The read draws the pane again at each step.
    await read($, landing)
    await read($, flying)
    const arrive = arriving
    if (arrive) {
      arriving = false
      mainDrop = { x: 0, y: 1, plane: null }
      await animate($, mates, slot).catch(() => {
        mainDrop = null
      })
    }
    const drawing = drawCrew(art, body, mates, grid, slot, mainDrop)
    // The bubble takes the rows over the drawing, its frame and tail three of
    // them. With no room for one line of text, there is no bubble.
    const fits = room - 1 - drawing.length - 3
    const bubble = text === null || fits < 1 ? [] : drawBubble(art, text, width, fits)
    // One blank row keeps the drawing apart from the frame, with or without a
    // bubble. The bubble waits in blank rows until the main character landed.
    const shown = mainDrop === null ? bubble : []
    const drawn = [' ', ...(mainDrop === null ? bubble : bubble.map(() => ' ')), ...drawing]
    tallest = Math.max(tallest, drawn.length)
    // Blank rows above it fill the dock, or keep the inline pane as tall as it was in this turn.
    const height = Math.min(docked ? room : tallest, room)
    const lines = [...Array<string>(Math.max(0, height - drawn.length)).fill(' '), ...drawn]
    // The crewmates in the air fall to where the drawing of the crew is now.
    grid = { ...grid, top: lines.length - drawing.length }
    // Now that the drawing is in place, the drop knows how far it falls.
    if (arrive && mainDrop !== null) mainDrop = dropTo(0, 0, grid)
    const air = drawAir(art, lines, mates, grid, slot, { rows: body, landing: mainDrop })
    // A bird flies over the docked pane, in a row that holds nothing.
    if (docked && bird !== null) bird = placeBird(bird, air)
    const rows = docked ? drawBird(air, bird, columns, { top: lines.length - drawing.length - shown.length, lines: shown }) : air
    scheduleBird($)

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {rows.map(line => (
          // An empty Text takes no row, so a blank row is a space.
          <Text mono wrap="truncate-end">
            {line === '' ? ' ' : line}
          </Text>
        ))}
      </Box>
    )
  }).catch(($, e, next) => next(e))
}
