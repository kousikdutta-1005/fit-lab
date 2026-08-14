import type { BodyInput, BodyParams } from "./body-model.ts"
import { bodyParams, clampNote } from "./body-model.ts"
import type { BodyProfile } from "./body-profile.ts"
import type { Sex } from "./calc.ts"

export type FlatBodyShape = {
  stature: number
  waist: number
  hip: number
  chest: number
  shoulder: number
  neck: number
  arm: number
  leg: number
  soft: number
}

export type BodyPresentation = {
  params: BodyParams
  flat: FlatBodyShape
  limitNote: string | null
}

const BASE: Record<Sex, Omit<FlatBodyShape, "stature" | "soft">> = {
  male: { waist: 20, hip: 21, chest: 21, shoulder: 29, neck: 3.6, arm: 4.3, leg: 4.3 },
  female: { waist: 18, hip: 21, chest: 18, shoulder: 23, neck: 3.3, arm: 4.2, leg: 4.3 },
}

export function flatBodyShape(params: BodyParams, sex: Sex): FlatBodyShape {
  const base = BASE[sex]
  return {
    stature: params.stature,
    waist: base.waist * params.waist.width,
    hip: base.hip * params.hip.width,
    chest: base.chest * params.chest.width,
    shoulder: base.shoulder * params.shoulder.width,
    neck: base.neck * params.neck,
    arm: base.arm * params.arm,
    leg: base.leg * params.leg,
    soft: Math.max(0, Math.min(1, (params.waist.depth / params.waist.width - 0.85) / 0.45)),
  }
}

export function bodyPresentation(input: BodyInput, profile: BodyProfile): BodyPresentation {
  const params = bodyParams(input, profile)
  return {
    params,
    flat: flatBodyShape(params, input.sex),
    limitNote: clampNote(params),
  }
}
