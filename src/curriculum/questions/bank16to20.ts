import { thorpDbPerKm } from '../../lib/absorption'
import { DEG, KNOT_MS, powerSumDb } from '../../lib/db'
import { normCdf } from '../../lib/detection'
import { mc, num, r0, r1, r2 } from './helpers'
import type { QuestionGen } from './types'

const C = 1500

export const u16: QuestionGen[] = [
  (r) => {
    const n = r.int(1, 4)
    const m = r.int(3, 16)
    const mono = r.next() < 0.4
    return num('u16-pairs', `A field has **${n}** source${n > 1 ? 's' : ''} and **${m}** receivers.${mono ? ' Each source platform also receives its own echoes.' : ''} How many source and receiver pairs are there?`, n * m + (mono ? n : 0), 'pairs', `Every source pairs with every receiver: $${n} \\times ${m} = ${n * m}$${mono ? `, plus ${n} monostatic, giving ${n * m + n}` : ''}.`, 0.1)
  },
  (r) => {
    const ps = r.shuffle([0.2, 0.3, 0.4, 0.5, 0.6]).slice(0, r.int(2, 4))
    const ans = (1 - ps.reduce((a, p) => a * (1 - p), 1)) * 100
    return num('u16-combine', `At one point, the pairs of a field have detection probabilities of **${ps.map((p) => `${p * 100}%`).join(', ')}**. Treating them as independent, what is the probability that at least one detects?`, ans, '%', `$1 - ${ps.map((p) => `(1 - ${p})`).join('')} = ${r1(ans)}$ percent.`, 1)
  },
  (r) => {
    const n = r.int(2, 4)
    const m = r.pick([6, 8, 12, 16])
    return num('u16-runs', `A field has **${n}** sources and **${m}** receivers, all at different positions, working in one band. Using reciprocity, how many propagation engine runs does a full prediction need?`, n + m, 'runs', `One per node: $${n} + ${m} = ${n + m}$. Computing each pair separately would need $2 \\times ${n} \\times ${m} = ${2 * n * m}$.`, 0.1)
  },
  (r) => {
    const n = r.int(1, 3)
    const m = r.pick([5, 8, 10])
    const addSource = r.next() < 0.5
    return num('u16-add', `A field has **${n}** source${n > 1 ? 's' : ''} and **${m}** receivers. One more **${addSource ? 'source' : 'receiver'}** is added. How many new bistatic pairs does that create?`, addSource ? m : n, 'pairs', addSource ? `A new source pairs with every receiver: ${m}.` : `A new receiver pairs with every source: ${n}.`, 0.1)
  },
  (r) =>
    mc(r, 'u16-indep', 'Why is the independent-pairs formula for combined probability an overestimate?', 'Pairs that share a source or a receiver share its path errors and noise, and all share the same ocean', ['Because pairs never detect at the same time', 'Because target strength is the same for every pair', 'Because the formula ignores absorption'], 'Independence is more defensible across pairs than across pings, and it is still not exact. Shared nodes and a shared environment correlate the outcomes.'),
  (r) =>
    mc(r, 'u16-blind', 'Where should a field’s sources be placed with respect to blind zones?', 'So that the blind strip along each baseline lies inside another pair’s coverage', ['So that all blind zones overlap in one place', 'As far from every receiver as possible', 'On top of a receiver, to remove the baseline'], 'A hole remains only where every pair fails at once. Arrange the geometry so that one pair’s blind strip is another pair’s good coverage.'),
  (r) =>
    mc(r, 'u16-diversity', 'What does aspect diversity give a multistatic field?', 'For almost any target heading, some pair sees the target near beam or near the mirror angle', ['A higher source level', 'Immunity to reverberation', 'A shorter blind zone'], 'A single sonar is at the mercy of the target’s heading. A field views it from many directions, so the unfavorable aspect for one pair is favorable for another.'),
  (r) =>
    mc(r, 'u16-fusion', 'Contact-level fusion sends every contact to one central tracker. Compared with track-level fusion, what is the trade?', 'Better performance for far more communication', ['Worse performance for less communication', 'The same performance with no communication', 'Better performance and less communication'], 'A central tracker can associate weak contacts from different pairs that no single node would promote. It needs every contact from every node to do it.'),
  (r) => {
    const item = r.pick([
      { q: 'in time, by having sources ping in turn', a: 'A slower update from each source' },
      { q: 'in frequency, by giving each source its own band', a: 'Less bandwidth for each source' },
      { q: 'by waveform, using distinguishable sweeps in the same band', a: 'Some residual cross-talk between sources' },
    ])
    return mc(r, 'u16-schedule', `Sources in a field are separated ${item.q}. What does that cost?`, item.a, ['A slower update from each source', 'Less bandwidth for each source', 'Some residual cross-talk between sources', 'A larger blind zone'].filter((x) => x !== item.a).slice(0, 3), 'Every way of keeping sources from interfering divides something: time, band or isolation.')
  },
  (r) => {
    const n = r.int(2, 4)
    const m = r.pick([8, 12, 16])
    const fa = r.pick([2, 5, 10])
    return num('u16-fa', `A field of **${n}** sources and **${m}** receivers produces about **${fa}** false contacts per pair per ping cycle. How many false contacts reach the fusion center each cycle?`, n * m * fa, 'contacts', `$${n} \\times ${m} = ${n * m}$ pairs, each with ${fa}: ${n * m * fa}.`, 0.5)
  },
  (r) => {
    const n = r.pick([2, 3, 4, 6])
    const target = r.pick([0.8, 0.9])
    const ans = (1 - Math.pow(1 - target, 1 / n)) * 100
    return num('u16-need', `A planner wants **${target * 100} percent** combined detection at a point covered by **${n}** independent pairs of equal quality. What probability must each pair provide?`, ans, '%', `$1 - (1 - p)^{${n}} = ${target}$ gives $p = 1 - ${r2(1 - target)}^{1/${n}} = ${r1(ans)}$ percent.`, 1.2)
  },
  (r) =>
    mc(r, 'u16-cache', 'One receiver in a field is moved. With loss fields cached per node, what must be recomputed?', 'That receiver’s loss field, then the cheap per-pair arithmetic for pairs that use it', ['Every loss field in the field', 'Nothing, since reciprocity applies', 'Only the target strength table'], 'Loss is keyed by node position, depth and band. Moving one node invalidates one field. The pairs that include it are then recombined from cached fields.'),
  (r) =>
    mc(r, 'u16-robust', 'Two points both show 90 percent combined probability. At one, six pairs contribute a little each. At the other, one pair contributes nearly all of it. Which display tells them apart?', 'A count of pairs with positive signal excess', ['The combined probability map with a different color scale', 'The transmission loss full-field', 'The ambient noise spectrum'], 'Combined probability hides how it was built. The number of contributing pairs shows whether coverage survives the loss of one node.'),
]

