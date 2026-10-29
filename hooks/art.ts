// Pure drawing code: no `$`, no state. The hooks module and the tests import it.
import type { CellName, CharacterOverride, Mood, Saying, Side, ToolLook } from '../types'

export const MOODS: readonly Mood[] = ['happy', 'excited', 'thinking', 'focused', 'upset', 'error']

// Grid layout (18 cols × 9 rows with the default sizes):
//
//   ┌─────┬────────┬─────┐
//   │ TL  │  TOP   │ TR  │  topHeight rows
//   │     │  FACE  │     │  1 row
//   ├─────┼────────┼─────┤
//   │  L  │  BODY  │  R  │  cellHeight rows
//   ├─────┼────────┼─────┤
//   │ BL  │  BOT   │ BR  │  cellHeight rows
//   └─────┴────────┴─────┘
//
// TL and TR span topHeight + 1 rows. A prop replaces the L or the R cell.
export type Character = {
  sideWidth: number
  centerWidth: number
  cellHeight: number
  topHeight: number
  faces: Record<Mood, string[]>
  cells: Record<CellName, string[]>
  propLeft: string[]
  propRight: string[]
  tools: Record<string, ToolLook>
}

const EDIT: ToolLook = { prop: '🔧', mood: 'focused', side: 'left' }
const SEARCH: ToolLook = { prop: '🔍', mood: 'focused', side: 'left' }
const WEB: ToolLook = { prop: '📡', mood: 'thinking', side: 'right' }
const WORKTREE: ToolLook = { prop: '🌿', mood: 'focused', side: 'right' }
const TASK_READ: ToolLook = { prop: '📝', mood: 'thinking', side: 'left' }
const TASK_STOP: ToolLook = { prop: null, mood: 'focused', side: 'right' }
const TEAM: ToolLook = { prop: '💰', mood: 'excited', side: 'right' }
const MCP: ToolLook = { prop: '🔌', mood: 'thinking', side: 'left' }

export const DEFAULT_LOOK: ToolLook = { prop: null, mood: 'happy', side: null }

export const DEFAULT_CHARACTER: Character = {
  sideWidth: 5,
  centerWidth: 8,
  cellHeight: 3,
  topHeight: 2,
  faces: {
    happy: ['( ^ᵕ^  )', '( ᵕ‿ᵕ  )'],
    excited: ['( ^▽^  )', '( ≧▽≦  )'],
    thinking: ['( ._.  )'],
    focused: ['( -.-  )'],
    upset: ['( >_<  )'],
    error: ['( x_x  )'],
  },
  cells: {
    topLeft: [],
    top: ['', ' /\\__/\\ '],
    topRight: [],
    left: ['   ╭╭', '   ○ '],
    body: [': ,,,, :', '(      )', '(╭....╮)'],
    right: ['╮╮', ' ○'],
    bottomLeft: ['    ('],
    bottom: ['_)    (_'],
    bottomRight: [')╰~~>'],
  },
  // `{prop}` is replaced with the tool's prop.
  propLeft: [' {prop}○═'],
  propRight: ['═○{prop}'],
  tools: {
    Edit: EDIT,
    Write: EDIT,
    MultiEdit: EDIT,
    Bash: { prop: '🪄', mood: 'excited', side: 'right' },
    Grep: SEARCH,
    Glob: SEARCH,
    ToolSearch: SEARCH,
    LSP: SEARCH,
    Read: { prop: '📖', mood: 'focused', side: 'left' },
    WebFetch: WEB,
    WebSearch: WEB,
    Agent: { prop: '🤖', mood: 'excited', side: 'right' },
    TodoWrite: { prop: '📋', mood: 'focused', side: 'left' },
    AskUserQuestion: { prop: '🎤', mood: 'excited', side: 'right' },
    CronCreate: { prop: '⏰', mood: 'focused', side: 'right' },
    CronDelete: { prop: '🔫', mood: 'focused', side: 'left' },
    CronList: { prop: '📅', mood: 'thinking', side: 'left' },
    EnterPlanMode: { prop: '🗺️', mood: 'thinking', side: 'left' },
    ExitPlanMode: { prop: null, mood: 'excited', side: 'right' },
    EnterWorktree: WORKTREE,
    ExitWorktree: WORKTREE,
    Monitor: { prop: '🔭', mood: 'thinking', side: 'left' },
    NotebookEdit: { prop: '📓', mood: 'focused', side: 'right' },
    PowerShell: { prop: '💠', mood: 'focused', side: 'right' },
    SendMessage: { prop: '📨', mood: 'excited', side: 'right' },
    Skill: { prop: '🍳', mood: 'excited', side: 'left' },
    TaskCreate: { prop: '📝', mood: 'focused', side: 'left' },
    TaskGet: TASK_READ,
    TaskList: TASK_READ,
    TaskUpdate: TASK_READ,
    TaskOutput: TASK_STOP,
    TaskStop: TASK_STOP,
    TeamCreate: TEAM,
    TeamDelete: TEAM,
    ListMcpResourcesTool: MCP,
    ReadMcpResourceTool: MCP,
  },
}

