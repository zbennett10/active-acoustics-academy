import { useRef, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'
import { UNITS, UNIT_ORDER } from '../curriculum'
import { TIER_LABELS } from '../curriculum/meta'
import { isUnlocked, useProgress } from '../state/progress'

const W = 1120
const TRUNK_X = W / 2
const TOP = 96
const STEP = 132
const LIMB = 150
const TWIG = 46
const LEAF_GAP = 23
const LEAF = 'M0,0 C5,-8 15,-8 20,0 C15,8 5,8 0,0 Z'

interface Tip {
  x: number
  y: number
  text: string
}

/** The curriculum as a tree, with the trunk down the middle, a limb per unit, a twig per branch and a leaf per lesson. */
export function KnowledgeTree(): ReactElement {
  const units = useProgress((s) => s.units)
  const navigate = useNavigate()
  const wrap = useRef<HTMLDivElement | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)

  const tierStarts = UNITS.reduce<number[]>((acc, u, i) => (i === 0 || UNITS[i - 1].tier !== u.tier ? [...acc, i] : acc), [])
  const yOf = (i: number): number => TOP + i * STEP + tierStarts.filter((s) => s <= i).length * 44
  const height = yOf(UNITS.length - 1) + 120
  const lastPassed = UNITS.reduce((last, u, i) => (units[u.id]?.passed ? i : last), -1)
  const litTo = lastPassed < 0 ? yOf(0) : yOf(Math.min(UNITS.length - 1, lastPassed + 1))

  const showTip = (e: React.MouseEvent, text: string): void => {
    const box = wrap.current?.getBoundingClientRect()
    if (!box) return
    setTip({ x: e.clientX - box.left + (wrap.current?.scrollLeft ?? 0), y: e.clientY - box.top, text })
  }

  return (
    <div className="tree-wrap" ref={wrap}>
      <svg className="tree-svg" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Curriculum tree showing every unit, branch and leaf with your progress">
        <defs>
          <linearGradient id="trunkGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
            <stop offset="0" stopColor="#45e0c8" />
            <stop offset={Math.max(0.001, litTo / height)} stopColor="#45e0c8" />
            <stop offset={Math.min(1, litTo / height + 0.03)} stopColor="#22405a" />
            <stop offset="1" stopColor="#152838" />
          </linearGradient>
        </defs>

        <path className="tree-trunk" d={`M${TRUNK_X},30 L${TRUNK_X},${yOf(3) + 60}`} strokeWidth={13} />
        <path className="tree-trunk" d={`M${TRUNK_X},${yOf(3) + 60} L${TRUNK_X},${yOf(15) + 60}`} strokeWidth={8} />
        <path className="tree-trunk" d={`M${TRUNK_X},${yOf(15) + 60} L${TRUNK_X},${height - 36}`} strokeWidth={5} />

        {tierStarts.map((start) => (
          <g key={start}>
            <rect x={TRUNK_X - 190} y={yOf(start) - 82} width={380} height={24} rx={12} fill="#050b12" stroke="#1c3246" />
            <text className="tree-tier" x={TRUNK_X} y={yOf(start) - 65} textAnchor="middle">
              {TIER_LABELS[UNITS[start].tier].toUpperCase()}
            </text>
          </g>
        ))}

        {UNITS.map((u, i) => {
          const y = yOf(i)
          const side = i % 2 === 0 ? 1 : -1
          const unlocked = isUnlocked(units, UNIT_ORDER, u.id)
          const passed = units[u.id]?.passed === true
          const done = units[u.id]?.leaves ?? []
          const state = passed ? 'passed' : unlocked ? 'open' : 'locked'
          const limbEnd = TRUNK_X + side * LIMB
          const nb = u.branches.length
          const anchor = side === 1 ? 'start' : 'end'
          return (
            <g key={u.id} className={`tree-unit ${state}`}>
              <path className="tree-limb" d={`M${TRUNK_X},${y} C${TRUNK_X + side * 60},${y} ${limbEnd - side * 50},${y + 20} ${limbEnd},${y + 20}`} />
              {u.branches.map((b, j) => {
                const by = y + 20 + (j - (nb - 1) / 2) * 27
                const tx = limbEnd + side * TWIG
                return (
                  <g key={b.id}>
                    <path className="tree-twig" d={`M${limbEnd},${y + 20} C${limbEnd + side * 22},${y + 20} ${tx - side * 22},${by} ${tx},${by}`} />
                    {b.leaves.map((leaf, k) => {
                      const lx = tx + side * (4 + k * LEAF_GAP)
                      return (
                        <path
                          key={leaf.id}
                          className={`tree-leaf${done.includes(leaf.id) ? ' done' : ''}`}
                          d={LEAF}
                          transform={`translate(${lx} ${by}) scale(${side} 1)`}
                          onMouseMove={(e) => showTip(e, unlocked ? leaf.title : `${leaf.title} (locked)`)}
                          onMouseLeave={() => setTip(null)}
                          onClick={() => unlocked && navigate(`/unit/${u.id}/leaf/${leaf.id}`)}
                        />
                      )
                    })}
                    <text className="tree-branch-label" x={tx + side * (12 + b.leaves.length * LEAF_GAP)} y={by + 4} textAnchor={anchor}>
                      {b.title}
                    </text>
                  </g>
                )
              })}
              <g
                className="tree-hit"
                role="link"
                tabIndex={0}
                aria-label={`Unit ${u.number}: ${u.title}${unlocked ? '' : ', locked'}`}
                onClick={() => navigate(`/unit/${u.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/unit/${u.id}`)}
              >
                <text className="tree-title" x={TRUNK_X - side * 30} y={y - 4} textAnchor={side === 1 ? 'end' : 'start'}>
                  {u.title}
                </text>
                <text className="tree-sub" x={TRUNK_X - side * 30} y={y + 15} textAnchor={side === 1 ? 'end' : 'start'}>
                  {u.kind === 'math' ? 'Math unit · ' : ''}
                  {passed ? 'Passed' : unlocked ? `${done.length} of ${u.branches.reduce((n, b) => n + b.leaves.length, 0)} leaves read` : 'Locked'}
                </text>
                <circle className="tree-node" cx={TRUNK_X} cy={y} r={17} />
                <text className="tree-num" x={TRUNK_X} y={y}>
                  {u.number}
                </text>
              </g>
            </g>
          )
        })}
      </svg>
      {tip && (
        <div className="tree-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  )
}
