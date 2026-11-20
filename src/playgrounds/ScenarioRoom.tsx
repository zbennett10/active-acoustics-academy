import { useDeferredValue, useMemo, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Colorbar, Readout, Readouts, Segmented } from '../components/ui/controls'
import { dot, drawAxes, drawField, drawSeabed, label, makeFrame, sy } from '../components/viz/canvasKit'
import { Plot } from '../components/viz/Plot'
import { C, Q } from '../components/viz/theme'
import { useCanvas } from '../components/viz/useCanvas'
import { COLORMAPS } from '../lib/colormaps'
import { powerSumDb } from '../lib/db'
import { fmt } from '../lib/format'
import { reverbAtRange } from '../lib/reverb'
import { detectionSpans } from '../lib/sonarEq'
import { getEnvironment } from '../lib/ssp'
import { defaultFreq, getField, lossCurve } from './shared'

const MAP = COLORMAPS.abyss
const SL = 220
const TS = 12
const DT = 10

interface Scenario {
  id: string
  title: string
  tasking: string
  envId: string
  sourceDepths: [number, number]
  sourceNames: [string, string]
  targetDepths: [number, number]
  noise: number
  wind: number
  expert: string
}

const SCENARIOS: Scenario[] = [
  {
    id: 'duct',
    title: 'The layer',
    tasking: 'Open ocean, a 100 m mixed layer. A hull sonar sits in the layer. A variable depth sonar could go below it. The target may stay shallow or go under the layer.',
    envId: 'surface-duct',
    sourceDepths: [40, 250],
    sourceNames: ['Hull, 40 m', 'Towed, 250 m'],
    targetDepths: [60, 300],
    noise: 58,
    wind: 12,
    expert: 'Sound from a source in the layer stays in the layer. A target below it sits in a shadow at all but short range. Put the source on the same side of the layer as the target. The cross-layer cases are the ones that fail.',
  },
  {
    id: 'cz',
    title: 'Convergence zone',
    tasking: 'Deep basin, 5000 m, with depth excess. You need detections far beyond the direct path. Where will they be, and how wide is the band?',
    envId: 'deep-cz',
    sourceDepths: [100, 600],
    sourceNames: ['Shallow, 100 m', 'Deep, 600 m'],
    targetDepths: [100, 600],
    noise: 50,
    wind: 10,
    expert: 'Detection comes as a short direct-path disc, a long gap, then a narrow ring near 60 km. The ring is only a few kilometers wide. Moving the source deeper widens and shifts it. The gap between is real: no amount of display smoothing should fill it.',
  },
  {
    id: 'summer',
    title: 'Summer shelf',
    tasking: 'Shelf water, 200 m, a strong summer thermocline and a sand bottom. Every path strikes the seabed. Reverberation is high.',
    envId: 'shallow-summer',
    sourceDepths: [30, 150],
    sourceNames: ['Above thermocline, 30 m', 'Below, 150 m'],
    targetDepths: [40, 150],
    noise: 62,
    wind: 8,
    expert: 'Downward refraction drives sound into the bottom, so range is short and set by bottom loss. Reverberation, not noise, is the limit, which makes the waveform choice matter more than source level. A source below the thermocline reaches a deep target much better.',
  },
  {
    id: 'winter',
    title: 'Winter shelf',
    tasking: 'The same shelf in winter. The column is mixed top to bottom. Wind is up at 25 knots.',
    envId: 'shallow-winter',
    sourceDepths: [30, 150],
    sourceNames: ['Shallow, 30 m', 'Deep, 150 m'],
    targetDepths: [40, 150],
    noise: 68,
    wind: 25,
    expert: 'Propagation is far better than in summer: gentle upward refraction keeps energy off the bottom. The price is the surface. High wind raises surface loss, surface reverberation and ambient noise together. Depth choice matters little because the column is uniform.',
  },
  {
    id: 'slope',
    title: 'Up the slope',
    tasking: 'You are in deep water looking onto the shelf. The target is inshore, on the shelf at 100 to 150 m.',
    envId: 'upslope',
    sourceDepths: [60, 400],
    sourceNames: ['Shallow, 60 m', 'Deep, 400 m'],
    targetDepths: [50, 120],
    noise: 60,
    wind: 10,
    expert: 'Each bounce off a rising bottom steepens the ray by twice the slope. Angles soon pass the critical angle and the energy is stripped out. Loss climbs sharply at the shelf break. A range-independent run with the offshore profile would badly overpredict.',
  },
  {
    id: 'basin',
    title: 'Bottom-limited basin',
    tasking: 'Deep water, but the seabed at 3000 m is shallower than the critical depth. No convergence zone can form.',
    envId: 'bottom-limited',
    sourceDepths: [100, 600],
    sourceNames: ['Shallow, 100 m', 'Deep, 600 m'],
    targetDepths: [100, 600],
    noise: 52,
    wind: 12,
    expert: 'Without depth excess the deep-going rays hit bottom before they can turn. What reaches long range is bottom bounce, so the answer depends on bottom loss at steep angles. Expect broad, weak coverage at mid range and nothing sharp at 60 km.',
  },
]

