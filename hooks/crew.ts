// The crew: one small character for each subagent that the main loop spawned.
// Pure code, like art.ts: no `$`, no state. The hooks module keeps the list in
// an atom and moves it one step on each tick of a timer.
import type { Crewmate, Mood } from '../types'
import { type Character, cellWidth, clean, drawCharacter } from './art.ts'

// Columns between two characters.
const GAP = 2
// Columns a crewmate moves on each tick. A crewmate that leaves walks faster,
// because the way to the right edge is longer.
const STEP = 2
const LEAVE_STEP = 3
// Ticks that a crewmate that failed stands still with the error face.
export const FAIL_HOLD = 16

// A crewmate that leaves: it is done, or it failed and stood still long enough.
const isWalking = (mate: Crewmate) => mate.phase === 'done' || (mate.phase === 'failed' && mate.hold === 0)

// The columns one slot takes: one character and the gap after it.
export function slotWidth(character: Character): number {
  return 2 * character.sideWidth + character.centerWidth + GAP
}

// How many crewmates fit to the right of the main character.
export function slotCount(columns: number, slot: number): number {
  return Math.max(0, Math.floor((columns - slot + GAP) / slot))
}

// How many crewmates get a slot. When some do not fit, the last slot shows a
// count of the others instead.
export function visibleCount(total: number, slots: number): number {
  return total <= slots ? total : Math.max(0, slots - 1)
}

// Where a crewmate walks to. A crewmate that left walks past the right edge. A
// crewmate with no slot waits behind the main character, out of sight.
export function targetOf(index: number, mate: Crewmate, total: number, columns: number, slot: number): number {
  if (isWalking(mate)) return columns
  return index < visibleCount(total, slotCount(columns, slot)) ? slot * (index + 1) : -slot
}

// A new crewmate starts behind the main character, out of sight.
export function newCrewmate(id: string, label: string, slot: number): Crewmate {
  return { id, label, look: null, toolId: null, x: -slot, phase: 'work', hold: 0 }
}

// One tick: each crewmate moves a step to its target. A crewmate that left is
// gone at the right edge. A crewmate that ended out of sight is gone at once.
export function stepCrew(crew: readonly Crewmate[], columns: number, slot: number): Crewmate[] {
  const next: Crewmate[] = []
  crew.forEach((mate, index) => {
    const ended = mate.phase !== 'work'
    if (ended && mate.x <= -slot) return
    if (isWalking(mate) && mate.x >= columns) return
    const target = targetOf(index, mate, crew.length, columns, slot)
    const step = isWalking(mate) ? LEAVE_STEP : STEP
    const x = mate.x < target ? Math.min(target, mate.x + step) : Math.max(target, mate.x - step)
    next.push({ ...mate, x, hold: Math.max(0, mate.hold - 1) })
  })
  return next
}

// True when no crewmate moves, waits or leaves: the timer can stop.
export function isSettled(crew: readonly Crewmate[], columns: number, slot: number): boolean {
  return crew.every((mate, index) => mate.phase === 'work' && mate.x === targetOf(index, mate, crew.length, columns, slot))
}

// A crewmate is happy while it walks in or between slots, and thinks while it
// stands with empty hands.
export function moodOf(mate: Crewmate, moving: boolean): Mood {
  if (mate.phase === 'done') return 'happy'
  if (mate.phase === 'failed') return 'error'
  if (mate.look !== null) return mate.look.mood
  return moving ? 'happy' : 'thinking'
}

// ── Drawing ─────────────────────────────────────────────────────────────────

