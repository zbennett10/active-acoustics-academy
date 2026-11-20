import type { ReactElement, SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function LockIcon(p: P): ReactElement {
  return (
    <svg {...base} {...p} aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function CheckIcon(p: P): ReactElement {
  return (
    <svg {...base} {...p} aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function LeafIcon(p: P): ReactElement {
  return (
    <svg {...base} {...p} aria-hidden="true">
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z" />
      <path d="M5 19c3-5 6-8 10-10" />
    </svg>
  )
}

export function ArrowRight(p: P): ReactElement {
  return (
    <svg {...base} {...p} aria-hidden="true" width="16" height="16">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function ArrowLeft(p: P): ReactElement {
  return (
    <svg {...base} {...p} aria-hidden="true" width="16" height="16">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  )
}

export function DotIcon(p: P): ReactElement {
  return (
    <svg {...base} {...p} aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  )
}

export function BrandMark(): ReactElement {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="9" fill="#071019" stroke="#1c3246" />
      <circle className="ring" cx="20" cy="20" r="15" fill="none" stroke="#45e0c8" strokeWidth="1.4" />
      <circle className="ring" cx="20" cy="20" r="15" fill="none" stroke="#45e0c8" strokeWidth="1.4" />
      <circle cx="20" cy="20" r="3.2" fill="#45e0c8" />
    </svg>
  )
}
