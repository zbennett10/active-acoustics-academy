import { useMemo, useRef, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Legend, Readout, Readouts, Slider } from '../components/ui/controls'
import { dot, hexA, label } from '../components/viz/canvasKit'
import { Plot } from '../components/viz/Plot'
import { C, Q } from '../components/viz/theme'
import { useCanvas, usePointer } from '../components/viz/useCanvas'
import { DEG } from '../lib/db'
import { fmt } from '../lib/format'
import { ambientNoise, beamNoiseDb, integrateBandDb, selfNoiseDb, type Interferer } from '../lib/noise'

const LOGF = Array.from({ length: 121 }, (_v, i) => -2 + (4 * i) / 120)
const N_BEAMS = 36
const TICKS = [-2, -1, 0, 1, 2]
const TICK_TEXT: Record<number, string> = { [-2]: '10 Hz', [-1]: '100 Hz', 0: '1 kHz', 1: '10 kHz', 2: '100 kHz' }
const norm = (a: number): number => ((a % 360) + 360) % 360

export default function NoiseStudio(_: PlaygroundProps): ReactElement {
  const [shipping, setShipping] = useState(0.5)
  const [wind, setWind] = useState(15)
  const [rain, setRain] = useState(0)
  const [fc, setFc] = useState(3.5)
  const [bw, setBw] = useState(400)
  const [di, setDi] = useState(20)
  const [beamwidth, setBeamwidth] = useState(12)
  const [sidelobe, setSidelobe] = useState(-25)
  const [speed, setSpeed] = useState(10)
  const [ships, setShips] = useState<Interferer[]>([
    { bearingDeg: 65, levelDb: 86 },
    { bearingDeg: 250, levelDb: 80 },
  ])
  const geom = useRef<{ cx: number; cy: number; R: number } | null>(null)
  const drag = useRef<number | null>(null)

  const amb = { shipping, windKn: wind, rainMmH: rain }
  const spectra = useMemo(() => {
    const f = LOGF.map((l) => Math.pow(10, l))
    const parts = f.map((x) => ambientNoise(x, { shipping, windKn: wind, rainMmH: rain }))
    return {
      shipping: parts.map((p) => p.shipping),
      wind: parts.map((p) => p.wind),
      rain: parts.map((p) => p.rain),
      thermal: parts.map((p) => p.thermal),
      total: parts.map((p) => p.total),
      self: f.map((x) => selfNoiseDb(x, speed)),
    }
  }, [shipping, wind, rain, speed])

  const f1 = fc - bw / 2000
  const f2 = fc + bw / 2000
  const nsl = ambientNoise(fc, amb).total
  const ambientBand = integrateBandDb((f) => ambientNoise(f, amb).total, Math.max(0.01, f1), f2)
  const selfBand = integrateBandDb((f) => selfNoiseDb(f, speed), Math.max(0.01, f1), f2) - 12
  const modeled = 10 * Math.log10(Math.pow(10, (ambientBand - di) / 10) + Math.pow(10, selfBand / 10))
  const beams = useMemo(
    () => Array.from({ length: N_BEAMS }, (_v, i) => beamNoiseDb(i * (360 / N_BEAMS), ambientBand, di, selfBand, ships, beamwidth, sidelobe)),
    [ambientBand, di, selfBand, ships, beamwidth, sidelobe],
  )
  const quiet = Math.min(...beams)
  const loud = Math.max(...beams)

  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) / 2 - 34
      geom.current = { cx, cy, R }
      const lo = Math.floor((Math.min(quiet, modeled) - 6) / 10) * 10
      const hi = Math.max(lo + 30, Math.ceil((loud + 4) / 10) * 10)
      const rOf = (db: number): number => R * (0.14 + 0.86 * Math.max(0, Math.min(1, (db - lo) / (hi - lo))))

      for (let db = lo; db <= hi; db += 10) {
        ctx.strokeStyle = C.grid
        ctx.beginPath()
        ctx.arc(cx, cy, rOf(db), 0, Math.PI * 2)
        ctx.stroke()
        label(ctx, `${db}`, cx + 4, cy - rOf(db) + 9, C.ink4, 'left', 10)
      }
      for (let a = 0; a < 360; a += 30) {
        label(ctx, a === 0 ? 'BOW 000' : String(a).padStart(3, '0'), cx + Math.sin(a * DEG) * (R + 15), cy - Math.cos(a * DEG) * (R + 13), C.ink3, 'center', 10)
      }

      // One wedge per beam, showing the level that beam measures.
      const half = (360 / N_BEAMS / 2 - 0.8) * DEG
      beams.forEach((v, i) => {
        const a = i * (360 / N_BEAMS) * DEG - Math.PI / 2
        ctx.beginPath()
        ctx.arc(cx, cy, rOf(v), a - half, a + half)
        ctx.arc(cx, cy, rOf(lo), a + half, a - half, true)
        ctx.closePath()
        const excess = v - modeled
        ctx.fillStyle = hexA(excess > 3 ? C.magenta : C.violet, 0.35 + 0.5 * Math.min(1, (v - lo) / (hi - lo)))
        ctx.fill()
      })
      // What an isotropic model predicts for every beam.
      ctx.save()
      ctx.setLineDash([6, 5])
      ctx.strokeStyle = C.ink
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(cx, cy, rOf(modeled), 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      label(ctx, `modeled ${fmt(modeled, 1)} dB`, cx - 6, cy - rOf(modeled) - 9, C.ink, 'right')

      ctx.save()
      ctx.translate(cx, cy)
      ctx.fillStyle = C.accent
      ctx.beginPath()
      ctx.moveTo(0, -11)
      ctx.lineTo(5, 8)
      ctx.lineTo(-5, 8)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      ships.forEach((s, i) => {
        const x = cx + Math.sin(s.bearingDeg * DEG) * (R + 2)
        const y = cy - Math.cos(s.bearingDeg * DEG) * (R + 2)
        dot(ctx, x, y, 7, C.amber)
        label(ctx, `ship ${i + 1} · ${fmt(s.levelDb, 0)} dB`, x + (x > cx ? -12 : 12), y + (y > cy ? 14 : -14), C.amber, x > cx ? 'right' : 'left')
      })
    },
    [beams, modeled, ships, quiet, loud],
  )

  usePointer(ref, {
    onDown: (x, y) => {
      const g = geom.current
      if (!g) return false
      const idx = ships.findIndex((s) => Math.hypot(x - (g.cx + Math.sin(s.bearingDeg * DEG) * (g.R + 2)), y - (g.cy - Math.cos(s.bearingDeg * DEG) * (g.R + 2))) < 28)
      drag.current = idx >= 0 ? idx : null
      return idx >= 0
    },
    onMove: (x, y, dragging) => {
      const g = geom.current
      if (!g || !dragging || drag.current === null) return
      const b = Math.round(norm(Math.atan2(x - g.cx, -(y - g.cy)) / DEG))
      setShips(ships.map((s, i) => (i === drag.current ? { ...s, bearingDeg: b } : s)))
    },
  })

  return (
    <PlaygroundFrame
      title="Noise Studio"
      hint="Top: build the ambient spectrum and see how much lands in the processor band. Bottom: what each beam measures. A model that assumes noise arrives evenly from all directions draws a circle. The sea rarely agrees."
      tag="AMBIENT · SELF · BEAM"
      side={
        <>
          <p className="pg-sub">Environment</p>
          <Slider label="Shipping density" value={shipping} min={0} max={1} step={0.05} digits={2} onChange={setShipping} />
          <Slider label="Wind speed" value={wind} min={0} max={40} step={1} unit="kn" onChange={setWind} />
          <Slider label="Rain rate" value={rain} min={0} max={50} step={1} unit="mm/h" onChange={setRain} />
          <p className="pg-sub">Processor band</p>
          <Slider label="Center frequency" value={fc} min={0.5} max={10} step={0.1} digits={1} unit="kHz" onChange={setFc} />
          <Slider label="Bandwidth" value={bw} min={10} max={900} step={10} unit="Hz" onChange={setBw} />
          <p className="pg-sub">Sensor</p>
          <Slider label="Directivity index" value={di} min={5} max={30} step={1} unit="dB" onChange={setDi} />
          <Slider label="Beamwidth" value={beamwidth} min={4} max={40} step={1} unit="°" onChange={setBeamwidth} />
          <Slider label="Sidelobe level" value={sidelobe} min={-40} max={-10} step={1} unit="dB" onChange={setSidelobe} />
          <Slider label="Own speed" value={speed} min={0} max={30} step={1} unit="kn" onChange={setSpeed} />
          <Slider label="Ship 1 level at the array" value={ships[0].levelDb} min={60} max={105} step={1} unit="dB" onChange={(v) => setShips(ships.map((s, i) => (i === 0 ? { ...s, levelDb: v } : s)))} />
        </>
      }
    >
      <Plot
        ariaLabel="Ambient and self noise spectrum levels against frequency"
        series={[
          { id: 'ship', label: 'Shipping', color: C.blue, x: LOGF, y: spectra.shipping, width: 1.5 },
          { id: 'wind', label: 'Wind and waves', color: C.aqua, x: LOGF, y: spectra.wind, width: 1.5 },
          ...(rain > 0 ? [{ id: 'rain', label: 'Rain', color: C.yellow, x: LOGF, y: spectra.rain, width: 1.5 }] : []),
          { id: 'thermal', label: 'Thermal', color: C.magenta, x: LOGF, y: spectra.thermal, width: 1.5 },
          { id: 'self', label: 'Self noise', color: C.orange, x: LOGF, y: spectra.self, dash: true, width: 1.6 },
          { id: 'total', label: 'Ambient total', color: C.ink, x: LOGF, y: spectra.total, width: 2.4 },
        ]}
        xDomain={[-2, 2]}
        yDomain={[10, 110]}
        xLabel="Frequency"
        yLabel="dB re 1 µPa² / Hz"
        xTicks={TICKS}
        xTickFormat={(v) => TICK_TEXT[v] ?? ''}
        xHover={(v) => (Math.pow(10, v) >= 1 ? `${fmt(Math.pow(10, v), 2)} kHz` : `${fmt(Math.pow(10, v) * 1000, 0)} Hz`)}
        yUnit="dB"
        height={270}
        bands={[{ x0: Math.log10(Math.max(0.01, f1)), x1: Math.log10(f2), color: Q.noise, opacity: 0.35 }]}
        marks={[{ x: Math.log10(fc), label: 'processor band', color: Q.noise }]}
      />
      <div className="stage-pair" style={{ marginTop: '0.8rem', alignItems: 'center' }}>
        <canvas ref={ref} className="pg-canvas" style={{ height: 360, cursor: 'grab' }} role="img" aria-label="Beam noise by bearing compared with an isotropic model" />
        <div>
          <Readouts>
            <Readout label="Spectrum at fc" value={fmt(nsl, 1)} unit="dB/Hz" />
            <Readout label="Ambient in band" value={fmt(ambientBand, 1)} unit="dB" />
            <Readout label="Minus DI" value={fmt(ambientBand - di, 1)} unit="dB" />
            <Readout label="Self noise, beam" value={fmt(selfBand, 1)} unit="dB" swatch={C.orange} />
            <Readout label="Modeled beam noise" value={fmt(modeled, 1)} unit="dB" tone="accent" />
            <Readout label="Quietest beam" value={fmt(quiet, 1)} unit="dB" />
            <Readout label="Loudest beam" value={fmt(loud, 1)} unit="dB" tone="bad" />
            <Readout label="Worst-beam penalty" value={fmt(loud - modeled, 1)} unit="dB" tone="bad" />
          </Readouts>
          <Legend
            items={[
              { label: 'Measured beam noise', color: C.violet },
              { label: 'Beam more than 3 dB above the model', color: C.magenta },
              { label: 'Isotropic model', color: C.ink, dash: true },
              { label: 'Interfering ship, drag it', color: C.amber },
            ]}
          />
          <p className="pg-note">
            <b>Read it like this.</b> The dashed circle is ambient in the band, less directivity index, plus self noise. Each wedge is what that beam would measure. Ships
            raise the beams that point at them and leak into the rest through sidelobes. Measured beam noise is already at the beam output, so it replaces the whole term.
            Subtracting DI from it again would count the array’s gain twice.
          </p>
        </div>
      </div>
    </PlaygroundFrame>
  )
}
