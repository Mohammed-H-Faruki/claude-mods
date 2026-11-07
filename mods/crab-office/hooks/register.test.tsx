import { expect, test } from 'claude-code/testing'

import { clockDelays, placeOf, route, seat } from './office'
import { addAct, tree } from './work'

const BAND = {
  plugin: 'crab-office',
  component: 'AbovePrompt',
  requestId: 'band',
  surface: 'desktop',
  props: { hasSurvey: false },
} as const

test('main works, a helper walks in, visits the library, finishes into history', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.check', () => ({ decision: 'ask' }))
  on('tool.call', () => ({ result: {} }))
  on('agent.spawn', () => ({ model: 'x', agentId: 'sub1' }))
  on('turn.complete', () => ({ text: '' }))
  on('classic.SubagentStop', () => ({}))
  on('ui.render', () => ({}))
  on('ui.toast', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true } as any)
  let ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /Idle\. Send a message/ })).toBeTruthy()
  await ui.unmount()

  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.tool.check({ tool: 'Bash', input: {} })
  await $.agent.spawn({ tool_use_id: 'u1', prompt: 'p', description: 'Find auth code', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' } } as any)
  await $.tool.call({ tool: 'WebSearch', query: 'auth', agentId: 'sub1' } as any)

  ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /1 action needed/ })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: /Actions 🔔1/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /Find auth code/ })).toBeTruthy()
  const svg = JSON.stringify(await ui.find({ type: 'Svg' }))
  // The helper's walk is a keyframe animation ending at the library spot (x 14).
  expect(svg).toContain('translate(14px,27px)')
  await ui.unmount()

  await ($ as any).classic.SubagentStop({ hook_event_name: 'SubagentStop', agent_id: 'sub1', session_id: 's', transcript_path: '', cwd: '/', stop_hook_active: false, agent_transcript_path: '', agent_type: 'Explore' })
  ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Button', text: /History 1/ })).toBeTruthy()
  await ui.unmount()
})

test('tools map to stations', () => {
  expect(placeOf('WebFetch')).toBe('library')
  expect(placeOf('mcp__Claude_Browser__navigate')).toBe('library')
  expect(placeOf('Skill')).toBe('skills')
  expect(placeOf('mcp__plugin_21st_21st__search')).toBe('skills')
  expect(placeOf('mcp__github__create_issue')).toBe('tools')
  expect(placeOf('Edit')).toBe('desk')
  expect(placeOf('Grep')).toBe('library')
  expect(placeOf('Bash')).toBe('tools')
})

test('routes leave the desk by the aisle and the clock lands on real time', () => {
  const s = seat(0)
  const r = route(s, { x: 14, y: 27 }, 0)
  expect(r[1]).toEqual({ x: s.gx, y: s.y })
  expect(r[r.length - 1]).toEqual({ x: 14, y: 27 })
  const d = clockDelays(new Date(2026, 0, 1, 3, 15, 30).getTime())
  expect(Math.round(d.s)).toBe(30)
  expect(Math.round(d.m)).toBe(15 * 60 + 30)
  expect(Math.round(d.h)).toBe(3 * 3600 + 15 * 60 + 30)
})

test('tree groups files under folders and counts repeats', () => {
  let acts = addAct([], { kind: 'read', target: 'C:\\repo\\src\\a.ts', n: 1 })
  acts = addAct(acts, { kind: 'edit', target: '/repo/src/b.ts', n: 1 })
  acts = addAct(acts, { kind: 'edit', target: '/repo/src/b.ts', n: 1 })
  acts = addAct(acts, { kind: 'run', target: 'npm test', n: 1 })
  const rows = tree(acts)
  expect(rows[0]).toBe('▾ 📁 repo/src/')
  expect(rows).toContain('  └─ ✎ b.ts  ×2')
  expect(rows[rows.length - 1]).toContain('npm test  ◀ now')
})
