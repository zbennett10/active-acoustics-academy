import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { fmt, niceTicks, tickLabel } from '../../lib/format'

export interface PlotSeries {
  id: string
  label: string
  color: string
  x: readonly number[]
  y: readonly number[]
  dash?: boolean
  width?: number
  /** Fill between the line and this y value. */
  fillTo?: number
  fillOpacity?: number
  /** Leave this series out of the legend and the hover readout. */
  quiet?: boolean
  opacity?: number
}

export interface PlotMark {
  x?: number
  y?: number
  label: string
  color?: string
}

export interface PlotBand {
  x0: number
  x1: number
  color: string
  opacity?: number
}

export interface PlotPoint {
  x: number
  y: number
  color: string
  label?: string
}

interface PlotProps {
  series: PlotSeries[]
  /** Left and right data values. */
  xDomain: readonly [number, number]
  /** Bottom and top data values. Reverse them to flip the axis. */
  yDomain: readonly [number, number]
  xLabel: string
  yLabel: string
  ariaLabel: string
  height?: number
  marks?: PlotMark[]
  bands?: PlotBand[]
  points?: PlotPoint[]
  xUnit?: string
  yUnit?: string
  digits?: number
  legend?: boolean
  /** Explicit x tick positions and their labels, for log or categorical axes. */
  xTicks?: number[]
  xTickFormat?: (v: number) => string
  xHover?: (v: number) => string
}

const PAD = { l: 56, r: 16, t: 14, b: 42 }

function interp(xs: readonly number[], ys: readonly number[], x: number): number {
  if (xs.length === 0 || x < Math.min(xs[0], xs[xs.length - 1]) || x > Math.max(xs[0], xs[xs.length - 1])) return NaN
  for (let i = 1; i < xs.length; i++) {
    if ((xs[i - 1] <= x && x <= xs[i]) || (xs[i] <= x && x <= xs[i - 1])) {
      const span = xs[i] - xs[i - 1]
      const f = span === 0 ? 0 : (x - xs[i - 1]) / span
      return ys[i - 1] + f * (ys[i] - ys[i - 1])
    }
  }
  return NaN
}

