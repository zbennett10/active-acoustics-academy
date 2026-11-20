import { useMemo, useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Colorbar, Readout, Readouts, Segmented, Select, Slider, Toggle } from '../components/ui/controls'
import { drawAxes, drawContour, drawField, label, makeFrame } from '../components/viz/canvasKit'
import { Plot } from '../components/viz/Plot'
import { C } from '../components/viz/theme'
import { useCanvas } from '../components/viz/useCanvas'
import { COLORMAPS, type ColormapId } from '../lib/colormaps'
import { podFromSe } from '../lib/detection'
import { fmt } from '../lib/format'
import { getEnvironment } from '../lib/ssp'
import { getField } from './shared'

type Quantity = 'tl' | 'se' | 'pod'

const MAP_OPTIONS = (Object.keys(COLORMAPS) as ColormapId[]).map((id) => ({ value: id, label: COLORMAPS[id].name }))
const ENV_OPTIONS = [
  { value: 'surface-duct', label: 'Surface duct' },
  { value: 'deep-cz', label: 'Deep, convergence zone' },
  { value: 'shallow-summer', label: 'Shallow, summer' },
  { value: 'upslope', label: 'Shelf break' },
]
const DEFAULTS: Record<Quantity, { lo: number; hi: number; min: number; max: number; step: number; unit: string; level: number; invert: boolean }> = {
  tl: { lo: 60, hi: 115, min: 40, max: 150, step: 1, unit: 'dB', level: 86, invert: true },
  se: { lo: -30, hi: 30, min: -60, max: 60, step: 1, unit: 'dB', level: 0, invert: false },
  pod: { lo: 0, hi: 1, min: 0, max: 1, step: 0.05, unit: '', level: 0.5, invert: false },
}

