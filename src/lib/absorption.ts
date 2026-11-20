/** Thorp (1967). f in kHz, result in dB/km. Good below about 50 kHz. */
export function thorpDbPerKm(fKhz: number): number {
  const f2 = fKhz * fKhz
  return (0.11 * f2) / (1 + f2) + (44 * f2) / (4100 + f2) + 2.75e-4 * f2 + 0.003
}

/** Ainslie and McColm (1998). f in kHz, T in deg C, S in PSU, depth in km. */
export function ainslieMcColmDbPerKm(fKhz: number, tC = 10, sPsu = 35, depthKm = 0, pH = 8): number {
  const f2 = fKhz * fKhz
  const f1 = 0.78 * Math.sqrt(sPsu / 35) * Math.exp(tC / 26)
  const fMg = 42 * Math.exp(tC / 17)
  const boric = ((0.106 * f1 * f2) / (f1 * f1 + f2)) * Math.exp((pH - 8) / 0.56)
  const mgso4 = 0.52 * (1 + tC / 43) * (sPsu / 35) * ((fMg * f2) / (fMg * fMg + f2)) * Math.exp(-depthKm / 6)
  const water = 0.00049 * f2 * Math.exp(-(tC / 27 + depthKm / 17))
  return boric + mgso4 + water
}

export type SpreadingLaw = 'spherical' | 'cylindrical' | 'practical' | 'hybrid'

export function spreadingLossDb(rangeM: number, law: SpreadingLaw, transitionM = 1000): number {
  const r = Math.max(rangeM, 1)
  switch (law) {
    case 'spherical':
      return 20 * Math.log10(r)
    case 'cylindrical':
      return 10 * Math.log10(r)
    case 'practical':
      return 15 * Math.log10(r)
    case 'hybrid':
      return r <= transitionM ? 20 * Math.log10(r) : 20 * Math.log10(transitionM) + 10 * Math.log10(r / transitionM)
  }
}

export function simpleTlDb(rangeM: number, fKhz: number, law: SpreadingLaw = 'spherical', transitionM = 1000): number {
  return spreadingLossDb(rangeM, law, transitionM) + (thorpDbPerKm(fKhz) * Math.max(rangeM, 1)) / 1000
}
