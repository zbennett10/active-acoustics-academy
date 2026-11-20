import { DEG, powerDiffDb, powerSumDb } from '../../lib/db'
import { mc, num, r0, r1, r2 } from './helpers'
import type { QuestionGen } from './types'

const C = 1500

export const u06: QuestionGen[] = [
  (r) =>
    mc(r, 'u06-def', 'What is an eigenray?', 'One of the distinct paths that connect a source to a particular field point', ['Any ray launched from the source', 'The ray with the least loss in the whole field', 'A ray that never touches a boundary'], 'Of all the rays a source emits, only a few pass through a given point. Those are the eigenrays for that source and point.'),
  (r) => {
    const zs = r.pick([50, 100, 200])
    const zt = zs + r.pick([100, 200, 300, 400])
    const rr = r.pick([1000, 2000, 3000, 5000])
    const ans = Math.atan2(zt - zs, rr) / DEG
    return num('u06-launch', `In uniform water a source at **${zs} m** and a target at **${zt} m** are **${rr} m** apart horizontally. With down as positive, what is the launch D/E of the direct path?`, ans, 'degrees', `$\\arctan\\!\\left(\\frac{${zt} - ${zs}}{${rr}}\\right) = ${r2(ans)}°$, pointing down.`, 0.2)
  },
  (r) => {
    const rr = r.pick([3000, 6000, 9000, 12000])
    const dz = r.pick([200, 400, 800])
    const ans = Math.hypot(rr, dz) / C
    return num('u06-time', `A direct path covers **${rr} m** horizontally and **${dz} m** vertically in water at 1500 m/s. What is its one-way travel time?`, ans, 's', `Path length $\\sqrt{${rr}^2 + ${dz}^2} = ${r0(Math.hypot(rr, dz))}$ m, so $t = ${r2(ans)}$ s.`, 0.05)
  },
  (r) => {
    const zs = r.pick([30, 50, 80])
    const zt = r.pick([60, 100, 150])
    const rr = r.pick([1000, 2000, 4000])
    const direct = Math.hypot(rr, zt - zs)
    const surf = Math.hypot(rr, zt + zs)
    const ans = ((surf - direct) / C) * 1000
    return num('u06-spread', `Source at **${zs} m**, receiver at **${zt} m**, **${rr} m** apart in uniform water. The surface-reflected path is as long as a straight line to the mirror image of the source above the surface. How much later than the direct path does it arrive?`, ans, 'ms', `Direct: $\\sqrt{${rr}^2 + ${zt - zs}^2} = ${r1(direct)}$ m. Surface path: $\\sqrt{${rr}^2 + ${zt + zs}^2} = ${r1(surf)}$ m. The difference of ${r2(surf - direct)} m takes ${r2(ans)} ms.`, Math.max(0.15, ans * 0.05))
  },
  (r) => {
    const a = r.int(78, 90)
    const b = a + r.int(0, 8)
    const ans = -10 * Math.log10(Math.pow(10, -a / 10) + Math.pow(10, -b / 10))
    return num('u06-sum', `Two eigenrays reach a point with losses of **${a} dB** and **${b} dB**. What is the incoherent total loss?`, ans, 'dB', `Add the powers that arrive: $-10 \\log(10^{-${a}/10} + 10^{-${b}/10}) = ${r1(ans)}$ dB. Two paths always give less loss than the better one alone.`, 0.3)
  },
  (r) => {
    const out = r.int(2, 6)
    const back = r.int(2, 6)
    return num('u06-combos', `There are **${out}** eigenrays from the sonar to the target and **${back}** from the target back to the receiver. How many out-and-back path combinations can make up the echo?`, out * back, 'combinations', `Any way out can pair with any way back: $${out} \\times ${back} = ${out * back}$.`, 0.1)
  },
  (r) => {
    const tl = r.int(76, 92)
    const pat = r.pick([3, 6, 10, 15, 20])
    return num('u06-beam', `An eigenray has a loss of **${tl} dB**. It arrives **${pat} dB** down on the receive beam pattern. What loss does that path effectively have through this beam?`, tl + pat, 'dB', `The pattern’s rejection adds to the path loss: $${tl} + ${pat} = ${tl + pat}$ dB.`)
  },
  (r) => {
    const item = r.pick([
      { q: 'bottom bounce', a: 'Bottom type and bottom loss' },
      { q: 'surface duct', a: 'Mixed layer depth and sea state' },
      { q: 'convergence zone', a: 'The deep profile and depth excess' },
    ])
    return mc(r, 'u06-family', `A detection is made on a **${item.q}** path. What is that path most sensitive to?`, item.a, ['Bottom type and bottom loss', 'Mixed layer depth and sea state', 'The deep profile and depth excess', 'Volume scattering strength'].filter((x) => x !== item.a).slice(0, 3), 'Each family depends on what it touches. Bottom bounce depends on the seabed, a duct on the layer and the surface, a convergence zone on the deep profile.')
  },
  (r) =>
    mc(r, 'u06-depressed', 'A contact is strong on a beam depressed 20° and absent on the horizontal beam. What does that tell you?', 'It is arriving by bottom bounce, and its true range is somewhat less than displayed', ['It is in the surface duct and the range is accurate', 'The beamformer has failed', 'It is a convergence zone contact and its range is overstated by half'], 'A steep arrival from below is a bottom-bounce path. That path is longer than the horizontal distance, so a straight-line range conversion places the contact too far out.'),
  (r) => {
    const t1 = r.pick([8.0, 12.4, 20.1])
    const dt = r.pick([0.02, 0.05, 0.12, 0.3])
    return num('u06-smear', `The first eigenray to a target arrives one-way at **${t1} s** and the last at **${r2(t1 + dt)} s**. If the echo returns by the same set of paths, the two-way spread is twice that. Over how much range is the echo smeared?`, (C * 2 * dt) / 2, 'm', `Two-way spread is $2 \\times ${dt} = ${r2(2 * dt)}$ s. As range, $c\\,\\Delta t/2 = 1500 \\times ${r2(2 * dt)} / 2 = ${r0(C * dt)}$ m.`, Math.max(2, C * dt * 0.03))
  },
  (r) =>
    mc(r, 'u06-reverb', 'Why does reverberation prediction need eigenrays and not just transmission loss?', 'Scattering strength depends on grazing angle and the beam patterns depend on launch and arrival angle', ['Because reverberation only travels on direct paths', 'Because transmission loss is not defined at the seabed', 'Because eigenrays are faster to compute than loss'], 'Each scattering patch is reached at some grazing angle, through beams at particular angles. Loss alone has thrown that information away.'),
  (r) =>
    mc(r, 'u06-twice', 'An engine returns a loss field with the transmit beam pattern already applied at launch. Downstream code applies the same pattern again. What is the symptom?', 'Loss too high away from the beam axis, correct on the axis', ['Loss too low everywhere by a constant', 'No effect, since patterns are normalized', 'The field is mirrored top to bottom'], 'On the axis the pattern is 0 dB, so nothing changes. Off the axis the rejection is counted twice.'),
  (r) => {
    const rr = r.pick([8, 10, 12, 16])
    const h = r.pick([3, 4, 5])
    const ans = 2 * Math.hypot(rr / 2, h)
    return num('u06-bias', `Sonar and target are both near the surface, **${rr} km** apart, in water **${h} km** deep. The echo travels by one bottom bounce each way. The sonar converts echo time to range assuming a straight path. What range does it report?`, ans, 'km', `Each leg goes down to the seabed and up: $2\\sqrt{(${rr}/2)^2 + ${h}^2} = ${r1(ans)}$ km, against a true ${rr} km.`, ans * 0.02)
  },
  (r) => {
    const travel = r.next() < 0.5
    return mc(r, 'u06-direction', `An eigenray table lists an arrival angle of +12° in a down-positive convention, as **${travel ? 'direction of travel' : 'direction of look'}**. Where must an up-positive receive beam point to accept it?`, travel ? '+12°, up' : '−12°, down', [travel ? '−12°, down' : '+12°, up', '0°', 'It cannot be determined from one angle'], travel ? 'Travelling at +12° down-positive means moving downward, so it came from above. The receiver looks up: +12° in an up-positive convention. Two sign changes, travel to look and down-positive to up-positive, cancel.' : 'It is already a look direction, 12° down. In an up-positive convention that is −12°. One sign change.')
  },
]

