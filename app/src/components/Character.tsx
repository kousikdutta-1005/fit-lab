/**
 * The character.
 *
 * It is drawn from the numbers rather than chosen from presets, so it cannot
 * flatter. Waist, shoulders and limb thickness are derived from the actual
 * measurements, which means the figure changes when the tape does and not
 * when the user would like it to.
 *
 * This is principle 2: the character is a mirror, not a fantasy.
 *
 * There is no skin tone and no hair here, and that is deliberate. The 3D layer
 * has always rendered a teal scan rather than a person, so the flat fallback
 * now matches it. It also settles a problem the old creator had: a palette with
 * a preselected swatch makes one skin tone the default, and PRODUCT.md says no
 * body may be treated as the default or the goal state. A scan has no tone to
 * default to, and the only thing this product claims to show — the shape your
 * own measurements make — is untouched by dropping the rest.
 */

import type { FlatBodyShape } from "../lib/flat-body"

export type Build = {
  sex: "male" | "female"
  heightCm: number
  weightKg: number
  /** Hip circumference in cm. 0 when not measured. */
  hipCm: number
  /** Waist circumference in cm. */
  waistCm: number
  /** Neck circumference in cm. */
  neckCm: number
  /** Shoulder breadth as a multiple of waist. Higher reads as broader. */
  shoulderRatio: number
  /** 0-1, drives limb and torso thickness. */
  muscle: number
  /** Estimated body fat percentage, drives softness of the outline. */
  bodyFat: number
}

/**
 * Everything below is proportional drawing, not anatomy. It exists to be
 * recognisable enough that a person can compare it to themselves and say
 * "narrower than that" — which is the only kind of calibration this product can
 * honestly claim.
 *
 * It is also the fallback, so it has to answer the same measurements the 3D
 * figure does. It cannot answer them as well: it has no mesh to measure and no
 * cross-sections to scale, so it maps each reading onto a drawing unit and says
 * as much. What it must never do is ignore one, because then a person on a
 * cheap phone would be told their weight does not show.
 */
export function Character({
  build,
  shape,
  height = 320,
}: {
  build: Build
  shape: FlatBodyShape
  height?: number
}) {
  const { heightCm, weightKg, waistCm, muscle } = build
  const { waist, shoulder, hip, chest, neck, arm, leg, soft, stature } = shape
  const cx = 60
  const headR = 8.4

  return (
    <svg
      viewBox="0 -28 120 238"
      height={height}
      role="img"
      aria-label={`A figure ${Math.round(heightCm)} centimetres tall, weighing ${Math.round(weightKg)} kilograms, with a waist of about ${Math.round(waistCm)} centimetres and ${muscle > 0.6 ? "muscular" : muscle > 0.3 ? "moderately built" : "lightly built"} limbs.`}
      style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}
    >
      <defs>
        {/* One ramp across the whole figure, in user space. Per-element
            gradients would restart on every limb, and the arms would read as
            stripes laid over the torso instead of part of the same body. */}
        <linearGradient id="scan-body" gradientUnits="userSpaceOnUse" x1="60" y1="26" x2="60" y2="196">
          <stop offset="0%" stopColor="#2fb3a8" />
          <stop offset="55%" stopColor="#18808a" />
          <stop offset="100%" stopColor="#0d4d5e" />
        </linearGradient>
      </defs>

      <g transform={`translate(${cx} 196) scale(${stature.toFixed(3)}) translate(${-cx} -196)`}>
        {/* legs */}
        <path
          d={`M${cx - hip * 0.55} 120 C ${cx - hip * 0.5} 150, ${cx - leg * 1.5} 165, ${cx - leg * 1.35} 196`}
          stroke="url(#scan-body)"
          strokeWidth={leg * 1.85}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={`M${cx + hip * 0.55} 120 C ${cx + hip * 0.5} 150, ${cx + leg * 1.5} 165, ${cx + leg * 1.35} 196`}
          stroke="url(#scan-body)"
          strokeWidth={leg * 1.85}
          strokeLinecap="round"
          fill="none"
        />

        {/* arms */}
        <path
          d={`M${cx - shoulder * 0.92} 62 C ${cx - shoulder * 1.15 - soft * 3} 88, ${cx - shoulder * 1.0} 108, ${cx - shoulder * 0.95} 124`}
          stroke="url(#scan-body)"
          strokeWidth={arm * 1.35}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={`M${cx + shoulder * 0.92} 62 C ${cx + shoulder * 1.15 + soft * 3} 88, ${cx + shoulder * 1.0} 108, ${cx + shoulder * 0.95} 124`}
          stroke="url(#scan-body)"
          strokeWidth={arm * 1.35}
          strokeLinecap="round"
          fill="none"
        />

        {/* torso: shoulders taper to waist, then out to hips */}
        <path
          d={`
          M${cx - shoulder} 60
          C ${cx - chest - soft * 2} 78, ${cx - waist - soft * 3} 92, ${cx - waist} 106
          C ${cx - waist + 1} 114, ${cx - hip} 116, ${cx - hip} 124
          L ${cx + hip} 124
          C ${cx + hip} 116, ${cx + waist - 1} 114, ${cx + waist} 106
          C ${cx + waist + soft * 3} 92, ${cx + chest + soft * 2} 78, ${cx + shoulder} 60
          C ${cx + shoulder * 0.6} 54, ${cx - shoulder * 0.6} 54, ${cx - shoulder} 60
          Z`}
          fill="url(#scan-body)"
        />

        {/* neck + head */}
        {/* The neck runs from behind the middle of the head down into the
            shoulders, and the head is drawn over it. Anchoring it to the head's
            centre rather than to its underside means no combination of stature
            and neck width can leave the head floating. */}
        <rect x={cx - neck} y={34} width={neck * 2} height={24} rx={neck * 0.9} fill="url(#scan-body)" />
        <circle cx={cx} cy={34} r={headR} fill="url(#scan-body)" />
      </g>

      {/* One sweep line, so the flat figure reads as the same scan the 3D layer
          is rather than as a different drawing. */}
      <line x1={10} x2={110} y1={100} y2={100} stroke="#7bffe9" strokeOpacity={0.22} strokeWidth={0.7} />
    </svg>
  )
}
