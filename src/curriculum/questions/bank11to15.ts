import { bistaticRangeResolutionM, receiverRange } from '../../lib/bistatic'
import { DEG, KNOT_MS, KYD_M, powerSumDb } from '../../lib/db'
import { detectionIndex, normCdf } from '../../lib/detection'
import { mc, num, r0, r1, r2 } from './helpers'
import type { QuestionGen } from './types'

const C = 1500

export const u11: QuestionGen[] = [
  (r) => {
    const exp = r.pick([2, 3, 4, 5, 6])
    const d = detectionIndex(0.5, Math.pow(10, -exp))
    return num('u11-d', `A detector must give 50 percent detection at a false alarm probability of $10^{-${exp}}$. The threshold then sits $Q^{-1}(10^{-${exp}}) = ${r2(Math.sqrt(d))}$ standard deviations above the noise mean. What detection index is needed, as $10 \\log d$?`, 10 * Math.log10(d), 'dB', `For Pd of one half the second term is zero, so $d = ${r2(Math.sqrt(d))}^2 = ${r1(d)}$ and $10 \\log d = ${r1(10 * Math.log10(d))}$ dB.`, 0.3)
  },
  (r) => {
    const d = r.pick([10, 13.8, 20, 25])
    const t = r.pick([0.25, 0.5, 1, 2, 4])
    const ans = 10 * Math.log10(d / (2 * t))
    return num('u11-dt', `A matched filter needs a detection index of **${d}**. The pulse lasts **${t} s**. Using $DT = 10 \\log(d/2T)$, referred to noise in a one-hertz band, what is the detection threshold?`, ans, 'dB', `$10 \\log(${d}/${2 * t}) = ${r1(ans)}$ dB.${ans < 0 ? ' Negative: the processor finds an echo below the noise at its input.' : ''}`, 0.3)
  },
  (r) => {
    const sigma = r.pick([6, 8, 10])
    const se = r.pick([-12, -8, -4, 4, 6, 8, 12])
    const ans = normCdf(se / sigma) * 100
    return num('u11-pd', `Signal excess is **${se > 0 ? '+' : '−'}${Math.abs(se)} dB** and the fluctuation is **σ = ${sigma} dB**. Using $P_d = \\Phi(SE/\\sigma)$, what is the probability of detection? Useful values: Φ(0.5) = 0.69, Φ(0.75) = 0.77, Φ(1) = 0.84, Φ(1.33) = 0.91, Φ(1.5) = 0.93, Φ(2) = 0.98, and Φ(−x) = 1 − Φ(x).`, ans, '%', `$SE/\\sigma = ${r2(se / sigma)}$ and $\\Phi(${r2(se / sigma)}) = ${r0(ans)}$ percent.`, 2.5)
  },
  (r) => {
    const p = r.pick([0.2, 0.3, 0.4, 0.5])
    const n = r.int(2, 6)
    const ans = (1 - Math.pow(1 - p, n)) * 100
    return num('u11-cum', `Each ping has a **${p * 100} percent** chance of detecting a target. Treating **${n}** pings as independent, what is the chance of at least one detection?`, ans, '%', `$1 - (1 - ${p})^{${n}} = ${r1(ans)}$ percent. Correlated pings would give less.`, 1)
  },
  (r) => {
    const beams = r.pick([36, 72, 100])
    const cells = r.pick([2000, 5000, 10000])
    const exp = r.pick([4, 5, 6])
    const ans = beams * cells * Math.pow(10, -exp)
    return num('u11-fa', `A processor examines **${beams}** beams and **${cells}** range cells each ping. Its false alarm probability per cell is $10^{-${exp}}$. How many false alarms per ping should be expected?`, ans, 'per ping', `$${beams} \\times ${cells} \\times 10^{-${exp}} = ${ans >= 1 ? r1(ans) : ans.toFixed(2)}$.`, Math.max(0.02, ans * 0.03))
  },
  (r) =>
    mc(r, 'u11-zero', 'A contour of zero signal excess is drawn on a plan view. How should it be described?', 'The line where detection is a 50 percent proposition', ['The limit beyond which detection is impossible', 'The line where the echo level is zero', 'The range at which detection becomes certain'], 'Signal excess is zero where the signal-to-masking ratio equals the detection threshold, which is defined at 50 percent probability.'),
  (r) => {
    const up = r.next() < 0.5
    return mc(r, 'u11-threshold', `The detection threshold is **${up ? 'raised' : 'lowered'}** with everything else unchanged. What happens?`, up ? 'Both false alarms and detections decrease' : 'Both false alarms and detections increase', [up ? 'Both false alarms and detections increase' : 'Both false alarms and detections decrease', 'False alarms decrease and detections increase', 'False alarms increase and detections decrease'], 'Moving the threshold trades the two together. Only more signal-to-noise ratio improves one without hurting the other.')
  },
  (r) => {
    const sigma = r.pick([6, 8, 9, 10])
    const item = r.pick([
      { pd: 84, k: 1 },
      { pd: 16, k: -1 },
      { pd: 98, k: 2 },
      { pd: 2, k: -2 },
    ])
    return num('u11-need', `With **σ = ${sigma} dB**, what signal excess gives a detection probability of about **${item.pd} percent**? Recall Φ(1) = 0.84 and Φ(2) = 0.98.`, item.k * sigma, 'dB', `${item.pd} percent corresponds to ${item.k} standard deviation${Math.abs(item.k) > 1 ? 's' : ''}: $SE = ${item.k} \\times ${sigma} = ${item.k * sigma}$ dB.`, 0.5)
  },
  (r) =>
    mc(r, 'u11-negative', 'Can a detection threshold be negative?', 'Yes. A long pulse or wide band lets the processor detect an echo below the noise at its input', ['No. An echo below the noise can never be detected', 'Only for passive sonars', 'Only when the false alarm probability is above one half'], 'Processing gain is folded into the threshold when it is referred to the processor’s input. Enough gain makes the required input ratio less than one.'),
  (r) =>
    mc(r, 'u11-rd', 'What is recognition differential?', 'The signal-to-noise ratio at which a trained operator on a given display detects half the time', ['The difference between two successive pings', 'The ratio of echo level to reverberation level', 'The threshold of an ideal detector at 90 percent detection'], 'Recognition differential is the practical counterpart of detection threshold. It includes the display and the operator, and it belongs to a processor and display mode.'),
  (r) =>
    mc(r, 'u11-indep', 'Five pings ten seconds apart are combined with the independent-looks formula. Why is the result likely too high?', 'Successive pings share the same target aspect, path and noise, so their outcomes are correlated', ['The formula ignores false alarms', 'Five is too few looks for the formula to apply', 'The formula assumes the target is moving'], 'If the first ping missed because the target was bow-on, the second will probably miss for the same reason. Independence is an upper bound.'),
  (r) => {
    const beams = r.pick([48, 72, 96])
    const cells = r.pick([4000, 8000])
    const dop = r.pick([1, 16, 32])
    return num('u11-cells', `A processor forms **${beams}** beams, **${cells}** range cells and **${dop}** Doppler bin${dop > 1 ? 's' : ''}. How many decisions does it make per ping?`, beams * cells * dop, 'cells', `$${beams} \\times ${cells} \\times ${dop} = ${(beams * cells * dop).toLocaleString('en-US')}$.`, beams * cells * dop * 0.01)
  },
  (r) => {
    const k = r.pick([2, 4, 8])
    const ans = -10 * Math.log10(k)
    return num('u11-longer', `A matched-filter processor’s pulse is made **${k}** times longer at the same power. Using $DT = 10 \\log(d/2T)$, how does its detection threshold change?`, ans, 'dB', `$-10 \\log ${k} = ${r1(ans)}$ dB. More energy in the pulse means less is required of the input ratio.`, 0.3)
  },
]

