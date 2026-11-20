import { simpleTlDb } from '../../lib/absorption'
import { DEG, KYD_M, NMI_M, powerDiffDb, powerSumDb } from '../../lib/db'
import { medwinSoundSpeed } from '../../lib/ssp'
import { mc, num, r0, r1, r2 } from './helpers'
import type { QuestionGen } from './types'

const C = 1500

export const u01: QuestionGen[] = [
  (r) => {
    const sl = r.int(210, 228)
    const tl = r.int(70, 88)
    const ts = r.int(5, 25)
    return num('u01-echo', `A sonar pings at a source level of **${sl} dB**. One-way transmission loss to the target is **${tl} dB** and the target strength is **${ts} dB**. What echo level arrives back at the sonar?`, sl - 2 * tl + ts, 'dB', `Echo level is $SL - TL_{out} - TL_{back} + TS = ${sl} - ${tl} - ${tl} + ${ts} = ${sl - 2 * tl + ts}$ dB. Loss is paid twice.`)
  },
  (r) => {
    const up = r.pick([3, 6, 10])
    return mc(r, 'u01-sl-reverb', `An operator raises source level by **${up} dB**. The sonar is reverberation limited at the range of interest. What happens to the echo-to-reverberation ratio there?`, 'It does not change', [`It improves by ${up} dB`, `It improves by ${2 * up} dB`, `It gets worse by ${up} dB`], 'Reverberation is made by the ping. Raise the source level and the echo and the reverberation rise by the same amount, so their ratio is unchanged.')
  },
  (r) =>
    mc(r, 'u01-three', 'Which of these does **not** change when the sonar pings louder?', 'Ambient noise', ['Echo level', 'Bottom reverberation', 'Surface reverberation'], 'Noise is there whether or not the sonar transmits. Echo and all kinds of reverberation scale with source level.'),
  (r) => {
    const t = r.int(4, 40)
    return num('u01-time', `An echo returns **${t} s** after a monostatic sonar transmits. Taking sound speed as 1500 m/s, how far away is the target?`, (C * t) / 2000, 'km', `The sound went out and back, so range is $ct/2 = 1500 \\times ${t} / 2 = ${r1((C * t) / 2)}$ m.`, 0.2)
  },
  (r) =>
    mc(r, 'u01-se0', 'A cell on a prediction shows a signal excess of exactly **0 dB**. What does that mean?', 'Detection there is a 50 percent proposition', ['Detection there is impossible', 'Detection there is certain', 'The echo level there is 0 dB'], 'Zero signal excess means the echo is exactly at the detection threshold, which by convention is a 50 percent probability of detection.'),
  (r) =>
    mc(r, 'u01-reverb-def', 'What is reverberation?', 'Sound from the sonar’s own ping scattered back by the surface, the seabed and the water', ['Noise radiated by distant shipping', 'The echo from the target arriving by more than one path', 'Noise made by the sonar platform’s machinery'], 'Reverberation is the ocean’s answer to the ping: the sum of small returns from every scatterer the ping reaches.'),
  (r) => {
    const cases = [
      { text: 'A frigate pings with its hull sonar and listens on the same array.', a: 'Monostatic' },
      { text: 'A ship pings while a helicopter’s dipping sonar 12 km away listens for the echoes.', a: 'Bistatic' },
      { text: 'Two source buoys ping in turn while eight receiver buoys all listen.', a: 'Multistatic' },
      { text: 'A towed source on one ship is heard by a towed array on a second ship.', a: 'Bistatic' },
    ]
    const c = r.pick(cases)
    return mc(r, 'u01-geometry', `${c.text} Which geometry is this?`, c.a, ['Monostatic', 'Bistatic', 'Multistatic'].filter((x) => x !== c.a), 'Monostatic: source and receiver together. Bistatic: one source and one receiver apart. Multistatic: several sources or receivers, every pairing a bistatic problem.')
  },
  (r) => {
    const proc = r.pick(['Bandwidth and pulse length', 'Detection threshold', 'Waveform and center frequency'])
    return mc(r, 'u01-sensor-proc', 'Which of these belongs to a **processor** and not to the sensor as a whole?', proc, ['Position and depth', 'Array geometry', 'Platform heading'], 'The sensor fixes the geometry: where the array is and how it is built. Each processor on that sensor has its own band, waveform and threshold.')
  },
  (r) => {
    const late = r.next() < 0.5
    return mc(r, 'u01-limit', `${late ? 'Late' : 'Early'} in the listening period after a ping, what usually limits detection?`, late ? 'Noise' : 'Reverberation', [late ? 'Reverberation' : 'Noise', 'Target strength', 'The detection threshold'], 'Reverberation is strongest just after the ping and decays. Noise is constant. Early on the echo competes with reverberation, late on with noise.')
  },
  (r) => {
    const el = r.int(62, 84)
    const mask = r.int(50, 66)
    const dt = r.int(6, 14)
    return num('u01-se', `At a target’s range the echo level is **${el} dB**, the masking level is **${mask} dB** and the detection threshold is **${dt} dB**. What is the signal excess?`, el - mask - dt, 'dB', `$SE = EL - M - DT = ${el} - ${mask} - ${dt} = ${el - mask - dt}$ dB.`)
  },
  (r) =>
    mc(r, 'u01-mbn', 'What is measured beam noise?', 'The noise level observed at each beam output, in a processor’s band, when no echo or reverberation is present', ['A model’s estimate of ambient noise from wind speed', 'The level of reverberation on each beam after a ping', 'The noise spectrum level at a single hydrophone'], 'Measured beam noise is an observation made by the sonar itself: per sensor, per processor, per beam, taken when only noise is present.'),
  (r) => {
    const ff = r.next() < 0.5
    return mc(r, 'u01-products', `What does a **${ff ? 'full-field' : 'plan view'}** display show?`, ff ? 'Range against depth along one bearing' : 'Bearing against range at one target depth', [ff ? 'Bearing against range at one target depth' : 'Range against depth along one bearing', 'Level against time on one beam', 'Frequency against time for one ping'], 'A full-field is a vertical slice along one bearing. A plan view is a map at one target depth. They are two cuts through the same result.')
  },
  (r) =>
    mc(r, 'u01-measured', 'Which statement about a measured term, such as measured reverberation, is true?', 'It is valid for the time, place and settings at which it was taken', ['It can be used unchanged for any depth and any waveform', 'It is always less accurate than a modeled term', 'It removes the need for a propagation engine'], 'A measurement is exact for the moment it describes and says nothing by itself about another depth, waveform or day. A model is needed to extend it.'),
]

