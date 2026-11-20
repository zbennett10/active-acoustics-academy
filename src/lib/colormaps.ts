import { rgb } from 'd3-color'
import {
  interpolateCividis,
  interpolateGreys,
  interpolateInferno,
  interpolateMagma,
  interpolateTurbo,
  interpolateViridis,
} from 'd3-scale-chromatic'

export type ColormapId = 'abyss' | 'diverging' | 'viridis' | 'magma' | 'inferno' | 'cividis' | 'turbo' | 'jet' | 'greys' | 'stoplight'

export interface Colormap {
  id: ColormapId
  name: string
  note: string
  /** 256 RGB triples. */
  lut: Uint8ClampedArray
}

const N = 256

function fromInterpolator(fn: (t: number) => string): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(N * 3)
  for (let i = 0; i < N; i++) {
    const c = rgb(fn(i / (N - 1)))
    lut[i * 3] = c.r
    lut[i * 3 + 1] = c.g
    lut[i * 3 + 2] = c.b
  }
  return lut
}

function fromStops(stops: ReadonlyArray<[number, string]>, stepped = false): Uint8ClampedArray {
  const parsed = stops.map(([t, hex]) => ({ t, c: rgb(hex) }))
  return fromInterpolator((t) => {
    let i = 1
    while (i < parsed.length - 1 && parsed[i].t < t) i++
    const a = parsed[i - 1]
    const b = parsed[i]
    if (stepped) return (t < b.t ? a.c : b.c).formatHex()
    const f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)))
    return rgb(a.c.r + (b.c.r - a.c.r) * f, a.c.g + (b.c.g - a.c.g) * f, a.c.b + (b.c.b - a.c.b) * f).formatHex()
  })
}

const ABYSS: ReadonlyArray<[number, string]> = [
  [0, '#050d18'],
  [0.2, '#0b2c47'],
  [0.42, '#0e5f78'],
  [0.62, '#17a39a'],
  [0.82, '#8fe0b4'],
  [1, '#f6f3cf'],
]

// Two hues meeting at a neutral dark midpoint, for quantities with a meaningful zero.
const DIVERGING: ReadonlyArray<[number, string]> = [
  [0, '#f4a3a3'],
  [0.25, '#b9403f'],
  [0.5, '#2b2f33'],
  [0.75, '#2a6fc4'],
  [1, '#a9cdf6'],
]

const JET: ReadonlyArray<[number, string]> = [
  [0, '#00007f'],
  [0.125, '#0000ff'],
  [0.375, '#00ffff'],
  [0.625, '#ffff00'],
  [0.875, '#ff0000'],
  [1, '#7f0000'],
]

const STOPLIGHT: ReadonlyArray<[number, string]> = [
  [0, '#7a1f1f'],
  [0.5, '#c98500'],
  [0.75, '#199e70'],
  [1, '#199e70'],
]

export const COLORMAPS: Record<ColormapId, Colormap> = {
  abyss: { id: 'abyss', name: 'Abyss', note: 'Sequential, dark to light. The house default.', lut: fromStops(ABYSS) },
  diverging: { id: 'diverging', name: 'Diverging', note: 'Red below, blue above, neutral at the middle. For signal excess around zero.', lut: fromStops(DIVERGING) },
  viridis: { id: 'viridis', name: 'Viridis', note: 'Perceptually uniform and colorblind safe.', lut: fromInterpolator(interpolateViridis) },
  magma: { id: 'magma', name: 'Magma', note: 'Perceptually uniform, strong at the bright end.', lut: fromInterpolator(interpolateMagma) },
  inferno: { id: 'inferno', name: 'Inferno', note: 'Perceptually uniform with high contrast.', lut: fromInterpolator(interpolateInferno) },
  cividis: { id: 'cividis', name: 'Cividis', note: 'Built for color vision deficiency.', lut: fromInterpolator(interpolateCividis) },
  turbo: { id: 'turbo', name: 'Turbo', note: 'A smoother rainbow. Still invents edges.', lut: fromInterpolator(interpolateTurbo) },
  jet: { id: 'jet', name: 'Jet', note: 'Legacy rainbow. Bands at cyan and yellow are artifacts.', lut: fromStops(JET) },
  greys: { id: 'greys', name: 'Greys', note: 'Luminance only. Honest but low contrast.', lut: fromInterpolator((t) => interpolateGreys(1 - t)) },
  stoplight: { id: 'stoplight', name: 'Stoplight', note: 'Three classes. Hides everything inside a class.', lut: fromStops(STOPLIGHT, true) },
}

/** Paints a scalar field into RGBA pixels. NaN draws as the given seabed color. */
export function paintField(
  values: Float32Array,
  out: Uint8ClampedArray,
  lo: number,
  hi: number,
  lut: Uint8ClampedArray,
  invert = false,
  nan: readonly [number, number, number] = [38, 32, 26],
): void {
  const span = hi - lo || 1
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    const o = i * 4
    if (Number.isNaN(v)) {
      out[o] = nan[0]
      out[o + 1] = nan[1]
      out[o + 2] = nan[2]
      out[o + 3] = 255
      continue
    }
    let t = (v - lo) / span
    if (invert) t = 1 - t
    const k = Math.min(N - 1, Math.max(0, Math.round(t * (N - 1)))) * 3
    out[o] = lut[k]
    out[o + 1] = lut[k + 1]
    out[o + 2] = lut[k + 2]
    out[o + 3] = 255
  }
}

export function cssGradient(map: Colormap, invert = false): string {
  const stops = Array.from({ length: 12 }, (_, i) => {
    const t = i / 11
    const k = Math.round((invert ? 1 - t : t) * (N - 1)) * 3
    return `rgb(${map.lut[k]} ${map.lut[k + 1]} ${map.lut[k + 2]}) ${(t * 100).toFixed(0)}%`
  })
  return `linear-gradient(to right, ${stops.join(', ')})`
}
