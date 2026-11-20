import { useDeferredValue, useMemo, useRef, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Colorbar, Legend, Readout, Readouts, Segmented, Slider } from '../components/ui/controls'
import { dot, drawField, hexA, label, type Frame } from '../components/viz/canvasKit'
import { C } from '../components/viz/theme'
import { useCanvas, usePointer } from '../components/viz/useCanvas'
import { COLORMAPS } from '../lib/colormaps'
import { DEG, SOUND_SPEED } from '../lib/db'
import { fmt } from '../lib/format'
import { NOTIONAL_TARGET, bistaticAngleFromAspects, bistaticTsDb, monostaticTsDb } from '../lib/target'

const TS_LO = -5
const TS_HI = 45
const POLAR_LO = 0
const POLAR_HI = 34
const GRID = 120
const MAP = COLORMAPS.magma

type Mode = 'mono' | 'bi'
const norm = (a: number): number => ((a % 360) + 360) % 360

export default function TsStudio({ preset }: PlaygroundProps): ReactElement {
  const [mode, setMode] = useState<Mode>(preset === 'bistatic' ? 'bi' : 'mono')
  const [freq, setFreq] = useState(3.5)
  const [de, setDe] = useState(0)
  const [inA, setInA] = useState(preset === 'bistatic' ? 60 : 90)
  const [outA, setOutA] = useState(120)
  const geom = useRef<{ cx: number; cy: number; R: number; map: Frame } | null>(null)
  const drag = useRef<'in' | 'out' | 'map' | null>(null)
  const q = useDeferredValue({ freq, de })

  const heat = useMemo(() => {
    const v = new Float32Array(GRID * GRID)
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) v[j * GRID + i] = bistaticTsDb(NOTIONAL_TARGET, (i + 0.5) * (360 / GRID), 360 - (j + 0.5) * (360 / GRID), q.freq, q.de)
    }
    return v
  }, [q])

  const pattern = useMemo(
    () => Array.from({ length: 361 }, (_v, a) => (mode === 'mono' ? monostaticTsDb(NOTIONAL_TARGET, a, freq, de) : bistaticTsDb(NOTIONAL_TARGET, inA, a, freq, de))),
    [mode, freq, de, inA],
  )

  const rcv = mode === 'mono' ? inA : outA
  const ts = bistaticTsDb(NOTIONAL_TARGET, inA, rcv, freq, de)
  const beta = bistaticAngleFromAspects(inA, rcv)
  const lambda = SOUND_SPEED / (freq * 1000)
  const lobe = (lambda / NOTIONAL_TARGET.coherentLengthM) / DEG
  const peak = Math.max(...pattern)

  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      const stacked = w < 700
      const pw = stacked ? w : Math.round(w * 0.54)
      const ph = stacked ? Math.round(h * 0.55) : h
      const cx = pw / 2
      const cy = ph / 2
      const R = Math.min(pw / 2 - 64, ph / 2 - 30)
      const rOf = (db: number): number => R * (0.14 + 0.86 * Math.max(0, Math.min(1, (db - POLAR_LO) / (POLAR_HI - POLAR_LO))))
      const pt = (aspect: number, r: number): [number, number] => [cx + Math.sin(aspect * DEG) * r, cy - Math.cos(aspect * DEG) * r]

      for (const db of [10, 20, 30]) {
        ctx.strokeStyle = C.grid
        ctx.beginPath()
        ctx.arc(cx, cy, rOf(db), 0, Math.PI * 2)
        ctx.stroke()
        label(ctx, `${db} dB`, cx + 4, cy - rOf(db) - 7, C.ink4, 'left', 10)
      }
      for (let a = 0; a < 360; a += 30) {
        const [x1, y1] = pt(a, R)
        ctx.strokeStyle = C.grid
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(x1, y1)
        ctx.stroke()
        const [lx, ly] = pt(a, R + 14)
        label(ctx, a === 0 ? 'BOW' : a === 180 ? 'STERN' : a === 90 ? 'STBD BEAM' : a === 270 ? 'PORT BEAM' : `${a}°`, lx, ly, C.ink3, 'center', 10)
      }

      ctx.save()
      ctx.beginPath()
      pattern.forEach((v, a) => {
        const [x, y] = pt(a, rOf(v))
        if (a === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.fillStyle = hexA(C.orange, 0.2)
      ctx.fill()
      ctx.shadowColor = C.orange
      ctx.shadowBlur = 14
      ctx.strokeStyle = '#ff8a52'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()

      // Hull, bow up.
      ctx.save()
      ctx.translate(cx, cy)
      ctx.fillStyle = '#16242f'
      ctx.strokeStyle = C.ink3
      ctx.lineWidth = 1.2
      const hl = rOf(POLAR_LO) * 0.92
      ctx.beginPath()
      ctx.moveTo(0, -hl)
      ctx.bezierCurveTo(hl * 0.3, -hl * 0.8, hl * 0.26, hl * 0.5, 0, hl)
      ctx.bezierCurveTo(-hl * 0.26, hl * 0.5, -hl * 0.3, -hl * 0.8, 0, -hl)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = C.ink3
      ctx.fillRect(-hl * 0.07, -hl * 0.42, hl * 0.14, hl * 0.3)
      ctx.restore()

      const [sxp, syp] = pt(inA, R - 2)
      ctx.strokeStyle = hexA(C.blue, 0.8)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(sxp, syp)
      ctx.lineTo(...pt(inA, rOf(POLAR_LO)))
      ctx.stroke()
      if (mode === 'bi') {
        const [rxp, ryp] = pt(outA, R - 2)
        ctx.strokeStyle = hexA(C.accent, 0.8)
        ctx.beginPath()
        ctx.moveTo(...pt(outA, rOf(POLAR_LO)))
        ctx.lineTo(rxp, ryp)
        ctx.stroke()
        dot(ctx, rxp, ryp, 7, C.accent)
        label(ctx, 'RX', rxp, ryp - 15, C.accent, 'center')
        dot(ctx, ...pt(outA, rOf(ts)), 4, C.ink)
      } else {
        dot(ctx, ...pt(inA, rOf(ts)), 4, C.ink)
      }
      dot(ctx, sxp, syp, 7, C.blue)
      label(ctx, mode === 'mono' ? 'SONAR' : 'TX', sxp, syp - 15, '#6da7ec', 'center')

      // Incident by scattered aspect map.
      const mw = stacked ? w - 78 : w - pw - 70
      const mh = stacked ? h - ph - 50 : h - 62
      const side = Math.min(mw, mh)
      const map: Frame = { x: (stacked ? 0 : pw) + 52, y: stacked ? ph + 14 : Math.max(14, (h - side - 36) / 2), w: side, h: side, x0: 0, x1: 360, y0: 360, y1: 0 }
      geom.current = { cx, cy, R, map }
      drawField(ctx, map, heat, GRID, GRID, TS_LO, TS_HI, MAP.lut)
      ctx.strokeStyle = C.axis
      ctx.strokeRect(map.x + 0.5, map.y + 0.5, map.w, map.h)
      ctx.strokeStyle = 'rgba(232,240,246,0.55)'
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(map.x, map.y + map.h)
      ctx.lineTo(map.x + map.w, map.y)
      ctx.stroke()
      ctx.setLineDash([])
      label(ctx, 'monostatic', map.x + map.w * 0.86, map.y + map.h * 0.2, C.ink, 'right', 10)
      for (const a of [0, 90, 180, 270, 360]) {
        label(ctx, `${a}`, map.x + (a / 360) * map.w, map.y + map.h + 11, C.ink3, 'center', 10)
        label(ctx, `${a}`, map.x - 7, map.y + map.h - (a / 360) * map.h, C.ink3, 'right', 10)
      }
      label(ctx, 'SOURCE ASPECT (deg)', map.x + map.w / 2, map.y + map.h + 28, C.ink3, 'center', 10)
      ctx.save()
      ctx.translate(map.x - 38, map.y + map.h / 2)
      ctx.rotate(-Math.PI / 2)
      label(ctx, 'RECEIVER ASPECT (deg)', 0, 0, C.ink3, 'center', 10)
      ctx.restore()
      const mx = map.x + (inA / 360) * map.w
      const my = map.y + map.h - (rcv / 360) * map.h
      ctx.strokeStyle = C.ink
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(mx, my, 7, 0, Math.PI * 2)
      ctx.moveTo(mx - 12, my)
      ctx.lineTo(mx + 12, my)
      ctx.moveTo(mx, my - 12)
      ctx.lineTo(mx, my + 12)
      ctx.stroke()
    },
    [pattern, heat, inA, outA, mode, ts],
  )

  usePointer(ref, {
    onDown: (x, y) => {
      const g = geom.current
      if (!g) return false
      const hit = (a: number): boolean => Math.hypot(x - (g.cx + Math.sin(a * DEG) * (g.R - 2)), y - (g.cy - Math.cos(a * DEG) * (g.R - 2))) < 26
      if (mode === 'bi' && hit(outA)) drag.current = 'out'
      else if (hit(inA)) drag.current = 'in'
      else if (x >= g.map.x && x <= g.map.x + g.map.w && y >= g.map.y && y <= g.map.y + g.map.h) drag.current = 'map'
      else if (Math.hypot(x - g.cx, y - g.cy) < g.R + 20) drag.current = 'in'
      else drag.current = null
      return drag.current !== null
    },
    onMove: (x, y, dragging) => {
      const g = geom.current
      if (!g || !dragging) return
      if (drag.current === 'map') {
        const a = Math.round(norm(((x - g.map.x) / g.map.w) * 360))
        const b = Math.round(norm((1 - (y - g.map.y) / g.map.h) * 360))
        setInA(Math.min(359, a))
        if (mode === 'bi') setOutA(Math.min(359, b))
        return
      }
      const a = Math.round(norm(Math.atan2(x - g.cx, -(y - g.cy)) / DEG))
      if (drag.current === 'out') setOutA(a)
      else setInA(a)
    },
  })

  return (
    <PlaygroundFrame
      title="Target Strength Studio"
      hint="A notional 60 m hull, seen from above with the bow up. The orange curve is target strength against the direction you look from. Drag the sonar around it, then switch to bistatic and separate the receiver."
      tag="NOTIONAL TARGET"
      side={
        <>
          <Segmented
            label="Geometry"
            value={mode}
            options={[
              { value: 'mono', label: 'Monostatic' },
              { value: 'bi', label: 'Bistatic' },
            ]}
            onChange={setMode}
          />
          <Slider label={mode === 'mono' ? 'Aspect (0 is bow)' : 'Source aspect'} value={inA} min={0} max={359} step={1} unit="°" onChange={setInA} />
          {mode === 'bi' && <Slider label="Receiver aspect" value={outA} min={0} max={359} step={1} unit="°" onChange={setOutA} />}
          <Slider label="Frequency" value={freq} min={1} max={10} step={0.5} digits={1} unit="kHz" onChange={setFreq} />
          <Slider label="D/E angle at the target" value={de} min={-60} max={60} step={1} unit="°" onChange={setDe} />
          <Readouts>
            <Readout label="Target strength" value={fmt(ts, 1)} unit="dB" tone="accent" />
            <Readout label="Bistatic angle" value={fmt(beta, 0)} unit="°" />
            <Readout label="Wavelength" value={fmt(lambda, 2)} unit="m" />
            <Readout label="Beam lobe width" value={fmt(lobe, 1)} unit="°" />
            <Readout label="Pattern peak" value={fmt(peak, 1)} unit="dB" />
            <Readout label="Peak − now" value={fmt(peak - ts, 1)} unit="dB" />
          </Readouts>
          <p className="pg-note">
            {mode === 'mono'
              ? 'Bright at the beams, weak at bow and stern: the butterfly. The sharp spike is the mirror-like flash from the parallel midbody, only a degree or two wide.'
              : beta > 150
                ? 'Near 180° the receiver sits behind the target. Forward scatter is enormous, and so is the direct blast it hides in.'
                : 'The bright lobe is the mirror direction: the hull reflects like a pane of glass. Its position follows the source.'}
          </p>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 460, cursor: 'grab' }} role="img" aria-label="Polar target strength pattern and a map of bistatic target strength" />
      <Colorbar map={MAP} lo={TS_LO} hi={TS_HI} unit="dB" />
      <Legend
        items={[
          { label: 'Target strength pattern', color: '#ff8a52' },
          { label: mode === 'mono' ? 'Sonar direction' : 'Source direction', color: C.blue },
          ...(mode === 'bi' ? [{ label: 'Receiver direction', color: C.accent }] : []),
        ]}
      />
    </PlaygroundFrame>
  )
}
