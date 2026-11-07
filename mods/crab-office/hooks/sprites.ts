import type { Job } from '../types'

// Pixel sprites as character grids, drawn in grid units (the scene scales x2).
// '.' is transparent; every other character is a palette key.

export const PAL: Record<string, string> = {
  o: '#D97757', // Claude orange
  d: '#b45c3f', // orange shade
  h: '#f2a07f', // orange highlight
  e: '#24170f', // eyes, outlines
  w: '#ffffff',
  k: '#22232b', // dark gear
  y: '#f2c230', // gold / hard hat
  Y: '#f6e34a', // vest stripe
  r: '#d94b4b', // red
  b: '#7a5a3a', // brown cap
  p: '#7b4fa8', // beret purple
  t: '#2fa39a', // teal scarf
  g: '#9aa3b5', // grey
  c: '#7cc4ff', // sweat / water
}

// Horizontal runs of one colour become one rect.
export function grid(rows: string[], x0: number, y0: number, pal: Record<string, string> = PAL): string {
  let out = ''
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      let n = 1
      while (row[x + n] === ch) n++
      if (ch !== '.' && pal[ch]) out += `<rect x="${x0 + x}" y="${y0 + y}" width="${n}" height="1" fill="${pal[ch]}"/>`
      x += n
    }
  })
  return out
}

// Crab: 16 wide, body rows 0..6, legs 7..8. Claws and legs are separate so they animate.
const BODY = [
  '....hhhhhhhh....',
  '...ohhooooooo...',
  '...oooooooooo...',
  '...oooooooooo...',
  '...oooooooooo...',
  '...oooooooooo...',
  '...dddddddddd...',
]
const EYES_OPEN = ['.....e....e.....', '.....e....e.....']
const EYES_WIDE = ['....we...we.....', '....ee...ee.....']
const EYES_SHUT = ['................', '....ee...ee.....']

export type Face = 'open' | 'wide' | 'shut'

export function crabSprite(job: Job, face: Face): string {
  const eyes = face === 'wide' ? EYES_WIDE : face === 'shut' ? EYES_SHUT : EYES_OPEN
  const body = grid(BODY, 0, 0) + `<g class="eye">${grid(eyes, 0, 2)}</g>`
  const legs = [4, 6, 9, 11].map(x => `<rect class="lg" x="${x}" y="7" width="1" height="2" fill="${PAL.d}"/>`).join('')
  const claws =
    `<g class="cl">${grid(['oo.', 'ooo', 'dd.'], 0, 3)}</g>` +
    `<g class="cr">${grid(['.oo', 'ooo', '.dd'], 13, 3)}</g>`
  return legs + body + claws + outfit(job)
}

function outfit(job: Job): string {
  switch (job) {
    case 'lead':
      return grid(['....y.yy.yy.y...', '....yyyyyyyyy...', '....yryyyyyry...'], 0, -3) + grid(['..k', '..k', '..kk'], 0, 1)
    case 'research':
      return grid(['....bbbbbbbb....', '..bbbbbbbbbb....'], 0, -2) + grid(['....kkk..kkk....', '....k.kkkk.k....', '....kkk..kkk....'], 0, 1)
    case 'plan':
      return grid(['......kkkk......', '......kkkk......', '......kkkk......', '......rrrr......', '....kkkkkkkk....'], 0, -5) + grid(['.......rr.......', '.......rr.......'], 0, 4)
    case 'build':
      return grid(['.....yyyyyy.....', '...yyyyyyyyyy...'], 0, -2) + grid(['...YYYYYYYYYY...'], 0, 4)
    default:
      return grid(['........p.......', '....pppppppp....', '...pppppppppp...'], 0, -3) + grid(['...tttttttttt...'], 0, 5)
  }
}

export const QUESTION = grid(
  ['.ggggggg.', 'gwwwwwwwg', 'gwwooowwg', 'gwwwwwowg', 'gwwwwowwg', 'gwwwwwwwg', 'gwwwowwwg', '.ggggggg.', '..gg.....', '.g.......'],
  0,
  0,
)

export const MUG = grid(['www.', 'wwww', 'www.'], 0, 0)
