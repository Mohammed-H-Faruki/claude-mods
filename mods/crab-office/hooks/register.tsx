import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Agent, Job, Office, Place, Tab } from '../types'
import { H, MIN_SEAT, W, WALK_DOOR, accentOf, jobOfType, placeOf, scene, tripDone } from './office'
import { ICON, actOf, addAct, bar, elapsed, fmtTok, nowAct, tree } from './work'

const office = atom({ plugin: 'crab-office', key: 'office' } as const, { agents: [], past: [], selected: null, tab: 'now' } as Office, { shape: 'office-7' })
const compact = atom({ plugin: 'crab-office', key: 'compact' } as const, false, { shape: 'compact-1' })

// No timers anywhere: every walk is a CSS animation placed by elapsed time at draw,
// so a redraw resumes it mid-way and nothing ticks while the office is quiet.

function mk(id: string, label: string, job: Job, desk: number, now: number, from: Place, asleep = false): Agent {
  return { id, label, job, desk, out: false, trip: { from, to: 'desk', since: now }, started: now, acts: [], calls: 0, tokIn: 0, tokOut: 0, todo: null, bubble: null, lastToolAt: now, asleep }
}

function prune(o: Office, now: number): Office {
  return { ...o, agents: o.agents.filter(a => !(a.out && a.trip.to === 'door' && tripDone(a.trip, now) && now - a.trip.since > WALK_DOOR + 700)) }
}

async function change($: any, fn: (o: Office, now: number) => Office) {
  const now = await $.clock.now()
  return update($, office, (o: Office) => fn(prune(o, now), now))
}

function edit(o: Office, id: string, fn: (a: Agent) => Agent): Office {
  return { ...o, agents: o.agents.map(a => (a.id === id && !a.out ? fn(a) : a)) }
}

// A finished run is kept for the panel's history; only work worth showing.
function snapshot(o: Office, a: Agent, now: number): Office {
  if (!a.calls && !a.tokIn) return o
  const label = a.id === 'main' ? `Main turn` : a.label
  const done: Agent = { ...a, id: `${a.id}@${now}`, label, out: true, bubble: null, asleep: false, ended: now }
  return { ...o, past: [done, ...o.past].slice(0, 30) }
}

// Main naps at its desk; a subagent stays seated a moment, then walks out. Both go to history.
function finish(o: Office, id: string, now: number): Office {
  const a = o.agents.find(x => x.id === id && !x.out)
  if (!a || a.asleep) return o
  const kept = snapshot(o, a, now)
  if (id === 'main')
    return edit(kept, id, x => ({ ...mk('main', 'Main', 'lead', -1, now, 'desk', true), trip: x.trip.to === 'desk' ? x.trip : { from: x.trip.to, to: 'desk', since: now } }))
  const leaveAt = Math.max(now, a.started + WALK_DOOR + MIN_SEAT)
  return edit(kept, id, x => ({ ...x, out: true, bubble: null, trip: { from: x.trip.to, to: 'door', since: leaveAt } }))
}

// TodoWrite's `todos` or the app's task list `items`: [{ status }].
function todoOf(e: Record<string, unknown>): [number, number] | null {
  const list = (e.todos ?? e.items) as { status?: string }[] | undefined
  if (!Array.isArray(list) || !list.length) return null
  return [list.filter(t => t.status === 'completed').length, list.length]
}

// What the person is being asked to do, in plain words.
function actionText(tool: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>
  const file = typeof i.file_path === 'string' ? i.file_path.split(/[\\/]/).pop() : undefined
  if (tool === 'AskUserQuestion') return (i.questions as { question?: string }[] | undefined)?.[0]?.question ?? 'Answer a question'
  if (tool === 'ExitPlanMode') return 'Review the proposed plan: accept or reject'
  if (/^(Edit|Write|NotebookEdit)$/.test(tool)) return `Accept or reject an edit to ${file ?? 'a file'}`
  if (/^(Bash|PowerShell)$/.test(tool)) return `Allow command: ${String(i.command ?? '').slice(0, 60)}`
  return `Allow ${tool.startsWith('mcp__') ? tool.split('__').pop() : tool}`
}

const WHERE: Record<Place, string> = { desk: 'at the desk', library: 'browsing in the library', tools: 'at the tool rack', skills: 'at the skills shelf', door: 'heading out' }

