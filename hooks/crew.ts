// The crew: one small character for each subagent that the main loop spawned.
// Pure code, like art.ts: no `$`, no state. The hooks module keeps the list in
// an atom and moves it one step on each tick of a timer.
import type { Crewmate, Drop, Mood } from '../types'
import { type Character, cellWidth, clean, drawCharacter, isRegional, isSkinTone, isZeroWidth } from './art.ts'

// Columns between two characters.
const GAP = 2
// The label under the main character while it has a crew.
const CAPTAIN = 'Captain'
// Columns a crewmate moves on each tick, to a slot that is free.
const STEP = 2
// Ticks that a crewmate that failed stands still with the error face.
export const FAIL_HOLD = 16
// The plane that brings a crewmate in the docked pane. It flies along the top
// of the pane from left to right, and the crewmate jumps from the door when the
// door is over its slot. Two frames turn the propeller.
const PLANE = [
  ['|\\______________', '|_[]_°_°_°_°_°__)=-'],
  ['|\\______________', '|_[]_°_°_°_°_°__)-='],
]
const DOOR = 2
const PLANE_STEP = 3
// The canopy over a character that floats down: four rows above its head.
const CANOPY = 4
// The frames of the spark that a crewmate leaves as, two ticks each.
const SPARK = [[' \\ / ', '- ✦ -', ' / \\ '], ['✦'], ['✧'], ['·']]
const SPARK_TICKS = SPARK.length * 2

// A crewmate that leaves: it is done, or it failed and stood still long enough.
const isLeaving = (mate: Crewmate) => mate.phase === 'done' || (mate.phase === 'failed' && mate.hold === 0)

// The columns one slot takes: one character and the gap after it.
export function slotWidth(character: Character): number {
  return 2 * character.sideWidth + character.centerWidth + GAP
}

// Where the characters stand: rows of slots, as many to a row as `columns`
// hold and as many rows as the room has. The main character takes the first
// slot, and the crew fills the rest in reading order. So a wide, short pane
// puts the crew beside the main character, and a narrow, tall one puts it
// below, with no other rule. `height` is the rows of one character. `top` is
// the line of the pane where the drawing of the crew starts, so a crewmate
// knows how far it falls. With `plane`, as in the docked pane, a plane brings
// each crewmate; without it, a crewmate falls in from over the top of the pane.
export type Grid = { columns: number; perRow: number; rows: number; height: number; top: number; plane: boolean }

export function gridOf(columns: number, rows: number, slot: number, height = 0, top = 0, plane = false): Grid {
  return { columns, perRow: Math.max(1, Math.floor((columns + GAP) / slot)), rows: Math.max(1, rows), height, top, plane }
}

// The line of the pane where a character in this row of slots starts.
function lineOf(row: number, grid: Grid): number {
  return grid.top + row * (grid.height + 1)
}

// The column of the middle of a character in its slot.
const middleOf = (slot: number) => Math.floor((slot - GAP) / 2)

const planeWidth = Math.max(...PLANE[0]!.map(line => cellWidth(line)))

// True when the character jumped from its plane, or came with none.
function hasJumped(drop: Drop, slot: number): boolean {
  return drop.plane === null || drop.plane + DOOR >= drop.x + middleOf(slot)
}

// True when the character is not in its slot yet: in its plane, or under its canopy.
export const isAirborne = (drop: Drop, slot: number) => drop.y > 0 || !hasJumped(drop, slot)

// Where a character bound for the slot at column `x` in this row starts. A
// plane brings it, and it jumps with its canopy just under the plane. With no
// plane, it starts just over the top of the pane.
export function dropTo(x: number, row: number, grid: Grid): Drop {
  if (!grid.plane) return { x, y: lineOf(row, grid) + grid.height, plane: null }
  return { x, y: Math.max(0, lineOf(row, grid) - PLANE[0]!.length - CANOPY), plane: -planeWidth }
}

// One tick of a drop: the plane flies on until it is past the right edge, and
// a character that jumped floats down a row.
export function stepDrop(drop: Drop, grid: Grid, slot: number): Drop {
  const plane = drop.plane === null || drop.plane + PLANE_STEP >= grid.columns ? null : drop.plane + PLANE_STEP
  return { x: drop.x, y: hasJumped(drop, slot) ? Math.max(0, drop.y - 1) : drop.y, plane }
}

// How many rows of slots `room` holds. Each row is a character and its label.
// The blank top row of the art keeps a row apart from the one above it.
export function rowsIn(room: number, height: number): number {
  return 1 + Math.max(0, Math.floor((room - height - 1) / (height + 1)))
}

// How many crewmates fit beside and below the main character.
export function slotCount(grid: Grid): number {
  return grid.perRow * grid.rows - 1
}

// The row and the column of a slot. Slot 0 is the main character's.
function placeOf(cell: number, grid: Grid, slot: number): { row: number; x: number } {
  return { row: Math.floor(cell / grid.perRow), x: (cell % grid.perRow) * slot }
}

// How many crewmates get a slot. When some do not fit, the last slot shows a
// count of the others instead.
export function visibleCount(total: number, slots: number): number {
  return total <= slots ? total : Math.max(0, slots - 1)
}

