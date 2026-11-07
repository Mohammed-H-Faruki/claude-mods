import { expect, test } from 'claude-code/testing'

import { addAct, tree } from './work'

const BAND = {
  plugin: 'crab-office',
  component: 'AbovePrompt',
  requestId: 'band',
  surface: 'desktop',
  props: { hasSurvey: false },
} as const

test('question shows as text; a subagent gets a crab, tokens and a file tree', async ($, on) => {
  on('clock.now', () => ({ value: 1000 }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.check', () => ({ decision: 'ask' }))
  on('tool.call', () => ({ result: {} }))
  on('agent.spawn', () => ({ model: 'x', agentId: 'sub1' }))
  on('ui.render', () => ({}))
  on('turn.complete', () => ({ text: '' }))

  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.tool.check({ tool: 'Bash', input: {} })
  await $.agent.spawn({ tool_use_id: 'u1', prompt: 'p', description: 'Find auth code', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' } } as any)
  await $.tool.call({ tool: 'Read', file_path: '/repo/src/auth.ts', agentId: 'sub1' } as any)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /May I use Bash\?/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /Main · .* · 0 tool calls/ })).toBeTruthy()
  expect(JSON.stringify(await ui.find({ type: 'Svg' }))).toContain('FIND AUTH CODE')
  expect(await ui.find({ type: 'Button', label: /Find auth code/ })).toBeTruthy()
  await ui.unmount()

  // A finished subagent goes to History but stays seated a while first.
  await $.turn.complete({ turnId: 's1', agentId: 'sub1', reason: 'answer', answer: '' } as any)
  const ui2 = await $.ui.mount(BAND)
  expect(await ui2.find({ type: 'Button', label: /History \(1\)/ })).toBeTruthy()
  expect(JSON.stringify(await ui2.find({ type: 'Svg' }))).toMatch(/animation:wsub1 [0-9.]+s linear [1-9][0-9.]*s both.{0,20}sit/)
  await ui2.unmount()
})

test('tree groups files under folders and counts repeats', () => {
  let acts = addAct([], { kind: 'read', target: 'C:\\repo\\src\\a.ts', n: 1 })
  acts = addAct(acts, { kind: 'edit', target: '/repo/src/b.ts', n: 1 })
  acts = addAct(acts, { kind: 'edit', target: '/repo/src/b.ts', n: 1 })
  acts = addAct(acts, { kind: 'run', target: 'npm test', n: 1 })
  const rows = tree(acts)
  expect(rows[0]).toBe('▾ 📁 repo/src/')
  expect(rows).toContain('  ├─ 👁 a.ts')
  expect(rows).toContain('  └─ ✎ b.ts  ×2')
  expect(rows[rows.length - 1]).toContain('npm test  ◀ now')
})
