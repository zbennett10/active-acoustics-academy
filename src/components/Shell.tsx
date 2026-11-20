import { useEffect, useState, type ReactElement } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { TOTAL_LEAVES, UNITS, UNIT_ORDER } from '../curriculum'
import { TIER_LABELS } from '../curriculum/meta'
import type { UnitTier } from '../curriculum/types'
import { isUnlocked, passedCount, useProgress } from '../state/progress'
import { BrandMark, CheckIcon, LockIcon } from './icons'

const TIERS: UnitTier[] = ['trunk', 'limbs', 'crown']

export function Shell(): ReactElement {
  const units = useProgress((s) => s.units)
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const passed = passedCount(units, UNIT_ORDER)
  const leavesDone = Object.values(units).reduce((n, u) => n + u.leaves.length, 0)

  useEffect(() => {
    setOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="shell">
      <nav className={`rail${open ? ' open' : ''}`} aria-label="Curriculum">
        <Link to="/" className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">Active Acoustics</div>
            <div className="brand-sub">Academy</div>
          </div>
        </Link>
        <div className="rail-progress">
          <div className="rail-progress-top">
            <span>Units passed</span>
            <strong>
              {passed} / {UNITS.length}
            </strong>
          </div>
          <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={UNITS.length} aria-valuenow={passed}>
            <span style={{ width: `${(passed / UNITS.length) * 100}%` }} />
          </div>
          <div className="rail-progress-top" style={{ marginTop: '0.55rem' }}>
            <span>Leaves read</span>
            <span className="mono">
              {leavesDone} / {TOTAL_LEAVES}
            </span>
          </div>
        </div>
        <div className="rail-scroll">
          {TIERS.map((tier) => (
            <div key={tier}>
              <div className="rail-group">{TIER_LABELS[tier]}</div>
              {UNITS.filter((u) => u.tier === tier).map((u) => {
                const unlocked = isUnlocked(units, UNIT_ORDER, u.id)
                const done = units[u.id]?.passed === true
                return (
                  <NavLink
                    key={u.id}
                    to={`/unit/${u.id}`}
                    className={({ isActive }) =>
                      `rail-unit${isActive || location.pathname.startsWith(`/unit/${u.id}/`) ? ' active' : ''}${unlocked ? '' : ' locked'}${done ? ' passed' : ''}`
                    }
                  >
                    <span className="rail-num">{String(u.number).padStart(2, '0')}</span>
                    <span>{u.title}</span>
                    {done ? <CheckIcon className="rail-state" style={{ color: 'var(--accent)' }} /> : unlocked ? <span /> : <LockIcon className="rail-state" />}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </div>
        <div className="rail-foot">
          <NavLink to="/glossary">Glossary</NavLink>
          <NavLink to="/sources">Sources</NavLink>
        </div>
      </nav>
      <div>
        <div className="topbar">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            Menu
          </button>
          <span className="brand-name">Active Acoustics Academy</span>
        </div>
        <main className="main" onClick={() => open && setOpen(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
