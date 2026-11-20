// Teaching ray engine. Marches rays through a depth-dependent sound speed
// profile over piecewise-linear bathymetry. Angles are positive downward.

import { DEG } from './db'
import { bottomLossDb, surfaceLossDb, type PreparedEnv } from './ssp'

export interface MarchOptions {
  ds: number // arc-length step, m
  freqKhz: number
  maxLossDb?: number
  maxSteps?: number
}

/** Mutable march state, reused per step to keep the inner loop allocation-free. */
export interface RayState {
  r: number
  z: number
  theta: number
  t: number
  s: number
  lossDb: number
  nSurf: number
  nBot: number
  nUpper: number
  nLower: number
  rPrev: number
  zPrev: number
  thetaPrev: number
}

export function marchRay(
  p: PreparedEnv,
  zs: number,
  angleDeg: number,
  rMax: number,
  opts: MarchOptions,
  onStep: (s: RayState) => void,
): RayState {
  const { cTab, gTab, dzTab, zMax, bathyR, bathyZ } = p
  const nTab = cTab.length - 2
  const maxLoss = opts.maxLossDb ?? 90
  const maxSteps = opts.maxSteps ?? 200000
  const ds = opts.ds
  const nB = bathyR.length
  const st: RayState = {
    r: 0,
    z: zs,
    theta: angleDeg * DEG,
    t: 0,
    s: 0,
    lossDb: 0,
    nSurf: 0,
    nBot: 0,
    nUpper: 0,
    nLower: 0,
    rPrev: 0,
    zPrev: zs,
    thetaPrev: angleDeg * DEG,
  }
  let seg = 1
  let steps = 0
  const limit = Math.PI / 2 - 0.01

  while (st.r < rMax && steps < maxSteps && st.lossDb < maxLoss) {
    steps++
    st.rPrev = st.r
    st.zPrev = st.z
    st.thetaPrev = st.theta

    const th = st.theta
    let x = Math.min(Math.max(st.z, 0), zMax) / dzTab
    let i = Math.min(nTab, Math.floor(x))
    const c0 = cTab[i] + (cTab[i + 1] - cTab[i]) * (x - i)
    const dth = (-Math.cos(th) * gTab[i]) / c0
    const zm = st.z + 0.5 * ds * Math.sin(th)
    const thm = th + 0.5 * ds * dth
    x = Math.min(Math.max(zm, 0), zMax) / dzTab
    i = Math.min(nTab, Math.floor(x))
    const cm = cTab[i] + (cTab[i + 1] - cTab[i]) * (x - i)

    st.r += ds * Math.cos(thm)
    st.z += ds * Math.sin(thm)
    let thNew = th + (ds * -Math.cos(thm) * gTab[i]) / cm
    st.t += ds / cm
    st.s += ds

    if (th > 0 && thNew <= 0) st.nLower++
    else if (th < 0 && thNew >= 0) st.nUpper++

    if (st.z < 0) {
      st.z = -st.z
      thNew = -thNew
      st.nSurf++
      st.lossDb += surfaceLossDb(p.env.windKn, opts.freqKhz, thNew)
    }

    while (seg < nB - 1 && bathyR[seg] < st.r) seg++
    const r0 = bathyR[seg - 1]
    const r1 = bathyR[seg]
    const slope = st.r >= r1 || st.r <= r0 ? 0 : (bathyZ[seg] - bathyZ[seg - 1]) / (r1 - r0)
    const zb = st.r >= r1 ? bathyZ[seg] : bathyZ[seg - 1] + slope * (st.r - r0)
    if (st.z > zb) {
      const alpha = Math.atan(slope)
      st.lossDb += bottomLossDb(p.env.bottom, thNew - alpha)
      st.z = Math.max(0, 2 * zb - st.z)
      thNew = 2 * alpha - thNew
      st.nBot++
    }

    st.theta = thNew
    if (Math.abs(thNew) >= limit) {
      onStep(st)
      break
    }
    onStep(st)
  }
  return st
}

export type RayKind = 'direct' | 'refracted' | 'surface' | 'bottom'

export interface RayPath {
  angleDeg: number
  r: Float32Array
  z: Float32Array
  n: number
  kind: RayKind
  nSurf: number
  nBot: number
  nUpper: number
  nLower: number
  lossDb: number
}

export function classifyRay(nSurf: number, nBot: number, nTurn: number): RayKind {
  if (nBot > 0) return 'bottom'
  if (nSurf > 0) return 'surface'
  if (nTurn > 0) return 'refracted'
  return 'direct'
}

export function defaultStep(p: PreparedEnv, rMax: number): number {
  return Math.max(2, Math.min(p.zMax / 60, rMax / 1500, 80))
}

export function traceRay(p: PreparedEnv, zs: number, angleDeg: number, rMax: number, freqKhz = 3.5): RayPath {
  const ds = defaultStep(p, rMax)
  const cap = Math.ceil((rMax / ds) * 6) + 8
  const rs = new Float32Array(cap)
  const zsArr = new Float32Array(cap)
  let n = 1
  rs[0] = 0
  zsArr[0] = zs
  const end = marchRay(p, zs, angleDeg, rMax, { ds, freqKhz, maxLossDb: 60, maxSteps: cap - 2 }, (s) => {
    rs[n] = s.r
    zsArr[n] = s.z
    n++
  })
  return {
    angleDeg,
    r: rs,
    z: zsArr,
    n,
    kind: classifyRay(end.nSurf, end.nBot, end.nUpper + end.nLower),
    nSurf: end.nSurf,
    nBot: end.nBot,
    nUpper: end.nUpper,
    nLower: end.nLower,
    lossDb: end.lossDb,
  }
}

export function traceFan(
  p: PreparedEnv,
  zs: number,
  minDeg: number,
  maxDeg: number,
  count: number,
  rMax: number,
  freqKhz = 3.5,
): RayPath[] {
  const n = Math.max(1, count)
  return Array.from({ length: n }, (_, i) => {
    const a = n === 1 ? (minDeg + maxDeg) / 2 : minDeg + ((maxDeg - minDeg) * i) / (n - 1)
    return traceRay(p, zs, a, rMax, freqKhz)
  })
}
