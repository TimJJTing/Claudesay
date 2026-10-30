import { describe, expect, test } from 'claude-code/testing'

import type { Crewmate } from '../types'
import { DEFAULT_CHARACTER, cellWidth, drawCharacter } from '../hooks/art.ts'
import { FAIL_HOLD, drawAir, drawCrew, dropTo, isAirborne, stepDrop, gridOf, isSettled, newCrewmate, rowsIn, slotCount, slotWidth, stepCrew, visibleCount } from '../hooks/crew.ts'

const SLOT = slotWidth(DEFAULT_CHARACTER)
const MAIN = drawCharacter(DEFAULT_CHARACTER, 'thinking', 'main')
// A narrow, tall pane: one slot to a row, three rows.
const TALL = gridOf(30, 3, SLOT, MAIN.length)
// One row of slots, `columns` wide.
const row = (columns: number) => gridOf(columns, 1, SLOT)
const at = (x: number, extra: Partial<Crewmate> = {}): Crewmate => ({ ...newCrewmate('a', 'Explore repo', SLOT), x, ...extra })

// Steps the crew until it settles, or `max` times.
function run(crew: Crewmate[], columns: number, max = 500, grid = row(columns)): Crewmate[] {
  let list = crew
  for (let i = 0; i < max && !isSettled(list, grid, SLOT); i++) list = stepCrew(list, grid, SLOT)
  return list
}

describe('crew layout', () => {
  test('a slot is one character and a gap', async () => {
    expect(SLOT).toBe(20)
  })

  test('80 columns hold 3 crewmates, 100 hold 4, 37 hold none', async () => {
    expect(slotCount(row(80))).toBe(3)
    expect(slotCount(row(100))).toBe(4)
    expect(slotCount(row(37))).toBe(0)
  })

  test('more rows hold more crewmates: a narrow, tall pane holds one to a row', async () => {
    expect(gridOf(30, 4, SLOT)).toEqual({ columns: 30, perRow: 1, rows: 4, height: 0, top: 0, plane: false })
    expect(slotCount(gridOf(30, 4, SLOT))).toBe(3)
    expect(slotCount(gridOf(80, 2, SLOT))).toBe(7)
  })

  test('each row of slots is a character and its label', async () => {
    const one = MAIN.length + 1
    expect(rowsIn(one, MAIN.length)).toBe(1)
    expect(rowsIn(2 * one - 1, MAIN.length)).toBe(1)
    expect(rowsIn(2 * one, MAIN.length)).toBe(2)
    expect(rowsIn(0, MAIN.length)).toBe(1)
  })

  test('when the crew does not fit, the last slot is for the count', async () => {
    expect(visibleCount(3, 3)).toBe(3)
    expect(visibleCount(5, 3)).toBe(2)
    expect(visibleCount(2, 0)).toBe(0)
  })
})

