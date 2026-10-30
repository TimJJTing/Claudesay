// The sky: a bird that now and then flies across the docked pane. Pure code,
// like crew.ts: no `$`, no state.
// The hooks module keeps the bird in an atom and moves it on the crew's timer.
import type { Bird } from '../types'
import { toCells } from './crew.ts'

// The two frames of the bird: wings up, then wings level. Each shows for
// FLAP steps. ASCII only, so a frame takes as many cells as characters.
const FRAMES = ['\\v/', '-v-'] as const
const FLAP = 3
const WIDTH = FRAMES[0].length

// A bird that starts just out of sight at the left or the right edge.
export function newBird(columns: number, dir: 1 | -1, height: number): Bird {
  return { x: dir === 1 ? -WIDTH : columns, dir, height: Math.min(Math.max(height, 0), 0.999), row: null, tick: 0 }
}

// One step of a bird: a column on. Null once it flew out of sight.
export function stepBird(bird: Bird, columns: number): Bird | null {
  const x = bird.x + bird.dir
  if (x < -WIDTH || x > columns) return null
  return { ...bird, x, tick: bird.tick + 1 }
}

// The rows of the pane that hold nothing: a bird sets off only in one of them,
// so it starts in clear sky.
export function freeRows(lines: readonly string[]): number[] {
  const rows: number[] = []
  lines.forEach((line, i) => {
    if (line.trim() === '') rows.push(i)
  })
  return rows
}

// The bird with the row it takes at its first draw, picked by its height among
// the free rows. A bird that has a row keeps it, so a bubble that comes and
// goes does not make it jump. With no free row, it waits for one.
export function placeBird(bird: Bird, lines: readonly string[]): Bird {
  if (bird.row !== null) return bird
  const rows = freeRows(lines)
  if (rows.length === 0) return bird
  return { ...bird, row: rows[Math.floor(bird.height * rows.length)]! }
}

// The bubble in the pane: its lines, and the row of the pane its first line
// takes. A bubble covers its blank cells too, from its frame on the left to
// its frame on the right.
export type Cover = { top: number; lines: readonly string[] }

// Draws the bird on its row, cut at the edges of the pane. The bird flies
// behind everything: it takes only blank cells, and none inside the bubble, so
// a character, a plane or a bubble that comes into its row covers it, in whole
// or in part.
export function drawBird(lines: readonly string[], bird: Bird | null, columns: number, bubble?: Cover): string[] {
  if (bird === null || bird.row === null || lines[bird.row] === undefined) return [...lines]
  const frame = FRAMES[Math.floor(bird.tick / FLAP) % FRAMES.length]!
  const cells = toCells(lines[bird.row]!)
  const inside = toCells(bubble?.lines[bird.row - bubble.top] ?? '')
  const left = inside.findIndex(cell => cell !== ' ')
  const right = inside.findLastIndex(cell => cell !== ' ')
  let drawn = false
  for (let i = 0; i < WIDTH; i++) {
    const col = bird.x + i
    if (col < 0 || col >= columns) continue
    while (cells.length <= col) cells.push(' ')
    // The right half of a wide character is '', and it is not blank either.
    if (cells[col] !== ' ' || (col >= left && col <= right)) continue
    cells[col] = frame[i]!
    drawn = true
  }
  if (!drawn) return [...lines]
  const out = [...lines]
  out[bird.row] = cells.join('')
  return out
}