export const register: Register = on => {
  // Every load starts with the main crab napping at its desk; history stays.
  on('session.start', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, office, (o: Office) => ({ ...o, agents: [mk('main', 'Main', 'lead', -1, now - 60_000, 'desk', true)], selected: null }))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId)
      await change($, (o, now) => {
        const main = o.agents.find(a => a.id === 'main')
        const fresh: Agent = { ...mk('main', 'Main', 'lead', -1, now, 'desk'), trip: main?.trip ?? { from: 'desk', to: 'desk', since: now } }
        return { ...o, agents: [...o.agents.filter(a => a.id !== 'main'), fresh] }
      })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId ?? 'main'
    await change($, (o, now) => finish(o, id, now))
    return next(e)
  })
  // Background subagents end without a turn.complete this mod sees; SubagentStop is the sure signal.
  on('classic.SubagentStop', async ($, e, next) => {
    await change($, (o, now) => finish(o, e.agent_id, now))
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
      await change($, (o, now) => {
        if (o.agents.some(a => a.id === id && !a.out)) return o
        const taken = new Set(o.agents.map(a => a.desk))
        // shortcut: 6 subagent desks; a 7th shares one, enough unless runs fan out wider.
        const desk = [0, 1, 2, 3, 4, 5].find(d => !taken.has(d)) ?? o.agents.length % 6
        return { ...o, agents: [...o.agents, mk(id, e.description || e.subagentType, jobOfType(e.subagentType), desk, now, 'door')] }
      })
    }
    return r
  })

  // An "ask" decision or a question tool means that agent waits on the person.
  on('tool.check', async ($, e, next) => {
    const r = await next(e)
    const id = e.agentId ?? 'main'
    const bubble = e.tool === 'AskUserQuestion' || e.tool === 'ExitPlanMode' || r.decision === 'ask' ? actionText(e.tool, e.input) : null
    if (bubble) {
      await change($, o => edit(o, id, a => ({ ...a, bubble })))
      $.ui.toast(`🦀 Action needed: ${bubble}`)
    }
    return r
  })

  // Each tool call: log it, and walk to the station that tool lives at (or back to the desk).
  on('tool.call', async ($, e, next) => {
    const id = e.agentId ?? 'main'
    const ev = e as unknown as Record<string, unknown>
    const act = actOf(ev)
    const todo = todoOf(ev)
    const place = placeOf(e.tool)
    await change($, (o, now) =>
      edit(o, id, a => ({
        ...a,
        acts: addAct(a.acts, act),
        calls: a.calls + 1,
        todo: todo ?? a.todo,
        bubble: null,
        asleep: false,
        lastToolAt: now,
        trip: place === a.trip.to ? a.trip : { from: a.trip.to === 'door' ? 'desk' : a.trip.to, to: place, since: now },
      })),
    )
    const r = await next(e)
    // The permission check runs inside the call: once it returns, the person has answered.
    await change($, o => edit(o, id, a => (a.bubble ? { ...a, bubble: null } : a)))
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const now = await $.clock.now()
    const o = prune(await read($, office), now)
    const isCompact = await read($, compact)
    const ui = $.ui.resolve(e) as any
    const { Box, Text, Button, Select } = ui

    const live = o.agents.filter(a => !a.out)
    const main = live.find(a => a.id === 'main')
    const helpers = live.filter(a => a.id !== 'main')
    const asking = live.filter(a => a.bubble)
    const everyone = [...live, ...o.past]
    const sel = everyone.find(a => a.id === o.selected) ?? main ?? everyone[0]
    // Session totals: history plus what is running now (a leaving agent is already in history).
    const counted = [...o.past, ...live]
    const tokIn = counted.reduce((t, a) => t + a.tokIn, 0)
    const tokOut = counted.reduce((t, a) => t + a.tokOut, 0)
    const tok = tokIn + tokOut

    const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
    const doing = (a: Agent) => {
      if (a.ended) return `done ${elapsed(now - a.ended)} ago`
      if (a.asleep) return 'resting'
      if (a.bubble) return 'waiting on you'
      if (a.out) return 'done, heading out'
      if (a.trip.from === 'door' && !tripDone(a.trip, now)) return 'walking in'
      const n = nowAct(a)
      return n ? `${ICON[n.kind]} ${n.target.split(/[\\/]/).pop()}` : 'thinking'
    }
    // Fixed-width cells so every row lines up, whatever the font.
    const cols = (key: string, cells: [string, number][], props: Record<string, unknown> = {}) => (
      <Box key={key} flexDirection="row">
        {cells.map(([t, w], i) => (
          <Box key={`${key}-${i}`} width={w} flexShrink={0}>
            <Text wrap="truncate" {...props}>{t}</Text>
          </Box>
        ))}
      </Box>
    )
    const agentRow = (a: Agent, mark: string) => cols(`r-${a.id}`, [[mark, 2], [short(a.label, 15), 16], [short(doing(a), 19), 20], [fmtTok(a.tokIn + a.tokOut), 7]], a.ended || a.asleep ? { dimColor: true } : {})

    // View tabs live in the bar in both modes; pressing the open one closes it.
    const tab = (t: Tab, label: string) => (
      <Button key={`t-${t}`} label={`${o.tab === t ? '▾' : '▸'} ${label}`} onPress={() => update($, office, (x: Office) => ({ ...x, tab: x.tab === t ? null : t }))} />
    )
    const summary = [
      `🦀 Main: ${main ? short(doing(main), 28) : 'resting'}`,
      main?.todo && `${main.todo[0]}/${main.todo[1]} tasks`,
      `${fmtTok(tok)} tokens`,
      helpers.length && `${helpers.length} helper${helpers.length > 1 ? 's' : ''}`,
      asking.length && `🔔 ${asking.length} action${asking.length > 1 ? 's' : ''} needed`,
    ].filter(Boolean)

    const bar_ = (
      // Buttons stand taller than a text row: the margin keeps them off the picture below.
      <Box key="bar" flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <Text bold={asking.length > 0} color={asking.length ? 'warning' : undefined} dimColor={!asking.length && (!main || main.asleep)}>
          {summary.join('   ')}
        </Text>
        <Box flexDirection="row" flexShrink={0} columnGap={1}>
          {tab('now', 'Now')}
          {tab('history', `History ${o.past.length}`)}
          {tab('details', 'Details')}
          {tab('actions', asking.length ? `Actions 🔔${asking.length}` : 'Actions')}
          {ui.Svg && <Button key="size" label={isCompact ? 'Expand' : 'Compact'} onPress={() => update($, compact, v => !v)} />}
        </Box>
      </Box>
    )

    const progress = main?.todo ? `${bar(main.todo[0], main.todo[1], 14)}  ${main.todo[0]} of ${main.todo[1]} tasks` : main && !main.asleep ? `${main.calls} tool calls so far` : 'Idle. Send a message to start.'

    const content = (() => {
      switch (o.tab) {
        case 'now':
          return [
            <Text key="tok" dimColor>{`${fmtTok(tok)} tokens: ${fmtTok(tokIn)} in, ${fmtTok(tokOut)} out`}</Text>,
            <Text key="prog">{progress}</Text>,
            ...live.map(a => agentRow(a, '■')),
          ]
        case 'history':
          return o.past.length ? o.past.slice(0, 8).map(a => agentRow(a, '✓')) : [<Text key="none" dimColor>Finished work shows up here.</Text>]
        case 'details':
          if (!sel) return [<Text key="none" dimColor>No agents yet.</Text>]
          return [
            <Select
              key="who"
              label="Agent "
              value={sel.id}
              options={everyone.map(a => ({ value: a.id, label: `${a.ended ? '✓' : '●'} ${short(a.label, 24)}${a.ended ? `, ${elapsed(now - a.ended)} ago` : ''}` }))}
              onSelect={(v: string) => update($, office, (x: Office) => ({ ...x, selected: v }))}
            />,
            <Text key="sum" dimColor>{`${sel.calls} tool calls, ${fmtTok(sel.tokIn + sel.tokOut)} tokens${sel.ended ? '' : `, ${WHERE[sel.trip.to]}`}`}</Text>,
            ...(sel.acts.length ? tree(sel.acts, 44).slice(-7).map((r, i) => <Text key={`tr-${i}`} dimColor={!r.endsWith('◀ now')} bold={r.endsWith('◀ now')}>{r}</Text>) : [<Text key="nt" dimColor>Nothing touched yet.</Text>]),
          ]
        case 'actions':
          return asking.length
            ? asking.map(a => (
                <Box key={`q-${a.id}`} borderStyle="round" borderColor="warning" paddingLeft={1} flexDirection="column">
                  <Text bold color="warning">{`🔔 ${a.label} needs you`}</Text>
                  <Text>{a.bubble}</Text>
                  <Text dimColor>Answer it in the conversation below.</Text>
                </Box>
              ))
            : [<Text key="none" dimColor>Nothing needs you right now.</Text>]
        default:
          return []
      }
    })()

    // Compact (or a surface without Svg): the bar, plus the open view's list if any.
    if (isCompact || !ui.Svg) {
      return (
        <Box flexDirection="column">
          {bar_}
          {content}
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {bar_}
        {/* Office left, panel right; no wrapping, the panel takes whatever width is left. */}
        <Box flexDirection="row">
          <Box flexShrink={0}>
            <ui.Svg source={scene(o.agents, now)} alt="Crab office" width={W} height={H} isInteractive />
          </Box>
          <Box flexDirection="column" flexGrow={1} flexShrink={1} paddingLeft={2}>
            {o.tab ? content : <Text dimColor>Pick a view: Now, History, Details or Actions.</Text>}
          </Box>
        </Box>
      </Box>
    )
  })
}
