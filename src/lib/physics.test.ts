import { describe, expect, it } from 'vitest'
import { ainslieMcColmDbPerKm, simpleTlDb, spreadingLossDb, thorpDbPerKm } from './absorption'
import { directivityIndexDb, halfPowerWidthDeg, hasGratingLobe, peakSidelobeDb, type ArraySpec } from './arrays'
import {
  bistaticAngleDeg,
  bistaticDopplerHz,
  bistaticRangeResolutionM,
  blindPath,
  dist,
  equivalentMonostaticRange,
  isoTimeEllipse,
  receiverRange,
  totalPath,
} from './bistatic'
import { DEG, fromDb, powerDiffDb, powerSumDb, toDb } from './db'
import { cumulativePd, detectionIndex, normCdf, normInv, pdFromIndex, podFromSe } from './detection'
import { eigenraySumDb, findEigenrays } from './eigenrays'
import { ambientNoise, bandLevelDb, beamNoiseDb, integrateBandDb, selfNoiseDb } from './noise'
import { marchRay, traceFan, traceRay } from './rays'
import { calibrationOffsetDb, chapmanHarrisDb, lambertDb, reverbAtRange, synthesizeMeasured, type ReverbInputs } from './reverb'
import { createRng } from './rng'
import { detectionSpans, figureOfMeritDb, solveBudget, zeroCrossings } from './sonarEq'
import { ENVIRONMENTS, bottomLossDb, BOTTOMS, getEnvironment, medwinSoundSpeed, prepareEnv, soundSpeedAt } from './ssp'
import { NOTIONAL_TARGET, bistaticTsDb, cylinderBroadsideTsDb, monostaticTsDb, plateTsDb, sphereTsDb, sphereTsVsKaDb } from './target'
import { computeTlField, tlAt, tlSlice } from './tlfield'
import { ambiguityAt, dopplerLossDb, dopplerShiftHz, processingGainDb, rangeResolutionM, speedResolutionMs, type Waveform } from './waveform'

describe('decibels', () => {
  it('doubles power for +3 dB', () => {
    expect(powerSumDb([60, 60])).toBeCloseTo(63.01, 2)
    expect(toDb(2)).toBeCloseTo(3.01, 2)
    expect(fromDb(10)).toBeCloseTo(10)
  })
  it('ignores a contributor 20 dB down', () => {
    expect(powerSumDb([70, 50]) - 70).toBeLessThan(0.05)
    expect(powerDiffDb(63.01, 60)).toBeCloseTo(60, 1)
  })
})

describe('absorption and spreading', () => {
  it('matches Thorp reference values', () => {
    expect(thorpDbPerKm(1)).toBeCloseTo(0.069, 2)
    expect(thorpDbPerKm(10)).toBeCloseTo(1.19, 1)
  })
  it('keeps Ainslie-McColm near 1 dB/km at 10 kHz', () => {
    expect(ainslieMcColmDbPerKm(10)).toBeGreaterThan(0.8)
    expect(ainslieMcColmDbPerKm(10)).toBeLessThan(1.2)
  })
  it('applies spreading laws', () => {
    expect(spreadingLossDb(1000, 'spherical')).toBeCloseTo(60)
    expect(spreadingLossDb(1000, 'cylindrical')).toBeCloseTo(30)
    expect(spreadingLossDb(10000, 'hybrid', 1000)).toBeCloseTo(70)
    expect(simpleTlDb(10000, 3.5)).toBeGreaterThan(80)
  })
})

