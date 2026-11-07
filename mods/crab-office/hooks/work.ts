import type { Act, ActKind, Agent } from '../types'

const KIND: Record<string, ActKind> = {
  Read: 'read', Write: 'edit', Edit: 'edit', NotebookEdit: 'edit',
  Bash: 'run', PowerShell: 'run', Monitor: 'run',
  Grep: 'find', Glob: 'find', WebSearch: 'find', WebFetch: 'find', ToolSearch: 'find',
}

export const ICON: Record<ActKind, string> = { read: '👁', edit: '✎', run: '$', find: '🔍', other: '•' }

// What a tool call touched: a path for file tools, else its command/pattern.
export function actOf(e: Record<string, unknown>): Act {
  const tool = String(e.tool)
  const kind = KIND[tool] ?? 'other'
  const str = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : undefined)
  const raw =
    kind === 'other' ? tool
    : str('file_path') ?? str('notebook_path') ?? str('command') ?? str('pattern') ?? str('query') ?? str('url') ?? tool
  return { kind, target: raw.replace(/\s+/g, ' ').trim().slice(0, 120), n: 1 }
}

// Same kind + target bumps the count and moves it last (most recent).
export function addAct(acts: Act[], a: Act): Act[] {
  const old = acts.find(x => x.kind === a.kind && x.target === a.target)
  const rest = acts.filter(x => x !== old)
  return [...rest, { ...a, n: (old?.n ?? 0) + 1 }].slice(-40)
}

const isPath = (a: Act) => a.kind === 'read' || a.kind === 'edit'
const norm = (p: string) => p.replace(/\\/g, '/')

// Rows of a file-tree view: files under their folder, then commands and searches.
export function tree(acts: Act[], width = 70): string[] {
  const last = acts[acts.length - 1]
  const groups = new Map<string, Act[]>()
  for (const a of acts) {
    const g = isPath(a) ? norm(a.target).split('/').slice(-3, -1).join('/') + '/' : a.kind === 'run' ? '⌘ commands' : a.kind === 'find' ? '🔍 searches' : '• other tools'
    groups.set(g, [...(groups.get(g) ?? []), a])
  }
  const rows: string[] = []
  for (const [g, items] of [...groups].sort(([a], [b]) => (a.endsWith('/') === b.endsWith('/') ? a.localeCompare(b) : a.endsWith('/') ? -1 : 1))) {
    rows.push(`▾ ${g.endsWith('/') ? '📁 ' + g : g}`)
    items.forEach((a, i) => {
      const name = isPath(a) ? norm(a.target).split('/').pop()! : a.target
      const branch = i === items.length - 1 ? '└─' : '├─'
      const count = a.n > 1 ? `  ×${a.n}` : ''
      const now = a === last ? '  ◀ now' : ''
      rows.push(`  ${branch} ${ICON[a.kind]} ${name}`.slice(0, width) + count + now)
    })
  }
  return rows
}

export const fmtTok = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n))

export function bar(done: number, total: number, cells = 12): string {
  const f = total ? Math.round((done / total) * cells) : 0
  return '█'.repeat(f) + '░'.repeat(cells - f)
}

export function elapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

export const nowAct = (a: Agent) => a.acts[a.acts.length - 1]
