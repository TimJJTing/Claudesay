import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ActiveTool, CharacterOverride } from '../types'
import {
  BUBBLE_WIDTH,
  DEFAULT_CHARACTER,
  PROTOCOL,
  clean,
  cut,
  drawCharacter,
  drawSaying,
  lookFor,
  parseReply,
  tagKey,
  sanitizeOverride,
  toolLabel,
  unfinishedTag,
  withOverride,
} from './art.ts'

const running = atom({ plugin: 'claudesay', key: 'running' } as const, [])
const saying = atom({ plugin: 'claudesay', key: 'saying' } as const, null)
const override = atom({ plugin: 'claudesay', key: 'character' } as const, null)
const streaming = atom({ plugin: 'claudesay', key: 'streaming' } as const, false)
const finals = atom({ plugin: 'claudesay', key: 'finals' } as const, [])

const MAX_FILE = 64 * 1024
// How many final-answer tags the mod remembers, across sessions.
const MAX_FINALS = 500
// The narrowest bubble. Below it, the art lines are cut at the right edge.
const MIN_WIDTH = 12

// The text of character.json at the last read, so a bad file gives one toast, not one each turn.
let lastFile: string | null | undefined
let lastOverride: CharacterOverride | null = null
let calls = 0

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

export const register: Register = (on, options) => {
  // A change in the config menu loads the module again with the new mode.
  const mode = options.mode === 'tools' || options.mode === 'off' ? options.mode : 'on'
  if (mode === 'off') return

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const stored = await $.store.get('finals')
    const keys = Array.isArray(stored) ? stored.filter((key): key is string => typeof key === 'string') : []
    await update($, finals, () => keys.slice(-MAX_FINALS))
    const loaded = await loadOverride($)
    await update($, override, () => loaded)
    return result
  })

  // A new turn clears the last line, because it is about the reply above.
  // The hook also reads character.json again, so an edit shows on the next turn.
  on('turn.start', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    await update($, streaming, () => true)
    await update($, saying, () => null)
    const loaded = await loadOverride($)
    await update($, override, () => loaded)
    return result
  })

  // Records each tool call that runs now, for the band above the prompt.
  // The hook only observes: it passes every call on unchanged.
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
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

  // At the end of a turn, the tag at the end of the final answer becomes the line.
  // The mod remembers the tag, so the screen hides it in this reply only.
  on('turn.complete', async ($, e, next) => {
    try {
      const result = await next(e)
      if (e.agentId !== undefined) return result
      await update($, running, () => [])
      const { says, tag } = e.reason === 'answer' ? parseReply(e.answer) : { says: null, tag: null }
      if (tag !== null) await remember($, tag)
      // An interrupt can cut the reply inside its tag. The screen hides that part too.
      const cutOff = e.reason === 'aborted' ? unfinishedTag(e.answer) : null
      if (cutOff !== null) await remember($, cutOff)
      if (mode === 'on') await update($, saying, () => says)
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
  // visible, because the band never shows it. In the `tools` mode too, so that
  // older replies do not show raw tags.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.props.isSummary === true) return next(e)
    const isStreaming = (await read($, streaming)) === true
    let { text, tag } = parseReply(e.props.text, isStreaming)
    if (text === e.props.text && !isStreaming) {
      // A reply that an interrupt cut inside its tag. The mod remembered that tag.
      const cutOff = unfinishedTag(e.props.text)
      if (cutOff !== null && ((await read($, finals)) ?? []).includes(tagKey(cutOff))) text = parseReply(e.props.text, true).text
    }
    if (text === e.props.text) return next(e)
    if (tag !== null && !isStreaming && !((await read($, finals)) ?? []).includes(tagKey(tag))) return next(e)
    if (text === '') {
      // Only a tag that still streams, with nothing before it yet.
      const { Box } = $.ui.resolve(e)
      return <Box />
    }
    return next({ ...e, props: { ...e.props, text } })
  }).catch(($, e, next) => next(e))

  // The band above the prompt: the character with a prop while a tool runs,
  // a thinking face while Claude works, and the line about the last reply.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const tool = (await read($, running))?.at(-1)
    const said = await read($, saying)
    const art = await character($)
    const width = Math.max(MIN_WIDTH, Math.min(BUBBLE_WIDTH, e.props.bodyColumns - 6))

    let rows: string[]
    if (tool !== undefined) rows = drawSaying(art, tool.label, tool.look.mood, tool.look, width)
    else if (e.props.isWorking) rows = drawCharacter(art, 'thinking', 'working')
    else if (said != null) rows = drawSaying(art, said.line, said.mood, undefined, width)
    else return next(e)

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