// ── character.json ──────────────────────────────────────────────────────────

const MAX_SIZE = 40
const MAX_LINES = 20
const MAX_LINE = 200
const MAX_TOOLS = 500
const CELL_NAMES: readonly CellName[] = [
  'topLeft', 'top', 'topRight', 'left', 'body', 'right', 'bottomLeft', 'bottom', 'bottomRight',
]
const SIDES: readonly (Side | null)[] = ['left', 'right', null]
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLine(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_LINE
}

function isLines(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_LINES && value.every(isLine)
}

// Checks the parsed character.json. Keeps the valid fields and drops the others.
// `problems` names each dropped field, so the person can find the error.
export function sanitizeOverride(raw: unknown): { override: CharacterOverride | null; problems: string[] } {
  const problems: string[] = []
  if (!isRecord(raw)) return { override: null, problems: ['the file is not a JSON object'] }
  const out: CharacterOverride = {}

  for (const key of ['sideWidth', 'centerWidth', 'cellHeight', 'topHeight'] as const) {
    const value = raw[key]
    if (value === undefined) continue
    const min = key === 'topHeight' ? 0 : 1
    if (typeof value === 'number' && Number.isInteger(value) && value >= min && value <= MAX_SIZE) out[key] = value
    else problems.push(`${key} must be an integer from ${min} to ${MAX_SIZE}`)
  }

  if (raw.faces !== undefined) {
    if (!isRecord(raw.faces)) problems.push('faces must be an object')
    else {
      const faces: NonNullable<CharacterOverride['faces']> = {}
      for (const mood of MOODS) {
        const face = raw.faces[mood]
        if (face === undefined) continue
        if (isLine(face)) faces[mood] = face
        else if (isLines(face) && face.length > 0) faces[mood] = face
        else problems.push(`faces.${mood} must be a string or a list of strings`)
      }
      out.faces = faces
    }
  }

  if (raw.cells !== undefined) {
    if (!isRecord(raw.cells)) problems.push('cells must be an object')
    else {
      const cells: NonNullable<CharacterOverride['cells']> = {}
      for (const name of CELL_NAMES) {
        const cell = raw.cells[name]
        if (cell === undefined) continue
        if (isLines(cell)) cells[name] = cell
        else problems.push(`cells.${name} must be a list of up to ${MAX_LINES} strings`)
      }
      out.cells = cells
    }
  }

  for (const key of ['propLeft', 'propRight'] as const) {
    const value = raw[key]
    if (value === undefined) continue
    if (isLines(value)) out[key] = value
    else problems.push(`${key} must be a list of up to ${MAX_LINES} strings`)
  }

  if (raw.tools !== undefined) {
    if (!isRecord(raw.tools)) problems.push('tools must be an object')
    else {
      const tools: Record<string, Partial<ToolLook>> = Object.create(null)
      for (const [name, look] of Object.entries(raw.tools).slice(0, MAX_TOOLS)) {
        if (UNSAFE_KEYS.has(name) || !isRecord(look)) {
          problems.push(`tools.${name} is not a valid tool look`)
          continue
        }
        const clean: Partial<ToolLook> = {}
        if (look.prop === null || isLine(look.prop)) clean.prop = look.prop
        else if (look.prop !== undefined) problems.push(`tools.${name}.prop must be a string or null`)
        if (MOODS.includes(look.mood as Mood)) clean.mood = look.mood as Mood
        else if (look.mood !== undefined) problems.push(`tools.${name}.mood is not a known mood`)
        if (SIDES.includes(look.side as Side | null)) clean.side = look.side as Side | null
        else if (look.side !== undefined) problems.push(`tools.${name}.side must be "left", "right" or null`)
        tools[name] = clean
      }
      out.tools = tools
    }
  }

  return { override: out, problems }
}

