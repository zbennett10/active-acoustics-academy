import { useMemo, useRef, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Colorbar, Legend, Readout, Readouts, Segmented, Slider, Toggle } from '../components/ui/controls'
import { dot, drawContour, drawField, hexA, label, type Frame } from '../components/viz/canvasKit'
import { C, Q } from '../components/viz/theme'
import { useCanvas, usePointer } from '../components/viz/useCanvas'
import { simpleTlDb } from '../lib/absorption'
import {
  aspectDeg,
  bistaticAngleDeg,
  bistaticDopplerHz,
  bistaticRangeResolutionM,
  blindPath,
  dist,
  equivalentMonostaticRange,
  headingVector,
  isoTimeEllipse,
  type Pt,
} from '../lib/bistatic'
import { COLORMAPS } from '../lib/colormaps'
import { DEG, KNOT_MS, SOUND_SPEED } from '../lib/db'
import { fmt } from '../lib/format'
import { fastBistaticTs } from './shared'

const WKM = 44
const HKM = 28
const NX = 154
const NY = 98
const MAP = COLORMAPS.abyss
const SE_LO = -25
const SE_HI = 30
const FC = 3500

type TsMode = 'fixed' | 'aspect'
type Handle = 'src' | 'rcv' | 'tgt'

export default function BistaticTable({ preset }: PlaygroundProps): ReactElement {
  const [src, setSrc] = useState<Pt>({ x: 13, y: 12 })
  const [rcv, setRcv] = useState<Pt>({ x: 30, y: 12 })
  const [tgt, setTgt] = useState<Pt>({ x: 24, y: 21 })
  const [heading, setHeading] = useState(110)
  const [speed, setSpeed] = useState(8)
  const [sl, setSl] = useState(220)
  const [noise, setNoise] = useState(58)
  const [tau, setTau] = useState(1)
  const [tsMode, setTsMode] = useState<TsMode>(preset === 'aspect' ? 'aspect' : 'fixed')
  const [tsFixed, setTsFixed] = useState(12)
  const [showTime, setShowTime] = useState(true)
  const [showSe, setShowSe] = useState(true)
  const frame = useRef<Frame | null>(null)
  const drag = useRef<Handle | null>(null)

  const m = (p: Pt): Pt => ({ x: p.x * 1000, y: p.y * 1000 })
  const baseline = dist(m(src), m(rcv))
  const rhoBlind = blindPath(baseline, tau)
  const tsAt = (p: Pt): number => (tsMode === 'fixed' ? tsFixed : fastBistaticTs(aspectDeg(p, heading, src), aspectDeg(p, heading, rcv)))

  const field = useMemo(() => {
    const v = new Float32Array(NX * NY)
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const p = { x: ((i + 0.5) / NX) * WKM, y: HKM - ((j + 0.5) / NY) * HKM }
        const rs = dist(m(p), m(src))
        const rr = dist(m(p), m(rcv))
        const ts = tsMode === 'fixed' ? tsFixed : fastBistaticTs(aspectDeg(p, heading, src), aspectDeg(p, heading, rcv))
        v[j * NX + i] = sl - simpleTlDb(rs, 3.5) - simpleTlDb(rr, 3.5) + ts - noise - 10
      }
    }
    return v
  }, [src, rcv, sl, noise, tsMode, tsFixed, heading])

  const rs = dist(m(tgt), m(src))
  const rr = dist(m(tgt), m(rcv))
  const rho = rs + rr
  const beta = bistaticAngleDeg(src, rcv, tgt)
  const ts = tsAt(tgt)
  const se = sl - simpleTlDb(rs, 3.5) - simpleTlDb(rr, 3.5) + ts - noise - 10
  const blind = rho < rhoBlind
  const doppler = bistaticDopplerHz(FC, m(src), m(rcv), m(tgt), headingVector(heading, speed * KNOT_MS))

  const ref = useCanvas(
    (ctx, w, h) => {
      const pad = 10
      const scale = Math.min((w - 2 * pad) / WKM, (h - 2 * pad) / HKM)
      const f: Frame = { x: (w - WKM * scale) / 2, y: (h - HKM * scale) / 2, w: WKM * scale, h: HKM * scale, x0: 0, x1: WKM, y0: HKM, y1: 0 }
      frame.current = f
      const X = (p: Pt): number => f.x + p.x * scale
      const Y = (p: Pt): number => f.y + (HKM - p.y) * scale
      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      ctx.save()
      ctx.beginPath()
      ctx.rect(f.x, f.y, f.w, f.h)
      ctx.clip()
      if (showSe) {
        drawField(ctx, f, field, NX, NY, SE_LO, SE_HI, MAP.lut)
        drawContour(ctx, f, field, NX, NY, 0, 'rgba(255,255,255,0.85)', 1.6)
      } else {
        ctx.fillStyle = '#071521'
        ctx.fillRect(f.x, f.y, f.w, f.h)
      }

      const ellipse = (rhoM: number): boolean => {
        const e = isoTimeEllipse(src, rcv, rhoM / 1000)
        if (!e) return false
        ctx.beginPath()
        ctx.ellipse(f.x + e.cx * scale, f.y + (HKM - e.cy) * scale, e.a * scale, e.b * scale, -e.rotDeg * DEG, 0, Math.PI * 2)
        return true
      }
      if (showTime) {
        for (let tSec = 5; tSec <= 60; tSec += 5) {
          if (ellipse(tSec * SOUND_SPEED)) {
            ctx.strokeStyle = 'rgba(232,240,246,0.2)'
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }
      // Blind zone, where the echo would land inside the direct blast.
      if (ellipse(rhoBlind)) {
        ctx.fillStyle = hexA(C.critical, 0.38)
        ctx.fill()
        ctx.setLineDash([5, 4])
        ctx.strokeStyle = '#f08a8a'
        ctx.lineWidth = 1.4
        ctx.stroke()
        ctx.setLineDash([])
      }
      if (ellipse(rho)) {
        ctx.strokeStyle = C.amber
        ctx.lineWidth = 1.8
        ctx.stroke()
      }

      ctx.setLineDash([6, 5])
      ctx.strokeStyle = 'rgba(232,240,246,0.55)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(X(src), Y(src))
      ctx.lineTo(X(rcv), Y(rcv))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.lineWidth = 2
      ctx.strokeStyle = Q.source
      ctx.beginPath()
      ctx.moveTo(X(src), Y(src))
      ctx.lineTo(X(tgt), Y(tgt))
      ctx.stroke()
      ctx.strokeStyle = Q.echo
      ctx.beginPath()
      ctx.moveTo(X(tgt), Y(tgt))
      ctx.lineTo(X(rcv), Y(rcv))
      ctx.stroke()
      const a1 = Math.atan2(-(src.y - tgt.y), src.x - tgt.x)
      const a2 = Math.atan2(-(rcv.y - tgt.y), rcv.x - tgt.x)
      let d = a2 - a1
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      ctx.beginPath()
      ctx.moveTo(X(tgt), Y(tgt))
      ctx.arc(X(tgt), Y(tgt), 26, a1, a1 + d, d < 0)
      ctx.closePath()
      ctx.fillStyle = hexA(C.amber, 0.3)
      ctx.fill()
      const mid = a1 + d / 2
      ctx.strokeStyle = hexA(C.amber, 0.9)
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(X(tgt), Y(tgt))
      ctx.lineTo(X(tgt) + Math.cos(mid) * 58, Y(tgt) + Math.sin(mid) * 58)
      ctx.stroke()
      ctx.setLineDash([])
      label(ctx, `β ${fmt(beta, 0)}°`, X(tgt) + Math.cos(mid) * 40, Y(tgt) + Math.sin(mid) * 40 - 8, C.amber, 'center')
      ctx.strokeStyle = C.ink
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(X(tgt) - Math.sin(heading * DEG) * 14, Y(tgt) + Math.cos(heading * DEG) * 14)
      ctx.lineTo(X(tgt) + Math.sin(heading * DEG) * 22, Y(tgt) - Math.cos(heading * DEG) * 22)
      ctx.stroke()
      ctx.restore()

      ctx.strokeStyle = C.axis
      ctx.strokeRect(f.x + 0.5, f.y + 0.5, f.w, f.h)
      dot(ctx, X(src), Y(src), 8, Q.source)
      label(ctx, 'SOURCE', X(src), Y(src) + 20, '#8bbcf5', 'center')
      dot(ctx, X(rcv), Y(rcv), 8, C.accent)
      label(ctx, 'RECEIVER', X(rcv), Y(rcv) + 20, C.accent, 'center')
      dot(ctx, X(tgt), Y(tgt), 7, C.amber)
      label(ctx, 'TARGET', X(tgt), Y(tgt) - 20, C.amber, 'center')
      ctx.strokeStyle = C.ink2
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(f.x + 14, f.y + f.h - 14)
      ctx.lineTo(f.x + 14 + 5 * scale, f.y + f.h - 14)
      ctx.stroke()
      label(ctx, '5 km', f.x + 14 + 2.5 * scale, f.y + f.h - 24, C.ink2, 'center', 10)
    },
    [field, src, rcv, tgt, heading, showTime, showSe, rho, rhoBlind, beta],
  )

  usePointer(ref, {
    onDown: (x, y) => {
      const f = frame.current
      if (!f) return false
      const scale = f.w / WKM
      const near = (p: Pt): number => Math.hypot(x - (f.x + p.x * scale), y - (f.y + (HKM - p.y) * scale))
      const options: Array<[Handle, number]> = [
        ['tgt', near(tgt)],
        ['src', near(src)],
        ['rcv', near(rcv)],
      ]
      const [which, d] = options.reduce((a, b) => (b[1] < a[1] ? b : a))
      drag.current = d < 30 ? which : null
      return drag.current !== null
    },
    onMove: (x, y, dragging) => {
      const f = frame.current
      if (!f || !dragging) return
      const scale = f.w / WKM
      const p = { x: Math.max(0.5, Math.min(WKM - 0.5, (x - f.x) / scale)), y: Math.max(0.5, Math.min(HKM - 0.5, HKM - (y - f.y) / scale)) }
      if (drag.current === 'src') setSrc(p)
      else if (drag.current === 'rcv') setRcv(p)
      else setTgt(p)
    },
  })

  return (
    <PlaygroundFrame
      title="Bistatic Table"
      hint="Drag the source, the receiver and the target. Thin ellipses are points with the same echo arrival time. The white line is zero signal excess. The red zone is where the echo arrives while the direct blast is still passing."
      tag="PLAN VIEW · ONE PAIR"
      side={
        <>
          <Segmented
            label="Target strength"
            value={tsMode}
            options={[
              { value: 'fixed', label: 'Fixed' },
              { value: 'aspect', label: 'By aspect' },
            ]}
            onChange={setTsMode}
          />
          {tsMode === 'fixed' && <Slider label="Target strength" value={tsFixed} min={0} max={30} step={1} unit="dB" onChange={setTsFixed} />}
          <Slider label="Target heading" value={heading} min={0} max={359} step={1} unit="°T" onChange={setHeading} />
          <Slider label="Target speed" value={speed} min={0} max={25} step={1} unit="kn" onChange={setSpeed} />
          <Slider label="Source level" value={sl} min={200} max={235} step={1} unit="dB" onChange={setSl} />
          <Slider label="Noise at the beam" value={noise} min={40} max={80} step={1} unit="dB" onChange={setNoise} />
          <Slider label="Pulse length" value={tau} min={0.1} max={4} step={0.1} digits={1} unit="s" onChange={setTau} />
          <Toggle label="Equal-time ellipses, every 5 s" checked={showTime} onChange={setShowTime} />
          <Toggle label="Signal excess field" checked={showSe} onChange={setShowSe} />
          <Readouts>
            <Readout label="Source to target" value={fmt(rs / 1000, 1)} unit="km" swatch={Q.source} />
            <Readout label="Target to receiver" value={fmt(rr / 1000, 1)} unit="km" swatch={Q.echo} />
            <Readout label="Baseline" value={fmt(baseline / 1000, 1)} unit="km" />
            <Readout label="Bistatic angle" value={fmt(beta, 0)} unit="°" tone="accent" />
            <Readout label="Echo after blast" value={fmt((rho - baseline) / SOUND_SPEED, 1)} unit="s" tone={blind ? 'bad' : undefined} />
            <Readout label="Equivalent range" value={fmt(equivalentMonostaticRange(m(src), m(rcv), m(tgt)) / 1000, 1)} unit="km" />
            <Readout label="Target strength" value={fmt(ts, 1)} unit="dB" />
            <Readout label="Doppler" value={fmt(doppler, 1)} unit="Hz" />
            <Readout label="Range cell, 400 Hz" value={fmt(bistaticRangeResolutionM(400, beta), 1)} unit="m" />
            <Readout label="Signal excess" value={blind ? 'blind' : fmt(se, 1)} unit={blind ? undefined : 'dB'} tone={!blind && se >= 0 ? 'good' : 'bad'} />
          </Readouts>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 480, cursor: 'grab' }} role="img" aria-label="Bistatic plan view with source, receiver, target, equal-time ellipses and signal excess" />
      {showSe && <Colorbar map={MAP} lo={SE_LO} hi={SE_HI} unit="dB SE" />}
      <Legend
        items={[
          { label: 'Outbound leg', color: Q.source },
          { label: 'Echo leg', color: Q.echo },
          { label: 'Target’s equal-time ellipse', color: C.amber },
          { label: 'Zero signal excess', color: C.ink },
          { label: 'Direct blast blind zone', color: C.critical },
        ]}
      />
    </PlaygroundFrame>
  )
}
