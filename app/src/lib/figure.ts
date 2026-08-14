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