export const u17: QuestionGen[] = [
  (r) => {
    const item = r.pick([
      { q: 'A new in situ sound speed profile arrives', a: 'Yes, the loss field must be recomputed' },
      { q: 'The sensor changes depth', a: 'Yes, the loss field must be recomputed' },
      { q: 'Measured beam noise arrives', a: 'No, only signal excess is recomputed' },
      { q: 'The operator changes the assumed target aspect', a: 'No, only echo level and signal excess are recomputed' },
      { q: 'The detection threshold for a processor is edited', a: 'No, only signal excess is recomputed' },
    ])
    const all = ['Yes, the loss field must be recomputed', 'No, only signal excess is recomputed', 'No, only echo level and signal excess are recomputed', 'No, nothing needs recomputing']
    return mc(r, 'u17-rerun', `${item.q}. Does the propagation engine need to run again?`, item.a, all.filter((x) => x !== item.a), 'The loss field depends on sensor position and depth, band and environment. Target assumptions change echo level. Noise, reverberation and threshold change only signal excess.')
  },
  (r) =>
    mc(r, 'u17-dims', 'What are the dimensions of a transmission loss product for a set of sensors?', 'Sensor, band, bearing, range, depth', ['Sensor, processor, target, bearing, range', 'Sensor, beam, time', 'Bearing and range only'], 'Loss depends on where the sensor is, the frequency band, and the point in the water. It does not yet know about processors or targets.'),
  (r) => {
    const ff = r.next() < 0.5
    return mc(r, 'u17-slice', `A signal excess result has axes of bearing, range and depth. Which one does a **${ff ? 'full-field' : 'plan view'}** hold fixed?`, ff ? 'Bearing' : 'Depth', [ff ? 'Depth' : 'Bearing', 'Range', 'None of them'], 'A full-field is range against depth on one bearing. A plan view is bearing against range at one depth.')
  },
  (r) => {
    const n = r.pick([8, 16, 36, 72, 180])
    const km = r.pick([20, 50, 100])
    const ans = km * ((360 / n) * DEG)
    return num('u17-radial', `An engine runs **${n}** evenly spaced radials. How far apart are neighboring radials at **${km} km**?`, ans, 'km', `Spacing is ${360 / n}°, or ${((360 / n) * DEG).toFixed(4)} rad. At ${km} km that is ${r2(ans)} km. Features narrower than this can be missed.`, Math.max(0.05, ans * 0.03))
  },
  (r) => {
    const sl = r.int(214, 226)
    const tl = r1(r.int(700, 860) / 10)
    const ts = r.int(8, 18)
    const n = r.int(54, 62)
    const rl = r.int(46, 66)
    const dt = r.int(8, 12)
    const tlv = Number(tl)
    const mask = powerSumDb([n, rl])
    const ans = sl - 2 * tlv + ts - mask - dt
    return num('u17-trace', `Trace one cell. Source level **${sl}**, one-way loss **${tl}**, target strength **${ts}**, beam noise **${n}**, reverberation **${rl}**, detection threshold **${dt}**, all in dB. What signal excess should the display show?`, ans, 'dB', `Echo $= ${sl} - 2 \\times ${tl} + ${ts} = ${r1(sl - 2 * tlv + ts)}$. Masking $= ${n} \\oplus ${rl} = ${r1(mask)}$. $SE = ${r1(sl - 2 * tlv + ts)} - ${r1(mask)} - ${dt} = ${r1(ans)}$ dB.`, 0.5)
  },
  (r) =>
    mc(r, 'u17-enter', 'Where does measured beam noise enter the pipeline?', 'After the engine, replacing the modeled noise term in the sonar equation stage', ['Before the engine, as part of the environment', 'Inside the engine, as a boundary condition', 'At the display, as an overlay only'], 'It is a level at the beam output. It changes no propagation, so no engine run is needed.'),
  (r) =>
    mc(r, 'u17-depth', 'An operator changes the target depth from 60 m to 200 m. What is the efficient response?', 'Read a different depth row of the loss field already computed', ['Rerun the engine for the new target depth', 'Rerun the engine with the source at 200 m', 'Scale the old result by the ratio of depths'], 'The engine filled range by depth for all depths at once. A new target depth is another slice of the same array.'),
  (r) => {
    const sensors = r.int(1, 4)
    const bands = r.pick([
      [3.5, 3.5, 3.5],
      [1.5, 3.5, 3.5],
      [1.5, 3.5, 7],
      [3.5, 3.5, 7, 7],
    ])
    const distinct = new Set(bands).size
    return num('u17-count', `**${sensors}** sensor${sensors > 1 ? 's each run' : ' runs'} processors centered at **${bands.join(', ')} kHz**. Grouping processors by band, how many engine runs are needed?`, sensors * distinct, 'runs', `${distinct} distinct band${distinct > 1 ? 's' : ''} per sensor, times ${sensors} sensor${sensors > 1 ? 's' : ''}: ${sensors * distinct}.`, 0.1)
  },
  (r) => {
    const sensors = r.int(1, 3)
    const procs = r.int(2, 5)
    const targets = r.int(1, 3)
    return num('u17-products', `A prediction covers **${sensors}** sensor${sensors > 1 ? 's' : ''}, **${procs}** processors on each, and **${targets}** target description${targets > 1 ? 's' : ''}. How many separate signal excess fields result?`, sensors * procs * targets, 'fields', `Signal excess is per sensor, per processor, per target: $${sensors} \\times ${procs} \\times ${targets} = ${sensors * procs * targets}$.`, 0.1)
  },
  (r) =>
    mc(r, 'u17-check', 'As a test, source level is raised 10 dB. In a region known to be strongly reverberation limited, signal excess rises 10 dB. What does that indicate?', 'A fault: reverberation is not being scaled with source level', ['Correct behavior', 'A fault in the color map', 'That the region is really noise limited, which is fine'], 'Where reverberation dominates, echo and reverberation rise together and signal excess should not move. A 10 dB rise means reverberation was held fixed.'),
  (r) =>
    mc(r, 'u17-nodata', 'A cell lies in a deep shadow zone where no ray arrives. How should it be stored?', 'As a real result with very high loss, distinct from missing data', ['As missing data, the same as a cell below the seabed', 'As zero decibels of loss', 'By interpolating from the nearest lit cells'], 'A shadow is a prediction: almost no sound gets there. Missing data means nothing was computed. Merging them hides real gaps in coverage.'),
  (r) => {
    const item = r.pick([
      { q: 'An echo level that increases with range', a: 'Sign of loss' },
      { q: 'A full-field that looks upside down', a: 'D/E or depth sign convention' },
      { q: 'Noise compared with reverberation and found 26 dB too low', a: 'Per-hertz or band reference' },
      { q: 'A plan view rotated by the ship’s heading', a: 'Bearing reference, true or relative' },
    ])
    return mc(r, 'u17-meta', `${item.q}. Which metadata attribute, if carried and checked, would have prevented it?`, item.a, ['Sign of loss', 'D/E or depth sign convention', 'Per-hertz or band reference', 'Bearing reference, true or relative'].filter((x) => x !== item.a), 'Each classic plumbing error is one convention read wrongly. Carrying the convention with the data turns a silent error into a checkable one.')
  },
  (r) => {
    const nb = r.pick([36, 72])
    const nr = r.pick([500, 1000])
    const nz = r.pick([200, 400])
    const ans = (nb * nr * nz * 4) / 1e6
    return num('u17-size', `A loss field has **${nb}** bearings, **${nr}** ranges and **${nz}** depths, stored as 4-byte values. How large is it?`, ans, 'MB', `$${nb} \\times ${nr} \\times ${nz} \\times 4$ bytes $= ${r1(ans)}$ MB, taking a megabyte as a million bytes. One such field per sensor and band.`, ans * 0.03)
  },
  (r) => {
    const k = r.pick([2, 4, 10])
    return num('u17-band', `As a check, a processor’s bandwidth is multiplied by **${k}** with a flat noise spectrum. By how much should its modeled band noise change?`, 10 * Math.log10(k), 'dB', `$10 \\log ${k} = ${r1(10 * Math.log10(k))}$ dB. If it does not, the noise is not being treated as a spectrum level.`, 0.3)
  },
]

