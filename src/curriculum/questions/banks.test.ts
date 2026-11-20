import { describe, expect, it } from 'vitest'
import { createRng } from '../../lib/rng'
import { UNIT_META } from '../meta'
import { PASS_MARK, TEST_LENGTH, buildTest, grade, isCorrect, parseNumber } from './engine'
import { BANKS } from './index'

const SEEDS = Array.from({ length: 40 }, (_v, i) => i * 7919 + 13)

describe('question banks', () => {
  it('has a bank of at least twelve generators for every unit', () => {
    for (const meta of UNIT_META) {
      expect(BANKS[meta.id], meta.id).toBeDefined()
      expect(BANKS[meta.id].length, meta.id).toBeGreaterThanOrEqual(12)
    }
  })

  it('produces well-formed questions for many seeds', () => {
    for (const [unit, bank] of Object.entries(BANKS)) {
      bank.forEach((gen, gi) => {
        const ids = new Set<string>()
        for (const seed of SEEDS) {
          const q = gen(createRng(seed))
          const where = `${unit}[${gi}] ${q.id} seed ${seed}`
          ids.add(q.id)
          expect(q.prompt.length, where).toBeGreaterThan(10)
          expect(q.explanation.length, where).toBeGreaterThan(15)
          expect(q.prompt, where).not.toMatch(/undefined|NaN|Infinity/)
          expect(q.explanation, where).not.toMatch(/undefined|NaN|Infinity/)
          if (q.kind === 'numeric') {
            expect(Number.isFinite(q.answer), where).toBe(true)
            expect(q.tolerance, where).toBeGreaterThan(0)
            expect(isCorrect(q, String(q.answer)), where).toBe(true)
            expect(isCorrect(q, q.answer + q.tolerance * 3 + 1), where).toBe(false)
          } else {
            expect(q.options.length, where).toBeGreaterThanOrEqual(3)
            expect(new Set(q.options).size, where).toBe(q.options.length)
            expect(q.correct, where).toBeGreaterThanOrEqual(0)
            expect(q.correct, where).toBeLessThan(q.options.length)
            expect(isCorrect(q, q.correct), where).toBe(true)
            expect(isCorrect(q, (q.correct + 1) % q.options.length), where).toBe(false)
          }
        }
        expect(ids.size, `${unit}[${gi}] should keep one id`).toBe(1)
      })
    }
  })

  it('gives every generator in a bank its own id', () => {
    for (const [unit, bank] of Object.entries(BANKS)) {
      const ids = bank.map((gen) => gen(createRng(1)).id)
      expect(new Set(ids).size, unit).toBe(ids.length)
    }
  })
})

describe('test engine', () => {
  it('builds the same test from the same seed and a different one from another', () => {
    const a = buildTest(BANKS.u05, 99)
    const b = buildTest(BANKS.u05, 99)
    const c = buildTest(BANKS.u05, 100)
    expect(a).toHaveLength(TEST_LENGTH)
    expect(a.map((q) => q.prompt)).toEqual(b.map((q) => q.prompt))
    expect(a.map((q) => q.prompt)).not.toEqual(c.map((q) => q.prompt))
    expect(new Set(a.map((q) => q.id)).size).toBe(TEST_LENGTH)
  })

  it('grades against the pass mark', () => {
    const qs = buildTest(BANKS.u02, 5)
    const right = qs.map((q) => (q.kind === 'numeric' ? String(q.answer) : q.correct))
    expect(grade(qs, right).passed).toBe(true)
    expect(grade(qs, right).score).toBe(1)
    const eight = right.map((v, i) => (i < 8 ? v : null))
    expect(grade(qs, eight).score).toBeCloseTo(PASS_MARK)
    expect(grade(qs, eight).passed).toBe(true)
    const seven = right.map((v, i) => (i < 7 ? v : null))
    expect(grade(qs, seven).passed).toBe(false)
    expect(grade(qs, []).correct).toBe(0)
  })

  it('reads numbers the way people type them', () => {
    expect(parseNumber('  −12.5 ')).toBe(-12.5)
    expect(parseNumber('1,250')).toBe(1250)
    expect(Number.isNaN(parseNumber(''))).toBe(true)
    expect(Number.isNaN(parseNumber('abc'))).toBe(true)
  })
})
