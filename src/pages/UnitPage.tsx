import type { ReactElement } from 'react'
import { Link, useParams } from 'react-router'
import { PlaygroundEmbed } from '../components/Markdown'
import { ArrowRight, CheckIcon, LeafIcon, LockIcon } from '../components/icons'
import { PracticeRunner, TestRunner } from '../components/quiz/TestRunner'
import { UNITS, UNIT_ORDER, flattenLeaves, getUnit } from '../curriculum'
import { TIER_LABELS } from '../curriculum/meta'
import type { Unit } from '../curriculum/types'
import { EMPTY_PROGRESS, isUnlocked, useProgress } from '../state/progress'

const TABS = [
  { id: 'learn', label: 'Learn' },
  { id: 'playground', label: 'Playground' },
  { id: 'practice', label: 'Practice' },
  { id: 'test', label: 'Test' },
] as const

export function LockedPanel({ unit }: { unit: Unit }): ReactElement {
  const prev = UNITS[UNITS.findIndex((u) => u.id === unit.id) - 1]
  return (
    <div className="page page-narrow">
      <div className="locked-panel card" data-testid="locked">
        <LockIcon />
        <div className="eyebrow">Unit {unit.number} is locked</div>
        <h2>{unit.title}</h2>
        <p>
          Pass the test for unit {prev.number}, {prev.title}, to open this one. The order matters: each unit uses what the one before it taught.
        </p>
        <Link className="btn btn-primary" to={`/unit/${prev.id}`}>
          Go to unit {prev.number} <ArrowRight />
        </Link>
      </div>
    </div>
  )
}

function LearnTab({ unit }: { unit: Unit }): ReactElement {
  const done = useProgress((s) => s.units[unit.id]?.leaves) ?? EMPTY_PROGRESS.leaves
  const all = flattenLeaves(unit)
  const nextLeaf = all.find((l) => !done.includes(l.leaf.id)) ?? all[0]
  return (
    <div>
      {nextLeaf && (
        <div className="test-actions" style={{ margin: '0 0 1.6rem' }}>
          <Link className="btn btn-primary" to={`/unit/${unit.id}/leaf/${nextLeaf.leaf.id}`}>
            {done.length === 0 ? 'Start reading' : done.length >= all.length ? 'Read again' : 'Continue reading'} <ArrowRight />
          </Link>
          <span className="muted mono">
            {done.length} / {all.length} leaves read
          </span>
        </div>
      )}
      {unit.branches.map((b, i) => (
        <section key={b.id} className="branch">
          <h3>
            {b.title}
            <small>
              branch {i + 1} · {b.leaves.length} leaves
            </small>
          </h3>
          <div className="leaf-grid">
            {b.leaves.map((leaf) => {
              const isDone = done.includes(leaf.id)
              return (
                <Link key={leaf.id} to={`/unit/${unit.id}/leaf/${leaf.id}`} className={`leaf-card${isDone ? ' done' : ''}`}>
                  {isDone ? <CheckIcon className="leaf-icon" /> : <LeafIcon className="leaf-icon" />}
                  <span>
                    {leaf.title}
                    <small>{Math.max(1, Math.round(leaf.body.split(/\s+/).length / 200))} min read</small>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export function UnitPage(): ReactElement {
  const { unitId, tab } = useParams()
  const unit = getUnit(unitId)
  const units = useProgress((s) => s.units)
  if (!unit) {
    return (
      <div className="page page-narrow">
        <h1>Unit not found</h1>
        <Link to="/">Back to the tree</Link>
      </div>
    )
  }
  if (!isUnlocked(units, UNIT_ORDER, unit.id)) return <LockedPanel unit={unit} />

  const active = TABS.find((t) => t.id === tab)?.id ?? 'learn'
  const progress = units[unit.id] ?? EMPTY_PROGRESS

  return (
    <div className="page">
      <header className="unit-head card" data-num={String(unit.number).padStart(2, '0')}>
        <div className="eyebrow">
          Unit {unit.number} · {TIER_LABELS[unit.tier]}
        </div>
        <h1>{unit.title}</h1>
        <p className="tagline">{unit.tagline}</p>
        <div className="unit-meta">
          {unit.kind === 'math' && <span className="chip chip-math">Math unit</span>}
          <span className="chip">{unit.branches.length} branches</span>
          <span className="chip">{flattenLeaves(unit).length} leaves</span>
          {progress.passed ? (
            <span className="chip chip-done">Passed · best {Math.round(progress.best * 100)}%</span>
          ) : progress.attempts > 0 ? (
            <span className="chip">Best {Math.round(progress.best * 100)}% · need 80%</span>
          ) : null}
        </div>
        <ul className="objectives">
          {unit.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </header>

      <nav className="tabs" aria-label="Unit sections">
        {TABS.map((t) => (
          <Link key={t.id} to={t.id === 'learn' ? `/unit/${unit.id}` : `/unit/${unit.id}/${t.id}`} className={`tab${active === t.id ? ' active' : ''}`}>
            {t.id === 'playground' ? unit.playgroundTitle : t.label}
          </Link>
        ))}
      </nav>

      {active === 'learn' && <LearnTab unit={unit} />}
      {active === 'playground' && <PlaygroundEmbed id={unit.playground} />}
      {active === 'practice' && <PracticeRunner unit={unit} />}
      {active === 'test' && <TestRunner key={unit.id} unit={unit} />}
    </div>
  )
}
