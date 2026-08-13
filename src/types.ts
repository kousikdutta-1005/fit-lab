/** Core user-submitted build / assessment */
export interface Build {
  /** Biological sex — determines which base mesh to render */
  sex: 'male' | 'female'
  heightCm: number
  weightKg: number
  waistCm: number
  /** Hip circumference — primarily relevant for female body-shape scoring */
  hipCm?: number
  neckCm?: number
  age: number
  /** Optional grip strength in kg (one hand) */
  gripKg?: number
  /** User's primary fitness goal */
  goal: GoalType
  /** Target weight in kg (for lose-fat / build-muscle goals) */
  targetWeightKg?: number
  /** Desired timeline in weeks */
  timelineWeeks?: number
  /** Preferred training environment */
  equipment: 'gym' | 'floor'
}

export type GoalType =
  | 'lose-fat'
  | 'build-muscle'
  | 'improve-cardio'
  | 'general-fitness'

export type Phase = 'form' | 'result'

// ---------------------------------------------------------------------------
// Assessment outputs
// ---------------------------------------------------------------------------

export interface FitnessScore {
  /** 0–100 overall fitness score */
  overall: number
  /** Estimated body fat % (US Navy method) */
  bodyFatPct: number
  /** Biological fitness age estimate */
  fitnessAge: number
  bmi: number
  bmiCategory: 'underweight' | 'normal' | 'overweight' | 'obese'
  whr?: number
  whrRisk?: 'low' | 'moderate' | 'high'
  gripPercentile?: number
}

export interface FeasibilityResult {
  verdict: 'achievable' | 'stretch' | 'unrealistic'
  /** Weeks to reach goal at a healthy rate */
  weeksToGoal: number | null
  /** Weekly rate of change (kg) */
  weeklyRateKg: number | null
  /** Daily calorie adjustment needed */
  dailyCalorieDelta: number | null
  summary: string
}

export interface Exercise {
  name: string
  sets: string
  reps: string
  rest: string
  tip?: string
}

export interface MuscleGroup {
  name: string
  emoji: string
  gym: Exercise[]
  floor: Exercise[]
}