export const u18: QuestionGen[] = [
  (r) =>
    mc(r, 'u18-rainbow', 'What is the main problem with a rainbow color map for a smoothly varying field?', 'Its lightness rises and falls, so it draws bright bands that look like boundaries the data does not have', ['It uses too few colors', 'It cannot represent negative numbers', 'It is slower to render'], 'The eye reads lightness first. Bright yellow and cyan bands in a rainbow appear as edges wherever the data passes through those values.'),
  (r) => {
    const se = r.next() < 0.5
    return mc(r, 'u18-kind', `Which kind of color map suits **${se ? 'signal excess' : 'transmission loss'}**?`, se ? 'Diverging, with a neutral tone at zero' : 'Sequential, one hue running from light to dark', [se ? 'Sequential, one hue running from light to dark' : 'Diverging, with a neutral tone at zero', 'A rainbow', 'Three classes only'], se ? 'Signal excess has a meaningful zero. A diverging map puts the change of character exactly at the 50 percent line.' : 'Loss runs in one direction from low to high, with no special middle value.')
  },
  (r) =>
    mc(r, 'u18-clip', 'A color range is set so narrowly that many cells fall beyond its ends. What is lost?', 'Any distinction among the clipped cells: slightly out of range and far out of range look the same', ['The position of the zero contour', 'The legend', 'Nothing, clipping only improves contrast'], 'Everything beyond an end takes the end color. A cell 5 dB short and a cell 50 dB short become identical.'),
  (r) =>
    mc(r, 'u18-auto', 'A display rescales its colors to fit each new field. What is the drawback?', 'Two fields cannot be compared by eye, since the same color means different values', ['The legend becomes unnecessary', 'The field is clipped', 'Smoothing is disabled'], 'Auto-scaling uses the whole palette every time. A poor day and a good day look equally colorful.'),
  (r) =>
    mc(r, 'u18-classes', 'A three-color display shows green for positive signal excess. What does it hide?', 'How far above zero a green cell is, whether +1 dB or +25 dB', ['Where the zero contour lies', 'Which cells are green', 'The bearing of each cell'], 'Classes read fast and discard everything inside a class. They also turn a negligible difference at a boundary into a change of color.'),
  (r) =>
    mc(r, 'u18-contour', 'A briefer points at the zero signal excess contour and calls it “the detection range”. What is the more accurate description?', 'The 50 percent line, the middle of a band several decibels wide', ['The range beyond which detection cannot occur', 'The range inside which detection is certain', 'The edge of the direct path'], 'Zero signal excess is even odds. Detection probability changes gradually across it at a rate set by the fluctuation.'),
  (r) => {
    const ff = r.next() < 0.5
    return mc(r, 'u18-question', `Which question is a **${ff ? 'full-field' : 'plan view'}** the right display for?`, ff ? 'At what depths could a target hide, and what sensor depth would deny it?' : 'From which directions can a target at this depth approach unseen?', [ff ? 'From which directions can a target at this depth approach unseen?' : 'At what depths could a target hide, and what sensor depth would deny it?', 'How does noise vary with frequency?', 'What is the target’s Doppler shift?'], 'The full-field shows depth structure along one bearing. The plan view shows position around the sensor at one depth.')
  },
  (r) =>
    mc(r, 'u18-se-pod', 'When is signal excess a better quantity to display than probability of detection?', 'When diagnosing or judging margin, since it shows how far from threshold each cell is', ['When briefing a planner who wants odds', 'Never, probability always carries more information', 'Only for passive sonar'], 'Probability compresses large positive and large negative signal excess to nearly 1 and nearly 0. Signal excess keeps the margin visible.'),
  (r) => {
    const a = r.pick([12, 16, 20])
    const b = a + r.pick([10, 15])
    const pa = normCdf(a / 8) * 100
    const pb = normCdf(b / 8) * 100
    return num('u18-compress', `Two cells have signal excess of **+${a} dB** and **+${b} dB**. With σ = 8 dB their detection probabilities are about ${r0(pa)} and ${r0(pb)} percent. By how many percentage points do they differ on a probability display?`, pb - pa, 'points', `About ${r1(pb - pa)} points for a ${b - a} dB difference. The probability display makes very different margins look alike.`, 1.5)
  },
  (r) => {
    const item = r.pick([
      { q: 'points straight at a merchant ship', a: 'Directional noise on those beams' },
      { q: 'follows a shoaling seabed on that side', a: 'Propagation along those bearings' },
      { q: 'stays fixed toward the platform’s stern as it turns', a: 'The array’s own baffle or beam pattern' },
      { q: 'is one radial wide and nowhere else', a: 'A bad input sample on one radial' },
    ])
    return mc(r, 'u18-notch', `A plan view has a notch in its coverage that ${item.q}. What is the most likely cause?`, item.a, ['Directional noise on those beams', 'Propagation along those bearings', 'The array’s own baffle or beam pattern', 'A bad input sample on one radial'].filter((x) => x !== item.a), 'A notch follows its cause. Noise notches point at noise sources, propagation notches follow the bathymetry, array notches follow the platform, and single-radial notches are data.')
  },
  (r) =>
    mc(r, 'u18-smooth', 'A plan view built from 8 radials is drawn with smooth interpolation. What is the risk?', 'It looks as confident as one built from 72 radials while knowing nothing of the ocean between its spokes', ['It will show too many shadow zones', 'It cannot be drawn in true bearing', 'The legend will be wrong'], 'Interpolation fills gaps with plausible values. A feature narrower than the spacing between radials is simply absent.'),
  (r) =>
    mc(r, 'u18-label', 'Some beams on a display use measured noise and others fall back to the model because data was missing. What should the display do?', 'Mark which is which, and show the age of the measurement', ['Blend them so the boundary does not show', 'Use the model everywhere for consistency', 'Hide the beams without measurements'], 'The source of each term is part of the result. A silent blend makes a seam in the picture that looks like physics.'),
  (r) => {
    const n = r.pick([24, 36, 72])
    const km = r.pick([30, 60])
    const ans = km * ((360 / n) * DEG)
    return num('u18-cell', `A plan view is built from **${n}** radials. How wide is one angular cell at **${km} km**?`, ans, 'km', `${360 / n}° is ${((360 / n) * DEG).toFixed(3)} rad, so ${r2(ans)} km at that range. Finer detail on screen is interpolation.`, Math.max(0.05, ans * 0.03))
  },
  (r) =>
    mc(r, 'u18-uncertainty', 'Which is an honest way to show uncertainty on a signal excess curve?', 'Draw the median with a band from the 10th to the 90th percentile', ['Draw the curve with a thicker line', 'Round the values to the nearest 10 dB', 'Remove the legend'], 'A percentile band turns doubt into something that can be read as distance on the range axis.'),
]