describe('sound speed and environments', () => {
  it('gives about 1500 m/s for ordinary seawater', () => {
    expect(medwinSoundSpeed(13, 35, 0)).toBeGreaterThan(1495)
    expect(medwinSoundSpeed(13, 35, 0)).toBeLessThan(1505)
    expect(medwinSoundSpeed(14, 35, 0) - medwinSoundSpeed(13, 35, 0)).toBeGreaterThan(2.5)
  })
  it('prepares every preset', () => {
    for (const env of ENVIRONMENTS) {
      const p = prepareEnv(env)
      expect(p.zMax).toBeGreaterThan(0)
      expect(soundSpeedAt(p, p.zMax / 2)).toBeGreaterThan(1400)
    }
  })
  it('raises bottom loss above the critical angle', () => {
    expect(bottomLossDb(BOTTOMS.sand, 10 * DEG)).toBeLessThan(1)
    expect(bottomLossDb(BOTTOMS.sand, 60 * DEG)).toBeGreaterThan(8)
  })
})

describe('ray tracing', () => {
  const iso = prepareEnv(getEnvironment('isovelocity'))
  it('draws straight rays in isovelocity water', () => {
    const ray = traceRay(iso, 300, 5, 2000)
    const i = ray.n - 1
    expect((ray.z[i] - 300) / ray.r[i]).toBeCloseTo(Math.tan(5 * DEG), 2)
    expect(ray.kind).toBe('direct')
  })
  it('conserves the Snell invariant in a gradient', () => {
    const p = prepareEnv(getEnvironment('deep-cz'))
    const start = Math.cos(8 * DEG) / soundSpeedAt(p, 100)
    let worst = 0
    marchRay(p, 100, 8, 40000, { ds: 25, freqKhz: 1 }, (s) => {
      worst = Math.max(worst, Math.abs(Math.cos(s.theta) / soundSpeedAt(p, s.z) - start) / start)
    })
    expect(worst).toBeLessThan(2e-4)
  })
  it('forms a convergence zone between 50 and 75 km', () => {
    const p = prepareEnv(getEnvironment('deep-cz'))
    const ray = traceRay(p, 100, 4, 100000)
    let back = 0
    for (let i = 1; i < ray.n; i++) {
      if (ray.r[i] > 20000 && ray.z[i] < 200 && ray.z[i - 1] >= 200) {
        back = ray.r[i]
        break
      }
    }
    expect(back).toBeGreaterThan(50000)
    expect(back).toBeLessThan(75000)
    expect(ray.nBot).toBe(0)
  })
  it('traps shallow rays in the surface duct', () => {
    const p = prepareEnv(getEnvironment('surface-duct'))
    const trapped = traceRay(p, 40, 0.5, 30000)
    expect(trapped.nSurf).toBeGreaterThan(1)
    expect(trapped.nBot).toBe(0)
    const fan = traceFan(p, 40, -10, 10, 9, 30000)
    expect(fan).toHaveLength(9)
  })
  it('steepens rays going upslope', () => {
    const p = prepareEnv(getEnvironment('upslope'))
    const ray = traceRay(p, 60, 12, 60000)
    expect(ray.nBot).toBeGreaterThan(1)
  })
})

describe('transmission loss field', () => {
  it('reproduces spherical spreading near the source', () => {
    const p = prepareEnv(getEnvironment('isovelocity'))
    const field = computeTlField(p, { zs: 300, freqKhz: 1, rMax: 2000, nr: 200, nz: 200, nRays: 1600, fanDeg: 80 })
    expect(Math.abs(tlAt(field, 300, 300) - 20 * Math.log10(300))).toBeLessThan(2)
    expect(Math.abs(tlAt(field, 600, 500) - 20 * Math.log10(Math.hypot(600, 200)))).toBeLessThan(2.5)
  })
  it('shows a shadow zone under the duct and a slice by depth', () => {
    const p = prepareEnv(getEnvironment('surface-duct'))
    const field = computeTlField(p, { zs: 40, freqKhz: 3.5, rMax: 40000 })
    const inDuct = tlAt(field, 20000, 50)
    const below = tlAt(field, 20000, 350)
    expect(below - inDuct).toBeGreaterThan(8)
    const slice = tlSlice(field, 50)
    expect(slice.tl).toHaveLength(field.nr)
  })
  it('marks the seabed with NaN', () => {
    const p = prepareEnv(getEnvironment('upslope'))
    const field = computeTlField(p, { zs: 60, freqKhz: 3.5, rMax: 60000, nRays: 300 })
    expect(Number.isNaN(tlAt(field, 55000, 1200))).toBe(true)
  })
})

