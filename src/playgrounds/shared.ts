// Cached propagation results shared by the playgrounds that build on a loss curve.

import { simpleTlDb } from '../lib/absorption'
import { getEnvironment, prepareEnv } from '../lib/ssp'
import { NOTIONAL_TARGET, bistaticTsDb } from '../lib/target'
import { computeTlField, tlSlice, type TlField } from '../lib/tlfield'

const cache = new Map<string, TlField>()
const LIMIT = 14

export function getField(envId: string, zs: number, freqKhz: number): TlField {
  const key = `${envId}|${zs}|${freqKhz}`
  const hit = cache.get(key)
  if (hit) return hit
  const env = getEnvironment(envId)
  const prep = prepareEnv(env)
  const field = computeTlField(prep, {
    zs: Math.min(zs, prep.zMax - 5),
    freqKhz,
    rMax: env.rMaxKm * 1000,
    nr: 260,
    nz: 180,
    nRays: 900,
    fanDeg: prep.zMax < 500 ? 70 : 50,
  })
  if (cache.size >= LIMIT) cache.delete(cache.keys().next().value as string)
  cache.set(key, field)
  return field
}

export interface LossCurve {
  xsKm: number[]
  tl: number[]
  rMaxKm: number
}

export const SIMPLE = 'simple'

/** Deep water is worked at a lower frequency, where absorption leaves the long paths intact. */
export function defaultFreq(envId: string): number {
  return envId === 'deep-cz' || envId === 'bottom-limited' ? 1.5 : 3.5
}

/** One-way loss against range for a named environment, or plain spherical spreading. */
export function lossCurve(envId: string, zs: number, zt: number, freqKhz: number): LossCurve {
  if (envId === SIMPLE) {
    const rMaxKm = 40
    const xsKm = Array.from({ length: 200 }, (_v, i) => 0.2 + (i * (rMaxKm - 0.2)) / 199)
    return { xsKm, tl: xsKm.map((x) => simpleTlDb(x * 1000, freqKhz, 'spherical')), rMaxKm }
  }
  const field = getField(envId, zs, freqKhz)
  const slice = tlSlice(field, Math.min(zt, field.zMax - 1))
  return { xsKm: slice.rangeM.map((r) => r / 1000), tl: smooth(slice.tl), rMaxKm: field.rMax / 1000 }
}

/** Three-point running mean, to calm bin-to-bin jitter in a ray-binned curve. */
export function smooth(values: readonly number[]): number[] {
  return values.map((v, i) => {
    const a = values[Math.max(0, i - 1)]
    const b = values[Math.min(values.length - 1, i + 1)]
    const set = [a, v, b].filter((x) => Number.isFinite(x))
    return set.length ? set.reduce((s, x) => s + x, 0) / set.length : v
  })
}

export const PROP_OPTIONS = [
  { value: SIMPLE, label: 'Spherical spreading' },
  { value: 'surface-duct', label: 'Surface duct' },
  { value: 'deep-cz', label: 'Deep, convergence zone' },
  { value: 'bottom-limited', label: 'Bottom limited' },
  { value: 'shallow-summer', label: 'Shallow, summer' },
  { value: 'shallow-winter', label: 'Shallow, winter' },
]


const TS_STEP = 5
const TS_N = 360 / TS_STEP
const tsTables = new Map<number, Float32Array>()

/** Bistatic target strength from a 5 degree lookup table, for plan-view maps. */
export function fastBistaticTs(inAspectDeg: number, outAspectDeg: number, freqKhz = 3.5): number {
  let table = tsTables.get(freqKhz)
  if (!table) {
    table = new Float32Array(TS_N * TS_N)
    for (let j = 0; j < TS_N; j++) for (let i = 0; i < TS_N; i++) table[j * TS_N + i] = bistaticTsDb(NOTIONAL_TARGET, i * TS_STEP, j * TS_STEP, freqKhz)
    tsTables.set(freqKhz, table)
  }
  const i = Math.round((((inAspectDeg % 360) + 360) % 360) / TS_STEP) % TS_N
  const j = Math.round((((outAspectDeg % 360) + 360) % 360) / TS_STEP) % TS_N
  return table[j * TS_N + i]
}