// The row and the column of a crewmate's slot. A crewmate with no slot waits
// out of sight in the first row, behind the main character.
function placeIn(index: number, total: number, grid: Grid, slot: number): { row: number; x: number } {
  if (index >= visibleCount(total, slotCount(grid))) return { row: 0, x: -slot }
  return placeOf(index + 1, grid, slot)
}

// A new crewmate starts out of sight.
export function newCrewmate(id: string, label: string, slot: number): Crewmate {
  return { id, label, look: null, toolId: null, x: -slot, y: 0, plane: null, spark: 0, phase: 'work', hold: 0 }
}

// One tick: each crewmate moves a step to its slot. A crewmate that leaves
// turns into a spark and is gone when the spark is out. A crewmate that ended
// out of sight, or still in its plane, is gone at once.
export function stepCrew(crew: readonly Crewmate[], grid: Grid, slot: number): Crewmate[] {
  const next: Crewmate[] = []
  crew.forEach((mate, index) => {
    if (mate.phase !== 'work' && (mate.x <= -slot || !hasJumped(mate, slot))) return
    const { row, x: target } = placeIn(index, crew.length, grid, slot)
    const hold = Math.max(0, mate.hold - 1)
    // Out of sight and bound for a slot: it floats down to it under a canopy.
    if (mate.x <= -slot && target >= 0) {
      next.push({ ...mate, ...dropTo(target, row, grid), hold })
      return
    }
    const { y, plane } = stepDrop(mate, grid, slot)
    if (isLeaving(mate)) {
      if (mate.spark < SPARK_TICKS) next.push({ ...mate, plane, spark: mate.spark + 1, hold })
      return
    }
    const x = mate.x < target ? Math.min(target, mate.x + STEP) : Math.max(target, mate.x - STEP)
    next.push({ ...mate, x, y, plane, hold })
  })
  return next
}

// True when no crewmate moves, waits or leaves, and no plane flies: the timer can stop.
export function isSettled(crew: readonly Crewmate[], grid: Grid, slot: number): boolean {
  return crew.every(
    (mate, index) =>
      mate.phase === 'work' && mate.y === 0 && mate.plane === null && mate.x === placeIn(index, crew.length, grid, slot).x,
  )
}

// A crewmate is happy while it floats down or moves between slots, and thinks
// while it stands with empty hands.
function moodOf(mate: Crewmate, moving: boolean): Mood {
  if (mate.phase === 'done') return 'happy'
  if (mate.phase === 'failed') return 'error'
  if (mate.look !== null) return mate.look.mood
  return moving ? 'happy' : 'thinking'
}

// ── Drawing ─────────────────────────────────────────────────────────────────

