import type { ReactElement } from 'react'
import { SOURCES } from '../curriculum/sources'

export function Sources(): ReactElement {
  return (
    <div className="page page-narrow">
      <div className="section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="eyebrow">Reference</div>
          <h2>Sources and further reading</h2>
          <p>The open literature this curriculum draws on, from the standard texts to recent papers. All of it is public.</p>
        </div>
      </div>
      {SOURCES.map((group) => (
        <section key={group.title} className="ref-group">
          <h3>{group.title}</h3>
          {group.items.map((item) => (
            <div key={item.cite} className="ref">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.cite}
                </a>
              ) : (
                <span>{item.cite}</span>
              )}
              <p>{item.note}</p>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
