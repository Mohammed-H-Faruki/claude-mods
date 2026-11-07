import type { Agent, Job, Place, Trip } from '../types'
export type { Place }
import { MUG, PAL, QUESTION, crabSprite, grid } from './sprites'
import type { Face } from './sprites'

// The scene is a 280x104 pixel grid drawn at x2: 560x208 CSS px, shown 1:1.
const SCALE = 2
export const W = 280 * SCALE
export const H = 104 * SCALE
const CORR = 27 // the walkway along the back wall (crab top-left y)
export const WALK_DOOR = 1400 // brisk walk in from the door
export const WALK_STATION = 1000 // desk <-> library / tools / skills
export const MIN_SEAT = 3000 // a finished crab stays seated at least this long
const COFFEE_AFTER = 180_000 // working this long earns a (visual) coffee break
const COFFEE_EVERY = 90 // seconds per coffee loop

export const ACCENT = ['#5fb3ff', '#7ee081', '#f6c453', '#c58cff', '#ff7a90', '#4fd1c5']
export const accentOf = (desk: number) => (desk < 0 ? PAL.o : ACCENT[desk % ACCENT.length])

export function jobOfType(type: string): Job {
  if (type === 'Explore') return 'research'
  if (type === 'Plan') return 'plan'
  if (type === 'general-purpose') return 'build'
  return 'write'
}

// Which station a tool sends the crab to; everything else is desk work.
// Searching (web or code) is library work; running commands or MCP tools is tool-rack work;
// reading and editing files stays at the desk.
export function placeOf(tool: string): Place {
  if (/^(WebSearch|WebFetch|Grep|Glob)$|^mcp__(Claude_Browser|claude-in-chrome|plugin_browser-use)/.test(tool)) return 'library'
  if (/^(Skill|ToolSearch|SearchSkills|ListSkills|SearchPlugins|ListPlugins)$|^mcp__plugin_/.test(tool)) return 'skills'
  if (/^(Bash|PowerShell|Monitor)$/.test(tool) || tool.startsWith('mcp__')) return 'tools'
  return 'desk'
}

type Pt = { x: number; y: number }

// Desk -1 is the main desk; 0..5 a 3x2 grid of subagent desks.
export function seat(desk: number) {
  if (desk < 0) return { cx: 42, top: 70, w: 60, x: 46, y: 63, gx: 78 }
  const cx = 118 + (desk % 3) * 50
  const top = desk < 3 ? 52 : 84
  return { cx, top, w: 36, x: cx - 3, y: top - 7, gx: cx - 26 }
}

const STATION: Record<Exclude<Place, 'desk'>, Pt> = {
  library: { x: 14, y: CORR },
  skills: { x: 44, y: CORR },
  tools: { x: 214, y: CORR },
  door: { x: 266, y: CORR },
}
const COFFEE: Pt = { x: 238, y: CORR }

const spot = (p: Place, desk: number): Pt => (p === 'desk' ? seat(desk) : STATION[p])

// Desk -> side aisle -> walkway -> target. Stations sit on the walkway.
export function route(a: Pt, b: Pt, desk: number): Pt[] {
  const s = seat(desk)
  const isSeat = (p: Pt) => p.x === s.x && p.y === s.y
  const pts: Pt[] = [a]
  if (isSeat(a)) pts.push({ x: s.gx, y: a.y }, { x: s.gx, y: CORR })
  if (isSeat(b)) pts.push({ x: s.gx, y: CORR }, { x: s.gx, y: b.y })
  pts.push(b)
  return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y)
}

const tripMs = (t: Trip) => (t.from === 'door' || t.to === 'door' ? (t.to === 'door' ? WALK_DOOR + 200 : WALK_DOOR) : WALK_STATION)
export const tripDone = (t: Trip, now: number) => now - t.since >= tripMs(t)

const dist = (p: Pt[]) => p.slice(1).reduce((t, q, i) => t + Math.abs(q.x - p[i].x) + Math.abs(q.y - p[i].y), 0)

const at = (p: Pt) => `transform:translate(${p.x}px,${p.y}px)`

