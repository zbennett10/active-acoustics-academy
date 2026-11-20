// Spectrum levels are dB re 1 uPa^2/Hz. Empirical fits, f in kHz.

import { powerSumDb } from './db'

export function shippingNoiseDb(fKhz: number, shipping: number): number {
  return 40 + 20 * (shipping - 0.5) + 26 * Math.log10(fKhz) - 60 * Math.log10(fKhz + 0.03)
}

export function windNoiseDb(fKhz: number, windMs: number): number {
  return 50 + 7.5 * Math.sqrt(windMs) + 20 * Math.log10(fKhz) - 40 * Math.log10(fKhz + 0.4)
}

export function thermalNoiseDb(fKhz: number): number {
  return -15 + 20 * Math.log10(fKhz)
}

export function turbulenceNoiseDb(fKhz: number): number {
  return 17 - 30 * Math.log10(fKhz)
}

/** Heavy rain adds a broad hump near 1 to 10 kHz. rate in mm/h. */
export function rainNoiseDb(fKhz: number, rateMmH: number): number {
  if (rateMmH <= 0) return -Infinity
  const peak = 51 + 15 * Math.log10(rateMmH)
  const x = Math.log10(fKhz / 3)
  return peak - 14 * x * x
}

export interface AmbientInputs {
  shipping: number // 0 light to 1 heavy
  windKn: number
  rainMmH: number
}

export interface AmbientBreakdown {
  shipping: number
  wind: number
  rain: number
  thermal: number
  turbulence: number
  total: number
}

export function ambientNoise(fKhz: number, a: AmbientInputs): AmbientBreakdown {
  const shipping = shippingNoiseDb(fKhz, a.shipping)
  const wind = windNoiseDb(fKhz, a.windKn * 0.514444)
  const rain = rainNoiseDb(fKhz, a.rainMmH)
  const thermal = thermalNoiseDb(fKhz)
  const turbulence = turbulenceNoiseDb(fKhz)
  return { shipping, wind, rain, thermal, turbulence, total: powerSumDb([shipping, wind, rain, thermal, turbulence]) }
}

/** Illustrative platform self noise spectrum level. Flow noise climbs steeply with speed. */
export function selfNoiseDb(fKhz: number, speedKn: number): number {
  const machinery = 42 - 12 * Math.log10(fKhz)
  const flow = 30 + 55 * Math.log10(Math.max(speedKn, 0.5) / 5) - 18 * Math.log10(fKhz)
  return powerSumDb([machinery, flow])
}

export function bandLevelDb(spectrumDb: number, bandwidthHz: number): number {
  return spectrumDb + 10 * Math.log10(Math.max(bandwidthHz, 1e-9))
}

export function integrateBandDb(spectrum: (fKhz: number) => number, f1Khz: number, f2Khz: number, n = 64): number {
  const df = (f2Khz - f1Khz) / n
  let sum = 0
  for (let i = 0; i < n; i++) {
    const f = f1Khz + (i + 0.5) * df
    sum += Math.pow(10, spectrum(f) / 10) * df * 1000
  }
  return 10 * Math.log10(Math.max(sum, 1e-30))
}

export interface Interferer {
  bearingDeg: number
  levelDb: number // received band level at the array, omni
}

/** Beam response to a source off the beam axis, a Gaussian main lobe over a sidelobe floor. */
export function beamGainDb(offAxisDeg: number, beamwidthDeg: number, sidelobeDb: number): number {
  const d = Math.abs(((offAxisDeg + 540) % 360) - 180)
  const u = d / (beamwidthDeg / 2)
  return Math.max(sidelobeDb, -3.0103 * u * u)
}

/** Noise at a beam output. Isotropic ambient reduced by DI, plus self noise, plus interferers through the pattern. */
export function beamNoiseDb(
  beamBearingDeg: number,
  ambientBandDb: number,
  diDb: number,
  selfBandDb: number,
  interferers: readonly Interferer[],
  beamwidthDeg: number,
  sidelobeDb: number,
): number {
  const fromShips = interferers.map(
    (s) => s.levelDb + beamGainDb(beamBearingDeg - s.bearingDeg, beamwidthDeg, sidelobeDb),
  )
  return powerSumDb([ambientBandDb - diDb, selfBandDb, ...fromShips])
}
