import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Agent, Job, Office } from '../types'
import { MIN_SEAT, jobOfType, scene, walkMs } from './office'
import { ICON, actOf, addAct, bar, elapsed, fmtTok, nowAct, tree } from './work'

const office = atom({ plugin: 'crab-office', key: 'office' } as const, { agents: [], past: [], showPast: false, selected: null } as Office, { shape: 'office-3' })
const compact = atom({ plugin: 'crab-office', key: 'compact' } as const, false, { shape: 'compact-1' })

// No timers: walks are CSS keyframes placed by elapsed time at each draw, so a
// redraw resumes a walk mid-way and nothing ticks while the office is quiet.

function prune(o: Office, now: number): Office {
  return { ...o, agents: o.agents.filter(a => !(a.out && now - a.since > walkMs(a.desk) + 500)) }
}

async function change($: any, fn: (o: Office, now: number) => Office) {
  const now = await $.clock.now()
  return update($, office, (o: Office) => fn(prune(o, now), now))
}

function enter(o: Office, now: number, id: string, label: string, job: Job): Office {
  if (o.agents.some(a => a.id === id && !a.out)) return o
  const taken = new Set(o.agents.filter(a => a.id !== id).map(a => a.desk))
  // shortcut: 6 subagent desks; a 7th shares one, enough unless runs fan out wider.
  const desk = id === 'main' ? -1 : ([0, 1, 2, 3, 4, 5].find(d => !taken.has(d)) ?? o.agents.length % 6)
  const a: Agent = { id, label, job, desk, out: false, since: now, started: now, acts: [], calls: 0, tokIn: 0, tokOut: 0, todo: null, bubble: null }
  return { ...o, agents: [...o.agents.filter(x => x.id !== id), a] }
}

function edit(o: Office, id: string, fn: (a: Agent) => Agent): Office {
  return { ...o, agents: o.agents.map(a => (a.id === id && !a.out ? fn(a) : a)) }
}

// TodoWrite's `todos` or the app's task list `items`: [{ status }].
function todoOf(e: Record<string, unknown>): [number, number] | null {
  const list = (e.todos ?? e.items) as { status?: string }[] | undefined
  if (!Array.isArray(list) || !list.length) return null
  return [list.filter(t => t.status === 'completed').length, list.length]
}