type Wave = 'cw' | 'fm'
const TAU: Record<Wave, number> = { cw: 1, fm: 1 / 400 }

function evaluate(sc: Scenario, zs: number, zt: number, wave: Wave): { xs: number[]; se: number[]; echo: number[]; mask: number[]; total: number; far: number; rMax: number } {
  const f = defaultFreq(sc.envId)
  const curve = lossCurve(sc.envId, zs, zt, f)
  const depth = getEnvironment(sc.envId).bathy[0].z
  const echo = curve.tl.map((tl) => SL - 2 * tl + TS)
  const mask = curve.xsKm.map((x) =>
    powerSumDb([
      sc.noise,
      reverbAtRange({ slDb: SL, fKhz: f, tauEff: TAU[wave], horizBeamDeg: 10, vertBeamDeg: 18, sourceDepth: Math.min(zs, depth - 5), waterDepth: depth, muDb: -27, windKn: sc.wind, svDb: -84, ductGrazingDeg: 5 }, x * 1000).total,
    ]),
  )
  const se = echo.map((e, i) => e - mask[i] - DT)
  const spans = detectionSpans(curve.xsKm, se).filter(([a, b]) => b - a > curve.rMaxKm * 0.004)
  return { xs: curve.xsKm, se, echo, mask, total: spans.reduce((s, [a, b]) => s + (b - a), 0), far: spans.length ? spans[spans.length - 1][1] : 0, rMax: curve.rMaxKm }
}