// Splits a line into terminal cells. A wide character takes two: the
// character, then an empty string. Joined emoji, flags, variation selectors
// and skin tones stay in one cell, as cellWidth counts them.
export function toCells(line: string): string[] {
  const clusters: string[] = []
  let afterJoiner = false
  let openFlag = false
  for (const ch of line) {
    const cp = ch.codePointAt(0) ?? 0
    const regional = isRegional(cp)
    const joins = isZeroWidth(cp) || isSkinTone(cp) || afterJoiner || (regional && openFlag)
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

// The art of one crewmate as it looks now.
function spriteOf(character: Character, mate: Crewmate, moving: boolean): string[] {
  const look = mate.phase === 'work' ? mate.look : null
  return drawCharacter(character, moodOf(mate, moving), mate.id, look?.prop ?? null, look?.side ?? null)
}

// Draws the frame of the spark that a crewmate leaves as, over the middle of
// the character whose art starts at `top` and `x`.
function paintSpark(canvas: Canvas, top: number, x: number, rows: readonly string[], mate: Crewmate, slot: number) {
  const frame = SPARK[Math.min(SPARK.length - 1, Math.floor((mate.spark - 1) / 2))]!
  const row = top + Math.floor(rows.length / 2) - Math.floor(frame.length / 2)
  const width = Math.max(...frame.map(line => cellWidth(line)))
  frame.forEach((line, i) => paint(canvas, row + i, x + middleOf(slot) - Math.floor(width / 2), line))
}

// The canopy over a character that floats down: a curved dome a bit wider
// than its head, and the lines down to it.
function canopyOf(character: Character): string[] {
  const inner = Math.max(4, character.centerWidth)
  return [
    ` _.-${'"'.repeat(inner - 4)}-._`,
    `.'${' '.repeat(inner)}'.`,
    `(${'_'.repeat(inner + 2)})`,
    ` \\${' '.repeat(inner)}/`,
  ]
}

// The characters below the bubble, row by row: the main character first and
// the crew in the slots after it, each crewmate with its label under its feet.
// The main character is in front, so a crewmate that slides to a free slot
// passes behind it. A crewmate that leaves is in front of the others. The blank
// top row of the art keeps each lower row apart from the row above. A character
// that is still in the air is not here, only the label of a crewmate: drawAir
// draws it. `landing` is the drop of the main character, when the pane just opened.
export function drawCrew(
  character: Character,
  main: readonly string[],
  crew: readonly Crewmate[],
  grid: Grid,
  slot: number,
  landing: Drop | null = null,
): string[] {
  const mainShows = landing === null || !isAirborne(landing, slot)
  if (crew.length === 0) return mainShows ? [...main] : main.map(() => '')
  const { columns } = grid
  const slots = slotCount(grid)
  const shown = visibleCount(crew.length, slots)
  const sprites = crew.map((mate, index) => {
    const place = placeIn(index, crew.length, grid, slot)
    const moving = mate.x !== place.x || mate.y > 0
    return { mate, row: place.row, rows: spriteOf(character, mate, moving) }
  })
  const hidden = crew.length - shown
  // The count of the crew with no slot stands in the last slot.
  const count = hidden > 0 && slots > 0 ? placeOf(slots, grid, slot) : null

  const lines: string[] = []
  for (let r = 0; r < grid.rows; r++) {
    const inRow = sprites.filter(sprite => sprite.row === r)
    if (r > 0 && inRow.length === 0) {
      // A row with only the count in it is one line.
      if (count?.row === r) lines.push(`${' '.repeat(count.x + 2)}+${hidden} more`)
      continue
    }
    const height = Math.max(main.length, ...inRow.map(sprite => sprite.rows.length))
    const canvas: Canvas = Array.from({ length: height + 1 }, () => Array<string>(columns).fill(' '))
    const ordered = [...inRow.filter(s => !isLeaving(s.mate)), ...inRow.filter(s => isLeaving(s.mate))]
    for (const { mate, rows } of ordered) {
      const top = height - rows.length
      if (!isAirborne(mate, slot)) {
        if (mate.spark > 0) paintSpark(canvas, top, mate.x, rows, mate, slot)
        else rows.forEach((line, i) => paint(canvas, top + i, mate.x, line))
      }
      // The label marks the slot of a crewmate in the air, where it lands.
      paint(canvas, height, mate.x + character.sideWidth - 2, fit(mate.label, slot - character.sideWidth))
    }
    if (r === 0 && mainShows) {
      main.forEach((line, i) => paint(canvas, height - main.length + i, 0, line))
      paint(canvas, height, character.sideWidth - 2, fit(CAPTAIN, slot - character.sideWidth))
    }
    const middle = height - character.cellHeight * 2 + Math.floor(character.cellHeight / 2)
    // No slot at all: a short count beside the main character.
    if (r === 0 && hidden > 0 && slots === 0) paint(canvas, middle, slot - 1, `🤖×${hidden}`)
    if (count?.row === r) paint(canvas, middle, count.x + 2, `+${hidden} more`)
    lines.push(...canvas.map(row => row.join('').trimEnd()))
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

// The air over the whole pane, on top of `lines`: each plane that flies in
// along the top, and each character that floats down under its canopy to its
// slot, the main one too while it is `landing`. A crewmate that leaves in the
// air turns into a spark there.
export function drawAir(
  character: Character,
  lines: readonly string[],
  crew: readonly Crewmate[],
  grid: Grid,
  slot: number,
  main: { rows: readonly string[]; landing: Drop | null } = { rows: [], landing: null },
): string[] {
  const fliers = crew.map((mate, index) => ({
    drop: mate as Drop,
    row: placeIn(index, crew.length, grid, slot).row,
    rows: () => spriteOf(character, mate, true),
    mate: mate as Crewmate | null,
  }))
  if (main.landing !== null) fliers.unshift({ drop: main.landing, row: 0, rows: () => [...main.rows], mate: null })
  if (!fliers.some(({ drop }) => drop.plane !== null || drop.y > 0)) return [...lines]
  const canvas: Canvas = lines.map(line => {
    const all = toCells(line)
    const cells = all.slice(0, grid.columns)
    // Never leave half of a wide character at the right edge.
    if (all[cells.length] === '') cells[cells.length - 1] = ' '
    while (cells.length < grid.columns) cells.push(' ')
    return cells
  })
  for (const { drop } of fliers) {
    if (drop.plane === null) continue
    const frame = PLANE[Math.floor(drop.plane / PLANE_STEP) & 1]!
    frame.forEach((line, i) => paint(canvas, i, drop.plane!, line))
  }
  const canopy = canopyOf(character)
  for (const flier of fliers) {
    const { drop, mate } = flier
    if (drop.y === 0 || !hasJumped(drop, slot)) continue
    const rows = flier.rows()
    const top = lineOf(flier.row, grid) + grid.height - rows.length - drop.y
    if (mate !== null && mate.spark > 0) {
      paintSpark(canvas, top, drop.x, rows, mate, slot)
      continue
    }
    // The canopy sits right over the first row of art.
    const head = top + Math.max(0, rows.findIndex(line => line.trim() !== ''))
    const left = drop.x + middleOf(slot) - Math.floor(cellWidth(canopy[0]!) / 2)
    canopy.forEach((line, i) => paint(canvas, head - CANOPY + i, left, line))
    rows.forEach((line, i) => paint(canvas, top + i, drop.x, line))
  }
  return canvas.map(row => row.join('').trimEnd() || ' ')
}