// Splits a line into terminal cells. A wide character takes two: the
// character, then an empty string. Joined emoji, flags, variation selectors
// and skin tones stay in one cell, as cellWidth counts them.
function toCells(line: string): string[] {
  const clusters: string[] = []
  let afterJoiner = false
  let openFlag = false
  for (const ch of line) {
    const cp = ch.codePointAt(0) ?? 0
    const regional = cp >= 0x1f1e6 && cp <= 0x1f1ff
    const joins =
      cp === 0x200d ||
      (cp >= 0xfe00 && cp <= 0xfe0f) ||
      (cp >= 0x300 && cp <= 0x36f) ||
      (cp >= 0x1f3fb && cp <= 0x1f3ff) ||
      afterJoiner ||
      (regional && openFlag)
    afterJoiner = cp === 0x200d
    openFlag = regional && !openFlag
    if (joins && clusters.length > 0) clusters[clusters.length - 1] += ch
    else clusters.push(ch)
  }
  const cells: string[] = []
  for (const cluster of clusters) {
    const width = cellWidth(cluster)
    if (width === 0) continue
    cells.push(cluster)
    if (width === 2) cells.push('')
  }
  return cells
}

type Canvas = string[][]

// Draws a line at column `x`. The line is opaque from its first character to
// its end, so a character in front hides the one behind it. The leading spaces
// stay clear, so the art keeps its shape.
function paint(canvas: Canvas, row: number, x: number, line: string) {
  const out = canvas[row]
  if (out === undefined) return
  const cells = toCells(line)
  const first = cells.findIndex(cell => cell !== ' ')
  if (first < 0) return
  const put = (col: number, cell: string) => {
    if (col < 0 || col >= out.length) return
    // Never leave half of a wide character.
    if (out[col] === '' && col > 0) out[col - 1] = ' '
    if (out[col] !== '' && out[col + 1] === '') out[col + 1] = ' '
    out[col] = cell
  }
  for (let i = first; i < cells.length; i++) {
    const col = x + i
    const cell = cells[i]!
    if (cell === '') continue
    const wide = cells[i + 1] === ''
    // A wide character that the edge cuts in half draws as a space.
    if (wide && (col < 0 || col + 1 >= out.length)) {
      put(col, ' ')
      put(col + 1, ' ')
      continue
    }
    put(col, cell)
    if (wide) put(col + 1, '')
  }
}

// Cuts a label to `width` cells.
function fit(text: string, width: number): string {
  let out = ''
  let used = 0
  for (const cell of toCells(clean(text).replace(/\s+/g, ' '))) {
    if (cell === '') continue
    const w = cellWidth(cell)
    if (used + w > width) break
    out += cell
    used += w
  }
  return out
}

// The band below the bubble: the main character on the left and the crew to
// its right, each crewmate with its label under its feet. The main character
// is in front, so a crewmate that walks in comes out from behind it. A
// crewmate that leaves is in front of the others.
export function drawCrew(
  character: Character,
  main: readonly string[],
  crew: readonly Crewmate[],
  columns: number,
  slot: number,
): string[] {
  if (crew.length === 0) return [...main]
  const slots = slotCount(columns, slot)
  const shown = visibleCount(crew.length, slots)
  const sprites = crew.map((mate, index) => {
    const target = targetOf(index, mate, crew.length, columns, slot)
    const look = mate.phase === 'work' ? mate.look : null
    return {
      mate,
      rows: drawCharacter(character, moodOf(mate, mate.x !== target), mate.id, look?.prop ?? null, look?.side ?? null),
    }
  })
  const height = Math.max(main.length, ...sprites.map(sprite => sprite.rows.length))
  const canvas: Canvas = Array.from({ length: height + 1 }, () => Array<string>(columns).fill(' '))
  const ordered = [...sprites.filter(s => !isWalking(s.mate)), ...sprites.filter(s => isWalking(s.mate))]
  for (const { mate, rows } of ordered) {
    const top = height - rows.length
    rows.forEach((line, i) => paint(canvas, top + i, mate.x, line))
    paint(canvas, height, mate.x + character.sideWidth - 2, fit(mate.label, slot - character.sideWidth))
  }
  main.forEach((line, i) => paint(canvas, height - main.length + i, 0, line))

  const hidden = crew.length - shown
  if (hidden > 0) {
    const middle = height - character.cellHeight * 2 + Math.floor(character.cellHeight / 2)
    // No slot at all: a short count beside the main character.
    if (slots === 0) paint(canvas, middle, slot - 1, `🤖×${hidden}`)
    else paint(canvas, middle, slot * slots + 2, `+${hidden} more`)
  }
  const lines = canvas.map(row => row.join('').trimEnd())
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}
