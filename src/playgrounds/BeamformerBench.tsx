import { useMemo, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Readout, Readouts, Segmented, Slider } from '../components/ui/controls'
import { dot, hexA, label } from '../components/viz/canvasKit'
import { Plot } from '../components/viz/Plot'
import { C } from '../components/viz/theme'
import { useAnimatedCanvas } from '../components/viz/useCanvas'
import { beamPower, directivityIndexDb, halfPowerWidthDeg, hasGratingLobe, patternSweep, peakSidelobeDb, shadingWeights, type ArraySpec, type Shading } from '../lib/arrays'
import { DEG } from '../lib/db'
import { fmt } from '../lib/format'

const FLOOR = -45

export default function BeamformerBench(_: PlaygroundProps): ReactElement {
  const [n, setN] = useState(16)
  const [d, setD] = useState(0.5)
  const [steer, setSteer] = useState(20)
  const [shading, setShading] = useState<Shading>('uniform')
  const [arrive, setArrive] = useState(-35)

  const spec: ArraySpec = useMemo(() => ({ n, dOverLambda: d, steerDeg: steer, shading }), [n, d, steer, shading])
  const sweep = useMemo(() => patternSweep(spec, 721, FLOOR), [spec])
  const weights = useMemo(() => shadingWeights(n, shading), [n, shading])
  const di = useMemo(() => directivityIndexDb(spec), [spec])
  const width = useMemo(() => halfPowerWidthDeg(spec), [spec])
  const sidelobe = useMemo(() => peakSidelobeDb(spec), [spec])
  const grating = hasGratingLobe(spec)
  const response = 10 * Math.log10(Math.max(beamPower(spec, arrive, weights), 1e-9))

  const ref = useAnimatedCanvas((ctx, w, h, t) => {
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, w, h)
    const cx = w / 2
    const cy = h - 92
    const R = Math.min(w / 2 - 30, cy - 26)
    const pt = (deg: number, r: number): [number, number] => [cx + Math.sin(deg * DEG) * r, cy - Math.cos(deg * DEG) * r]

    // Incoming plane wave from the test direction.
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, cy)
    ctx.clip()
    const dirX = Math.sin(arrive * DEG)
    const dirY = -Math.cos(arrive * DEG)
    const spacing = 26
    for (let k = -4; k < 40; k++) {
      const dist = k * spacing - ((t * 34) % spacing)
      const mx = cx + dirX * dist
      const my = cy + dirY * dist
      ctx.strokeStyle = hexA(C.amber, 0.05 + 0.1 * Math.max(0, 1 - Math.abs(dist) / (R * 1.4)))
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(mx - dirY * 900, my + dirX * 900)
      ctx.lineTo(mx + dirY * 900, my - dirX * 900)
      ctx.stroke()
    }
    ctx.restore()

    // Polar grid, in dB.
    ctx.lineWidth = 1
    for (const db of [0, -10, -20, -30, -40]) {
      const r = R * (1 - db / FLOOR)
      ctx.strokeStyle = db === 0 ? C.axis : C.grid
      ctx.beginPath()
      ctx.arc(cx, cy, r, Math.PI, 0)
      ctx.stroke()
      if (db !== 0) label(ctx, `${db}`, cx + 4, cy - r - 7, C.ink4, 'left', 10)
    }
    for (let a = -90; a <= 90; a += 30) {
      const [x1, y1] = pt(a, R)
      ctx.strokeStyle = C.grid
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      const [lx, ly] = pt(a, R + 14)
      label(ctx, `${a}°`, lx, ly, C.ink3, 'center', 10)
    }

    ctx.save()
    ctx.beginPath()
    sweep.thetaDeg.forEach((a, i) => {
      const [x, y] = pt(a, R * (1 - sweep.db[i] / FLOOR))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.lineTo(cx, cy)
    ctx.closePath()
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
    g.addColorStop(0, hexA(C.accent, 0.05))
    g.addColorStop(1, hexA(C.accent, 0.4))
    ctx.fillStyle = g
    ctx.fill()
    ctx.shadowColor = C.accent
    ctx.shadowBlur = 12
    ctx.strokeStyle = C.accent
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    const [sx1, sy1] = pt(steer, R + 4)
    ctx.strokeStyle = hexA(C.ink, 0.6)
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(sx1, sy1)
    ctx.stroke()
    ctx.setLineDash([])
    const [ax, ay] = pt(arrive, R * (1 - Math.max(FLOOR, response) / FLOOR))
    const [ex, ey] = pt(arrive, R + 4)
    ctx.strokeStyle = hexA(C.amber, 0.7)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()
    dot(ctx, ax, ay, 5, C.amber)
    label(ctx, `arrival ${fmt(response, 1)} dB`, ax + (arrive > 0 ? 10 : -10), ay - 12, C.amber, arrive > 0 ? 'left' : 'right')
    label(ctx, 'steer', sx1 + (steer > 0 ? 6 : -6), sy1 - 8, C.ink2, steer > 0 ? 'left' : 'right')

    // Elements and the steering delay on each.
    const span = Math.min(w - 80, 460)
    const x0 = cx - span / 2
    const gap = n > 1 ? span / (n - 1) : 0
    const maxDelay = Math.max(1e-6, (n - 1) * d * Math.abs(Math.sin(steer * DEG)))
    ctx.strokeStyle = C.axis
    ctx.beginPath()
    ctx.moveTo(x0 - 10, cy)
    ctx.lineTo(x0 + span + 10, cy)
    ctx.stroke()
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? cx : x0 + i * gap
      const phase = 2 * Math.PI * d * i * Math.sin(arrive * DEG) - t * 8
      const amp = 0.5 + 0.5 * Math.cos(phase)
      ctx.fillStyle = hexA(C.amber, 0.25 + 0.6 * amp)
      ctx.beginPath()
      ctx.arc(x, cy, 3.2 + 2.2 * weights[i], 0, Math.PI * 2)
      ctx.fill()
      const delay = (steer >= 0 ? i : n - 1 - i) * d * Math.abs(Math.sin(steer * DEG))
      const bar = (delay / maxDelay) * 42
      ctx.fillStyle = hexA(C.blue, 0.75)
      ctx.fillRect(x - Math.max(1.5, gap * 0.3), cy + 14, Math.max(3, gap * 0.6), Math.abs(steer) < 0.5 ? 1 : bar)
    }
    label(ctx, 'hydrophones · dot size is shading weight', x0, cy + 70, C.ink3)
    label(ctx, 'bars: delay applied to steer', x0 + span, cy + 70, C.blue, 'right')
  })

  const diffDeg = Math.abs(arrive - steer)

  return (
    <PlaygroundFrame
      title="Beamformer Bench"
      hint="Delay each hydrophone so a wave from one direction lines up, then add. That direction is reinforced and the rest is not. The amber wave is a test arrival: move it off the steer direction and watch the output fall."
      tag="LINE ARRAY"
      side={
        <>
          <Slider label="Elements" value={n} min={2} max={48} step={1} onChange={setN} />
          <Slider label="Spacing" value={d} min={0.2} max={1.5} step={0.05} digits={2} unit="λ" onChange={setD} />
          <Slider label="Steer angle from broadside" value={steer} min={-75} max={75} step={1} unit="°" onChange={setSteer} />
          <Slider label="Test arrival angle" value={arrive} min={-90} max={90} step={1} unit="°" onChange={setArrive} />
          <Segmented
            label="Shading"
            value={shading}
            options={[
              { value: 'uniform', label: 'Uniform' },
              { value: 'hamming', label: 'Hamming' },
              { value: 'hann', label: 'Hann' },
              { value: 'chebyshev', label: 'Taper' },
            ]}
            onChange={setShading}
          />
          <Readouts>
            <Readout label="Aperture" value={fmt((n - 1) * d, 1)} unit="λ" />
            <Readout label="Beamwidth" value={fmt(width, 1)} unit="°" tone="accent" />
            <Readout label="Directivity index" value={fmt(di, 1)} unit="dB" tone="accent" />
            <Readout label="Peak sidelobe" value={fmt(sidelobe, 1)} unit="dB" />
            <Readout label="Test arrival" value={fmt(response, 1)} unit="dB" swatch={C.amber} />
            <Readout label="Grating lobe" value={grating ? 'yes' : 'none'} tone={grating ? 'bad' : 'good'} />
          </Readouts>
          <p className="pg-note">
            The test arrival is {fmt(diffDeg, 0)}° off the steer direction. {grating ? 'With this spacing a second full-strength lobe appears: the array cannot tell those two directions apart.' : 'Spacing is tight enough that only one main lobe exists.'}
          </p>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 420 }} role="img" aria-label="Polar beam pattern of a line array with an arriving plane wave" />
      <div style={{ marginTop: '0.8rem' }}>
        <Plot
          ariaLabel="Beam pattern in decibels against angle"
          series={[{ id: 'p', label: 'Beam response', color: C.accent, x: sweep.thetaDeg, y: sweep.db, fillTo: FLOOR, fillOpacity: 0.12 }]}
          xDomain={[-90, 90]}
          yDomain={[FLOOR, 2]}
          xLabel="Angle from broadside (deg)"
          yLabel="Response (dB)"
          xUnit="°"
          yUnit="dB"
          height={220}
          marks={[
            { x: steer, label: 'steer', color: C.ink2 },
            { x: arrive, label: 'arrival', color: C.amber },
            { y: -3, label: '−3 dB', color: C.ink3 },
          ]}
        />
      </div>
    </PlaygroundFrame>
  )
}
