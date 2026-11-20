import { useMemo, useRef, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Legend, Readout, Readouts, Slider } from '../components/ui/controls'
import { clipFrame, drawAxes, hexA, ix, label, makeFrame, sx, sy, type Frame } from '../components/viz/canvasKit'
import { Plot } from '../components/viz/Plot'
import { C, Q } from '../components/viz/theme'
import { useAnimatedCanvas, usePointer } from '../components/viz/useCanvas'
import { dtCorrelatorDb, normPdf, pdFromIndex, podFromSe, qFunc } from '../lib/detection'
import { fmt } from '../lib/format'
import { createRng } from '../lib/rng'

const LOG_PFA = Array.from({ length: 121 }, (_v, i) => -6 + (6 * i) / 120)
const SE_AXIS = Array.from({ length: 81 }, (_v, i) => -20 + i * 0.5)
const LOOKS = 90

function pfaText(p: number): string {
  if (p >= 0.01) return fmt(p, 3)
  return p.toExponential(1).replace('e-', ' × 10⁻').replace(/⁻(\d)/, (_m, d: string) => `⁻${'⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]}`)
}

export default function DetectionBench(_: PlaygroundProps): ReactElement {
  const [dDb, setDDb] = useState(12)
  const [thr, setThr] = useState(2.6)
  const [sigma, setSigma] = useState(8)
  const [pulse, setPulse] = useState(1)
  const frame = useRef<Frame | null>(null)

  const d = Math.pow(10, dDb / 10)
  const mu = Math.sqrt(d)
  const pfa = qFunc(thr)
  const pd = qFunc(thr - mu)
  const xMax = Math.max(8, mu + 4)

  // A fixed stream of looks, noise only except for two stretches with the target present.
  const looks = useMemo(() => {
    const rng = createRng(5)
    return Array.from({ length: LOOKS }, (_v, i) => ({ present: (i > 18 && i < 38) || (i > 58 && i < 80), z: rng.gauss() }))
  }, [])
  const tally = looks.reduce(
    (acc, l) => {
      const v = l.z + (l.present ? mu : 0)
      const over = v > thr
      return {
        hits: acc.hits + (l.present && over ? 1 : 0),
        present: acc.present + (l.present ? 1 : 0),
        fa: acc.fa + (!l.present && over ? 1 : 0),
        absent: acc.absent + (l.present ? 0 : 1),
      }
    },
    { hits: 0, present: 0, fa: 0, absent: 0 },
  )

  const ref = useAnimatedCanvas((ctx, w, h, t) => {
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, w, h)
    const topH = Math.round(h * 0.56)
    const f = makeFrame(w, topH, [-4, xMax], [0.44, 0], { l: 52, r: 14, t: 14, b: 36 })
    frame.current = f
    ctx.fillStyle = C.panel
    ctx.fillRect(f.x, f.y, f.w, f.h)
    drawAxes(ctx, f, { xLabel: 'Detector output (noise standard deviations)', yLabel: 'Probability density', yTicks: 4 })

    const curve = (mean: number, from: number, to: number, close: boolean): void => {
      const n = 160
      ctx.beginPath()
      for (let i = 0; i <= n; i++) {
        const x = from + ((to - from) * i) / n
        const px = sx(f, x)
        const py = sy(f, normPdf(x, mean))
        if (i === 0) ctx.moveTo(px, close ? sy(f, 0) : py)
        if (i === 0 && close) ctx.lineTo(px, py)
        else ctx.lineTo(px, py)
      }
      if (close) {
        ctx.lineTo(sx(f, to), sy(f, 0))
        ctx.closePath()
      }
    }
    ctx.save()
    clipFrame(ctx, f)
    curve(mu, thr, xMax, true)
    ctx.fillStyle = hexA(Q.se, 0.45)
    ctx.fill()
    curve(0, thr, xMax, true)
    ctx.fillStyle = hexA(C.critical, 0.75)
    ctx.fill()
    curve(0, -4, xMax, false)
    ctx.strokeStyle = Q.noise
    ctx.lineWidth = 2
    ctx.stroke()
    curve(mu, -4, xMax, false)
    ctx.strokeStyle = Q.echo
    ctx.stroke()
    ctx.strokeStyle = C.ink
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(sx(f, thr), f.y)
    ctx.lineTo(sx(f, thr), f.y + f.h)
    ctx.stroke()
    ctx.restore()
    label(ctx, 'noise alone', sx(f, 0), sy(f, 0.4) - 12, Q.noise, 'center')
    label(ctx, 'echo + noise', sx(f, mu), sy(f, 0.4) - 12, Q.echo, 'center')
    label(ctx, 'threshold · drag', sx(f, thr) + 8, f.y + 12, C.ink)
    label(ctx, `Pd ${fmt(pd * 100, 0)}%`, sx(f, Math.max(thr, mu) + 0.6), sy(f, 0.12), '#5fe39a')
    label(ctx, `Pfa ${pfaText(pfa)}`, sx(f, thr) + 8, sy(f, 0.02) - 4, '#f08a8a')

    // The same threshold applied to a stream of looks.
    const g = makeFrame(w, h - topH, [0, LOOKS], [xMax, -4], { l: 52, r: 14, t: 8, b: 30 })
    g.y += topH
    ctx.fillStyle = C.panel
    ctx.fillRect(g.x, g.y, g.w, g.h)
    drawAxes(ctx, g, { xLabel: 'Successive looks (pings)', yLabel: 'Output', yTicks: 3, grid: false })
    ctx.save()
    clipFrame(ctx, g)
    ctx.fillStyle = hexA(Q.echo, 0.1)
    for (const [a, b] of [
      [18.5, 37.5],
      [58.5, 79.5],
    ]) {
      ctx.fillRect(sx(g, a), g.y, sx(g, b) - sx(g, a), g.h)
    }
    ctx.strokeStyle = C.ink
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(g.x, sy(g, thr))
    ctx.lineTo(g.x + g.w, sy(g, thr))
    ctx.stroke()
    const head = (t * 14) % (LOOKS + 12)
    looks.forEach((l, i) => {
      if (i > head) return
      const v = l.z + (l.present ? mu : 0)
      const px = sx(g, i + 0.5)
      const py = sy(g, Math.max(-4, Math.min(xMax, v)))
      const over = v > thr
      ctx.strokeStyle = 'rgba(140,190,225,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px, sy(g, -4))
      ctx.lineTo(px, py)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(px, py, over ? 4 : 2.6, 0, Math.PI * 2)
      ctx.fillStyle = over ? (l.present ? '#5fe39a' : '#f07a7a') : l.present ? hexA(Q.echo, 0.9) : C.ink3
      ctx.fill()
    })
    ctx.restore()
    label(ctx, 'target present', sx(g, 28), g.y + 10, Q.echo, 'center', 10)
    label(ctx, 'target present', sx(g, 69), g.y + 10, Q.echo, 'center', 10)
  })

  usePointer(ref, {
    onDown: (x) => {
      const f = frame.current
      return f ? Math.abs(x - sx(f, thr)) < 16 : false
    },
    onMove: (x, _y, dragging) => {
      const f = frame.current
      if (f && dragging) setThr(Math.round(Math.max(-1, Math.min(xMax - 0.5, ix(f, x))) * 20) / 20)
    },
  })

  const roc = (db: number): number[] => LOG_PFA.map((lp) => pdFromIndex(Math.pow(10, db / 10), Math.pow(10, lp)))

  return (
    <PlaygroundFrame
      title="Detection Bench"
      hint="Detection is one decision: is the output above the threshold. Slide the threshold and you trade missed echoes for false alarms. More signal to noise pulls the two curves apart and makes the trade easier."
      tag="THRESHOLD"
      side={
        <>
          <Slider label="Detection index, 10 log d" value={dDb} min={0} max={25} step={0.5} digits={1} unit="dB" onChange={setDDb} />
          <Slider label="Threshold" value={thr} min={-1} max={8} step={0.05} digits={2} unit="σ" onChange={setThr} />
          <Slider label="Pulse length, for DT" value={pulse} min={0.05} max={4} step={0.05} digits={2} unit="s" onChange={setPulse} />
          <Slider label="Fluctuation σ, for the SE curve" value={sigma} min={3} max={14} step={0.5} digits={1} unit="dB" onChange={setSigma} />
          <Readouts>
            <Readout label="Prob. of detection" value={fmt(pd * 100, 1)} unit="%" tone="good" />
            <Readout label="Prob. of false alarm" value={pfaText(pfa)} tone="bad" />
            <Readout label="False alarms / 10⁴ cells" value={fmt(pfa * 1e4, 1)} />
            <Readout label="DT, 1 Hz band" value={fmt(dtCorrelatorDb(d, pulse), 1)} unit="dB" tone="accent" />
            <Readout label="Stream: hits" value={`${tally.hits} / ${tally.present}`} />
            <Readout label="Stream: false alarms" value={`${tally.fa} / ${tally.absent}`} />
          </Readouts>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 470, cursor: 'ew-resize' }} role="img" aria-label="Noise and signal distributions with a movable threshold and a stream of looks" />
      <Legend
        items={[
          { label: 'Detection', color: '#5fe39a' },
          { label: 'False alarm', color: '#f07a7a' },
          { label: 'Missed echo', color: Q.echo },
          { label: 'Noise below threshold', color: C.ink3 },
        ]}
      />
      <div className="stage-pair" style={{ marginTop: '0.8rem' }}>
        <Plot
          ariaLabel="Receiver operating characteristic curves"
          series={[
            { id: 'r6', label: '6 dB', color: C.ink4, x: LOG_PFA, y: roc(6), width: 1.2 },
            { id: 'r10', label: '10 dB', color: C.ink3, x: LOG_PFA, y: roc(10), width: 1.2 },
            { id: 'r14', label: '14 dB', color: C.ink2, x: LOG_PFA, y: roc(14), width: 1.2 },
            { id: 'now', label: `Now, ${fmt(dDb, 1)} dB`, color: Q.se, x: LOG_PFA, y: roc(dDb), width: 2.6 },
          ]}
          xDomain={[-6, 0]}
          yDomain={[0, 1]}
          xLabel="False alarm probability"
          yLabel="Detection probability"
          xTicks={[-6, -5, -4, -3, -2, -1, 0]}
          xTickFormat={(v) => (v === 0 ? '1' : `10^${v}`)}
          xHover={(v) => `Pfa ${Math.pow(10, v).toExponential(1)}`}
          digits={2}
          height={270}
          points={pfa > 1e-6 ? [{ x: Math.log10(pfa), y: pd, color: C.ink, label: 'operating point' }] : []}
        />
        <Plot
          ariaLabel="Probability of detection against signal excess"
          series={[{ id: 'pod', label: 'Probability of detection', color: Q.se, x: SE_AXIS, y: SE_AXIS.map((s) => podFromSe(s, sigma)), fillTo: 0, width: 2.4 }]}
          xDomain={[-20, 20]}
          yDomain={[0, 1]}
          xLabel="Signal excess (dB)"
          yLabel="Detection probability"
          xUnit="dB"
          digits={2}
          height={270}
          marks={[
            { x: 0, label: 'SE = 0 means 50%', color: C.ink2 },
            { y: 0.5, label: '', color: C.ink4 },
          ]}
        />
      </div>
    </PlaygroundFrame>
  )
}