export const register: Register = on => {
  // A reload or new session starts from an empty office; history stays.
  on('session.start', async ($, e, next) => {
    await update($, office, (o: Office) => ({ ...o, agents: [], selected: null }))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) await change($, (o, now) => enter(o, now, 'main', 'Main', 'lead'))
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    const id = e.agentId ?? 'main'
    await change($, (o, now) => {
      const a = o.agents.find(x => x.id === id && !x.out)
      if (!a) return o
      // Leave no sooner than MIN_SEAT after sitting down, so quick agents are seen working.
      const leaveAt = Math.max(now, a.since + walkMs(a.desk) + MIN_SEAT)
      const done: Agent = { ...a, id: `${a.id}@${now}`, out: true, bubble: null, ended: now }
      return { ...edit(o, id, x => ({ ...x, out: true, since: leaveAt, bubble: null })), past: [done, ...o.past].slice(0, 30) }
    })
    return next(e)
  })

  // Tokens: each model request's usage, credited to the agent that made it.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    const u = r.usage
    if (u) {
      const inp = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      await change($, o => edit(o, e.agentId ?? 'main', a => ({ ...a, tokIn: a.tokIn + inp, tokOut: a.tokOut + u.output_tokens })))
    }
    return r
  })

  // A subagent gets its own crab and desk once the engine starts it.
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.agentId) {
      const id = r.agentId
      await change($, (o, now) => enter(o, now, id, e.description || e.subagentType, jobOfType(e.subagentType)))
    }
    return r
  })

  // An "ask" decision or a question tool means that agent waits on the person.
  on('tool.check', async ($, e, next) => {
    const r = await next(e)
    const id = e.agentId ?? 'main'
    let bubble: string | null = null
    if (e.tool === 'AskUserQuestion') {
      bubble = (e.input as { questions?: { question?: string }[] })?.questions?.[0]?.question ?? 'I have a question...'
    } else if (r.decision === 'ask') bubble = `May I use ${e.tool}?`
    if (bubble) await change($, o => edit(o, id, a => ({ ...a, bubble })))
    return r
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId ?? 'main'
    const ev = e as unknown as Record<string, unknown>
    const act = actOf(ev)
    const todo = todoOf(ev)
    await change($, o => edit(o, id, a => ({ ...a, acts: addAct(a.acts, act), calls: a.calls + 1, todo: todo ?? a.todo, bubble: null })))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const now = await $.clock.now()
    const o = prune(await read($, office), now)
    const isCompact = await read($, compact)
    const ui = $.ui.resolve(e) as any
    const { Box, Text, Button } = ui

    const live = o.agents.filter(a => !a.out)
    const main = live.find(a => a.id === 'main')
    const subs = live.length - (main ? 1 : 0)
    const tok = o.agents.reduce((t, a) => t + a.tokIn + a.tokOut, 0)
    const doing = (a: Agent) => {
      const n = nowAct(a)
      return a.bubble ? '❓ waiting on you' : n ? `${ICON[n.kind]} ${n.target.split(/[\\/]/).pop()}` : 'thinking…'
    }
    const toggle = <Button key="size" label={isCompact ? 'Expand' : 'Compact'} onPress={() => update($, compact, v => !v)} />

    if (isCompact || !ui.Svg) {
      const parts = main
        ? [`🦀 Main: ${doing(main)}`, main.todo && `${main.todo[0]}/${main.todo[1]} todos`, `${fmtTok(tok)} tokens`, subs && `${subs} subagent${subs > 1 ? 's' : ''}`]
        : ['🦀 Office idle']
      return (
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor={!main}>{parts.filter(Boolean).join(' · ')}</Text>
          {ui.Svg && toggle}
        </Box>
      )
    }

    const sel = [...o.agents, ...o.past].find(a => a.id === o.selected) ?? main ?? o.agents[0] ?? o.past[0]
    const asking = live.filter(a => a.bubble)
    const status = (a: Agent) =>
      a.ended ? `finished ${elapsed(now - a.ended)} ago` : a.out ? 'done, leaving' : now - a.since < walkMs(a.desk) ? 'walking in' : a.bubble ? 'waiting on you' : 'working'
    const pick = (id: string) => () => update($, office, (x: Office) => ({ ...x, selected: id }))
    const end = (a: Agent) => (a.ended ?? now)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row">
            {o.agents.map(a => (
              <Button
                key={`a-${a.id}`}
                label={`${sel?.id === a.id ? '● ' : ''}${a.label.slice(0, 22)} · ${fmtTok(a.tokIn + a.tokOut)}`}
                onPress={pick(a.id)}
              />
            ))}
          </Box>
          <Box flexDirection="row">
            <Text dimColor>{`Σ ${fmtTok(tok)} tokens  `}</Text>
            <Button
              key="hist"
              label={`${o.showPast ? '▾' : '▸'} History (${o.past.length})`}
              onPress={() => update($, office, (x: Office) => ({ ...x, showPast: !x.showPast }))}
            />
            {toggle}
          </Box>
        </Box>

        {o.showPast && (
          <Box flexDirection="column" borderStyle="round" borderDimColor paddingLeft={1} paddingRight={1}>
            {o.past.length === 0 && <Text dimColor>No finished work yet.</Text>}
            {o.past.map(a => (
              <Button
                key={`p-${a.id}`}
                label={`${sel?.id === a.id ? '● ' : '✓ '}${a.label.slice(0, 26)} · ${elapsed(end(a) - a.started)} · ${a.acts.length} items · ${fmtTok(a.tokIn + a.tokOut)} · ${elapsed(now - end(a))} ago`}
                onPress={pick(a.id)}
              />
            ))}
          </Box>
        )}

        {asking.map(a => (
          <Box key={`q-${a.id}`} borderStyle="round" borderColor="warning" paddingLeft={1} paddingRight={1} flexDirection="column">
            <Text bold color="warning">{`❓ ${a.label} is asking:`}</Text>
            <Text>{a.bubble}</Text>
          </Box>
        ))}

        <ui.Svg source={scene(o.agents, now)} alt="Crab office" width={800} isInteractive />

        {sel && (
          <Box flexDirection="column" borderStyle="round" borderDimColor paddingLeft={1} paddingRight={1}>
            <Text bold>{`${sel.label} · ${status(sel)} · ${elapsed(now - sel.started)} · ${sel.calls} tool calls · ${fmtTok(sel.tokIn)} in / ${fmtTok(sel.tokOut)} out`}</Text>
            {sel.todo && <Text>{`${bar(sel.todo[0], sel.todo[1])} ${sel.todo[0]}/${sel.todo[1]} todos`}</Text>}
            {sel.acts.length === 0 && <Text dimColor>Nothing touched yet.</Text>}
            {tree(sel.acts).slice(-14).map(row => (
              <Text dimColor={!row.endsWith('◀ now')} bold={row.endsWith('◀ now')}>{row}</Text>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
