import { useDeferredValue, useMemo, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Colorbar, Readout, Readouts, Segmented, Slider, Toggle } from '../components/ui/controls'
import { clipFrame, dot, drawAxes, drawField, hexA, label, makeFrame, sx, sy } from '../components/viz/canvasKit'
import { C, Q } from '../components/viz/theme'
import { useCanvas } from '../components/viz/useCanvas'
import { COLORMAPS } from '../lib/colormaps'
import { KNOT_MS, SOUND_SPEED } from '../lib/db'
import { fmt } from '../lib/format'
import {
  ambiguitySurface,
  dopplerLossDb,
  dopplerShiftHz,
  processingGainDb,
  rangeResolutionM,
  speedResolutionMs,
  type Waveform,
  type WaveformKind,
} from '../lib/waveform'

const MAP = COLORMAPS.inferno
const V_MAX = 15
const FC = 3500
const DT = 12
const CW_REJECTION = 35

interface Processor {
  name: string
  wave: Waveform
}

const BANK: Processor[] = [
  { name: 'CW long', wave: { kind: 'cw', fcHz: FC, bandwidthHz: 0, durationS: 1 } },
  { name: 'CW short', wave: { kind: 'cw', fcHz: FC, bandwidthHz: 0, durationS: 0.25 } },
  { name: 'HFM wide', wave: { kind: 'hfm', fcHz: FC, bandwidthHz: 400, durationS: 1 } },
  { name: 'LFM narrow', wave: { kind: 'lfm', fcHz: FC, bandwidthHz: 100, durationS: 0.5 } },
]

interface Scene {
  echoDb: number
  noiseSpectrumDb: number
  reverbDb: number // in-beam reverb for a 1 s CW pulse at the target range
  speedMs: number
  ridgeMs: number
}

function processorSe(w: Waveform, s: Scene): { se: number; snrNoise: number; srr: number; limit: 'noise' | 'reverb' } {
  // A CW processor carries a bank of Doppler filters, so target Doppler costs it nothing.
  const loss = w.kind === 'cw' ? 0 : -dopplerLossDb(w, s.speedMs)
  const echo = s.echoDb - loss
  const snrNoise = echo - s.noiseSpectrumDb + 10 * Math.log10(w.durationS)
  const tauEff = w.kind === 'cw' ? w.durationS : 1 / w.bandwidthHz
  const clear = w.kind === 'cw' && Math.abs(s.speedMs) > s.ridgeMs + speedResolutionMs(w)
  const reverb = s.reverbDb + 10 * Math.log10(tauEff) - (clear ? CW_REJECTION : 0)
  const srr = echo - reverb
  const total = -10 * Math.log10(Math.pow(10, -snrNoise / 10) + Math.pow(10, -srr / 10))
  return { se: total - DT, snrNoise, srr, limit: srr < snrNoise ? 'reverb' : 'noise' }
}

