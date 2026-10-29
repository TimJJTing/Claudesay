import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { ActiveTool, CharacterOverride, Crewmate } from '../types'
import {
  BUBBLE_WIDTH,
  DEFAULT_CHARACTER,
  PROTOCOL,
  clean,
  cut,
  drawBubble,
  drawCharacter,
  lookFor,
  parseReply,
  tagKey,
  sanitizeOverride,
  toolLabel,
  unfinishedTag,
  withOverride,
} from './art.ts'
import { FAIL_HOLD, drawCrew, isSettled, newCrewmate, slotWidth, stepCrew } from './crew.ts'

const running = atom({ plugin: 'claudesay', key: 'running' } as const, [])
const saying = atom({ plugin: 'claudesay', key: 'saying' } as const, null)
const override = atom({ plugin: 'claudesay', key: 'character' } as const, null)
const streaming = atom({ plugin: 'claudesay', key: 'streaming' } as const, false)
const finals = atom({ plugin: 'claudesay', key: 'finals' } as const, [])
const crew = atom({ plugin: 'claudesay', key: 'crew' } as const, [])

const MAX_FILE = 64 * 1024
// How many tags (of final answers and of replies that ended early) the mod remembers, across sessions.
const MAX_FINALS = 500
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

// The text of character.json at the last read, so a bad file gives one toast, not one each turn.
let lastFile: string | null | undefined
let lastOverride: CharacterOverride | null = null
let calls = 0
// The width of the band at the last draw. The crew's slots follow it, and a
// crewmate that leaves walks to its edge.
let columns = 80
// The timer that moves the crew. It runs only while a crewmate moves.
let ticker: Timer | null = null
// The clock time of the timer's last step.
let lastTick = 0
// The most rows the band drew since the main loop's turn started. The band never
// draws fewer in that turn, so it does not jump when a bubble comes and goes
// between tool calls.
let tallest = 0

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

// Remembers the key of a tag, so the screen hides it, in this session and later ones.
async function remember($: EngineInterface, tag: string) {
  const key = tagKey(tag)
  const keys = [...((await read($, finals)) ?? []).filter(one => one !== key), key].slice(-MAX_FINALS)
  await update($, finals, () => keys)
  await $.store.set('finals', keys)
}

// Changes the crew, then starts the timer if a crewmate has to move.
async function changeCrew($: EngineInterface, change: (list: Crewmate[]) => Crewmate[]) {
  const slot = slotWidth(await character($))
  await animate($, await update($, crew, value => change(value ?? [])), slot)
}

// Starts the timer that moves the crew, unless it runs or nobody has to move.
// A refused period ends the timer without a word, so a timer that has not ticked
// for STALL milliseconds starts again.
async function animate($: EngineInterface, list: Crewmate[], slot: number) {
  if (ticker === null && isSettled(list, columns, slot)) return
  const now = await $.clock.now()
  if (ticker !== null && now - lastTick > STALL) {
    ticker.cancel()
    ticker = null
  }
  if (ticker !== null || isSettled(list, columns, slot)) return
  lastTick = now
  ticker = $.clock.every(TICK, () => {
    stepAll($, slot).catch(() => {
      ticker?.cancel()
      ticker = null
    })
  })
}

async function stepAll($: EngineInterface, slot: number) {
  lastTick = await $.clock.now()
  const list = await update($, crew, value => stepCrew(value ?? [], columns, slot))
  if (isSettled(list, columns, slot)) {
    ticker?.cancel()
    ticker = null
  }
}

// The end of a crewmate's run: it walks off, or first stands still when it failed.
const ending = (failed: boolean) => (mate: Crewmate): Crewmate =>
  mate.phase !== 'work' ? mate : failed ? { ...mate, phase: 'failed', hold: FAIL_HOLD } : { ...mate, phase: 'done' }

// A crewmate whose end the mod did not hear (a lost event, a reload) leaves when
// the engine no longer lists its agent as one that runs. It shows the error face
// only when the engine says the agent failed or was killed: an agent that is no
// longer listed may well have finished.
async function sweepCrew($: EngineInterface) {
  const list = (await read($, crew)) ?? []
  if (list.length === 0) return
  const agents = await $.agent.list()
  const status = new Map(agents.map(agent => [agent.id, agent.status]))
  const gone = (id: string) => !status.has(id) || ENDED.has(status.get(id) ?? '')
  const failed = (id: string) => status.get(id) === 'failed' || status.get(id) === 'killed'
  if (!list.some(mate => mate.phase === 'work' && gone(mate.id))) return
  await changeCrew($, all => all.map(mate => (gone(mate.id) ? ending(failed(mate.id))(mate) : mate)))
}

