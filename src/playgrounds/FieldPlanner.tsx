import { useMemo, useRef, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Colorbar, Legend, Readout, Readouts, Segmented, Slider, Toggle } from '../components/ui/controls'
import { drawContour, drawField, hexA, label, type Frame } from '../components/viz/canvasKit'
import { C, Q } from '../components/viz/theme'
import { useCanvas, usePointer } from '../components/viz/useCanvas'
import { simpleTlDb } from '../lib/absorption'
import { aspectDeg, type Pt } from '../lib/bistatic'
import { COLORMAPS } from '../lib/colormaps'
import { SOUND_SPEED } from '../lib/db'
import { podFromSe } from '../lib/detection'
import { fmt } from '../lib/format'
import { fastBistaticTs } from './shared'

const WKM = 66
const HKM = 42
const NX = 132
const NY = 84
const MAP = COLORMAPS.abyss

type View = 'pod' | 'count'
type TsMode = 'fixed' | 'aspect'

interface Layout {
  sources: Pt[]
  receivers: Pt[]
}

const LAYOUTS: Record<string, Layout> = {
  barrier: {
    sources: [
      { x: 22, y: 21 },
      { x: 44, y: 21 },
    ],
    receivers: [8, 19, 30, 41, 52, 60].map((x, i) => ({ x, y: i % 2 ? 15 : 27 })),
  },
  cluster: {
    sources: [{ x: 33, y: 21 }],
    receivers: [0, 60, 120, 180, 240, 300].map((a) => ({ x: 33 + 13 * Math.cos((a * Math.PI) / 180), y: 21 + 13 * Math.sin((a * Math.PI) / 180) })),
  },
  pair: { sources: [{ x: 24, y: 21 }], receivers: [{ x: 42, y: 21 }] },
}