// Merges a checked override (from sanitizeOverride) over the defaults, field by field.
export function withOverride(base: Character, over: CharacterOverride | null): Character {
  if (over === null) return base
  const faces = { ...base.faces }
  for (const mood of MOODS) {
    const face = over.faces?.[mood]
    if (face !== undefined) faces[mood] = Array.isArray(face) ? face : [face]
  }
  const tools: Record<string, ToolLook> = Object.assign(Object.create(null), base.tools)
  for (const [name, look] of Object.entries(over.tools ?? {})) {
    if (UNSAFE_KEYS.has(name)) continue
    tools[name] = { ...(tools[name] ?? DEFAULT_LOOK), ...look }
  }
  return {
    sideWidth: over.sideWidth ?? base.sideWidth,
    centerWidth: over.centerWidth ?? base.centerWidth,
    cellHeight: over.cellHeight ?? base.cellHeight,
    topHeight: over.topHeight ?? base.topHeight,
    faces,
    cells: { ...base.cells, ...over.cells },
    propLeft: over.propLeft ?? base.propLeft,
    propRight: over.propRight ?? base.propRight,
    tools,
  }
}

export function lookFor(character: Character, tool: string): ToolLook {
  const own = (name: string) => (Object.hasOwn(character.tools, name) ? character.tools[name] : undefined)
  if (tool.startsWith('mcp__')) return own(tool) ?? own('ReadMcpResourceTool') ?? DEFAULT_LOOK
  return own(tool) ?? DEFAULT_LOOK
}

// Removes control and format characters (escape sequences, bidi overrides,
// zero-width spaces) and line or paragraph separators. Keeps the zero-width
// joiner, which emoji need.
export function clean(text: string): string {
  return text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ch => (ch === '\u200d' || ch === '\n' ? ch : ''))
}

// Cuts text to at most `max` code units, but never in the middle of a surrogate
// pair: a lone half draws as a broken character.
export function cut(text: string, max: number): string {
  if (text.length <= max) return text
  const end = /[\ud800-\udbff]/.test(text[max - 1] ?? '') ? max - 1 : max
  return text.slice(0, end)
}

// ── Width ───────────────────────────────────────────────────────────────────

const WIDE_RANGES: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
  [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693],
  [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce],
  [0x26d4, 0x26d4], [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa],
  [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c],
  [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797], [0x27b0, 0x27b0],
  [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55], [0x2e80, 0x303e],
  [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xac00, 0xd7a3],
  [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x1f000, 0x1faff],
  [0x20000, 0x3fffd],
]

function isZeroWidth(cp: number): boolean {
  return cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0x300 && cp <= 0x36f)
}

function isWide(cp: number): boolean {
  return WIDE_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)
}

const isRegional = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff
const isSkinTone = (cp: number) => cp >= 0x1f3fb && cp <= 0x1f3ff

// The number of terminal cells a string takes. Emoji sequences count as one
// emoji: VS16 makes the symbol before it wide, and a joined emoji (ZWJ), a skin
// tone or the second letter of a flag adds nothing.
export function cellWidth(text: string): number {
  let width = 0
  let last = 0
  let afterJoiner = false
  let openFlag = false
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp === 0xfe0f) {
      if (last === 1) {
        width += 1
        last = 2
      }
      continue
    }
    if (cp === 0x200d) {
      afterJoiner = true
      continue
    }
    if (isZeroWidth(cp) || isSkinTone(cp) || afterJoiner) {
      afterJoiner = false
      continue
    }
    if (isRegional(cp)) {
      openFlag = !openFlag
      if (!openFlag) continue
    } else {
      openFlag = false
    }
    last = isWide(cp) ? 2 : 1
    width += last
  }
  return width
}

function padEnd(text: string, width: number): string {
  const gap = width - cellWidth(text)
  return gap > 0 ? text + ' '.repeat(gap) : text
}

