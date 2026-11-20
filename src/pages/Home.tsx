import { useState, type ReactElement } from 'react'
import { Link } from 'react-router'
import { HeroScene } from '../components/HeroScene'
import { KnowledgeTree } from '../components/KnowledgeTree'
import { ArrowRight } from '../components/icons'
import { TOTAL_BRANCHES, TOTAL_LEAVES, UNITS, UNIT_ORDER } from '../curriculum'
import { BANKS } from '../curriculum/questions'
import { isUnlocked, passedCount, useProgress } from '../state/progress'

const PROBLEMS = Object.values(BANKS).reduce((n, b) => n + b.length, 0)

const HOW = [
  { n: '01', title: 'Read the leaves', body: 'Each unit splits into branches and each branch into short leaves. One idea per leaf, with the math only where it earns its place.' },
  { n: '02', title: 'Work the playground', body: 'Every unit has an interactive lab built on a small physics engine. Change one thing and watch what the ocean, the target or the processor does.' },
  { n: '03', title: 'Pass the gate', body: 'Ten practical problems with fresh numbers each attempt. Score 80 percent and the next unit opens. Retake as often as you like.' },
  { n: '04', title: 'Follow it to the pixels', body: 'Blue callouts trace each quantity through the prediction pipeline: its shape, its units and the mistakes that corrupt it on the way to a display.' },
]

export function Home(): ReactElement {
  const units = useProgress((s) => s.units)
  const reset = useProgress((s) => s.reset)
  const [armed, setArmed] = useState(false)
  const passed = passedCount(units, UNIT_ORDER)
  const current = UNITS.find((u) => isUnlocked(units, UNIT_ORDER, u.id) && !units[u.id]?.passed) ?? UNITS[UNITS.length - 1]
  const started = Object.keys(units).length > 0

  return (
    <div className="page">
      <section className="hero">
        <HeroScene />
        <div className="hero-copy">
          <div className="eyebrow">Sensor performance prediction for active sonar</div>
          <h1>
            Active <em>Acoustics</em> Academy
          </h1>
          <p>
            A visual curriculum that takes you from a single ping to a full multistatic prediction, and from the physics engine’s output to what an operator sees. Twenty
            units. Each one stays locked until you pass the one before it.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to={`/unit/${current.id}`}>
              {started ? `Continue unit ${current.number}` : 'Start unit 1'} <ArrowRight />
            </Link>
            <a className="btn" href="#tree">
              See the whole tree
            </a>
          </div>
        </div>
      </section>

      <div className="stat-row">
        <div className="stat card">
          <b>
            {passed}/{UNITS.length}
          </b>
          <span>Units passed</span>
        </div>
        <div className="stat card">
          <b>{TOTAL_BRANCHES}</b>
          <span>Branches</span>
        </div>
        <div className="stat card">
          <b>{TOTAL_LEAVES}</b>
          <span>Leaves</span>
        </div>
        <div className="stat card">
          <b>{UNITS.length}</b>
          <span>Playgrounds</span>
        </div>
        <div className="stat card">
          <b>{PROBLEMS}</b>
          <span>Problem generators</span>
        </div>
      </div>

      <div className="section-head">
        <div>
          <div className="eyebrow">How it works</div>
          <h2>Trunk, limbs, leaves</h2>
        </div>
      </div>
      <div className="how-grid">
        {HOW.map((h) => (
          <div key={h.n} className="how card">
            <span className="n">{h.n}</span>
            <h3>{h.title}</h3>
            <p>{h.body}</p>
          </div>
        ))}
      </div>

      <div className="section-head" id="tree">
        <div>
          <div className="eyebrow">The curriculum</div>
          <h2>The knowledge tree</h2>
          <p>
            The trunk is the foundation everything else hangs from. Each limb is a unit, each twig a branch of that unit, each leaf a lesson. Leaves light up as you read them.
            Select a unit or a leaf to open it.
          </p>
        </div>
      </div>
      <div className="card" style={{ padding: '0.6rem 0.8rem' }}>
        <KnowledgeTree />
      </div>

      <p className="disclaimer">
        This is a personal learning project, and it is for personal learning only. Everything here comes from open literature such as textbooks, published papers and public
        standards. The numbers in the playgrounds come from small teaching models, not validated engines or databases, so use them for intuition only. Nothing on this site is system specific.
      </p>

      <div className="test-actions">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            if (armed) {
              reset()
              setArmed(false)
            } else {
              setArmed(true)
            }
          }}
        >
          {armed ? 'Select again to erase all progress' : 'Reset progress'}
        </button>
        {armed && (
          <button type="button" className="btn btn-small" onClick={() => setArmed(false)}>
            Keep my progress
          </button>
        )}
      </div>
    </div>
  )
}