describe('crew steps', () => {
  test('a new crewmate takes slot 1', async () => {
    const start = newCrewmate('a', 'Explore repo', SLOT)
    expect(start.x).toBe(-SLOT)
    expect(isSettled([start], row(80), SLOT)).toBe(false)
    const first = stepCrew([start], row(80), SLOT)
    expect(first[0]).toMatchObject({ x: SLOT, y: 0, plane: null })
    expect(run([start], 80)[0]).toMatchObject({ x: SLOT, y: 0 })
  })

  test('with no plane, the fall starts with the crewmate just over the top of the pane', async () => {
    const grid = gridOf(30, 3, SLOT, MAIN.length, 4)
    const list = stepCrew([newCrewmate('a', 'a', SLOT)], grid, SLOT)
    expect(list[0]).toMatchObject({ x: 0, y: 4 + MAIN.length + 1 + MAIN.length, plane: null })
  })

  test('docked, a plane brings the crewmate, and it jumps when the door is over its slot', async () => {
    const dock = gridOf(50, 1, SLOT, MAIN.length, 20, true)
    let list = stepCrew([newCrewmate('a', 'a', SLOT)], dock, SLOT)
    expect(list[0]!.x).toBe(SLOT)
    expect(list[0]!.plane).toBeLessThan(0)
    const height = list[0]!.y
    expect(height).toBe(20 - 2 - 4)
    // In the plane, it does not fall.
    list = stepCrew(list, dock, SLOT)
    expect(list[0]!.y).toBe(height)
    list = run(list, 50, 500, dock)
    expect(list[0]).toMatchObject({ x: SLOT, y: 0, plane: null })
  })

  test('a crewmate that is done turns into a spark and is gone', async () => {
    let list = stepCrew([at(SLOT, { phase: 'done' })], row(80), SLOT)
    expect(list[0]).toMatchObject({ x: SLOT, spark: 1 })
    expect(run(list, 80)).toEqual([])
  })

  test('a crewmate that failed stands still first, then turns into a spark', async () => {
    let list = [at(SLOT, { phase: 'failed', hold: FAIL_HOLD })]
    for (let i = 0; i < FAIL_HOLD; i++) list = stepCrew(list, row(80), SLOT)
    expect(list[0]).toMatchObject({ x: SLOT, spark: 0 })
    list = stepCrew(list, row(80), SLOT)
    expect(list[0]).toMatchObject({ x: SLOT, spark: 1 })
    expect(run(list, 80)).toEqual([])
  })

  test('the next crewmate slides into the slot that is free', async () => {
    const list = run([at(SLOT, { id: 'a', phase: 'done' }), at(2 * SLOT, { id: 'b' })], 80)
    expect(list.map(mate => [mate.id, mate.x])).toEqual([['b', SLOT]])
  })

  test('a crewmate with no slot waits out of sight, and comes in when one is free', async () => {
    const crew = ['a', 'b', 'c', 'd'].map(id => newCrewmate(id, id, SLOT))
    let list = run(crew, 80)
    expect(list.map(mate => mate.x)).toEqual([SLOT, 2 * SLOT, -SLOT, -SLOT])
    list = run(list.map(mate => (mate.id === 'a' ? { ...mate, phase: 'done' as const } : mate)), 80)
    expect(list.map(mate => [mate.id, mate.x])).toEqual([['b', SLOT], ['c', 2 * SLOT], ['d', 3 * SLOT]])
  })

  test('a crewmate that ends out of sight, or still in its plane, is gone at once', async () => {
    expect(stepCrew([newCrewmate('a', 'a', SLOT)].map(mate => ({ ...mate, phase: 'done' as const })), row(80), SLOT)).toEqual([])
    expect(stepCrew([at(SLOT, { plane: -18, y: 9, phase: 'done' })], row(80), SLOT)).toEqual([])
  })
})

