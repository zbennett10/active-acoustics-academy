// Incoherent transmission loss field from a dense ray fan. Each ray carries a
// Gaussian slice of energy in depth, the same idea as a Gaussian ray bundle.

import { DEG } from './db'
import { thorpDbPerKm } from './absorption'
import { marchRay, defaultStep } from './rays'
import { depthAt, type PreparedEnv } from './ssp'

export interface TlFieldOptions {
  zs: number
  freqKhz: number
  rMax: number // m
  nr?: number
  nz?: number
  nRays?: number
  fanDeg?: number
  /** Optional vertical beam, given as the centre and full width of the launch angles kept. */
  beam?: { steerDeg: number; widthDeg: number }
}

export interface TlField {
  nr: number
  nz: number
  rMax: number
  zMax: number
  /** Row-major, index iz * nr + ir. NaN below the seabed. */
  tl: Float32Array
}

const KERNEL_N = 48
const KERNEL_SPAN = 2.6
const KERNEL = Float64Array.from({ length: KERNEL_N + 1 }, (_, i) => {
  const x = (i / KERNEL_N) * KERNEL_SPAN
  return Math.exp(-0.5 * x * x)
})

export function computeTlField(p: PreparedEnv, o: TlFieldOptions): TlField {
  const nr = o.nr ?? 260
  const nz = o.nz ?? 160
  const nRays = o.nRays ?? 1100
  const fan = o.fanDeg ?? 50
  const zMax = p.zMax
  const dr = o.rMax / nr
  const dz = zMax / nz
  const alpha = thorpDbPerKm(o.freqKhz) / 1000
  const intensity = new Float64Array(nr * nz)
  const dTheta = ((2 * fan) / (nRays - 1)) * DEG
  const ds = defaultStep(p, o.rMax)
  const zbCol = Float64Array.from({ length: nr }, (_, i) => depthAt(p, (i + 0.5) * dr))

  for (let k = 0; k < nRays; k++) {
    const a0 = -fan + (2 * fan * k) / (nRays - 1)
    let weight = 1
    if (o.beam) {
      const u = (a0 - o.beam.steerDeg) / (o.beam.widthDeg / 2)
      weight = Math.exp(-0.5 * u * u * 1.386)
      if (weight < 1e-4) continue
    }
    const launch = Math.cos(a0 * DEG) * dTheta * weight
    let nextBin = 0
    marchRay(p, o.zs, a0, o.rMax, { ds, freqKhz: o.freqKhz, maxLossDb: 70 }, (s) => {
      while (nextBin < nr && (nextBin + 0.5) * dr <= s.r) {
        const rc = (nextBin + 0.5) * dr
        const span = s.r - s.rPrev
        const f = span > 1e-9 ? (rc - s.rPrev) / span : 0
        const z = s.zPrev + f * (s.z - s.zPrev)
        const cosT = Math.max(0.05, Math.cos(s.theta))
        const energy = (launch / (rc * cosT)) * Math.pow(10, -(s.lossDb + alpha * s.s) / 10)
        const sigma = Math.min(zMax / 6, Math.max(0.8 * dz, (0.75 * s.s * dTheta) / cosT))
        const zb = zbCol[nextBin]
        const half = Math.ceil((KERNEL_SPAN * sigma) / dz)
        const j0 = Math.floor(z / dz)
        const norm = energy / (sigma * 2.5066283)
        for (let j = j0 - half; j <= j0 + half; j++) {
          let zc = (j + 0.5) * dz
          const u = Math.abs(zc - z) / sigma
          if (u > KERNEL_SPAN) continue
          if (zc < 0) zc = -zc
          if (zc > zb) zc = 2 * zb - zc
          if (zc < 0) continue
          const jj = Math.min(nz - 1, Math.floor(zc / dz))
          intensity[jj * nr + nextBin] += norm * KERNEL[Math.round((u / KERNEL_SPAN) * KERNEL_N)]
        }
        nextBin++
      }
    })
  }

  const tl = new Float32Array(nr * nz)
  for (let j = 0; j < nz; j++) {
    const zc = (j + 0.5) * dz
    for (let i = 0; i < nr; i++) {
      const idx = j * nr + i
      tl[idx] = zc > zbCol[i] ? NaN : Math.min(160, -10 * Math.log10(Math.max(intensity[idx], 1e-16)))
    }
  }
  return { nr, nz, rMax: o.rMax, zMax, tl }
}

export function tlSlice(field: TlField, depth: number): { rangeM: number[]; tl: number[] } {
  const j = Math.min(field.nz - 1, Math.max(0, Math.floor((depth / field.zMax) * field.nz)))
  const dr = field.rMax / field.nr
  const rangeM = Array.from({ length: field.nr }, (_, i) => (i + 0.5) * dr)
  const tl = rangeM.map((_, i) => field.tl[j * field.nr + i])
  return { rangeM, tl }
}

export function tlAt(field: TlField, rangeM: number, depth: number): number {
  const i = Math.min(field.nr - 1, Math.max(0, Math.floor((rangeM / field.rMax) * field.nr)))
  const j = Math.min(field.nz - 1, Math.max(0, Math.floor((depth / field.zMax) * field.nz)))
  return field.tl[j * field.nr + i]
}