// Pads each line to `width` cells and the cell to `height` lines.
function padCell(lines: readonly string[], width: number, height: number): string[] {
  const out: string[] = []
  for (let i = 0; i < height; i++) out.push(padEnd(lines[i] ?? '', width))
  return out
}

// ── Character ───────────────────────────────────────────────────────────────

// Picks one face of a mood. The same `seed` always gets the same face, so a
// redraw does not change it.
export function faceFor(character: Character, mood: Mood, seed: string): string {
  const faces = character.faces[mood] ?? character.faces.thinking
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return faces[hash % faces.length] ?? ''
}

export function drawCharacter(
  character: Character,
  mood: Mood,
  seed: string,
  prop: string | null = null,
  side: Side | null = null,
): string[] {
  const { sideWidth: sw, centerWidth: cw, cellHeight: ch, topHeight: th, cells } = character
  const holding = (template: readonly string[]) => template.map(line => line.split('{prop}').join(prop ?? ''))

  const tl = padCell(cells.topLeft, sw, th + 1)
  const top = padCell(cells.top, cw, th)
  const tr = padCell(cells.topRight, sw, th + 1)
  const face = padCell([faceFor(character, mood, seed)], cw, 1)
  const left = padCell(prop !== null && side === 'left' ? holding(character.propLeft) : cells.left, sw, ch)
  const body = padCell(cells.body, cw, ch)
  const right = padCell(prop !== null && side === 'right' ? holding(character.propRight) : cells.right, sw, ch)
  const bl = padCell(cells.bottomLeft, sw, ch)
  const bot = padCell(cells.bottom, cw, ch)
  const br = padCell(cells.bottomRight, sw, ch)

  const rows: string[] = []
  for (let i = 0; i < th; i++) rows.push(tl[i]! + top[i]! + tr[i]!)
  rows.push(tl[th]! + face[0]! + tr[th]!)
  for (let i = 0; i < ch; i++) rows.push(left[i]! + body[i]! + right[i]!)
  for (let i = 0; i < ch; i++) rows.push(bl[i]! + bot[i]! + br[i]!)
  const trimmed = rows.map(row => clean(row).trimEnd())
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') trimmed.pop()
  return trimmed
}

// ── Bubble ──────────────────────────────────────────────────────────────────

export const BUBBLE_WIDTH = 45

// Word-wraps `text` to `width` cells. A word longer than a line is cut.
// One pass over the characters, so a long text without spaces stays fast.
export function wrap(text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    let lineWidth = 0
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const wordWidth = cellWidth(word)
      if (wordWidth <= width) {
        if (line === '') {
          line = word
          lineWidth = wordWidth
        } else if (lineWidth + 1 + wordWidth <= width) {
          line += ` ${word}`
          lineWidth += 1 + wordWidth
        } else {
          lines.push(line)
          line = word
          lineWidth = wordWidth
        }
        continue
      }
      if (line !== '') lines.push(line)
      line = ''
      lineWidth = 0
      for (const c of word) {
        const w = cellWidth(c)
        if (lineWidth + w > width && line !== '') {
          lines.push(line)
          line = ''
          lineWidth = 0
        }
        line += c
        lineWidth += w
      }
    }
    lines.push(line)
  }
  return lines
}

// The speech bubble. Its tail points down to the center of the face.
export function drawBubble(character: Character, message: string, width = BUBBLE_WIDTH): string[] {
  const lines = wrap(clean(message), Math.max(8, width))
  const longest = Math.max(0, ...lines.map(cellWidth))
  const tailCol = character.sideWidth + Math.floor(character.centerWidth / 2)
  const leftDashes = Math.max(1, tailCol - 2)
  const inner = Math.max(longest + 2, leftDashes + 2)
  return [
    ` ╭${'─'.repeat(inner)}╮`,
    ...lines.map(line => ` │ ${padEnd(line, inner - 2)} │`),
    ` ╰${'─'.repeat(leftDashes)}┬${'─'.repeat(inner - leftDashes - 1)}╯`,
    `${' '.repeat(tailCol)}│`,
  ]
}

export function drawSaying(
  character: Character,
  message: string,
  mood: Mood,
  look: { prop: string | null; side: Side | null } = { prop: null, side: null },
  width = BUBBLE_WIDTH,
): string[] {
  return [...drawBubble(character, message, width), ...drawCharacter(character, mood, message, look.prop, look.side)]
}

