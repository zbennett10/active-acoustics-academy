// Bistatic geometry in a flat plan view. Positions in metres.

import { DEG, SOUND_SPEED } from './db'

export interface Pt {
  x: number
  y: number
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Angle at the target between the directions to source and receiver, degrees 0..180. */
export function bistaticAngleDeg(src: Pt, rcv: Pt, tgt: Pt): number {
  const ax = src.x - tgt.x
  const ay = src.y - tgt.y
  const bx = rcv.x - tgt.x
  const by = rcv.y - tgt.y
  const la = Math.hypot(ax, ay)
  const lb = Math.hypot(bx, by)
  if (la < 1e-9 || lb < 1e-9) return 0
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))) / DEG
}

export function totalPath(src: Pt, rcv: Pt, tgt: Pt): number {
  return dist(src, tgt) + dist(tgt, rcv)
}

/** Monostatic range giving the same spherical-spreading two-way loss. */
export function equivalentMonostaticRange(src: Pt, rcv: Pt, tgt: Pt): number {
  return Math.sqrt(dist(src, tgt) * dist(tgt, rcv))
}

/**
 * Range from the receiver given total path rho, baseline L and the angle at
 * the receiver between the source direction and the target direction.
 */
export function receiverRange(rho: number, baseline: number, angleDeg: number): number {
  return (rho * rho - baseline * baseline) / (2 * (rho - baseline * Math.cos(angleDeg * DEG)))
}

export interface Ellipse {
  cx: number
  cy: number
  a: number
  b: number
  rotDeg: number
}

/** Equal-time contour, the points that share one total path rho. */
export function isoTimeEllipse(src: Pt, rcv: Pt, rho: number): Ellipse | null {
  const baseline = dist(src, rcv)
  if (rho <= baseline) return null
  const a = rho / 2
  const b = Math.sqrt(a * a - (baseline * baseline) / 4)
  return {
    cx: (src.x + rcv.x) / 2,
    cy: (src.y + rcv.y) / 2,
    a,
    b,
    rotDeg: Math.atan2(rcv.y - src.y, rcv.x - src.x) / DEG,
  }
}

/** Echoes on paths shorter than this arrive inside the direct blast. */
export function blindPath(baseline: number, pulseS: number, c = SOUND_SPEED): number {
  return baseline + c * pulseS
}

/** Doppler shift (Hz), positive when the total path is shortening. velocity in m/s. */
export function bistaticDopplerHz(fHz: number, src: Pt, rcv: Pt, tgt: Pt, velocity: Pt, c = SOUND_SPEED): number {
  const ts = dist(src, tgt)
  const tr = dist(rcv, tgt)
  if (ts < 1e-9 || tr < 1e-9) return 0
  const ux = (src.x - tgt.x) / ts + (rcv.x - tgt.x) / tr
  const uy = (src.y - tgt.y) / ts + (rcv.y - tgt.y) / tr
  return (fHz / c) * (velocity.x * ux + velocity.y * uy)
}

/** Range resolution along the bisector widens as the bistatic angle opens. */
export function bistaticRangeResolutionM(bandwidthHz: number, betaDeg: number, c = SOUND_SPEED): number {
  return c / (2 * bandwidthHz * Math.max(0.02, Math.cos((betaDeg / 2) * DEG)))
}

/** Bearing (degrees clockwise from north, y up) from one point to another. */
export function bearingDeg(from: Pt, to: Pt): number {
  return (Math.atan2(to.x - from.x, to.y - from.y) / DEG + 360) % 360
}

/** Aspect seen from the target, the angle off the bow of the line toward an observer, 0..360 clockwise. */
export function aspectDeg(tgt: Pt, headingDeg: number, observer: Pt): number {
  return (bearingDeg(tgt, observer) - headingDeg + 360) % 360
}

export function headingVector(headingDeg: number, speedMs: number): Pt {
  return { x: speedMs * Math.sin(headingDeg * DEG), y: speedMs * Math.cos(headingDeg * DEG) }
}