describe('eigenrays', () => {
  it('finds the direct path with the right angle, time and loss', () => {
    const p = prepareEnv(getEnvironment('isovelocity'))
    const rays = findEigenrays(p, 300, 5000, 500, { freqKhz: 1 })
    const direct = rays.find((e) => e.pathType === 'Direct')
    expect(direct).toBeDefined()
    const R = Math.hypot(5000, 200)
    expect(direct!.launchDeg).toBeCloseTo(Math.atan2(200, 5000) / DEG, 1)
    expect(direct!.timeS).toBeCloseTo(R / 1500, 1)
    expect(Math.abs(direct!.spreadingDb - 20 * Math.log10(R))).toBeLessThan(1)
    expect(rays.length).toBeGreaterThan(2)
    expect(eigenraySumDb(rays)).toBeLessThan(direct!.tlDb)
  })
})

describe('arrays', () => {
  const spec: ArraySpec = { n: 16, dOverLambda: 0.5, steerDeg: 0, shading: 'uniform' }
  it('gives DI of 10 log N at half-wavelength spacing', () => {
    expect(directivityIndexDb(spec)).toBeCloseTo(12.04, 1)
  })
  it('gives the textbook beamwidth and sidelobe', () => {
    expect(halfPowerWidthDeg(spec)).toBeCloseTo(6.4, 0)
    expect(peakSidelobeDb(spec)).toBeCloseTo(-13.2, 0)
    expect(peakSidelobeDb({ ...spec, shading: 'hann' })).toBeLessThan(-25)
  })
  it('flags grating lobes', () => {
    expect(hasGratingLobe(spec)).toBe(false)
    expect(hasGratingLobe({ ...spec, dOverLambda: 1.1 })).toBe(true)
    expect(hasGratingLobe({ ...spec, dOverLambda: 0.7, steerDeg: 60 })).toBe(true)
  })
})

describe('target strength', () => {
  it('matches closed forms', () => {
    expect(sphereTsDb(2)).toBeCloseTo(0)
    expect(cylinderBroadsideTsDb(4, 15, 0.5)).toBeCloseTo(29.5, 1)
    expect(plateTsDb(700, 0.5)).toBeCloseTo(62.9, 1)
    expect(sphereTsVsKaDb(1, 0.1)).toBeLessThan(sphereTsVsKaDb(1, 20) - 30)
  })
  it('peaks at beam aspect', () => {
    const beam = monostaticTsDb(NOTIONAL_TARGET, 90, 3.5)
    const bow = monostaticTsDb(NOTIONAL_TARGET, 0, 3.5)
    const quarter = monostaticTsDb(NOTIONAL_TARGET, 45, 3.5)
    expect(beam).toBeGreaterThan(20)
    expect(beam).toBeLessThan(32)
    expect(beam - bow).toBeGreaterThan(10)
    expect(beam - quarter).toBeGreaterThan(6)
  })
  it('has specular and forward-scatter ridges', () => {
    const specular = bistaticTsDb(NOTIONAL_TARGET, 60, 120, 3.5)
    const off = bistaticTsDb(NOTIONAL_TARGET, 60, 165, 3.5)
    const forward = bistaticTsDb(NOTIONAL_TARGET, 60, 240, 3.5)
    expect(specular).toBeGreaterThan(off + 6)
    expect(forward).toBeGreaterThan(40)
  })
})

