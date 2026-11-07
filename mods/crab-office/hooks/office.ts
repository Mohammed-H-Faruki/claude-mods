import type { Agent, Job } from '../types'

const W = 800
const H = 260
const O = '#D97757' // Claude orange
const DARK = '#2a1d17'
const SPEED = 55 // px per second: a slow stroll
export const MIN_SEAT = 8000 // a crab stays seated at least this long before leaving
const DOOR = { x: 830, y: 218 }
const CORRIDOR = 218

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)

export function jobOfType(type: string): Job {
  if (type === 'Explore') return 'research'
  if (type === 'Plan') return 'plan'
  if (type === 'general-purpose') return 'build'
  return 'write'
}

// Desk -1 is the main desk; 0..5 a 3x2 grid of subagent desks.
export function seat(desk: number) {
  if (desk < 0) return { cx: 120, chairY: 72, deskY: 88, w: 140, gx: 214 }
  const cx = 320 + (desk % 3) * 150
  const chairY = desk < 3 ? 72 : 148
  return { cx, chairY, deskY: chairY + 16, w: 110, gx: cx - 77 }
}

type Pt = { x: number; y: number }
function route(desk: number): Pt[] {
  const s = seat(desk)
  return [DOOR, { x: s.gx, y: CORRIDOR }, { x: s.gx, y: s.chairY }, { x: s.cx, y: s.chairY }]
}
const len = (p: Pt[]) => p.slice(1).reduce((t, q, i) => t + Math.hypot(q.x - p[i].x, q.y - p[i].y), 0)
export const walkMs = (desk: number) => (len(route(desk)) / SPEED) * 1000

// Keyframes along the route, percentages by distance so the pace is even.
function keyframes(name: string, pts: Pt[], fadeOut: boolean): string {
  const total = len(pts)
  let d = 0
  const stops = pts.map((p, i) => {
    if (i) d += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)
    const op = fadeOut && i === pts.length - 1 ? ';opacity:0' : ''
    return `${((d / total) * 100).toFixed(2)}%{transform:translate(${p.x}px,${p.y + 10}px)${op}}`
  })
  return `@keyframes ${name}{${stops.join('')}}`
}

const CSS = `
.bob,.lg,.cl,.cr,.sit,.eye,.wr,.drip,.bub{transform-box:fill-box;transform-origin:50% 50%}
.bob{animation:bob .32s ease-in-out infinite alternate}
.bob .lg{animation:step .16s ease-in-out infinite alternate}
.lg:nth-child(odd){animation-delay:.16s}
.type .cl{animation:tap .2s ease-in-out var(--t) infinite alternate}
.type .cr{animation:tap .2s ease-in-out calc(var(--t) + .1s) infinite alternate}
.sit{animation:breathe 2s ease-in-out var(--t) infinite alternate}
.eye{animation:blink 4s infinite}
.wr{animation:shake .1s linear infinite alternate}
.drip{animation:drip 1s ease-in infinite}
.glow{animation:glow 1.6s ease-in-out infinite alternate}
.bub{animation:bubin .35s cubic-bezier(.3,1.5,.5,1) both;transform-origin:50% 100%}
@keyframes bob{to{transform:translateY(-3px)}}
@keyframes step{to{transform:translateY(-2px)}}
@keyframes tap{to{transform:translateY(4px)}}
@keyframes breathe{to{transform:translateY(-1px)}}
@keyframes blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes shake{from{transform:translateX(-1px)}to{transform:translateX(1px)}}
@keyframes drip{from{transform:translateY(0);opacity:1}to{transform:translateY(10px);opacity:0}}
@keyframes glow{from{opacity:.45}to{opacity:.95}}
@keyframes bubin{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
`

// ---- static room ----------------------------------------------------------

function windowAt(x: number): string {
  return (
    `<rect x="${x}" y="8" width="96" height="28" rx="2" fill="#141a2b"/>` +
    `<rect x="${x + 3}" y="11" width="90" height="22" fill="url(#sky)"/>` +
    `<polygon points="${x + 18},11 ${x + 32},11 ${x + 16},33 ${x + 3},33" fill="#fff" opacity=".18"/>` +
    `<rect x="${x + 47}" y="11" width="2" height="22" fill="#141a2b"/>` +
    `<rect x="${x - 3}" y="36" width="102" height="4" rx="1" fill="#6a7799"/>`
  )
}