// Keyframe stops along `pts`, spread over [from%, to%] by distance so the pace is even.
function stops(pts: Pt[], from: number, to: number, fade = false): string {
  const total = dist(pts) || 1
  let d = 0
  return pts
    .map((p, i) => {
      if (i) d += Math.abs(p.x - pts[i - 1].x) + Math.abs(p.y - pts[i - 1].y)
      return `${(from + (d / total) * (to - from)).toFixed(2)}%{${at(p)}${fade && i === pts.length - 1 ? ';opacity:0' : ''}}`
    })
    .join('')
}
const keyframes = (name: string, pts: Pt[], fade: boolean) => `@keyframes ${name}{${stops(pts, 0, 100, fade)}}`

// ---- living details ----------------------------------------------------------

type Sky = 'day' | 'dusk' | 'night'
// shortcut: uses the mod runtime's clock zone; fine on a local machine, off if the runtime runs in UTC.
export function skyOf(now: number): Sky {
  const h = new Date(now).getHours()
  return h >= 7 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'dusk' : 'night'
}

// Seconds into each hand's cycle, so a negative animation-delay lands the hand on the real time.
export function clockDelays(now: number) {
  const d = new Date(now)
  const s = d.getSeconds() + d.getMilliseconds() / 1000
  const m = d.getMinutes() * 60 + s
  const hr = (d.getHours() % 12) * 3600 + m
  return { s, m, h: hr }
}

const CSS = `
.lg,.cl,.cr,.eye,.bob,.sit,.wr,.it,.zz,.bub,.steam,.dot,.flick,.leaf{transform-box:fill-box;transform-origin:50% 50%}
.walk .lg{animation:step .14s steps(2) infinite}
.walk .lg:nth-child(odd){animation-delay:.07s}
.walk{animation:bob .14s steps(2) infinite alternate}
.type .cl{animation:tap .22s steps(2) infinite}
.type .cr{animation:tap .22s steps(2) .11s infinite}
.sit{animation:breathe 2.4s steps(2) infinite}
.eye{animation:blink 4.2s steps(1) infinite}
.wr{animation:shake .12s steps(2) infinite}
.zz{animation:zz 2.4s linear infinite}
.zz:nth-of-type(2){animation-delay:1.2s}
.bub{animation:bob 1s steps(2) infinite alternate}
.steam{animation:steam 1.6s linear infinite}
.steam:nth-of-type(2){animation-delay:.8s}
.dot{opacity:0;animation:show .01s steps(1) var(--th) forwards}
.dot rect{animation:blinkdot 1.2s steps(1) infinite}
.dot rect:nth-child(2){animation-delay:.4s}
.dot rect:nth-child(3){animation-delay:.8s}
.it{opacity:0;animation:show .01s steps(1) var(--arr) forwards}
.flick{animation:flick 1.8s steps(3) infinite}
.leaf{animation:sway 3s ease-in-out infinite alternate}
.hh,.mm,.ss{transform-origin:0 0}
.ss{animation:spin 60s linear infinite}
.mm{animation:spin 3600s linear infinite}
.hh{animation:spin 43200s linear infinite}
.lon{animation:lights .6s steps(3) both}
@keyframes step{50%{transform:translateY(-1px)}}
@keyframes bob{to{transform:translateY(-1px)}}
@keyframes tap{50%{transform:translateY(1px)}}
@keyframes breathe{50%{transform:translateY(-.5px)}}
@keyframes blink{0%,94%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes shake{50%{transform:translateX(.6px)}}
@keyframes zz{from{transform:translate(0,0);opacity:1}to{transform:translate(3px,-7px);opacity:0}}
@keyframes steam{from{transform:translateY(0);opacity:.8}to{transform:translateY(-4px);opacity:0}}
@keyframes show{to{opacity:1}}
@keyframes blinkdot{0%{opacity:1}50%{opacity:.25}}
@keyframes flick{0%{opacity:1}33%{opacity:.7}66%{opacity:.9}}
@keyframes sway{to{transform:rotate(4deg)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes lights{from{opacity:.4}to{opacity:0}}
`

// ---- room ----------------------------------------------------------------------

const SKY: Record<Sky, [string, string]> = { day: ['#76b3ff', '#cfe6ff'], dusk: ['#f39a5a', '#6e5aa8'], night: ['#0d1630', '#25305a'] }

