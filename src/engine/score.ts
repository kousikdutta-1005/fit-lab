import type { Build, FitnessScore } from '../types'

// ---------------------------------------------------------------------------
// US Navy Body Fat % estimation
// Uses log10-based formula — accurate to ±3% vs DEXA in healthy adults.
// ---------------------------------------------------------------------------

export function estimateBodyFat(build: Build): number {
  const { sex, heightCm, waistCm, neckCm, hipCm } = build
  const neck = neckCm ?? waistCm * 0.38 // rough estimate if not provided

  if (sex === 'male') {
    // Male: 495 / (1.0324 - 0.19077*log10(waist-neck) + 0.15456*log10(height)) - 450
    const val = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neck) + 0.15456 * Math.log10(heightCm)) - 450
    return clamp(val, 3, 50)
  } else {
    // Female: 495 / (1.29579 - 0.35004*log10(waist+hip-neck) + 0.22100*log10(height)) - 450
    const hip = hipCm ?? waistCm * 1.15
    const val = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hip - neck) + 0.22100 * Math.log10(heightCm)) - 450
    return clamp(val, 8, 60)
  }
}

// ---------------------------------------------------------------------------
// BMI
// ---------------------------------------------------------------------------

export function computeBmi(weightKg: number, heightCm: number): number {
  return weightKg / Math.pow(heightCm / 100, 2)
}

export function bmiCategory(bmi: number): FitnessScore['bmiCategory'] {
  if (bmi < 18.5) return 'underweight'
  if (bmi < 25) return 'normal'
  if (bmi < 30) return 'overweight'
  return 'obese'
}

// ---------------------------------------------------------------------------
// WHR risk
// ---------------------------------------------------------------------------

export function whrRisk(whr: number, sex: Build['sex']): FitnessScore['whrRisk'] {
  if (sex === 'female') {
    return whr > 0.85 ? 'high' : whr > 0.80 ? 'moderate' : 'low'
  }
  return whr > 1.00 ? 'high' : whr > 0.90 ? 'moderate' : 'low'
}

// ---------------------------------------------------------------------------
// Grip strength percentile (NHANES reference, simplified)
// Returns 0–100 percentile rank
// ---------------------------------------------------------------------------

export function gripPercentile(gripKg: number, sex: Build['sex'], age: number): number {
  // Approximate medians and SDs from NHANES (dominant hand, kg)
  const refs: [number, number, number][] = // [maxAge, median, sd]
    sex === 'male'
      ? [[29, 46, 9], [49, 44, 9], [69, 38, 9], [120, 30, 8]]
      : [[29, 28, 6], [49, 27, 6], [69, 23, 6], [120, 18, 5]]

  const [, median, sd] = refs.find(([maxAge]) => age <= maxAge) ?? refs[refs.length - 1]
  const z = (gripKg - median) / sd
  // Approximate normal CDF
  return clamp(Math.round(normalCdf(z) * 100), 1, 99)
}

// ---------------------------------------------------------------------------
// Fitness age
// Penalises high body fat, high WHR, low grip; rewards normal BMI
// ---------------------------------------------------------------------------

export function computeFitnessAge(build: Build, bodyFatPct: number, gripPct?: number): number {
  const bmi = computeBmi(build.weightKg, build.heightCm)
  const whr = build.hipCm ? build.waistCm / build.hipCm : null

  let delta = 0

  // BMI penalty/bonus
  if (bmi < 18.5) delta += 3
  else if (bmi < 22) delta -= 2
  else if (bmi < 25) delta -= 1
  else if (bmi < 30) delta += 3
  else delta += 7

  // Body fat penalty
  const bfRef = build.sex === 'male' ? 18 : 25
  delta += (bodyFatPct - bfRef) * 0.4

  // WHR penalty
  if (whr) {
    const threshold = build.sex === 'female' ? 0.80 : 0.90
    if (whr > threshold) delta += (whr - threshold) * 30
  }

  // Grip bonus/penalty
  if (gripPct !== undefined) {
    delta -= (gripPct - 50) * 0.08 // above median → younger
  }

  return Math.round(clamp(build.age + delta, build.age - 10, build.age + 20))
}

// ---------------------------------------------------------------------------
// Overall fitness score 0–100
// ---------------------------------------------------------------------------

export function computeFitnessScore(build: Build): FitnessScore {
  const bmi = computeBmi(build.weightKg, build.heightCm)
  const cat = bmiCategory(bmi)
  const bodyFatPct = estimateBodyFat(build)
  const whr = build.hipCm ? build.waistCm / build.hipCm : undefined
  const risk = whr ? whrRisk(whr, build.sex) : undefined
  const gripPct = build.gripKg ? gripPercentile(build.gripKg, build.sex, build.age) : undefined
  const fitnessAge = computeFitnessAge(build, bodyFatPct, gripPct)

  // Score components (each 0–100)
  const bmiScore = bmi < 18.5 ? 50 : bmi < 22 ? 95 : bmi < 25 ? 85 : bmi < 30 ? 60 : bmi < 35 ? 35 : 15
  const bfScore = (() => {
    const ideal = build.sex === 'male' ? 15 : 22
    const diff = Math.abs(bodyFatPct - ideal)
    return clamp(100 - diff * 3, 10, 100)
  })()
  const whrScore = risk === 'low' ? 90 : risk === 'moderate' ? 60 : risk === 'high' ? 30 : 75
  const gripScore = gripPct ?? 50

  const overall = Math.round(bmiScore * 0.25 + bfScore * 0.30 + whrScore * 0.25 + gripScore * 0.20)

  return {
    overall: clamp(overall, 5, 99),
    bodyFatPct: Math.round(bodyFatPct * 10) / 10,
    fitnessAge,
    bmi: Math.round(bmi * 10) / 10,
    bmiCategory: cat,
    whr: whr ? Math.round(whr * 100) / 100 : undefined,
    whrRisk: risk,
    gripPercentile: gripPct,
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

/** Approximation of the normal CDF using the Horner method */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const p = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly
  return z >= 0 ? p : 1 - p
}
