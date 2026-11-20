import { useMemo, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Colorbar, Slider, Toggle } from '../components/ui/controls'
import { drawAxes, drawContour, drawField, label, makeFrame, sx, sy } from '../components/viz/canvasKit'
import { C, Q } from '../components/viz/theme'
import { useCanvas } from '../components/viz/useCanvas'
import { COLORMAPS, paintField } from '../lib/colormaps'
import { DEG, powerSumDb } from '../lib/db'
import { podFromSe } from '../lib/detection'
import { fmt } from '../lib/format'
import { beamNoiseDb } from '../lib/noise'
import { reverbAtRange, type ReverbInputs } from '../lib/reverb'
import { tlAt } from '../lib/tlfield'
import { getField } from './shared'

const SL = 220
const TS = 12
const DT = 10
const MAP = COLORMAPS.abyss
const REVERB: ReverbInputs = { slDb: SL, fKhz: 3.5, tauEff: 0.02, horizBeamDeg: 10, vertBeamDeg: 18, sourceDepth: 40, waterDepth: 400, muDb: -27, windKn: 12, svDb: -84, ductGrazingDeg: 5 }
const SHIP = [{ bearingDeg: 120, levelDb: 84 }]

interface Stage {
  id: string
  title: string
  x: number
  y: number
  color: string
  formula: string
  dims: string[]
  units: string
  watch: string[]
}

const W = 190
const H = 76
const STAGES: Stage[] = [
  { id: 'env', title: 'Environment', x: 16, y: 18, color: C.ink3, formula: 'Sound speed profile, bathymetry, bottom type, wind and shipping', dims: ['bearing radial', 'range', 'depth'], units: 'm/s, m, province codes, knots', watch: ['Profile must reach the seabed', 'Climatology or in situ: record which', 'Range dependence is sampled along each radial'] },
  { id: 'sensor', title: 'Sensor + processors', x: 16, y: 148, color: C.ink3, formula: 'Depth, beams and their D/E, source level, then per processor: band, waveform, DT', dims: ['sensor', 'processor', 'beam'], units: 'm, deg, dB, Hz, s', watch: ['Depth and beams belong to the sensor', 'Band, pulse and DT belong to the processor', 'One sensor fans out into many result sets'] },
  { id: 'target', title: 'Target', x: 16, y: 278, color: C.ink3, formula: 'Depth and a target strength table', dims: ['aspect', 'D/E', 'frequency'], units: 'm, dB re 1 m²', watch: ['Aspect convention: 0 at the bow', 'Monostatic table or bistatic table', 'A single number hides 20 dB of aspect swing'] },
  { id: 'prop', title: 'Propagation engine', x: 246, y: 18, color: Q.source, formula: 'Eigenrays, then loss:  TL(bearing, range, depth)', dims: ['sensor', 'band', 'bearing', 'range', 'depth'], units: 'dB re 1 m, one way', watch: ['One-way or two-way?', 'Coherent, incoherent or band averaged?', 'Per-path D/E sign convention', 'Loss is positive: do not subtract twice'] },
  { id: 'echo', title: 'Echo level', x: 476, y: 18, color: Q.echo, formula: 'EL = SL − TL out − TL back + TS', dims: ['sensor', 'processor', 'bearing', 'range', 'depth'], units: 'dB re 1 µPa', watch: ['Monostatic: both losses are the same number', 'Bistatic: two different loss fields', 'TS looked up at the D/E the path arrives on'] },
  { id: 'reverb', title: 'Reverberation', x: 476, y: 148, color: Q.reverb, formula: 'RL(time) from boundary and volume scatter, mapped to range', dims: ['sensor', 'processor', 'beam', 'range'], units: 'dB re 1 µPa at the beam output', watch: ['Depends on pulse: per processor', 'Measured reverb already includes noise', 'Time to range needs the geometry'] },
  { id: 'noise', title: 'Noise', x: 476, y: 278, color: Q.noise, formula: 'Modeled: NL + 10 log B − DI.  Measured: beam noise as recorded', dims: ['sensor', 'processor', 'beam'], units: 'dB re 1 µPa at the beam output', watch: ['Spectrum level or band level?', 'Measured beam noise already has array gain', 'Beam to bearing needs own heading'] },
  { id: 'mask', title: 'Masking level', x: 706, y: 213, color: Q.dt, formula: 'Mask = 10 log(10^(N/10) + 10^(RL/10))', dims: ['sensor', 'processor', 'bearing', 'range'], units: 'dB re 1 µPa', watch: ['Power sum, never arithmetic', 'Both terms at the same point in the chain'] },
  { id: 'se', title: 'Signal excess', x: 706, y: 60, color: Q.se, formula: 'SE = EL − Mask − DT', dims: ['sensor', 'processor', 'bearing', 'range', 'depth'], units: 'dB', watch: ['Zero means 50 percent, not zero chance', 'Where is processing gain booked?', 'Interpolate in dB with care near shadows'] },
  { id: 'pod', title: 'Prob. of detection', x: 936, y: 18, color: Q.se, formula: 'Pd = Φ(SE / σ)', dims: ['sensor', 'processor', 'bearing', 'range', 'depth'], units: '0 to 1', watch: ['σ is an input, state it', 'Combine processors and pings downstream'] },
  { id: 'display', title: 'Display products', x: 936, y: 148, color: C.accent, formula: 'Full-field: range × depth at one bearing.  Plan view: bearing × range at one depth', dims: ['slices of the same result set'], units: 'pixels with a legend', watch: ['Polar to geographic resampling', 'Color range and thresholds are choices', 'Label modeled against measured inputs'] },
]

