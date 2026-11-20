import { useRef, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Readout, Readouts, Slider } from '../components/ui/controls'
import { dot, hexA, label } from '../components/viz/canvasKit'
import { C } from '../components/viz/theme'
import { useCanvas, usePointer } from '../components/viz/useCanvas'
import { DEG } from '../lib/db'
import { fmt } from '../lib/format'

const DEPTH = 300
const SRC = 100
const IFACE = 180
const SPAN = 640

interface Seg {
  x0: number
  z0: number
  x1: number
  z1: number
  angle: number
}

/** Straight segments through two constant-speed layers, with reflection and refraction. */
function traceLayers(angleDown: number, c1: number, c2: number): { segs: Seg[]; refracted: number | null; turned: boolean; firstHit: string } {
  const segs: Seg[] = []
  let x = 0
  let z = SRC
  let th = angleDown * DEG
  let refracted: number | null = null
  let turned = false
  let firstHit = 'none'
  for (let i = 0; i < 14 && x < SPAN; i++) {
    const inUpper = z < IFACE || (z === IFACE && th < 0)
    const c = inUpper ? c1 : c2
    if (Math.abs(th) < 1e-4) {
      segs.push({ x0: x, z0: z, x1: SPAN, z1: z, angle: th })
      break
    }
    const zTarget = th > 0 ? (inUpper ? IFACE : DEPTH) : inUpper ? 0 : IFACE
    const dx = (zTarget - z) / Math.tan(th)
    const x1 = x + dx
    if (x1 > SPAN) {
      segs.push({ x0: x, z0: z, x1: SPAN, z1: z + (SPAN - x) * Math.tan(th), angle: th })
      break
    }
    segs.push({ x0: x, z0: z, x1, z1: zTarget, angle: th })
    x = x1
    z = zTarget
    if (zTarget === 0) {
      if (firstHit === 'none') firstHit = 'surface'
      th = -th
    } else if (zTarget === DEPTH) {
      if (firstHit === 'none') firstHit = 'bottom'
      th = -th
    } else {
      const cOther = c === c1 ? c2 : c1
      const cosNew = (Math.cos(th) * cOther) / c
      if (cosNew >= 1) {
        turned = true
        if (firstHit === 'none') firstHit = 'turned at the interface'
        th = -th
      } else {
        const next = Math.acos(cosNew) * Math.sign(th)
        if (refracted === null) refracted = next / DEG
        th = next
      }
    }
  }
  return { segs, refracted, turned, firstHit }
}

function shipPath(ctx: CanvasRenderingContext2D, x: number, y: number, headingDeg: number, size: number, fill: string): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(headingDeg * DEG)
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.lineTo(size * 0.42, size * 0.1)
  ctx.lineTo(size * 0.32, size * 0.9)
  ctx.lineTo(-size * 0.32, size * 0.9)
  ctx.lineTo(-size * 0.42, size * 0.1)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.restore()
}

function arc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fromDeg: number, toDeg: number, color: string): void {
  // Compass angles run clockwise from north, which is up.
  ctx.beginPath()
  ctx.arc(x, y, r, (fromDeg - 90) * DEG, (toDeg - 90) * DEG, toDeg < fromDeg)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.stroke()
}

const norm = (a: number): number => ((a % 360) + 360) % 360

