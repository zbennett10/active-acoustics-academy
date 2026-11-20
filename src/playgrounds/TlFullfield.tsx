import { useDeferredValue, useMemo, useRef, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Colorbar, Readout, Readouts, Select, Slider, Toggle } from '../components/ui/controls'
import { clipFrame, dot, drawAxes, drawField, drawSeabed, inFrame, ix, iy, label, makeFrame, sx, sy, type Frame } from '../components/viz/canvasKit'
import { Plot } from '../components/viz/Plot'
import { C, Q } from '../components/viz/theme'
import { useCanvas, usePointer } from '../components/viz/useCanvas'
import { simpleTlDb, thorpDbPerKm } from '../lib/absorption'
import { COLORMAPS } from '../lib/colormaps'
import { fmt } from '../lib/format'
import { ENVIRONMENTS, getEnvironment, prepareEnv } from '../lib/ssp'
import { computeTlField, tlAt, tlSlice } from '../lib/tlfield'

const ENV_OPTIONS = ENVIRONMENTS.map((e) => ({ value: e.id, label: e.name }))
const MAP = COLORMAPS.abyss

export default function TlFullfield({ preset }: PlaygroundProps): ReactElement {
  const initial = ENVIRONMENTS.some((e) => e.id === preset) ? (preset as string) : 'surface-duct'
  const [envId, setEnvId] = useState(initial)
  const [freq, setFreq] = useState(3.5)
  const [zs, setZs] = useState(getEnvironment(initial).sourceDepth)
  const [zr, setZr] = useState(initial === 'surface-duct' ? 60 : 150)
  const [zoom, setZoom] = useState(initial === 'surface-duct' ? 800 : 0)
  const [beamOn, setBeamOn] = useState(false)
  const [steer, setSteer] = useState(0)
  const [width, setWidth] = useState(12)
  const [lo, setLo] = useState(60)
  const [hi, setHi] = useState(115)
  const [hover, setHover] = useState<{ r: number; z: number } | null>(null)
  const frame = useRef<Frame | null>(null)

  const env = getEnvironment(envId)
  const prep = useMemo(() => prepareEnv(env), [env])
  const rMax = env.rMaxKm * 1000
  const zView = zoom > 0 ? Math.min(zoom, prep.zMax) : prep.zMax
  const params = useDeferredValue({ zs, freq, beamOn, steer, width })

  const field = useMemo(
    () =>
      computeTlField(prep, {
        zs: Math.min(params.zs, prep.zMax - 5),
        freqKhz: params.freq,
        rMax,
        nr: 280,
        nz: 200,
        nRays: 1000,
        fanDeg: prep.zMax < 500 ? 70 : 50,
        beam: params.beamOn ? { steerDeg: params.steer, widthDeg: params.width } : undefined,
      }),
    [prep, rMax, params],
  )
  const slice = useMemo(() => tlSlice(field, Math.min(zr, prep.zMax - 1)), [field, zr, prep])
  const xs = slice.rangeM.map((r) => r / 1000)
  const sph = slice.rangeM.map((r) => simpleTlDb(r, freq, 'spherical'))
  const cyl = slice.rangeM.map((r) => simpleTlDb(r, freq, 'hybrid', 1000))
  const finite = slice.tl.filter((v) => Number.isFinite(v) && v < 150)
  const best = finite.length ? Math.min(...finite.slice(Math.floor(finite.length * 0.2))) : NaN

  const ref = useCanvas(
    (ctx, w, h) => {
      const f = makeFrame(w, h, [0, env.rMaxKm], [0, zView])
      frame.current = f
      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      ctx.save()
      clipFrame(ctx, f)
      drawField(ctx, { ...f, h: (f.h * prep.zMax) / zView }, field.tl, field.nr, field.nz, lo, hi, MAP.lut, true)
      ctx.restore()
      drawSeabed(
        ctx,
        f,
        env.bathy.map((b) => ({ r: b.rKm, z: b.z })),
      )
      drawAxes(ctx, f, { xLabel: 'Range (km)', yLabel: 'Depth (m)', grid: false, yTicks: 6 })

      const yr = sy(f, Math.min(zr, zView))
      ctx.save()
      ctx.setLineDash([6, 5])
      ctx.strokeStyle = Q.echo
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(f.x, yr)
      ctx.lineTo(f.x + f.w, yr)
      ctx.stroke()
      ctx.restore()
      label(ctx, `receiver depth ${fmt(zr, 0)} m · drag`, f.x + f.w - 8, yr - 10, C.ink, 'right')
      dot(ctx, f.x + 1, sy(f, Math.min(zs, zView)), 5, C.ink)

      if (hover) {
        const px = sx(f, hover.r)
        const py = sy(f, hover.z)
        const v = tlAt(field, hover.r * 1000, hover.z)
        ctx.strokeStyle = 'rgba(232,240,246,0.7)'
        ctx.beginPath()
        ctx.arc(px, py, 6, 0, Math.PI * 2)
        ctx.stroke()
        const right = px > f.x + f.w * 0.7
        label(
          ctx,
          Number.isNaN(v) ? 'seabed' : `${fmt(hover.r, 1)} km · ${fmt(hover.z, 0)} m · TL ${fmt(v, 1)} dB`,
          px + (right ? -12 : 12),
          Math.max(f.y + 10, py - 14),
          C.ink,
          right ? 'right' : 'left',
        )
      }
    },
    [field, env, prep, zView, zr, zs, lo, hi, hover],
  )

  usePointer(ref, {
    onDown: (_x, y) => {
      const f = frame.current
      return f ? Math.abs(y - sy(f, zr)) < 12 : false
    },
    onMove: (x, y, dragging) => {
      const f = frame.current
      if (!f) return
      if (dragging) {
        setZr(Math.round(Math.min(zView, Math.max(2, iy(f, y)))))
        return
      }
      setHover(inFrame(f, x, y) ? { r: ix(f, x), z: iy(f, y) } : null)
    },
  })

  const pick = (id: string): void => {
    const e = getEnvironment(id)
    setEnvId(id)
    setZs(e.sourceDepth)
    setZoom(id === 'surface-duct' ? 800 : 0)
    setZr(id === 'surface-duct' ? 60 : Math.round(Math.min(150, prepareEnv(e).zMax * 0.5)))
  }

  return (
    <PlaygroundFrame
      title="TL Full-Field"
      hint="Transmission loss everywhere at once: range across, depth down, bright where sound arrives strongly. Drag the dashed line to choose a receiver depth and read the loss curve underneath."
      tag="RANGE × DEPTH"
      side={
        <>
          <Select label="Environment" value={envId} options={ENV_OPTIONS} onChange={pick} />
          <Slider label="Frequency" value={freq} min={0.5} max={10} step={0.5} unit="kHz" digits={1} onChange={setFreq} />
          <Slider label="Source depth" value={Math.min(zs, Math.round(prep.zMax - 5))} min={2} max={Math.round(prep.zMax - 5)} step={1} unit="m" onChange={setZs} />
          <Slider label="Depth shown" value={Math.round(zView)} min={Math.min(200, Math.round(prep.zMax))} max={Math.round(prep.zMax)} step={10} unit="m" onChange={setZoom} />
          <Toggle label="Transmit through a vertical beam" checked={beamOn} onChange={setBeamOn} />
          {beamOn && (
            <>
              <Slider label="Beam steer (down is positive)" value={steer} min={-40} max={40} step={1} unit="°" onChange={setSteer} />
              <Slider label="Beam width" value={width} min={4} max={60} step={1} unit="°" onChange={setWidth} />
            </>
          )}
          <Slider label="Color floor (least loss)" value={lo} min={40} max={90} step={1} unit="dB" onChange={(v) => setLo(Math.min(v, hi - 10))} />
          <Slider label="Color ceiling (most loss)" value={hi} min={80} max={150} step={1} unit="dB" onChange={(v) => setHi(Math.max(v, lo + 10))} />
          <Readouts>
            <Readout label="Absorption" value={fmt(thorpDbPerKm(freq), 2)} unit="dB/km" />
            <Readout label="Least loss" value={fmt(best, 1)} unit="dB" tone="accent" />
          </Readouts>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 380, cursor: 'crosshair' }} role="img" aria-label={`Transmission loss field for ${env.name}`} />
      <Colorbar map={MAP} lo={hi} hi={lo} unit="dB" />
      <div style={{ marginTop: '0.8rem' }}>
        <Plot
          ariaLabel="Transmission loss against range at the receiver depth"
          series={[
            { id: 'tl', label: `Model at ${fmt(zr, 0)} m`, color: Q.echo, x: xs, y: slice.tl, width: 2.2 },
            { id: 'sph', label: 'Spherical + absorption', color: C.ink3, x: xs, y: sph, dash: true, width: 1.4 },
            { id: 'cyl', label: 'Cylindrical beyond 1 km', color: Q.source, x: xs, y: cyl, dash: true, width: 1.4 },
          ]}
          xDomain={[0, env.rMaxKm]}
          yDomain={[130, 50]}
          xLabel="Range (km)"
          yLabel="Loss (dB)"
          xUnit="km"
          yUnit="dB"
          height={250}
        />
      </div>
    </PlaygroundFrame>
  )
}