export function Plot(props: PlotProps): ReactElement {
  const { series, xDomain, yDomain, xLabel, yLabel, ariaLabel, marks = [], bands = [], points = [] } = props
  const H = props.height ?? 300
  const digits = props.digits ?? 1
  const wrap = useRef<HTMLDivElement | null>(null)
  // The drawing is laid out at the element's real width, so type stays one size.
  const [W, setW] = useState(760)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = (): void => setW(Math.max(320, Math.round(el.clientWidth)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const [hover, setHover] = useState<{ x: number; px: number; py: number } | null>(null)

  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const mx = (v: number): number => PAD.l + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * iw
  const my = (v: number): number => PAD.t + ih - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * ih
  const yLo = Math.min(yDomain[0], yDomain[1])
  const yHi = Math.max(yDomain[0], yDomain[1])
  const clampY = (v: number): number => Math.min(yHi + (yHi - yLo), Math.max(yLo - (yHi - yLo), v))

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = ''
        let pen = false
        const segs: Array<Array<[number, number]>> = []
        s.x.forEach((xv, i) => {
          const yv = s.y[i]
          if (!Number.isFinite(yv) || !Number.isFinite(xv)) {
            pen = false
            return
          }
          const px = mx(xv)
          const py = my(clampY(yv))
          d += `${pen ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`
          if (!pen) segs.push([])
          segs[segs.length - 1].push([px, py])
          pen = true
        })
        const fill =
          s.fillTo === undefined
            ? ''
            : segs
                .filter((g) => g.length > 1)
                .map((g) => {
                  const base = my(clampY(s.fillTo as number)).toFixed(1)
                  return `M${g[0][0].toFixed(1)},${base}${g.map(([a, b]) => `L${a.toFixed(1)},${b.toFixed(1)}`).join('')}L${g[g.length - 1][0].toFixed(1)},${base}Z`
                })
                .join('')
        return { id: s.id, d, fill }
      }),
    [series, xDomain[0], xDomain[1], yDomain[0], yDomain[1], H, W],
  )

  const xt = props.xTicks ?? niceTicks(Math.min(xDomain[0], xDomain[1]), Math.max(xDomain[0], xDomain[1]), 8)
  const xLab = props.xTickFormat ?? tickLabel
  const yt = niceTicks(yLo, yHi, 5)

  const onMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const box = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - box.left) / box.width) * W
    if (vx < PAD.l || vx > W - PAD.r) {
      setHover(null)
      return
    }
    const x = xDomain[0] + ((vx - PAD.l) / iw) * (xDomain[1] - xDomain[0])
    setHover({ x, px: e.clientX - box.left, py: e.clientY - box.top })
  }

  const rows = hover
    ? series.filter((s) => !s.quiet).map((s) => ({ s, v: interp(s.x, s.y, hover.x) })).filter((r) => Number.isFinite(r.v))
    : []
  const clipId = `clip-${useMemo(() => Math.random().toString(36).slice(2, 8), [])}`
  const flip = hover && wrap.current ? hover.px > wrap.current.clientWidth * 0.62 : false

  return (
    <div>
      <div className="plot-wrap" ref={wrap}>
        <svg
          className="plot"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.l} y={PAD.t} width={iw} height={ih} />
            </clipPath>
          </defs>
          {xt.map((v) => (
            <line key={`x${v}`} className="grid" x1={mx(v)} x2={mx(v)} y1={PAD.t} y2={PAD.t + ih} />
          ))}
          {yt.map((v) => (
            <line key={`y${v}`} className="grid" x1={PAD.l} x2={PAD.l + iw} y1={my(v)} y2={my(v)} />
          ))}
          <g clipPath={`url(#${clipId})`}>
            {bands.map((b, i) => (
              <rect
                key={i}
                x={Math.min(mx(b.x0), mx(b.x1))}
                y={PAD.t}
                width={Math.abs(mx(b.x1) - mx(b.x0))}
                height={ih}
                fill={b.color}
                opacity={b.opacity ?? 0.12}
              />
            ))}
            {paths.map((p, i) =>
              p.fill ? <path key={`f${p.id}`} d={p.fill} fill={series[i].color} opacity={series[i].fillOpacity ?? 0.14} /> : null,
            )}
            {paths.map((p, i) => (
              <path
                key={p.id}
                d={p.d}
                fill="none"
                stroke={series[i].color}
                strokeWidth={series[i].width ?? 2}
                opacity={series[i].opacity}
                strokeDasharray={series[i].dash ? '6 5' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {marks.map((m, i) =>
              m.x !== undefined ? (
                <line key={i} x1={mx(m.x)} x2={mx(m.x)} y1={PAD.t} y2={PAD.t + ih} stroke={m.color ?? '#6c8598'} strokeDasharray="2 4" />
              ) : (
                <line key={i} x1={PAD.l} x2={PAD.l + iw} y1={my(m.y ?? 0)} y2={my(m.y ?? 0)} stroke={m.color ?? '#6c8598'} strokeDasharray="2 4" />
              ),
            )}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={mx(p.x)} cy={my(clampY(p.y))} r={7} fill="#040a11" />
                <circle cx={mx(p.x)} cy={my(clampY(p.y))} r={4.5} fill={p.color} />
              </g>
            ))}
            {hover && <line className="cross" x1={mx(hover.x)} x2={mx(hover.x)} y1={PAD.t} y2={PAD.t + ih} />}
            {rows.map((r) => (
              <circle key={r.s.id} cx={mx(hover!.x)} cy={my(clampY(r.v))} r={4} fill={r.s.color} stroke="#040a11" strokeWidth={2} />
            ))}
          </g>
          <rect className="axis" x={PAD.l} y={PAD.t} width={iw} height={ih} fill="none" />
          {marks.map((m, i) =>
            m.x !== undefined ? (
              <text key={i} className="anno" x={mx(m.x) + 5} y={PAD.t + 13 + (i % 3) * 13} fill={m.color}>
                {m.label}
              </text>
            ) : (
              <text key={i} className="anno" x={PAD.l + iw - 6} y={my(m.y ?? 0) - 5} textAnchor="end" fill={m.color}>
                {m.label}
              </text>
            ),
          )}
          {points.map((p, i) =>
            p.label ? (
              <text key={i} className="anno" x={mx(p.x) + 9} y={my(clampY(p.y)) - 8}>
                {p.label}
              </text>
            ) : null,
          )}
          {xt.map((v) => (
            <text key={`xt${v}`} className="tick" x={mx(v)} y={PAD.t + ih + 15} textAnchor="middle">
              {xLab(v)}
            </text>
          ))}
          {yt.map((v) => (
            <text key={`yt${v}`} className="tick" x={PAD.l - 7} y={my(v) + 4} textAnchor="end">
              {tickLabel(v)}
            </text>
          ))}
          <text className="label" x={PAD.l + iw / 2} y={H - 8} textAnchor="middle">
            {xLabel}
          </text>
          <text className="label" transform={`translate(15 ${PAD.t + ih / 2}) rotate(-90)`} textAnchor="middle">
            {yLabel}
          </text>
        </svg>
        {hover && rows.length > 0 && (
          <div className="tip" style={{ left: hover.px + (flip ? -14 : 14), top: Math.max(4, hover.py - 10), transform: flip ? 'translateX(-100%)' : undefined }}>
            <div className="muted">
              {props.xHover ? props.xHover(hover.x) : fmt(hover.x, digits)} {props.xUnit ?? ''}
            </div>
            {rows.map((r) => (
              <div key={r.s.id}>
                <i style={{ background: r.s.color }} />
                {r.s.label} <b>{fmt(r.v, digits)}</b> {props.yUnit ?? ''}
              </div>
            ))}
          </div>
        )}
      </div>
      {props.legend !== false && series.filter((s) => !s.quiet).length > 1 && (
        <div className="legend">
          {series.filter((s) => !s.quiet).map((s) => (
            <span key={s.id}>
              <i className={s.dash ? 'dash' : ''} style={{ background: s.color, color: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
