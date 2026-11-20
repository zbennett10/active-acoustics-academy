// Eigenrays are the discrete paths that connect a source to one field point.
// Found by bracketing the target depth between adjacent rays of one family.

import { DEG } from './db'
import { thorpDbPerKm } from './absorption'
import { marchRay, defaultStep } from './rays'
import type { PreparedEnv } from './ssp'

export type PathType = 'Direct' | 'Surface reflected' | 'Refracted' | 'Surface duct' | 'Bottom bounce'

export interface Eigenray {
  launchDeg: number // positive down
  arrivalDeg: number // positive down, direction of travel at the receiver
  timeS: number
  nSurf: number
  nBot: number
  nTurn: number
  boundaryLossDb: number
  spreadingDb: number
  absorptionDb: number
  tlDb: number
  pathType: PathType
  label: string
}

interface Crossing {
  ok: boolean
  z: number
  theta: number
  t: number
  s: number
  loss: number
  key: string
  nSurf: number
  nBot: number
  nTurn: number
}

export interface EigenrayOptions {
  freqKhz: number
  fanDeg?: number
  nRays?: number
}

function pathType(nSurf: number, nBot: number, nTurn: number): PathType {
  if (nBot > 0) return 'Bottom bounce'
  if (nSurf > 0 && nTurn > 0) return 'Surface duct'
  if (nSurf > 0) return 'Surface reflected'
  if (nTurn > 0) return 'Refracted'
  return 'Direct'
}

function label(nSurf: number, nBot: number, nTurn: number): string {
  const kind = pathType(nSurf, nBot, nTurn)
  if (kind === 'Direct') return 'Direct path'
  const parts = [nSurf ? `${nSurf}S` : '', nBot ? `${nBot}B` : '', nTurn ? `${nTurn}T` : ''].filter(Boolean)
  return `${kind} (${parts.join(' ')})`
}

export function findEigenrays(
  p: PreparedEnv,
  zs: number,
  targetRangeM: number,
  targetDepth: number,
  o: EigenrayOptions,
): Eigenray[] {
  const fan = o.fanDeg ?? 60
  const nRays = o.nRays ?? 1800
  const ds = Math.min(defaultStep(p, targetRangeM), targetRangeM / 400)
  const step = (2 * fan) / (nRays - 1)
  const alpha = thorpDbPerKm(o.freqKhz) / 1000

  const crossings: Crossing[] = []
  for (let k = 0; k < nRays; k++) {
    const c: Crossing = { ok: false, z: 0, theta: 0, t: 0, s: 0, loss: 0, key: '', nSurf: 0, nBot: 0, nTurn: 0 }
    marchRay(p, zs, -fan + k * step, targetRangeM + ds, { ds, freqKhz: o.freqKhz, maxLossDb: 60 }, (s) => {
      if (!c.ok && s.r >= targetRangeM) {
        const span = s.r - s.rPrev
        const f = span > 1e-9 ? (targetRangeM - s.rPrev) / span : 0
        c.ok = true
        c.z = s.zPrev + f * (s.z - s.zPrev)
        c.theta = s.theta
        c.t = s.t - ((1 - f) * ds) / 1500
        c.s = s.s - (1 - f) * ds
        c.loss = s.lossDb
        c.nSurf = s.nSurf
        c.nBot = s.nBot
        c.nTurn = s.nUpper + s.nLower
        c.key = `${s.nSurf}/${s.nBot}/${s.nUpper}/${s.nLower}`
      }
    })
    crossings.push(c)
  }

  const found: Eigenray[] = []
  for (let k = 0; k < nRays - 1; k++) {
    const a = crossings[k]
    const b = crossings[k + 1]
    if (!a.ok || !b.ok || a.key !== b.key) continue
    const da = a.z - targetDepth
    const db = b.z - targetDepth
    if (da * db > 0 || da === db) continue
    const f = da / (da - db)
    const launchDeg = -fan + (k + f) * step
    const theta = a.theta + f * (b.theta - a.theta)
    const dzdTheta = Math.max(Math.abs(b.z - a.z) / (step * DEG), 1)
    const intensity = Math.cos(launchDeg * DEG) / (targetRangeM * dzdTheta * Math.max(0.05, Math.cos(theta)))
    const spreadingDb = -10 * Math.log10(intensity)
    const pathLen = a.s + f * (b.s - a.s)
    const boundaryLossDb = a.loss + f * (b.loss - a.loss)
    const absorptionDb = alpha * pathLen
    found.push({
      launchDeg,
      arrivalDeg: theta / DEG,
      timeS: a.t + f * (b.t - a.t),
      nSurf: a.nSurf,
      nBot: a.nBot,
      nTurn: a.nTurn,
      boundaryLossDb,
      spreadingDb,
      absorptionDb,
      tlDb: spreadingDb + boundaryLossDb + absorptionDb,
      pathType: pathType(a.nSurf, a.nBot, a.nTurn),
      label: label(a.nSurf, a.nBot, a.nTurn),
    })
  }
  return found.sort((x, y) => x.timeS - y.timeS)
}

/** Incoherent sum of eigenray intensities, as a total loss in dB. */
export function eigenraySumDb(rays: readonly Eigenray[]): number {
  const total = rays.reduce((acc, e) => acc + Math.pow(10, -e.tlDb / 10), 0)
  return total > 0 ? -10 * Math.log10(total) : Infinity
}

/** Gaussian vertical beam response in dB at an arrival angle. */
export function beamResponseDb(angleDeg: number, steerDeg: number, widthDeg: number, floorDb = -30): number {
  const u = (angleDeg - steerDeg) / (widthDeg / 2)
  return Math.max(floorDb, -3.0103 * u * u)
}
