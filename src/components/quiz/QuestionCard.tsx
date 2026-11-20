import type { ReactElement } from 'react'
import type { Response } from '../../curriculum/questions/engine'
import type { Question } from '../../curriculum/questions/types'
import { fmt } from '../../lib/format'
import { Markdown } from '../Markdown'

interface Props {
  index: number
  question: Question
  response: Response
  onChange: (value: Response) => void
  /** Once graded the card locks and shows the worked answer. */
  graded: boolean
  correct?: boolean
}

function answerText(q: Question): string {
  if (q.kind === 'choice') return q.options[q.correct]
  const digits = Math.abs(q.answer) >= 100 ? 0 : Math.abs(q.answer) >= 10 ? 1 : 2
  return `${fmt(q.answer, digits)} ${q.unit}`
}

export function QuestionCard({ index, question, response, onChange, graded, correct }: Props): ReactElement {
  const name = `q-${index}-${question.id}`
  return (
    <article className="q card" data-testid="question" data-qid={question.id}>
      <div className="q-head">
        <span className="q-num">Q{index + 1}</span>
        <span className="chip">{question.kind === 'numeric' ? 'Calculate' : 'Choose'}</span>
        {graded && <span className={`q-verdict ${correct ? 'ok' : 'no'}`}>{correct ? '✓ Correct' : '✕ Not yet'}</span>}
      </div>
      <Markdown source={question.prompt} className="q-prompt prose" />
      {question.kind === 'choice' ? (
        <div className="q-options" role="radiogroup">
          {question.options.map((opt, i) => {
            const selected = Number(response) === i && response !== null && response !== undefined && response !== ''
            const cls = graded ? (i === question.correct ? ' right' : selected ? ' wrong' : '') : selected ? ' selected' : ''
            return (
              <label key={i} className={`q-option${cls}`}>
                <input type="radio" name={name} checked={selected} disabled={graded} onChange={() => onChange(i)} />
                <Markdown source={opt} className="prose" />
              </label>
            )
          })}
        </div>
      ) : (
        <div className="q-numeric">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Answer in ${question.unit}`}
            placeholder="your answer"
            value={typeof response === 'string' ? response : ''}
            disabled={graded}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="unit">{question.unit}</span>
        </div>
      )}
      {graded && (
        <div className="q-explain">
          <b className="lead">Worked answer · {answerText(question)}</b>
          <Markdown source={question.explanation} className="prose" />
        </div>
      )}
    </article>
  )
}