/** Perceived lightness along a colormap, 0 to 100. */
function lightness(id: ColormapId): number[] {
  const lut = COLORMAPS[id].lut
  return Array.from({ length: 64 }, (_v, i) => {
    const k = Math.round((i / 63) * 255) * 3
    const lin = [lut[k], lut[k + 1], lut[k + 2]].map((c) => {
      const s = c / 255
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y
  })
}

export default function DisplayWorkshop(_: PlaygroundProps): ReactElement {
  const [envId, setEnvId] = useState('surface-duct')
  const [quantity, setQuantity] = useState<Quantity>('se')
  const [mapA, setMapA] = useState<ColormapId>('jet')
  const [mapB, setMapB] = useState<ColormapId>('viridis')
  const [lo, setLo] = useState(DEFAULTS.se.lo)
  const [hi, setHi] = useState(DEFAULTS.se.hi)
  const [smoothing, setSmoothing] = useState(true)
  const [contour, setContour] = useState(false)

  const env = getEnvironment(envId)
  const field = useMemo(() => getField(envId, env.sourceDepth, 3.5), [envId, env])
  const cfg = DEFAULTS[quantity]
  const values = useMemo(() => {
    if (quantity === 'tl') return field.tl
    return Float32Array.from(field.tl, (t) => {
      if (Number.isNaN(t)) return NaN
      const se = 220 - 2 * t + 12 - 58 - 10
      return quantity === 'se' ? se : podFromSe(se, 8)
    })
  }, [field, quantity])
  const zShow = Math.min(field.zMax, envId === 'surface-duct' ? 800 : field.zMax)
  const stats = useMemo(() => {
    let n = 0
    let above = 0
    values.forEach((v) => {
      if (Number.isNaN(v)) return
      n++
      if (quantity === 'tl' ? v <= cfg.level : v >= cfg.level) above++
    })
    return n ? above / n : 0
  }, [values, quantity, cfg.level])

  const draw = (id: ColormapId, tag: string) => (ctx: CanvasRenderingContext2D, w: number, h: number): void => {
    const f = makeFrame(w, h, [0, env.rMaxKm], [0, zShow])
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.beginPath()
    ctx.rect(f.x, f.y, f.w, f.h)
    ctx.clip()
    const tall = { ...f, h: (f.h * field.zMax) / zShow }
    drawField(ctx, tall, values, field.nr, field.nz, lo, hi, COLORMAPS[id].lut, cfg.invert, smoothing)
    if (contour) drawContour(ctx, tall, values, field.nr, field.nz, cfg.level, 'rgba(255,255,255,0.9)', 1.5)
    ctx.restore()
    drawAxes(ctx, f, { xLabel: 'Range (km)', yLabel: 'Depth (m)', grid: false, yTicks: 4 })
    label(ctx, `${tag} · ${COLORMAPS[id].name.toUpperCase()}`, f.x + 8, f.y + 12, C.ink)
  }
  const deps = [values, lo, hi, smoothing, contour, zShow, envId]
  const refA = useCanvas(draw(mapA, 'A'), [...deps, mapA])
  const refB = useCanvas(draw(mapB, 'B'), [...deps, mapB])

  const pos = Array.from({ length: 64 }, (_v, i) => i / 63)
  const pick = (qn: Quantity): void => {
    setQuantity(qn)
    setLo(DEFAULTS[qn].lo)
    setHi(DEFAULTS[qn].hi)
  }

  return (
    <PlaygroundFrame
      title="Display Workshop"
      hint="The same numbers, drawn twice. Change only the display: the color map, the range it spans, the smoothing, the contour. Notice which features appear, vanish or get invented. The lightness plot shows why."
      tag="SAME DATA · TWO DISPLAYS"
      side={
        <>
          <Select label="Environment" value={envId} options={ENV_OPTIONS} onChange={setEnvId} />
          <Segmented
            label="Quantity"
            value={quantity}
            options={[
              { value: 'tl', label: 'Loss' },
              { value: 'se', label: 'Signal excess' },
              { value: 'pod', label: 'Probability' },
            ]}
            onChange={pick}
          />
          <Select label="Display A color map" value={mapA} options={MAP_OPTIONS} onChange={setMapA} />
          <p className="pg-note" style={{ margin: 0 }}>{COLORMAPS[mapA].note}</p>
          <Select label="Display B color map" value={mapB} options={MAP_OPTIONS} onChange={setMapB} />
          <p className="pg-note" style={{ margin: 0 }}>{COLORMAPS[mapB].note}</p>
          <Slider label="Color range, low end" value={lo} min={cfg.min} max={cfg.max} step={cfg.step} digits={quantity === 'pod' ? 2 : 0} unit={cfg.unit} onChange={(v) => setLo(Math.min(v, hi - cfg.step * 4))} />
          <Slider label="Color range, high end" value={hi} min={cfg.min} max={cfg.max} step={cfg.step} digits={quantity === 'pod' ? 2 : 0} unit={cfg.unit} onChange={(v) => setHi(Math.max(v, lo + cfg.step * 4))} />
          <Toggle label="Smooth between cells" checked={smoothing} onChange={setSmoothing} />
          <Toggle label={`Contour at ${quantity === 'pod' ? '50%' : `${cfg.level} dB`}`} checked={contour} onChange={setContour} />
          <Readouts>
            <Readout label={quantity === 'tl' ? `Cells with loss ≤ ${cfg.level}` : 'Cells at or above the line'} value={fmt(stats * 100, 0)} unit="%" tone="accent" />
            <Readout label="Grid" value={`${field.nr} × ${field.nz}`} />
          </Readouts>
        </>
      }
    >
      <div className="stage-pair">
        <div>
          <canvas ref={refA} className="pg-canvas" style={{ height: 300 }} role="img" aria-label={`Field drawn with the ${COLORMAPS[mapA].name} color map`} />
          <Colorbar map={COLORMAPS[mapA]} lo={cfg.invert ? hi : lo} hi={cfg.invert ? lo : hi} unit={cfg.unit} invert={false} />
        </div>
        <div>
          <canvas ref={refB} className="pg-canvas" style={{ height: 300 }} role="img" aria-label={`Field drawn with the ${COLORMAPS[mapB].name} color map`} />
          <Colorbar map={COLORMAPS[mapB]} lo={cfg.invert ? hi : lo} hi={cfg.invert ? lo : hi} unit={cfg.unit} invert={false} />
        </div>
      </div>
      <div style={{ marginTop: '0.9rem' }}>
        <Plot
          ariaLabel="Perceived lightness along each color map"
          series={[
            { id: 'a', label: `A · ${COLORMAPS[mapA].name}`, color: C.orange, x: pos, y: lightness(mapA), width: 2.4 },
            { id: 'b', label: `B · ${COLORMAPS[mapB].name}`, color: C.accent, x: pos, y: lightness(mapB), width: 2.4 },
          ]}
          xDomain={[0, 1]}
          yDomain={[0, 100]}
          xLabel="Position along the color map"
          yLabel="Perceived lightness"
          digits={2}
          height={200}
        />
      </div>
      <p className="pg-note">
        <b>Read the lightness plot.</b> The eye ranks lightness far more reliably than hue. A map whose lightness climbs steadily shows a steady change as steady. A map
        whose lightness rises and falls draws bright bands where the data has none, and those bands look like boundaries. Then try narrowing the color range: values past
        either end all look the same, so a too-tight range hides how bad the bad areas are.
      </p>
    </PlaygroundFrame>
  )
}
