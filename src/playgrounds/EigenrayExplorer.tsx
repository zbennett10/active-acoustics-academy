import { useDeferredValue, useMemo, useRef, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Legend, Readout, Readouts, Segmented, Select, Slider } from '../components/ui/controls'
import { clipFrame, dot, drawAxes, drawSeabed, hexA, ix, iy, label, makeFrame, sx, sy, type Frame } from '../components/viz/canvasKit'
import { C, RAY_COLORS } from '../components/viz/theme'
import { useCanvas, usePointer } from '../components/viz/useCanvas'
import { DEG } from '../lib/db'
import { beamResponseDb, findEigenrays, type Eigenray, type PathType } from '../lib/eigenrays'
import { fmt } from '../lib/format'
import { traceRay } from '../lib/rays'
import { ENVIRONMENTS, getEnvironment, prepareEnv } from '../lib/ssp'

const ENV_OPTIONS = ENVIRONMENTS.map((e) => ({ value: e.id, label: e.name }))

const TYPE_COLOR: Record<PathType, string> = {
  Direct: RAY_COLORS.direct,
  Refracted: RAY_COLORS.refracted,
  'Surface reflected': RAY_COLORS.surface,
  'Surface duct': RAY_COLORS.surface,
  'Bottom bounce': RAY_COLORS.bottom,
}

type Convention = 'up' | 'down'

interface Row extends Eigenray {
  /** Angle the receiver must look toward, positive down. */
  lookDown: number
  beamDb: number
}

