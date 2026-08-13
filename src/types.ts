/** Core user-submitted build / assessment */
export interface Build {
  /** Biological sex — determines which base mesh to render */
  sex: 'male' | 'female'
  heightCm: number
  weightKg: number
  waistCm: number
  /** Hip circumference — primarily relevant for female body-shape scoring */
  hipCm?: number
  age: number
  /** Optional grip strength in kg (one hand) */
  gripKg?: number
}

export type Phase = 'form' | 'result'
