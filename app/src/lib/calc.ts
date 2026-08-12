/**
 * Body composition estimates from a tape measure and a weighing scale.
 *
 * Every function here returns a band or a range rather than a single number,
 * because a tape reading carries 2-5cm of error and that is enough to move
 * someone across a threshold they would otherwise be told they had crossed.
 */

export type Sex = "male" | "female"

export type Profile = {
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  waistCm: number
  neckCm: number
  hipCm: number
}

/** Tape measurement error we assume, in cm. Used to widen every derived range. */
export const TAPE_ERROR_CM = 2

export type Tone = "low" | "ok" | "raised" | "high"

export type Band = {
  label: string
  tone: Tone
  note: string
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return weightKg / (m * m)
}

/**
 * WHO Asian-specific BMI cut-offs, not the 25/30 used for European populations.
 * WHO Expert Consultation, Lancet 2004;363(9403):157-163. PMID 14726171.
 */
export function bmiBand(value: number): Band {
  if (value < 18.5)
    return {
      label: "Below the healthy range",
      tone: "low",
      note: "Being underweight carries its own risks. Here, gaining is the goal, not losing.",
    }
  if (value < 23)
    return {
      label: "Healthy range",
      tone: "ok",
      note: "For Asian bodies the healthy ceiling is 23, not 25.",
    }
  if (value < 27.5)
    return {
      label: "Raised",
      tone: "raised",
      note: "India's 2025 guidelines call this Stage 1, when there is no organ or functional effect.",
    }
  return {
    label: "High",
    tone: "high",
    note: "Worth a conversation with a doctor, alongside anything you do about training.",
  }
}

/**
 * Waist-to-height ratio. Needs no scale, only a tape, and for South Asian
 * bodies it is a more honest single number than BMI.
 */
export function whtr(waistCm: number, heightCm: number): number {
  return waistCm / heightCm
}

export function whtrBand(value: number): Band {
  if (value < 0.4)
    return { label: "Low", tone: "low", note: "Below the usual healthy range." }
  if (value < 0.5)
    return {
      label: "Healthy",
      tone: "ok",
      note: "Your waist is less than half your height, which is the line that matters most.",
    }
  if (value < 0.6)
    return {
      label: "Raised",
      tone: "raised",
      note: "Your waist is more than half your height. This is the number to move.",
    }
  return {
    label: "High",
    tone: "high",
    note: "Central fat is the strongest signal in this assessment. Worth medical advice.",
  }
}

/**
 * Abdominal obesity thresholds for Indian bodies: 90cm men, 80cm women.
 * IDF South Asia consensus, carried into Misra et al. 2025.
 */
export function waistRaised(waistCm: number, sex: Sex): boolean {
  return waistCm >= (sex === "male" ? 90 : 80)
}

/**
 * US Navy body fat estimate, metric form.
 * Hodgdon & Beckett, Naval Health Research Center, 1984.
 * Standard error is roughly 3.5-4.5 percentage points, and it has never been
 * validated on South Asian bodies. Treat it as a range, never as a reading.
 */
export function navyBodyFat(p: Profile): number | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = p
  if (sex === "male") {
    const d = waistCm - neckCm
    if (d <= 0) return null
    const v =
      495 / (1.0324 - 0.19077 * Math.log10(d) + 0.15456 * Math.log10(heightCm)) -
      450
    return clamp(v, 2, 60)
  }
  const d = waistCm + hipCm - neckCm
  if (d <= 0) return null
  const v =
    495 / (1.29579 - 0.35004 * Math.log10(d) + 0.221 * Math.log10(heightCm)) - 450
  return clamp(v, 5, 65)
}

/** The honest presentation of a body fat estimate: a range, not a number. */
export function bodyFatRange(p: Profile): { low: number; high: number } | null {
  const mid = navyBodyFat(p)
  if (mid === null) return null
  const wide = navyBodyFat({ ...p, waistCm: p.waistCm + TAPE_ERROR_CM })
  const spread = wide === null ? 4 : Math.max(Math.abs(wide - mid), 3.5)
  return { low: Math.max(2, mid - spread), high: mid + spread }
}

export function leanMassKg(weightKg: number, bodyFatPct: number): number {
  return weightKg * (1 - bodyFatPct / 100)
}

/** Fat-free mass index, height-normalised as in the original Kouri method. */
export function ffmi(leanKg: number, heightCm: number): number {
  const m = heightCm / 100
  return leanKg / (m * m) + 6.1 * (1.8 - m)
}

/**
 * The rough natural ceiling. Kouri et al. 1995 measured 74 natural athletes and
 * found they clustered under about 25. It is a reference point, not a law, and
 * there is no South Asian data behind it at all.
 */
export function ffmiCeiling(sex: Sex): number {
  return sex === "male" ? 25 : 22
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

export function round(v: number, dp = 1): number {
  const f = 10 ** dp
  return Math.round(v * f) / f
}
