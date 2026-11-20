import { useDeferredValue, useMemo, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Legend, Readout, Readouts, Select, Slider } from '../components/ui/controls'
import { hexA, label } from '../components/viz/canvasKit'
import { C, Q } from '../components/viz/theme'
import { useAnimatedCanvas } from '../components/viz/useCanvas'
import { DEG, KNOT_MS, SOUND_SPEED } from '../lib/db'
import { fmt, niceTicks } from '../lib/format'
import { detectionSpans } from '../lib/sonarEq'
import { getEnvironment } from '../lib/ssp'
import { PROP_OPTIONS, SIMPLE, defaultFreq, lossCurve } from './shared'

const CYCLE = 2.4
const RESET_PINGS = 60

export default function MonostaticSweep({ preset }: PlaygroundProps): ReactElement {
  const [prop, setProp] = useState(PROP_OPTIONS.some((p) => p.value === preset) ? (preset as string) : 'deep-cz')
  const [freq, setFreq] = useState(defaultFreq(PROP_OPTIONS.some((p) => p.value === preset) ? (preset as string) : 'deep-cz'))
  const [sl, setSl] = useState(225)
  const [ts, setTs] = useState(15)
  const [noise, setNoise] = useState(52)
  const [pri, setPri] = useState(100)
  const [tau, setTau] = useState(1)
  const [brg, setBrg] = useState(55)
  const [startFrac, setStartFrac] = useState(0.48)
  const [course, setCourse] = useState(235)
  const [speed, setSpeed] = useState(20)
  const q = useDeferredValue(prop)
  const fq = useDeferredValue(freq)
  const FC = freq * 1000

  const zs = q === SIMPLE ? 50 : getEnvironment(q).sourceDepth
  const curve = useMemo(() => lossCurve(q, zs, 100, fq), [q, zs, fq])
  const se = useMemo(() => curve.tl.map((tl) => sl - 2 * tl + ts - noise - 10), [curve, sl, ts, noise])
  const spans = useMemo(() => detectionSpans(curve.xsKm, se).filter(([a, b]) => b - a > curve.rMaxKm * 0.004), [curve, se])
  const rMax = curve.rMaxKm
  const rUnamb = (SOUND_SPEED * pri) / 2000
  const rBlind = (SOUND_SPEED * tau) / 2000
  const startKm = startFrac * rMax
  const detectable = (r: number): boolean => r > rBlind && r < rUnamb && spans.some(([a, b]) => r >= a && r <= b)

  const ref = useAnimatedCanvas((ctx, w, h, t) => {
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, w, h)
    const cx = w / 2
    const cy = h / 2
    const R = Math.min(w, h) / 2 - 26
    const k = R / rMax
    const ping = Math.floor(t / CYCLE)
    const frac = (t % CYCLE) / CYCLE
    const vx = Math.sin(course * DEG) * speed * KNOT_MS
    const vy = Math.cos(course * DEG) * speed * KNOT_MS
    const posAt = (n: number, extra = 0): { x: number; y: number; r: number } => {
      const sim = ((n % RESET_PINGS) + extra) * pri
      const x = Math.sin(brg * DEG) * startKm + (vx * sim) / 1000
      const y = Math.cos(brg * DEG) * startKm + (vy * sim) / 1000
      return { x, y, r: Math.hypot(x, y) }
    }
    const P = (x: number, y: number): [number, number] => [cx + x * k, cy - y * k]

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.clip()
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
    bg.addColorStop(0, '#0a2233')
    bg.addColorStop(1, '#050d15')
    ctx.fillStyle = bg
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R)

    // Rings where signal excess is positive.
    for (const [a, b] of spans) {
      ctx.beginPath()
      ctx.arc(cx, cy, Math.min(b, rUnamb) * k, 0, Math.PI * 2)
      ctx.arc(cx, cy, Math.max(a, rBlind) * k, 0, Math.PI * 2, true)
      if (Math.min(b, rUnamb) > Math.max(a, rBlind)) {
        ctx.fillStyle = hexA(Q.se, 0.42)
        ctx.fill('evenodd')
        ctx.strokeStyle = hexA('#5fe39a', 0.8)
        ctx.lineWidth = 1.2
        ctx.stroke()
      }
    }
    // Blind disc, since the receiver is deaf while it transmits.
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(3, rBlind * k), 0, Math.PI * 2)
    ctx.fillStyle = hexA(C.critical, 0.4)
    ctx.fill()

    // The listening front, the range being heard at this instant.
    const front = frac * rUnamb * k
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(0, front - i * 5), 0, Math.PI * 2)
      ctx.strokeStyle = hexA(C.accent, 0.55 - i * 0.13)
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.restore()

    for (const v of niceTicks(0, rMax, 5).filter((x) => x > 0)) {
      ctx.strokeStyle = C.grid
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, v * k, 0, Math.PI * 2)
      ctx.stroke()
      label(ctx, `${v} km`, cx + 4, cy - v * k + 9, C.ink4, 'left', 10)
    }
    ctx.strokeStyle = C.axis
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.stroke()
    for (let a = 0; a < 360; a += 30) label(ctx, String(a).padStart(3, '0'), cx + Math.sin(a * DEG) * (R + 13), cy - Math.cos(a * DEG) * (R + 12), C.ink3, 'center', 10)
    if (rUnamb < rMax) {
      ctx.save()
      ctx.setLineDash([6, 5])
      ctx.strokeStyle = Q.dt
      ctx.beginPath()
      ctx.arc(cx, cy, rUnamb * k, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      label(ctx, 'next ping transmits', cx, cy + rUnamb * k + 11, Q.dt, 'center', 10)
    }

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.clip()
    const now = posAt(ping, frac)
    const start = posAt(0)
    ctx.strokeStyle = hexA(C.amber, 0.35)
    ctx.setLineDash([3, 5])
    ctx.beginPath()
    ctx.moveTo(...P(start.x, start.y))
    ctx.lineTo(...P(start.x + (vx * RESET_PINGS * pri) / 1000, start.y + (vy * RESET_PINGS * pri) / 1000))
    ctx.stroke()
    ctx.setLineDash([])
    for (let i = 9; i >= 0; i--) {
      const n = ping - i
      if (n < 0 || Math.floor(n / RESET_PINGS) !== Math.floor(ping / RESET_PINGS)) continue
      const p = posAt(n)
      const heard = i > 0 || frac * rUnamb >= p.r
      if (!heard || !detectable(p.r)) continue
      const [bx, by] = P(p.x, p.y)
      ctx.fillStyle = hexA('#ffffff', Math.max(0.12, 1 - i * 0.1))
      ctx.shadowColor = C.accent
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(bx, by, 4.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
    const [tx, ty] = P(now.x, now.y)
    ctx.strokeStyle = C.amber
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(tx, ty, 7, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(tx, ty)
    ctx.lineTo(tx + Math.sin(course * DEG) * 18, ty - Math.cos(course * DEG) * 18)
    ctx.stroke()
    ctx.restore()
    ctx.fillStyle = C.accent
    ctx.beginPath()
    ctx.moveTo(cx, cy - 9)
    ctx.lineTo(cx + 5, cy + 6)
    ctx.lineTo(cx - 5, cy + 6)
    ctx.closePath()
    ctx.fill()

    const closing = now.r > 1e-6 ? -((now.x * vx + now.y * vy) / now.r) : 0
    const doppler = (2 * closing * FC) / SOUND_SPEED
    const status = now.r <= rBlind ? 'inside blind range' : now.r >= rUnamb ? 'beyond the ping interval' : detectable(now.r) ? 'detectable' : 'no signal excess here'
    const lines = [
      `range     ${fmt(now.r, 1)} km`,
      `bearing   ${String(Math.round(((Math.atan2(now.x, now.y) / DEG) % 360 + 360) % 360)).padStart(3, '0')}`,
      `echo at   ${fmt((2000 * now.r) / SOUND_SPEED, 1)} s`,
      `closing   ${fmt(closing / KNOT_MS, 1)} kn`,
      `doppler   ${fmt(doppler, 1)} Hz`,
      status,
    ]
    lines.forEach((s, i) => label(ctx, s, 12, 16 + i * 15, i === lines.length - 1 ? (detectable(now.r) ? '#5fe39a' : '#f08a8a') : C.ink2))
    label(ctx, `ping ${(ping % RESET_PINGS) + 1}`, w - 12, 16, C.ink3, 'right')
  })

  return (
    <PlaygroundFrame
      title="Monostatic Sweep"
      hint="A plan view around one sonar. The bright front is the range being listened to as time passes after the ping. Green rings are where signal excess is positive. A contact appears only when the front crosses a target inside a green ring."
      tag="PLAN VIEW · ONE SENSOR"
      side={
        <>
          <Select label="Propagation" value={prop} options={PROP_OPTIONS} onChange={(v) => { setProp(v); setFreq(defaultFreq(v)) }} />
          <Slider label="Frequency" value={freq} min={0.5} max={8} step={0.5} digits={1} unit="kHz" onChange={setFreq} />
          <Slider label="Ping interval" value={pri} min={5} max={200} step={5} unit="s" onChange={setPri} />
          <Slider label="Pulse length" value={tau} min={0.1} max={6} step={0.1} digits={1} unit="s" onChange={setTau} />
          <Slider label="Source level" value={sl} min={200} max={240} step={1} unit="dB" onChange={setSl} />
          <Slider label="Target strength" value={ts} min={0} max={30} step={1} unit="dB" onChange={setTs} />
          <Slider label="Noise at the beam" value={noise} min={40} max={80} step={1} unit="dB" onChange={setNoise} />
          <p className="pg-sub">Target track</p>
          <Slider label="Start bearing" value={brg} min={0} max={359} step={1} unit="°T" onChange={setBrg} />
          <Slider label="Start range" value={startFrac} min={0.05} max={0.98} step={0.01} format={() => `${fmt(startKm, 1)} km`} onChange={setStartFrac} />
          <Slider label="Course" value={course} min={0} max={359} step={1} unit="°T" onChange={setCourse} />
          <Slider label="Speed" value={speed} min={0} max={30} step={1} unit="kn" onChange={setSpeed} />
          <Readouts>
            <Readout label="Blind range" value={fmt(rBlind, 2)} unit="km" tone="bad" />
            <Readout label="Range per interval" value={fmt(rUnamb, 1)} unit="km" swatch={Q.dt} />
            <Readout label="Detection zones" value={`${spans.length}`} />
            <Readout label="Hz per knot" value={fmt((2 * KNOT_MS * FC) / SOUND_SPEED, 2)} />
          </Readouts>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 520 }} role="img" aria-label="Plan position display around a monostatic sonar with detection rings and a moving target" />
      <Legend
        items={[
          { label: 'Signal excess positive', color: Q.se },
          { label: 'Blind while transmitting', color: C.critical },
          { label: 'Listening front', color: C.accent },
          { label: 'True target position', color: C.amber },
          { label: 'Contacts', color: C.ink },
        ]}
      />
    </PlaygroundFrame>
  )
}
