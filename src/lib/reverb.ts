// Scattering strengths and a transparent level-versus-time reverberation model
// for a monostatic sonar. Enough to show the trends, not a validated engine.

import { DEG, SOUND_SPEED, powerSumDb } from './db'
import { thorpDbPerKm } from './absorption'
import { createRng } from './rng'

/** Lambert's law. muDb is 10 log mu, about -27 dB for the classic Mackenzie value. */
export function lambertDb(muDb: number, grazingInDeg: number, grazingOutDeg = grazingInDeg): number {
  const s = Math.sin(Math.max(grazingInDeg, 0.01) * DEG) * Math.sin(Math.max(grazingOutDeg, 0.01) * DEG)
  return muDb + 10 * Math.log10(s)
}

/** Chapman and Harris (1962) surface scattering strength. wind in knots, f in Hz, grazing in degrees. */
export function chapmanHarrisDb(windKn: number, fHz: number, grazingDeg: number): number {
  const v = Math.max(windKn, 0.5)
  const beta = 158 * Math.pow(v * Math.cbrt(fHz), -0.58)
  return 3.3 * beta * Math.log10(Math.max(grazingDeg, 0.5) / 30) - 42.4 * Math.log10(beta) + 2.6
}

export interface ReverbInputs {
  slDb: number
  fKhz: number
  /** Effective pulse length in seconds, tau for CW and 1/B for a matched-filtered FM pulse. */
  tauEff: number
  horizBeamDeg: number
  vertBeamDeg: number
  sourceDepth: number
  waterDepth: number
  muDb: number
  windKn: number
  svDb: number
  /** Floor on grazing angle at long range, standing in for multipath arrivals. */
  ductGrazingDeg: number
}

export interface ReverbPoint {
  timeS: number
  rangeM: number
  bottom: number
  surface: number
  volume: number
  total: number
}

function twoWayTl(rangeM: number, fKhz: number): number {
  return 2 * (20 * Math.log10(Math.max(rangeM, 1)) + (thorpDbPerKm(fKhz) * rangeM) / 1000)
}

function boundaryLevel(p: ReverbInputs, rangeM: number, height: number, strength: (grazDeg: number) => number): number {
  if (rangeM <= height) return -Infinity
  const graz = Math.max(Math.asin(height / rangeM) / DEG, p.ductGrazingDeg)
  const area = ((SOUND_SPEED * p.tauEff) / 2) * (p.horizBeamDeg * DEG) * rangeM
  return p.slDb - twoWayTl(rangeM, p.fKhz) + strength(graz) + 10 * Math.log10(area)
}

export function reverbAtRange(p: ReverbInputs, rangeM: number): ReverbPoint {
  const bottom = boundaryLevel(p, rangeM, p.waterDepth - p.sourceDepth, (g) => lambertDb(p.muDb, g))
  const surface = boundaryLevel(p, rangeM, p.sourceDepth, (g) => chapmanHarrisDb(p.windKn, p.fKhz * 1000, g))
  const solid = p.horizBeamDeg * DEG * p.vertBeamDeg * DEG
  const volumeCell = ((SOUND_SPEED * p.tauEff) / 2) * solid * rangeM * rangeM
  const volume = p.slDb - twoWayTl(rangeM, p.fKhz) + p.svDb + 10 * Math.log10(volumeCell)
  return {
    timeS: (2 * rangeM) / SOUND_SPEED,
    rangeM,
    bottom,
    surface,
    volume,
    total: powerSumDb([bottom, surface, volume]),
  }
}

export function reverbCurve(p: ReverbInputs, rangesM: readonly number[]): ReverbPoint[] {
  return rangesM.map((r) => reverbAtRange(p, r))
}

/** Echo level from a target at a range, same simple two-way loss. */
export function echoLevelDb(slDb: number, tsDb: number, rangeM: number, fKhz: number): number {
  return slDb - twoWayTl(rangeM, fKhz) + tsDb
}

export interface MeasuredReverb {
  rangesM: number[]
  levelDb: number[]
}

/** Synthetic "measured" reverb from a hidden true environment, with pulse-to-pulse scatter and a few clutter spikes. */
export function synthesizeMeasured(
  truth: ReverbInputs,
  rangesM: readonly number[],
  noiseFloorDb: number,
  seed: number,
): MeasuredReverb {
  const rng = createRng(seed)
  const clutter = Array.from({ length: 3 }, () => ({ at: rng.int(8, rangesM.length - 8), gain: 6 + rng.next() * 6 }))
  const levelDb = rangesM.map((r, i) => {
    const base = powerSumDb([reverbAtRange(truth, r).total, noiseFloorDb])
    const spike = clutter.reduce((acc, c) => acc + c.gain * Math.exp(-Math.pow((i - c.at) / 1.2, 2)), 0)
    return base + spike + rng.gauss() * 1.6
  })
  return { rangesM: [...rangesM], levelDb }
}

/** Least-squares offset (dB) that best lines a model curve up with a measurement. */
export function calibrationOffsetDb(modelDb: readonly number[], measuredDb: readonly number[]): number {
  const pairs = modelDb.map((m, i) => measuredDb[i] - m).filter((d) => Number.isFinite(d))
  if (pairs.length === 0) return 0
  const sorted = [...pairs].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