describe('noise', () => {
  it('lands near Knudsen levels at 1 kHz', () => {
    const calm = ambientNoise(1, { shipping: 0.5, windKn: 5, rainMmH: 0 })
    const rough = ambientNoise(1, { shipping: 0.5, windKn: 30, rainMmH: 0 })
    expect(calm.total).toBeGreaterThan(50)
    expect(calm.total).toBeLessThan(65)
    expect(rough.total - calm.total).toBeGreaterThan(8)
  })
  it('converts spectrum level to band level', () => {
    expect(bandLevelDb(60, 100)).toBeCloseTo(80)
    expect(integrateBandDb(() => 60, 1, 1.1)).toBeCloseTo(80, 1)
  })
  it('raises beam noise toward an interferer', () => {
    const ships = [{ bearingDeg: 90, levelDb: 80 }]
    const on = beamNoiseDb(90, 70, 20, 30, ships, 10, -25)
    const off = beamNoiseDb(270, 70, 20, 30, ships, 10, -25)
    expect(on).toBeGreaterThan(79)
    expect(off).toBeLessThan(58)
    expect(selfNoiseDb(3, 25)).toBeGreaterThan(selfNoiseDb(3, 5) + 20)
  })
})

describe('reverberation', () => {
  const base: ReverbInputs = {
    slDb: 220,
    fKhz: 3.5,
    tauEff: 0.1,
    horizBeamDeg: 10,
    vertBeamDeg: 20,
    sourceDepth: 50,
    waterDepth: 200,
    muDb: -27,
    windKn: 15,
    svDb: -80,
    ductGrazingDeg: 6,
  }
  it('matches scattering strength references', () => {
    expect(lambertDb(-27, 30)).toBeCloseTo(-33.02, 1)
    expect(chapmanHarrisDb(20, 1000, 10)).toBeCloseTo(-45.5, 0)
  })
  it('decays with range and scales with pulse length', () => {
    const near = reverbAtRange(base, 2000)
    const far = reverbAtRange(base, 20000)
    expect(near.total).toBeGreaterThan(far.total + 20)
    const longer = reverbAtRange({ ...base, tauEff: 1 }, 2000)
    expect(longer.total - near.total).toBeCloseTo(10, 1)
  })
  it('recovers a hidden scattering offset from a measurement', () => {
    const ranges = Array.from({ length: 60 }, (_, i) => 1000 + i * 300)
    const truth = { ...base, muDb: -21 }
    const measured = synthesizeMeasured(truth, ranges, 20, 7)
    const model = ranges.map((r) => reverbAtRange({ ...base, windKn: 1, svDb: -120 }, r).bottom)
    const offset = calibrationOffsetDb(model, measured.levelDb)
    expect(offset).toBeGreaterThan(4)
    expect(offset).toBeLessThan(10)
  })
})

describe('detection statistics', () => {
  it('inverts the normal distribution', () => {
    expect(normInv(0.975)).toBeCloseTo(1.96, 2)
    expect(normCdf(1.2816)).toBeCloseTo(0.9, 3)
  })
  it('gives the textbook detection index', () => {
    expect(10 * Math.log10(detectionIndex(0.5, 1e-4))).toBeCloseTo(11.4, 1)
    expect(pdFromIndex(detectionIndex(0.9, 1e-4), 1e-4)).toBeCloseTo(0.9, 3)
  })
  it('maps signal excess to probability', () => {
    expect(podFromSe(0)).toBeCloseTo(0.5)
    expect(podFromSe(8, 8)).toBeCloseTo(0.841, 2)
    expect(cumulativePd([0.5, 0.5])).toBeCloseTo(0.75)
  })
})

