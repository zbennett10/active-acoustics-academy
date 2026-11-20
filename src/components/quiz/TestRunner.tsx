import { useMemo, useState, type ReactElement } from 'react'
import { Link, useSearchParams } from 'react-router'
import { UNITS } from '../../curriculum'
import { BANKS } from '../../curriculum/questions'
import { PASS_MARK, TEST_LENGTH, buildTest, grade, isCorrect, type Grade, type Response } from '../../curriculum/questions/engine'
import type { Unit } from '../../curriculum/types'
import { randomSeed } from '../../lib/rng'
import { useProgress } from '../../state/progress'
import { ArrowRight } from '../icons'
import { QuestionCard } from './QuestionCard'

function ScoreRing({ score, passed }: { score: number; passed: boolean }): ReactElement {
  const r = 46
  const c = 2 * Math.PI * r
  return (
    <svg className="score-ring" width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`Score ${Math.round(score * 100)} percent`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#162a3c" strokeWidth="9" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={passed ? '#45e0c8' : '#ec835a'}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${c * score} ${c}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="60">{Math.round(score * 100)}%</text>
    </svg>
  )
}

/** The gate. Ten questions are graded together, and 80 percent opens the next unit. */
export function TestRunner({ unit }: { unit: Unit }): ReactElement {
  const [params] = useSearchParams()
  const [seed, setSeed] = useState<number>(() => Number(params.get('seed')) || randomSeed())
  const questions = useMemo(() => buildTest(BANKS[unit.id] ?? [], seed), [unit.id, seed])
  const [responses, setResponses] = useState<Response[]>([])
  const [result, setResult] = useState<Grade | null>(null)
  const recordAttempt = useProgress((s) => s.recordAttempt)
  const next = UNITS[UNITS.findIndex((u) => u.id === unit.id) + 1]

  const answered = questions.filter((_, i) => responses[i] !== undefined && responses[i] !== null && responses[i] !== '').length

  const submit = (): void => {
    const g = grade(questions, responses)
    setResult(g)
    recordAttempt(unit.id, g.score, g.passed)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const retry = (): void => {
    setSeed(randomSeed())
    setResponses([])
    setResult(null)
    window.scrollTo({ top: 0 })
  }

  if (questions.length === 0) return <p className="muted">This unit has no test yet.</p>

  return (
    <div data-testid="test-runner" data-seed={seed}>
      {result ? (
        <div className={`result card${result.passed ? ' pass' : ''}`} data-testid="result" data-passed={result.passed}>
          <ScoreRing score={result.score} passed={result.passed} />
          <div>
            <div className="eyebrow">{result.passed ? 'Unit passed' : 'Not yet'}</div>
            <h2>
              {result.correct} of {result.total} correct
            </h2>
            <p>
              {result.passed
                ? next
                  ? `Unit ${next.number}, ${next.title}, is now open.`
                  : 'That was the last gate. You have worked the whole tree.'
                : `You need ${Math.ceil(PASS_MARK * result.total)} of ${result.total}. Read the worked answers below, then take a fresh set with new numbers.`}
            </p>
            <div className="hero-actions" style={{ marginTop: 0 }}>
              {result.passed && next && (
                <Link className="btn btn-primary" to={`/unit/${next.id}`}>
                  Open unit {next.number} <ArrowRight />
                </Link>
              )}
              <button type="button" className={`btn${result.passed ? '' : ' btn-primary'}`} onClick={retry}>
                {result.passed ? 'Take another set' : 'Try a new set'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="test-intro card">
          <div className="eyebrow">Unit {unit.number} test</div>
          <h2>Pass to open the next unit</h2>
          <p>
            {Math.min(TEST_LENGTH, questions.length)} questions drawn from a larger bank, with fresh numbers each attempt. Score {Math.round(PASS_MARK * 100)} percent or
            better. Numeric answers are accepted within a small tolerance, so one decimal place is enough. Use the playground and a calculator freely.
          </p>
        </div>
      )}

      {questions.map((q, i) => (
        <QuestionCard
          key={`${seed}-${q.id}`}
          index={i}
          question={q}
          response={responses[i]}
          graded={result !== null}
          correct={result?.marks[i]}
          onChange={(v) => setResponses((prev) => Object.assign([...prev], { [i]: v }))}
        />
      ))}

      {!result && (
        <div className="test-actions">
          <button type="button" className="btn btn-primary" onClick={submit} disabled={answered === 0} data-testid="submit-test">
            Submit for grading
          </button>
          <span className="muted mono">
            {answered} / {questions.length} answered
          </span>
        </div>
      )}
    </div>
  )
}

/** Untimed practice, one question at a time with the answer shown on check. */
export function PracticeRunner({ unit }: { unit: Unit }): ReactElement {
  const bank = BANKS[unit.id] ?? []
  const [seed, setSeed] = useState<number>(() => randomSeed())
  const question = useMemo(() => buildTest(bank, seed, 1)[0], [bank, seed])
  const [response, setResponse] = useState<Response>(undefined)
  const [checked, setChecked] = useState(false)
  const [tally, setTally] = useState({ right: 0, seen: 0 })

  if (!question) return <p className="muted">No practice questions yet.</p>

  const check = (): void => {
    setChecked(true)
    setTally((t) => ({ right: t.right + (isCorrect(question, response) ? 1 : 0), seen: t.seen + 1 }))
  }
  const nextQuestion = (): void => {
    setSeed(randomSeed())
    setResponse(undefined)
    setChecked(false)
  }

  return (
    <div>
      <div className="test-intro card">
        <div className="eyebrow">Practice</div>
        <h2>Work problems with no stakes</h2>
        <p>Same bank as the test, one at a time, with the worked answer after each. Nothing here counts toward the gate.</p>
      </div>
      <QuestionCard
        key={seed}
        index={tally.seen - (checked ? 1 : 0)}
        question={question}
        response={response}
        graded={checked}
        correct={checked ? isCorrect(question, response) : undefined}
        onChange={setResponse}
      />
      <div className="test-actions">
        {checked ? (
          <button type="button" className="btn btn-primary" onClick={nextQuestion}>
            Next problem <ArrowRight />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={check} disabled={response === undefined || response === ''}>
            Check answer
          </button>
        )}
        <span className="muted mono">
          {tally.right} right of {tally.seen}
        </span>
      </div>
    </div>
  )
}
