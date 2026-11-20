// Waveform resolution, gain and the wideband ambiguity surface, computed with
// true Doppler time scaling so that FM Doppler tolerance shows up honestly.

import { SOUND_SPEED } from './db'

export type WaveformKind = 'cw' | 'lfm' | 'hfm'

export interface Waveform {
  kind: WaveformKind
  fcHz: number
  bandwidthHz: number
  durationS: number
}

export function effectiveBandwidthHz(w: Waveform): number {
  return w.kind === 'cw' ? 1 / w.durationS : w.bandwidthHz
}

export function rangeResolutionM(w: Waveform): number {
  return SOUND_SPEED / (2 * effectiveBandwidthHz(w))
}

export function dopplerResolutionHz(w: Waveform): number {
  return 1 / w.durationS
}

export function speedResolutionMs(w: Waveform): number {
  return SOUND_SPEED / (2 * w.fcHz * w.durationS)
}

export function timeBandwidth(w: Waveform): number {
  return Math.max(1, effectiveBandwidthHz(w) * w.durationS)
}

export function processingGainDb(w: Waveform): number {
  return 10 * Math.log10(timeBandwidth(w))
}

/** Monostatic Doppler shift for a closing speed in m/s. */
export function dopplerShiftHz(fcHz: number, closingMs: number): number {
  return (2 * closingMs * fcHz) / SOUND_SPEED
}

function phase(w: Waveform, t: number): number {
  const T = w.durationS
  if (w.kind === 'cw') return 2 * Math.PI * w.fcHz * t
  const f1 = w.fcHz - w.bandwidthHz / 2
  const f2 = w.fcHz + w.bandwidthHz / 2
  if (w.kind === 'lfm') return 2 * Math.PI * (f1 * t + (w.bandwidthHz / (2 * T)) * t * t)
  const kappa = (f2 - f1) / (f1 * f2 * T)
  return (-2 * Math.PI * Math.log(1 - kappa * f1 * t)) / kappa
}

/** |chi| in 0..1 for one delay (s) and closing speed (m/s). */
export function ambiguityAt(w: Waveform, delayS: number, closingMs: number): number {
  const T = w.durationS
  const eta = 1 + (2 * closingMs) / SOUND_SPEED
  const t0 = Math.max(0, delayS)
  const t1 = Math.min(T / eta, T + delayS)
  const len = t1 - t0
  if (len <= 0) return 0
  const fd = Math.abs(dopplerShiftHz(w.fcHz, closingMs))
  const band = (w.kind === 'cw' ? 0 : w.bandwidthHz) + fd + 2 / T
  const n = Math.min(4096, Math.max(48, Math.ceil(4 * band * len)))
  const dt = len / n
  let re = 0
  let im = 0
  for (let i = 0; i < n; i++) {
    const t = t0 + (i + 0.5) * dt
    const dphi = phase(w, eta * t) - phase(w, t - delayS)
    re += Math.cos(dphi)
    im += Math.sin(dphi)
  }
  return (Math.hypot(re, im) * dt) / T
}

export interface AmbiguitySurface {
  delaysS: number[]
  speedsMs: number[]
  /** Row-major, index iv * nd + id. */
  mag: Float32Array
}

export function ambiguitySurface(w: Waveform, maxDelayS: number, maxSpeedMs: number, nd = 81, nv = 41): AmbiguitySurface {
  const delaysS = Array.from({ length: nd }, (_, i) => -maxDelayS + (2 * maxDelayS * i) / (nd - 1))
  const speedsMs = Array.from({ length: nv }, (_, i) => -maxSpeedMs + (2 * maxSpeedMs * i) / (nv - 1))
  const mag = new Float32Array(nd * nv)
  speedsMs.forEach((v, iv) => {
    delaysS.forEach((d, id) => {
      mag[iv * nd + id] = ambiguityAt(w, d, v)
    })
  })
  return { delaysS, speedsMs, mag }
}

/** Best matched-filter output over delay for a target at a closing speed, in dB re a stationary target. */
export function dopplerLossDb(w: Waveform, closingMs: number): number {
  const span = w.kind === 'cw' ? 0 : w.durationS * 0.6
  const n = w.kind === 'cw' ? 1 : 121
  let best = 0
  for (let i = 0; i < n; i++) {
    const d = n === 1 ? 0 : -span + (2 * span * i) / (n - 1)
    best = Math.max(best, ambiguityAt(w, d, closingMs))
  }
  return 20 * Math.log10(Math.max(best, 1e-6))
}
