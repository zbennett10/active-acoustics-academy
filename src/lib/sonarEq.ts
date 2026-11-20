import { powerSumDb } from './db'
import { podFromSe } from './detection'

export interface ActiveBudget {
  slDb: number
  tlOutDb: number
  tlBackDb: number
  tsDb: number
  /** Noise at the beam output in the processor band. */
  beamNoiseDb: number
  /** Reverberation at the beam output in the processor band. */
  reverbDb: number
  /** Detection threshold, with processing gain already booked in it. */
  dtDb: number
}

export interface BudgetResult {
  echoDb: number
  maskingDb: number
  snrDb: number
  seDb: number
  limitedBy: 'noise' | 'reverb'
  pod: number
}

export function echoLevel(b: Pick<ActiveBudget, 'slDb' | 'tlOutDb' | 'tlBackDb' | 'tsDb'>): number {
  return b.slDb - b.tlOutDb - b.tlBackDb + b.tsDb
}

export function solveBudget(b: ActiveBudget, sigmaDb = 8): BudgetResult {
  const echoDb = echoLevel(b)
  const maskingDb = powerSumDb([b.beamNoiseDb, b.reverbDb])
  const snrDb = echoDb - maskingDb
  const seDb = snrDb - b.dtDb
  return {
    echoDb,
    maskingDb,
    snrDb,
    seDb,
    limitedBy: b.reverbDb > b.beamNoiseDb ? 'reverb' : 'noise',
    pod: podFromSe(seDb, sigmaDb),
  }
}

/** Noise-limited figure of merit, the two-way loss that leaves zero signal excess. */
export function figureOfMeritDb(slDb: number, tsDb: number, beamNoiseDb: number, dtDb: number): number {
  return slDb + tsDb - beamNoiseDb - dtDb
}

/** Ranges where a signal-excess curve crosses zero, by linear interpolation. */
export function zeroCrossings(x: readonly number[], se: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < x.length; i++) {
    const a = se[i - 1]
    const b = se[i]
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) out.push(x[i - 1] + ((0 - a) / (b - a)) * (x[i] - x[i - 1]))
  }
  return out
}

/** Contiguous spans where signal excess is at or above zero. */
export function detectionSpans(x: readonly number[], se: readonly number[]): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  let start: number | null = null
  for (let i = 0; i < x.length; i++) {
    const ok = Number.isFinite(se[i]) && se[i] >= 0
    if (ok && start === null) start = x[i]
    if (!ok && start !== null) {
      spans.push([start, x[i - 1]])
      start = null
    }
  }
  if (start !== null) spans.push([start, x[x.length - 1]])
  return spans
}