export default function EigenrayExplorer({ preset }: PlaygroundProps): ReactElement {
  const initial = ENVIRONMENTS.some((e) => e.id === preset) ? (preset as string) : 'isovelocity'
  const [envId, setEnvId] = useState(initial)
  const env = getEnvironment(envId)
  const prep = useMemo(() => prepareEnv(env), [env])
  const [zs, setZs] = useState(env.sourceDepth)
  const [tgt, setTgt] = useState({ rKm: env.rMaxKm * 0.45, z: Math.min(300, prep.zMax * 0.5) })
  const [steerDown, setSteerDown] = useState(0)
  const [width, setWidth] = useState(16)
  const [conv, setConv] = useState<Convention>('up')
  const [hot, setHot] = useState<number | null>(null)
  const frame = useRef<Frame | null>(null)
  const drag = useRef<'src' | 'tgt' | null>(null)
  const q = useDeferredValue({ zs, tgt })

  const rows: Row[] = useMemo(() => {
    const found = findEigenrays(prep, Math.min(q.zs, prep.zMax - 5), q.tgt.rKm * 1000, q.tgt.z, { freqKhz: 3.5, fanDeg: prep.zMax < 500 ? 75 : 60, nRays: 1600 })
    return found
      .filter((e) => e.tlDb < 140)
      .sort((a, b) => a.tlDb - b.tlDb)
      .slice(0, 10)
      .sort((a, b) => a.timeS - b.timeS)
      .map((e) => ({ ...e, lookDown: -e.arrivalDeg, beamDb: 0 }))
  }, [prep, q])
  const withBeam = rows.map((r) => ({ ...r, beamDb: beamResponseDb(r.lookDown, steerDown, width) }))
  const paths = useMemo(() => rows.map((r) => traceRay(prep, Math.min(q.zs, prep.zMax - 5), r.launchDeg, q.tgt.rKm * 1000)), [rows, prep, q])

  const sum = (vals: number[]): number => {
    const total = vals.reduce((a, v) => a + Math.pow(10, -v / 10), 0)
    return total > 0 ? -10 * Math.log10(total) : Infinity
  }
  const tlAll = sum(withBeam.map((r) => r.tlDb))
  const tlBeam = sum(withBeam.map((r) => r.tlDb - r.beamDb))
  const t0 = rows.length ? rows[0].timeS : 0
  const spread = rows.length ? rows[rows.length - 1].timeS - t0 : 0
  const strongest = withBeam.reduce<Row | null>((b, r) => (!b || r.tlDb < b.tlDb ? r : b), null)
  const show = (down: number): number => (conv === 'down' ? down : -down)

  const ref = useCanvas(
    (ctx, w, h) => {
      const sceneH = Math.round(h * 0.6)
      const f = makeFrame(w, sceneH, [0, env.rMaxKm], [0, prep.zMax], { l: 52, r: 14, t: 12, b: 34 })
      frame.current = f
      ctx.fillStyle = C.bg
      ctx.fillRect(0, 0, w, h)
      const water = ctx.createLinearGradient(0, f.y, 0, f.y + f.h)
      water.addColorStop(0, '#0a2436')
      water.addColorStop(1, '#040c14')
      ctx.fillStyle = water
      ctx.fillRect(f.x, f.y, f.w, f.h)

      ctx.save()
      clipFrame(ctx, f)
      ctx.globalCompositeOperation = 'lighter'
      paths.forEach((p, i) => {
        const dim = hot !== null && hot !== i
        ctx.beginPath()
        for (let k = 0; k < p.n; k++) {
          const px = sx(f, p.r[k] / 1000)
          const py = sy(f, p.z[k])
          if (k === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.strokeStyle = TYPE_COLOR[rows[i].pathType]
        ctx.globalAlpha = dim ? 0.18 : 0.95
        ctx.lineWidth = hot === i ? 2.6 : 1.5
        ctx.stroke()
      })
      ctx.restore()
      drawSeabed(
        ctx,
        f,
        env.bathy.map((b) => ({ r: b.rKm, z: b.z })),
      )
      drawAxes(ctx, f, { xLabel: 'Range (km)', yLabel: 'Depth (m)', grid: true, yTicks: 5 })
      dot(ctx, f.x + 1, sy(f, zs), 5.5, C.ink)
      label(ctx, 'source', f.x + 12, sy(f, zs) - 12, C.ink2)
      dot(ctx, sx(f, tgt.rKm), sy(f, tgt.z), 6.5, C.amber)
      label(ctx, 'field point · drag', sx(f, tgt.rKm) - 10, sy(f, tgt.z) - 14, C.amber, 'right')

      // Arrival structure, one stem per path.
      const gap = 22
      const stemW = Math.round((w - 52 - 14 - gap) * 0.56)
      const pf: Frame = { x: 52, y: sceneH + 8, w: stemW, h: h - sceneH - 8 - 38, x0: -0.02 * Math.max(spread, 0.05), x1: Math.max(spread, 0.05) * 1.08, y0: -60, y1: -130 }
      const lvlTop = strongest ? Math.ceil((-strongest.tlDb + 6) / 10) * 10 : -60
      pf.y0 = lvlTop
      pf.y1 = lvlTop - 60
      ctx.fillStyle = C.panel
      ctx.fillRect(pf.x, pf.y, pf.w, pf.h)
      drawAxes(ctx, pf, { xLabel: 'Arrival time after first (s)', yLabel: 'Level re source', yTicks: 4, xTicks: 5 })
      ctx.save()
      clipFrame(ctx, pf)
      withBeam.forEach((r, i) => {
        const px = sx(pf, r.timeS - t0)
        const yTop = sy(pf, -r.tlDb)
        const yBeam = sy(pf, -(r.tlDb - r.beamDb))
        ctx.strokeStyle = hexA(TYPE_COLOR[r.pathType], hot !== null && hot !== i ? 0.25 : 0.4)
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(px, pf.y + pf.h)
        ctx.lineTo(px, yTop)
        ctx.stroke()
        ctx.strokeStyle = TYPE_COLOR[r.pathType]
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.moveTo(px, pf.y + pf.h)
        ctx.lineTo(px, yBeam)
        ctx.stroke()
      })
      ctx.restore()
      label(ctx, 'faint: path level · solid: after the beam', pf.x + 8, pf.y + 10, C.ink3)

      // D/E dial with the arrivals and the receive beam.
      const cx = pf.x + pf.w + gap + (w - 14 - (pf.x + pf.w + gap)) * 0.36
      const cy = pf.y + pf.h / 2
      const R = Math.min(pf.h / 2 - 4, (w - 14 - (pf.x + pf.w + gap)) * 0.56)
      ctx.strokeStyle = C.axis
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy - R)
      ctx.lineTo(cx, cy + R)
      ctx.stroke()
      const a0 = (steerDown - width / 2) * DEG
      const a1 = (steerDown + width / 2) * DEG
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, R, a0, a1)
      ctx.closePath()
      ctx.fillStyle = hexA(C.accent, 0.16)
      ctx.fill()
      ctx.strokeStyle = hexA(C.accent, 0.7)
      ctx.stroke()
      for (let a = -90; a <= 90; a += 30) {
        const x1 = cx + Math.cos(a * DEG) * R
        const y1 = cy + Math.sin(a * DEG) * R
        ctx.strokeStyle = C.axis
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a * DEG) * (R - 5), cy + Math.sin(a * DEG) * (R - 5))
        ctx.lineTo(x1, y1)
        ctx.stroke()
        label(ctx, `${fmt(show(a), 0)}°`, cx + Math.cos(a * DEG) * (R + 14), cy + Math.sin(a * DEG) * (R + 10), C.ink3, 'center', 10)
      }
      withBeam.forEach((r, i) => {
        const a = r.lookDown * DEG
        const len = R * Math.max(0.25, 1 - (r.tlDb - (strongest?.tlDb ?? r.tlDb)) / 40)
        ctx.strokeStyle = TYPE_COLOR[r.pathType]
        ctx.globalAlpha = hot !== null && hot !== i ? 0.25 : 1
        ctx.lineWidth = hot === i ? 3 : 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len)
        ctx.stroke()
        ctx.globalAlpha = 1
      })
      dot(ctx, cx, cy, 3.5, C.ink)
      label(ctx, 'UP', cx - 8, cy - R + 6, C.ink3, 'right', 10)
      label(ctx, 'DOWN', cx - 8, cy + R - 6, C.ink3, 'right', 10)
      label(ctx, 'arrival D/E at receiver', cx + R * 0.3, pf.y + pf.h + 26, C.ink3, 'center')
    },
    [paths, rows, withBeam.map((r) => r.beamDb).join(','), env, prep, zs, tgt, hot, steerDown, width, conv],
  )

  usePointer(ref, {
    onDown: (x, y) => {
      const f = frame.current
      if (!f) return false
      if (Math.hypot(x - sx(f, tgt.rKm), y - sy(f, tgt.z)) < 22) drag.current = 'tgt'
      else if (Math.abs(x - f.x) < 24 && Math.abs(y - sy(f, zs)) < 24) drag.current = 'src'
      else drag.current = null
      return drag.current !== null
    },
    onMove: (x, y, dragging) => {
      const f = frame.current
      if (!f || !dragging) return
      const z = Math.round(Math.min(prep.zMax - 5, Math.max(3, iy(f, y))))
      if (drag.current === 'src') setZs(z)
      else setTgt({ rKm: Math.min(env.rMaxKm * 0.98, Math.max(env.rMaxKm * 0.03, ix(f, x))), z })
    },
  })

  const pick = (id: string): void => {
    const e = getEnvironment(id)
    const zMax = prepareEnv(e).zMax
    setEnvId(id)
    setZs(e.sourceDepth)
    setTgt({ rKm: e.rMaxKm * 0.45, z: Math.round(Math.min(300, zMax * 0.5)) })
    setHot(null)
  }

  return (
    <PlaygroundFrame
      title="Eigenray Explorer"
      hint="A field point is reached by a few distinct paths. Each leaves the source at its own angle, arrives at its own angle and time, and loses its own amount. Drag the field point, then steer the receive beam and watch paths drop out."
      tag="EIGENRAYS"
      side={
        <>
          <Select label="Environment" value={envId} options={ENV_OPTIONS} onChange={pick} />
          <Segmented
            label="Angle sign convention"
            value={conv}
            options={[
              { value: 'up', label: 'Up is positive' },
              { value: 'down', label: 'Down is positive' },
            ]}
            onChange={setConv}
          />
          <Slider label={`Receive beam D/E (${conv === 'up' ? 'up' : 'down'} positive)`} value={show(steerDown)} min={-60} max={60} step={1} unit="°" onChange={(v) => setSteerDown(conv === 'down' ? v : -v)} />
          <Slider label="Receive beam width" value={width} min={4} max={90} step={1} unit="°" onChange={setWidth} />
          <Readouts>
            <Readout label="Paths found" value={`${rows.length}`} />
            <Readout label="Time spread" value={fmt(spread * 1000, 0)} unit="ms" />
            <Readout label="Loss, all paths" value={fmt(tlAll, 1)} unit="dB" />
            <Readout label="Loss in the beam" value={fmt(tlBeam, 1)} unit="dB" tone={tlBeam - tlAll > 3 ? 'bad' : 'good'} />
          </Readouts>
        </>
      }
    >
      <canvas ref={ref} className="pg-canvas" style={{ height: 560 }} role="img" aria-label="Eigenrays from source to field point with their arrival times and angles" />
      <Legend
        items={[
          { label: 'Direct', color: RAY_COLORS.direct },
          { label: 'Refracted', color: RAY_COLORS.refracted },
          { label: 'Surface reflected or ducted', color: RAY_COLORS.surface },
          { label: 'Bottom bounce', color: RAY_COLORS.bottom },
          { label: 'Receive beam', color: C.accent },
        ]}
      />
      <div style={{ overflowX: 'auto', marginTop: '0.8rem' }}>
        <table className="pg-table">
          <thead>
            <tr>
              <th>Path</th>
              <th>Launch D/E</th>
              <th>Arrival D/E</th>
              <th>Time</th>
              <th>Loss</th>
              <th>Beam</th>
              <th>Loss in beam</th>
            </tr>
          </thead>
          <tbody>
            {withBeam.map((r, i) => (
              <tr key={i} className={hot === i ? 'hot' : ''} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
                <td>
                  <i className="sw" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 6, background: TYPE_COLOR[r.pathType] }} />
                  {r.label}
                </td>
                <td>{fmt(show(r.launchDeg), 1)}°</td>
                <td>{fmt(show(r.lookDown), 1)}°</td>
                <td>{fmt(r.timeS, 3)} s</td>
                <td>{fmt(r.tlDb, 1)} dB</td>
                <td>{fmt(r.beamDb, 1)} dB</td>
                <td>{fmt(r.tlDb - r.beamDb, 1)} dB</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7}>No path reaches this point. It sits in a shadow zone for this fan.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PlaygroundFrame>
  )
}
