// Ocean environments for the teaching ray engine, each with a sound speed profile,
// bathymetry and boundary losses. Values are illustrative, not database-grade.

import { DEG } from './db'

export interface SspPoint {
  z: number // depth, m
  c: number // sound speed, m/s
}

export interface BathyPoint {
  rKm: number
  z: number
}

export interface BottomType {
  id: string
  name: string
  criticalDeg: number
  lowLossDb: number
  highLossDb: number
  lambertDb: number // 10 log mu
}

export const BOTTOMS: Record<string, BottomType> = {
  rock: { id: 'rock', name: 'Rock', criticalDeg: 50, lowLossDb: 0.3, highLossDb: 6, lambertDb: -18 },
  sand: { id: 'sand', name: 'Sand', criticalDeg: 28, lowLossDb: 0.6, highLossDb: 10, lambertDb: -27 },
  silt: { id: 'silt', name: 'Silt', criticalDeg: 14, lowLossDb: 1.5, highLossDb: 13, lambertDb: -32 },
  mud: { id: 'mud', name: 'Mud', criticalDeg: 4, lowLossDb: 2.5, highLossDb: 16, lambertDb: -37 },
}

export interface Environment {
  id: string
  name: string
  blurb: string
  ssp: SspPoint[]
  bathy: BathyPoint[]
  bottom: BottomType
  windKn: number
  rMaxKm: number
  sourceDepth: number
}

/** Loss per bottom bounce, small below the critical angle and rising above it. */
export function bottomLossDb(bottom: BottomType, grazingRad: number): number {
  const g = Math.abs(grazingRad) / DEG
  if (g <= bottom.criticalDeg) {
    return bottom.lowLossDb * Math.min(1, g / Math.max(bottom.criticalDeg, 1))
  }
  const x = (g - bottom.criticalDeg) / 12
  return bottom.lowLossDb + (bottom.highLossDb - bottom.lowLossDb) * (1 - Math.exp(-x))
}

/** Loss per surface bounce, growing with wind, frequency and grazing angle. */
export function surfaceLossDb(windKn: number, fKhz: number, grazingRad: number): number {
  const rough = 0.04 * Math.pow(fKhz, 1.5) * Math.pow(windKn / 10, 2)
  return Math.min(8, rough * (1 + 4 * Math.sin(Math.abs(grazingRad))))
}

function munk(z: number): number {
  const eta = (2 * (z - 1300)) / 1300
  return 1500 * (1 + 0.00737 * (eta - 1 + Math.exp(-eta)))
}

function sampled(fn: (z: number) => number, zMax: number, dz: number): SspPoint[] {
  const n = Math.round(zMax / dz)
  return Array.from({ length: n + 1 }, (_, i) => ({ z: i * dz, c: Number(fn(i * dz).toFixed(2)) }))
}

const flat = (z: number, rKm: number): BathyPoint[] => [
  { rKm: 0, z },
  { rKm, z },
]

export const ENVIRONMENTS: Environment[] = [
  {
    id: 'deep-cz',
    name: 'Deep ocean, convergence zone',
    blurb: 'A classic deep sound channel. Rays leave the surface layer, turn deep, and refocus near 60 km.',
    ssp: sampled(munk, 5000, 100),
    bathy: flat(5000, 140),
    bottom: BOTTOMS.silt,
    windKn: 12,
    rMaxKm: 140,
    sourceDepth: 100,
  },
  {
    id: 'surface-duct',
    name: 'Mixed layer with surface duct',
    blurb: 'An isothermal mixed layer traps shallow-angle energy against the surface. Below the layer sits a shadow zone.',
    ssp: [
      { z: 0, c: 1500 },
      { z: 100, c: 1501.6 },
      { z: 300, c: 1492 },
      { z: 1000, c: 1482 },
      { z: 4500, c: 1540 },
    ],
    bathy: flat(4500, 60),
    bottom: BOTTOMS.silt,
    windKn: 10,
    rMaxKm: 60,
    sourceDepth: 40,
  },
  {
    id: 'bottom-limited',
    name: 'Bottom limited deep water',
    blurb: 'The seabed is shallower than the critical depth, so no convergence zone forms. Bottom bounce carries the energy.',
    ssp: sampled(munk, 3000, 100),
    bathy: flat(3000, 80),
    bottom: BOTTOMS.sand,
    windKn: 12,
    rMaxKm: 80,
    sourceDepth: 100,
  },
  {
    id: 'shallow-summer',
    name: 'Shallow water, summer',
    blurb: 'A warm surface layer bends every ray down into the seabed. Loss depends on the bottom.',
    ssp: [
      { z: 0, c: 1536 },
      { z: 20, c: 1535 },
      { z: 60, c: 1506 },
      { z: 200, c: 1500 },
    ],
    bathy: flat(200, 30),
    bottom: BOTTOMS.sand,
    windKn: 8,
    rMaxKm: 30,
    sourceDepth: 30,
  },
  {
    id: 'shallow-winter',
    name: 'Shallow water, winter',
    blurb: 'A well mixed column refracts gently upward. Energy rides the surface and bottom loss matters less.',
    ssp: [
      { z: 0, c: 1490 },
      { z: 200, c: 1493.3 },
    ],
    bathy: flat(200, 30),
    bottom: BOTTOMS.sand,
    windKn: 15,
    rMaxKm: 30,
    sourceDepth: 30,
  },
  {
    id: 'upslope',
    name: 'Shelf break, upslope',
    blurb: 'Sound climbs a slope. Each bottom bounce steepens the ray by twice the slope angle until it dies.',
    ssp: [
      { z: 0, c: 1528 },
      { z: 40, c: 1526 },
      { z: 150, c: 1502 },
      { z: 800, c: 1486 },
      { z: 1500, c: 1492 },
    ],
    bathy: [
      { rKm: 0, z: 1500 },
      { rKm: 10, z: 1400 },
      { rKm: 40, z: 180 },
      { rKm: 60, z: 140 },
    ],
    bottom: BOTTOMS.sand,
    windKn: 10,
    rMaxKm: 60,
    sourceDepth: 60,
  },
  {
    id: 'arctic',
    name: 'Arctic half channel',
    blurb: 'Sound speed rises from the ice down. Every ray refracts up and reflects off the surface again and again.',
    ssp: [
      { z: 0, c: 1436 },
      { z: 250, c: 1452 },
      { z: 3000, c: 1498 },
    ],
    bathy: flat(3000, 100),
    bottom: BOTTOMS.silt,
    windKn: 5,
    rMaxKm: 100,
    sourceDepth: 60,
  },
  {
    id: 'isovelocity',
    name: 'Isovelocity tank',
    blurb: 'Constant sound speed. Rays are straight lines, which makes it the reference case for every check.',
    ssp: [
      { z: 0, c: 1500 },
      { z: 1000, c: 1500 },
    ],
    bathy: flat(1000, 20),
    bottom: BOTTOMS.sand,
    windKn: 5,
    rMaxKm: 20,
    sourceDepth: 300,
  },
]

