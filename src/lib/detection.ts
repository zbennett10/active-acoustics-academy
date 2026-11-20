export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return sign * y
}

export function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

export function normPdf(x: number, mean = 0, sd = 1): number {
  const u = (x - mean) / sd
  return Math.exp(-0.5 * u * u) / (sd * Math.sqrt(2 * Math.PI))
}

/** Inverse normal CDF (Acklam's rational approximation). */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const lo = 0.02425
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

export function qFunc(x: number): number {
  return 1 - normCdf(x)
}

/** Pd for a Gaussian shift-in-mean detector with detection index d (linear) at a false alarm rate. */
export function pdFromIndex(d: number, pfa: number): number {
  return qFunc(normInv(1 - pfa) - Math.sqrt(Math.max(d, 0)))
}

/** Detection index needed for a (Pd, Pfa) pair. */
export function detectionIndex(pd: number, pfa: number): number {
  const s = normInv(1 - pfa) - normInv(1 - pd)
  return s * s
}

/** Threshold in noise standard deviations for a false alarm probability. */
export function thresholdForPfa(pfa: number): number {
  return normInv(1 - pfa)
}

/** Urick's replica-correlator detection threshold, referenced to a 1 Hz noise band. */
export function dtCorrelatorDb(d: number, pulseS: number): number {
  return 10 * Math.log10(d / (2 * pulseS))
}

/** Probability of detection from signal excess with a lognormal fluctuation of sigma dB. */
export function podFromSe(seDb: number, sigmaDb = 8): number {
  return normCdf(seDb / sigmaDb)
}

/** Probability at least one of several independent looks detects. */
export function cumulativePd(pds: readonly number[]): number {
  return 1 - pds.reduce((acc, p) => acc * (1 - p), 1)
}