function windowAt(x: number, sky: Sky): string {
  const [top, bot] = SKY[sky]
  let s = `<rect x="${x}" y="5" width="30" height="18" fill="#141b2e"/><rect x="${x + 1}" y="6" width="28" height="8" fill="${top}"/><rect x="${x + 1}" y="14" width="28" height="8" fill="${bot}"/>`
  if (sky === 'night') s += grid(['....w.......w.....w..', '..........w.......w..', '.w.....w......w.....'], x + 3, 7) + `<rect x="${x + 22}" y="8" width="3" height="3" fill="#f3efd0"/>`
  else if (sky === 'day') s += grid(['...wwww........', '..wwwwww...www.', '..........wwwww'], x + 4, 8)
  else s += `<rect x="${x + 10}" y="17" width="8" height="5" fill="#ffd27a"/>`
  s += `<rect x="${x + 14}" y="6" width="1" height="16" fill="#141b2e"/><rect x="${x - 1}" y="23" width="32" height="2" fill="#6a7799"/>`
  return s
}

const BOOKS = ['#c0504d', '#4f81bd', '#9bbb59', '#f2c230', '#8064a2', '#4bacc6', '#f79646']

function room(sky: Sky): string {
  let s = ''
  // back wall, wainscot, trim
  s += `<rect width="280" height="34" fill="#2b3656"/><rect y="24" width="280" height="10" fill="#243050"/><rect y="24" width="280" height="1" fill="#3b4870"/>`
  // floor planks with staggered seams
  s += `<rect y="34" width="280" height="70" fill="#8d6243"/>`
  for (let r = 0; r < 12; r++) {
    const y = 34 + r * 6
    s += `<rect y="${y}" width="280" height="1" fill="#6f4c33"/>`
    for (let x = (r % 2) * 18; x < 280; x += 36) s += `<rect x="${x}" y="${y}" width="1" height="6" fill="#7a5539"/>`
  }
  s += `<rect y="34" width="280" height="2" fill="#1c2238" opacity=".5"/>`
  // window light on the floor (day)
  if (sky === 'day') for (const x of [104, 160]) s += `<polygon points="${x},36 ${x + 30},36 ${x + 48},70 ${x + 18},70" fill="#fff" opacity=".06"/>`
  // library: tall bookshelf
  s += `<rect x="4" y="3" width="32" height="32" fill="#5a3b26"/><rect x="5" y="4" width="30" height="30" fill="#3d2818"/>`
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 9; i++) s += `<rect x="${6 + i * 3}" y="${5 + r * 7 + ((i * 7 + r) % 3 === 0 ? 1 : 0)}" width="2" height="${(i * 7 + r) % 3 === 0 ? 5 : 6}" fill="${BOOKS[(i + r * 3) % BOOKS.length]}"/>`
    s += `<rect x="5" y="${11 + r * 7}" width="30" height="1" fill="#5a3b26"/>`
  }
  // skills & plugins cabinet: glass case with glowing scrolls and plug icons
  s += `<rect x="40" y="6" width="18" height="28" fill="#2a2f45"/><rect x="41" y="7" width="16" height="26" fill="#3a6f8f" opacity=".55"/>`
  s += grid(['yww.yww', '.......', 'kyk.kyk', '.k...k.', '.......', 'ywwy...', '...pwwp'], 43, 9) + `<rect x="41" y="7" width="3" height="26" fill="#fff" opacity=".12"/>`
  // windows
  s += windowAt(104, sky) + windowAt(160, sky)
  // wall clock (hands added per draw)
  s += `<circle cx="198" cy="13" r="7" fill="#f3efe4" stroke="#141b2e" stroke-width="1.2"/>`
  // tool rack: pegboard with hanging tools
  s += `<rect x="208" y="6" width="22" height="18" fill="#b98f62"/>` + grid(['.g...k..yy...g.', 'ggg..k..yy..ggg', '.g..kkk.yy...g.', '.g...k..yy...g.', '.g......yy...g.', '........y......'], 212, 9)
  s += `<rect x="206" y="24" width="26" height="3" fill="#6b4a35"/>`
  // coffee counter + machine
  s += `<rect x="234" y="22" width="26" height="12" fill="#6b4a35"/><rect x="234" y="21" width="26" height="2" fill="#8a6447"/>`
  s += `<rect x="238" y="10" width="12" height="11" fill="#30323c"/><rect x="240" y="13" width="8" height="4" fill="#1a1b22"/><rect x="246" y="11" width="2" height="1" fill="#e35d5d"/>` + MUG.replace(/<rect x="(\d+)" y="(\d+)"/g, (_, x, y) => `<rect x="${+x + 241}" y="${+y + 17}"`)
  s += `<rect class="steam" x="242" y="14" width="1" height="2" fill="#fff" opacity=".7"/><rect class="steam" x="244" y="14" width="1" height="2" fill="#fff" opacity=".7"/>`
  // door
  s += `<rect x="264" y="4" width="14" height="30" fill="#1a2238"/><rect x="265" y="5" width="12" height="29" fill="#7a5539"/><rect x="266" y="7" width="10" height="11" fill="#6a4a31"/><rect x="266" y="20" width="10" height="11" fill="#6a4a31"/><rect x="275" y="19" width="1" height="2" fill="#f2c230"/>`
  // rug under the main desk, plants
  s += `<rect x="4" y="56" width="84" height="44" fill="#4a3f7a"/><rect x="6" y="58" width="80" height="40" fill="none" stroke="#c9b27a" stroke-width="1" opacity=".55"/>`
  s += plant(92, 92) + plant(268, 90)
  return s
}

