// Decibel arithmetic. Levels are power-like quantities in dB unless stated.

export const SOUND_SPEED = 1500 // m/s, nominal

export function toDb(powerRatio: number): number {
  return 10 * Math.log10(powerRatio)
}

export function fromDb(db: number): number {
  return Math.pow(10, db / 10)
}

export function pressureRatioToDb(ratio: number): number {
  return 20 * Math.log10(ratio)
}

export function powerSumDb(levels: readonly number[]): number {
  const total = levels.reduce((acc, l) => (Number.isFinite(l) ? acc + Math.pow(10, l / 10) : acc), 0)
  return total > 0 ? 10 * Math.log10(total) : -Infinity
}

/** Level of the remainder after removing a contributor from a total. */
export function powerDiffDb(total: number, part: number): number {
  const rest = Math.pow(10, total / 10) - Math.pow(10, part / 10)
  return rest > 0 ? 10 * Math.log10(rest) : -Infinity
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export const DEG = Math.PI / 180

export const KYD_M = 914.4
export const NMI_M = 1852
export const KNOT_MS = 0.514444
