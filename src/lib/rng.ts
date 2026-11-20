// Small seeded generator (mulberry32) so tests and question sets are reproducible.

export interface Rng {
  next(): number
  int(lo: number, hi: number): number
  step(lo: number, hi: number, step: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
  gauss(): number
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1))
  const step = (lo: number, hi: number, inc: number): number => {
    const n = Math.round((hi - lo) / inc)
    return Number((lo + int(0, n) * inc).toFixed(6))
  }
  const pick = <T,>(items: readonly T[]): T => items[int(0, items.length - 1)]
  const shuffle = <T,>(items: readonly T[]): T[] => {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i)
      const tmp = out[i]
      out[i] = out[j]
      out[j] = tmp
    }
    return out
  }
  const gauss = (): number => {
    const u = Math.max(next(), 1e-12)
    const v = next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  return { next, int, step, pick, shuffle, gauss }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}
