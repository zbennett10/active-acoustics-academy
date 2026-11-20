// Closed-form target strength for simple shapes, and a notional
// highlight model of a submarine-like body. Illustrative, from open literature only.

import { DEG, SOUND_SPEED } from './db'

export function sphereTsDb(radiusM: number): number {
  return 10 * Math.log10((radiusM * radiusM) / 4)
}

export function cylinderBroadsideTsDb(radiusM: number, lengthM: number, lambdaM: number): number {
  return 10 * Math.log10((radiusM * lengthM * lengthM) / (2 * lambdaM))
}

export function plateTsDb(areaM2: number, lambdaM: number): number {
  return 20 * Math.log10(areaM2 / lambdaM)
}

/** Forward scatter peak from Babinet's principle, set by projected area over wavelength. */
export function forwardScatterTsDb(projectedAreaM2: number, lambdaM: number): number {
  return 20 * Math.log10(projectedAreaM2 / lambdaM)
}

export interface TargetModel {
  lengthM: number
  radiusM: number
  coherentLengthM: number
  sailHeightM: number
  sailRadiusM: number
  floorDb: number
}

export const NOTIONAL_TARGET: TargetModel = {
  lengthM: 60,
  radiusM: 4,
  coherentLengthM: 15,
  sailHeightM: 6,
  sailRadiusM: 1.5,
  floorDb: 4,
}

function sinc2(x: number): number {
  if (Math.abs(x) < 1e-6) return 1
  const s = Math.sin(x) / x
  return s * s
}

interface Section {
  /** Axis rotation from the keel line, degrees. Tapered sections face slightly fore or aft. */
  phiDeg: number
  /** 0 reflects on both sides, 1 on the starboard face only, -1 on the port face only. */
  side: -1 | 0 | 1
  lengthM: number
  radiusM: number
}

const TAPERS: Section[] = [
  { phiDeg: -16, side: 1, lengthM: 7, radiusM: 3 },
  { phiDeg: 16, side: -1, lengthM: 7, radiusM: 3 },
  { phiDeg: 12, side: 1, lengthM: 9, radiusM: 3 },
  { phiDeg: -12, side: -1, lengthM: 9, radiusM: 3 },
]

/** Mirror-like return from one near-cylindrical hull section. */
function sectionSigma(sec: Section, ai: number, ao: number, k: number, lambda: number): number {
  const ni = Math.sin(ai)
  const no = Math.sin(ao)
  const visible = sec.side === 0 ? ni * no > 0 : sec.side * ni > 0 && sec.side * no > 0
  if (!visible) return 0
  const pi = ai - sec.phiDeg * DEG
  const po = ao - sec.phiDeg * DEG
  const axial = Math.cos(pi) + Math.cos(po)
  const amp = Math.abs(Math.sin(pi) * Math.sin(po))
  return ((sec.radiusM * sec.lengthM * sec.lengthM) / (2 * lambda)) * sinc2((k * sec.lengthM * axial) / 2) * amp
}

/** Cross-section (m^2) for one incident and one scattered direction in the target frame. */
function sigma(m: TargetModel, inDeg: number, outDeg: number, fKhz: number, deDeg: number): number {
  const lambda = SOUND_SPEED / (fKhz * 1000)
  const k = (2 * Math.PI) / lambda
  const ai = inDeg * DEG
  const ao = outDeg * DEG
  const axial = Math.cos(ai) + Math.cos(ao)
  const ni = Math.sin(ai)
  const no = Math.sin(ao)
  const cosDe = Math.cos(deDeg * DEG)

  let hull: number
  if (ni * no >= 0) {
    const mid = sectionSigma({ phiDeg: 0, side: 0, lengthM: m.coherentLengthM, radiusM: m.radiusM }, ai, ao, k, lambda)
    const tapers = TAPERS.reduce((acc, sec) => acc + sectionSigma(sec, ai, ao, k, lambda), 0)
    // Broad return from curved plating and structure, the wings of the butterfly.
    const broad = 80 * Math.pow(Math.abs(ni * no), 1.5)
    hull = mid + tapers + broad
  } else {
    const area = 2 * m.radiusM * m.lengthM * Math.sqrt(Math.abs(ni * no))
    hull = Math.pow(area / lambda, 2) * sinc2((k * m.lengthM * axial) / 2)
  }

  const bx = Math.cos(ai) + Math.cos(ao)
  const by = ni + no
  const bLen = Math.hypot(bx, by)
  const halfBeta = bLen > 1e-9 ? Math.acos(Math.min(1, bLen / 2)) : Math.PI / 2
  const shade = Math.cos(halfBeta)
  const bowness = bLen > 1e-9 ? bx / bLen : 0
  const caps =
    ((m.radiusM * m.radiusM) / 4) * (Math.pow(Math.max(0, bowness), 2) + 0.3 * Math.pow(Math.max(0, -bowness), 2))

  const sail =
    0.15 *
    ((m.sailRadiusM * m.sailHeightM * m.sailHeightM) / (2 * lambda)) *
    sinc2(k * m.sailHeightM * Math.sin(deDeg * DEG))

  const topArea = 0.12 * 2 * m.radiusM * m.coherentLengthM
  const top = Math.pow(topArea / lambda, 2) * Math.exp(-Math.pow((90 - Math.abs(deDeg)) / 6, 2))

  return hull * cosDe * cosDe + (caps + sail) * shade + top + Math.pow(10, m.floorDb / 10)
}

const SMOOTH = [-3, -2, -1, 0, 1, 2, 3]

/** Bistatic TS in dB. Aspects are bearings of source and receiver seen from the target, 0 = bow. */
export function bistaticTsDb(m: TargetModel, inAspectDeg: number, outAspectDeg: number, fKhz: number, deDeg = 0): number {
  const mean = SMOOTH.reduce((acc, d) => acc + sigma(m, inAspectDeg + d, outAspectDeg + d, fKhz, deDeg), 0) / SMOOTH.length
  return 10 * Math.log10(mean)
}

export function monostaticTsDb(m: TargetModel, aspectDeg: number, fKhz: number, deDeg = 0): number {
  return bistaticTsDb(m, aspectDeg, aspectDeg, fKhz, deDeg)
}

/** Bistatic angle between source and receiver directions at the target, 0..180. */
export function bistaticAngleFromAspects(inAspectDeg: number, outAspectDeg: number): number {
  const d = Math.abs(((outAspectDeg - inAspectDeg + 540) % 360) - 180)
  return d
}

export type KaRegime = 'Rayleigh' | 'Resonance' | 'Geometric'

export function kaRegime(ka: number): KaRegime {
  if (ka < 0.5) return 'Rayleigh'
  if (ka < 10) return 'Resonance'
  return 'Geometric'
}

/** Rigid sphere TS with a simple Rayleigh roll-off below ka = 1. */
export function sphereTsVsKaDb(radiusM: number, ka: number): number {
  const geo = (radiusM * radiusM) / 4
  const rayleigh = geo * (25 / 9) * Math.pow(ka, 4)
  return 10 * Math.log10(Math.min(geo, rayleigh))
}
