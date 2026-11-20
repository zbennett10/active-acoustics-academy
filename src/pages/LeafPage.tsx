import { useEffect, useRef, type ReactElement } from 'react'
import { Link, useParams } from 'react-router'
import { Markdown } from '../components/Markdown'
import { ArrowLeft, ArrowRight } from '../components/icons'
import { UNIT_ORDER, flattenLeaves, getUnit } from '../curriculum'
import { EMPTY_PROGRESS, isUnlocked, useProgress } from '../state/progress'
import { LockedPanel } from './UnitPage'

export function LeafPage(): ReactElement {
  const { unitId, leafId } = useParams()
  const unit = getUnit(unitId)
  const units = useProgress((s) => s.units)
  const completeLeaf = useProgress((s) => s.completeLeaf)
  const sentinel = useRef<HTMLDivElement | null>(null)

  const leaves = unit ? flattenLeaves(unit) : []
  const ref = leaves.find((l) => l.leaf.id === leafId)
  const unlocked = unit ? isUnlocked(units, UNIT_ORDER, unit.id) : false

  // A leaf counts as read once its end has been on screen.
  useEffect(() => {
    const el = sentinel.current
    if (!el || !unit || !ref || !unlocked) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) completeLeaf(unit.id, ref.leaf.id)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [unit, ref, unlocked, completeLeaf])

  if (!unit || !ref) {
    return (
      <div className="page page-narrow">
        <h1>Leaf not found</h1>
        <Link to="/">Back to the tree</Link>
      </div>
    )
  }
  if (!unlocked) return <LockedPanel unit={unit} />

  const done = units[unit.id]?.leaves ?? EMPTY_PROGRESS.leaves
  const prev = leaves[ref.index - 1]
  const next = leaves[ref.index + 1]

  return (
    <div className="page">
      <div className="reader">
        <article className="reader-main">
          <div className="crumbs">
            <Link to={`/unit/${unit.id}`}>
              Unit {unit.number} · {unit.title}
            </Link>
            <span>/</span>
            <span>{ref.branch.title}</span>
            <span>/</span>
            <span className="mono">
              leaf {ref.index + 1} of {leaves.length}
            </span>
          </div>
          <h1>{ref.leaf.title}</h1>
          <Markdown source={ref.leaf.body} playgroundId={unit.playground} />
          <div ref={sentinel} />
          <div className="reader-nav">
            {prev ? (
              <Link className="btn" to={`/unit/${unit.id}/leaf/${prev.leaf.id}`}>
                <ArrowLeft /> {prev.leaf.title}
              </Link>
            ) : (
              <Link className="btn" to={`/unit/${unit.id}`}>
                <ArrowLeft /> Unit overview
              </Link>
            )}
            {next ? (
              <Link className="btn btn-primary" to={`/unit/${unit.id}/leaf/${next.leaf.id}`}>
                {next.leaf.title} <ArrowRight />
              </Link>
            ) : (
              <Link className="btn btn-primary" to={`/unit/${unit.id}/test`}>
                Take the unit test <ArrowRight />
              </Link>
            )}
          </div>
        </article>
        <aside className="outline" aria-label="Unit outline">
          {unit.branches.map((b) => (
            <div key={b.id}>
              <h4>{b.title}</h4>
              {b.leaves.map((l) => (
                <Link
                  key={l.id}
                  to={`/unit/${unit.id}/leaf/${l.id}`}
                  className={`${l.id === ref.leaf.id ? 'current' : ''}${done.includes(l.id) ? ' done' : ''}`}
                >
                  {l.title}
                </Link>
              ))}
            </div>
          ))}
          <h4>Then</h4>
          <Link to={`/unit/${unit.id}/playground`}>{unit.playgroundTitle}</Link>
          <Link to={`/unit/${unit.id}/practice`}>Practice problems</Link>
          <Link to={`/unit/${unit.id}/test`}>Unit test</Link>
        </aside>
      </div>
    </div>
  )
}