export const u19: QuestionGen[] = [
  (r) =>
    mc(r, 'u19-source', 'In most active predictions, which is the largest source of error?', 'The inputs: bottom properties, the profile and the assumed target', ['Numerical error inside the propagation engine', 'Rounding of decibel values', 'The color map'], 'Engines are carefully verified. What they are told about the world is not nearly as well known.'),
  (r) => {
    const item = r.pick([
      { q: 'in a surface duct', a: 'Mixed layer depth and sea state' },
      { q: 'in shallow water in summer', a: 'Bottom loss' },
      { q: 'at a convergence zone', a: 'The deep profile and depth excess' },
      { q: 'when strongly reverberation limited', a: 'Scattering strength and the waveform' },
    ])
    return mc(r, 'u19-sensitive', `A prediction is made ${item.q}. Which inputs is it most sensitive to?`, item.a, ['Mixed layer depth and sea state', 'Bottom loss', 'The deep profile and depth excess', 'Scattering strength and the waveform'].filter((x) => x !== item.a), 'Sensitivity depends on which paths and which masking term are in play. The inputs that touch those are the ones that matter.')
  },
  (r) => {
    const base = r.int(8, 16)
    const vals = Array.from({ length: 9 }, (_v, i) => base + i * r.pick([1, 2]) + (i > 4 ? r.int(0, 2) : 0)).sort((a, b) => a - b)
    return num('u19-median', `Nine ensemble members give detection ranges, in km, of **${r.shuffle(vals).join(', ')}**. What is the median?`, vals[4], 'km', `Sorted: ${vals.join(', ')}. The fifth of nine is ${vals[4]} km.`, 0.2)
  },
  (r) => {
    const n = r.pick([40, 50, 80])
    const k = Math.round(n * r.pick([0.2, 0.35, 0.6, 0.85]))
    return num('u19-prob', `In an ensemble of **${n}** members, **${k}** have positive signal excess at 20 km. What probability does the ensemble give for signal excess above zero there?`, (k / n) * 100, '%', `$${k}/${n} = ${r1((k / n) * 100)}$ percent.`, 0.6)
  },
  (r) => {
    const rerun = r.next() < 0.5
    return mc(r, 'u19-rerun', `Which measurement ${rerun ? 'requires' : 'does not require'} the propagation engine to run again?`, rerun ? 'A new sound speed profile' : 'Measured beam noise', rerun ? ['Measured beam noise', 'Measured reverberation', 'A revised detection threshold'] : ['A new sound speed profile', 'A corrected bathymetry grid', 'A change of sensor depth'], 'A profile changes propagation. Beam noise and reverberation are levels at the receiver that enter after the engine.')
  },
  (r) =>
    mc(r, 'u19-leftover', 'After measured beam noise and measured reverberation have been assimilated, what remains uncertain?', 'Transmission loss to the target and target strength', ['The noise term', 'The reverberation term', 'The source level'], 'Measurements fix the masking side of the equation. The echo side is still a prediction about paths and about the target.'),
  (r) => {
    const ver = r.next() < 0.5
    return mc(r, 'u19-vv', `An engine is compared with ${ver ? 'an exact analytic solution for an ideal waveguide' : 'transmission loss measured at sea with a calibrated source'}. What is this called?`, ver ? 'Verification' : 'Validation', [ver ? 'Validation' : 'Verification', 'Calibration', 'Assimilation'], 'Verification asks whether the equations were solved correctly. Validation asks whether they, and their inputs, describe the real ocean.')
  },
  (r) =>
    mc(r, 'u19-visual', 'Numeric golden-case tests all pass after a change. Which kind of fault can still slip through, and what catches it?', 'A changed color scale or legend, caught by visual regression tests on rendered displays', ['A sign error in loss, caught by reading the code', 'A wrong bandwidth, caught by the compiler', 'Nothing can slip through'], 'Tests on arrays do not see how arrays are drawn. Comparing rendered images does.'),
  (r) =>
    mc(r, 'u19-surrogate', 'What is the central caution about a machine-learned surrogate for a propagation engine?', 'Outside the environments it was trained on it can be wrong with no warning, while still producing a plausible field', ['It is always slower than the engine', 'It cannot represent shadow zones', 'It needs measured reverberation to run'], 'A surrogate interpolates among what it has seen. It gives no sign when asked to extrapolate.'),
  (r) => {
    const slope = r.pick([0.2, 0.5, 1, 2])
    const e = r.pick([4, 6, 8])
    const ans = e / (2 * slope)
    return num('u19-slope', `Near the detection range, one-way loss rises by **${slope} dB per km**. Signal excess is in error by **${e} dB**. Roughly how far does the predicted noise-limited detection range move?`, ans, 'km', `Signal excess changes by twice the loss slope per kilometer: ${2 * slope} dB/km. $${e}/${2 * slope} = ${r1(ans)}$ km. ${slope < 0.6 ? 'A flat curve makes the range very sensitive.' : ''}`, Math.max(0.2, ans * 0.04))
  },
  (r) =>
    mc(r, 'u19-flat', 'Why does a long predicted range in a surface duct deserve more skepticism than a short one on a summer shelf?', 'The duct’s loss curve is flat, so a few decibels of error move the range by many kilometers', ['Ducts do not exist in practice', 'Summer predictions are never wrong', 'Long ranges always imply reverberation limiting'], 'Range sensitivity is error divided by slope. Good propagation means a shallow slope and a fragile range.'),
  (r) =>
    mc(r, 'u19-join', 'A measured profile to 400 m is joined to climatology below it, leaving a step of 3 m/s at the join. What happens?', 'The step acts like a real layer and bends rays there, creating structure that is not in the ocean', ['Nothing, engines ignore steps', 'The engine refuses to run', 'Only the bottom loss is affected'], 'Rays respond to gradients. An artificial jump in sound speed is the strongest gradient in the profile.'),
  (r) => {
    const a = r.pick([2, 3, 4])
    const b = r.pick([3, 5, 6])
    const c = r.pick([4, 6, 8])
    const ans = Math.sqrt(a * a + b * b + c * c)
    return num('u19-rss', `Three independent uncertainties in signal excess have standard deviations of **${a}, ${b} and ${c} dB**. What is the combined standard deviation?`, ans, 'dB', `Independent errors add as squares: $\\sqrt{${a}^2 + ${b}^2 + ${c}^2} = ${r1(ans)}$ dB. The largest term dominates.`, 0.3)
  },
]