export function getEnvironment(id: string): Environment {
  return ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[0]
}

export interface PreparedEnv {
  env: Environment
  zMax: number
  dzTab: number
  cTab: Float64Array
  gTab: Float64Array
  bathyR: Float64Array // m
  bathyZ: Float64Array
}

function interpSsp(ssp: readonly SspPoint[], z: number): number {
  if (z <= ssp[0].z) return ssp[0].c
  const last = ssp[ssp.length - 1]
  if (z >= last.z) return last.c + 0.0167 * (z - last.z)
  let i = 1
  while (ssp[i].z < z) i++
  const a = ssp[i - 1]
  const b = ssp[i]
  return a.c + ((b.c - a.c) * (z - a.z)) / (b.z - a.z)
}

/** Tabulates c(z) and its gradient on a fine grid for fast ray stepping. */
export function prepareEnv(env: Environment): PreparedEnv {
  const zMax = env.bathy.reduce((m, b) => Math.max(m, b.z), 0)
  const n = Math.max(200, Math.min(6000, Math.ceil(zMax)))
  const dzTab = zMax / n
  const cTab = new Float64Array(n + 2)
  const gTab = new Float64Array(n + 2)
  for (let i = 0; i <= n + 1; i++) cTab[i] = interpSsp(env.ssp, i * dzTab)
  for (let i = 0; i <= n; i++) gTab[i] = (cTab[i + 1] - cTab[i]) / dzTab
  gTab[n + 1] = gTab[n]
  return {
    env,
    zMax,
    dzTab,
    cTab,
    gTab,
    bathyR: Float64Array.from(env.bathy.map((b) => b.rKm * 1000)),
    bathyZ: Float64Array.from(env.bathy.map((b) => b.z)),
  }
}

export function soundSpeedAt(p: PreparedEnv, z: number): number {
  const x = Math.min(Math.max(z, 0), p.zMax) / p.dzTab
  const i = Math.floor(x)
  return p.cTab[i] + (p.cTab[i + 1] - p.cTab[i]) * (x - i)
}

export function depthAt(p: PreparedEnv, r: number): number {
  const { bathyR, bathyZ } = p
  const n = bathyR.length
  if (r <= bathyR[0]) return bathyZ[0]
  if (r >= bathyR[n - 1]) return bathyZ[n - 1]
  let i = 1
  while (bathyR[i] < r) i++
  const f = (r - bathyR[i - 1]) / (bathyR[i] - bathyR[i - 1])
  return bathyZ[i - 1] + f * (bathyZ[i] - bathyZ[i - 1])
}

export function slopeAt(p: PreparedEnv, r: number): number {
  const { bathyR, bathyZ } = p
  const n = bathyR.length
  if (r <= bathyR[0] || r >= bathyR[n - 1]) return 0
  let i = 1
  while (bathyR[i] < r) i++
  return (bathyZ[i] - bathyZ[i - 1]) / (bathyR[i] - bathyR[i - 1])
}

/** Simplified Medwin equation. T in deg C, S in PSU, z in m. */
export function medwinSoundSpeed(tC: number, sPsu: number, z: number): number {
  return (
    1449.2 + 4.6 * tC - 0.055 * tC * tC + 0.00029 * tC * tC * tC + (1.34 - 0.01 * tC) * (sPsu - 35) + 0.016 * z
  )
}