export const register: Register = (on, options) => {
  // A change in the config menu loads the module again with the new mode.
  const mode = options.mode === 'tools' || options.mode === 'off' ? options.mode : 'on'
  if (mode === 'off') return

  // A new session loads the remembered tags and character.json, and starts with
  // no crew and a band that may shrink.
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const stored = await $.store.get('finals')
    const keys = Array.isArray(stored) ? stored.filter((key): key is string => typeof key === 'string') : []
    await update($, finals, () => keys.slice(-MAX_FINALS))
    const loaded = await loadOverride($)
    await update($, override, () => loaded)
    ticker?.cancel()
    ticker = null
    tallest = 0
    await update($, crew, () => [])
    return result
  })

  // A new turn of the main loop clears the last line, because it is about the
  // reply above, and lets the band shrink again. The hook also reads
  // character.json again, so an edit shows on the next turn, and sends off a
  // crewmate whose agent ended without the mod hearing it. A subagent's turn
  // changes nothing here.
  on('turn.start', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    tallest = 0
    await update($, streaming, () => true)
    await update($, saying, () => null)
    const loaded = await loadOverride($)
    await update($, override, () => loaded)
    await sweepCrew($).catch(() => {})
    return result
  })

  // Each subagent that the main loop spawns walks out from behind the character.
  // Nested agents, workflow agents and teammates stay out of the band: a teammate
  // goes idle between turns, and one in its own pane runs no loop here, so the
  // mod would never hear its end. The hook only observes: it passes every spawn
  // on unchanged.
  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (e.parentAgentId !== undefined || e.workflow !== undefined || e.isTeammate === true || result.agentId === undefined) {
      return result
    }
    const id = result.agentId
    const label = cut(clean(e.description || e.subagentType), MAX_LABEL)
    const slot = slotWidth(await character($))
    await changeCrew($, list => [...list.filter(mate => mate.id !== id), newCrewmate(id, label, slot)])
    return result
  }).catch(($, e, next) => next(e))

  // Records each tool call of the main loop that runs now, for the band above the
  // prompt. A crewmate holds the prop of the tool that its agent runs now. A call
  // of an agent that is not in the crew shows nowhere.
  // The hook only observes: it passes every call on unchanged.
  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId !== undefined) {
      if (!((await read($, crew)) ?? []).some(mate => mate.id === agentId)) return next(e)
      const toolId = e.tool_use_id ?? `call-${++calls}`
      const look = lookFor(await character($), e.tool)
      const hold = (mate: Crewmate) => (mate.id === agentId && mate.phase === 'work' ? { ...mate, look, toolId } : mate)
      await update($, crew, list => (list ?? []).map(hold))
      try {
        return await next(e)
      } finally {
        // Only if no later call of the agent took the crewmate's hands meanwhile.
        const drop = (mate: Crewmate) => (mate.id === agentId && mate.toolId === toolId ? { ...mate, look: null, toolId: null } : mate)
        await update($, crew, list => (list ?? []).map(drop))
      }
    }
    const filePath = 'file_path' in e && typeof e.file_path === 'string' ? e.file_path : undefined
    const tool: ActiveTool = {
      id: e.tool_use_id ?? `call-${++calls}`,
      label: toolLabel(e.tool, filePath),
      look: lookFor(await character($), e.tool),
    }
    await update($, running, list => [...(list ?? []), tool].slice(-20))
    try {
      return await next(e)
    } finally {
      await update($, running, list => (list ?? []).filter(one => one.id !== tool.id))
    }
  }).catch(($, e, next) => next(e))

  // The protocol goes into the system prompt, so Claude sees it on every request.
  // Only a session on the terminal or the desktop app gets it: elsewhere, nothing draws the band.
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    if (mode !== 'on' || !e.surfaces.some(surface => surface === 'terminal' || surface === 'desktop')) return result
    return {
      sections: [...result.sections, { id: 'claudesay:protocol', text: PROTOCOL, scope: 'session' as const }],
    }
  })

  // At the end of a main-loop turn, the tag at the end of the final answer becomes
  // the line. The mod remembers the tag, so the screen hides it in this reply
  // only. A turn that ends any other way gives no line, but the mod remembers its
  // tag, whole or cut, if any. The end of a subagent's turn sends its crewmate off.
  on('turn.complete', async ($, e, next) => {
    try {
      const result = await next(e)
      if (e.agentId !== undefined) {
        // A subagent's run is one turn: its end is the agent's end.
        const id = e.agentId
        if (((await read($, crew)) ?? []).some(mate => mate.id === id)) {
          const end = ending(e.reason !== 'answer')
          await changeCrew($, list => list.map(mate => (mate.id === id ? end(mate) : mate)))
        }
        return result
      }
      await update($, running, () => [])
      const { says, tag } = parseReply(e.answer)
      if (tag !== null) await remember($, tag)
      // An interrupt, a refusal or an error can cut the reply inside its tag. The
      // screen hides that part too. Only an answer gives a line.
      const cutOff = e.reason === 'answer' ? null : unfinishedTag(e.answer)
      if (cutOff !== null) await remember($, cutOff)
      if (mode === 'on') await update($, saying, () => (e.reason === 'answer' ? says : null))
      return result
    } finally {
      // Always, so a failed hook cannot leave unfinished tags hidden.
      if (e.agentId === undefined) await update($, streaming, () => false)
    }
  }).catch(($, e, next) => next(e))

  // Takes the tag off the end of a reply on the screen. The stored message keeps
  // it. parseReply keeps a tag that says more than the reply, so the reply on
  // the screen always holds all of the information. After its turn, a tag comes
  // off only in a final answer: a tag in a block before a tool call stays
  // visible, because the band never shows it. A tag that is not complete comes
  // off while the turn runs, and after it only when an interrupt or an error cut it there
  // (turn.complete remembered it). In the `tools` mode too, so that older
  // replies do not show raw tags.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.props.isSummary === true) return next(e)
    const isStreaming = (await read($, streaming)) === true
    let { text, tag } = parseReply(e.props.text, isStreaming)
    if (text === e.props.text && !isStreaming) {
      // A reply that an interrupt or an error cut inside its tag loses the tag only when the
      // mod remembered it. A reply that only ends like a tag keeps it.
      const cutOff = unfinishedTag(e.props.text)
      if (cutOff !== null && ((await read($, finals)) ?? []).includes(tagKey(cutOff))) text = parseReply(e.props.text, true).text
    }
    if (text === e.props.text) return next(e)
    if (tag !== null && !isStreaming && !((await read($, finals)) ?? []).includes(tagKey(tag))) return next(e)
    if (text === '') {
      // Only a tag that is not complete (it still streams, or an interrupt or an error cut
      // it), with nothing before it.
      const { Box } = $.ui.resolve(e)
      return <Box />
    }
    return next({ ...e, props: { ...e.props, text } })
  }).catch(($, e, next) => next(e))

  // The band above the prompt: the character with a prop while a tool runs,
  // a thinking face while Claude works, and the line about the last reply.
  // The crew stands to the right of the character. With only the crew to show,
  // the character stands idle beside it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const tool = (await read($, running))?.at(-1)
    const said = await read($, saying)
    const mates = (await read($, crew)) ?? []
    const art = await character($)
    const width = Math.max(MIN_WIDTH, Math.min(BUBBLE_WIDTH, e.props.bodyColumns - 6))
    columns = Math.max(MIN_WIDTH, e.props.bodyColumns)
    // The main character is upset while a crewmate stands with the error face.
    const upset = mates.some(mate => mate.phase === 'failed' && mate.hold > 0)

    let bubble: string[] = []
    let body: string[]
    if (tool !== undefined) {
      bubble = drawBubble(art, tool.label, width)
      body = drawCharacter(art, tool.look.mood, tool.label, tool.look.prop, tool.look.side)
    } else if (e.props.isWorking) body = drawCharacter(art, upset ? 'upset' : 'thinking', 'working')
    else if (said != null) {
      bubble = drawBubble(art, said.line, width)
      body = drawCharacter(art, said.mood, said.line)
    } else if (mates.length > 0) body = drawCharacter(art, upset ? 'upset' : 'happy', 'idle')
    else return next(e)
    // A new width moves the slots, so the crew may have to walk.
    await animate($, mates, slotWidth(art))
    // One blank row keeps the band apart from the transcript, with or without a bubble.
    const drawn = [' ', ...bubble, ...drawCrew(art, body, mates, columns, slotWidth(art))]
    // Blank rows above it keep the band as tall as it was in this turn, up to maxRows.
    tallest = Math.max(tallest, drawn.length)
    const rows = [...Array<string>(Math.max(0, Math.min(tallest, e.props.maxRows) - drawn.length)).fill(' '), ...drawn]

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {rows.map(line => (
          <Text mono wrap="truncate-end">
            {line}
          </Text>
        ))}
      </Box>
    )
  }).catch(($, e, next) => next(e))
}