function rangeForLoss(allowed: number, fKhz: number): number {
  const alpha = thorpDbPerKm(fKhz)
  let lo = 100
  let hi = 500000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (20 * Math.log10(mid) + (alpha * mid) / 1000 > allowed) hi = mid
    else lo = mid
  }
  return lo / 1000
}

export const u20: QuestionGen[] = [
  (r) => {
    const sl = r.int(214, 228)
    const tl = r.int(72, 84)
    const ts = r.pick([10, 12, 15, 25])
    const n = r.int(54, 64)
    const rl = r.int(50, 68)
    const dt = r.int(8, 12)
    const mask = powerSumDb([n, rl])
    return num('u20-budget', `Full budget. $SL = ${sl}$, one-way loss ${tl}, $TS = ${ts}$, beam noise ${n}, reverberation ${rl}, $DT = ${dt}$, all in dB. What is the signal excess?`, sl - 2 * tl + ts - mask - dt, 'dB', `Echo $= ${sl - 2 * tl + ts}$. Masking $= ${n} \\oplus ${rl} = ${r1(mask)}$. $SE = ${r1(sl - 2 * tl + ts - mask - dt)}$ dB, ${rl > n ? 'reverberation' : 'noise'} limited.`, 0.5)
  },
  (r) => {
    const se = r.pick([-8, -4, 0, 4, 8, 16])
    return num('u20-pd', `Your budget gives a signal excess of **${se === 0 ? '0' : `${se > 0 ? '+' : '−'}${Math.abs(se)}`} dB**. With σ = 8 dB, what probability of detection do you brief? Φ(0.5) = 0.69, Φ(1) = 0.84, Φ(2) = 0.98.`, normCdf(se / 8) * 100, '%', `$\\Phi(${r2(se / 8)}) = ${r0(normCdf(se / 8) * 100)}$ percent.`, 2.5)
  },
  (r) => {
    const below = r.next() < 0.5
    return mc(r, 'u20-layer', `A 100 m mixed layer. Your hull sonar is at 40 m. Intelligence suggests the target will stay **${below ? 'below the layer at 250 m' : 'in the layer at 50 m'}**. You also have a variable depth sonar. Where do you put it?`, below ? 'Below the layer, on the same side as the target' : 'Leave it in the layer, or rely on the hull sonar: both are on the target’s side', [below ? 'In the layer at 60 m, to use the duct' : 'At 250 m, below the layer', 'At the surface', 'Depth does not matter if source level is high enough'], 'A sensor and a target on opposite sides of the layer are separated by a shadow zone beyond short range. Put the sensor on the target’s side.')
  },
  (r) => {
    const cz = r.int(55, 64)
    const tp = r.pick([40, 60])
    const need = (2000 * cz) / C
    return mc(r, 'u20-cz', `The first convergence zone is at **${cz} km** and signal excess there is +6 dB. The ping interval is **${tp} s**. Will the zone be searched?`, `No. Echoes from ${cz} km need ${r0(need)} s to return, longer than the interval`, ['Yes, since signal excess is positive', `No, because the blind range exceeds ${cz} km`, 'Yes, but only on the beam'], `$2r/c = ${r1(need)}$ s. With a ${tp} s interval the echo arrives during the next cycle and appears at a false short range.`)
  },
  (r) =>
    mc(r, 'u20-summer', 'Summer shelf, sand bottom, heavy bottom reverberation. Detection at 6 km is marginal. Which change is most likely to help?', 'Switch from a 1 s CW pulse to a wideband FM sweep', ['Raise source level by 6 dB', 'Widen the receive beam', 'Lengthen the CW pulse'], 'The sonar is reverberation limited. Source level cancels. A wide band shrinks the range cell and the reverberation in it by tens of decibels.'),
  (r) =>
    mc(r, 'u20-winter', 'Winter shelf, mixed column, wind rising from 10 to 30 knots. What happens to the prediction?', 'Surface loss, surface reverberation and ambient noise all rise together, and range shortens', ['Nothing, since the profile is unchanged', 'Bottom loss increases', 'Only target strength changes'], 'In winter the surface carries the sound. Wind acts on every surface bounce and on the noise floor at once.'),
  (r) => {
    const th0 = r.pick([4, 6, 8])
    const slope = r.pick([1, 1.5, 2])
    const crit = r.pick([20, 25, 28])
    const n = Math.ceil((crit - th0) / (2 * slope))
    return num('u20-slope', `Looking upslope. A ray first strikes the bottom at a grazing angle of **${th0}°**. The slope is **${slope}°** and the sediment’s critical angle is **${crit}°**. After how many further bounces does the grazing angle first reach or exceed the critical angle?`, n, 'bounces', `Each bounce adds $2 \\times ${slope} = ${2 * slope}°$. $${th0} + ${2 * slope}n \\ge ${crit}$ needs $n = ${n}$. After that the energy goes into the seabed.`, 0.1)
  },
  (r) => {
    const item = r.pick([
      { q: 'Signal excess is too good by about the directivity index on every beam', a: 'Measured beam noise has had DI subtracted from it' },
      { q: 'The echo level rises as range increases', a: 'Transmission loss is being applied with the wrong sign' },
      { q: 'The plan view is rotated by the ship’s heading', a: 'Beam data was drawn as true bearing without applying heading' },
      { q: 'Everything is too good by 26 dB for one FM processor', a: 'Processing gain was counted in both the threshold and a separate term' },
      { q: 'The full-field appears upside down, with a duct at the seabed', a: 'A D/E or depth sign convention was flipped' },
    ])
    const all = ['Measured beam noise has had DI subtracted from it', 'Transmission loss is being applied with the wrong sign', 'Beam data was drawn as true bearing without applying heading', 'Processing gain was counted in both the threshold and a separate term', 'A D/E or depth sign convention was flipped']
    return mc(r, 'u20-diagnose', `A prediction looks wrong. ${item.q}. What is the first thing to check?`, item.a, r.shuffle(all.filter((x) => x !== item.a)).slice(0, 3), 'The shape of a discrepancy points to its stage. A constant offset equal to a known gain is a double count. A reversed trend is a sign. A rotation is a reference frame.')
  },
  (r) => {
    const n = r.int(2, 3)
    const m = r.pick([4, 6, 8])
    const p = r.pick([0.15, 0.2, 0.25])
    const k = r.int(3, 5)
    const ans = (1 - Math.pow(1 - p, k)) * 100
    return num('u20-field', `A barrier has **${n}** sources and **${m}** receivers. At a point on the line, **${k}** of the ${n * m} pairs each give **${p * 100} percent** and the rest give nothing. Treating pairs as independent, what is the combined probability there?`, ans, '%', `$1 - (1 - ${p})^{${k}} = ${r1(ans)}$ percent. Several weak pairs add up, and the count of contributing pairs says how fragile that is.`, 1)
  },
  (r) => {
    const base = r.pick([12, 16, 20])
    const rt = base / 2 + r.pick([5, 8])
    const rr = base / 2 + r.pick([4, 7])
    const tau = r.pick([1, 2])
    const after = ((rt + rr - base) * 1000) / C
    const blind = after < tau
    return num('u20-bistatic', `Bistatic pair, baseline **${base} km**, source to target **${r1(rt)} km**, target to receiver **${r1(rr)} km**, pulse **${tau} s**. How long after the direct blast begins does the echo arrive?`, after, 's', `$(${r1(rt)} + ${r1(rr)} - ${base}) \\times 1000/1500 = ${r1(after)}$ s. ${blind ? 'That is inside the pulse length, so the echo is blanked.' : `That is beyond the ${tau} s pulse, so the echo is clear of the blast.`}`, 0.2)
  },
  (r) =>
    mc(r, 'u20-brief', 'Which statement is the best way to brief a prediction?', 'Against a target at 100 m, expect detection to about 12 km, a gap, then a narrow zone near 58 km. That assumes beam aspect. The bottom is the weak point', ['Detection range is 12 km', 'The sonar will detect the target at 12 km', 'Signal excess is positive, so detection is assured'], 'A good brief gives the shape of the answer, the assumptions behind it, and where the doubt lies. It avoids a bare number and avoids “will”.'),
  (r) => {
    const fom = r.pick([150, 160, 170])
    const f = r.pick([1, 3.5])
    const ans = rangeForLoss(fom / 2, f)
    return num('u20-range', `A noise-limited sonar at **${f} kHz** has a figure of merit of **${fom} dB** two-way. Loss is spherical spreading plus absorption of **${r2(thorpDbPerKm(f))} dB/km**. At about what range does signal excess reach zero? Solve $20 \\log r + \\alpha r = ${fom / 2}$ by trial.`, ans, 'km', `Allowed one-way loss is ${fom / 2} dB. Trying values gives $r \\approx ${r1(ans)}$ km: spreading ${r1(20 * Math.log10(ans * 1000))} dB plus absorption ${r1(thorpDbPerKm(f) * ans)} dB.`, ans * 0.05)
  },
  (r) =>
    mc(r, 'u20-first', 'Faced with a new scenario, what is the first step?', 'Read the water: the profile, the layer, depth excess and the bottom', ['Compute the figure of merit', 'Choose the waveform', 'Select the color map'], 'The ocean decides which paths exist. Sensor depth, processor and budget all follow from that.'),
  (r) => {
    const s = r.pick([6, 10, 14])
    const phi = r.pick([10, 50, 75, 85])
    const ridge = 3
    const closing = s * Math.cos(phi * DEG)
    const hz = (2 * closing * KNOT_MS * 3500) / C
    return num('u20-doppler', `A **${s}-knot** target’s course is **${phi}°** off the line of sight to a 3.5 kHz sonar. The reverberation ridge is ±${ridge} knots. What is the target’s closing speed? Decide for yourself whether a CW processor would see it clear of the ridge.`, closing, 'kn', `$${s} \\cos ${phi}° = ${r1(closing)}$ kn, a Doppler of ${r1(hz)} Hz. That is ${closing > ridge ? 'clear of' : 'inside'} the ridge, so ${closing > ridge ? 'a CW processor has it against noise alone' : 'the FM processor is the one to rely on'}.`, 0.3)
  },
  (r) =>
    mc(r, 'u20-doubt', 'A shallow-water prediction over a bottom charted as sand disagrees badly with what the sonar measures. What should be suspected first?', 'The bottom: a different sediment than charted changes loss and scattering by many decibels', ['The propagation engine’s numerical accuracy', 'The speed of sound in water', 'The definition of the decibel'], 'Bottom provinces are assigned from sparse samples. In bottom-interacting water this is the least certain input and the most influential.'),
  (r) => {
    const ts = r.pick([10, 15, 25])
    const s = r.pick([-40, -35, -30])
    const a = r.pick([30, 40, 50])
    const dt = r.pick([8, 10])
    return num('u20-reverb-se', `Reverberation limited, with target and scattering patch on the same paths. $TS = ${ts}$ dB, scattering strength $S = ${s}$ dB, $10 \\log A = ${a}$ dB, $DT = ${dt}$ dB. Using $SE = TS - S - 10\\log A - DT$, what is the signal excess?`, ts - s - a - dt, 'dB', `$${ts} - (${s}) - ${a} - ${dt} = ${ts - s - a - dt}$ dB. Source level and loss do not appear: they cancelled.`)
  },
]