function plant(x: number, y: number): string {
  return `<rect x="${x}" y="${y + 6}" width="8" height="6" fill="#9a5434"/><rect x="${x}" y="${y + 6}" width="8" height="1" fill="#b8663f"/><g class="leaf">${grid(['..ll..', '.llLl.', 'lLllLl', '.lllL.'], x + 1, y + 1, { l: '#3f9b56', L: '#5cc070' })}</g>`
}

const ROOMS: Partial<Record<Sky, string>> = {}
const roomFor = (sky: Sky) => (ROOMS[sky] ??= room(sky))

// ---- furniture -------------------------------------------------------------------

function chair(desk: number): string {
  const { x, y } = seat(desk)
  return `<rect x="${x + 2}" y="${y - 3}" width="12" height="9" fill="#4a3a5e"/><rect x="${x + 1}" y="${y - 2}" width="14" height="7" fill="#4a3a5e"/><rect x="${x + 3}" y="${y - 2}" width="10" height="2" fill="#6a5585"/>`
}

function deskSprite(desk: number, on: boolean, active: boolean, night: boolean): string {
  const { cx, top, w } = seat(desk)
  const x = cx - w / 2
  const mons = desk < 0 ? [x + 4, x + 17] : [x + 2]
  let s = `<rect x="${x + 1}" y="${top + 11}" width="${w}" height="2" fill="#000" opacity=".25"/>`
  s += `<rect x="${x}" y="${top}" width="${w}" height="3" fill="#c99566"/><rect x="${x}" y="${top + 3}" width="${w}" height="6" fill="#8a5a3a"/><rect x="${x}" y="${top + 3}" width="${w}" height="1" fill="#a06c46"/>`
  s += `<rect x="${x + w - 15}" y="${top + 4}" width="10" height="4" fill="#7a4e31"/><rect x="${x + w - 11}" y="${top + 5}" width="2" height="1" fill="#d9b88a"/>`
  s += `<rect x="${x + 1}" y="${top + 9}" width="2" height="3" fill="#5a3a24"/><rect x="${x + w - 3}" y="${top + 9}" width="2" height="3" fill="#5a3a24"/>`
  s += `<rect x="${x + 2}" y="${top + 5}" width="3" height="2" fill="${accentOf(desk)}"/>`
  for (const m of mons) {
    s += `<rect x="${m}" y="${top - 8}" width="11" height="8" fill="#22232b"/><rect x="${m + 4}" y="${top}" width="3" height="1" fill="#22232b"/>`
    s += on
      ? `<g class="${active ? 'flick' : ''}"><rect x="${m + 1}" y="${top - 7}" width="9" height="6" fill="#2f6fb3"/><rect x="${m + 2}" y="${top - 6}" width="5" height="1" fill="#bfe3ff"/><rect x="${m + 2}" y="${top - 4}" width="7" height="1" fill="#8fd0ff"/><rect x="${m + 2}" y="${top - 2}" width="4" height="1" fill="#bfe3ff"/></g>`
      : `<rect x="${m + 1}" y="${top - 7}" width="9" height="6" fill="#121726"/>`
  }
  const kx = seat(desk).x + 4
  s += `<rect x="${kx}" y="${top + 1}" width="8" height="1" fill="#d9dde6"/>`
  s += MUG.replace(/<rect x="(\d+)" y="(\d+)"/g, (_, mx, my) => `<rect x="${+mx + x + w - 5}" y="${+my + top - 3}"`)
  if (night) s += `<circle cx="${x + w - 9}" cy="${top - 2}" r="9" fill="#ffd27a" opacity=".12"/><rect x="${x + w - 10}" y="${top - 5}" width="3" height="2" fill="#f2c230"/><rect x="${x + w - 9}" y="${top - 3}" width="1" height="3" fill="#30323c"/>`
  return s
}