const POWER_PAIRS: Array<[number, number]> = [
  [13, 20],
  [16, 40],
  [23, 200],
  [26, 400],
  [27, 500],
  [33, 2000],
  [37, 5000],
]

export const u02: QuestionGen[] = [
  (r) => {
    const [db, ratio] = r.pick(POWER_PAIRS)
    return num('u02-ratio', `A level difference of **${db} dB** corresponds to what **power** ratio? Use tens and threes.`, ratio, 'times', `Split ${db} into tens and threes. Each 10 dB is a factor of 10 and each 3 dB a factor of 2, giving × ${ratio}.`, ratio * 0.04)
  },
  (r) => {
    const ratio = r.pick([8, 50, 400, 2000, 0.05, 0.25])
    const ans = 10 * Math.log10(ratio)
    return num('u02-db', `One sound has **${ratio} times** the power of another. What is the difference in decibels?`, ans, 'dB', `$10 \\log_{10}(${ratio}) = ${r1(ans)}$ dB. Power ratios use a factor of 10.`, 0.3)
  },
  (r) => {
    const ratio = r.pick([2, 5, 10, 30, 100])
    const ans = 20 * Math.log10(ratio)
    return num('u02-pressure', `The sound **pressure** at a hydrophone increases by a factor of **${ratio}**. By how many decibels does the level rise?`, ans, 'dB', `Pressure ratios use a factor of 20: $20 \\log_{10}(${ratio}) = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const a = r.int(55, 80)
    const b = a - r.int(0, 10)
    const ans = powerSumDb([a, b])
    return num('u02-sum', `Reverberation at a beam is **${a} dB** and noise is **${b} dB**. What is the masking level, their power sum?`, ans, 'dB', `Convert to power, add, convert back: $10 \\log(10^{${a}/10} + 10^{${b}/10}) = ${r1(ans)}$ dB. That is ${r1(ans - a)} dB above the larger.`, 0.3)
  },
  (r) => {
    const n = r.pick([2, 4, 5, 8, 10, 20])
    const l = r.int(50, 75)
    const ans = l + 10 * Math.log10(n)
    return num('u02-n', `**${n}** independent sources each produce **${l} dB** at a point. What is the total level?`, ans, 'dB', `$N$ equal levels add $10 \\log N$: $${l} + 10 \\log ${n} = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const nsl = r.int(48, 70)
    const b = r.pick([50, 100, 200, 400, 1000])
    const ans = nsl + 10 * Math.log10(b)
    return num('u02-band', `Ambient noise has a flat spectrum level of **${nsl} dB re 1 µPa²/Hz**. A processor’s band is **${b} Hz** wide. What is the noise level in the band?`, ans, 'dB re 1 µPa', `Band level is spectrum level plus $10 \\log B$: $${nsl} + ${r1(10 * Math.log10(b))} = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const b = r.pick([100, 200, 400, 800])
    const band = r.int(78, 95)
    const ans = band - 10 * Math.log10(b)
    return num('u02-spectrum', `A sonar reports noise of **${band} dB re 1 µPa** in a **${b} Hz** band. Assuming a flat spectrum, what is the spectrum level?`, ans, 'dB re 1 µPa²/Hz', `Reverse the band conversion: $${band} - 10 \\log ${b} = ${r1(ans)}$ dB per hertz.`, 0.3)
  },
  (r) => {
    const noise = r.int(55, 70)
    const meas = noise + r.int(3, 9)
    const ans = powerDiffDb(meas, noise)
    return num('u02-remove', `A sonar measures **${meas} dB** of reverberation plus noise. The noise alone, measured late in the cycle, is **${noise} dB**. What is the level of the reverberation by itself?`, ans, 'dB', `Subtract in power: $10 \\log(10^{${meas}/10} - 10^{${noise}/10}) = ${r1(ans)}$ dB.`, 0.3)
  },
  (r) => {
    const thing = r.pick([
      { q: 'a ratio of bandwidths', a: '10 log' },
      { q: 'a ratio of pressures', a: '20 log' },
      { q: 'the number of hydrophones in an array, for noise gain', a: '10 log' },
      { q: 'a ratio of voltages from a hydrophone', a: '20 log' },
      { q: 'a ratio of scattering areas', a: '10 log' },
    ])
    return mc(r, 'u02-factor', `To express ${thing.q} in decibels, which form applies?`, thing.a, [thing.a === '10 log' ? '20 log' : '10 log', '40 log', '5 log'], 'Power-like quantities, including area, bandwidth, time and element count, take 10 log. Amplitude-like quantities such as pressure and voltage take 20 log.')
  },
  (r) => {
    const a = r.int(55, 65)
    const b = a + 20
    return mc(r, 'u02-avg', `Two cells hold **${a} dB** and **${b} dB**. Compare the mean of the two decibel values with the level of their mean power.`, `The mean of the decibels, ${a + 10} dB, is lower than the level of the mean power, about ${a + 17} dB`, [`They are equal at ${a + 10} dB`, `The mean of the decibels is higher`, `The level of the mean power is ${a + 20 + 3} dB`], 'Averaging decibels always gives a number at or below the level of the average power. Here the larger value dominates the power average.')
  },
  (r) => {
    const sl = r.int(212, 226)
    const x = r.int(68, 86)
    const ts = r.int(8, 20)
    return num('u02-sign', `An engine stores propagation as a **negative** number: **−${x} dB** one way to the target. Source level is **${sl} dB** and target strength **${ts} dB**. What is the echo level?`, sl - 2 * x + ts, 'dB', `The stored value is minus the transmission loss, so $TL = ${x}$ dB. $EL = ${sl} - 2 \\times ${x} + ${ts} = ${sl - 2 * x + ts}$ dB. Subtracting the negative number would add loss back as gain.`)
  },
  (r) => {
    const nsl = r.int(56, 66)
    const b = r.pick([200, 400])
    const rl = nsl + r.pick([12, 16, 34, 38])
    const band = nsl + 10 * Math.log10(b)
    const noiseWins = band > rl
    return mc(r, 'u02-compare', `Noise is given as **${nsl} dB re 1 µPa²/Hz**. Reverberation is given as **${rl} dB re 1 µPa** in a **${b} Hz** band. Which is the larger in that band?`, noiseWins ? `Noise, at about ${r0(band)} dB in the band` : `Reverberation: noise is only about ${r0(band)} dB in the band`, [noiseWins ? 'Reverberation, since its number is larger' : `Noise, at about ${r0(band + 20)} dB in the band`, 'They cannot be compared at all', `Noise, at ${nsl} dB`], `The noise is per hertz. In ${b} Hz it becomes $${nsl} + ${r1(10 * Math.log10(b))} = ${r1(band)}$ dB re 1 µPa, which can then be compared with ${rl} dB.`)
  },
  (r) => {
    const l = r.int(52, 78)
    return num('u02-equal', `Reverberation and noise are both exactly **${l} dB** at the time an echo arrives. What is the masking level?`, l + 3.01, 'dB', `Two equal levels sum to 3 dB above either: ${r1(l + 3.01)} dB.`, 0.3)
  },
]

export const u03: QuestionGen[] = [
  (r) => {
    const t1 = r.int(6, 14)
    const dt = r.int(2, 6)
    const ans = medwinSoundSpeed(t1 + dt, 35, 0) - medwinSoundSpeed(t1, 35, 0)
    return num('u03-temp', `Surface water warms from **${t1} °C** to **${t1 + dt} °C**. Using $c \\approx 1449.2 + 4.6T - 0.055T^2 + 0.00029T^3$ for salinity 35 at the surface, by how much does sound speed rise?`, ans, 'm/s', `Evaluate the formula at both temperatures and subtract: ${r1(ans)} m/s, about ${r1(ans / dt)} m/s per degree.`, 1)
  },
  (r) => {
    const z1 = r.pick([1000, 1500, 2000])
    const dz = r.pick([500, 1000, 1500, 2000])
    return num('u03-depth', `In the deep isothermal layer only pressure changes sound speed, at about **0.016 m/s per meter**. How much faster is sound at **${z1 + dz} m** than at **${z1} m**?`, 0.016 * dz, 'm/s', `$0.016 \\times ${dz} = ${r1(0.016 * dz)}$ m/s.`, 0.5)
  },
  (r) => {
    const inc = r.next() < 0.5
    return mc(r, 'u03-bend', `In a layer where sound speed **${inc ? 'increases' : 'decreases'}** with depth, which way do rays bend?`, inc ? 'Upward' : 'Downward', [inc ? 'Downward' : 'Upward', 'They do not bend', 'Toward the faster water'], 'Rays bend toward slower water. If speed increases with depth the slower water is above, so rays bend up.')
  },
  (r) => {
    const item = r.pick([
      { q: 'the depth of minimum sound speed', a: 'Sound channel axis' },
      { q: 'the base of the mixed layer, where near-surface sound speed is greatest', a: 'Sonic layer depth' },
      { q: 'the deep depth at which sound speed climbs back to its near-surface maximum', a: 'Critical depth' },
    ])
    return mc(r, 'u03-layer', `What is the name for ${item.q}?`, item.a, ['Sound channel axis', 'Sonic layer depth', 'Critical depth', 'Thermocline'].filter((x) => x !== item.a).slice(0, 3), 'The sonic layer depth is the base of the mixed layer. The channel axis is the speed minimum. The critical depth is where the deep speed equals the near-surface maximum, and water below it is depth excess.')
  },
  (r) => {
    const h = r.pick([40, 60, 80, 100, 150, 200])
    const ans = 1.8e5 / Math.pow(h, 1.5)
    return num('u03-cutoff', `A mixed layer is **${h} m** deep. Using $f \\approx 1.8 \\times 10^5 / H^{1.5}$, below roughly what frequency does it stop trapping sound?`, ans, 'Hz', `$1.8 \\times 10^5 / ${h}^{1.5} = ${r0(ans)}$ Hz. Deeper layers trap lower frequencies.`, ans * 0.08)
  },
  (r) =>
    mc(r, 'u03-cz', 'What must be true of the water for a convergence zone to form?', 'The seabed must be deeper than the critical depth, giving depth excess', ['There must be a surface duct', 'The bottom must be hard rock', 'The water must be shallower than the sound channel axis'], 'Downgoing rays need room to be turned back by the pressure gradient before reaching the seabed. That room is the depth excess below the critical depth.'),
  (r) => {
    const g = r.pick([0.012, 0.016, 0.02, 0.03, 0.05])
    const ans = C / g / 1000
    return num('u03-radius', `In a layer where sound speed changes by **${g} m/s per meter**, a ray launched horizontally follows a circular arc. Take $c = 1500$ m/s. What is its radius?`, ans, 'km', `$R = c/g = 1500 / ${g} = ${r1(ans)}$ km.`, ans * 0.03)
  },
  (r) => {
    const summer = r.next() < 0.5
    return mc(r, 'u03-season', `On a continental shelf in **${summer ? 'summer' : 'winter'}**, what mainly limits propagation?`, summer ? 'Bottom loss, because every ray is bent down into the seabed' : 'Surface roughness, because rays are carried along the surface', [summer ? 'Surface roughness, because rays are carried along the surface' : 'Bottom loss, because every ray is bent down into the seabed', 'Absorption in the water', 'The convergence zone gap'], 'Summer heating makes sound speed fall with depth, so rays dive into the bottom. Winter mixing makes it rise slightly with depth, so rays bend up and ride the surface.')
  },
  (r) => {
    const g0 = r.int(4, 10)
    const slope = r.pick([1, 1.5, 2, 3])
    const n = r.int(2, 4)
    return num('u03-upslope', `A ray strikes an upward-sloping bottom at a grazing angle of **${g0}°**. The slope is **${slope}°**. Each bounce steepens the ray by twice the slope. What is its grazing angle at the bottom after **${n}** more bounces?`, g0 + 2 * slope * n, 'degrees', `$${g0} + 2 \\times ${slope} \\times ${n} = ${g0 + 2 * slope * n}°$. Upslope propagation drives rays past the critical angle.`, 0.3)
  },
  (r) =>
    mc(r, 'u03-shadow', 'A source is inside a surface duct. Where is the shadow zone?', 'Below the layer, beyond a few kilometers', ['Inside the layer at long range', 'Directly beneath the source', 'At the sea surface'], 'Shallow rays stay in the duct and steeper rays dive away. The region just below the layer, between them, receives no direct energy.'),
  (r) => {
    const good = r.next() < 0.5
    return mc(r, 'u03-bottom', `Which seabed gives the **${good ? 'lowest' : 'highest'}** loss per bounce at a grazing angle of 10°?`, good ? 'Rock' : 'Mud', good ? ['Mud', 'Silt', 'Fine clay'] : ['Rock', 'Sand', 'Gravel'], 'Hard bottoms reflect, soft bottoms absorb. At 10° sand and rock are below their critical angles and reflect well. Mud has almost no critical angle.')
  },
  (r) => {
    const item = r.pick([
      { q: 'is exact for one place at one moment', a: 'An in situ probe drop' },
      { q: 'is always available but blind to today’s eddies and fronts', a: 'Climatology' },
      { q: 'carries fronts and eddies in roughly the right place, with growing error in complex water', a: 'An ocean forecast model' },
    ])
    return mc(r, 'u03-source', `Which source of a sound speed profile ${item.q}?`, item.a, ['An in situ probe drop', 'Climatology', 'An ocean forecast model', 'A bathymetry database'].filter((x) => x !== item.a).slice(0, 3), 'Climatology is a long-term average. Forecast models add the current state. An in situ drop is the truth at one point.')
  },
  (r) =>
    mc(r, 'u03-wind', 'A stale wind speed is used in a prediction. Which terms does it corrupt?', 'Surface loss, surface reverberation and ambient noise', ['Only ambient noise', 'Only surface reverberation', 'Bottom loss and target strength'], 'Wind roughens the surface, which raises loss per surface bounce and surface scattering strength, and it drives wind noise. One input feeds all three.'),
  (r) => {
    const first = r.int(54, 66)
    const k = r.pick([2, 3])
    return num('u03-cz-n', `The first convergence zone is at **${first} km**. About where is zone number **${k}**?`, first * k, 'km', `Zones repeat at multiples of the first zone range: $${k} \\times ${first} = ${first * k}$ km.`, first * k * 0.03)
  },
]

export const u04: QuestionGen[] = [
  (r) => {
    const a = r.int(2, 30) * (r.next() < 0.5 ? 1 : -1)
    return num('u04-convert', `A ray engine reports a launch angle of **${a > 0 ? '+' : '−'}${Math.abs(a)}°** using a **down-positive** convention. What is that angle in an **up-positive** convention?`, -a, 'degrees', `The magnitude stays and the sign flips: ${-a > 0 ? '+' : '−'}${Math.abs(a)}°. The ray points ${a > 0 ? 'down' : 'up'}.`, 0.2)
  },
  (r) => {
    const c1 = 1500
    const c2 = c1 - r.int(4, 20)
    const ans = Math.acos(c2 / c1) / DEG
    return num('u04-snell-h', `A ray is horizontal at a depth where sound speed is **${c1} m/s**. What is its angle from the horizontal where the speed is **${c2} m/s**?`, ans, 'degrees', `$\\cos\\theta_2 = c_2/c_1 = ${c2}/${c1}$, so $\\theta_2 = ${r2(ans)}°$. Moving into slower water steepens the ray.`, 0.2)
  },
  (r) => {
    const th1 = r.int(5, 20)
    const c1 = 1520
    const c2 = c1 - r.int(10, 30)
    const ans = Math.acos((c2 / c1) * Math.cos(th1 * DEG)) / DEG
    return num('u04-snell', `A ray travels at **${th1}°** from the horizontal where sound speed is **${c1} m/s**. What is its angle where the speed is **${c2} m/s**?`, ans, 'degrees', `$\\cos\\theta_2 = (${c2}/${c1}) \\cos ${th1}°$, giving $\\theta_2 = ${r2(ans)}°$.`, 0.2)
  },
  (r) => {
    const dc = r.pick([0.8, 1.2, 1.6, 2.4, 3.2])
    const ans = Math.acos(1500 / (1500 + dc)) / DEG
    return num('u04-limit', `In a surface duct, sound speed is **1500 m/s** at the surface and **${1500 + dc} m/s** at the layer depth. What is the angle of the limiting ray at the surface?`, ans, 'degrees', `$\\cos\\theta_{lim} = c_s/c_L = 1500/${1500 + dc}$, so $\\theta_{lim} = ${r2(ans)}°$. Only a degree or two is trapped.`, 0.15)
  },
  (r) => {
    const h = r.pick([50, 80, 100, 150, 200])
    const ans = Math.sqrt(8 * (C / 0.016) * h) / 1000
    return num('u04-skip', `A mixed layer **${h} m** deep has a gradient of 0.016 per second, so the ray radius is about 94 km. Using $X = \\sqrt{8RH}$, what is the skip distance of the limiting ray?`, ans, 'km', `$\\sqrt{8 \\times 93{,}750 \\times ${h}} = ${r1(ans)}$ km.`, ans * 0.03)
  },
  (r) => {
    const th = r.int(5, 15)
    const slope = r.int(1, 5)
    return num('u04-graze', `A ray descends at **${th}°** below horizontal and strikes a bottom that rises toward it at **${slope}°**. What is the grazing angle?`, th + slope, 'degrees', `Grazing angle is measured from the bottom itself: $${th}° + ${slope}° = ${th + slope}°$.`, 0.2)
  },
  (r) => {
    const toInc = r.next() < 0.5
    const a = r.int(5, 40)
    return num('u04-incidence', `A bottom-loss table is indexed by **${toInc ? 'angle of incidence' : 'grazing angle'}**. Your ray has ${toInc ? 'a grazing angle' : 'an angle of incidence'} of **${toInc ? a : 90 - a}°**. What value do you look up?`, toInc ? 90 - a : a, 'degrees', `Incidence is measured from the perpendicular, grazing from the surface, and they sum to 90°. Look up ${toInc ? 90 - a : a}°.`, 0.2)
  },
  (r) => {
    const rr = r.pick([300, 500, 800, 1200])
    const dz = r.pick([200, 400, 600, 900])
    const ans = Math.hypot(rr, dz)
    return num('u04-slant', `A target is **${rr} m** away horizontally and **${dz} m** deeper than the sensor. What is the slant range?`, ans, 'm', `$\\sqrt{${rr}^2 + ${dz}^2} = ${r0(ans)}$ m.`, ans * 0.02)
  },
  (r) => {
    const kyd = r.int(4, 30)
    const ans = (2 * kyd * KYD_M) / C
    return num('u04-kyd', `A target is at **${kyd} kyd**. How long after transmission does a monostatic sonar hear its echo? Use 1 kyd = 914.4 m and 1500 m/s.`, ans, 's', `$t = 2R/c = 2 \\times ${kyd} \\times 914.4 / 1500 = ${r1(ans)}$ s.`, 0.3)
  },
  (r) => {
    const h = r.int(0, 35) * 10
    const rel = r.int(1, 35) * 10
    return num('u04-true', `A ship is heading **${String(h).padStart(3, '0')} °T**. A contact is on a beam at relative bearing **${String(rel).padStart(3, '0')} °R**. What is its true bearing?`, (h + rel) % 360, '°T', `True bearing is heading plus relative bearing, modulo 360: $${h} + ${rel} = ${(h + rel) % 360}$.`, 0.5)
  },
  (r) => {
    const h = r.int(0, 35) * 10
    const t = r.int(0, 35) * 10
    return num('u04-rel', `A ship is heading **${String(h).padStart(3, '0')} °T**. A contact bears **${String(t).padStart(3, '0')} °T**. What is its relative bearing, from 0 to 359?`, (t - h + 360) % 360, '°R', `Relative bearing is true bearing minus heading, modulo 360: ${(t - h + 360) % 360}°.`, 0.5)
  },
  (r) => {
    const b = r.int(0, 35) * 10
    const th = r.int(0, 35) * 10
    const ans = (b + 180 - th + 720) % 360
    return num('u04-aspect', `A target bears **${String(b).padStart(3, '0')} °T** from your sonar and is heading **${String(th).padStart(3, '0')} °T**. What is its aspect, the angle at the target from its bow round to your sonar, from 0 to 359?`, ans, 'degrees', `The bearing from the target back to you is $${b} + 180 = ${(b + 180) % 360}$. Subtract the target’s heading: ${ans}°. ${ans < 30 || ans > 330 ? 'You see its bow.' : Math.abs(ans - 180) < 30 ? 'You see its stern.' : Math.abs(ans - 90) < 30 || Math.abs(ans - 270) < 30 ? 'You see its beam.' : 'You see a quarter.'}`, 0.5)
  },
  (r) => {
    const down = r.next() < 0.5
    return mc(r, 'u04-look', `An eigenray is travelling **${down ? 'downward' : 'upward'}** as it reaches the receiver. Which way must the receive beam be steered to accept it?`, down ? 'Up, in elevation' : 'Down, in depression', [down ? 'Down, in depression' : 'Up, in elevation', 'Horizontally', 'It does not matter'], 'Direction of travel and direction of look are opposite. Sound travelling down came from above, so the receiver looks up.')
  },
  (r) => {
    const nmi = r.int(5, 40)
    const toKyd = r.next() < 0.5
    const ans = toKyd ? (nmi * NMI_M) / KYD_M : (nmi * NMI_M) / 1000
    return num('u04-nmi', `Convert **${nmi} nautical miles** to ${toKyd ? 'kiloyards' : 'kilometers'}. Use 1 nmi = 1852 m${toKyd ? ' and 1 kyd = 914.4 m' : ''}.`, ans, toKyd ? 'kyd' : 'km', `$${nmi} \\times 1852 ${toKyd ? '/ 914.4' : '/ 1000'} = ${r1(ans)}$ ${toKyd ? 'kyd' : 'km'}.`, ans * 0.02)
  },
  (r) => {
    const th = r.int(4, 16)
    const c0 = 1490
    const ans = c0 / Math.cos(th * DEG)
    return num('u04-vertex', `A ray leaves a source at **${th}°** from the horizontal where sound speed is **${c0} m/s**. At what sound speed will it turn horizontal?`, ans, 'm/s', `A ray turns where the local speed equals its vertex speed, $c_0/\\cos\\theta_0 = ${c0}/\\cos ${th}° = ${r1(ans)}$ m/s. If no depth is that fast, it hits a boundary instead.`, 1)
  },
]

export const u05: QuestionGen[] = [
  (r) => {
    const km = r.pick([2, 5, 10, 20, 50])
    return num('u05-sph', `Using spherical spreading alone, what is the transmission loss at **${km} km**?`, 20 * Math.log10(km * 1000), 'dB', `$20 \\log_{10}(${km * 1000}) = ${r1(20 * Math.log10(km * 1000))}$ dB.`)
  },
  (r) => {
    const rt = r.pick([500, 1000, 2000])
    const km = r.pick([10, 20, 40, 80])
    const ans = 20 * Math.log10(rt) + 10 * Math.log10((km * 1000) / rt)
    return num('u05-hybrid', `Sound spreads spherically to a transition range of **${rt} m** and cylindrically beyond. Ignoring absorption, what is the loss at **${km} km**?`, ans, 'dB', `$20 \\log ${rt} + 10 \\log(${km * 1000}/${rt}) = ${r1(20 * Math.log10(rt))} + ${r1(10 * Math.log10((km * 1000) / rt))} = ${r1(ans)}$ dB.`)
  },
  (r) => {
    const f = r.pick([
      [1, 0.07],
      [3.5, 0.24],
      [10, 1.2],
    ])
    const km = r.pick([5, 10, 20, 30])
    const ans = 20 * Math.log10(km * 1000) + f[1] * km
    return num('u05-abs', `At **${f[0]} kHz** absorption is **${f[1]} dB/km**. With spherical spreading, what is the one-way loss at **${km} km**?`, ans, 'dB', `Spreading $20 \\log ${km * 1000} = ${r1(20 * Math.log10(km * 1000))}$ dB plus absorption $${f[1]} \\times ${km} = ${r1(f[1] * km)}$ dB gives ${r1(ans)} dB.`)
  },
  (r) => {
    const tl = r.int(68, 92)
    return num('u05-twoway', `One-way transmission loss to a target is **${tl} dB**. In a monostatic geometry, by how much is the echo reduced by propagation in total?`, 2 * tl, 'dB', `The echo pays the loss out and back: $2 \\times ${tl} = ${2 * tl}$ dB.`)
  },
  (r) => {
    const n = r.int(4, 24)
    const per = r.pick([0.3, 0.5, 1, 2, 4])
    return num('u05-bounce', `A path makes **${n}** bottom bounces, losing **${per} dB** at each. How much of its loss is due to the bottom?`, n * per, 'dB', `$${n} \\times ${per} = ${r1(n * per)}$ dB. Many gentle bounces can cost as much as a few harsh ones.`, 0.3)
  },
  (r) => {
    const item = r.pick([
      { q: 'A 200 Hz prediction across a shelf break with strongly varying bathymetry', a: 'A parabolic equation engine' },
      { q: 'A 5 kHz active prediction that needs arrival angles for beam patterns and reverberation', a: 'A ray or Gaussian-beam engine' },
      { q: 'An exact reference solution for a horizontally layered ocean, to check other codes', a: 'A wavenumber integration code' },
    ])
    return mc(r, 'u05-engine', `${item.q}. Which kind of engine fits best?`, item.a, ['A parabolic equation engine', 'A ray or Gaussian-beam engine', 'A wavenumber integration code', 'A spreading law with absorption'].filter((x) => x !== item.a).slice(0, 3), 'Rays suit high frequency and give paths, angles and times. Parabolic equation suits low frequency and range dependence. Wavenumber integration is exact for layered media only.')
  },
  (r) =>
    mc(r, 'u05-coherent', 'For a performance prediction with a processor that has a few hundred hertz of bandwidth, which loss is normally used?', 'Incoherent or band-averaged loss', ['Coherent loss at the center frequency', 'The minimum loss over the band', 'Spherical spreading only'], 'The fine interference ripples of a coherent field are not predictable and the processor’s band averages over them. Incoherent or band-averaged loss is the stable quantity.'),
  (r) => {
    const a = r.pick([40, 50, 60])
    const b = r.pick([150, 300, 400])
    return mc(r, 'u05-recip', `An engine has computed loss from a sensor at **${a} m** to a point at **${b} m**. What does reciprocity say about the loss from a source at ${b} m at that point back to the sensor at ${a} m?`, 'It is the same', ['It is twice as large', 'It is unrelated and needs a new run', 'It is the same only in isovelocity water'], 'Swapping source and receiver leaves transmission loss unchanged. One run from the sensor serves both directions.')
  },
  (r) => {
    const e = r.pick([2, 3, 4, 5])
    return num('u05-error', `A bottom-type error makes the modeled one-way loss **${e} dB** too low. By how much is the predicted monostatic echo level too high?`, 2 * e, 'dB', `The echo uses the loss twice, so the error doubles: ${2 * e} dB.`, 0.2)
  },
  (r) => {
    const item = r.pick([
      { q: 'a horizontal band of low loss just under the surface that persists to long range', a: 'A surface duct' },
      { q: 'a bright patch near the surface about 60 km out, joined to the source by a deep arc', a: 'A convergence zone' },
      { q: 'a dark region just below the mixed layer starting a few kilometers out', a: 'A shadow zone' },
      { q: 'repeating diagonal stripes between surface and seabed', a: 'Bottom-bounce paths' },
    ])
    return mc(r, 'u05-feature', `On a full-field plot you see ${item.q}. What is it?`, item.a, ['A surface duct', 'A convergence zone', 'A shadow zone', 'Bottom-bounce paths'].filter((x) => x !== item.a), 'Ducts are horizontal bright bands. Shadows are dark regions. Convergence zones are distant bright patches fed by a deep arc. Bottom bounce makes diagonal stripes.')
  },
  (r) => {
    const sph = r.next() < 0.5
    return num('u05-double', `Under purely **${sph ? 'spherical' : 'cylindrical'}** spreading, how much does loss increase each time range doubles?`, sph ? 6.02 : 3.01, 'dB', `${sph ? '$20 \\log 2 = 6$' : '$10 \\log 2 = 3$'} dB per doubling.`, 0.2)
  },
  (r) => {
    const km = r.pick([20, 30, 40])
    return num('u05-abs2', `At 10 kHz absorption is about **1.2 dB/km**. For a target at **${km} km**, how much of the **two-way** loss is absorption?`, 2 * 1.2 * km, 'dB', `$2 \\times 1.2 \\times ${km} = ${r0(2.4 * km)}$ dB. This is why long-range active sonars use low frequencies.`, 1)
  },
  (r) => {
    const km = r.pick([10, 20])
    const sph = Math.round(simpleTlDb(km * 1000, 1, 'spherical'))
    const cyl = Math.round(10 * Math.log10(km * 1000))
    return mc(r, 'u05-sanity', `In open deep water with no duct, four codes report one-way loss at **${km} km**. Which value is physically implausible?`, `${cyl - 6} dB`, [`${sph} dB`, `${sph - 8} dB`, `${sph + 14} dB`], `Loss cannot be less than cylindrical spreading from one meter, about ${cyl} dB at this range. Values near spherical spreading, ${sph} dB, are expected, and higher values occur in shadows.`)
  },
]
