import { describe, expect, test } from 'claude-code/testing'

import type { Bird } from '../types'
import { drawBird, freeRows, newBird, placeBird, stepBird } from '../hooks/sky.ts'

// A docked pane: blank sky over a bubble and a character.
const PANE = [' ', '', ' ', ' ╭────╮', ' │ hi │', ' ╰─┬──╯', '   │', '  /\\__/\\', ' ( ^ᵕ^  )']

describe('birds', () => {
  test('a bird starts just out of sight at the edge it comes from', async () => {
    expect(newBird(40, 1, 0.5).x).toBe(-3)
    expect(newBird(40, -1, 0.5).x).toBe(40)
  })

  test('a bird flies a column a step, and is gone once out of sight', async () => {
    let bird: Bird | null = newBird(10, 1, 0)
    let steps = 0
    while (bird !== null) {
      const next = stepBird(bird, 10)
      if (next !== null) expect(next.x).toBe(bird.x + 1)
      bird = next
      steps++
    }
    expect(steps).toBe(14)
    expect(stepBird(newBird(10, -1, 0), 10)?.x).toBe(9)
  })

  test('only rows that hold nothing are free', async () => {
    expect(freeRows(PANE)).toEqual([0, 1, 2])
  })

  test('a bird takes a free row by its height at its first draw, keeps it, and waits while no row is free', async () => {
    expect(placeBird(newBird(20, 1, 0), PANE).row).toBe(0)
    expect(placeBird(newBird(20, 1, 0.99), PANE).row).toBe(2)
    const placed = placeBird(newBird(20, 1, 0.5), PANE)
    expect(placed.row).toBe(1)
    expect(placeBird(placed, ['x', 'x', ' ']).row).toBe(1)
    expect(placeBird(newBird(20, 1, 0.5), ['x']).row).toBeNull()
  })

  test('a bird draws on its row, flaps, and is cut at the edges', async () => {
    const bird = { ...placeBird(newBird(20, 1, 0), PANE), x: 4 }
    expect(drawBird(PANE, bird, 20)[0]).toBe('    \\v/')
    expect(drawBird(PANE, { ...bird, tick: 3 }, 20)[0]).toBe('    -v-')
    expect(drawBird(PANE, { ...bird, x: -1 }, 20)[0]).toBe('v/')
    expect(drawBird(PANE, { ...bird, x: 18 }, 20)[0]).toBe(`${' '.repeat(18)}\\v`)
    expect(drawBird(PANE, bird, 20).slice(1)).toEqual(PANE.slice(1))
  })

  test('a bird flies behind whatever is on its row, and never shows inside the bubble', async () => {
    const bubble = { top: 3, lines: PANE.slice(3, 7) }
    const bird = { ...newBird(20, 1, 0), x: 2, row: 4 }
    // ' │ hi │': the bubble covers the bird, its blank cells too.
    expect(drawBird(PANE, bird, 20, bubble)[4]).toBe(' │ hi │')
    expect(drawBird(PANE, { ...bird, x: 6 }, 20, bubble)[4]).toBe(' │ hi │v/')
    // The face covers the bird, the blank cells in it show it.
    expect(drawBird(PANE, { ...bird, x: 5, row: 8 }, 20, bubble)[8]).toBe(' ( ^ᵕ^v/)')
    // The top of the bubble covers it whole.
    expect(drawBird(PANE, { ...bird, row: 3 }, 20, bubble)).toEqual(PANE)
    expect(drawBird(PANE, null, 20, bubble)).toEqual(PANE)
  })

  test('a bird does not split a wide character', async () => {
    const bird = { ...newBird(20, 1, 0), x: 0, row: 0 }
    expect(drawBird(['🐦  '], bird, 20)[0]).toBe('🐦/ ')
  })
})

