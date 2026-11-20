// Canvas colors that mirror the CSS tokens, since canvas cannot read custom properties cheaply.

export const C = {
  bg: '#040a11',
  panel: '#07111b',
  grid: 'rgba(140,190,225,0.09)',
  axis: '#2a4a63',
  ink: '#e8f0f6',
  ink2: '#a8bccb',
  ink3: '#6c8598',
  ink4: '#45596a',
  accent: '#45e0c8',
  amber: '#ffb454',
  blue: '#3987e5',
  orange: '#d95926',
  aqua: '#199e70',
  yellow: '#c98500',
  magenta: '#d55181',
  violet: '#9085e9',
  good: '#0ca30c',
  critical: '#d03b3b',
  seabed: '#2b2118',
  seabedLine: '#8a6a44',
  water: '#06131f',
} as const

// One color per sonar quantity, used by every playground.
export const Q = {
  source: C.blue,
  echo: C.orange,
  se: C.aqua,
  dt: C.yellow,
  reverb: C.magenta,
  noise: C.violet,
} as const

export const RAY_COLORS = {
  direct: '#45e0c8',
  refracted: '#5fa2f2',
  surface: '#e2b23c',
  bottom: '#e0703f',
} as const

export const FONT_MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace"
export const FONT_DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif"
export const FONT_BODY = "'IBM Plex Sans', system-ui, sans-serif"
