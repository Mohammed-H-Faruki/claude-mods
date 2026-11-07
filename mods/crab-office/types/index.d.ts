export type Job = 'lead' | 'plan' | 'research' | 'write' | 'build'
// Where a crab is or is walking to: its desk, a station, or the door.
export type Place = 'desk' | 'library' | 'tools' | 'skills' | 'door'
export type Trip = { from: Place; to: Place; since: number }
export type ActKind = 'read' | 'edit' | 'run' | 'find' | 'other'

// One thing an agent touched; repeats bump `n` instead of adding a row.
export type Act = { kind: ActKind; target: string; n: number }

export type Agent = {
  // 'main' for the main agent, else the subagent's agentId.
  id: string
  label: string
  job: Job
  // -1 is the main desk; 0..5 the subagent desks.
  desk: number
  // true once it is done and walking out (or about to).
  out: boolean
  // The current or last walk; `since` may be in the future (a delayed leave).
  trip: Trip
  // When this agent's work began, for the elapsed time.
  started: number
  acts: Act[]
  calls: number
  // Tokens this agent's model requests used so far.
  tokIn: number
  tokOut: number
  // [done, total] from its last TodoWrite, if it keeps a todo list.
  todo: [number, number] | null
  bubble: string | null
  // Last tool call, for the "thinking…" dots after a quiet spell.
  lastToolAt: number
  // Main only: no turn running, so it naps at its desk.
  asleep?: boolean
  // Set on finished agents kept in history.
  ended?: number
}

// past: finished agents (main's turns too), newest first, listed in the agent picker.
export type Tab = 'now' | 'history' | 'details' | 'actions'
// tab null: no list open (compact mode shows just the bar).
export type Office = { agents: Agent[]; past: Agent[]; selected: string | null; tab: Tab | null }

declare module 'claude-code' {
  interface PluginState {
    'crab-office': { office: Shaped<Office>; compact: Shaped<boolean> }
  }
}
