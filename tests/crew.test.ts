import { describe, expect, test } from 'claude-code/testing'

import type { Crewmate } from '../types'
import { DEFAULT_CHARACTER, cellWidth, drawCharacter } from '../hooks/art.ts'
import { FAIL_HOLD, drawCrew, isSettled, newCrewmate, slotCount, slotWidth, stepCrew, visibleCount } from '../hooks/crew.ts'

const SLOT = slotWidth(DEFAULT_CHARACTER)
const MAIN = drawCharacter(DEFAULT_CHARACTER, 'thinking', 'main')
const at = (x: number, extra: Partial<Crewmate> = {}): Crewmate => ({ ...newCrewmate('a', 'Explore repo', SLOT), x, ...extra })

// Steps the crew until it settles, or `max` times.
function run(crew: Crewmate[], columns: number, max = 500): Crewmate[] {
  let list = crew
  for (let i = 0; i < max && !isSettled(list, columns, SLOT); i++) list = stepCrew(list, columns, SLOT)
  return list
}

describe('crew layout', () => {
  test('a slot is one character and a gap', async () => {
    expect(SLOT).toBe(20)
  })

  test('80 columns hold 3 crewmates, 100 hold 4, 37 hold none', async () => {
    expect(slotCount(80, SLOT)).toBe(3)
    expect(slotCount(100, SLOT)).toBe(4)
    expect(slotCount(37, SLOT)).toBe(0)
  })

  test('when the crew does not fit, the last slot is for the count', async () => {
    expect(visibleCount(3, 3)).toBe(3)
    expect(visibleCount(5, 3)).toBe(2)
    expect(visibleCount(2, 0)).toBe(0)
  })
})

describe('crew steps', () => {
  test('a new crewmate walks in from behind the main character to slot 1', async () => {
    const start = newCrewmate('a', 'Explore repo', SLOT)
    expect(start.x).toBe(-SLOT)
    expect(isSettled([start], 80, SLOT)).toBe(false)
    expect(run([start], 80)[0]?.x).toBe(SLOT)
  })

  test('a crewmate that is done walks off to the right and is gone', async () => {
    expect(run([at(SLOT, { phase: 'done' })], 80)).toEqual([])
  })

  test('a crewmate that failed stands still first, then walks off', async () => {
    let list = [at(SLOT, { phase: 'failed', hold: FAIL_HOLD })]
    for (let i = 0; i < FAIL_HOLD; i++) list = stepCrew(list, 80, SLOT)
    expect(list[0]?.x).toBe(SLOT)
    list = stepCrew(list, 80, SLOT)
    expect(list[0]!.x).toBeGreaterThan(SLOT)
    expect(run(list, 80)).toEqual([])
  })

  test('the next crewmate slides into the slot that is free', async () => {
    const list = run([at(SLOT, { id: 'a', phase: 'done' }), at(2 * SLOT, { id: 'b' })], 80)
    expect(list.map(mate => [mate.id, mate.x])).toEqual([['b', SLOT]])
  })

  test('a crewmate with no slot waits out of sight, and walks in when one is free', async () => {
    const crew = ['a', 'b', 'c', 'd'].map(id => newCrewmate(id, id, SLOT))
    let list = run(crew, 80)
    expect(list.map(mate => mate.x)).toEqual([SLOT, 2 * SLOT, -SLOT, -SLOT])
    list = run(list.map(mate => (mate.id === 'a' ? { ...mate, phase: 'done' as const } : mate)), 80)
    expect(list.map(mate => [mate.id, mate.x])).toEqual([['b', SLOT], ['c', 2 * SLOT], ['d', 3 * SLOT]])
  })

  test('a crewmate that ends out of sight is gone at once', async () => {
    expect(stepCrew([newCrewmate('a', 'a', SLOT)].map(mate => ({ ...mate, phase: 'done' as const })), 80, SLOT)).toEqual([])
  })
})

describe('crew drawing', () => {
  test('no crew gives the main character unchanged', async () => {
    expect(drawCrew(DEFAULT_CHARACTER, MAIN, [], 80, SLOT)).toEqual(MAIN)
  })

  test('a crewmate stands in its slot with its prop and its label under its feet', async () => {
    const look = { prop: '🔍', mood: 'focused' as const, side: 'left' as const }
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, [at(SLOT, { look })], 80, SLOT)
    expect(rows.length).toBe(MAIN.length + 1)
    expect(rows.some(row => row.includes('🔍○═'))).toBe(true)
    expect(rows.at(-1)).toBe(`${' '.repeat(SLOT + 3)}Explore repo`)
    expect(rows.every(row => cellWidth(row) <= 80)).toBe(true)
  })

  test('a crewmate that walks in is behind the main character', async () => {
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, [at(3)], 80, SLOT)
    const face = MAIN.findIndex(row => row.includes('._.'))
    expect(rows[face]?.startsWith(MAIN[face]!)).toBe(true)
  })

  test('a long label is cut to the slot', async () => {
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, [at(SLOT, { label: 'x'.repeat(50) })], 80, SLOT)
    expect(rows.at(-1)?.trim()).toBe('x'.repeat(SLOT - 5))
  })

  test('the crew that does not fit shows as a count', async () => {
    const crew = ['a', 'b', 'c', 'd', 'e'].map((id, i) => at(i < 2 ? SLOT * (i + 1) : -SLOT, { id }))
    expect(drawCrew(DEFAULT_CHARACTER, MAIN, crew, 80, SLOT).some(row => row.endsWith('+3 more'))).toBe(true)
  })

  test('a narrow screen shows the crew as a count beside the main character', async () => {
    const crew = ['a', 'b'].map(id => at(-SLOT, { id }))
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, crew, 30, SLOT)
    expect(rows.some(row => row.includes('🤖×2'))).toBe(true)
    expect(rows.every(row => cellWidth(row) <= 30)).toBe(true)
  })

  test('a wide prop that the edge cuts in half draws as spaces', async () => {
    const look = { prop: '🔍', mood: 'focused' as const, side: 'left' as const }
    const rows = drawCrew(DEFAULT_CHARACTER, MAIN, [at(-2, { look })], 40, SLOT)
    expect(rows.every(row => cellWidth(row) <= 40)).toBe(true)
  })
})