function plant(x: number, y: number): string {
  return (
    `<ellipse cx="${x}" cy="${y + 9}" rx="11" ry="4" fill="#000" opacity=".25"/><circle cx="${x}" cy="${y}" r="9" fill="#8b4a2b"/><circle cx="${x}" cy="${y}" r="7" fill="#5a3320"/>` +
    `<ellipse cx="${x - 6}" cy="${y - 5}" rx="7" ry="4" fill="#2f7d45" transform="rotate(-35 ${x - 6} ${y - 5})"/><ellipse cx="${x + 6}" cy="${y - 6}" rx="7" ry="4" fill="#4cb36a" transform="rotate(35 ${x + 6} ${y - 6})"/><ellipse cx="${x}" cy="${y - 9}" rx="4" ry="7" fill="#3f9b56"/>`
  )
}

function room(): string {
  const books = ['#c0504d', '#4f81bd', '#9bbb59', '#f2c230', '#8064a2', '#4bacc6', '#f79646', '#c0504d', '#4f81bd', '#9bbb59']
  return (
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb5ff"/><stop offset="1" stop-color="#d6ebff"/></linearGradient>` +
    `<pattern id="plank" width="72" height="12" patternUnits="userSpaceOnUse"><rect width="72" height="12" fill="#8a6343"/><rect width="72" height="1" fill="#6e4d33"/><rect x="40" width="1" height="12" fill="#6e4d33"/></pattern>` +
    `<pattern id="carpet" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#47507a"/><rect width="4" height="4" fill="#4c5682"/><rect x="4" y="4" width="4" height="4" fill="#4c5682"/></pattern>` +
    `<radialGradient id="light" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#fff6d8" stop-opacity=".16"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient></defs>` +
    // walls and floor
    `<rect width="${W}" height="${H}" fill="#171b29"/>` +
    `<rect x="10" y="0" width="${W - 20}" height="44" fill="#34406a"/><rect x="10" y="40" width="${W - 20}" height="4" fill="#232b48"/>` +
    [40, 250, 400, 550].map(windowAt).join('') +
    `<rect x="10" y="44" width="${W - 20}" height="${H - 52}" fill="url(#plank)"/>` +
    // lounge carpet bottom-left
    `<rect x="18" y="160" width="182" height="88" rx="6" fill="url(#carpet)"/>` +
    // light pools under windows
    [40, 250, 400, 550].map(x => `<ellipse cx="${x + 48}" cy="60" rx="80" ry="40" fill="url(#light)"/>`).join('') +
    // door on the right wall
    `<rect x="790" y="196" width="10" height="44" fill="url(#plank)"/><rect x="776" y="200" width="14" height="36" rx="2" fill="#6b4e3a"/><path d="M790 196 L770 186" stroke="#8a6a50" stroke-width="3"/>` +
    // walls
    `<rect x="0" y="0" width="10" height="${H}" fill="#232b48"/><rect x="790" y="0" width="10" height="196" fill="#232b48"/><rect x="790" y="240" width="10" height="20" fill="#232b48"/><rect x="0" y="${H - 8}" width="${W}" height="8" fill="#232b48"/>` +
    // lounge: sofa, coffee table
    `<rect x="30" y="222" width="150" height="22" rx="6" fill="#7c4f8f"/><rect x="34" y="226" width="44" height="14" rx="4" fill="#9566a8"/><rect x="83" y="226" width="44" height="14" rx="4" fill="#9566a8"/><rect x="132" y="226" width="44" height="14" rx="4" fill="#9566a8"/>` +
    `<rect x="70" y="180" width="76" height="26" rx="4" fill="#6b4a35"/><rect x="80" y="186" width="18" height="12" fill="#f1ead8"/><circle cx="128" cy="192" r="5" fill="#efe7d6"/>` +
    // bookshelf, water cooler, printer on the right
    `<rect x="688" y="46" width="94" height="14" fill="#5a3b26"/>` + books.map((c, i) => `<rect x="${692 + i * 9}" y="48" width="7" height="10" fill="${c}"/>`).join('') +
    `<rect x="740" y="96" width="22" height="22" rx="3" fill="#e8edf3"/><circle cx="751" cy="94" r="8" fill="#7cc4ff" opacity=".85"/>` +
    `<rect x="700" y="132" width="40" height="26" rx="3" fill="#cfd5de"/><rect x="706" y="136" width="28" height="6" fill="#2b2f3a"/>` +
    plant(26, 62) + plant(772, 160) + plant(210, 236) +
    // clock
    `<circle cx="210" cy="22" r="11" fill="#f3efe4" stroke="#141a2b" stroke-width="2"/><path d="M210 22 V15 M210 22 L215 25" stroke="#141a2b" stroke-width="1.6" stroke-linecap="round"/>`
  )
}
const ROOM = room()

function chair(desk: number): string {
  const { cx, chairY } = seat(desk)
  return `<circle cx="${cx}" cy="${chairY}" r="12" fill="#2e3347"/><rect x="${cx - 13}" y="${chairY - 17}" width="26" height="8" rx="4" fill="#454d70"/>`
}