export const u12: QuestionGen[] = [
  (r) => {
    const t = r.pick([0.05, 0.1, 0.25, 0.5, 1, 2])
    return num('u12-cw-range', `A CW pulse lasts **${t} s**. How deep is its range cell, $cT/2$?`, (C * t) / 2, 'm', `$1500 \\times ${t}/2 = ${r1((C * t) / 2)}$ m.`, Math.max(1, C * t * 0.01))
  },
  (r) => {
    const b = r.pick([50, 100, 200, 400, 800, 1000])
    return num('u12-fm-range', `An FM sweep has a bandwidth of **${b} Hz**. What is its range resolution after matched filtering, $c/2B$?`, C / (2 * b), 'm', `$1500/(2 \\times ${b}) = ${r2(C / (2 * b))}$ m, whatever the sweep’s duration.`, Math.max(0.05, (C / (2 * b)) * 0.02))
  },
  (r) => {
    const v = r.pick([2, 5, 8, 10, 15, 20])
    const f = r.pick([1, 2, 3.5, 5, 7.5])
    const ans = (2 * v * KNOT_MS * f * 1000) / C
    return num('u12-doppler', `A target closes at **${v} knots**. The sonar transmits at **${f} kHz**. What is the Doppler shift of the echo? One knot is 0.514 m/s.`, ans, 'Hz', `$\\Delta f = 2vf/c = 2 \\times ${r2(v * KNOT_MS)} \\times ${f * 1000}/1500 = ${r1(ans)}$ Hz. About 0.69 Hz per knot per kilohertz.`, Math.max(0.3, ans * 0.03))
  },
  (r) => {
    const t = r.pick([0.25, 0.5, 1, 2, 4])
    const f = r.pick([2, 3.5, 5])
    const ans = C / (2 * f * 1000 * t) / KNOT_MS
    return num('u12-speedres', `A CW pulse of **${t} s** at **${f} kHz** resolves Doppler to about $1/T$ hertz. What closing-speed resolution is that, in knots?`, ans, 'kn', `$\\Delta v = c/(2fT) = 1500/(2 \\times ${f * 1000} \\times ${t}) = ${r2(C / (2 * f * 1000 * t))}$ m/s $= ${r2(ans)}$ kn.`, Math.max(0.03, ans * 0.04))
  },
  (r) => {
    const b = r.pick([100, 200, 400, 800])
    const t = r.pick([0.25, 0.5, 1, 2])
    const ans = 10 * Math.log10(b * t)
    return num('u12-pg', `An FM pulse sweeps **${b} Hz** in **${t} s**. What is its processing gain, $10 \\log BT$?`, ans, 'dB', `$10 \\log(${b} \\times ${t}) = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const item = r.pick([
      { q: 'A target closing at 15 knots in heavy bottom reverberation', a: 'A long CW pulse' },
      { q: 'A target crossing at right angles to the line of sight, in heavy reverberation', a: 'A wideband FM sweep' },
      { q: 'A fast target, where a wideband sweep must still correlate fully', a: 'An HFM sweep in preference to LFM' },
    ])
    return mc(r, 'u12-choose', `${item.q}. Which waveform is the natural choice?`, item.a, ['A long CW pulse', 'A wideband FM sweep', 'An HFM sweep in preference to LFM', 'A very short CW pulse'].filter((x) => x !== item.a).slice(0, 3), 'CW separates moving targets from reverberation by Doppler. FM shrinks the range cell and so the reverberation. HFM keeps its correlation under Doppler where LFM loses some.')
  },
  (r) =>
    mc(r, 'u12-energy', 'Two pulses have the same power and the same one-second duration: one CW, one a 400 Hz FM sweep. Against **noise alone**, how do matched-filter outputs compare?', 'They are equal, since both carry the same energy', ['The FM pulse is 26 dB better', 'The CW pulse is 26 dB better', 'The FM pulse is 3 dB better'], 'Against white noise the matched filter output depends only on $2E/N_0$. Waveform shape matters against reverberation, not against noise.'),
  (r) => {
    const item = r.pick([
      { q: 'Array depth', a: 'The sensor' },
      { q: 'Bandwidth', a: 'The processor' },
      { q: 'Detection threshold', a: 'The processor' },
      { q: 'Platform heading', a: 'The sensor' },
      { q: 'Effective pulse length used for reverberation', a: 'The processor' },
      { q: 'Hydrophone positions', a: 'The sensor' },
    ])
    return mc(r, 'u12-owner', `In a prediction’s data model, which owns this attribute? **${item.q}**`, item.a, [item.a === 'The sensor' ? 'The processor' : 'The sensor', 'The target', 'The environment'], 'The sensor fixes geometry: position, depth, heading, array layout. Each processor fixes its own band, waveform, threshold and the quantities that follow from them.')
  },
  (r) =>
    mc(r, 'u12-normalizer', 'A sonar is asked to supply measured reverberation for prediction. Where in its processing chain must the data be tapped?', 'Before the normalizer', ['After the normalizer', 'After thresholding', 'At the display'], 'The normalizer divides each cell by the local background. After it the background level has been removed, and every beam reads about the same.'),
  (r) => {
    const s = r.pick([8, 10, 12, 16, 20])
    const phi = r.pick([0, 30, 45, 60, 80])
    const f = 3.5
    const ans = (2 * s * KNOT_MS * Math.cos(phi * DEG) * f * 1000) / C
    return num('u12-crossing', `A target moves at **${s} knots** on a course **${phi}°** away from the direct line toward the sonar. The sonar works at **${f} kHz**. What Doppler shift does the echo have?`, ans, 'Hz', `Closing speed is $${s} \\cos ${phi}° = ${r1(s * Math.cos(phi * DEG))}$ kn, which at 2.4 Hz per knot gives ${r1(ans)} Hz.`, Math.max(0.4, ans * 0.03))
  },
  (r) => {
    const ridge = r.pick([2, 3, 4])
    const s = r.pick([8, 12, 15])
    const phi = r.pick([20, 45, 70, 80, 85])
    const closing = s * Math.cos(phi * DEG)
    const clear = closing > ridge
    return mc(r, 'u12-ridge', `The reverberation ridge is **±${ridge} knots** wide. A target moves at **${s} knots** on a course **${phi}°** off the line of sight. For a CW processor, where does it fall?`, clear ? `Clear of the ridge, with ${r1(closing)} knots of closing speed` : `Inside the ridge, with only ${r1(closing)} knots of closing speed`, [clear ? `Inside the ridge, with only ${r1(closing / 3)} knots of closing speed` : `Clear of the ridge, with ${s} knots of closing speed`, 'It depends on the pulse bandwidth', 'CW processors are not affected by the ridge'], `Only the component along the line of sight counts: $${s} \\cos ${phi}° = ${r1(closing)}$ knots, which is ${clear ? 'more' : 'less'} than ${ridge}.`)
  },
  (r) => {
    const n = r.pick([3, 4, 6])
    const bands = r.pick([1, 2])
    return num('u12-share', `A sensor runs **${n}** processors that between them use **${bands}** distinct frequency band${bands > 1 ? 's' : ''}. Transmission loss depends on band and geometry, not on waveform. How many loss fields must the engine compute for this sensor?`, bands, 'fields', `One per band: ${bands}. All processors in a band share its loss field and still differ in noise, reverberation and threshold.`, 0.1)
  },
  (r) =>
    mc(r, 'u12-cas', 'What is the main advantage claimed for continuous active sonar over pulsed sonar?', 'A much higher update rate on a target, which helps tracking', ['Much higher source level', 'No reverberation', 'No need for a receiver array'], 'By processing sub-bands of a long repeating sweep, a continuous sonar reports position every second or two. Published trials show detection in reverberation roughly comparable for the same band.'),
  (r) => {
    const t = r.pick([0.5, 1, 2])
    const b = r.pick([200, 400, 800])
    return num('u12-compressed', `A **${t} s** FM sweep of **${b} Hz** is matched filtered. What effective pulse length should be used in the reverberation equation?`, 1000 / b, 'ms', `The compressed length is $1/B = 1/${b}$ s $= ${r2(1000 / b)}$ ms, not the ${t} s that was transmitted.`, Math.max(0.05, (1000 / b) * 0.03))
  },
]

export const u13: QuestionGen[] = [
  (r) => {
    const sl = r.int(212, 228)
    const tl = r.int(70, 86)
    const ts = r.int(8, 22)
    const nl = r.int(74, 88)
    const di = r.pick([15, 18, 20, 22])
    const dt = r.int(6, 14)
    const ans = sl - 2 * tl + ts - (nl - di) - dt
    return num('u13-noise', `Noise limited. $SL = ${sl}$, one-way $TL = ${tl}$, $TS = ${ts}$, band noise level $NL = ${nl}$, $DI = ${di}$, $DT = ${dt}$, all in dB. What is the signal excess?`, ans, 'dB', `$SE = ${sl} - 2(${tl}) + ${ts} - (${nl} - ${di}) - ${dt} = ${ans}$ dB.`)
  },
  (r) => {
    const sl = r.int(212, 228)
    const tl = r.int(68, 80)
    const ts = r.int(8, 22)
    const rl = r.int(56, 78)
    const dt = r.int(6, 14)
    const ans = sl - 2 * tl + ts - rl - dt
    return num('u13-reverb', `Reverberation limited. $SL = ${sl}$, one-way $TL = ${tl}$, $TS = ${ts}$, reverberation at the beam $RL = ${rl}$, $DT = ${dt}$, all in dB. What is the signal excess?`, ans, 'dB', `$SE = ${sl} - ${2 * tl} + ${ts} - ${rl} - ${dt} = ${ans}$ dB.`)
  },
  (r) => {
    const el = r.int(68, 82)
    const n = r.int(54, 64)
    const rl = n + r.int(-5, 5)
    const dt = r.int(6, 12)
    const mask = powerSumDb([n, rl])
    return num('u13-mask', `Echo level is **${el} dB**. Beam noise is **${n} dB** and reverberation is **${rl} dB**. Detection threshold is **${dt} dB**. What is the signal excess?`, el - mask - dt, 'dB', `Masking is $${n} \\oplus ${rl} = ${r1(mask)}$ dB. $SE = ${el} - ${r1(mask)} - ${dt} = ${r1(el - mask - dt)}$ dB.`, 0.4)
  },
  (r) => {
    const sl = r.int(212, 228)
    const ts = r.int(8, 22)
    const n = r.int(52, 66)
    const dt = r.int(6, 14)
    return num('u13-fom', `$SL = ${sl}$, $TS = ${ts}$, beam noise $= ${n}$, $DT = ${dt}$, in dB. What is the figure of merit, the largest two-way loss that still gives 50 percent detection?`, sl + ts - n - dt, 'dB', `$FOM = SL + TS - N_{beam} - DT = ${sl} + ${ts} - ${n} - ${dt} = ${sl + ts - n - dt}$ dB.`)
  },
  (r) => {
    const fom = r.int(150, 180)
    return num('u13-half', `A noise-limited sonar has a figure of merit of **${fom} dB** two-way. What is the largest **one-way** loss at which signal excess is still zero?`, fom / 2, 'dB', `Half of it, since the loss is paid twice: ${fom / 2} dB.`, 0.3)
  },
  (r) => {
    const fom = r.pick([140, 150, 160, 170])
    const ans = Math.pow(10, fom / 40) / 1000
    return num('u13-range', `Figure of merit is **${fom} dB** two-way. With spherical spreading and no absorption, $TL = 20 \\log r$, at what range is signal excess zero?`, ans, 'km', `One-way loss allowed is ${fom / 2} dB. $20 \\log r = ${fom / 2}$ gives $r = 10^{${fom / 40}} = ${r0(Math.pow(10, fom / 40))}$ m.`, ans * 0.03)
  },
  (r) => {
    const x = r.pick([2, 3, 4, 5])
    return num('u13-loss', `One-way transmission loss to a target increases by **${x} dB**. Everything else is unchanged and the sonar is noise limited. How does signal excess change?`, -2 * x, 'dB', `Loss enters twice: $-2 \\times ${x} = ${-2 * x}$ dB.`, 0.2)
  },
  (r) => {
    const pg = r.pick([20, 23, 26, 30])
    const out = r.pick([8, 10, 12])
    return num('u13-book', `A processor needs **+${out} dB** at its output and has **${pg} dB** of processing gain. If the detection threshold is quoted at the beam output, with the gain folded in, what is its value?`, out - pg, 'dB', `$DT = ${out} - ${pg} = ${out - pg}$ dB. Using +${out} here, or adding ${pg} dB of gain as well, would be wrong by the full processing gain.`, 0.2)
  },
  (r) =>
    mc(r, 'u13-measured', 'Measured reverberation is available for a beam. In the general equation $SE = EL - [(NL - DI) \\oplus RL] - DT$, what does it replace?', 'The whole bracket', ['Only $RL$', 'Only $(NL - DI)$', '$DT$'], 'A recording made after a ping contains reverberation and noise together, at the beam output. It is the masking level.'),
  (r) => {
    const up = r.pick([6, 10])
    return num('u13-sl-rev', `A target lies where reverberation is 20 dB above noise. Source level is raised by **${up} dB**. By how much does signal excess change there?`, 0, 'dB', `Zero, to within a small fraction of a decibel. Echo and reverberation both rise ${up} dB and noise is negligible.`, 0.3)
  },
  (r) => {
    const se = r.pick([-8, -4, 4, 8, 12])
    return num('u13-pd', `A cell has a signal excess of **${se > 0 ? '+' : '−'}${Math.abs(se)} dB**. With σ = 8 dB, what is the probability of detection? Φ(0.5) = 0.69, Φ(1) = 0.84, Φ(1.5) = 0.93.`, normCdf(se / 8) * 100, '%', `$\\Phi(${r2(se / 8)}) = ${r0(normCdf(se / 8) * 100)}$ percent.`, 2.5)
  },
  (r) =>
    mc(r, 'u13-rotd', 'A report gives a single “range of the day” of 14 km. What can that number hide?', 'A convergence zone beyond it, and much shorter range for other target depths', ['The source level', 'The fact that the sonar is active', 'Nothing, if signal excess was computed correctly'], 'A single range is usually the outer edge of the first detection zone for one target depth. Later zones and other depths are not in it.'),
  (r) => {
    const a = r.int(54, 66)
    const d = r.pick([0, 3, 6, 10])
    const ans = powerSumDb([a, a - d])
    return num('u13-oplus', `Beam noise is **${a} dB** and reverberation is **${a - d} dB**. What is the masking level?`, ans, 'dB', `$${a} \\oplus ${a - d} = ${r1(ans)}$ dB, ${r1(ans - a)} dB above the larger.`, 0.3)
  },
  (r) =>
    mc(r, 'u13-fragile', 'Where is a predicted detection range most sensitive to a few decibels of error?', 'Where the loss curve is nearly flat and signal excess stays near zero over a long stretch', ['Where the loss curve is steep', 'Close to the sensor', 'Wherever reverberation is 30 dB above the echo'], 'On a flat curve a small change in level moves the zero crossing a long way in range. On a steep curve it hardly moves.'),
]

export const u14: QuestionGen[] = [
  (r) => {
    const t = r.int(3, 60)
    return num('u14-range', `A monostatic sonar hears an echo **${t} s** after transmitting. What is the range?`, (C * t) / 2000, 'km', `$r = ct/2 = 1500 \\times ${t}/2 = ${r2((C * t) / 2000)}$ km.`, Math.max(0.1, (C * t) / 2000 * 0.02))
  },
  (r) => {
    const km = r.pick([4, 9, 15, 24, 36, 60])
    return num('u14-time', `A target is at **${km} km**. How long after transmission does the echo return?`, (2000 * km) / C, 's', `$t = 2r/c = 2 \\times ${km * 1000}/1500 = ${r1((2000 * km) / C)}$ s.`, 0.3)
  },
  (r) => {
    const tau = r.pick([0.1, 0.5, 1, 2, 4, 8])
    return num('u14-blind', `A sonar transmits a **${tau} s** pulse and cannot listen while sending. What is its blind range?`, (C * tau) / 2, 'm', `$c\\tau/2 = 1500 \\times ${tau}/2 = ${r0((C * tau) / 2)}$ m. This uses the transmitted duration, even for a compressed FM pulse.`, Math.max(2, C * tau * 0.01))
  },
  (r) => {
    const tp = r.pick([10, 20, 30, 45, 60, 90])
    return num('u14-max', `The ping interval is **${tp} s**. What is the farthest range from which an echo returns before the next ping?`, (C * tp) / 2000, 'km', `$cT_p/2 = 1500 \\times ${tp}/2 = ${r1((C * tp) / 2000)}$ km.`, 0.3)
  },
  (r) => {
    const cz = r.int(54, 66)
    return num('u14-cz', `A convergence zone lies at **${cz} km**. What is the shortest ping interval that lets its echoes return before the next transmission?`, (2000 * cz) / C, 's', `$T_p = 2r/c = 2 \\times ${cz * 1000}/1500 = ${r1((2000 * cz) / C)}$ s.`, 1)
  },
  (r) => {
    const v = r.pick([4, 6, 10, 14, 18])
    const f = r.pick([2, 3.5, 5, 8])
    const ans = (2 * v * KNOT_MS * f * 1000) / C
    return num('u14-doppler', `A target’s range is closing at **${v} knots**. The sonar transmits at **${f} kHz**. What is the echo’s Doppler shift? One knot is 0.514 m/s.`, ans, 'Hz', `$2vf/c = 2 \\times ${r2(v * KNOT_MS)} \\times ${f * 1000}/1500 = ${r1(ans)}$ Hz.`, Math.max(0.3, ans * 0.03))
  },
  (r) => {
    const s = r.pick([10, 15, 20])
    const phi = r.pick([0, 40, 60, 90])
    const ans = (2 * s * KNOT_MS * Math.cos(phi * DEG) * 3500) / C
    return num('u14-aspect-doppler', `A **${s}-knot** target’s course makes an angle of **${phi}°** with the line toward a 3.5 kHz sonar. What Doppler shift results? At 3.5 kHz one knot of closing speed is 2.4 Hz.`, ans, 'Hz', `Closing speed $${s} \\cos ${phi}° = ${r1(s * Math.cos(phi * DEG))}$ kn, so ${r1(ans)} Hz.${phi === 90 ? ' A crossing target has no Doppler.' : ''}`, Math.max(0.4, ans * 0.03))
  },
  (r) => {
    const v = r.pick([5, 10, 15, 20])
    const tp = r.pick([20, 30, 60, 90])
    const ans = v * KNOT_MS * tp
    return num('u14-move', `A target moves at **${v} knots**. The ping interval is **${tp} s**. How far does it travel between pings?`, ans, 'm', `$${v} \\times 0.514 \\times ${tp} = ${r0(ans)}$ m.`, ans * 0.03)
  },
  (r) => {
    const rd = r.pick([5, 8, 12, 20])
    const u = r.pick([6, 10, 15])
    const ans = 2 * rd * u * 1.852
    return num('u14-sweep', `A sonar has a detection radius of **${rd} km** while its platform moves at **${u} knots**. Roughly what area does it sweep per hour, using $2 r_d u$? One knot is 1.852 km/h.`, ans, 'km²/h', `$2 \\times ${rd} \\times ${u} \\times 1.852 = ${r0(ans)}$ km² per hour.`, ans * 0.03)
  },
  (r) => {
    const tp = r.pick([20, 30, 40])
    const km = (C * tp) / 2000 + r.pick([3, 6, 9])
    const ans = km - (C * tp) / 2000
    return num('u14-ghost', `The ping interval is **${tp} s**. A strong reflector sits at **${r1(km)} km**, beyond the unambiguous range. At what false range does its echo appear in the next listening period?`, ans, 'km', `Its echo returns after ${r1((2000 * km) / C)} s, which is ${r1((2000 * km) / C - tp)} s into the next cycle, and reads as ${r1(ans)} km.`, 0.2)
  },
  (r) =>
    mc(r, 'u14-circle', 'Under what conditions is a monostatic plan view made of perfect circles?', 'The same ocean, the same noise and the same sensor response on every bearing', ['Whenever signal excess is positive', 'Whenever the sonar is reverberation limited', 'Only in shallow water'], 'Rotation of a single signal excess curve gives rings. Bathymetry, directional noise or an asymmetric array each break the symmetry.'),
  (r) =>
    mc(r, 'u14-limit', 'Which limitation of monostatic sonar does a bistatic receiver directly address?', 'The target is seen from only one aspect', ['Absorption increases with frequency', 'The ping interval limits range', 'The array has sidelobes'], 'A separate receiver views the target from another direction, so an unfavorable aspect for one is not unfavorable for both.'),
  (r) => {
    const t = r.int(6, 40)
    const ans = (C * t) / 2 / KYD_M
    return num('u14-kyd', `An echo returns **${t} s** after the ping. Express the range in kiloyards, using 1 kyd = 914.4 m.`, ans, 'kyd', `$1500 \\times ${t}/2 = ${r0((C * t) / 2)}$ m $= ${r1(ans)}$ kyd.`, Math.max(0.15, ans * 0.02))
  },
]

export const u15: QuestionGen[] = [
  (r) => {
    const rt = r.pick([6, 9, 12, 15])
    const rr = r.pick([4, 8, 10, 14])
    return num('u15-time', `Source to target is **${rt} km** and target to receiver is **${rr} km**. How long after transmission does the echo reach the receiver?`, ((rt + rr) * 1000) / C, 's', `$t = (R_T + R_R)/c = ${(rt + rr) * 1000}/1500 = ${r1(((rt + rr) * 1000) / C)}$ s.`, 0.2)
  },
  (r) => {
    const base = r.pick([8, 12, 16, 20])
    const rt = base * 0.5 + r.pick([4, 6, 9])
    const rr = base * 0.5 + r.pick([3, 5, 8])
    const ans = ((rt + rr - base) * 1000) / C
    return num('u15-after', `Baseline **${base} km**, source to target **${r1(rt)} km**, target to receiver **${r1(rr)} km**. How long after the direct blast does the echo arrive at the receiver?`, ans, 's', `The blast takes $L/c$ and the echo $(R_T + R_R)/c$. The difference is $(${r1(rt)} + ${r1(rr)} - ${base}) \\times 1000/1500 = ${r1(ans)}$ s.`, 0.2)
  },
  (r) => {
    const rt = r.pick([4, 9, 16, 25])
    const rr = r.pick([4, 9, 16])
    return num('u15-eq', `Source to target is **${rt} km** and target to receiver is **${rr} km**. What is the equivalent monostatic range?`, Math.sqrt(rt * rr), 'km', `$\\sqrt{R_T R_R} = \\sqrt{${rt} \\times ${rr}} = ${r1(Math.sqrt(rt * rr))}$ km.`, 0.2)
  },
  (r) => {
    const rt = r.pick([5, 8, 10, 20])
    const rr = r.pick([5, 10, 15])
    const ans = 20 * Math.log10(rt * 1000) + 20 * Math.log10(rr * 1000)
    return num('u15-loss', `With spherical spreading on both legs and no absorption, what is the total out-and-back loss for $R_T = ${rt}$ km and $R_R = ${rr}$ km?`, ans, 'dB', `$20 \\log ${rt * 1000} + 20 \\log ${rr * 1000} = ${r1(20 * Math.log10(rt * 1000))} + ${r1(20 * Math.log10(rr * 1000))} = ${r1(ans)}$ dB.`)
  },
  (r) => {
    const base = r.pick([10, 15, 20])
    const rho = base + r.pick([6, 10, 15])
    const th = r.pick([60, 90, 120])
    const ans = receiverRange(rho, base, th)
    return num('u15-ellipse', `An echo’s total path is **${rho} km** on a baseline of **${base} km**. At the receiver, the echo’s bearing makes an angle of **${th}°** with the direction to the source. Using $R_R = \\dfrac{\\rho^2 - L^2}{2(\\rho - L\\cos\\theta)}$, how far is the target from the receiver?`, ans, 'km', `$\\dfrac{${rho}^2 - ${base}^2}{2(${rho} - ${base}\\cos ${th}°)} = ${r2(ans)}$ km.`, Math.max(0.1, ans * 0.02))
  },
  (r) => {
    const base = r.pick([8, 12, 20])
    const tau = r.pick([0.5, 1, 2, 4])
    return num('u15-blind', `Baseline **${base} km**, pulse length **${tau} s**. Echoes with a total path shorter than what value arrive inside the direct blast?`, base + (C * tau) / 1000, 'km', `$\\rho_{blind} = L + c\\tau = ${base} + ${r2((C * tau) / 1000)} = ${r2(base + (C * tau) / 1000)}$ km.`, 0.15)
  },
  (r) => {
    const s = r.pick([8, 10, 12, 16])
    const delta = r.pick([0, 30, 60])
    const beta = r.pick([0, 60, 90, 120])
    const ans = ((2 * s * KNOT_MS * 3500) / C) * Math.cos(delta * DEG) * Math.cos((beta / 2) * DEG)
    return num('u15-doppler', `A **${s}-knot** target moves at **${delta}°** to the bistatic bisector. The bistatic angle is **${beta}°** and the frequency is 3.5 kHz, where the monostatic rate is 2.4 Hz per knot. Using $\\Delta f = \\frac{2sf}{c}\\cos\\delta\\cos(\\beta/2)$, what is the Doppler shift?`, ans, 'Hz', `$2.4 \\times ${s} \\times \\cos ${delta}° \\times \\cos ${beta / 2}° = ${r1(ans)}$ Hz.`, Math.max(0.4, ans * 0.03))
  },
  (r) => {
    const b = r.pick([200, 400, 800])
    const beta = r.pick([60, 90, 120, 150])
    const ans = bistaticRangeResolutionM(b, beta)
    return num('u15-res', `A **${b} Hz** sweep is used at a bistatic angle of **${beta}°**. Using $\\Delta r = \\dfrac{c}{2B\\cos(\\beta/2)}$, what is the range resolution along the bisector?`, ans, 'm', `$\\dfrac{1500}{2 \\times ${b} \\times \\cos ${beta / 2}°} = ${r2(ans)}$ m, against ${r2(C / (2 * b))} m monostatic.`, Math.max(0.1, ans * 0.03))
  },
  (r) => {
    const base = r.pick([10, 16, 20])
    const h = r.pick([5, 8, 10, 20])
    const ans = (2 * Math.atan(base / 2 / h)) / DEG
    return num('u15-beta', `A target lies on the perpendicular through the middle of a **${base} km** baseline, **${h} km** from it. What is the bistatic angle?`, ans, 'degrees', `Each half subtends $\\arctan(${base / 2}/${h})$, so $\\beta = 2 \\arctan(${r2(base / 2 / h)}) = ${r1(ans)}°$.`, 0.6)
  },
  (r) =>
    mc(r, 'u15-runs', 'How many propagation engine runs does one bistatic pair need, for one band?', 'Two: one centered on the source and one on the receiver', ['One, used twice as in the monostatic case', 'One for every target position', 'Four: out and back for each node'], 'Loss from source to target and from target to receiver are different fields. By reciprocity the second is the loss from the receiver outward, so one run per node suffices.'),
  (r) =>
    mc(r, 'u15-zero', 'In which direction of target motion is bistatic Doppler zero?', 'Across the bisector, along the equal-time ellipse', ['Along the bisector', 'Directly toward the source', 'Directly toward the receiver'], 'Doppler measures the rate of change of total path. Moving along an equal-time ellipse leaves the total path unchanged.'),
  (r) =>
    mc(r, 'u15-forward', 'Where in a bistatic geometry is target strength highest, and what else is true there?', 'On the baseline between source and receiver, which is inside the direct-blast blind zone', ['Far beyond the receiver, where reverberation is lowest', 'At a bistatic angle of 90°, where resolution is best', 'At the source, where the geometry is monostatic'], 'Forward scatter peaks at a bistatic angle of 180°, with the target between the nodes. Echoes from there arrive during the direct blast.'),
  (r) => {
    const base = r.pick([10, 20, 30])
    const tau = r.pick([0.5, 1, 2])
    const ct = (C * tau) / 1000
    const ans = 0.5 * Math.sqrt(2 * base * ct + ct * ct)
    return num('u15-width', `Baseline **${base} km**, pulse **${tau} s**. The blind zone is an ellipse with total path $L + c\\tau$. Its half-width at the middle of the baseline is $\\tfrac{1}{2}\\sqrt{(L + c\\tau)^2 - L^2}$. What is that half-width?`, ans, 'km', `$c\\tau = ${r2(ct)}$ km. $\\tfrac{1}{2}\\sqrt{${r2(base + ct)}^2 - ${base}^2} = ${r2(ans)}$ km either side of the baseline.`, Math.max(0.1, ans * 0.03))
  },
  (r) => {
    const a1 = r.pick([30, 40, 50, 60])
    const a2 = 180 - a1
    return mc(r, 'u15-glint', `The source is at aspect **${a1}°** and the receiver at aspect **${a2}°**. Why might this pair see a very strong echo although neither is on the target’s beam?`, 'Their bisector is the beam, so the hull’s long side reflects the source toward the receiver like a mirror', ['Forward scatter always occurs at these aspects', 'Target strength is independent of aspect in bistatic geometry', 'The direct blast adds to the echo'], `The bisector of ${a1}° and ${a2}° is 90°. That is the specular geometry for the hull’s side.`)
  },
]
