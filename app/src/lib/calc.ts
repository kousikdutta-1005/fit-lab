/**
 * Body composition estimates from a tape measure and a weighing scale.
 *
 * Every function here returns a band or a range rather than a single number,
 * because a tape reading carries 2-5cm of error and that is enough to move
 * someone across a threshold they would otherwise be told they had crossed.
 */

export type Sex = "male" | "female"

/**
 * Ancestry is asked for one reason only: the thresholds genuinely differ, and
 * applying European cut-offs to everyone is not "global", it is a default
 * dressed up as neutrality.
 *
 * WHO's 2004 expert consultation (Lancet 2004;363(9403):157-163, PMID 14726171)
 * found that Asian populations carry the risk associated with a BMI of 25-30 in
 * European populations at a BMI of roughly 23-27.5.
 *
 * Ancestry is a crude proxy for a biological difference and the product says so
 * where it is used. Nobody is required to answer.
 */
export type Ancestry = "south-asian" | "east-asian" | "other" | "unsaid"

export type Profile = {
  age: number
  sex: Sex
  ancestry: Ancestry
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

/** True where the WHO Asian-specific cut-offs apply. */
export function usesAsianCutoffs(ancestry: Ancestry): boolean {
  return ancestry === "south-asian" || ancestry === "east-asian"
}

export type Thresholds = {
  overweight: number
  obese: number
  waist: number
  /** Shown to the reader, so the choice of threshold is never invisible. */
  source: string
}

export function thresholds(sex: Sex, ancestry: Ancestry): Thresholds {
  if (usesAsianCutoffs(ancestry)) {
    return {
      overweight: 23,
      obese: 27.5,
      waist: sex === "male" ? 90 : 80,
      source:
        "WHO Asian cut-offs. Asian bodies carry at a BMI of 23 roughly the risk European bodies carry at 25, so using 25 here would tell you that you are fine when you are not.",
    }
  }
  return {
    overweight: 25,
    obese: 30,
    waist: sex === "male" ? 94 : 80,
    source:
      ancestry === "unsaid"
        ? "Standard international cut-offs, used because you did not say. If you are of Asian ancestry these are too generous by about two points and this reading is flattering you."
        : "Standard international cut-offs.",
  }
}

/**
 * BMI banded against the cut-offs that actually apply to this person.
 */
export function bmiBand(value: number, t: Thresholds): Band {
  if (value < 18.5)
    return {
      label: "Below the healthy range",
      tone: "low",
      note: "Being underweight carries its own risks. Here, gaining is the goal, not losing.",
    }
  if (value < t.overweight)
    return { label: "Healthy range", tone: "ok", note: t.source }
  if (value < t.obese)
    return { label: "Raised", tone: "raised", note: t.source }
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
 * Abdominal obesity threshold, which varies by ancestry as well as by sex.
 * IDF: 94cm for European men, 90cm for South Asian and Chinese men, 80cm for
 * women across both.
 */
export function waistRaised(waistCm: number, t: Thresholds): boolean {
  return waistCm >= t.waist
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
