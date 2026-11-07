export type Job = 'lead' | 'plan' | 'research' | 'write' | 'build'
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
  // false: walking in or seated; true: walking out.
  out: boolean
  // When the current walk (in or out) started, ms since epoch.
  since: number
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
  // Set on finished agents kept in history.
  ended?: number
}

// past: finished agents (main's turns too), newest first, listed in the agent picker.
export type Office = { agents: Agent[]; past: Agent[]; selected: string | null }

declare module 'claude-code' {
  interface PluginState {
    'crab-office': { office: Shaped<Office>; compact: Shaped<boolean> }
  }
}
