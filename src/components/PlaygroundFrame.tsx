import type { ReactElement, ReactNode } from 'react'

interface FrameProps {
  title: string
  hint: string
  tag?: string
  side?: ReactNode
  /** Put the controls under the stage instead of beside it. */
  wide?: boolean
  children: ReactNode
}

export function PlaygroundFrame({ title, hint, tag, side, wide, children }: FrameProps): ReactElement {
  return (
    <section className="pg" aria-label={title}>
      <header className="pg-head">
        <div>
          <div className="pg-title">{title}</div>
          <p className="pg-hint">{hint}</p>
        </div>
        <span className="pg-tag">{tag ?? 'PLAYGROUND'}</span>
      </header>
      <div className={`pg-body${wide || !side ? ' wide' : ''}`}>
        <div className="pg-stage">{children}</div>
        {side && <aside className="pg-side">{side}</aside>}
      </div>
    </section>
  )
}

export interface PlaygroundProps {
  preset?: string
}