export default function ScenarioRoom(_: PlaygroundProps): ReactElement {
  const [id, setId] = useState(SCENARIOS[0].id)
  const [si, setSi] = useState<'0' | '1'>('0')
  const [ti, setTi] = useState<'0' | '1'>('1')
  const [wave, setWave] = useState<Wave>('cw')
  const [reveal, setReveal] = useState(false)
  const q = useDeferredValue({ id, si, ti, wave })

  const sc = SCENARIOS.find((s) => s.id === q.id) ?? SCENARIOS[0]
  const zs = sc.sourceDepths[Number(q.si)]
  const zt = sc.targetDepths[Number(q.ti)]
  const now = useMemo(() => evaluate(sc, zs, zt, q.wave), [sc, zs, zt, q.wave])
  const field = useMemo(() => getField(sc.envId, zs, defaultFreq(sc.envId)), [sc, zs])
  const env = getEnvironment(sc.envId)

  // Every combination, so the trade is visible at a glance.
  const table = useMemo(
    () =>
      [0, 1].flatMap((a) =>
        [0, 1].flatMap((b) =>
          (['cw', 'fm'] as Wave[]).map((wv) => {
            const r = evaluate(sc, sc.sourceDepths[a], sc.targetDepths[b], wv)
            return { a, b, wv, total: r.total, far: r.far }
          }),
        ),
      ),
    [sc],
  )
  const bestTotal = Math.max(...table.map((t) => t.total))

  const ref = useCanvas(
    (ctx, w, h) => {
      const zShow = sc.envId === 'surface-duct' ? 800 : field.zMax
      const f = makeFrame(w, h, [0, env.rMaxKm], [0, zShow])
      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      ctx.save()
      ctx.beginPath()
      ctx.rect(f.x, f.y, f.w, f.h)
      ctx.clip()
      drawField(ctx, { ...f, h: (f.h * field.zMax) / zShow }, field.tl, field.nr, field.nz, 60, 115, MAP.lut, true)
      ctx.restore()
      drawSeabed(
        ctx,
        f,
        env.bathy.map((b) => ({ r: b.rKm, z: b.z })),
      )
      drawAxes(ctx, f, { xLabel: 'Range (km)', yLabel: 'Depth (m)', grid: false, yTicks: 5 })
      ctx.setLineDash([6, 5])
      ctx.strokeStyle = C.amber
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(f.x, sy(f, zt))
      ctx.lineTo(f.x + f.w, sy(f, zt))
      ctx.stroke()
      ctx.setLineDash([])
      label(ctx, `target depth ${zt} m`, f.x + f.w - 8, sy(f, zt) - 10, C.amber, 'right')
      dot(ctx, f.x + 1, sy(f, zs), 5.5, C.ink)
      label(ctx, `source ${zs} m`, f.x + 12, sy(f, zs) - 12, C.ink)
    },
    [field, sc, zs, zt],
  )

  const spans = detectionSpans(now.xs, now.se).filter(([a, b]) => b - a > now.rMax * 0.004)
  const pick = (next: string): void => {
    setId(next)
    setReveal(false)
  }

  return (
    <PlaygroundFrame
      title="Scenario Room"
      hint="Six situations. Read the tasking, commit to a guess about which choice will matter most, then make the choices and check yourself against the table of every combination."
      tag="CAPSTONE"
      side={
        <>
          <Segmented label={'Source'} value={si} options={[{ value: '0', label: sc.sourceNames[0] }, { value: '1', label: sc.sourceNames[1] }]} onChange={setSi} />
          <Segmented label="Target depth" value={ti} options={[{ value: '0', label: `${sc.targetDepths[0]} m` }, { value: '1', label: `${sc.targetDepths[1]} m` }]} onChange={setTi} />
          <Segmented label="Processor" value={wave} options={[{ value: 'cw', label: 'CW, 1 s' }, { value: 'fm', label: 'FM, 400 Hz' }]} onChange={setWave} />
          <Readouts>
            <Readout label="Detection zones" value={`${spans.length}`} />
            <Readout label="Farthest detection" value={fmt(now.far, 1)} unit="km" tone={now.far > 0 ? 'good' : 'bad'} />
            <Readout label="Detectable range, total" value={fmt(now.total, 1)} unit="km" tone="accent" />
            <Readout label="Noise at the beam" value={`${sc.noise}`} unit="dB" swatch={Q.noise} />
          </Readouts>
        </>
      }
    >
      <div className="seg" style={{ marginBottom: '0.8rem' }} role="tablist" aria-label="Scenario">
        {SCENARIOS.map((s, i) => (
          <button key={s.id} type="button" role="tab" aria-selected={s.id === id} aria-pressed={s.id === id} onClick={() => pick(s.id)}>
            {i + 1} · {s.title}
          </button>
        ))}
      </div>
      <div className="callout callout-scenario" style={{ margin: '0 0 0.9rem', maxWidth: 'none' }}>
        <div className="callout-label">Tasking</div>
        {sc.tasking}
      </div>
      <canvas ref={ref} className="pg-canvas" style={{ height: 300 }} role="img" aria-label={`Transmission loss field for ${sc.title}`} />
      <Colorbar map={MAP} lo={115} hi={60} unit="dB loss" />
      <div style={{ marginTop: '0.8rem' }}>
        <Plot
          ariaLabel="Echo and masking level against range for the chosen options"
          series={[
            { id: 'mask', label: 'Noise ⊕ reverb + threshold', color: Q.dt, x: now.xs, y: now.mask.map((m) => m + DT), dash: true, width: 1.8 },
            { id: 'echo', label: 'Echo', color: Q.echo, x: now.xs, y: now.echo, width: 2.4 },
          ]}
          xDomain={[0, now.rMax]}
          yDomain={[20, 140]}
          xLabel="Range (km)"
          yLabel="Level (dB)"
          xUnit="km"
          yUnit="dB"
          height={240}
          bands={spans.map(([a, b]) => ({ x0: a, x1: b, color: Q.se, opacity: 0.18 }))}
        />
      </div>
      <div className="test-actions" style={{ margin: '0.9rem 0' }}>
        <button type="button" className="btn btn-small btn-primary" onClick={() => setReveal((v) => !v)}>
          {reveal ? 'Hide the debrief' : 'Show every combination and the debrief'}
        </button>
      </div>
      {reveal && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Target depth</th>
                  <th>Processor</th>
                  <th>Detectable range</th>
                  <th>Farthest</th>
                </tr>
              </thead>
              <tbody>
                {table.map((t) => (
                  <tr key={`${t.a}${t.b}${t.wv}`} className={t.total === bestTotal && bestTotal > 0 ? 'hot' : ''}>
                    <td>{sc.sourceNames[t.a]}</td>
                    <td>{sc.targetDepths[t.b]} m</td>
                    <td>{t.wv === 'cw' ? 'CW, 1 s' : 'FM, 400 Hz'}</td>
                    <td>{fmt(t.total, 1)} km</td>
                    <td>{fmt(t.far, 1)} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="callout callout-operator" style={{ maxWidth: 'none' }}>
            <div className="callout-label">What an expert notices</div>
            {sc.expert}
          </div>
        </>
      )}
    </PlaygroundFrame>
  )
}