describe('crew drawing', () => {
  test('no crew gives the main character unchanged', async () => {
    expect(drawCrew(DEFAULT_CHARACTER, MAIN, [], row(80), SLOT)).toEqual(MAIN)
  })

  test('a crewmate stands in its slot with its prop and its label under its feet', async () => {
    const look = { prop: '🔍', mood: 'focused' as const, side: 'left' as const }
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, [at(SLOT, { look })], row(80), SLOT)
    expect(rows.length).toBe(MAIN.length + 1)
    expect(rows.some(row => row.includes('🔍○═'))).toBe(true)
    expect(rows.at(-1)).toBe(`   Captain${' '.repeat(SLOT - 7)}Explore repo`)
    expect(rows.every(row => cellWidth(row) <= 80)).toBe(true)
  })

  test('a crewmate that slides to a free slot passes behind the main character', async () => {
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, [at(3)], row(80), SLOT)
    const face = MAIN.findIndex(row => row.includes('._.'))
    expect(rows[face]?.startsWith(MAIN[face]!)).toBe(true)
    // The crewmate shows past the right edge of the main character.
    expect(rows[face]!.length).toBeGreaterThan(MAIN[face]!.length)
  })

  test('a long label is cut to the slot', async () => {
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, [at(SLOT, { label: 'x'.repeat(50) })], row(80), SLOT)
    expect(rows.at(-1)?.slice(SLOT).trim()).toBe('x'.repeat(SLOT - 5))
  })

  test('in a single row, the crew that does not fit shows as a count at the end of the row', async () => {
    const crew = ['a', 'b', 'c', 'd', 'e'].map((id, i) => at(i < 2 ? SLOT * (i + 1) : -SLOT, { id }))
    expect(drawCrew(DEFAULT_CHARACTER, MAIN, crew, row(80), SLOT).some(row => row.endsWith('+3 more'))).toBe(true)
  })

  test('a narrow screen shows the crew as a count beside the main character', async () => {
    const crew = ['a', 'b'].map(id => at(-SLOT, { id }))
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, crew, row(30), SLOT)
    expect(rows.some(row => row.includes('🤖×2'))).toBe(true)
    expect(rows.every(row => cellWidth(row) <= 30)).toBe(true)
  })

  test('a wide prop that the edge cuts in half draws as spaces', async () => {
    const look = { prop: '🔍', mood: 'focused' as const, side: 'left' as const }
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, [at(-2, { look })], row(40), SLOT)
    expect(rows.some(row => row.includes('🔍'))).toBe(false)
    expect(rows.every(row => cellWidth(row) <= 40)).toBe(true)
  })

  test('a narrow, tall pane stacks the crew below the main character', async () => {
    const crew = [at(0, { id: 'a', label: 'Explore repo' }), at(0, { id: 'b', label: 'Run tests' })]
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, crew, gridOf(30, 3, SLOT), SLOT)
    const faces = rows.filter(line => line.includes('/\\__/\\'))
    expect(faces.length).toBe(3)
    expect(rows.findIndex(line => line.includes('Explore repo'))).toBeLessThan(rows.findIndex(line => line.includes('Run tests')))
    expect(rows.every(line => cellWidth(line) <= 30)).toBe(true)
  })

  test('the same crew stands in one row when the pane is wide', async () => {
    const crew = [at(SLOT, { id: 'a', label: 'Explore repo' }), at(2 * SLOT, { id: 'b', label: 'Run tests' })]
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, crew, gridOf(80, 3, SLOT), SLOT)
    expect(rows.length).toBe(MAIN.length + 1)
    expect(rows.at(-1)).toContain('Explore repo')
    expect(rows.at(-1)).toContain('Run tests')
  })

  test('the blank top row of the art keeps each lower row apart from the row above', async () => {
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, [at(0, { label: 'Explore repo' })], TALL, SLOT)
    expect(rows.length).toBe(2 * (MAIN.length + 1))
    expect(rows[MAIN.length]?.trim()).toBe('Captain')
    expect(rows[MAIN.length + 1]).toBe('')
    expect(rows[MAIN.length + 2]).toContain('/\\__/\\')
  })

  test('a crewmate in the air leaves only its label in its slot, and drawAir draws it under its canopy', async () => {
    const mate = at(0, { y: 3 })
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, [mate], TALL, SLOT)
    const below = rows.slice(MAIN.length + 1)
    expect(below.filter(line => line.includes('/\\__/\\')).length).toBe(0)
    expect(below.at(-1)).toContain('Explore repo')
    const air = drawAir(DEFAULT_CHARACTER, rows, [mate], TALL, SLOT)
    const head = air.findIndex((line, i) => i > 1 && line.includes('/\\__/\\'))
    // Its slot starts under the Captain row, and its ears are one row down.
    expect(head).toBe(MAIN.length + 1 + 1 - 3)
    expect(air[head - 2]).toContain('(__________)')
    expect(air.length).toBe(rows.length)
  })

  test('drawAir draws the plane along the top, cut at the right edge', async () => {
    const lines = Array<string>(6).fill(' ')
    const air = drawAir(DEFAULT_CHARACTER, lines, [at(SLOT, { plane: 20, y: 5 })], gridOf(30, 1, SLOT, MAIN.length, 0, true), SLOT)
    expect(air[1]).toBe(`${' '.repeat(20)}|_[]_°_°_°`)
    expect(air.every(line => cellWidth(line) <= 30)).toBe(true)
  })

  test('the main character in the air leaves its place empty, and lands with stepDrop', async () => {
    const dock = gridOf(30, 1, SLOT, MAIN.length, 20, true)
    let drop = dropTo(0, 0, dock)
    expect(drop).toEqual({ x: 0, y: 14, plane: expect.any(Number) })
    expect(drawCrew(DEFAULT_CHARACTER, MAIN, [], dock, SLOT, drop).every(line => line === '')).toBe(true)
    for (let i = 0; i < 100 && (isAirborne(drop, SLOT) || drop.plane !== null); i++) drop = stepDrop(drop, dock, SLOT)
    expect(drop).toEqual({ x: 0, y: 0, plane: null })
    expect(drawCrew(DEFAULT_CHARACTER, MAIN, [], dock, SLOT, drop)).toEqual(MAIN)
  })

  test('a crewmate that leaves shows a spark in its slot', async () => {
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, [at(SLOT, { phase: 'done', spark: 3 })], row(80), SLOT)
    expect(rows.some(line => line.includes('✦'))).toBe(true)
    expect(rows.some(line => line.slice(SLOT).includes('/\\__/\\'))).toBe(false)
  })

  test('in a tall pane, the crew that does not fit the rows shows as a count in the last slot', async () => {
    const crew = ['a', 'b', 'c', 'd'].map((id, i) => at(i < 1 ? 0 : -SLOT, { id }))
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, crew, gridOf(30, 3, SLOT), SLOT)
    expect(rows.some(line => line.includes('+3 more'))).toBe(true)
  })
})
