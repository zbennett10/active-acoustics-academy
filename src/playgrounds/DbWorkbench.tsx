import { useState, type ReactElement } from 'react'
import { PlaygroundFrame, type PlaygroundProps } from '../components/PlaygroundFrame'
import { Readout, Readouts, Slider, Toggle } from '../components/ui/controls'
import { C } from '../components/viz/theme'
import { fromDb, powerSumDb } from '../lib/db'
import { fmt } from '../lib/format'

const CHANNELS = [
  { name: 'Echo', color: C.orange },
  { name: 'Reverb', color: C.magenta },
  { name: 'Noise', color: C.violet },
  { name: 'Interferer', color: C.blue },
]

function ratioText(r: number): string {
  if (r >= 1000) return `${fmt(r, 0)}`
  if (r >= 10) return fmt(r, 1)
  if (r >= 0.1) return fmt(r, 2)
  return r.toExponential(1).replace('-', '−')
}

/** Two squares whose areas stand in the power ratio. */
function AreaPair({ db }: { db: number }): ReactElement {
  const ratio = fromDb(db)
  const big = 150
  const refSide = ratio >= 1 ? big / Math.sqrt(ratio) : big
  const valSide = ratio >= 1 ? big : big * Math.sqrt(ratio)
  return (
    <svg viewBox="0 0 380 190" style={{ width: '100%', display: 'block' }} role="img" aria-label={`Two squares with areas in the ratio ${ratioText(ratio)} to 1`}>
      <rect x={20} y={170 - Math.max(refSide, 2)} width={Math.max(refSide, 2)} height={Math.max(refSide, 2)} fill="none" stroke={C.ink3} strokeWidth={1.5} strokeDasharray="4 4" rx={3} />
      <text x={20} y={186} fill={C.ink3} fontSize="11" fontFamily="IBM Plex Mono">
        reference
      </text>
      <rect x={210} y={170 - Math.max(valSide, 2)} width={Math.max(valSide, 2)} height={Math.max(valSide, 2)} fill={C.accent} opacity={0.85} rx={3} />
      <text x={210} y={186} fill={C.accent} fontSize="11" fontFamily="IBM Plex Mono">
        {db >= 0 ? '+' : '−'}
        {Math.abs(db)} dB · area ×{ratioText(ratio)}
      </text>
    </svg>
  )
}

