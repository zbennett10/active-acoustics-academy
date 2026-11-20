import { useId, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { cssGradient, type Colormap } from '../../lib/colormaps'
import { fmt } from '../../lib/format'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  digits?: number
  onChange: (v: number) => void
  format?: (v: number) => string
}

export function Slider({ label, value, min, max, step = 1, unit, digits = 0, onChange, format }: SliderProps): ReactElement {
  const id = useId()
  const fill = `${((value - min) / (max - min)) * 100}%`
  return (
    <div className="ctl">
      <div className="ctl-top">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {format ? format(value) : fmt(value, digits)}
          {unit ? ` ${unit}` : ''}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': fill } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

interface SegmentedProps<T extends string> {
  label?: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (v: T) => void
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>): ReactElement {
  return (
    <div className="ctl">
      {label && <span className="ctl-label">{label}</span>}
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface SelectProps<T extends string> {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (v: T) => void
}

export function Select<T extends string>({ label, value, options, onChange }: SelectProps<T>): ReactElement {
  const id = useId()
  return (
    <div className="ctl">
      <label className="ctl-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}

export function Toggle({ label, checked, onChange }: ToggleProps): ReactElement {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

interface ReadoutProps {
  label: string
  value: string
  unit?: string
  tone?: 'good' | 'bad' | 'accent'
  swatch?: string
}

export function Readout({ label, value, unit, tone, swatch }: ReadoutProps): ReactElement {
  return (
    <div className={`readout${tone ? ` tone-${tone}` : ''}`}>
      <span>
        {swatch && <i className="sw" style={{ background: swatch }} />}
        {label}
      </span>
      <b>
        {value}
        {unit && <small>{unit}</small>}
      </b>
    </div>
  )
}

export function Readouts({ children }: { children: ReactNode }): ReactElement {
  return <div className="readouts">{children}</div>
}

export function Colorbar({ map, lo, hi, unit, invert }: { map: Colormap; lo: number; hi: number; unit: string; invert?: boolean }): ReactElement {
  return (
    <div className="colorbar">
      <span>
        {fmt(lo, 0)} {unit}
      </span>
      <span className="bar" style={{ background: cssGradient(map, invert) }} />
      <span>
        {fmt(hi, 0)} {unit}
      </span>
    </div>
  )
}

export function Legend({ items }: { items: ReadonlyArray<{ label: string; color: string; dash?: boolean }> }): ReactElement {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}>
          <i className={it.dash ? 'dash' : ''} style={{ background: it.color, color: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
