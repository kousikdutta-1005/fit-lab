/**
 * The character.
 *
 * It is drawn from the numbers rather than chosen from presets, so it cannot
 * flatter. Waist, shoulders and limb thickness are derived from the actual
 * measurements, which means the figure changes when the tape does and not
 * when the user would like it to.
 *
 * This is principle 2: the character is a mirror, not a fantasy.
 */

import type { FlatBodyShape } from "../lib/flat-body"

export type Look = {
  skin: string
  hair: string
  hairStyle: "short" | "medium" | "long" | "tied" | "none"
  facial: "none" | "stubble" | "beard"
}

export const SKINS = ["#8d5524", "#c68642", "#e0ac69", "#f1c27d", "#ffdbac", "#5c3317"]
export const HAIRS = ["#0f0d0c", "#2b1b12", "#4a3728", "#7a5c3e", "#a9a9a9", "#8a2f2f"]

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
 * recognisable enough that a person can compare it to a photo of themselves
 * and say "narrower than that" — which is the only kind of calibration this
 * product can honestly claim.
 *
 * It is also the fallback, so it has to answer the same measurements the 3D
 * figure does. It cannot answer them as well: it has no mesh to measure and no
 * cross-sections to scale, so it maps each reading onto a drawing unit and says
 * as much. What it must never do is ignore one, because then a person on a
 * cheap phone would be told their weight does not show.
 */
export function Character({
  build,
  look,
  shape,
  height = 320,
}: {
  build: Build
  look: Look
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
      <g transform={`translate(${cx} 196) scale(${stature.toFixed(3)}) translate(${-cx} -196)`}>
      {/* legs */}
      <path
        d={`M${cx - hip * 0.55} 120 C ${cx - hip * 0.5} 150, ${cx - leg * 1.5} 165, ${cx - leg * 1.35} 196`}
        stroke={look.skin}
        strokeWidth={leg * 1.85}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M${cx + hip * 0.55} 120 C ${cx + hip * 0.5} 150, ${cx + leg * 1.5} 165, ${cx + leg * 1.35} 196`}
        stroke={look.skin}
        strokeWidth={leg * 1.85}
        strokeLinecap="round"
        fill="none"
      />

      {/* arms */}
      <path
        d={`M${cx - shoulder * 0.92} 62 C ${cx - shoulder * 1.15 - soft * 3} 88, ${cx - shoulder * 1.0} 108, ${cx - shoulder * 0.95} 124`}
        stroke={look.skin}
        strokeWidth={arm * 1.35}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M${cx + shoulder * 0.92} 62 C ${cx + shoulder * 1.15 + soft * 3} 88, ${cx + shoulder * 1.0} 108, ${cx + shoulder * 0.95} 124`}
        stroke={look.skin}
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
        fill={look.skin}
      />

      {/* neck + head */}
      <rect x={cx - neck} y={44} width={neck * 2} height={12} rx={neck * 0.9} fill={look.skin} />
      <circle cx={cx} cy={34} r={headR} fill={look.skin} />

      {/* hair */}
      {look.hairStyle !== "none" && (
        <>
          <path
            d={`M${cx - headR - 0.6} 33 A ${headR + 0.6} ${headR + 0.6} 0 0 1 ${cx + headR + 0.6} 33 L ${cx + headR - 1} 30 L ${cx - headR + 1} 30 Z`}
            fill={look.hair}
          />
          {look.hairStyle === "medium" && (
            <path d={`M${cx - headR - 0.6} 33 q -1 8 1.5 12 l 3 -1 q -2.5 -6 -1.5 -11 Z`} fill={look.hair} />
          )}
          {look.hairStyle === "long" && (
            <>
              <path d={`M${cx - headR - 0.8} 32 q -2 16 1 26 l 4.5 -1 q -3 -12 -1.5 -25 Z`} fill={look.hair} />
              <path d={`M${cx + headR + 0.8} 32 q 2 16 -1 26 l -4.5 -1 q 3 -12 1.5 -25 Z`} fill={look.hair} />
            </>
          )}
          {look.hairStyle === "tied" && <circle cx={cx} cy={25.5} r={4} fill={look.hair} />}
        </>
      )}

      {look.facial !== "none" && (
        <path
          d={`M${cx - headR * 0.78} 36 q ${headR * 0.78} ${look.facial === "beard" ? 11 : 7}, ${headR * 1.56} 0 q -${headR * 0.78} ${look.facial === "beard" ? 6 : 3}, -${headR * 1.56} 0 Z`}
          fill={look.hair}
          opacity={look.facial === "stubble" ? 0.45 : 0.92}
        />
      )}
      </g>
    </svg>
  )
}

/** Shoulder-to-waist is the proportion people read as "built". */
export function defaultShoulderRatio(sex: "male" | "female"): number {
  return sex === "male" ? 1.42 : 1.28
}