export default function ProcessorLab({ preset }: PlaygroundProps): ReactElement {
  const [kind, setKind] = useState<WaveformKind>(preset === 'cw' ? 'cw' : preset === 'lfm' ? 'lfm' : 'hfm')
  const [duration, setDuration] = useState(0.5)
  const [bandwidth, setBandwidth] = useState(200)
  const [speedKn, setSpeedKn] = useState(6)
  const [ridgeKn, setRidgeKn] = useState(3)
  const [zoom, setZoom] = useState(false)
  const [reverb, setReverb] = useState(84)
  const [noise, setNoise] = useState(62)
  const [echo, setEcho] = useState(88)

  const wave: Waveform = useMemo(() => ({ kind, fcHz: FC, bandwidthHz: kind === 'cw' ? 0 : bandwidth, durationS: duration }), [kind, bandwidth, duration])
  const q = useDeferredValue({ wave, zoom })
  const maxDelay = q.zoom ? q.wave.durationS / 12 : q.wave.durationS
  const surface = useMemo(() => ambiguitySurface(q.wave, maxDelay, V_MAX, 101, 51), [q.wave, maxDelay])
  // Rows flipped so the fastest closing speed draws at the top of the map.
  const db = useMemo(() => {
    const nd = surface.delaysS.length
    const nv = surface.speedsMs.length
    const out = new Float32Array(nd * nv)
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nd; i++) out[j * nd + i] = 20 * Math.log10(Math.max(surface.mag[(nv - 1 - j) * nd + i], 1e-4))
    }
    return out
  }, [surface])

  const speedMs = speedKn * KNOT_MS
  const scene: Scene = { echoDb: echo, noiseSpectrumDb: noise, reverbDb: reverb, speedMs, ridgeMs: ridgeKn * KNOT_MS }
  const custom = processorSe(wave, scene)
  const results = BANK.map((p) => ({ ...p, ...processorSe(p.wave, scene) }))
  const best = results.reduce((b, r) => (r.se > b.se ? r : b), results[0])
  const loss = wave.kind === 'cw' ? 0 : -dopplerLossDb(wave, speedMs)
  const rangeSpan = (maxDelay * SOUND_SPEED) / 2

  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      const tfW = Math.min(170, Math.round(w * 0.24))
      const f = makeFrame(w - tfW - 12, h, [-rangeSpan, rangeSpan], [V_MAX / KNOT_MS, -V_MAX / KNOT_MS])
      drawField(ctx, f, db, 101, 51, -40, 0, MAP.lut)
      drawAxes(ctx, f, { xLabel: 'Range offset (m)', yLabel: 'Closing speed (kn)', grid: false })
      ctx.save()
      clipFrame(ctx, f)
      ctx.fillStyle = hexA(Q.reverb, 0.22)
      ctx.fillRect(f.x, sy(f, ridgeKn), f.w, sy(f, -ridgeKn) - sy(f, ridgeKn))
      ctx.strokeStyle = hexA(Q.reverb, 0.9)
      ctx.setLineDash([5, 4])
      ctx.strokeRect(f.x - 2, sy(f, ridgeKn), f.w + 4, sy(f, -ridgeKn) - sy(f, ridgeKn))
      ctx.restore()
      label(ctx, 'reverberation ridge', f.x + 8, sy(f, 0), '#f08ab0')
      dot(ctx, sx(f, 0), sy(f, speedKn), 6, C.accent)
      label(ctx, `target ${fmt(speedKn, 0)} kn`, sx(f, 0) + 12, sy(f, speedKn) - 12, C.accent)

      // The pulse as frequency against time.
      const tf = { x: w - tfW, y: 14, w: tfW - 14, h: h - 14 - 38 }
      ctx.fillStyle = C.panel
      ctx.fillRect(tf.x, tf.y, tf.w, tf.h)
      ctx.strokeStyle = C.axis
      ctx.strokeRect(tf.x + 0.5, tf.y + 0.5, tf.w, tf.h)
      const bFrac = wave.kind === 'cw' ? 0 : Math.min(0.8, wave.bandwidthHz / 600)
      ctx.strokeStyle = C.amber
      ctx.shadowColor = C.amber
      ctx.shadowBlur = 10
      ctx.lineWidth = 2.4
      ctx.beginPath()
      for (let i = 0; i <= 40; i++) {
        const u = i / 40
        const f1 = 1 - bFrac / 2
        const f2 = 1 + bFrac / 2
        const fr = wave.kind === 'hfm' ? (f1 * f2) / (f2 - u * (f2 - f1)) : f1 + u * (f2 - f1)
        const px = tf.x + 10 + u * (tf.w - 20)
        const py = tf.y + tf.h / 2 - ((fr - 1) / 0.8) * (tf.h - 40)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
      label(ctx, 'FREQUENCY', tf.x + 6, tf.y + 10, C.ink3, 'left', 10)
      label(ctx, `TIME · ${fmt(wave.durationS, 2)} s`, tf.x + tf.w / 2, tf.y + tf.h + 16, C.ink3, 'center', 10)
      label(ctx, wave.kind === 'cw' ? 'one tone' : `${fmt(wave.bandwidthHz, 0)} Hz sweep`, tf.x + tf.w / 2, tf.y + tf.h - 12, C.amber, 'center', 10)
    },
    [db, rangeSpan, speedKn, ridgeKn, wave],
  )

  const seMax = Math.max(20, ...results.map((r) => Math.abs(r.se)), Math.abs(custom.se))
  const bar = (se: number): ReactElement => (
    <div style={{ position: 'relative', height: 10, borderRadius: 5, background: C.panel, margin: '0.35rem 0 0.2rem' }}>
      <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: C.ink3 }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          borderRadius: 5,
          left: se >= 0 ? '50%' : `${50 - (Math.min(seMax, -se) / seMax) * 50}%`,
          width: `${(Math.min(seMax, Math.abs(se)) / seMax) * 50}%`,
          background: se >= 0 ? Q.se : C.critical,
        }}
      />
    </div>
  )

  return (
    <PlaygroundFrame
      title="Processor Lab"
      hint="The map shows how strongly a processor responds to an echo that is off in range and off in speed. A good waveform puts the target in a bright spot and the reverberation in a dark one. Below, four processors on one sensor judge the same echo."
      tag="WAVEFORM · PROCESSOR"
      side={
        <>
          <Segmented
            label="Waveform"
            value={kind}
            options={[
              { value: 'cw', label: 'CW' },
              { value: 'lfm', label: 'LFM' },
              { value: 'hfm', label: 'HFM' },
            ]}
            onChange={setKind}
          />
          <Slider label="Pulse length" value={duration} min={0.05} max={1} step={0.05} digits={2} unit="s" onChange={setDuration} />
          {kind !== 'cw' && <Slider label="Bandwidth" value={bandwidth} min={20} max={500} step={10} unit="Hz" onChange={setBandwidth} />}
          <Toggle label="Zoom the range axis ×12" checked={zoom} onChange={setZoom} />
          <Slider label="Target closing speed" value={speedKn} min={-25} max={25} step={1} unit="kn" onChange={setSpeedKn} />
          <Slider label="Reverb ridge half-width" value={ridgeKn} min={0.5} max={8} step={0.5} digits={1} unit="kn" onChange={setRidgeKn} />
          <Readouts>
            <Readout label="Range resolution" value={fmt(rangeResolutionM(wave), rangeResolutionM(wave) < 10 ? 2 : 0)} unit="m" tone="accent" />
            <Readout label="Speed resolution" value={fmt(speedResolutionMs(wave) / KNOT_MS, 2)} unit="kn" tone="accent" />
            <Readout label="Time-bandwidth gain" value={fmt(processingGainDb(wave), 1)} unit="dB" />
            <Readout label="Target Doppler" value={fmt(dopplerShiftHz(FC, speedMs), 1)} unit="Hz" />
            <Readout label="Doppler mismatch loss" value={fmt(loss, 1)} unit="dB" tone={loss > 3 ? 'bad' : 'good'} />
            <Readout label="This processor SE" value={fmt(custom.se, 1)} unit="dB" tone={custom.se >= 0 ? 'good' : 'bad'} />
          </Readouts>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 380 }} role="img" aria-label="Ambiguity surface of the selected waveform with the reverberation ridge and target" />
      <Colorbar map={MAP} lo={-40} hi={0} unit="dB" />
      <p className="pg-sub" style={{ marginTop: '1rem' }}>
        One sensor, four processors, the same echo
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.6rem' }}>
        {results.map((r) => (
          <div key={r.name} className="readout" style={{ borderColor: r === best ? C.accent : undefined, padding: '0.7rem 0.8rem' }}>
            <span>
              {r.name}
              {r === best ? ' · best' : ''}
            </span>
            <b>
              {fmt(r.se, 1)}
              <small>dB SE</small>
            </b>
            {bar(r.se)}
            <span style={{ textTransform: 'none', letterSpacing: 0 }}>
              {fmt(rangeResolutionM(r.wave), rangeResolutionM(r.wave) < 10 ? 1 : 0)} m · {fmt(speedResolutionMs(r.wave) / KNOT_MS, 1)} kn · {r.limit} limited
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem 1.4rem', marginTop: '0.9rem' }}>
        <Slider label="Echo level" value={echo} min={55} max={100} step={1} unit="dB" onChange={setEcho} />
        <Slider label="Noise spectrum level" value={noise} min={40} max={80} step={1} unit="dB/Hz" onChange={setNoise} />
        <Slider label="Reverb for a 1 s CW pulse" value={reverb} min={50} max={110} step={1} unit="dB" onChange={setReverb} />
      </div>
      <p className="pg-note">
        <b>What to try.</b> Set the target speed to zero: the CW processors drown in the ridge and the FM processors win on their small range cell. Now give the target 10
        knots: CW Doppler lifts it clear of the ridge and the long CW pulse takes over. Push the speed to 25 knots and compare LFM with HFM mismatch loss.
      </p>
    </PlaygroundFrame>
  )
}