export const u07: QuestionGen[] = [
  (r) => {
    const f = r.pick([0.5, 1, 2, 3, 5, 7.5])
    return num('u07-lambda', `What is the wavelength at **${f} kHz** in water at 1500 m/s?`, C / (f * 1000), 'm', `$\\lambda = c/f = 1500/${f * 1000} = ${r2(C / (f * 1000))}$ m.`, Math.max(0.01, (C / (f * 1000)) * 0.02))
  },
  (r) => {
    const n = r.pick([8, 16, 24, 32, 48, 64, 100])
    return num('u07-di-n', `A line array has **${n}** hydrophones at half-wavelength spacing. What is its directivity index?`, 10 * Math.log10(n), 'dB', `$DI = 10 \\log N = 10 \\log ${n} = ${r1(10 * Math.log10(n))}$ dB.`, 0.3)
  },
  (r) => {
    const f = r.pick([1, 2, 3, 5])
    const len = r.pick([2, 4, 8, 16, 30])
    const ans = (51 * (C / (f * 1000))) / len
    return num('u07-bw', `A line array **${len} m** long works at **${f} kHz**. Using beamwidth ≈ 51° × λ / L, how wide is its broadside beam?`, ans, 'degrees', `$\\lambda = ${r2(C / (f * 1000))}$ m, so $51 \\times ${r2(C / (f * 1000))} / ${len} = ${r2(ans)}°$.`, Math.max(0.1, ans * 0.04))
  },
  (r) => {
    const f = r.pick([0.5, 1, 2, 3.5])
    const len = r.pick([10, 20, 50, 100])
    const lambda = C / (f * 1000)
    const ans = 10 * Math.log10((2 * len) / lambda)
    return num('u07-di-l', `A line array **${len} m** long works at **${f} kHz**. Using $DI = 10 \\log(2L/\\lambda)$, what is its directivity index?`, ans, 'dB', `$\\lambda = ${r2(lambda)}$ m, so $10 \\log(${2 * len}/${r2(lambda)}) = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const bw = r.pick([2, 5, 8, 10, 15])
    const km = r.pick([5, 10, 20, 40])
    const ans = km * bw * DEG
    return num('u07-cross', `A beam **${bw}°** wide looks at a range of **${km} km**. How wide is the cell across the beam?`, ans, 'km', `Width is range times angle in radians: $${km} \\times ${bw} \\times \\pi/180 = ${r2(ans)}$ km.`, Math.max(0.02, ans * 0.03))
  },
  (r) => {
    const p = r.pick([100, 500, 1000, 5000, 10000])
    const di = r.pick([0, 6, 10, 15, 20])
    const ans = 171 + 10 * Math.log10(p) + di
    return num('u07-sl', `A projector radiates **${p} W** of acoustic power with a transmit directivity index of **${di} dB**. Using $SL = 171 + 10 \\log P + DI_T$, what is its source level?`, ans, 'dB re 1 µPa at 1 m', `$171 + ${r1(10 * Math.log10(p))} + ${di} = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const bw = r.pick([4, 6, 8, 10])
    const steer = r.pick([30, 45, 60])
    const ans = bw / Math.cos(steer * DEG)
    return num('u07-steer', `A line array’s beam is **${bw}°** wide at broadside. Roughly how wide is it when steered **${steer}°** off broadside?`, ans, 'degrees', `The array looks shorter by $\\cos ${steer}°$, so the beam widens to $${bw}/\\cos ${steer}° = ${r1(ans)}°$.`, Math.max(0.2, ans * 0.03))
  },
  (r) => {
    const d = r.pick([0.1, 0.2, 0.25, 0.5, 0.75])
    const ans = C / (2 * d)
    return num('u07-grating', `An array’s hydrophones are **${d} m** apart. To steer to endfire with no grating lobes, spacing must not exceed half a wavelength. What is the highest usable frequency?`, ans, 'Hz', `$d = \\lambda/2$ gives $f = c/(2d) = 1500/(2 \\times ${d}) = ${r0(ans)}$ Hz.`, ans * 0.02)
  },
  (r) => {
    const above = r.int(32, 45)
    const sl = r.pick([13, 25, 30])
    return num('u07-sidelobe', `A ship is **${above} dB** above the background on the beam pointed at it. On another beam it falls in a sidelobe **${sl} dB** down. How far above background does it appear on that beam?`, above - sl, 'dB', `$${above} - ${sl} = ${above - sl}$ dB. ${above - sl > 0 ? 'It is still visible on a beam that is not looking at it.' : 'It is pushed below the background.'}`, 0.2)
  },
  (r) =>
    mc(r, 'u07-di-ag', 'What is the difference between directivity index and array gain?', 'Directivity index assumes isotropic noise and a perfectly coherent signal. Array gain is what is achieved in the real noise field', ['They are two names for the same number', 'Array gain applies on transmit and directivity index on receive', 'Directivity index includes processing gain and array gain does not'], 'DI is a property of the array alone. Array gain depends on the actual directionality of the noise and the coherence of the signal.'),
  (r) =>
    mc(r, 'u07-shading', 'What does shading a line array do?', 'Lowers the sidelobes at the cost of a wider main lobe and a little gain', ['Narrows the main lobe and raises the sidelobes', 'Removes grating lobes', 'Steers the beam toward endfire'], 'Tapering the weights toward the ends trades main lobe width for sidelobe suppression.'),
  (r) => {
    const h = r.int(0, 35) * 10
    const rel = r.pick([20, 45, 90, 135, 270, 315])
    return num('u07-beam-bearing', `Beam 9 of a hull array points at relative bearing **${String(rel).padStart(3, '0')} °R**. A noise measurement was taken on it while the ship headed **${String(h).padStart(3, '0')} °T**. Along what true bearing was that beam looking?`, (h + rel) % 360, '°T', `Heading at the time plus relative bearing, modulo 360: ${(h + rel) % 360}.`, 0.5)
  },
  (r) =>
    mc(r, 'u07-cone', 'Why does a single horizontal line array have a left-right ambiguity?', 'Every direction at the same angle to the array’s axis gives the same delays, so each beam is a cone', ['Its hydrophones are omnidirectional in frequency', 'Its sidelobes are too high', 'It is steered mechanically'], 'A line array measures only the angle from its own axis. Port and starboard at that angle are indistinguishable without a turn or a second line.'),
  (r) => {
    const from = r.pick([20, 16, 12])
    const to = from / r.pick([2, 4])
    const ans = 10 * Math.log10(to / from)
    return num('u07-reverb', `A receive beam is narrowed from **${from}°** to **${to}°**. By how much does bottom reverberation in that beam change?`, ans, 'dB', `The scattering strip is as wide as the beam, so reverberation changes by $10 \\log(${to}/${from}) = ${r1(ans)}$ dB.`, 0.3)
  },
]

export const u08: QuestionGen[] = [
  (r) => {
    const a = r.pick([0.5, 1, 2, 4, 6, 10])
    const ans = 10 * Math.log10((a * a) / 4)
    return num('u08-sphere', `What is the target strength of a large rigid sphere of radius **${a} m**?`, ans, 'dB', `$TS = 10 \\log(a^2/4) = 10 \\log(${r2((a * a) / 4)}) = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const a = r.pick([2, 3, 4, 5])
    const len = r.pick([8, 10, 15, 20])
    const f = r.pick([2, 3, 5])
    const lambda = C / (f * 1000)
    const ans = 10 * Math.log10((a * len * len) / (2 * lambda))
    return num('u08-cyl', `A rigid cylinder of radius **${a} m** and length **${len} m** is seen broadside at **${f} kHz**. Using $TS = 10 \\log(aL^2/2\\lambda)$, what is its target strength?`, ans, 'dB', `$\\lambda = ${r2(lambda)}$ m. $10 \\log(${a} \\times ${len * len} / ${r2(2 * lambda)}) = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const area = r.pick([2, 5, 10, 20, 40])
    const f = r.pick([2, 3, 5, 7.5])
    const lambda = C / (f * 1000)
    const ans = 20 * Math.log10(area / lambda)
    return num('u08-plate', `A flat plate of area **${area} m²** is struck face-on at **${f} kHz**. Using $TS = 20 \\log(A/\\lambda)$, what is its target strength?`, ans, 'dB', `$\\lambda = ${r2(lambda)}$ m. $20 \\log(${area}/${r2(lambda)}) = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const len = r.pick([50, 60, 80, 100])
    const dia = r.pick([6, 8, 10])
    const f = r.pick([1, 2, 3])
    const lambda = C / (f * 1000)
    const ans = 20 * Math.log10((len * dia) / lambda)
    return num('u08-forward', `A hull presents a silhouette of **${len} m by ${dia} m** to a source at **${f} kHz**. What is its forward-scatter target strength, $20 \\log(A/\\lambda)$?`, ans, 'dB', `$A = ${len * dia}$ m² and $\\lambda = ${r2(lambda)}$ m, so $20 \\log(${len * dia}/${r2(lambda)}) = ${r1(ans)}$ dB. Far above any backscatter value, and hidden by the direct blast.`, 0.4)
  },
  (r) => {
    const len = r.pick([60, 80, 100])
    const asp = r.pick([0, 30, 45, 60])
    const ans = ((2 * len * Math.abs(Math.cos(asp * DEG))) / C) * 1000
    return num('u08-length', `A hull **${len} m** long is seen at an aspect of **${asp}°** off the bow. Its highlights spread over a range extent of $L \\cos\\theta$. How long does the echo last beyond the pulse itself?`, ans, 'ms', `Range extent $${len} \\times \\cos ${asp}° = ${r1(len * Math.cos(asp * DEG))}$ m. Two-way time $2 \\times ${r1(len * Math.cos(asp * DEG))}/1500 = ${r1(ans)}$ ms.`, Math.max(1, ans * 0.03))
  },
  (r) => {
    const item = r.pick([
      { a: 0.01, f: 3, regime: 'Rayleigh' },
      { a: 0.05, f: 12, regime: 'Resonance' },
      { a: 4, f: 3.5, regime: 'Geometric' },
      { a: 0.2, f: 5, regime: 'Resonance' },
      { a: 0.005, f: 2, regime: 'Rayleigh' },
    ])
    const ka = ((2 * Math.PI * item.f * 1000) / C) * item.a
    return mc(r, 'u08-ka', `A body with a typical dimension of **${item.a} m** is struck at **${item.f} kHz**. With $k = 2\\pi f/c$, which scattering regime is it in?`, item.regime, ['Rayleigh', 'Resonance', 'Geometric'].filter((x) => x !== item.regime), `$ka = ${r2(ka)}$. Well below 1 is Rayleigh, around 1 to 10 is resonance, well above 10 is geometric.`)
  },
  (r) => {
    const a1 = r.pick([40, 50, 60, 70, 80])
    const a2 = a1 + r.pick([20, 40, 60])
    return num('u08-bisector', `In a bistatic geometry the source is at aspect **${a1}°** and the receiver at aspect **${a2}°**. Under the bisector rule, at what monostatic aspect do you look up target strength?`, (a1 + a2) / 2, 'degrees', `The bisector of ${a1}° and ${a2}° is ${(a1 + a2) / 2}°.`, 0.3)
  },
  (r) => {
    const a1 = r.int(1, 17) * 10
    const beta = r.pick([20, 40, 60, 90, 120])
    return num('u08-beta', `Source aspect is **${a1}°** and receiver aspect is **${a1 + beta}°**. What is the bistatic angle?`, beta, 'degrees', `The bistatic angle is the angle between the two directions at the target: $${a1 + beta} - ${a1} = ${beta}°$.`, 0.3)
  },
  (r) => {
    const a = r.pick([40, 50, 60, 70, 110, 130])
    return num('u08-mirror', `The long side of a hull reflects like a mirror. A source is at aspect **${a}°**. Toward which aspect does the specular reflection go?`, 180 - a, 'degrees', `The mirror direction is symmetric about the beam at 90°: $180 - ${a} = ${180 - a}°$. A receiver there sees a beam-aspect return.`, 0.3)
  },
  (r) =>
    mc(r, 'u08-positive', 'A submarine’s target strength is quoted as +25 dB. How can it be positive?', 'The echo is referred to one meter from the target’s center, a point inside a body far larger than one meter', ['The hull amplifies the incident sound', 'Target strength is measured in a different reference than source level', 'Positive values mean the target is radiating its own noise'], 'It is a bookkeeping reference. The target returns less power than strikes it. Referred back to one meter, the echo of a large body exceeds the incident intensity.'),
  (r) => {
    const beam = r.pick([22, 25, 27])
    const bow = r.pick([8, 10, 12])
    return num('u08-turn', `A target turns from beam aspect, **${beam} dB**, to bow aspect, **${bow} dB**. Everything else stays the same. By how much does signal excess change?`, bow - beam, 'dB', `Signal excess follows target strength decibel for decibel: $${bow} - ${beam} = ${bow - beam}$ dB.`, 0.2)
  },
  (r) =>
    mc(r, 'u08-fwd-use', 'Forward scatter gives the highest target strength a target has. Why is it rarely usable?', 'The echo arrives at nearly the same time and direction as the far stronger direct blast', ['It only occurs at very low frequency', 'It requires a monostatic geometry', 'The target absorbs sound in that direction'], 'In the forward-scatter geometry the target lies between source and receiver, inside the blind zone of the direct transmission.'),
  (r) =>
    mc(r, 'u08-aspect', 'Why is target strength usually the least certain term in a prediction made in advance?', 'It depends on the target’s aspect, which the target chooses and the predictor must assume', ['It is not affected by frequency', 'It cannot be measured at sea', 'It changes with source level'], 'Aspect alone moves target strength by 10 to 15 dB, and it follows the target’s heading, which is unknown.'),
  (r) => {
    const len = r.pick([10, 15, 20, 30])
    const f = r.pick([2, 3.5, 5])
    const ans = C / (f * 1000) / len / DEG
    return num('u08-lobe', `A straight hull section **${len} m** long reflects at **${f} kHz**. Its mirror-like return has an angular width of about $\\lambda/L$ radians. How wide is that in degrees?`, ans, 'degrees', `$\\lambda = ${r2(C / (f * 1000))}$ m. $${r2(C / (f * 1000))}/${len} = ${(C / (f * 1000) / len).toFixed(4)}$ rad $= ${r2(ans)}°$.`, Math.max(0.05, ans * 0.05))
  },
]

export const u09: QuestionGen[] = [
  (r) => {
    const nsl = r.int(50, 68)
    const b = r.pick([100, 200, 400, 800])
    const ans = nsl + 10 * Math.log10(b)
    return num('u09-band', `Ambient spectrum level at a processor’s center frequency is **${nsl} dB re 1 µPa²/Hz**. Its band is **${b} Hz**. What is the ambient band level?`, ans, 'dB', `$${nsl} + 10 \\log ${b} = ${r1(ans)}$ dB re 1 µPa.`, 0.3)
  },
  (r) => {
    const nsl = r.int(50, 68)
    const b = r.pick([100, 200, 400])
    const di = r.pick([12, 15, 18, 20, 24])
    const ans = nsl + 10 * Math.log10(b) - di
    return num('u09-beam', `Spectrum level **${nsl} dB re 1 µPa²/Hz**, band **${b} Hz**, directivity index **${di} dB**. Treating the noise as isotropic, what is the noise at the beam output?`, ans, 'dB', `$${nsl} + 10 \\log ${b} - ${di} = ${r1(ans)}$ dB re 1 µPa.`, 0.3)
  },
  (r) => {
    const amb = r.int(56, 66)
    const self = amb + r.int(-6, 6)
    const ans = powerSumDb([amb, self])
    return num('u09-self', `At a beam output, ambient noise is **${amb} dB** and self noise is **${self} dB**. What is the total noise?`, ans, 'dB', `Power sum: $${amb} \\oplus ${self} = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const m = r.int(58, 70)
    const di = r.pick([15, 18, 20, 22])
    return num('u09-double', `A sonar reports **measured beam noise of ${m} dB** in the processor band. The array’s directivity index is **${di} dB**. What noise value goes into the sonar equation for that beam?`, m, 'dB', `${m} dB, unchanged. The measurement was taken at the beam output and already contains the array’s gain. Subtracting ${di} dB again would count it twice.`, 0.2)
  },
  (r) => {
    const b1 = r.pick([100, 200])
    const b2 = b1 * r.pick([2, 4, 8])
    const m = r.int(58, 68)
    const ans = m + 10 * Math.log10(b2 / b1)
    return num('u09-rescale', `Beam noise of **${m} dB** was measured in a **${b1} Hz** band. A second processor on the same beam has a **${b2} Hz** band. Assuming a flat spectrum, what noise should it use?`, ans, 'dB', `Scale by the ratio of bandwidths: $${m} + 10 \\log(${b2}/${b1}) = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const item = r.pick([
      { f: '100 Hz', a: 'Distant shipping' },
      { f: '5 kHz', a: 'Wind and waves' },
      { f: '100 kHz', a: 'Thermal agitation of the water' },
    ])
    return mc(r, 'u09-source', `Which source usually dominates ambient noise at **${item.f}** in the open ocean?`, item.a, ['Distant shipping', 'Wind and waves', 'Thermal agitation of the water', 'Seismic activity'].filter((x) => x !== item.a).slice(0, 3), 'Shipping dominates from tens to a few hundred hertz, wind from there to tens of kilohertz, and thermal noise above about 50 kHz.')
  },
  (r) => {
    const bg = r.int(56, 64)
    const ship = r.int(80, 95)
    const sl = r.pick([20, 25, 30])
    const ans = powerSumDb([bg, ship - sl])
    return num('u09-interferer', `A beam’s background noise is **${bg} dB**. A ship that would read **${ship} dB** on a beam aimed at it sits in this beam’s sidelobe, **${sl} dB** down. What does this beam measure?`, ans, 'dB', `The ship contributes $${ship} - ${sl} = ${ship - sl}$ dB through the sidelobe. Power-summed with ${bg} dB: ${r1(ans)} dB.`, 0.3)
  },
  (r) =>
    mc(r, 'u09-selfnoise', 'Two different ships operate in the same water at the same time. Which statement is right?', 'They share the same ambient noise and have different self noise', ['They share the same self noise and have different ambient noise', 'Both terms are identical for the two ships', 'Self noise depends only on wind speed'], 'Ambient noise belongs to the sea. Self noise belongs to the platform and its speed.'),
  (r) => {
    const noise = r.next() < 0.5
    return mc(r, 'u09-limited', `A sonar is **${noise ? 'noise' : 'reverberation'}** limited at the range of interest. Which change helps most?`, noise ? 'More source level or a longer pulse' : 'A wider-band waveform or a narrower beam', [noise ? 'A wider-band waveform with the same energy' : 'More source level', 'A higher detection threshold', 'A wider receive beam'], 'Against noise, energy helps. Against reverberation, energy does nothing and resolution does.')
  },
  (r) => {
    const then = r.int(0, 35) * 10
    const now = (then + r.pick([40, 90, 130, 180])) % 360
    const rel = r.pick([30, 60, 90, 300])
    return num('u09-heading', `Beam noise was measured while the ship headed **${String(then).padStart(3, '0')} °T**. A noisy beam was at **${String(rel).padStart(3, '0')} °R**. The ship has since turned to **${String(now).padStart(3, '0')} °T**. On what true bearing should that noise be drawn?`, (then + rel) % 360, '°T', `Use the heading at the time of measurement: $${then} + ${rel} = ${(then + rel) % 360}$ °T. The ship that made the noise did not turn with you.`, 0.5)
  },
  (r) =>
    mc(r, 'u09-when', 'When in the ping cycle should beam noise be measured?', 'Before a ping, or late in the cycle after reverberation has decayed', ['Immediately after the ping', 'During the transmission', 'At the moment the echo arrives'], 'A sample taken while reverberation is still above the noise is a reverberation measurement, not a noise measurement.'),
  (r) => {
    const at1 = r.int(58, 72)
    return num('u09-slope', `In the wind-driven region the spectrum falls about **17 dB per decade**. The spectrum level at 1 kHz is **${at1} dB**. Estimate it at 10 kHz.`, at1 - 17, 'dB re 1 µPa²/Hz', `One decade higher is 17 dB lower: ${at1 - 17} dB.`, 1)
  },
  (r) =>
    mc(r, 'u09-circle', 'A noise-limited plan view is a perfect circle. What does that suggest about how it was made?', 'Isotropic modeled noise in a range-independent ocean', ['Measured beam noise with a ship nearby', 'An adaptive beamformer', 'A bistatic geometry'], 'Real noise differs by bearing, so real noise-limited coverage is lopsided. A circle means the same noise and the same ocean were used on every bearing.'),
]

export const u10: QuestionGen[] = [
  (r) => {
    const mu = r.pick([-35, -30, -27, -22, -18])
    const th = r.pick([5, 10, 15, 20, 30])
    const ans = mu + 20 * Math.log10(Math.sin(th * DEG))
    return num('u10-lambert', `A bottom has $10 \\log \\mu = ${mu}$ dB. Using Lambert’s law for backscatter, $S_b = 10\\log\\mu + 20 \\log \\sin\\theta$, what is the scattering strength at a grazing angle of **${th}°**?`, ans, 'dB', `$20 \\log \\sin ${th}° = ${r1(20 * Math.log10(Math.sin(th * DEG)))}$ dB, so $S_b = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const tau = r.pick([0.05, 0.1, 0.5, 1])
    const phi = r.pick([5, 10, 20])
    const km = r.pick([2, 5, 10, 20])
    const area = ((C * tau) / 2) * (phi * DEG) * km * 1000
    return num('u10-area', `Pulse length **${tau} s**, beamwidth **${phi}°**, range **${km} km**. Using $A = \\frac{c\\tau}{2}\\,\\Phi\\,r$ with $\\Phi$ in radians, what is $10 \\log A$?`, 10 * Math.log10(area), 'dB re 1 m²', `$A = ${r0((C * tau) / 2)} \\times ${(phi * DEG).toFixed(3)} \\times ${km * 1000} = ${r0(area)}$ m², which is ${r1(10 * Math.log10(area))} dB.`, 0.3)
  },
  (r) => {
    const sl = r.int(210, 225)
    const tl = r.int(65, 80)
    const s = r.pick([-45, -40, -35, -30])
    const a = r.pick([40, 45, 50, 55])
    return num('u10-rl', `Source level **${sl} dB**, one-way loss to the scattering patch **${tl} dB**, scattering strength **${s} dB**, and $10 \\log A = ${a}$ dB. What is the reverberation level?`, sl - 2 * tl + s + a, 'dB', `$RL = SL - 2TL + S + 10\\log A = ${sl} - ${2 * tl} ${s} + ${a} = ${sl - 2 * tl + s + a}$ dB.`)
  },
  (r) => {
    const t = r.pick([0.5, 1, 2])
    const b = r.pick([100, 200, 400, 1000])
    const ans = 10 * Math.log10(t * b)
    return num('u10-fm', `A **${t} s** CW pulse is replaced by a **${t} s** FM sweep of **${b} Hz**, matched filtered. The effective pulse length becomes $1/B$. By how much does reverberation fall?`, ans, 'dB', `Effective length goes from ${t} s to ${r2(1000 / b)} ms. $10 \\log(${t} \\times ${b}) = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const t1 = r.pick([0.1, 0.2, 0.5])
    const t2 = t1 * r.pick([2, 4, 10])
    const ans = 10 * Math.log10(t2 / t1)
    return num('u10-tau', `A CW pulse is lengthened from **${t1} s** to **${r2(t2)} s** at the same source level. By how much does reverberation level change?`, ans, 'dB', `Reverberation is proportional to pulse length: $10 \\log(${r2(t2)}/${t1}) = +${r1(ans)}$ dB.`, 0.3)
  },
  (r) =>
    mc(r, 'u10-sl', 'A sonar is reverberation limited against a target at 5 km. Source level is raised by 10 dB. What happens to signal excess there?', 'Nothing, to a first approximation', ['It rises by 10 dB', 'It rises by 20 dB', 'It falls by 10 dB'], 'Echo and reverberation both rise by 10 dB. Their ratio, which sets detection, does not change.'),
  (r) => {
    const r1km = r.pick([2, 4, 5])
    const k = r.pick([2, 4, 10])
    const ans = -30 * Math.log10(k)
    return num('u10-decay', `With simple spreading, boundary reverberation falls as $30 \\log r$. By how much does it change between **${r1km} km** and **${r1km * k} km**?`, ans, 'dB', `$-30 \\log(${k}) = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const k = r.pick([2, 4, 8])
    const ans = -10 * Math.log10(k)
    return num('u10-margin', `An echo falls as $40 \\log r$ and boundary reverberation as $30 \\log r$. If a target’s range increases by a factor of **${k}**, how does the echo-to-reverberation ratio change?`, ans, 'dB', `The difference in slopes is $10 \\log r$: $-10 \\log ${k} = ${r1(ans)}$ dB. The echo loses ground slowly as range grows.`, 0.3)
  },
  (r) => {
    const rl = r.int(60, 80)
    const dsl = r.pick([-6, 3, 6, 10])
    const ratio = r.pick([0.5, 2, 4])
    const ans = rl + dsl + 10 * Math.log10(ratio)
    return num('u10-rescale', `Measured reverberation, with noise already removed, is **${rl} dB** at some range. The next ping changes source level by **${dsl > 0 ? '+' : '−'}${Math.abs(dsl)} dB** and uses a pulse **${ratio}** times as long. What reverberation should be expected at that range?`, ans, 'dB', `$RL_{new} = ${rl} ${dsl >= 0 ? '+' : '−'} ${Math.abs(dsl)} + 10 \\log ${ratio} = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const noise = r.int(55, 65)
    const meas = noise + r.int(2, 8)
    const ans = powerDiffDb(meas, noise)
    return num('u10-remove', `A measured reverberation curve reads **${meas} dB** at some range. Beam noise is **${noise} dB**. What is the reverberation alone?`, ans, 'dB', `Measured reverberation includes noise. Subtract in power: ${r1(ans)} dB.`, 0.3)
  },
  (r) => {
    const item = r.pick([
      { q: 'has the same shape as the model and sits a constant 7 dB above it', a: 'Scattering strength in the model is too low' },
      { q: 'agrees with the model early, then flattens while the model keeps falling', a: 'The measurement has reached the noise floor' },
      { q: 'shows sharp bumps at the same ranges on every ping', a: 'Clutter or bathymetric features' },
      { q: 'decays noticeably faster than the model', a: 'Real loss is higher than modeled' },
    ])
    return mc(r, 'u10-diagnose', `A measured reverberation curve ${item.q}. What is the most likely explanation?`, item.a, ['Scattering strength in the model is too low', 'The measurement has reached the noise floor', 'Clutter or bathymetric features', 'Real loss is higher than modeled'].filter((x) => x !== item.a), 'A flat offset points to level, usually scattering strength. A slope difference points to loss. A late flat tail is noise. Repeating bumps are discrete scatterers.')
  },
  (r) =>
    mc(r, 'u10-replace', 'Measured reverberation is used directly in the sonar equation. What does it replace?', 'The whole masking term, since it already includes noise', ['Only the modeled reverberation, with modeled noise added on top', 'The transmission loss', 'The detection threshold'], 'What the sonar records after a ping is reverberation plus noise. Adding noise again would count it twice.'),
  (r) => {
    const item = r.pick([
      { q: 'source level is raised', a: 'Outward, to longer range' },
      { q: 'the waveform is changed to one with a much shorter effective pulse', a: 'Inward, to shorter range' },
      { q: 'ambient noise rises', a: 'Inward, to shorter range' },
      { q: 'the bottom is rougher than expected', a: 'Outward, to longer range' },
    ])
    return mc(r, 'u10-crossover', `The crossover is where falling reverberation meets the noise floor. Which way does it move if ${item.q}?`, item.a, [item.a.startsWith('Out') ? 'Inward, to shorter range' : 'Outward, to longer range', 'It does not move', 'It disappears'], 'Anything that raises reverberation relative to noise pushes the crossover out. Anything that lowers it, or raises noise, pulls it in.')
  },
  (r) => {
    const t = r.int(4, 40)
    return num('u10-time', `A feature appears in a monostatic sonar’s measured reverberation **${t} s** after the ping. At what range is it, at 1500 m/s on a direct path?`, (C * t) / 2000, 'km', `$r = ct/2 = 1500 \\times ${t}/2 = ${r1((C * t) / 2000)}$ km.`, 0.2)
  },
]
