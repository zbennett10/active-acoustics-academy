import { useMemo, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Readout, Readouts, Segmented, Slider, Toggle } from '../components/ui/controls'
import { Plot, type PlotSeries } from '../components/viz/Plot'
import { C, Q } from '../components/viz/theme'
import { SOUND_SPEED, powerSumDb } from '../lib/db'
import { fmt } from '../lib/format'
import { calibrationOffsetDb, echoLevelDb, reverbCurve, synthesizeMeasured, type ReverbInputs } from '../lib/reverb'
import { detectionSpans, zeroCrossings } from '../lib/sonarEq'
import { BOTTOMS } from '../lib/ssp'

const RANGES = Array.from({ length: 140 }, (_v, i) => 600 + i * 175)
const XS = RANGES.map((r) => r / 1000)
const BOTTOM_OPTIONS = ['mud', 'silt', 'sand', 'rock'].map((id) => ({ value: id, label: BOTTOMS[id].name }))

type Pulse = 'cw' | 'fm'

function lastDetection(se: number[]): number {
  const spans = detectionSpans(XS, se)
  return spans.length ? spans[spans.length - 1][1] : 0
}

export default function ReverbWorkshop({ preset }: PlaygroundProps): ReactElement {
  const [sl, setSl] = useState(218)
  const [pulse, setPulse] = useState<Pulse>('cw')
  const [tau, setTau] = useState(0.1)
  const [bw, setBw] = useState(200)
  const [beam, setBeam] = useState(10)
  const [wind, setWind] = useState(12)
  const [bottom, setBottom] = useState('sand')
  const [noise, setNoise] = useState(62)
  const [ts, setTs] = useState(15)
  const [dt, setDt] = useState(8)
  const [parts, setParts] = useState(false)
  const [measured, setMeasured] = useState(preset === 'measured')
  const [correction, setCorrection] = useState(0)

  const tauEff = pulse === 'cw' ? tau : 1 / bw
  const model: ReverbInputs = useMemo(
    () => ({ slDb: sl, fKhz: 3.5, tauEff, horizBeamDeg: beam, vertBeamDeg: 18, sourceDepth: 50, waterDepth: 220, muDb: BOTTOMS[bottom].lambertDb + correction, windKn: wind, svDb: -84, ductGrazingDeg: 5 }),
    [sl, tauEff, beam, bottom, correction, wind],
  )
  const curve = useMemo(() => reverbCurve(model, RANGES), [model])
  const total = curve.map((p) => p.total)
  const echo = RANGES.map((r) => echoLevelDb(sl, ts, r, 3.5))

  // The "sea" differs from the model, with a rougher bottom than the database says and more wind.
  const truth: ReverbInputs = useMemo(
    () => ({ ...model, muDb: BOTTOMS[bottom].lambertDb + 7, windKn: wind + 6 }),
    [sl, tauEff, beam, bottom, wind],
  )
  const meas = useMemo(() => synthesizeMeasured(truth, RANGES, noise, 23), [truth, noise])

  const seModel = RANGES.map((_r, i) => echo[i] - powerSumDb([total[i], noise]) - dt)
  const seMeas = RANGES.map((_r, i) => echo[i] - meas.levelDb[i] - dt)
  const cross = zeroCrossings(
    XS,
    total.map((v) => v - noise),
  )
  const crossover = cross.length ? cross[cross.length - 1] : null
  const rangeModel = lastDetection(seModel)
  const rangeMeas = lastDetection(seMeas)
  const spans = detectionSpans(XS, measured ? seMeas : seModel)

  const calibrate = (): void => {
    const modelWithNoise = total.map((v) => powerSumDb([v, noise]))
    const head = Math.floor(RANGES.length * 0.55)
    setCorrection((c) => Math.round((c + calibrationOffsetDb(modelWithNoise.slice(0, head), meas.levelDb.slice(0, head))) * 10) / 10)
  }

  const series: PlotSeries[] = [
    ...(parts
      ? [
          { id: 'bottom', label: 'Bottom', color: C.yellow, x: XS, y: curve.map((p) => p.bottom), dash: true, width: 1.3 },
          { id: 'surface', label: 'Surface', color: C.blue, x: XS, y: curve.map((p) => p.surface), dash: true, width: 1.3 },
          { id: 'volume', label: 'Volume', color: C.aqua, x: XS, y: curve.map((p) => p.volume), dash: true, width: 1.3 },
        ]
      : []),
    { id: 'noise', label: 'Noise at the beam', color: Q.noise, x: XS, y: XS.map(() => noise), width: 1.6 },
    { id: 'rl', label: 'Modeled reverb', color: Q.reverb, x: XS, y: total, width: 2.4 },
    ...(measured ? [{ id: 'meas', label: 'Measured reverb + noise', color: C.ink, x: XS, y: meas.levelDb, width: 1.2 }] : []),
    { id: 'echo', label: 'Echo from the target', color: Q.echo, x: XS, y: echo, width: 2.2 },
  ]

  return (
    <PlaygroundFrame
      title="Reverb Workshop"
      hint="The ocean’s own answer to the ping, falling away with range. The echo falls faster. Shaded ranges are where the echo clears reverb and noise by the detection threshold. Turn on the measurement and see how far the model was off."
      tag="MODELED VS MEASURED"
      side={
        <>
          <Segmented
            label="Pulse"
            value={pulse}
            options={[
              { value: 'cw', label: 'CW' },
              { value: 'fm', label: 'FM' },
            ]}
            onChange={setPulse}
          />
          {pulse === 'cw' ? (
            <Slider label="Pulse length" value={tau} min={0.05} max={2} step={0.05} digits={2} unit="s" onChange={setTau} />
          ) : (
            <Slider label="Bandwidth" value={bw} min={20} max={1000} step={10} unit="Hz" onChange={setBw} />
          )}
          <Slider label="Horizontal beamwidth" value={beam} min={2} max={40} step={1} unit="°" onChange={setBeam} />
          <Slider label="Source level" value={sl} min={200} max={230} step={1} unit="dB" onChange={setSl} />
          <Slider label="Wind speed" value={wind} min={0} max={35} step={1} unit="kn" onChange={setWind} />
          <Segmented label="Bottom in the database" value={bottom} options={BOTTOM_OPTIONS} onChange={(v) => { setBottom(v); setCorrection(0) }} />
          <Slider label="Noise at the beam" value={noise} min={45} max={85} step={1} unit="dB" onChange={setNoise} />
          <Slider label="Target strength" value={ts} min={0} max={30} step={1} unit="dB" onChange={setTs} />
          <Slider label="Detection threshold" value={dt} min={0} max={20} step={1} unit="dB" onChange={setDt} />
          <Toggle label="Show bottom, surface and volume parts" checked={parts} onChange={setParts} />
          <Toggle label="Overlay measured reverb" checked={measured} onChange={setMeasured} />
          {measured && (
            <div className="test-actions" style={{ margin: 0 }}>
              <button type="button" className="btn btn-small btn-primary" onClick={calibrate}>
                Calibrate model
              </button>
              <button type="button" className="btn btn-small" onClick={() => setCorrection(0)}>
                Undo
              </button>
            </div>
          )}
        </>
      }
    >
      <Plot
        ariaLabel="Reverberation, noise and echo levels against range"
        series={series}
        xDomain={[0.6, 25]}
        yDomain={[30, 130]}
        xLabel="Range (km)  ·  time = 2R / c"
        yLabel="Level at the beam (dB)"
        xHover={(v) => `${fmt(v, 1)} km · ${fmt((2000 * v) / SOUND_SPEED, 1)} s`}
        yUnit="dB"
        height={380}
        bands={spans.map(([a, b]) => ({ x0: a, x1: b, color: Q.se, opacity: 0.16 }))}
        marks={crossover ? [{ x: crossover, label: 'reverb = noise', color: C.ink2 }] : []}
      />
      <div style={{ marginTop: '0.8rem' }}>
        <Readouts>
          <Readout label="Effective pulse" value={tauEff >= 0.1 ? fmt(tauEff, 2) : fmt(tauEff * 1000, 1)} unit={tauEff >= 0.1 ? 's' : 'ms'} />
          <Readout label="Range cell" value={fmt((SOUND_SPEED * tauEff) / 2, 1)} unit="m" />
          <Readout label="Reverb to noise at" value={crossover ? fmt(crossover, 1) : '—'} unit="km" />
          <Readout label="Range, modeled reverb" value={fmt(rangeModel, 1)} unit="km" swatch={Q.reverb} />
          {measured && <Readout label="Range, measured reverb" value={fmt(rangeMeas, 1)} unit="km" tone={Math.abs(rangeMeas - rangeModel) > 1.5 ? 'bad' : 'good'} />}
          {measured && <Readout label="Bottom correction" value={`${correction >= 0 ? '+' : '−'}${fmt(Math.abs(correction), 1)}`} unit="dB" tone="accent" />}
        </Readouts>
      </div>
      <p className="pg-note">
        {measured
          ? correction === 0
            ? 'The white trace is what the sonar recorded after a ping. It sits above the model at short and middle ranges: the real bottom scatters more than the database value. The spikes are clutter. Select Calibrate model to shift the bottom scattering strength until the curves agree.'
            : 'The model now tracks the measurement where reverb dominates. Past the crossover the trace is noise, which carries no information about the bottom, so the fit ignores it.'
          : 'Try this: raise the source level. Echo and reverb rise together, so the shaded range barely moves while reverb is the limit. Then switch to FM, or narrow the beam, and watch the reverb drop under the echo.'}
      </p>
    </PlaygroundFrame>
  )
}