// ---- crabs -------------------------------------------------------------------------

const ITEM: Record<string, string> = {
  library: grid(['bwwb', 'bwwb', 'bbbb'], 12, 2, { ...PAL, b: '#8a4b2a' }),
  tools: grid(['g.g', 'ggg', '.g.', '.g.'], 13, 1),
  skills: grid(['ywwy', '.ww.', 'ywwy'], 12, 2),
  coffee: MUG.replace(/<rect x="(\d+)" y="(\d+)"/g, (_, x, y) => `<rect x="${+x + 13}" y="${+y + 2}"`),
}

function body(a: Agent, mode: 'walk' | 'type' | 'rest', face: Face, extra = ''): string {
  return `<g class="${mode} ${face === 'wide' ? 'wr' : ''}">${crabSprite(a.job, face)}${extra}</g>`
}

function overlays(a: Agent, now: number, seated: boolean): string {
  let s = ''
  if (a.bubble) s += `<g class="bub" transform="translate(12 -12)">${QUESTION}</g>`
  else if (a.asleep) s += `<g transform="translate(14 -6)">${grid(['ee.', '.e.', 'ee.'], 0, 0, { e: '#cfd8ff' }).replace(/<rect/g, '<rect class="zz"')}${grid(['ee', 'ee'], 4, -3, { e: '#cfd8ff' }).replace(/<rect/g, '<rect class="zz"')}</g>`
  else if (seated) {
    const th = Math.max(0, 8 - (now - a.lastToolAt) / 1000)
    s += `<g class="dot" style="--th:${th.toFixed(2)}s" transform="translate(13 -4)"><rect x="0" y="0" width="1" height="1" fill="#fff"/><rect x="2" y="0" width="1" height="1" fill="#fff"/><rect x="4" y="0" width="1" height="1" fill="#fff"/></g>`
  }
  return s
}

const settled = (a: Agent, now: number) => a.trip.to === 'desk' && tripDone(a.trip, now)
export const wantsCoffee = (a: Agent, now: number) =>
  settled(a, now) && !a.asleep && !a.bubble && !a.out && now - a.started > COFFEE_AFTER

