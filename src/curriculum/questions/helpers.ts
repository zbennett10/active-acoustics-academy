import type { Rng } from '../../lib/rng'
import type { ChoiceQuestion, NumericQuestion } from './types'

/** Numeric question. Default tolerance is the larger of 0.5 and 2 percent. */
export function num(id: string, prompt: string, answer: number, unit: string, explanation: string, tolerance?: number): NumericQuestion {
  return {
    kind: 'numeric',
    id,
    prompt,
    answer,
    unit,
    explanation,
    tolerance: tolerance ?? Math.max(0.5, Math.abs(answer) * 0.02),
  }
}

/** Multiple choice. Options are shuffled, the first argument is the right one. */
export function mc(rng: Rng, id: string, prompt: string, correct: string, wrong: readonly string[], explanation: string): ChoiceQuestion {
  const options = rng.shuffle([correct, ...wrong])
  return { kind: 'choice', id, prompt, options, correct: options.indexOf(correct), explanation }
}

export function r1(v: number): string {
  return (Math.round(v * 10) / 10).toString()
}

export function r2(v: number): string {
  return (Math.round(v * 100) / 100).toString()
}

export function r0(v: number): string {
  return Math.round(v).toString()
}