export default function AngleBench(_: PlaygroundProps): ReactElement {
  const [angle, setAngle] = useState(18)
  const [c1, setC1] = useState(1520)
  const [c2, setC2] = useState(1490)
  const [ownHdg, setOwnHdg] = useState(30)
  const [tgtBrg, setTgtBrg] = useState(95)
  const [tgtHdg, setTgtHdg] = useState(200)
  const geom = useRef<{ sx: number; sy: number; scale: number; cx: number; cy: number; R: number; split: number } | null>(null)
  const drag = useRef<'ray' | 'tgt' | null>(null)

  const t = traceLayers(angle, c1, c2)
  const limiting = c2 > c1 ? Math.acos(c1 / c2) / DEG : null
  const relBrg = norm(tgtBrg - ownHdg)
  const aspect = norm(tgtBrg + 180 - tgtHdg)
  const first = t.segs[0]
  const slant = first ? Math.hypot(first.x1 - first.x0, first.z1 - first.z0) : 0

  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      const stacked = w < 720
      const vw = stacked ? w : Math.round(w * 0.6)
      const vh = stacked ? Math.round(h * 0.52) : h
      const scale = Math.min((vw - 40) / SPAN, (vh - 46) / DEPTH)
      const ox = 26
      const oy = 22
      const X = (x: number): number => ox + x * scale
      const Z = (z: number): number => oy + z * scale
      geom.current = { sx: X(0), sy: Z(SRC), scale, cx: 0, cy: 0, R: 0, split: stacked ? 0 : vw }

      // Vertical plane, drawn to true scale so angles look like what they are.
      const g1 = ctx.createLinearGradient(0, Z(0), 0, Z(DEPTH))
      g1.addColorStop(0, '#0b2a3f')
      g1.addColorStop(1, '#06121c')
      ctx.fillStyle = g1
      ctx.fillRect(X(0), Z(0), SPAN * scale, DEPTH * scale)
      ctx.fillStyle = c2 < c1 ? 'rgba(57,135,229,0.10)' : 'rgba(217,89,38,0.10)'
      ctx.fillRect(X(0), Z(IFACE), SPAN * scale, (DEPTH - IFACE) * scale)
      ctx.strokeStyle = 'rgba(232,240,246,0.25)'
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(X(0), Z(IFACE))
      ctx.lineTo(X(SPAN), Z(IFACE))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = C.seabed
      ctx.fillRect(X(0), Z(DEPTH), SPAN * scale, 8)
      ctx.strokeStyle = 'rgba(160,225,240,0.5)'
      ctx.beginPath()
      ctx.moveTo(X(0), Z(0))
      ctx.lineTo(X(SPAN), Z(0))
      ctx.stroke()
      label(ctx, `upper layer  c = ${c1} m/s`, X(SPAN) - 8, Z(0) + 13, C.ink2, 'right')
      label(ctx, `lower layer  c = ${c2} m/s`, X(SPAN) - 8, Z(IFACE) + 13, C.ink2, 'right')
      label(ctx, 'surface', X(0) + 6, Z(0) - 9, C.ink3)
      label(ctx, 'seabed', X(0) + 6, Z(DEPTH) + 17, C.ink3)

      const pr = Math.min(86, SRC * scale - 6)
      ctx.strokeStyle = C.axis
      ctx.beginPath()
      ctx.arc(X(0), Z(SRC), pr, -Math.PI / 2, Math.PI / 2)
      ctx.stroke()
      for (let a = -90; a <= 90; a += 15) {
        const inner = a % 30 === 0 ? pr - 9 : pr - 5
        ctx.beginPath()
        ctx.moveTo(X(0) + Math.cos(a * DEG) * inner, Z(SRC) + Math.sin(a * DEG) * inner)
        ctx.lineTo(X(0) + Math.cos(a * DEG) * pr, Z(SRC) + Math.sin(a * DEG) * pr)
        ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(232,240,246,0.3)'
      ctx.beginPath()
      ctx.moveTo(X(0), Z(SRC))
      ctx.lineTo(X(0) + pr + 60, Z(SRC))
      ctx.stroke()
      label(ctx, 'horizontal', X(0) + pr + 64, Z(SRC), C.ink3)
      ctx.beginPath()
      ctx.moveTo(X(0), Z(SRC))
      ctx.arc(X(0), Z(SRC), pr * 0.62, 0, angle * DEG, angle < 0)
      ctx.closePath()
      ctx.fillStyle = hexA(C.accent, 0.2)
      ctx.fill()

      ctx.save()
      ctx.beginPath()
      ctx.rect(X(0), Z(0), SPAN * scale, DEPTH * scale)
      ctx.clip()
      ctx.shadowColor = C.accent
      ctx.shadowBlur = 10
      ctx.strokeStyle = C.accent
      ctx.lineWidth = 2.2
      ctx.beginPath()
      t.segs.forEach((s, i) => {
        if (i === 0) ctx.moveTo(X(s.x0), Z(s.z0))
        ctx.lineTo(X(s.x1), Z(s.z1))
      })
      ctx.stroke()
      ctx.restore()
      const hx = X(0) + Math.cos(angle * DEG) * pr
      const hy = Z(SRC) + Math.sin(angle * DEG) * pr
      dot(ctx, hx, hy, 6, C.amber)
      label(ctx, 'drag', hx + 11, hy - 11, C.amber)
      dot(ctx, X(0), Z(SRC), 5, C.ink)
      label(ctx, angle >= 0 ? `depression ${fmt(angle, 0)}°` : `elevation ${fmt(-angle, 0)}°`, X(0) + pr * 0.66 + 8, Z(SRC) + (angle >= 0 ? 16 : -16), C.accent)
      if (first && first.x1 < SPAN) {
        const g = Math.abs(first.angle) / DEG
        label(ctx, `grazing ${fmt(g, 1)}°`, X(first.x1) + 8, Z(first.z1) + (first.z1 === 0 ? 14 : -12), C.amber)
      }
      label(ctx, 'VERTICAL PLANE · 640 m × 300 m, true scale', X(0), Z(DEPTH) + 32, C.ink3)

      // Horizontal plane, with bearing and aspect on a compass.
      const px0 = stacked ? 0 : vw
      const py0 = stacked ? vh : 0
      const pw = stacked ? w : w - vw
      const ph = stacked ? h - vh : h
      const cx = px0 + pw / 2
      const cy = py0 + ph / 2 - 6
      const R = Math.min(pw, ph) / 2 - 34
      Object.assign(geom.current, { cx, cy, R })
      ctx.strokeStyle = C.axis
      ctx.lineWidth = 1
      for (const k of [1, 0.66, 0.33]) {
        ctx.beginPath()
        ctx.arc(cx, cy, R * k, 0, Math.PI * 2)
        ctx.stroke()
      }
      for (let a = 0; a < 360; a += 30) {
        const s = Math.sin(a * DEG)
        const c = -Math.cos(a * DEG)
        ctx.beginPath()
        ctx.moveTo(cx + s * (R - 6), cy + c * (R - 6))
        ctx.lineTo(cx + s * R, cy + c * R)
        ctx.stroke()
        label(ctx, a === 0 ? 'N' : `${String(a).padStart(3, '0')}`, cx + s * (R + 15), cy + c * (R + 13), C.ink3, 'center', 10)
      }
      const tx = cx + Math.sin(tgtBrg * DEG) * R * 0.7
      const ty = cy - Math.cos(tgtBrg * DEG) * R * 0.7
      ctx.strokeStyle = 'rgba(232,240,246,0.45)'
      ctx.setLineDash([4, 5])
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(tx, ty)
      ctx.stroke()
      ctx.setLineDash([])
      arc(ctx, cx, cy, 30, 0, tgtBrg, C.ink2)
      arc(ctx, cx, cy, 44, ownHdg, ownHdg + relBrg, C.accent)
      arc(ctx, tx, ty, 30, tgtHdg, tgtHdg + aspect, C.amber)
      shipPath(ctx, cx, cy, ownHdg, 15, C.accent)
      shipPath(ctx, tx, ty, tgtHdg, 15, C.amber)
      label(ctx, 'own ship', cx, cy + 30, C.accent, 'center')
      label(ctx, 'target · drag', tx, ty + 30, C.amber, 'center')
      label(ctx, 'HORIZONTAL PLANE · north up', cx, py0 + ph - 10, C.ink3, 'center')
    },
    [angle, c1, c2, ownHdg, tgtBrg, tgtHdg, t.segs.length, relBrg, aspect],
  )

  usePointer(ref, {
    onDown: (x, y) => {
      const g = geom.current
      if (!g) return false
      const tx = g.cx + Math.sin(tgtBrg * DEG) * g.R * 0.7
      const ty = g.cy - Math.cos(tgtBrg * DEG) * g.R * 0.7
      if (Math.hypot(x - tx, y - ty) < 30) drag.current = 'tgt'
      else if (x < g.sx + 190 && (g.split === 0 || x < g.split)) drag.current = 'ray'
      else drag.current = null
      return drag.current !== null
    },
    onMove: (x, y, dragging) => {
      const g = geom.current
      if (!g || !dragging) return
      if (drag.current === 'ray') {
        const a = Math.atan2(y - g.sy, Math.max(1, x - g.sx)) / DEG
        setAngle(Math.round(Math.max(-75, Math.min(75, a))))
      } else {
        setTgtBrg(Math.round(norm(Math.atan2(x - g.cx, -(y - g.cy)) / DEG)))
      }
    },
  })

  return (
    <PlaygroundFrame
      title="Angle Bench"
      hint="Left: a ray leaves the source at a D/E angle, meets a change in sound speed and the boundaries. Right: the horizontal angles that fix where a target is and which way it faces you."
      tag="ANGLES"
      wide
      side={
        <>
          <div>
            <p className="pg-sub">Vertical plane</p>
            <Slider label="Launch angle (down is positive)" value={angle} min={-75} max={75} step={1} unit="°" onChange={setAngle} />
            <Slider label="Upper layer speed" value={c1} min={1470} max={1540} step={1} unit="m/s" onChange={setC1} />
            <Slider label="Lower layer speed" value={c2} min={1470} max={1540} step={1} unit="m/s" onChange={setC2} />
          </div>
          <Readouts>
            <Readout label="D/E, up positive" value={fmt(-angle, 0)} unit="°" tone="accent" />
            <Readout label="D/E, down positive" value={fmt(angle, 0)} unit="°" />
            <Readout label="Angle below interface" value={t.refracted === null ? (t.turned ? 'turned back' : '—') : fmt(Math.abs(t.refracted), 1)} unit={t.refracted === null ? undefined : '°'} />
            <Readout label="Limiting angle" value={limiting === null ? 'none' : fmt(limiting, 1)} unit={limiting === null ? undefined : '°'} />
            <Readout label="First meets" value={t.firstHit} />
            <Readout label="Slant to first hit" value={fmt(slant, 0)} unit="m" />
          </Readouts>
          <div>
            <p className="pg-sub">Horizontal plane</p>
            <Slider label="Own heading" value={ownHdg} min={0} max={359} step={1} unit="°T" onChange={setOwnHdg} />
            <Slider label="True bearing to target" value={tgtBrg} min={0} max={359} step={1} unit="°T" onChange={setTgtBrg} />
            <Slider label="Target heading" value={tgtHdg} min={0} max={359} step={1} unit="°T" onChange={setTgtHdg} />
          </div>
          <Readouts>
            <Readout label="True bearing" value={String(Math.round(tgtBrg)).padStart(3, '0')} unit="°T" />
            <Readout label="Relative bearing" value={String(Math.round(relBrg)).padStart(3, '0')} unit="°R" tone="accent" />
            <Readout label="Target aspect" value={fmt(aspect, 0)} unit="° off bow" swatch={C.amber} />
            <Readout label="Aspect in words" value={aspect < 30 || aspect > 330 ? 'bow' : Math.abs(aspect - 180) < 30 ? 'stern' : Math.abs(aspect - 90) < 30 || Math.abs(aspect - 270) < 30 ? 'beam' : 'quarter'} />
          </Readouts>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 420 }} role="img" aria-label="Vertical plane ray with D/E angle and a horizontal compass with bearing and aspect" />
    </PlaygroundFrame>
  )
}
