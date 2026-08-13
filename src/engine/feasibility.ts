import type { Build, FeasibilityResult } from '../types'
import { computeBmi } from './score'

// ---------------------------------------------------------------------------
// Healthy rate constants (evidence-based)
// ---------------------------------------------------------------------------

const MAX_FAT_LOSS_KG_PER_WEEK = 0.75   // ~750 kcal deficit/day
const MAX_MUSCLE_GAIN_KG_PER_WEEK = 0.25 // hard ceiling for natural trainees
const KCAL_PER_KG_FAT = 7700
const KCAL_PER_KG_MUSCLE = 5000

// ---------------------------------------------------------------------------
// Estimated TDEE using Mifflin-St Jeor + sedentary activity factor
// ---------------------------------------------------------------------------

function estimateTdee(build: Build): number {
  const { sex, heightCm, weightKg, age } = build
  const bmr =
    sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  // Sedentary factor 1.2 — user hasn't said activity level yet
  return Math.round(bmr * 1.2)
}

// ---------------------------------------------------------------------------
// Main feasibility computation
// ---------------------------------------------------------------------------

export function computeFeasibility(build: Build): FeasibilityResult {
  const { goal, weightKg, targetWeightKg, timelineWeeks } = build
  const tdee = estimateTdee(build)
  const bmi = computeBmi(weightKg, build.heightCm)

  if (goal === 'improve-cardio' || goal === 'general-fitness') {
    return {
      verdict: 'achievable',
      weeksToGoal: null,
      weeklyRateKg: null,
      dailyCalorieDelta: null,
      summary:
        goal === 'improve-cardio'
          ? 'Cardio improves measurably in 4–6 weeks of consistent training. Your fitness score will rise with each week you stay consistent.'
          : 'General fitness is always achievable. Focus on consistency over intensity — even 3 sessions/week compounds dramatically over 12 weeks.',
    }
  }

  if (goal === 'lose-fat') {
    const delta = targetWeightKg != null ? weightKg - targetWeightKg : null

    if (delta !== null && delta <= 0) {
      return {
        verdict: 'unrealistic',
        weeksToGoal: null,
        weeklyRateKg: null,
        dailyCalorieDelta: null,
        summary: 'Your target weight is at or above your current weight. Adjust your goal.',
      }
    }

    const weeklyRate = Math.min(MAX_FAT_LOSS_KG_PER_WEEK, weightKg * 0.01) // cap at 1% body weight/wk
    const weeksNeeded = delta != null ? Math.ceil(delta / weeklyRate) : null
    const dailyDeficit = Math.round((weeklyRate * KCAL_PER_KG_FAT) / 7)

    let verdict: FeasibilityResult['verdict'] = 'achievable'
    if (timelineWeeks != null && weeksNeeded != null) {
      const ratio = weeksNeeded / timelineWeeks
      if (ratio > 1.5) verdict = 'unrealistic'
      else if (ratio > 1.1) verdict = 'stretch'
    }

    // Warn if BMI is already in healthy range and delta is large
    if (bmi < 22 && delta != null && delta > 5) verdict = 'stretch'

    const summaryParts: string[] = []
    if (delta != null)
      summaryParts.push(`Losing ${delta.toFixed(1)} kg at a healthy pace takes ~${weeksNeeded} weeks`)
    summaryParts.push(`Aim for a ~${dailyDeficit} kcal/day deficit (your TDEE ≈ ${tdee} kcal)`)
    if (verdict === 'unrealistic' && timelineWeeks != null && weeksNeeded != null)
      summaryParts.push(`Your timeline of ${timelineWeeks} wks is too aggressive — it would require unsafe restriction`)

    return {
      verdict,
      weeksToGoal: weeksNeeded,
      weeklyRateKg: weeklyRate,
      dailyCalorieDelta: -dailyDeficit,
      summary: summaryParts.join('. ') + '.',
    }
  }

  if (goal === 'build-muscle') {
    const delta = targetWeightKg != null ? targetWeightKg - weightKg : null

    if (delta !== null && delta <= 0) {
      return {
        verdict: 'unrealistic',
        weeksToGoal: null,
        weeklyRateKg: null,
        dailyCalorieDelta: null,
        summary: 'Your target weight is below your current weight. For muscle gain, set a higher target.',
      }
    }

    const weeklyRate = MAX_MUSCLE_GAIN_KG_PER_WEEK
    const weeksNeeded = delta != null ? Math.ceil(delta / weeklyRate) : null
    const dailySurplus = Math.round((weeklyRate * KCAL_PER_KG_MUSCLE) / 7)

    let verdict: FeasibilityResult['verdict'] = 'achievable'
    if (timelineWeeks != null && weeksNeeded != null) {
      const ratio = weeksNeeded / timelineWeeks
      if (ratio > 1.5) verdict = 'unrealistic'
      else if (ratio > 1.1) verdict = 'stretch'
    }

    const summaryParts: string[] = []
    if (delta != null)
      summaryParts.push(`Gaining ${delta.toFixed(1)} kg of lean mass takes a minimum of ~${weeksNeeded} weeks`)
    summaryParts.push(`Eat ~${dailySurplus} kcal/day above maintenance (TDEE ≈ ${tdee} kcal)`)
    if (verdict === 'unrealistic' && timelineWeeks != null && weeksNeeded != null)
      summaryParts.push(`${timelineWeeks} weeks isn't enough — muscle biology has a hard ceiling`)

    return {
      verdict,
      weeksToGoal: weeksNeeded,
      weeklyRateKg: weeklyRate,
      dailyCalorieDelta: dailySurplus,
      summary: summaryParts.join('. ') + '.',
    }
  }

  // Fallback
  return {
    verdict: 'achievable',
    weeksToGoal: null,
    weeklyRateKg: null,
    dailyCalorieDelta: null,
    summary: 'Stay consistent — results compound over time.',
  }
}