function desk(d: number, label: string, on: boolean): string {
  const { cx, deskY, w } = seat(d)
  const x = cx - w / 2
  const mons = d < 0 ? [cx - 34, cx + 4] : [cx - 15]
  return (
    `<rect x="${x + 3}" y="${deskY + 6}" width="${w}" height="32" rx="3" fill="#000" opacity=".25"/>` +
    `<rect x="${x}" y="${deskY}" width="${w}" height="28" rx="3" fill="#b9875c"/><rect x="${x}" y="${deskY + 26}" width="${w}" height="6" rx="2" fill="#7a4f33"/>` +
    `<rect x="${cx - 13}" y="${deskY + 3}" width="26" height="5" rx="1" fill="#d9dde6"/>` +
    mons.map(m =>
      `<rect x="${m}" y="${deskY + 10}" width="30" height="9" rx="1.5" fill="#1b1c22"/><rect x="${m + 13}" y="${deskY + 19}" width="4" height="3" fill="#1b1c22"/>` +
      (on ? `<rect class="glow" x="${m + 1}" y="${deskY + 8}" width="28" height="2" fill="#7dd3fc"/>` : ''),
    ).join('') +
    `<rect x="${x + w - 18}" y="${deskY + 6}" width="7" height="7" rx="1.5" fill="#efe7d6"/><rect x="${x + 6}" y="${deskY + 8}" width="14" height="10" fill="#f1ead8" transform="rotate(-8 ${x + 13} ${deskY + 13})"/>` +
    `<text x="${cx}" y="${deskY + 31}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="5.5" font-weight="700" letter-spacing=".5" fill="#f5e6d3">${esc(label.toUpperCase().slice(0, 22))}</text>`
  )
}

// ---- crabs ------------------------------------------------------------------

function outfit(job: Job): string {
  if (job === 'lead')
    return `<path d="M-13 -38 L-13 -48 L-7 -43 L0 -51 L7 -43 L13 -48 L13 -38 Z" fill="#f2c230" stroke="#c99a12" stroke-width="1"/><circle cx="0" cy="-45" r="1.8" fill="#d94b4b"/><rect x="-22" y="-33" width="4" height="10" rx="2" fill="#2b2b33"/><path d="M-20 -24 q-4 4 4 6" stroke="#2b2b33" stroke-width="1.5" fill="none"/>`
  if (job === 'research')
    return `<rect x="-16" y="-47" width="32" height="10" rx="4" fill="#7a5a3a"/><rect x="-22" y="-40" width="20" height="3.5" rx="1.5" fill="#5e4329"/><circle cx="-8.5" cy="-31" r="6" fill="#fff" fill-opacity=".3" stroke="#2c2c34" stroke-width="1.4"/><circle cx="8.5" cy="-31" r="6" fill="#fff" fill-opacity=".3" stroke="#2c2c34" stroke-width="1.4"/><path d="M-2.5 -31 H2.5" stroke="#2c2c34" stroke-width="1.4"/>`
  if (job === 'write')
    return `<ellipse cx="3" cy="-42" rx="16" ry="7" fill="#7b4fa8"/><circle cx="3" cy="-49" r="2.5" fill="#5d3a82"/><rect x="15" y="-46" width="3.5" height="16" rx="1" fill="#f2c230" transform="rotate(18 16 -38)"/><path d="M-20 -14 H20" stroke="#2fa39a" stroke-width="5"/>`
  if (job === 'build')
    return `<path d="M-17 -38 A17 14 0 0 1 17 -38 Z" fill="#f2c230"/><rect x="-21" y="-39" width="42" height="4" rx="2" fill="#d9a91d"/><rect x="-20" y="-20" width="40" height="3" fill="#f6e34a"/><rect x="-20" y="-14" width="40" height="3" fill="#f6e34a"/>`
  return `<rect x="-12" y="-53" width="24" height="15" rx="2" fill="#243b6b"/><rect x="-18" y="-40" width="36" height="3.5" rx="1.5" fill="#1b2d52"/><rect x="-12" y="-44" width="24" height="3" fill="#d94b4b"/><path d="M-3 -22 L3 -22 L5 -11 L0 -8 L-5 -11 Z" fill="#d94b4b"/>`
}