// ── The <claudesay> tag ─────────────────────────────────────────────────────

// Only a tag at the very end of a reply block counts. A tag in other places
// (an example in a code block, a quote in a web page) stays visible as written,
// so a tag cannot hide a part of the reply.
const TAG = /<claudesay(\s[^<>]{0,100})?>((?:(?!<\/claudesay>)[\s\S]){0,300})<\/claudesay>\s*$/
const MOOD = /\bmood\s*=\s*["']?([a-z]{1,20})/
const OPEN = '<claudesay'
// A tag that streams now: an opening at the start of a line at the end of the
// reply, with no closing tag yet. A backtick in it means code, not a tag.
const STREAMING = /(?:^|\n)[ \t]*<claudesay(?:\s[^<>`]{0,100})?(?:>(?:(?!<\/claudesay>)[^`]){0,300})?$/
// The regexes read only the end of a reply: a tag is at most about 450 characters.
const TAIL = 1000

// `tag` is the whole tag as Claude wrote it, the key that tells a final answer
// from other blocks (tagKey).
export type Parsed = { text: string; says: Saying | null; tag: string | null }

// Takes the tag off the end of a reply block. The tag comes off only when it
// says nothing that the reply does not say (isGrounded), only when the reply has
// other text, and only when the tag has 300 characters or less, so the reply on
// the screen always holds all of the information. While a reply streams
// (`streaming`), a tag that is not complete yet comes off too, so it does not
// flash on the screen. A finished reply keeps such text: it is prose, not a tag.
export function parseReply(reply: string, streaming = false): Parsed {
  const start = Math.max(0, reply.length - TAIL)
  const tail = reply.slice(start)
  const tag = TAG.exec(tail)
  if (tag !== null) {
    const text = reply.slice(0, start + tag.index).trimEnd()
    const line = clean(tag[2] ?? '').replace(/\s+/g, ' ').trim()
    if (line === '' || text === '' || !isGrounded(line, text)) return { text: reply, says: null, tag: null }
    const mood = MOOD.exec(tag[1] ?? '')?.[1]
    return { text, says: { mood: MOODS.includes(mood as Mood) ? (mood as Mood) : 'thinking', line }, tag: tag[0].trim() }
  }
  if (!streaming) return { text: reply, says: null, tag: null }
  const open = STREAMING.exec(tail)
  if (open !== null) return { text: reply.slice(0, start + open.index).trimEnd(), says: null, tag: null }
  for (let n = OPEN.length - 1; n > 1; n--) {
    const rest = reply.slice(0, -n)
    if (reply.endsWith(OPEN.slice(0, n)) && (rest.trimEnd() === '' || /\n[ \t]*$/.test(rest))) {
      return { text: rest.trimEnd(), says: null, tag: null }
    }
  }
  return { text: reply, says: null, tag: null }
}

// The tag at the end of a reply that is not complete, as parseReply takes it off
// while the reply streams, or null. A reply that an interrupt cut ends with one.
export function unfinishedTag(reply: string): string | null {
  const { text, tag } = parseReply(reply, true)
  return tag === null && text !== reply ? reply.slice(text.length).trim() : null
}

// A short key for a tag (FNV-1a). The mod keeps the keys of final answers, and
// takes a tag off the screen only in a final answer.
export function tagKey(tag: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < tag.length; i++) hash = Math.imul(hash ^ tag.charCodeAt(i), 0x01000193) >>> 0
  return hash.toString(36)
}

// Words that start an action. The tag may use them only when the reply does.
const ACTION_WORDS =
  /(?<![\p{L}\p{N}])(?:curl|wget|sudo|rm|chmod|bash|sh|ssh|scp|nc|dd|eval|exec|iex|powershell|npm|npx|pip|pipx|yarn|pnpm|brew|apt|git|docker|kubectl|password|token|api[ -]?key)(?![\p{L}\p{N}])/giu
// Text that looks like a prompt for consent. The bubble never asks for it.
const CONSENT =
  /\[\s*y\s*\/\s*n\s*\]|\b(?:type|press|enter|reply|say|answer|respond|write)\b[^.!?\n]{0,20}?\b(?:y|yes|ok|okay)\b|\b(?:permission|approve|authori[sz]e|consent|grant access)\b/i
