export function fmt(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? '−∞' : '—'
  const s = value.toFixed(digits)
  return s.startsWith('-') ? `−${s.slice(1)}` : s
}

export function fmtSigned(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return fmt(value, digits)
  return value >= 0 ? `+${value.toFixed(digits)}` : fmt(value, digits)
}

export function fmtPct(p: number): string {
  return `${Math.round(p * 100)}%`
}

export function niceTicks(lo: number, hi: number, target = 6): number[] {
  const span = hi - lo
  if (!(span > 0)) return [lo]
  const raw = span / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const first = Math.ceil(lo / step - 1e-9) * step
  const out: number[] = []
  for (let v = first; v <= hi + step * 1e-9; v += step) out.push(Number(v.toFixed(10)))
  return out
}

export function tickLabel(v: number): string {
  const a = Math.abs(v)
  const s = a >= 100 || Number.isInteger(v) ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, '')
  return s.startsWith('-') ? `−${s.slice(1)}` : s
}