// Front view, origin at the feet, ~38px tall before the 0.62 scale.
function crab(job: Job, mode: string, worried: boolean): string {
  const legs = [-15, -7, 3, 11].map(x => `<rect class="lg" x="${x}" y="-9" width="4" height="9" rx="1" fill="${O}"/>`).join('')
  const eyeH = worried ? 8 : 6
  const eyes = `<rect class="eye" x="-11" y="-34" width="5" height="${eyeH}" fill="${DARK}"/><rect class="eye" x="6" y="-34" width="5" height="${eyeH}" fill="${DARK}"/>`
  const mouth = worried
    ? `<path d="M-5 -19 q2.5 -3 5 0 q2.5 3 5 0" stroke="${DARK}" stroke-width="1.6" fill="none" stroke-linecap="round"/><path class="drip" d="M25 -42 q-3 5 0 7 q3 -2 0 -7z" fill="#7cc4ff"/>`
    : `<path d="M-5 -20 q5 4 10 0" stroke="${DARK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
  return (
    `<g transform="scale(.62)"><g class="${mode} ${worried ? 'wr' : ''}">${legs}` +
    `<ellipse cx="0" cy="1" rx="20" ry="4" fill="#000" opacity=".25"/>` +
    `<rect x="-20" y="-38" width="40" height="30" rx="7" fill="${O}"/>` +
    `<rect class="cl" x="-34" y="-24" width="14" height="10" rx="3" fill="${O}"/><rect class="cr" x="20" y="-24" width="14" height="10" rx="3" fill="${O}"/>` +
    eyes + mouth + outfit(job) +
    `</g></g>`
  )
}

function agentSvg(a: Agent, now: number, css: string[]): string {
  const el = (now - a.since) / 1000
  const dur = walkMs(a.desk) / 1000
  const id = 'w' + a.id.replace(/[^a-zA-Z0-9]/g, '')
  const { cx, chairY } = seat(a.desk)
  const worried = !!a.bubble
  if (a.out) {
    if (el >= dur) return ''
    // A leave set in the future (MIN_SEAT) holds the first frame, at the chair, until then.
    css.push(keyframes(id, [...route(a.desk)].reverse(), true))
    if (el < 0) return `<g style="animation:${id} ${dur.toFixed(2)}s linear ${(-el).toFixed(2)}s both"><g class="sit">${crab(a.job, 'rest', worried)}</g></g>`
    return `<g style="animation:${id} ${dur.toFixed(2)}s linear ${(-el).toFixed(2)}s both"><g class="bob">${crab(a.job, 'walk', worried)}</g></g>`
  }
  const t = `--t:${Math.max(0, dur - el).toFixed(2)}s`
  if (el < dur) {
    css.push(keyframes(id, route(a.desk), false))
    // Walk, then the bob stops as it sits (iteration count covers the walk).
    const bobs = Math.max(1, Math.ceil((dur - el) / 0.32))
    return `<g style="animation:${id} ${dur.toFixed(2)}s linear ${(-el).toFixed(2)}s both;${t}"><g class="bob" style="animation-iteration-count:${bobs}">${crab(a.job, worried ? 'rest' : 'type', worried)}</g></g>`
  }
  return `<g transform="translate(${cx} ${chairY + 10})" style="${t}"><g class="sit">${crab(a.job, worried ? 'rest' : 'type', worried)}</g></g>`
}

// A "?" thought bubble only: the question itself is crisp text in the band.
function bubble(a: Agent): string {
  const { cx, chairY } = seat(a.desk)
  const x = cx + 22
  const y = Math.max(16, chairY - 34)
  return (
    `<g class="bub"><circle cx="${x - 9}" cy="${y + 17}" r="2.5" fill="#fff" stroke="#888"/><circle cx="${x - 4}" cy="${y + 11}" r="3.5" fill="#fff" stroke="#888"/>` +
    `<circle cx="${x + 6}" cy="${y - 2}" r="13" fill="#fff" stroke="#888"/>` +
    `<text x="${x + 6}" y="${y + 5}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="19" font-weight="800" fill="#D97757">?</text></g>`
  )
}

export function scene(agents: Agent[], now: number): string {
  const css: string[] = []
  const seated = (d: number) => agents.some(a => a.desk === d && !a.out && now - a.since >= walkMs(d))
  const labelOf = (d: number) => (d < 0 ? 'Main' : agents.find(a => a.desk === d && !a.out)?.label ?? '')
  let body = ''
  for (const d of [-1, 0, 1, 2, 3, 4, 5]) body += chair(d) + desk(d, labelOf(d), seated(d))
  // Crabs sit north of their desks, so drawing them after the furniture never hides them.
  body += agents.map(a => agentSvg(a, now, css)).join('')
  if (!agents.some(a => !a.out)) body += `<rect width="${W}" height="${H}" fill="#0a0d1c" opacity=".45"/>`
  body += agents.filter(a => a.bubble && !a.out).map(bubble).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><style>${CSS}${css.join('')}</style>${ROOM}${body}</svg>`
}