function crabAt(a: Agent, now: number, css: string[]): string {
  const t = a.trip
  const from = spot(t.from, a.desk)
  const to = spot(t.to, a.desk)
  const id = 'c' + a.id.replace(/[^a-zA-Z0-9]/g, '')
  const ms = tripMs(t)
  const el = now - t.since
  const face: Face = a.asleep ? 'shut' : a.bubble ? 'wide' : 'open'
  const atDesk = t.to === 'desk'

  // On the move (or a delayed leave not started yet: held at the start).
  if (el < ms) {
    const pts = t.from === 'desk' && t.to === 'desk' ? [to] : route(from, to, a.desk)
    css.push(keyframes(id, pts, t.to === 'door'))
    const item = t.to !== 'desk' && t.to !== 'door' ? `<g class="it" style="--arr:${((ms - el) / 1000).toFixed(2)}s">${ITEM[t.to]}</g>` : ''
    const moving = el >= 0
    return `<g style="animation:${id} ${(ms / 1000).toFixed(2)}s linear ${(-el / 1000).toFixed(2)}s both">${body(a, moving ? 'walk' : 'rest', face, item)}${moving ? '' : overlays(a, now, true)}</g>`
  }
  if (t.to === 'door') return ''

  // Arrived. At a station: browse/fetch with the item in claw.
  if (!atDesk) return `<g transform="translate(${to.x} ${to.y})"><g class="sit">${body(a, 'type', face, `<g class="it" style="--arr:0s">${ITEM[t.to]}</g>`)}${overlays(a, now, false)}</g></g>`

  // At the desk. A long-running agent takes a looping coffee trip (visual only):
  // 3s there, 5s sipping, 3s back, then work until the 90s loop comes round.
  const working = now - a.started
  if (wantsCoffee(a, now)) {
    css.push(`@keyframes ${id}g{${stops(route(to, COFFEE, a.desk), 0, 3.3)}${stops(route(COFFEE, to, a.desk), 8.9, 12.2)}100%{${at(to)}}}`)
    css.push(`@keyframes ${id}m{0%,3.2%{opacity:0}3.3%,12.2%{opacity:1}12.3%,100%{opacity:0}}`)
    const phase = ((working - COFFEE_AFTER) / 1000) % COFFEE_EVERY
    const d = `${(-phase).toFixed(2)}s`
    return `<g style="animation:${id}g ${COFFEE_EVERY}s linear ${d} infinite"><g class="sit">${body(a, 'type', face, `<g style="opacity:0;animation:${id}m ${COFFEE_EVERY}s steps(1) ${d} infinite">${ITEM.coffee}</g>`)}${overlays(a, now, true)}</g></g>`
  }
  return `<g transform="translate(${to.x} ${to.y})"><g class="sit">${body(a, a.asleep ? 'rest' : 'type', face)}${overlays(a, now, !a.asleep)}</g></g>`
}

// ---- scene ---------------------------------------------------------------------------

export function scene(agents: Agent[], now: number): string {
  const css: string[] = []
  const sky = skyOf(now)
  const sitting = (a: Agent) => settled(a, now) && !wantsCoffee(a, now)
  const occupant = (d: number) => agents.find(a => a.desk === d && !a.out && settled(a, now) && !a.asleep)
  let furn = ''
  for (const d of [-1, 0, 1, 2, 3, 4, 5]) {
    const who = occupant(d)
    furn += chair(d)
    // seated crabs sit between chair and desk; walkers and coffee-goers are drawn on top
    furn += agents.filter(a => a.desk === d && sitting(a)).map(a => crabAt(a, now, css)).join('')
    furn += deskSprite(d, !!who, !!who && now - who.lastToolAt < 8000, sky === 'night')
  }
  const movers = agents.filter(a => !sitting(a))
  const crabs = movers.map(a => crabAt(a, now, css)).join('')

  const { s, m, h } = clockDelays(now)
  const hands =
    `<g transform="translate(198 13)"><line class="hh" x1="0" y1="0" x2="0" y2="-3.5" stroke="#141b2e" stroke-width="1.4" style="animation-delay:-${h.toFixed(1)}s"/>` +
    `<line class="mm" x1="0" y1="0" x2="0" y2="-5.5" stroke="#141b2e" stroke-width="1" style="animation-delay:-${m.toFixed(1)}s"/>` +
    `<line class="ss" x1="0" y1="0" x2="0" y2="-5.5" stroke="#d94b4b" stroke-width=".5" style="animation-delay:-${s.toFixed(1)}s"/></g>`

  const busy = agents.some(a => !a.asleep && !(a.out && a.trip.to === 'door' && tripDone(a.trip, now)))
  const dim = busy ? '' : `<rect width="280" height="104" fill="#070a18" opacity="${sky === 'night' ? 0.45 : 0.3}"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">` +
    `<style>${CSS}${css.join('')}</style><g transform="scale(${SCALE})">${roomFor(sky)}${hands}${furn}${crabs}${dim}</g></svg>`
  )
}