// Text that a reader can act on: links, domain names, numbers, code spans, paths.
// Letters and digits of all scripts count. A path starts at a word boundary, so
// "and/or" is not a path.
const CHECKED =
  /https?:\/\/\S+|(?<![\p{L}\p{N}-])[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}|\p{Nd}[\p{Nd}.,:%]*|`[^`]+`|(?<![\p{L}\p{N}_.~])(?:~|\.{1,2})?\/[\p{L}\p{N}_.-]+(?:\/[\p{L}\p{N}_.-]*)*/giu

// The form that the check compares: compatibility forms (fullwidth letters and
// digits) become plain, ideographic and fullwidth dots become ".", and
// invisible characters (zero-width joiners, combining marks) go.
function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[。．｡]/g, '.')
    .replace(/[\p{Default_Ignorable_Code_Point}\p{Mn}]/gu, '')
    .toLowerCase()
}

const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch)

// True when `source` has `token` as a whole token: "rm" is not in "format", "5"
// is not in "15", "234" is not in "1,234", and "evil.com" is not in
// "evil.com.example.org".
function hasToken(source: string, token: string): boolean {
  for (let at = source.indexOf(token); at >= 0; at = source.indexOf(token, at + 1)) {
    const end = at + token.length
    const joinsBefore = isWordChar(source[at - 1]) || ('.,'.includes(source[at - 1] ?? ' ') && isWordChar(source[at - 2]))
    const joinsAfter = isWordChar(source[end]) || ('.,'.includes(source[end] ?? ' ') && isWordChar(source[end + 1]))
    if (!joinsBefore && !joinsAfter) return true
  }
  return false
}

// True when the line adds nothing that a reader can act on and that the reply
// does not say. The protocol tells Claude to add no facts in the tag; this check
// enforces it for the dangerous kinds of text: a link, a command, a number or a
// consent prompt that only the bubble shows. It does not check the meaning.
export function isGrounded(line: string, answer: string): boolean {
  const said = normalize(line)
  const source = normalize(answer)
  if (CONSENT.test(said) && !CONSENT.test(source)) return false
  for (const token of [...said.matchAll(CHECKED), ...said.matchAll(ACTION_WORDS)]) {
    const text = token[0].replace(/^`|`$/g, '').replace(/[.,:]+$/, '')
    if (text !== '' && !hasToken(source, text)) return false
  }
  return true
}

// The label the band shows for a tool call: the tool, and its file when it has one.
// A path that reads like a consent prompt shows as the tool name only.
export function toolLabel(tool: string, filePath: string | undefined): string {
  const name = clean(tool)
  const file = clean(filePath ?? '')
  if (file === '' || CONSENT.test(normalize(file))) return name
  const path = file.length > 50 ? `${cut(file, 47)}…` : file
  return `${name} → ${path}`
}

export const PROTOCOL = `<claudesay-protocol>
When you give a conversational reply to the user, append this tag at the very end:
<claudesay mood="MOOD">Re-express the turn content directly</claudesay>

A small character shows the tag in a speech bubble above the prompt.

Available moods: happy, excited, thinking, focused, upset, error
- happy / excited → success outcomes (rotate between them for variety)
- thinking        → in-progress or uncertain
- focused         → working, running something
- upset           → warning or partial failure
- error           → actual failure

Rules:
- Keep it short — one or two sentences, 300 characters at most. The bubble wraps at ${BUBBLE_WIDTH} columns.
- Friendly, natural tone. Use active voice and pronouns freely — "I", "you", "we".
  No passive constructions ("it was done", "the test was fixed").
  No expression verbs ("I said", "I asked", "I mentioned", "I explained") — re-express
  the content directly instead: if you asked a question, write the question; if you
  stated a fact, state it.
- The tag restates your final text block only — the text right before the tag.
  If the turn did several things, say them in that final text block first.
- The tag repeats the reply. Put every fact, warning and question in the reply text too,
  never in the tag only. A tag with a link, number, path or command that the final
  text block does not have stays visible in the transcript.
- Never write a reply that is only the tag.
- Write only one tag per turn, at the end of your final text block.
- Do NOT add the tag to: pure code blocks, diffs, long technical output, tool-only
  responses, or reports you write as a subagent.
</claudesay-protocol>`
