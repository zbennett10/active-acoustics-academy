import { createRng } from '../../lib/rng'
import type { Question, QuestionGen } from './types'

export const PASS_MARK = 0.8
export const TEST_LENGTH = 10

/** Draws a test from a seeded pick of generators, each given fresh numbers. */
export function buildTest(generators: readonly QuestionGen[], seed: number, count = TEST_LENGTH): Question[] {
  const rng = createRng(seed)
  return rng
    .shuffle(generators)
    .slice(0, Math.min(count, generators.length))
    .map((gen) => gen(rng))
}

export function parseNumber(text: string): number {
  const cleaned = text.trim().replace(/[−–]/g, '-').replace(/,/g, '').replace(/\s+/g, '')
  if (cleaned === '') return NaN
  return Number(cleaned)
}

export type Response = string | number | null | undefined

export function isCorrect(q: Question, response: Response): boolean {
  if (response === null || response === undefined) return false
  if (q.kind === 'choice') return Number(response) === q.correct
  const value = typeof response === 'number' ? response : parseNumber(response)
  return Number.isFinite(value) && Math.abs(value - q.answer) <= q.tolerance + 1e-9
}

export interface Grade {
  marks: boolean[]
  correct: number
  total: number
  score: number
  passed: boolean
}

export function grade(questions: readonly Question[], responses: readonly Response[]): Grade {
  const marks = questions.map((q, i) => isCorrect(q, responses[i]))
  const correct = marks.filter(Boolean).length
  const total = questions.length
  const score = total === 0 ? 0 : correct / total
  return { marks, correct, total, score, passed: score >= PASS_MARK - 1e-9 }
}
