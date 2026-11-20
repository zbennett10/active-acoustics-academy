import { useMemo, useState, type ReactElement } from 'react'
import { GLOSSARY } from '../curriculum/glossary'

export function Glossary(): ReactElement {
  const [query, setQuery] = useState('')
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term))
    if (!q) return sorted
    return sorted.filter((g) => `${g.term} ${g.abbr ?? ''} ${g.def}`.toLowerCase().includes(q))
  }, [query])

  return (
    <div className="page">
      <div className="section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="eyebrow">Reference</div>
          <h2>Glossary</h2>
          <p>{GLOSSARY.length} terms used across the curriculum. Search by word or abbreviation.</p>
        </div>
      </div>
      <input className="search" type="search" placeholder="Search terms" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the glossary" />
      <dl className="gloss">
        {items.map((g) => (
          <div key={g.term} className="gloss-item card">
            <dt>
              {g.term}
              {g.abbr && <small>{g.abbr}</small>}
            </dt>
            <dd>{g.def}</dd>
          </div>
        ))}
      </dl>
      {items.length === 0 && <p className="muted">No terms match.</p>}
    </div>
  )
}
