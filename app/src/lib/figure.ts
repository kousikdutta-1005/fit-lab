/**
 * The two numbers the figure needs that nobody is asked for.
 *
 * They live here rather than beside the component so that importing them does
 * not drag a React component along with them, and so it is obvious at a glance
 * that these are defaults rather than readings.
 */

/** Shoulder-to-waist is the proportion people read as "built". */
export function defaultShoulderRatio(sex: "male" | "female"): number {
  return sex === "male" ? 1.42 : 1.28
}

/**
 * How much muscle the figure is drawn with when nobody has been asked.
 *
 * The onboarding does not ask, because a guess at your own muscle mass is not a
 * measurement and this product should not draw one as if it were. The value
 * sits below the middle on purpose: a figure that under-draws is honest, and
 * one that over-draws flatters.
 */
export const DEFAULT_MUSCLE = 0.35

/**
 * What the figure says about itself to a screen reader.
 *
 * The rule is that it may only describe numbers the person actually entered.
 * The old label read them straight off the drawing, and the drawing is alive
 * from the first frame, so somebody who had entered nothing was told they were
 * 170 centimetres tall and weighed 70 kilograms — seed values, announced as
 * measurements, to the one audience that cannot see that the screen is still
 * blank.
 *
 * It also never mentions build. Shoulder width and muscle mass are drawn from a
 * default nobody was asked for, so "moderately built limbs" was a description
 * of a constant.
 */
export type EnteredMeasurements = {
  heightCm?: number
  weightKg?: number
  waistCm?: number
  hipCm?: number
}

export function figureLabel(entered: EnteredMeasurements | null): string {
  if (entered === null) {
    return "An illustration of a body. It is not drawn from your measurements."
  }

  const parts: string[] = []
  if (entered.heightCm !== undefined) parts.push(`${Math.round(entered.heightCm)} centimetres tall`)
  if (entered.weightKg !== undefined) parts.push(`weighing ${Math.round(entered.weightKg)} kilograms`)
  if (entered.waistCm !== undefined)
    parts.push(`with a waist of about ${Math.round(entered.waistCm)} centimetres`)
  if (entered.hipCm) parts.push(`and hips of about ${Math.round(entered.hipCm)} centimetres`)

  if (parts.length === 0) {
    return "An illustration of a body. You have not entered any measurements yet."
  }

  return `A figure drawn from the measurements you have entered: ${parts.join(", ")}.`
}

/**
 * The silhouette shown before sex has been answered.
 *
 * It is deliberately between the two base meshes rather than either of them,
 * because the alternative is drawing a male body at somebody and calling it a
 * placeholder.
 */
export const NEUTRAL_SHAPE = {
  stature: 1,
  waist: 19,
  hip: 21,
  chest: 19.5,
  shoulder: 26,
  neck: 3.45,
  arm: 4.25,
  leg: 4.3,
  soft: 0.35,
}
