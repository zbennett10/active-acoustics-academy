import { paintField } from '../../lib/colormaps'
import { niceTicks, tickLabel } from '../../lib/format'
import { C, FONT_DISPLAY, FONT_MONO } from './theme'

export interface Frame {
  x: number
  y: number
  w: number
  h: number
  /** Data value at the left and right edges. */
  x0: number
  x1: number
  /** Data value at the top and bottom edges. */
  y0: number
  y1: number
}

export interface Pad {
  l: number
  r: number
  t: number
  b: number
}

export const PAD: Pad = { l: 52, r: 14, t: 12, b: 38 }

export function makeFrame(w: number, h: number, xDomain: readonly [number, number], yDomain: readonly [number, number], pad: Pad = PAD): Frame {
  return { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b, x0: xDomain[0], x1: xDomain[1], y0: yDomain[0], y1: yDomain[1] }
}

export function sx(f: Frame, v: number): number {
  return f.x + ((v - f.x0) / (f.x1 - f.x0)) * f.w
}

export function sy(f: Frame, v: number): number {
  return f.y + ((v - f.y0) / (f.y1 - f.y0)) * f.h
}

export function ix(f: Frame, px: number): number {
  return f.x0 + ((px - f.x) / f.w) * (f.x1 - f.x0)
}

export function iy(f: Frame, py: number): number {
  return f.y0 + ((py - f.y) / f.h) * (f.y1 - f.y0)
}

export function inFrame(f: Frame, px: number, py: number): boolean {
  return px >= f.x && px <= f.x + f.w && py >= f.y && py <= f.y + f.h
}

export interface AxisOptions {
  xLabel?: string
  yLabel?: string
  grid?: boolean
  xTicks?: number
  yTicks?: number
}

export function drawAxes(ctx: CanvasRenderingContext2D, f: Frame, o: AxisOptions = {}): void {
  const xt = niceTicks(Math.min(f.x0, f.x1), Math.max(f.x0, f.x1), o.xTicks ?? 7)
  const yt = niceTicks(Math.min(f.y0, f.y1), Math.max(f.y0, f.y1), o.yTicks ?? 5)
  ctx.save()
  ctx.lineWidth = 1
  if (o.grid !== false) {
    ctx.strokeStyle = C.grid
    ctx.beginPath()
    xt.forEach((v) => {
      const px = Math.round(sx(f, v)) + 0.5
      ctx.moveTo(px, f.y)
      ctx.lineTo(px, f.y + f.h)
    })
    yt.forEach((v) => {
      const py = Math.round(sy(f, v)) + 0.5
      ctx.moveTo(f.x, py)
      ctx.lineTo(f.x + f.w, py)
    })
    ctx.stroke()
  }
  ctx.strokeStyle = C.axis
  ctx.strokeRect(f.x + 0.5, f.y + 0.5, f.w, f.h)
  ctx.fillStyle = C.ink3
  ctx.font = `11px ${FONT_MONO}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  xt.forEach((v) => ctx.fillText(tickLabel(v), sx(f, v), f.y + f.h + 5))
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  yt.forEach((v) => ctx.fillText(tickLabel(v), f.x - 6, sy(f, v)))
  ctx.font = `500 12px ${FONT_DISPLAY}`
  if (o.xLabel) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(o.xLabel.toUpperCase(), f.x + f.w / 2, f.y + f.h + 34)
  }
  if (o.yLabel) {
    ctx.save()
    ctx.translate(f.x - 38, f.y + f.h / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(o.yLabel.toUpperCase(), 0, 0)
    ctx.restore()
  }
  ctx.restore()
}

const scratch: { canvas: HTMLCanvasElement | null } = { canvas: null }

/** Draws a row-major scalar field (nx by ny) stretched over the frame. */
export function drawField(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  values: Float32Array,
  nx: number,
  ny: number,
  lo: number,
  hi: number,
  lut: Uint8ClampedArray,
  invert = false,
  smooth = true,
): void {
  const off = scratch.canvas ?? document.createElement('canvas')
  scratch.canvas = off
  off.width = nx
  off.height = ny
  const octx = off.getContext('2d')
  if (!octx) return
  const img = octx.createImageData(nx, ny)
  paintField(values, img.data, lo, hi, lut, invert)
  octx.putImageData(img, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = smooth
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(off, f.x, f.y, f.w, f.h)
  ctx.restore()
}

export function clipFrame(ctx: CanvasRenderingContext2D, f: Frame): void {
  ctx.beginPath()
  ctx.rect(f.x, f.y, f.w, f.h)
  ctx.clip()
}

/** Soft halo under a crisp line. Call inside save/restore if you change blend modes. */
export function glowPath(ctx: CanvasRenderingContext2D, build: () => void, color: string, width = 1.5, glow = 8): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.shadowColor = color
  ctx.shadowBlur = glow
  ctx.lineWidth = width
  ctx.beginPath()
  build()
  ctx.stroke()
  ctx.restore()
}

export function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, ring = C.bg): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r + 2, 0, Math.PI * 2)
  ctx.fillStyle = ring
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.shadowColor = fill
  ctx.shadowBlur = 12
  ctx.fill()
  ctx.restore()
}

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string = C.ink2,
  align: CanvasTextAlign = 'left',
  size = 11,
): void {
  ctx.save()
  ctx.font = `${size}px ${FONT_MONO}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(4,10,17,0.85)'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}

export function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export function drawSeabed(ctx: CanvasRenderingContext2D, f: Frame, pts: ReadonlyArray<{ r: number; z: number }>): void {
  ctx.save()
  clipFrame(ctx, f)
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(f, p.r), sy(f, p.z)) : ctx.lineTo(sx(f, p.r), sy(f, p.z))))
  ctx.lineTo(f.x + f.w, f.y + f.h + 2)
  ctx.lineTo(f.x, f.y + f.h + 2)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, f.y, 0, f.y + f.h)
  g.addColorStop(0, '#3a2c1e')
  g.addColorStop(1, '#1a130d')
  ctx.fillStyle = g
  ctx.fill()
  ctx.beginPath()
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(sx(f, p.r), sy(f, p.z)) : ctx.lineTo(sx(f, p.r), sy(f, p.z))))
  ctx.strokeStyle = C.seabedLine
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()
}

/** Strokes the iso-line of a row-major field at one level (marching squares). */
export function drawContour(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  values: Float32Array,
  nx: number,
  ny: number,
  level: number,
  color: string,
  width = 1.6,
): void {
  const cw = f.w / nx
  const ch = f.h / ny
  const px = (i: number): number => f.x + (i + 0.5) * cw
  const py = (j: number): number => f.y + (j + 0.5) * ch
  const t = (a: number, b: number): number => (level - a) / (b - a)
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = values[j * nx + i]
      const b = values[j * nx + i + 1]
      const c = values[(j + 1) * nx + i + 1]
      const d = values[(j + 1) * nx + i]
      if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) continue
      const pts: Array<[number, number]> = []
      if (a >= level !== b >= level) pts.push([px(i) + t(a, b) * cw, py(j)])
      if (b >= level !== c >= level) pts.push([px(i + 1), py(j) + t(b, c) * ch])
      if (d >= level !== c >= level) pts.push([px(i) + t(d, c) * cw, py(j + 1)])
      if (a >= level !== d >= level) pts.push([px(i), py(j) + t(a, d) * ch])
      for (let k = 0; k + 1 < pts.length; k += 2) {
        ctx.moveTo(pts[k][0], pts[k][1])
        ctx.lineTo(pts[k + 1][0], pts[k + 1][1])
      }
    }
  }
  ctx.stroke()
  ctx.restore()
}
