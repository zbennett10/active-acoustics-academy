import { useMemo, useRef, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Legend, Readout, Readouts, Select, Slider } from '../components/ui/controls'
import { clipFrame, dot, drawAxes, drawSeabed, glowPath, inFrame, iy, ix, label, sx, sy, type Frame } from '../components/viz/canvasKit'
import { C, RAY_COLORS } from '../components/viz/theme'
import { useCanvas, usePointer, useReveal } from '../components/viz/useCanvas'
import { fmt } from '../lib/format'
import { traceFan } from '../lib/rays'
import { ENVIRONMENTS, getEnvironment, prepareEnv, soundSpeedAt, type Environment } from '../lib/ssp'

const ENV_OPTIONS = ENVIRONMENTS.map((e) => ({ value: e.id, label: e.name }))
const SSP_W = 118

function withLayer(env: Environment, layer: number): Environment {
  if (env.id !== 'surface-duct') return env
  return {
    ...env,
    ssp: [
      { z: 0, c: 1500 },
      { z: layer, c: 1500 + 0.016 * layer },
      { z: layer + 200, c: 1492 },
      { z: 1000, c: 1482 },
      { z: 4500, c: 1540 },
    ],
  }
}

export default function RayLab({ preset }: PlaygroundProps): ReactElement {
  const initial = ENVIRONMENTS.some((e) => e.id === preset) ? (preset as string) : 'deep-cz'
  const [envId, setEnvId] = useState(initial)
  const [zs, setZs] = useState(getEnvironment(initial).sourceDepth)
  const [fan, setFan] = useState(initial === 'surface-duct' ? 6 : 12)
  const [count, setCount] = useState(41)
  const [layer, setLayer] = useState(100)
  const [zoom, setZoom] = useState(initial === 'surface-duct' ? 600 : 0)
  const [hover, setHover] = useState<{ r: number; z: number } | null>(null)
  const frames = useRef<{ ssp: Frame; ray: Frame } | null>(null)

  const env = useMemo(() => withLayer(getEnvironment(envId), layer), [envId, layer])
  const prep = useMemo(() => prepareEnv(env), [env])
  const rMax = env.rMaxKm * 1000
  const zView = zoom > 0 ? Math.min(zoom, prep.zMax) : prep.zMax
  const rays = useMemo(() => traceFan(prep, Math.min(zs, prep.zMax - 5), -fan, fan, count, rMax), [prep, zs, fan, count, rMax])
  const reveal = useReveal([rays], 1500)

  const tally = useMemo(
    () => rays.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {}),
    [rays],
  )
  const cRange = useMemo(() => {
    const cs = env.ssp.map((p) => p.c)
    return [Math.min(...cs) - 4, Math.max(...cs) + 4] as const
  }, [env])
  const axis = useMemo(() => env.ssp.reduce((best, p) => (p.c < best.c ? p : best), env.ssp[0]), [env])

  const ref = useCanvas(
    (ctx, w, h) => {
      const top = 14
      const bottom = 40
      const ssp: Frame = { x: 50, y: top, w: SSP_W, h: h - top - bottom, x0: cRange[0], x1: cRange[1], y0: 0, y1: zView }
      const ray: Frame = { x: 50 + SSP_W + 22, y: top, w: w - (50 + SSP_W + 22) - 14, h: h - top - bottom, x0: 0, x1: env.rMaxKm, y0: 0, y1: zView }
      frames.current = { ssp, ray }

      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      const water = ctx.createLinearGradient(0, ray.y, 0, ray.y + ray.h)
      water.addColorStop(0, '#0a2436')
      water.addColorStop(1, '#040c14')
      ctx.fillStyle = water
      ctx.fillRect(ray.x, ray.y, ray.w, ray.h)
      ctx.fillRect(ssp.x, ssp.y, ssp.w, ssp.h)

      // Rays, blended additively so focusing shows up as brightness.
      ctx.save()
      clipFrame(ctx, ray)
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineWidth = 1.15
      const limit = reveal * rMax
      for (const r of rays) {
        ctx.beginPath()
        for (let i = 0; i < r.n; i++) {
          if (r.r[i] > limit) break
          const px = sx(ray, r.r[i] / 1000)
          const py = sy(ray, r.z[i])
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.strokeStyle = RAY_COLORS[r.kind]
        ctx.globalAlpha = 0.62
        ctx.stroke()
      }
      ctx.restore()

      drawSeabed(
        ctx,
        ray,
        env.bathy.map((b) => ({ r: b.rKm, z: b.z })),
      )
      drawAxes(ctx, ray, { xLabel: 'Range (km)', grid: true, yTicks: 6 })
      drawAxes(ctx, ssp, { xLabel: 'Speed (m/s)', yLabel: 'Depth (m)', xTicks: 3, yTicks: 6 })

      ctx.save()
      clipFrame(ctx, ssp)
      glowPath(
        ctx,
        () => {
          const n = 160
          for (let i = 0; i <= n; i++) {
            const z = (zView * i) / n
            const px = sx(ssp, soundSpeedAt(prep, z))
            const py = sy(ssp, z)
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
        },
        C.amber,
        2,
        10,
      )
      ctx.restore()
      label(ctx, 'c(z)', ssp.x + 6, ssp.y + 10, C.amber)

      // Source depth, drawn across both panels.
      const zSrc = Math.min(zs, prep.zMax - 5)
      ctx.save()
      ctx.setLineDash([3, 4])
      ctx.strokeStyle = 'rgba(232,240,246,0.3)'
      ctx.beginPath()
      ctx.moveTo(ssp.x, sy(ssp, zSrc))
      ctx.lineTo(ray.x, sy(ray, zSrc))
      ctx.stroke()
      ctx.restore()
      dot(ctx, ray.x, sy(ray, zSrc), 5.5, C.ink)
      label(ctx, 'source · drag', ray.x + 12, sy(ray, zSrc) - 12, C.ink2)

      if (hover) {
        const px = sx(ray, hover.r)
        const py = sy(ray, hover.z)
        ctx.save()
        ctx.strokeStyle = 'rgba(232,240,246,0.35)'
        ctx.setLineDash([2, 4])
        ctx.beginPath()
        ctx.moveTo(ssp.x, py)
        ctx.lineTo(ray.x + ray.w, py)
        ctx.moveTo(px, ray.y)
        ctx.lineTo(px, ray.y + ray.h)
        ctx.stroke()
        ctx.restore()
        dot(ctx, sx(ssp, soundSpeedAt(prep, hover.z)), py, 3.5, C.amber)
        const right = px > ray.x + ray.w * 0.7
        label(
          ctx,
          `${fmt(hover.r, 1)} km · ${fmt(hover.z, 0)} m · ${fmt(soundSpeedAt(prep, hover.z), 1)} m/s`,
          px + (right ? -10 : 10),
          Math.max(ray.y + 10, py - 12),
          C.ink,
          right ? 'right' : 'left',
        )
      }
    },
    [rays, reveal, hover, env, prep, zs, cRange, zView],
  )

  usePointer(ref, {
    onDown: (x, y) => {
      const f = frames.current?.ray
      if (!f) return false
      return Math.abs(x - f.x) < 26 && Math.abs(y - sy(f, zs)) < 26
    },
    onMove: (x, y, dragging) => {
      const f = frames.current?.ray
      if (!f) return
      if (dragging) {
        setZs(Math.round(Math.min(prep.zMax - 5, Math.max(2, iy(f, y)))))
        return
      }
      setHover(inFrame(f, x, y) ? { r: ix(f, x), z: iy(f, y) } : null)
    },
  })

  const pick = (id: string): void => {
    const e = getEnvironment(id)
    setEnvId(id)
    setZs(e.sourceDepth)
    setFan(id === 'surface-duct' ? 6 : id.startsWith('shallow') ? 14 : 12)
    setZoom(id === 'surface-duct' ? 600 : 0)
  }

  return (
    <PlaygroundFrame
      title="Ray Lab"
      hint="Sound bends toward slower water. Pick an ocean, drag the source up and down, and watch where the energy goes and where it never arrives."
      tag="RAY TRACE"
      side={
        <>
          <Select label="Environment" value={envId} options={ENV_OPTIONS} onChange={pick} />
          <p className="pg-note" style={{ margin: 0 }}>
            {env.blurb}
          </p>
          <Slider label="Source depth" value={Math.min(zs, Math.round(prep.zMax - 5))} min={2} max={Math.round(prep.zMax - 5)} step={1} unit="m" onChange={setZs} />
          <Slider label="Fan half-angle" value={fan} min={1} max={40} step={0.5} unit="°" digits={1} onChange={setFan} />
          <Slider label="Rays" value={count} min={5} max={81} step={2} onChange={setCount} />
          <Slider label="Depth shown" value={Math.round(zView)} min={Math.min(200, Math.round(prep.zMax))} max={Math.round(prep.zMax)} step={10} unit="m" onChange={setZoom} />
          {envId === 'surface-duct' && <Slider label="Mixed layer depth" value={layer} min={20} max={250} step={5} unit="m" onChange={setLayer} />}
          <Readouts>
            <Readout label="Surface speed" value={fmt(env.ssp[0].c, 0)} unit="m/s" />
            <Readout label="Slowest at" value={fmt(axis.z, 0)} unit="m" />
            <Readout label="Bottom" value={env.bottom.name} />
            <Readout label="Bottom hits" value={`${tally.bottom ?? 0}`} unit={`of ${rays.length}`} tone={tally.bottom ? undefined : 'good'} />
          </Readouts>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 440, cursor: 'crosshair' }} role="img" aria-label={`Ray trace for ${env.name}`} />
      <Legend
        items={[
          { label: `Direct (${tally.direct ?? 0})`, color: RAY_COLORS.direct },
          { label: `Refracted, no boundary (${tally.refracted ?? 0})`, color: RAY_COLORS.refracted },
          { label: `Surface reflected (${tally.surface ?? 0})`, color: RAY_COLORS.surface },
          { label: `Bottom bounce (${tally.bottom ?? 0})`, color: RAY_COLORS.bottom },
          { label: 'Sound speed profile', color: C.amber },
        ]}
      />
    </PlaygroundFrame>
  )
}