describe('waveforms', () => {
  const cw: Waveform = { kind: 'cw', fcHz: 3500, bandwidthHz: 0, durationS: 0.5 }
  const lfm: Waveform = { kind: 'lfm', fcHz: 3500, bandwidthHz: 400, durationS: 0.5 }
  const hfm: Waveform = { ...lfm, kind: 'hfm' }
  it('computes resolution and gain', () => {
    expect(rangeResolutionM(cw)).toBeCloseTo(375)
    expect(rangeResolutionM(lfm)).toBeCloseTo(1.875)
    expect(processingGainDb(lfm)).toBeCloseTo(23.01, 1)
    expect(dopplerShiftHz(3500, 0.5144)).toBeCloseTo(2.4, 1)
    expect(speedResolutionMs(cw)).toBeCloseTo(0.4286, 3)
  })
  it('peaks at the origin and resolves CW Doppler', () => {
    expect(ambiguityAt(cw, 0, 0)).toBeCloseTo(1, 2)
    expect(ambiguityAt(lfm, 0, 0)).toBeCloseTo(1, 2)
    expect(ambiguityAt(cw, 0, 3)).toBeLessThan(0.2)
    expect(ambiguityAt(lfm, 0.02, 0)).toBeLessThan(0.1)
  })
  it('shows HFM is more Doppler tolerant than LFM', () => {
    expect(dopplerLossDb(hfm, 10)).toBeGreaterThan(dopplerLossDb(lfm, 10) + 2)
    expect(dopplerLossDb(hfm, 10)).toBeGreaterThan(-3)
  })
})

describe('bistatic geometry', () => {
  const src = { x: 0, y: 0 }
  const rcv = { x: 10000, y: 0 }
  const tgt = { x: 5000, y: 5000 }
  it('computes angle, path and equivalent range', () => {
    expect(bistaticAngleDeg(src, rcv, tgt)).toBeCloseTo(90)
    expect(totalPath(src, rcv, tgt)).toBeCloseTo(2 * Math.hypot(5000, 5000))
    expect(equivalentMonostaticRange(src, rcv, tgt)).toBeCloseTo(Math.hypot(5000, 5000))
  })
  it('recovers receiver range from time and bearing', () => {
    const rho = totalPath(src, rcv, tgt)
    expect(receiverRange(rho, dist(src, rcv), 45)).toBeCloseTo(dist(rcv, tgt), 3)
    const e = isoTimeEllipse(src, rcv, rho)
    expect(e!.a).toBeCloseTo(rho / 2)
    expect(isoTimeEllipse(src, rcv, 5000)).toBeNull()
    expect(blindPath(10000, 1)).toBeCloseTo(11500)
  })
  it('reduces to the monostatic Doppler when collocated', () => {
    const f = bistaticDopplerHz(3500, src, src, { x: 0, y: 5000 }, { x: 0, y: -5 })
    expect(f).toBeCloseTo((2 * 5 * 3500) / 1500, 3)
    expect(bistaticDopplerHz(3500, src, rcv, tgt, { x: 5, y: 0 })).toBeCloseTo(0, 6)
    expect(bistaticRangeResolutionM(400, 90)).toBeCloseTo(1.875 / Math.cos(45 * DEG), 3)
  })
})

describe('sonar equation', () => {
  it('balances the budget', () => {
    const r = solveBudget({ slDb: 220, tlOutDb: 80, tlBackDb: 80, tsDb: 10, beamNoiseDb: 50, reverbDb: 40, dtDb: 10 })
    expect(r.echoDb).toBeCloseTo(70)
    expect(r.maskingDb).toBeCloseTo(50.41, 1)
    expect(r.seDb).toBeCloseTo(9.59, 1)
    expect(r.limitedBy).toBe('noise')
    expect(figureOfMeritDb(220, 10, 50, 10)).toBe(170)
  })
  it('finds crossings and spans', () => {
    const x = [0, 1, 2, 3, 4]
    const se = [5, 1, -1, 3, -2]
    expect(zeroCrossings(x, se)).toHaveLength(3)
    expect(detectionSpans(x, se)).toEqual([
      [0, 1],
      [3, 3],
    ])
  })
})

describe('rng', () => {
  it('is reproducible and in range', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect(a.next()).toBe(b.next())
    const r = createRng(1)
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 9)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(9)
    }
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4])
    expect([0.5, 1, 1.5, 2]).toContain(r.step(0.5, 2, 0.5))
  })
})