const EDGES: Array<[string, string]> = [
  ['env', 'prop'], ['sensor', 'prop'], ['prop', 'echo'], ['target', 'echo'], ['prop', 'reverb'], ['sensor', 'reverb'], ['sensor', 'noise'], ['env', 'noise'],
  ['echo', 'se'], ['reverb', 'mask'], ['noise', 'mask'], ['mask', 'se'], ['se', 'pod'], ['se', 'display'], ['pod', 'display'],
]

export default function PipelineExplorer(_: PlaygroundProps): ReactElement {
  const [sel, setSel] = useState('prop')
  const [bearing, setBearing] = useState(120)
  const [rangeKm, setRangeKm] = useState(14)
  const [depth, setDepth] = useState(60)
  const [measNoise, setMeasNoise] = useState(false)
  const [measReverb, setMeasReverb] = useState(false)
  const field = useMemo(() => getField('surface-duct', 40, 3.5), [])
  const rMaxKm = field.rMax / 1000

  const noiseAt = (b: number): number => (measNoise ? beamNoiseDb(b, 78, 20, 40, SHIP, 16, -24) : 58)
  const reverbAt = (rKm: number): number => reverbAtRange(REVERB, rKm * 1000).total + (measReverb ? 6 : 0)
  const seAt = (b: number, rKm: number, z: number): number => SL - 2 * tlAt(field, rKm * 1000, z) + TS - powerSumDb([noiseAt(b), reverbAt(rKm)]) - DT

  const tl = tlAt(field, rangeKm * 1000, depth)
  const el = SL - 2 * tl + TS
  const noise = noiseAt(bearing)
  const rl = reverbAt(rangeKm)
  const mask = powerSumDb([noise, rl])
  const se = el - mask - DT
  const values: Record<string, string> = {
    env: 'profile + seabed',
    sensor: `SL ${SL} · DT ${DT}`,
    target: `TS ${TS} dB`,
    prop: `TL ${fmt(tl, 1)} dB`,
    echo: `EL ${fmt(el, 1)} dB`,
    reverb: `RL ${fmt(rl, 1)} dB`,
    noise: `N ${fmt(noise, 1)} dB`,
    mask: `${fmt(mask, 1)} dB`,
    se: `SE ${fmt(se, 1)} dB`,
    pod: `${fmt(podFromSe(se) * 100, 0)} %`,
    display: 'two slices below',
  }
  const stage = STAGES.find((s) => s.id === sel) ?? STAGES[0]
  const byId = (id: string): Stage => STAGES.find((s) => s.id === id) as Stage

  // Full-field slice, range by depth at the chosen bearing.
  const full = useMemo(() => {
    const v = new Float32Array(field.nr * field.nz)
    const n = measNoise ? beamNoiseDb(bearing, 78, 20, 40, SHIP, 16, -24) : 58
    for (let i = 0; i < field.nr; i++) {
      const rKm = ((i + 0.5) / field.nr) * rMaxKm
      const m = powerSumDb([n, reverbAtRange(REVERB, rKm * 1000).total + (measReverb ? 6 : 0)])
      for (let j = 0; j < field.nz; j++) {
        const t = field.tl[j * field.nr + i]
        v[j * field.nr + i] = Number.isNaN(t) ? NaN : SL - 2 * t + TS - m - DT
      }
    }
    return v
  }, [field, bearing, measNoise, measReverb, rMaxKm])

  const fullRef = useCanvas(
    (ctx, w, h) => {
      const zShow = 700
      const f = makeFrame(w, h, [0, rMaxKm], [0, zShow])
      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      ctx.save()
      ctx.beginPath()
      ctx.rect(f.x, f.y, f.w, f.h)
      ctx.clip()
      const tall = { ...f, h: (f.h * field.zMax) / zShow }
      drawField(ctx, tall, full, field.nr, field.nz, -30, 30, MAP.lut)
      drawContour(ctx, tall, full, field.nr, field.nz, 0, 'rgba(255,255,255,0.85)', 1.3)
      ctx.restore()
      drawAxes(ctx, f, { xLabel: 'Range (km)', yLabel: 'Depth (m)', grid: false, yTicks: 4 })
      ctx.setLineDash([6, 5])
      ctx.strokeStyle = C.amber
      ctx.beginPath()
      ctx.moveTo(f.x, sy(f, depth))
      ctx.lineTo(f.x + f.w, sy(f, depth))
      ctx.stroke()
      ctx.setLineDash([])
      label(ctx, 'plan view cuts here', f.x + f.w - 6, sy(f, depth) - 9, C.amber, 'right', 10)
      ctx.beginPath()
      ctx.arc(sx(f, rangeKm), sy(f, depth), 6, 0, Math.PI * 2)
      ctx.strokeStyle = C.ink
      ctx.lineWidth = 2
      ctx.stroke()
      label(ctx, `FULL-FIELD · bearing ${String(bearing).padStart(3, '0')}`, f.x + 8, f.y + f.h - 12, C.ink)
    },
    [full, depth, rangeKm, bearing],
  )

  const planRef = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      const n = 200
      const vals = new Float32Array(n * n)
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = (i + 0.5) / n - 0.5
          const y = 0.5 - (j + 0.5) / n
          const r = Math.hypot(x, y) * 2
          if (r > 1) {
            vals[j * n + i] = NaN
            continue
          }
          const b = (Math.atan2(x, y) / DEG + 360) % 360
          vals[j * n + i] = seAt(b, Math.max(0.05, r * rMaxKm), depth)
        }
      }
      const R = Math.min(w, h) / 2 - 20
      const cx = w / 2
      const cy = h / 2
      const off = document.createElement('canvas')
      off.width = n
      off.height = n
      const octx = off.getContext('2d')
      if (octx) {
        const img = octx.createImageData(n, n)
        paintField(vals, img.data, -30, 30, MAP.lut, false, [4, 10, 17])
        octx.putImageData(img, 0, 0)
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(off, cx - R, cy - R, 2 * R, 2 * R)
      }
      drawContour(ctx, { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R, x0: 0, x1: 1, y0: 0, y1: 1 }, vals, n, n, 0, 'rgba(255,255,255,0.85)', 1.3)
      ctx.strokeStyle = C.axis
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.stroke()
      for (let a = 0; a < 360; a += 45) label(ctx, String(a).padStart(3, '0'), cx + Math.sin(a * DEG) * (R + 12), cy - Math.cos(a * DEG) * (R + 11), C.ink3, 'center', 10)
      ctx.setLineDash([6, 5])
      ctx.strokeStyle = C.amber
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.sin(bearing * DEG) * R, cy - Math.cos(bearing * DEG) * R)
      ctx.stroke()
      ctx.setLineDash([])
      const rr = (rangeKm / rMaxKm) * R
      ctx.beginPath()
      ctx.arc(cx + Math.sin(bearing * DEG) * rr, cy - Math.cos(bearing * DEG) * rr, 6, 0, Math.PI * 2)
      ctx.strokeStyle = C.ink
      ctx.lineWidth = 2
      ctx.stroke()
      label(ctx, `PLAN VIEW · depth ${depth} m`, 8, 12, C.ink)
      if (measNoise) label(ctx, 'ship', cx + Math.sin(120 * DEG) * (R - 12), cy - Math.cos(120 * DEG) * (R - 12), C.amber, 'center', 10)
    },
    [depth, bearing, rangeKm, measNoise, measReverb, field],
  )

  return (
    <PlaygroundFrame
      title="Pipeline Explorer"
      hint="The whole prediction as a flow. Each box is a product with a shape and a unit. Choose a box to see what it carries and what goes wrong there. The numbers follow one cell, set by the sliders, all the way to the two display slices underneath."
      tag="ENGINE TO PIXELS"
      wide
      side={
        <>
          <Slider label="Bearing" value={bearing} min={0} max={355} step={5} unit="°T" onChange={setBearing} />
          <Slider label="Range" value={rangeKm} min={1} max={Math.floor(rMaxKm) - 1} step={0.5} digits={1} unit="km" onChange={setRangeKm} />
          <Slider label="Target depth" value={depth} min={10} max={600} step={10} unit="m" onChange={setDepth} />
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <Toggle label="Use measured beam noise" checked={measNoise} onChange={setMeasNoise} />
            <Toggle label="Use measured reverb" checked={measReverb} onChange={setMeasReverb} />
          </div>
        </>
      }
    >
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox="0 0 1142 372" style={{ width: '100%', minWidth: 760, display: 'block' }} role="group" aria-label="Prediction pipeline stages">
          {EDGES.map(([a, b]) => {
            const s = byId(a)
            const t = byId(b)
            const x1 = s.x + W
            const y1 = s.y + H / 2
            const x2 = t.x
            const y2 = t.y + H / 2
            const hot = sel === a || sel === b
            const dx = Math.max(24, (x2 - x1) / 2)
            const d = x2 > x1 ? `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}` : `M${s.x + W / 2},${s.y + H} L${t.x + W / 2},${t.y}`
            return <path key={`${a}-${b}`} d={d} fill="none" stroke={hot ? C.accent : '#2a4a63'} strokeWidth={hot ? 2 : 1.3} strokeDasharray={hot ? '5 5' : undefined} opacity={hot ? 1 : 0.8}>
              {hot && <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.9s" repeatCount="indefinite" />}
            </path>
          })}
          {STAGES.map((s) => {
            const active = s.id === sel
            const measured = (s.id === 'noise' && measNoise) || (s.id === 'reverb' && measReverb)
            return (
              <g key={s.id} transform={`translate(${s.x} ${s.y})`} onClick={() => setSel(s.id)} onKeyDown={(e) => e.key === 'Enter' && setSel(s.id)} role="button" tabIndex={0} aria-pressed={active} style={{ cursor: 'pointer' }}>
                <rect width={W} height={H} rx={11} fill={active ? '#12283a' : '#0a1622'} stroke={active ? C.accent : '#22405a'} strokeWidth={active ? 2 : 1} />
                <rect width={5} height={H - 18} x={0} y={9} rx={2.5} fill={s.color} />
                <text x={16} y={26} fill={C.ink} fontFamily="Barlow Condensed" fontWeight={600} fontSize={17} letterSpacing="0.06em">
                  {s.title.toUpperCase()}
                </text>
                <text x={16} y={51} fill={active ? C.accent : C.ink2} fontFamily="IBM Plex Mono" fontSize={14}>
                  {values[s.id]}
                </text>
                {measured && (
                  <text x={W - 10} y={66} textAnchor="end" fill={C.amber} fontFamily="Barlow Condensed" fontWeight={600} fontSize={11} letterSpacing="0.14em">
                    MEASURED
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="readout" style={{ padding: '0.9rem 1rem', marginTop: '0.4rem', borderColor: C.axis }}>
        <span style={{ color: stage.color }}>{stage.title}</span>
        <b style={{ whiteSpace: 'normal', fontSize: '0.98rem', lineHeight: 1.45 }}>{stage.formula}</b>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', margin: '0.6rem 0 0.5rem' }}>
          {stage.dims.map((d) => (
            <span key={d} className="chip" style={{ textTransform: 'none', letterSpacing: '0.02em', fontFamily: 'var(--font-mono)', fontWeight: 400, fontSize: '0.76rem' }}>
              {d}
            </span>
          ))}
          <span className="chip chip-done" style={{ textTransform: 'none', letterSpacing: '0.02em', fontFamily: 'var(--font-mono)', fontWeight: 400, fontSize: '0.76rem' }}>
            {stage.units}
          </span>
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: C.ink2, fontSize: '0.9rem', fontFamily: 'var(--font-body)' }}>
          {stage.watch.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <p className="pg-sub" style={{ marginTop: '1rem' }}>
        One result set, two slices
      </p>
      <div className="stage-pair">
        <canvas ref={fullRef} className="pg-canvas" style={{ height: 310 }} role="img" aria-label="Full-field signal excess, range by depth at the chosen bearing" />
        <canvas ref={planRef} className="pg-canvas" style={{ height: 310 }} role="img" aria-label="Plan view signal excess, bearing by range at the chosen depth" />
      </div>
      <Colorbar map={MAP} lo={-30} hi={30} unit="dB SE" />
      <p className="pg-note">
        The white line is zero signal excess. The open circle is the traced cell, the same cell in both pictures. Turn on measured beam noise: the plan view grows a notch
        toward the ship at 120, and the full-field changes only when its bearing points into that notch. Nothing in the propagation engine changed.
      </p>
    </PlaygroundFrame>
  )
}
