import { useDeferredValue, useMemo, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Readout, Readouts, Select, Slider, Toggle } from '../components/ui/controls'
import { Plot } from '../components/viz/Plot'
import { C, Q } from '../components/viz/theme'
import { powerSumDb } from '../lib/db'
import { podFromSe } from '../lib/detection'
import { fmt } from '../lib/format'
import { reverbAtRange, type ReverbInputs } from '../lib/reverb'
import { detectionSpans, figureOfMeritDb } from '../lib/sonarEq'
import { getEnvironment } from '../lib/ssp'
import { PROP_OPTIONS, SIMPLE, defaultFreq, lossCurve } from './shared'

export default function SeConsole({ preset }: PlaygroundProps): ReactElement {
  const [prop, setProp] = useState(PROP_OPTIONS.some((p) => p.value === preset) ? (preset as string) : 'surface-duct')
  const [freq, setFreq] = useState(defaultFreq(PROP_OPTIONS.some((p) => p.value === preset) ? (preset as string) : 'surface-duct'))
  const [sl, setSl] = useState(220)
  const [ts, setTs] = useState(12)
  const [zt, setZt] = useState(60)
  const [noise, setNoise] = useState(58)
  const [reverbOn, setReverbOn] = useState(true)
  const [tau, setTau] = useState(0.2)
  const [dt, setDt] = useState(10)
  const [sigma, setSigma] = useState(8)
  const [inspect, setInspect] = useState(0.3)
  const q = useDeferredValue({ prop, zt, freq })

  const zs = q.prop === SIMPLE ? 50 : getEnvironment(q.prop).sourceDepth
  const curve = useMemo(() => lossCurve(q.prop, zs, q.zt, q.freq), [q, zs])
  const xs = curve.xsKm
  const reverbInputs: ReverbInputs = useMemo(
    () => ({ slDb: sl, fKhz: freq, tauEff: tau, horizBeamDeg: 10, vertBeamDeg: 18, sourceDepth: 50, waterDepth: 300, muDb: -27, windKn: 12, svDb: -84, ductGrazingDeg: 5 }),
    [sl, tau, freq],
  )

  const rows = useMemo(
    () =>
      xs.map((x, i) => {
        const tl = curve.tl[i]
        const echo = sl - 2 * tl + ts
        const rl = reverbOn ? reverbAtRange(reverbInputs, x * 1000).total : -Infinity
        const mask = powerSumDb([rl, noise])
        const se = echo - mask - dt
        return { x, tl, echo, rl, mask, se, pod: podFromSe(se, sigma) }
      }),
    [xs, curve, sl, ts, reverbOn, reverbInputs, noise, dt, sigma],
  )
  const se = rows.map((r) => r.se)
  const spans = detectionSpans(xs, se).filter(([a, b]) => b - a > curve.rMaxKm * 0.004)
  const fom = figureOfMeritDb(sl, ts, noise, dt)
  const at = rows[Math.min(rows.length - 1, Math.round(inspect * (rows.length - 1)))]
  const bands = spans.map(([a, b]) => ({ x0: a, x1: b, color: Q.se, opacity: 0.16 }))
  const dom = [0, curve.rMaxKm] as const

  return (
    <PlaygroundFrame
      title="Signal Excess Console"
      hint="Every term of the active sonar equation on one page. Top: the echo against what masks it. Middle: signal excess, positive where a detection is more likely than not. Bottom: the probability an operator can plan with."
      tag="SL − 2TL + TS − MASK − DT"
      side={
        <>
          <Select label="Propagation" value={prop} options={PROP_OPTIONS} onChange={(v) => { setProp(v); setFreq(defaultFreq(v)) }} />
          <Slider label="Frequency" value={freq} min={0.5} max={8} step={0.5} digits={1} unit="kHz" onChange={setFreq} />
          <Slider label="Source level" value={sl} min={195} max={235} step={1} unit="dB" onChange={setSl} />
          <Slider label="Target strength" value={ts} min={-5} max={30} step={1} unit="dB" onChange={setTs} />
          <Slider label="Target depth" value={zt} min={10} max={prop === SIMPLE || prop.startsWith('shallow') ? 190 : 1000} step={10} unit="m" onChange={setZt} />
          <Slider label="Noise at the beam" value={noise} min={40} max={85} step={1} unit="dB" onChange={setNoise} />
          <Toggle label="Include reverberation" checked={reverbOn} onChange={setReverbOn} />
          {reverbOn && <Slider label="Effective pulse length" value={tau} min={0.005} max={1} step={0.005} digits={3} unit="s" onChange={setTau} />}
          <Slider label="Detection threshold" value={dt} min={0} max={20} step={1} unit="dB" onChange={setDt} />
          <Slider label="Fluctuation σ" value={sigma} min={3} max={14} step={0.5} digits={1} unit="dB" onChange={setSigma} />
          <Slider label="Inspect range" value={inspect} min={0} max={1} step={0.005} format={() => `${fmt(at.x, 1)} km`} onChange={setInspect} />
          <div className="ledger">
            <div>
              <span>Source level</span>
              <span>{fmt(sl, 0)}</span>
            </div>
            <div>
              <span>Loss out and back</span>
              <span>−{fmt(2 * at.tl, 1)}</span>
            </div>
            <div>
              <span>Target strength</span>
              <span>+{fmt(ts, 0)}</span>
            </div>
            <div className="sum">
              <span>Echo level</span>
              <span>{fmt(at.echo, 1)}</span>
            </div>
            <div>
              <span>Noise ⊕ reverb</span>
              <span>−{fmt(at.mask, 1)}</span>
            </div>
            <div>
              <span>Detection threshold</span>
              <span>−{fmt(dt, 0)}</span>
            </div>
            <div className="sum">
              <span>Signal excess</span>
              <span style={{ color: at.se >= 0 ? '#5fe39a' : '#f08a8a' }}>{fmt(at.se, 1)} dB</span>
            </div>
          </div>
        </>
      }
    >
      <Plot
        ariaLabel="Echo, reverberation and noise levels against range"
        series={[
          { id: 'noise', label: 'Noise', color: Q.noise, x: xs, y: xs.map(() => noise), width: 1.6 },
          ...(reverbOn ? [{ id: 'rl', label: 'Reverberation', color: Q.reverb, x: xs, y: rows.map((r) => r.rl), width: 2 }] : []),
          { id: 'need', label: 'Masking + threshold', color: Q.dt, x: xs, y: rows.map((r) => r.mask + dt), dash: true, width: 1.6 },
          { id: 'echo', label: 'Echo', color: Q.echo, x: xs, y: rows.map((r) => r.echo), width: 2.4 },
        ]}
        xDomain={dom}
        yDomain={[20, 140]}
        xLabel="Range (km)"
        yLabel="Level (dB)"
        xUnit="km"
        yUnit="dB"
        height={250}
        bands={bands}
        marks={[{ x: at.x, label: 'inspect', color: C.ink2 }]}
      />
      <div style={{ marginTop: '0.7rem' }}>
        <Plot
          ariaLabel="Signal excess against range"
          series={[{ id: 'se', label: 'Signal excess', color: Q.se, x: xs, y: se, fillTo: 0, fillOpacity: 0.2, width: 2.4 }]}
          xDomain={dom}
          yDomain={[-40, 40]}
          xLabel="Range (km)"
          yLabel="Signal excess (dB)"
          xUnit="km"
          yUnit="dB"
          height={210}
          bands={bands}
          marks={[
            { y: 0, label: 'SE = 0', color: C.ink2 },
            { x: at.x, label: '', color: C.ink2 },
          ]}
        />
      </div>
      <div style={{ marginTop: '0.7rem' }}>
        <Plot
          ariaLabel="Probability of detection against range"
          series={[{ id: 'pod', label: 'Probability of detection', color: Q.se, x: xs, y: rows.map((r) => r.pod), fillTo: 0, fillOpacity: 0.22, width: 2.2 }]}
          xDomain={dom}
          yDomain={[0, 1]}
          xLabel="Range (km)"
          yLabel="Prob. of detection"
          xUnit="km"
          digits={2}
          height={170}
          marks={[{ y: 0.5, label: '50%', color: C.ink3 }]}
        />
      </div>
      <div style={{ marginTop: '0.8rem' }}>
        <Readouts>
          <Readout label="Figure of merit" value={fmt(fom, 0)} unit="dB two-way" tone="accent" />
          <Readout label="Allowed one-way loss" value={fmt(fom / 2, 1)} unit="dB" />
          <Readout label="Detection zones" value={`${spans.length}`} />
          <Readout label="Farthest detection" value={spans.length ? fmt(spans[spans.length - 1][1], 1) : '0'} unit="km" tone={spans.length ? 'good' : 'bad'} />
          <Readout label="At inspect: limited by" value={at.rl > noise ? 'reverb' : 'noise'} swatch={at.rl > noise ? Q.reverb : Q.noise} />
          <Readout label="At inspect: Pd" value={fmt(at.pod * 100, 0)} unit="%" />
        </Readouts>
      </div>
    </PlaygroundFrame>
  )
}
