import { useMemo, useRef, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Legend, Readout, Readouts, Slider, Toggle } from '../components/ui/controls'
import { clipFrame, dot, drawAxes, hexA, label, makeFrame, sx, sy } from '../components/viz/canvasKit'
import { C, Q } from '../components/viz/theme'
import { useAnimatedCanvas } from '../components/viz/useCanvas'
import { SOUND_SPEED, powerSumDb } from '../lib/db'
import { fmt } from '../lib/format'
import { echoLevelDb, reverbAtRange, type ReverbInputs } from '../lib/reverb'
import { createRng } from '../lib/rng'

const T_MAX = 26
const DEPTH = 400
const SRC_DEPTH = 60
const R_MAX = (T_MAX * SOUND_SPEED) / 2 / 1000

/** One ping animated in the water and on the receiver trace at the same moment. */
export default function PingLifecycle(_: PlaygroundProps): ReactElement {
  const [rangeKm, setRangeKm] = useState(11)
  const [ts, setTs] = useState(12)
  const [sl, setSl] = useState(215)
  const [noise, setNoise] = useState(58)
  const [tau, setTau] = useState(0.4)
  const [playing, setPlaying] = useState(true)
  const clock = useRef(0)

  const reverb: ReverbInputs = useMemo(
    () => ({ slDb: sl, fKhz: 3.5, tauEff: tau, horizBeamDeg: 12, vertBeamDeg: 20, sourceDepth: SRC_DEPTH, waterDepth: DEPTH, muDb: -27, windKn: 14, svDb: -82, ductGrazingDeg: 5 }),
    [sl, tau],
  )

  const trace = useMemo(() => {
    const rng = createRng(11)
    const n = 520
    const tEcho = (2 * rangeKm * 1000) / SOUND_SPEED
    const echo = echoLevelDb(sl, ts, rangeKm * 1000, 3.5)
    return Array.from({ length: n }, (_v, i) => {
      const t = (i / (n - 1)) * T_MAX
      const r = Math.max(30, (t * SOUND_SPEED) / 2)
      const rl = reverbAtRange(reverb, r).total
      const blast = t < tau * 1.5 ? sl - 60 - (t / (tau * 1.5)) * 30 : -Infinity
      const inEcho = Math.abs(t - tEcho - tau / 2) <= tau / 2
      const level = powerSumDb([rl + rng.gauss() * 1.4, noise + rng.gauss() * 1.2, blast, inEcho ? echo : -Infinity])
      return { t, level, rl, echo: inEcho }
    })
  }, [reverb, rangeKm, ts, sl, noise, tau])

  const tEcho = (2 * rangeKm * 1000) / SOUND_SPEED
  const el = echoLevelDb(sl, ts, rangeKm * 1000, 3.5)
  const rlAtTarget = reverbAtRange(reverb, rangeKm * 1000).total
  const masking = powerSumDb([rlAtTarget, noise])
  const tlOneWay = (sl + ts - el) / 2

  const ref = useAnimatedCanvas(
    (ctx, w, h, time) => {
      if (playing) clock.current = time % (T_MAX + 2.5)
      const t = Math.min(clock.current, T_MAX)
      const sceneH = Math.round(h * 0.52)
      const scene = makeFrame(w, sceneH, [0, R_MAX], [0, DEPTH], { l: 52, r: 14, t: 12, b: 30 })
      const plot = makeFrame(w, h - sceneH, [0, T_MAX], [140, 40], { l: 52, r: 14, t: 6, b: 38 })
      plot.y += sceneH

      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      const water = ctx.createLinearGradient(0, scene.y, 0, scene.y + scene.h)
      water.addColorStop(0, '#0b2a3f')
      water.addColorStop(1, '#050f18')
      ctx.fillStyle = water
      ctx.fillRect(scene.x, scene.y, scene.w, scene.h)

      const src = { x: sx(scene, 0) + 6, y: sy(scene, SRC_DEPTH) }
      const tgt = { x: sx(scene, rangeKm), y: sy(scene, 210) }
      const kmPerPx = R_MAX / scene.w
      const front = (t * SOUND_SPEED) / 1000 / kmPerPx
      const pulsePx = Math.max(3, (tau * SOUND_SPEED) / 1000 / kmPerPx)

      ctx.save()
      clipFrame(ctx, scene)
      ctx.globalCompositeOperation = 'lighter'
      // Outgoing pulse, a shell as thick as the pulse is long.
      if (front < scene.w * 2.2) {
        ctx.beginPath()
        ctx.arc(src.x, src.y, Math.max(1, front - pulsePx / 2), 0, Math.PI * 2)
        ctx.lineWidth = pulsePx
        ctx.strokeStyle = hexA(Q.source, 0.5 * Math.max(0.15, 1 - front / (scene.w * 2.2)))
        ctx.stroke()
      }
      // Boundary scatter where the shell meets the surface and the bottom.
      const rng = createRng(Math.floor(t * 30))
      for (const yb of [scene.y + 1, scene.y + scene.h - 1]) {
        const dy = Math.abs(yb - src.y)
        if (front > dy) {
          const xHit = src.x + Math.sqrt(front * front - dy * dy)
          for (let k = 0; k < 16; k++) {
            const px = xHit - rng.next() * pulsePx * 1.6
            const py = yb + (yb < src.y ? 1 : -1) * rng.next() * 9
            ctx.fillStyle = hexA(Q.reverb, 0.3 + rng.next() * 0.6)
            ctx.fillRect(px, py, 2, 2)
          }
        }
      }
      const hitAt = Math.hypot(tgt.x - src.x, tgt.y - src.y)
      if (front > hitAt) {
        const back = front - hitAt
        ctx.beginPath()
        ctx.arc(tgt.x, tgt.y, Math.max(1, back - pulsePx / 2), 0, Math.PI * 2)
        ctx.lineWidth = Math.max(2, pulsePx * 0.6)
        ctx.strokeStyle = hexA(Q.echo, Math.max(0.12, 0.75 - back / (scene.w * 1.4)))
        ctx.stroke()
      }
      ctx.restore()

      ctx.fillStyle = C.seabed
      ctx.fillRect(scene.x, scene.y + scene.h - 5, scene.w, 5)
      ctx.save()
      ctx.translate(tgt.x, tgt.y)
      ctx.fillStyle = '#1b2c3a'
      ctx.strokeStyle = C.amber
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.ellipse(0, 0, 22, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillRect(-3, -10, 8, 6)
      ctx.strokeRect(-3, -10, 8, 6)
      ctx.restore()
      label(ctx, 'target', tgt.x, tgt.y + 17, C.amber, 'center')
      dot(ctx, src.x, src.y, 5, C.accent)
      label(ctx, 'source + receiver', src.x + 10, src.y - 12, C.ink2)
      drawAxes(ctx, scene, { xLabel: 'Range (km)', yLabel: 'Depth (m)', grid: false, yTicks: 3 })

      // Receiver trace, drawn up to the current time.
      ctx.fillStyle = C.panel
      ctx.fillRect(plot.x, plot.y, plot.w, plot.h)
      drawAxes(ctx, plot, { xLabel: 'Time after transmit (s)', yLabel: 'Level (dB)', yTicks: 4 })
      ctx.save()
      clipFrame(ctx, plot)
      ctx.strokeStyle = hexA(Q.noise, 0.9)
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(plot.x, sy(plot, noise))
      ctx.lineTo(plot.x + plot.w, sy(plot, noise))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = hexA(Q.reverb, 0.55)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      trace.forEach((p, i) => {
        if (!Number.isFinite(p.rl)) return
        const px = sx(plot, p.t)
        const py = sy(plot, p.rl)
        if (i === 0 || !Number.isFinite(trace[i - 1].rl)) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
      ctx.lineWidth = 1.6
      ctx.strokeStyle = C.ink
      ctx.shadowColor = C.accent
      ctx.shadowBlur = 8
      ctx.beginPath()
      let started = false
      for (const p of trace) {
        if (p.t > t) break
        const px = sx(plot, p.t)
        const py = sy(plot, Math.min(140, p.level))
        if (started) ctx.lineTo(px, py)
        else ctx.moveTo(px, py)
        started = true
      }
      ctx.stroke()
      ctx.shadowBlur = 0
      if (t >= tEcho) {
        ctx.fillStyle = hexA(Q.echo, 0.22)
        ctx.fillRect(sx(plot, tEcho), plot.y, Math.max(3, sx(plot, tEcho + tau) - sx(plot, tEcho)), plot.h)
      }
      ctx.strokeStyle = 'rgba(232,240,246,0.5)'
      ctx.beginPath()
      ctx.moveTo(sx(plot, t), plot.y)
      ctx.lineTo(sx(plot, t), plot.y + plot.h)
      ctx.stroke()
      ctx.restore()
      label(ctx, 'direct blast', sx(plot, 0) + 8, plot.y + 12, C.ink2)
      label(ctx, 'noise floor', plot.x + plot.w - 6, sy(plot, noise) - 9, Q.noise, 'right')
      if (t >= tEcho) label(ctx, 'echo', sx(plot, tEcho + tau / 2), sy(plot, Math.min(138, el)) - 12, C.amber, 'center')
      label(ctx, 'reverberation decays', sx(plot, 2.4), sy(plot, reverbAtRange(reverb, 1800).total) - 14, Q.reverb)
    },
    true,
    tEcho + 1,
  )

  return (
    <PlaygroundFrame
      title="Ping Lifecycle"
      hint="One transmission, seen two ways at once: in the water above, and on the receiver’s time trace below. The echo only matters if it stands above everything else that arrives with it."
      tag="ONE PING"
      side={
        <>
          <Slider label="Target range" value={rangeKm} min={2} max={18} step={0.5} unit="km" digits={1} onChange={setRangeKm} />
          <Slider label="Target strength" value={ts} min={-5} max={30} step={1} unit="dB" onChange={setTs} />
          <Slider label="Source level" value={sl} min={195} max={230} step={1} unit="dB" onChange={setSl} />
          <Slider label="Noise at the beam" value={noise} min={40} max={80} step={1} unit="dB" onChange={setNoise} />
          <Slider label="Pulse length" value={tau} min={0.05} max={1.5} step={0.05} unit="s" digits={2} onChange={setTau} />
          <Toggle label="Run the clock" checked={playing} onChange={setPlaying} />
          <div className="ledger">
            <div>
              <span>Source level</span>
              <span>{fmt(sl, 0)}</span>
            </div>
            <div>
              <span>Loss out</span>
              <span>−{fmt(tlOneWay, 1)}</span>
            </div>
            <div>
              <span>Target strength</span>
              <span>{ts >= 0 ? '+' : '−'}{fmt(Math.abs(ts), 0)}</span>
            </div>
            <div>
              <span>Loss back</span>
              <span>−{fmt(tlOneWay, 1)}</span>
            </div>
            <div className="sum">
              <span>Echo level</span>
              <span>{fmt(el, 1)} dB</span>
            </div>
          </div>
          <Readouts>
            <Readout label="Echo arrives" value={fmt(tEcho, 1)} unit="s" />
            <Readout label="Reverb then" value={fmt(rlAtTarget, 1)} unit="dB" swatch={Q.reverb} />
            <Readout label="Masking" value={fmt(masking, 1)} unit="dB" />
            <Readout label="Echo − mask" value={fmt(el - masking, 1)} unit="dB" tone={el - masking > 10 ? 'good' : 'bad'} />
          </Readouts>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 500 }} role="img" aria-label="Animated ping travelling to a target and the received level over time" />
      <Legend
        items={[
          { label: 'Transmitted pulse', color: Q.source },
          { label: 'Echo', color: Q.echo },
          { label: 'Reverberation', color: Q.reverb },
          { label: 'Noise', color: Q.noise, dash: true },
          { label: 'What the receiver hears', color: C.ink },
        ]}
      />
    </PlaygroundFrame>
  )
}
