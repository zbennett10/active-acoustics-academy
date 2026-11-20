// Angles are measured from broadside, in degrees.

import { DEG } from './db'

export type Shading = 'uniform' | 'hann' | 'hamming' | 'chebyshev'

export interface ArraySpec {
  n: number
  dOverLambda: number
  steerDeg: number
  shading: Shading
}

export function shadingWeights(n: number, kind: Shading): number[] {
  return Array.from({ length: n }, (_, i) => {
    const x = n === 1 ? 0.5 : i / (n - 1)
    switch (kind) {
      case 'uniform':
        return 1
      case 'hann':
        return 0.5 - 0.5 * Math.cos(2 * Math.PI * ((i + 1) / (n + 1)))
      case 'hamming':
        return 0.54 - 0.46 * Math.cos(2 * Math.PI * x)
      case 'chebyshev':
        // A raised cosine on a pedestal, a close stand-in for a 30 dB Dolph taper.
        return 0.32 + 0.68 * Math.pow(Math.sin(Math.PI * x), 2)
    }
  })
}

/** Normalised power response (0..1) toward angle thetaDeg. */
export function beamPower(spec: ArraySpec, thetaDeg: number, weights: readonly number[]): number {
  const psi = 2 * Math.PI * spec.dOverLambda * (Math.sin(thetaDeg * DEG) - Math.sin(spec.steerDeg * DEG))
  let re = 0
  let im = 0
  let sum = 0
  for (let i = 0; i < weights.length; i++) {
    re += weights[i] * Math.cos(i * psi)
    im += weights[i] * Math.sin(i * psi)
    sum += weights[i]
  }
  return (re * re + im * im) / (sum * sum)
}

export interface PatternSweep {
  thetaDeg: number[]
  db: number[]
}

export function patternSweep(spec: ArraySpec, nAngles = 721, floorDb = -60): PatternSweep {
  const w = shadingWeights(spec.n, spec.shading)
  const thetaDeg = Array.from({ length: nAngles }, (_, i) => -90 + (180 * i) / (nAngles - 1))
  const db = thetaDeg.map((t) => Math.max(floorDb, 10 * Math.log10(Math.max(beamPower(spec, t, w), 1e-12))))
  return { thetaDeg, db }
}

/** DI of a line array, 10 log(2 / integral of B(theta) cos(theta) d theta). */
export function directivityIndexDb(spec: ArraySpec): number {
  const w = shadingWeights(spec.n, spec.shading)
  const n = 2000
  const dTheta = Math.PI / n
  let integral = 0
  for (let i = 0; i < n; i++) {
    const t = -Math.PI / 2 + (i + 0.5) * dTheta
    integral += beamPower(spec, t / DEG, w) * Math.cos(t) * dTheta
  }
  return 10 * Math.log10(2 / integral)
}

/** Full width of the main lobe at half power, degrees. */
export function halfPowerWidthDeg(spec: ArraySpec): number {
  const w = shadingWeights(spec.n, spec.shading)
  const edge = (dir: 1 | -1): number => {
    let t = spec.steerDeg
    while (Math.abs(t) < 90 && beamPower(spec, t, w) > 0.5) t += dir * 0.02
    return t
  }
  return edge(1) - edge(-1)
}

/** Grating lobes appear once spacing exceeds lambda / (1 + |sin steer|). */
export function hasGratingLobe(spec: ArraySpec): boolean {
  return spec.dOverLambda > 1 / (1 + Math.abs(Math.sin(spec.steerDeg * DEG))) + 1e-9
}

export function peakSidelobeDb(spec: ArraySpec): number {
  const { thetaDeg, db } = patternSweep(spec, 1441, -80)
  const steerIdx = thetaDeg.reduce((best, t, i) => (Math.abs(t - spec.steerDeg) < Math.abs(thetaDeg[best] - spec.steerDeg) ? i : best), 0)
  let lo = steerIdx
  while (lo > 0 && db[lo - 1] < db[lo]) lo--
  let hi = steerIdx
  while (hi < db.length - 1 && db[hi + 1] < db[hi]) hi++
  let peak = -80
  for (let i = 0; i < db.length; i++) if ((i < lo || i > hi) && db[i] > peak) peak = db[i]
  return peak
}

export function continuousLineDiDb(lengthOverLambda: number): number {
  return 10 * Math.log10(Math.max(2 * lengthOverLambda, 1))
}