export default function DbWorkbench(_: PlaygroundProps): ReactElement {
  const [db, setDb] = useState(10)
  const [levels, setLevels] = useState([72, 66, 62, 50])
  const [on, setOn] = useState([true, true, true, false])
  const [nsl, setNsl] = useState(62)
  const [bwLog, setBwLog] = useState(2)

  const active = levels.filter((_l, i) => on[i])
  const total = powerSumDb(active)
  const loudest = active.length ? Math.max(...active) : -Infinity
  const powers = levels.map((l, i) => (on[i] ? fromDb(l) : 0))
  const sum = powers.reduce((a, b) => a + b, 0)
  const bw = Math.round(Math.pow(10, bwLog))
  const band = nsl + 10 * Math.log10(bw)
  const lo = 40
  const hi = 90
  const barH = (l: number): number => Math.max(0, ((l - lo) / (hi - lo)) * 150)

  return (
    <PlaygroundFrame
      title="dB Workbench"
      hint="Three habits to build: a decibel is a ratio, levels add as powers and not as numbers, and a band holds more than one hertz of it."
      tag="LEVELS"
    >
      <div className="stage-pair">
        <div>
          <p className="pg-sub">1 · A decibel is a power ratio</p>
          <AreaPair db={db} />
          <Slider label="Level difference" value={db} min={-30} max={40} step={1} unit="dB" onChange={setDb} />
          <div style={{ marginTop: '0.7rem' }}>
            <Readouts>
              <Readout label="Power ratio" value={`×${ratioText(fromDb(db))}`} tone="accent" />
              <Readout label="Pressure ratio" value={`×${ratioText(Math.sqrt(fromDb(db)))}`} />
            </Readouts>
          </div>
          <p className="pg-note">
            <b>Anchors:</b> 3 dB doubles the power, 10 dB is ten times, 20 dB is a hundred times. Pressure goes as the square root, so 6 dB doubles pressure and 20 dB is ten
            times.
          </p>
        </div>

        <div>
          <p className="pg-sub">2 · Levels add as powers</p>
          <svg viewBox="0 0 380 190" style={{ width: '100%', display: 'block' }} role="img" aria-label="Bar chart of four levels and their power sum">
            {[50, 60, 70, 80, 90].map((v) => (
              <g key={v}>
                <line x1={34} x2={372} y1={170 - barH(v)} y2={170 - barH(v)} stroke="rgba(140,190,225,0.09)" />
                <text x={28} y={174 - barH(v)} textAnchor="end" fill={C.ink3} fontSize="10" fontFamily="IBM Plex Mono">
                  {v}
                </text>
              </g>
            ))}
            {CHANNELS.map((ch, i) => (
              <g key={ch.name} opacity={on[i] ? 1 : 0.2}>
                <rect x={46 + i * 62} y={170 - barH(levels[i])} width={40} height={barH(levels[i])} fill={ch.color} rx={4} />
                <text x={66 + i * 62} y={164 - barH(levels[i])} textAnchor="middle" fill={C.ink} fontSize="11" fontFamily="IBM Plex Mono">
                  {levels[i]}
                </text>
                <text x={66 + i * 62} y={185} textAnchor="middle" fill={C.ink3} fontSize="10">
                  {ch.name}
                </text>
              </g>
            ))}
            <rect x={306} y={170 - barH(total)} width={48} height={barH(total)} fill={C.ink} rx={4} />
            <text x={330} y={164 - barH(total)} textAnchor="middle" fill={C.ink} fontSize="12" fontFamily="IBM Plex Mono">
              {fmt(total, 1)}
            </text>
            <text x={330} y={185} textAnchor="middle" fill={C.ink2} fontSize="10">
              Sum
            </text>
          </svg>
          <p className="pg-sub" style={{ marginTop: '0.6rem' }}>
            Share of the total power
          </p>
          <div style={{ display: 'flex', gap: 2, height: 14, borderRadius: 7, overflow: 'hidden', background: C.panel }}>
            {CHANNELS.map((ch, i) =>
              powers[i] > 0 ? <div key={ch.name} title={`${ch.name} ${fmt((powers[i] / sum) * 100, 0)}%`} style={{ width: `${(powers[i] / sum) * 100}%`, background: ch.color }} /> : null,
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', marginTop: '0.7rem' }}>
            {CHANNELS.map((ch, i) => (
              <div key={ch.name}>
                <Slider label={ch.name} value={levels[i]} min={40} max={88} step={1} unit="dB" onChange={(v) => setLevels(levels.map((l, k) => (k === i ? v : l)))} />
                <Toggle label="Include" checked={on[i]} onChange={(v) => setOn(on.map((o, k) => (k === i ? v : o)))} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.7rem' }}>
            <Readouts>
              <Readout label="Power sum" value={fmt(total, 1)} unit="dB" tone="accent" />
              <Readout label="Above the loudest" value={fmt(total - loudest, 2)} unit="dB" />
            </Readouts>
          </div>
        </div>

        <div>
          <p className="pg-sub">3 · Spectrum level to band level</p>
          <svg viewBox="0 0 380 190" style={{ width: '100%', display: 'block' }} role="img" aria-label="A flat spectrum over a band">
            <line x1={30} x2={370} y1={160} y2={160} stroke={C.axis} />
            <rect x={190 - (bwLog / 3.4) * 150} y={160 - ((nsl - 30) / 60) * 130} width={(bwLog / 3.4) * 300} height={((nsl - 30) / 60) * 130} fill={C.violet} opacity={0.55} rx={3} />
            <line x1={30} x2={370} y1={160 - ((nsl - 30) / 60) * 130} y2={160 - ((nsl - 30) / 60) * 130} stroke={C.violet} strokeDasharray="5 5" />
            <text x={34} y={152 - ((nsl - 30) / 60) * 130} fill={C.violet} fontSize="11" fontFamily="IBM Plex Mono">
              {nsl} dB in each 1 Hz
            </text>
            <text x={190} y={178} textAnchor="middle" fill={C.ink2} fontSize="11" fontFamily="IBM Plex Mono">
              ← {bw} Hz wide →
            </text>
          </svg>
          <Slider label="Spectrum level" value={nsl} min={35} max={85} step={1} unit="dB re 1 µPa²/Hz" onChange={setNsl} />
          <Slider label="Bandwidth" value={bwLog} min={0} max={3.4} step={0.05} format={() => `${bw} Hz`} onChange={setBwLog} />
          <div style={{ marginTop: '0.7rem' }}>
            <Readouts>
              <Readout label="10 log B" value={fmt(10 * Math.log10(bw), 1)} unit="dB" />
              <Readout label="Band level" value={fmt(band, 1)} unit="dB re 1 µPa²" tone="accent" />
            </Readouts>
          </div>
          <p className="pg-note">
            <b>Check the reference.</b> A spectrum level is per hertz. A band level is not. They differ by 10 log of the bandwidth and cannot be compared until one is
            converted.
          </p>
        </div>
      </div>
    </PlaygroundFrame>
  )
}
