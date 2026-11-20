import type { Rng } from '../../lib/rng'

interface BaseQuestion {
  id: string
  /** Markdown, may include inline math. */
  prompt: string
  explanation: string
}

export interface NumericQuestion extends BaseQuestion {
  kind: 'numeric'
  answer: number
  tolerance: number
  unit: string
}

export interface ChoiceQuestion extends BaseQuestion {
  kind: 'choice'
  options: string[]
  correct: number
}

export type Question = NumericQuestion | ChoiceQuestion

export type QuestionGen = (rng: Rng) => Question