export default function FieldPlanner({ preset }: PlaygroundProps): ReactElement {
  const start = LAYOUTS[preset ?? ''] ?? LAYOUTS.barrier
  const [sources, setSources] = useState<Pt[]>(start.sources)
  const [receivers, setReceivers] = useState<Pt[]>(start.receivers)
  const [sl, setSl] = useState(220)
  const [noise, setNoise] = useState(58)
  const [tau, setTau] = useState(1)
  const [tsMode, setTsMode] = useState<TsMode>('fixed')
  const [tsFixed, setTsFixed] = useState(12)
  const [heading, setHeading] = useState(90)
  const [mono, setMono] = useState(false)
  const [view, setView] = useState<View>('pod')
  const frame = useRef<Frame | null>(null)
  const drag = useRef<{ kind: 's' | 'r'; i: number } | null>(null)

  const result = useMemo(() => {
    const pod = new Float32Array(NX * NY)
    const count = new Float32Array(NX * NY)
    const pairs = sources.flatMap((s) => [...receivers, ...(mono ? [s] : [])].map((r) => ({ s, r, blind: Math.hypot(s.x - r.x, s.y - r.y) * 1000 + SOUND_SPEED * tau })))
    let covered = 0
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const p = { x: ((i + 0.5) / NX) * WKM, y: HKM - ((j + 0.5) / NY) * HKM }
        let miss = 1
        let n = 0
        for (const { s, r, blind } of pairs) {
          const rs = Math.hypot(p.x - s.x, p.y - s.y) * 1000
          const rr = Math.hypot(p.x - r.x, p.y - r.y) * 1000
          if (rs + rr < blind) continue
          const ts = tsMode === 'fixed' ? tsFixed : fastBistaticTs(aspectDeg(p, heading, s), aspectDeg(p, heading, r))
          const se = sl - simpleTlDb(rs, 3.5) - simpleTlDb(rr, 3.5) + ts - noise - 10
          miss *= 1 - podFromSe(se, 8)
          if (se >= 0) n++
        }
        pod[j * NX + i] = 1 - miss
        count[j * NX + i] = n
        if (1 - miss >= 0.5) covered++
      }
    }
    const cell = (WKM / NX) * (HKM / NY)
    return { pod, count, pairs: pairs.length, area: covered * cell, frac: covered / (NX * NY), mean: pod.reduce((a, b) => a + b, 0) / pod.length }
  }, [sources, receivers, sl, noise, tau, tsMode, tsFixed, heading, mono])

  const maxCount = Math.max(1, Math.min(8, result.pairs))

  const ref = useCanvas(
    (ctx, w, h) => {
      const scale = Math.min((w - 20) / WKM, (h - 20) / HKM)
      const f: Frame = { x: (w - WKM * scale) / 2, y: (h - HKM * scale) / 2, w: WKM * scale, h: HKM * scale, x0: 0, x1: WKM, y0: HKM, y1: 0 }
      frame.current = f
      const X = (p: Pt): number => f.x + p.x * scale
      const Y = (p: Pt): number => f.y + (HKM - p.y) * scale
      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      if (view === 'pod') drawField(ctx, f, result.pod, NX, NY, 0, 1, MAP.lut)
      else drawField(ctx, f, result.count, NX, NY, 0, maxCount, COLORMAPS.viridis.lut, false, false)
      drawContour(ctx, f, result.pod, NX, NY, 0.5, 'rgba(255,255,255,0.9)', 1.6)

      ctx.save()
      ctx.beginPath()
      ctx.rect(f.x, f.y, f.w, f.h)
      ctx.clip()
      ctx.strokeStyle = 'rgba(232,240,246,0.1)'
      ctx.lineWidth = 1
      for (const s of sources) {
        for (const r of receivers) {
          ctx.beginPath()
          ctx.moveTo(X(s), Y(s))
          ctx.lineTo(X(r), Y(r))
          ctx.stroke()
        }
      }
      ctx.restore()
      ctx.strokeStyle = C.axis
      ctx.strokeRect(f.x + 0.5, f.y + 0.5, f.w, f.h)

      receivers.forEach((r, i) => {
        ctx.beginPath()
        ctx.arc(X(r), Y(r), 9, 0, Math.PI * 2)
        ctx.fillStyle = C.bg
        ctx.fill()
        ctx.beginPath()
        ctx.arc(X(r), Y(r), 6.5, 0, Math.PI * 2)
        ctx.fillStyle = C.accent
        ctx.shadowColor = C.accent
        ctx.shadowBlur = 12
        ctx.fill()
        ctx.shadowBlur = 0
        label(ctx, `R${i + 1}`, X(r), Y(r) + 18, C.accent, 'center', 10)
      })
      sources.forEach((s, i) => {
        ctx.save()
        ctx.translate(X(s), Y(s))
        ctx.beginPath()
        ctx.moveTo(0, -12)
        ctx.lineTo(11, 8)
        ctx.lineTo(-11, 8)
        ctx.closePath()
        ctx.fillStyle = C.bg
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(0, -8.5)
        ctx.lineTo(7.5, 5.5)
        ctx.lineTo(-7.5, 5.5)
        ctx.closePath()
        ctx.fillStyle = '#6da7ec'
        ctx.shadowColor = Q.source
        ctx.shadowBlur = 14
        ctx.fill()
        ctx.restore()
        label(ctx, `S${i + 1}`, X(s), Y(s) - 19, '#8bbcf5', 'center', 10)
      })
      ctx.strokeStyle = C.ink2
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(f.x + 14, f.y + f.h - 14)
      ctx.lineTo(f.x + 14 + 10 * scale, f.y + f.h - 14)
      ctx.stroke()
      label(ctx, '10 km', f.x + 14 + 5 * scale, f.y + f.h - 24, C.ink2, 'center', 10)
      if (tsMode === 'aspect') label(ctx, `target heading ${String(heading).padStart(3, '0')}`, f.x + f.w - 12, f.y + 14, hexA(C.amber, 1), 'right')
    },
    [result, sources, receivers, view, maxCount, tsMode, heading],
  )

  usePointer(ref, {
    onDown: (x, y) => {
      const f = frame.current
      if (!f) return false
      const scale = f.w / WKM
      const d = (p: Pt): number => Math.hypot(x - (f.x + p.x * scale), y - (f.y + (HKM - p.y) * scale))
      const all = [...sources.map((p, i) => ({ kind: 's' as const, i, d: d(p) })), ...receivers.map((p, i) => ({ kind: 'r' as const, i, d: d(p) }))]
      const best = all.reduce((a, b) => (b.d < a.d ? b : a), all[0])
      drag.current = best && best.d < 28 ? { kind: best.kind, i: best.i } : null
      return drag.current !== null
    },
    onMove: (x, y, dragging) => {
      const f = frame.current
      const g = drag.current
      if (!f || !dragging || !g) return
      const scale = f.w / WKM
      const p = { x: Math.max(1, Math.min(WKM - 1, (x - f.x) / scale)), y: Math.max(1, Math.min(HKM - 1, HKM - (y - f.y) / scale)) }
      if (g.kind === 's') setSources(sources.map((s, i) => (i === g.i ? p : s)))
      else setReceivers(receivers.map((r, i) => (i === g.i ? p : r)))
    },
  })

  const load = (id: string): void => {
    setSources(LAYOUTS[id].sources)
    setReceivers(LAYOUTS[id].receivers)
  }

  return (
    <PlaygroundFrame
      title="Field Planner"
      hint="Triangles transmit, circles listen. Every source pairs with every receiver. The map shows the chance that at least one pair detects a target at each point. The white line is 50 percent. Drag the nodes and close the holes."
      tag="MULTISTATIC COVERAGE"
      side={
        <>
          <div className="ctl">
            <span className="ctl-label">Start from a layout</span>
            <div className="seg">
              <button type="button" onClick={() => load('pair')}>One pair</button>
              <button type="button" onClick={() => load('cluster')}>Ring</button>
              <button type="button" onClick={() => load('barrier')}>Barrier</button>
            </div>
          </div>
          <div className="ctl">
            <span className="ctl-label">Nodes</span>
            <div className="seg">
              <button type="button" onClick={() => sources.length < 4 && setSources([...sources, { x: 12 + sources.length * 9, y: 34 }])}>+ Source</button>
              <button type="button" onClick={() => sources.length > 1 && setSources(sources.slice(0, -1))}>− Source</button>
              <button type="button" onClick={() => receivers.length < 10 && setReceivers([...receivers, { x: 10 + receivers.length * 5, y: 7 }])}>+ Receiver</button>
              <button type="button" onClick={() => receivers.length > 1 && setReceivers(receivers.slice(0, -1))}>− Receiver</button>
            </div>
          </div>
          <Segmented
            label="Show"
            value={view}
            options={[
              { value: 'pod', label: 'Detection probability' },
              { value: 'count', label: 'Pairs detecting' },
            ]}
            onChange={setView}
          />
          <Toggle label="Sources also listen (adds monostatic pairs)" checked={mono} onChange={setMono} />
          <Segmented
            label="Target strength"
            value={tsMode}
            options={[
              { value: 'fixed', label: 'Fixed' },
              { value: 'aspect', label: 'By aspect' },
            ]}
            onChange={setTsMode}
          />
          {tsMode === 'fixed' ? (
            <Slider label="Target strength" value={tsFixed} min={0} max={30} step={1} unit="dB" onChange={setTsFixed} />
          ) : (
            <Slider label="Target heading" value={heading} min={0} max={359} step={1} unit="°T" onChange={setHeading} />
          )}
          <Slider label="Source level" value={sl} min={200} max={230} step={1} unit="dB" onChange={setSl} />
          <Slider label="Noise at the beam" value={noise} min={45} max={80} step={1} unit="dB" onChange={setNoise} />
          <Slider label="Pulse length" value={tau} min={0.1} max={4} step={0.1} digits={1} unit="s" onChange={setTau} />
          <Readouts>
            <Readout label="Pairs" value={`${result.pairs}`} unit={`${sources.length} × ${receivers.length}${mono ? ' + mono' : ''}`} tone="accent" />
            <Readout label="Area at 50% or better" value={fmt(result.area, 0)} unit="km²" tone="good" />
            <Readout label="Share of the box" value={fmt(result.frac * 100, 0)} unit="%" />
            <Readout label="Mean probability" value={fmt(result.mean * 100, 0)} unit="%" />
          </Readouts>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 470, cursor: 'grab' }} role="img" aria-label="Multistatic coverage map with sources and receivers" />
      {view === 'pod' ? <Colorbar map={MAP} lo={0} hi={100} unit="% Pd" /> : <Colorbar map={COLORMAPS.viridis} lo={0} hi={maxCount} unit="pairs" />}
      <Legend
        items={[
          { label: 'Source', color: '#6da7ec' },
          { label: 'Receiver', color: C.accent },
          { label: '50% detection contour', color: C.ink },
        ]}
      />
      <p className="pg-note">
        <b>Try this.</b> Switch target strength to By aspect and sweep the heading. With one pair the coverage swings wildly as the hull’s mirror direction turns. Add
        receivers at different bearings and the swings even out: some pair almost always has a favorable look.
      </p>
    </PlaygroundFrame>
  )
}
