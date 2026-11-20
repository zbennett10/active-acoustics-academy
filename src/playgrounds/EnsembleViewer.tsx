import { useDeferredValue, useMemo, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Readout, Readouts, Select, Slider, Toggle } from '../components/ui/controls'
import { Plot, type PlotSeries } from '../components/viz/Plot'
import { C, Q } from '../components/viz/theme'
import { powerSumDb } from '../lib/db'
import { fmt } from '../lib/format'
import { reverbAtRange, type ReverbInputs } from '../lib/reverb'
import { createRng } from '../lib/rng'
import { detectionSpans } from '../lib/sonarEq'
import { getEnvironment } from '../lib/ssp'
import { PROP_OPTIONS, SIMPLE, defaultFreq, lossCurve } from './shared'

const MEMBERS = 70
const SL = 220
const TS = 12
const NOISE = 58
const DT = 10
const REVERB: ReverbInputs = { slDb: SL, fKhz: 3.5, tauEff: 0.05, horizBeamDeg: 10, vertBeamDeg: 18, sourceDepth: 50, waterDepth: 300, muDb: -27, windKn: 12, svDb: -84, ductGrazingDeg: 5 }

function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return NaN
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

export default function EnsembleViewer(_: PlaygroundProps): ReactElement {
  const [prop, setProp] = useState('surface-duct')
  const [sTl, setSTl] = useState(3)
  const [sShape, setSShape] = useState(6)
  const [sNoise, setSNoise] = useState(5)
  const [sReverb, setSReverb] = useState(6)
  const [sTs, setSTs] = useState(3)
  const [useSsp, setUseSsp] = useState(false)
  const [useNoise, setUseNoise] = useState(false)
  const [useReverb, setUseReverb] = useState(false)
  const [ask, setAsk] = useState(0.35)
  const q = useDeferredValue(prop)

  const zs = q === SIMPLE ? 50 : getEnvironment(q).sourceDepth
  const curve = useMemo(() => lossCurve(q, zs, 60, defaultFreq(q)), [q, zs])
  const xs = curve.xsKm
  const reverb = useMemo(() => xs.map((x) => reverbAtRange(REVERB, x * 1000).total), [xs])

  const run = useMemo(() => {
    const rng = createRng(31)
    const eTl = useSsp ? sTl * 0.4 : sTl
    const eShape = (useSsp ? sShape * 0.25 : sShape) / 100
    const eNoise = useNoise ? 1 : sNoise
    const eReverb = useReverb ? 1.5 : sReverb
    const members = Array.from({ length: MEMBERS }, () => {
      const dTl = rng.gauss() * eTl
      const stretch = 1 + rng.gauss() * eShape
      const dN = rng.gauss() * eNoise
      const dR = rng.gauss() * eReverb
      const dTs = rng.gauss() * sTs
      const se = xs.map((_x, i) => {
        const j = Math.min(xs.length - 1, Math.max(0, Math.round(i / stretch)))
        return SL - 2 * (curve.tl[j] + dTl) + TS + dTs - powerSumDb([NOISE + dN, reverb[i] + dR]) - DT
      })
      const spans = detectionSpans(xs, se).filter(([a, b]) => b - a > curve.rMaxKm * 0.004)
      return { se, range: spans.length ? spans[0][1] : 0 }
    })
    const col = (i: number): number[] => members.map((m) => m.se[i]).sort((a, b) => a - b)
    const p10 = xs.map((_x, i) => quantile(col(i), 0.1))
    const p50 = xs.map((_x, i) => quantile(col(i), 0.5))
    const p90 = xs.map((_x, i) => quantile(col(i), 0.9))
    const ranges = members.map((m) => m.range).sort((a, b) => a - b)
    return { members, p10, p50, p90, ranges }
  }, [xs, curve, reverb, sTl, sShape, sNoise, sReverb, sTs, useSsp, useNoise, useReverb])

  const askKm = ask * curve.rMaxKm
  const askIdx = Math.min(xs.length - 1, Math.round(ask * (xs.length - 1)))
  const pAt = run.members.filter((m) => m.se[askIdx] >= 0).length / MEMBERS
  const r10 = quantile(run.ranges, 0.1)
  const r50 = quantile(run.ranges, 0.5)
  const r90 = quantile(run.ranges, 0.9)

  const bins = 16
  const binW = curve.rMaxKm / bins
  const hist = Array.from({ length: bins }, (_v, i) => run.ranges.filter((r) => r >= i * binW && r < (i + 1) * binW).length)
  const histMax = Math.max(1, ...hist)

  const series: PlotSeries[] = [
    ...run.members.map((m, i) => ({ id: `m${i}`, label: '', color: C.blue, x: xs, y: m.se, width: 1, quiet: true, opacity: 0.22 })),
    { id: 'p10', label: '10th percentile', color: C.ink3, x: xs, y: run.p10, dash: true, width: 1.5 },
    { id: 'p90', label: '90th percentile', color: C.ink2, x: xs, y: run.p90, dash: true, width: 1.5 },
    { id: 'p50', label: 'Median', color: Q.se, x: xs, y: run.p50, width: 2.8 },
  ]

  return (
    <PlaygroundFrame
      title="Ensemble Viewer"
      hint="One prediction is one draw from what could be true. Here are seventy, each with the inputs nudged inside their uncertainty. The spread is the honest answer. Then feed in measurements and watch it tighten."
      tag="70 MEMBERS"
      side={
        <>
          <Select label="Propagation" value={prop} options={PROP_OPTIONS} onChange={setProp} />
          <p className="pg-sub">Input uncertainty, one sigma</p>
          <Slider label="Loss level" value={sTl} min={0} max={8} step={0.5} digits={1} unit="dB" onChange={setSTl} />
          <Slider label="Loss shape, range stretch" value={sShape} min={0} max={15} step={1} unit="%" onChange={setSShape} />
          <Slider label="Noise" value={sNoise} min={0} max={10} step={0.5} digits={1} unit="dB" onChange={setSNoise} />
          <Slider label="Reverberation" value={sReverb} min={0} max={12} step={0.5} digits={1} unit="dB" onChange={setSReverb} />
          <Slider label="Target strength" value={sTs} min={0} max={8} step={0.5} digits={1} unit="dB" onChange={setSTs} />
          <p className="pg-sub">Bring in measurements</p>
          <Toggle label="In situ sound speed profile" checked={useSsp} onChange={setUseSsp} />
          <Toggle label="Measured beam noise" checked={useNoise} onChange={setUseNoise} />
          <Toggle label="Measured reverb" checked={useReverb} onChange={setUseReverb} />
          <Slider label="Ask about range" value={ask} min={0.02} max={0.98} step={0.01} format={() => `${fmt(askKm, 1)} km`} onChange={setAsk} />
          <Readouts>
            <Readout label="Median first-zone range" value={fmt(r50, 1)} unit="km" tone="accent" />
            <Readout label="10th to 90th" value={`${fmt(r10, 1)} to ${fmt(r90, 1)}`} unit="km" />
            <Readout label="Spread" value={fmt(r90 - r10, 1)} unit="km" tone={r90 - r10 > r50 * 0.6 ? 'bad' : 'good'} />
            <Readout label={`P(SE ≥ 0) at ${fmt(askKm, 0)} km`} value={fmt(pAt * 100, 0)} unit="%" />
          </Readouts>
        </>
      }
    >
      <Plot
        ariaLabel="Seventy signal excess curves with their median and spread"
        series={series}
        xDomain={[0, curve.rMaxKm]}
        yDomain={[-45, 45]}
        xLabel="Range (km)"
        yLabel="Signal excess (dB)"
        xUnit="km"
        yUnit="dB"
        height={360}
        marks={[
          { y: 0, label: 'SE = 0', color: C.ink2 },
          { x: askKm, label: 'asked range', color: C.amber },
        ]}
      />
      <p className="pg-sub" style={{ marginTop: '1rem' }}>
        Where the first detection zone ends, across the ensemble
      </p>
      <svg viewBox="0 0 760 150" className="plot" role="img" aria-label="Histogram of first-zone detection range">
        {hist.map((n, i) => {
          const bw = 688 / bins
          const bh = (n / histMax) * 100
          return (
            <g key={i}>
              <rect x={56 + i * bw + 1} y={118 - bh} width={bw - 2} height={bh} rx={3} fill={Q.se} opacity={0.85}>
                <title>{`${fmt(i * binW, 1)} to ${fmt((i + 1) * binW, 1)} km: ${n} members`}</title>
              </rect>
              {n > 0 && (
                <text x={56 + i * bw + bw / 2} y={112 - bh} textAnchor="middle" className="tick">
                  {n}
                </text>
              )}
              {i % 2 === 0 && (
                <text x={56 + i * bw} y={134} textAnchor="middle" className="tick">
                  {fmt(i * binW, 0)}
                </text>
              )}
            </g>
          )
        })}
        <line x1={56} x2={744} y1={118} y2={118} className="axis" />
        <line x1={56 + (r50 / curve.rMaxKm) * 688} x2={56 + (r50 / curve.rMaxKm) * 688} y1={10} y2={118} stroke={C.ink} strokeDasharray="4 4" />
        <text x={56 + (r50 / curve.rMaxKm) * 688 + 6} y={20} className="anno">
          median
        </text>
        <text x={400} y={147} textAnchor="middle" className="label">
          Range (km)
        </text>
      </svg>
      <p className="pg-note">
        <b>Notice the asymmetry.</b> Where the loss curve is steep, a few decibels of error barely move the range. Where it is flat, the same error moves the range by
        kilometers. That is why a single number for range of the day needs its spread beside it, and why a measurement that removes 5 dB of doubt can be worth more than a
        better engine.
      </p>
    </PlaygroundFrame>
  )
}
