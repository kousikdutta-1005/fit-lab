/**
 * From a tape and a scale to a set of bounded, finite shape parameters.
 *
 * This module is the whole answer to "does the figure actually respond to what
 * I typed". Every physiologically meaningful input on the first screen arrives
 * here and leaves as a number some part of the mesh is scaled by. Nothing else
 * in the app is allowed to invent a body dimension.
 *
 * Three rules hold it together, and they are the reason the earlier version
 * produced a figure that was neither responsive nor human:
 *
 * 1. Where there is a tape reading, the tape wins. Waist, hip and neck set
 *    their own cross-sections outright. Weight never overrules them.
 * 2. Where there is no tape reading, the number is inferred, bounded, and
 *    labelled as inferred. Chest is the main one.
 * 3. Everything is clamped to a range a human body can occupy, and when an
 *    input is pushed past what the mesh can be drawn as, the clamp is reported
 *    rather than hidden. A model that renders a monster to satisfy a slider is
 *    worse than one that says it has stopped.
 *
 * All lengths here are fractions of stature unless a name ends in Cm.
 */

import { clamp } from "./calc.ts"
import type { Sex } from "./calc.ts"
import type { BodyProfile } from "./body-profile.ts"

export type BodyInput = {
  sex: Sex
  heightCm: number
  weightKg: number
  waistCm: number
  neckCm: number
  /** Hip circumference in cm, or 0 when it was not measured. */
  hipCm: number
  /** Shoulder breadth as a multiple of waist, as the slider reports it. */
  shoulderRatio: number
  /** Self-reported muscle, 0 to 1. */
  muscle: number
  /** Body fat percentage, from the tape via the Navy estimate. */
  bodyFatPct: number
}

/** A cross-section responds in two directions, and they are not the same. */
export type SectionScale = {
  /** Side to side, relative to the base mesh. */
  width: number
  /** Front to back, relative to the base mesh. */
  depth: number
}

export type BodyParams = {
  /** Rendered stature relative to a 170cm reference. Feet stay on the floor. */
  stature: number
  hip: SectionScale
  waist: SectionScale
  chest: SectionScale
  shoulder: SectionScale
  /** Neck and upper trapezius thickness. */
  neck: number
  /** Arm thickness about the arm's own axis. */
  arm: number
  /** Leg thickness about each leg's own axis. */
  leg: number
  /** What the figure is being drawn as, for the readout. */
  read: {
    bmi: number
    waistCm: number
    hipCm: number
    /** Inferred, never measured. The interface says so. */
    chestCm: number
    neckCm: number
    /** Litres, from the deformed mesh's own cross-sections. */
    volumeLitres: number
    /** Litres, from mass and the two-compartment density estimate. */
    targetLitres: number
  }
  /**
   * Anything the model refused to draw, in the reader's own terms. Empty for
   * every ordinary set of measurements.
   */
  notes: string[]
}

/** The stature the figure is drawn at when it is drawn at scale 1. */
export const REFERENCE_STATURE_CM = 170

/**
 * The ranges this model will draw. Outside them it clamps and says so.
 *
 * The input ranges match the sliders. The scale ranges are the part that keeps
 * a body a body: a torso may not become a plank or a barrel, a limb may not
 * become a thread or a trunk, and a neck may not become either.
 */
export const LIMITS = {
  heightCm: [130, 210],
  weightKg: [30, 200],
  waistCm: [45, 175],
  neckCm: [22, 65],
  hipCm: [55, 190],
  shoulderRatio: [1.0, 1.8],
  muscle: [0, 1],
  bodyFatPct: [2, 65],
  /** Residual mass may slim inferred regions further than it may enlarge them. */
  massResponse: [-1.25, 0.45],
  /** Scale limits, applied to every value this module returns. */
  torsoWidth: [0.7, 1.75],
  torsoDepth: [0.7, 1.9],
  shoulderWidth: [0.84, 1.2],
  shoulderDepth: [0.7, 1.9],
  neck: [0.75, 1.5],
  limb: [0.75, 1.5],
  /** How far a cross-section may depart from the base mesh's own roundness. */
  aspect: [0.88, 1.16],
} as const

/**
 * The base mesh's neck cannot be measured the way its waist can: a horizontal
 * cut at neck height also catches the jaw and the back of the skull, and the
 * two meshes disagree by 40% on what that adds up to. So the neck is the one
 * dimension calibrated rather than measured: the male mesh is treated as a 37cm
 * neck on a 175cm man and the female as 32cm on a 162cm woman, both ordinary
 * adult readings, and the tape moves the neck from there.
 */
const NECK_REFERENCE: Record<Sex, number> = { male: 37 / 175, female: 32 / 162 }

/** Shoulder slider midpoints, matching defaultShoulderRatio in Character.tsx. */
const SHOULDER_REFERENCE: Record<Sex, number> = { male: 1.42, female: 1.28 }

/**
 * Waist-to-hip, used only when the hip was not measured, which is every male
 * reading because the app does not ask men for a hip. WHO's cut-offs for
 * abdominal obesity are 0.90 for men and 0.85 for women, and leaner bodies sit
 * well below them, so the ratio is taken to rise with body fat rather than
 * being fixed.
 */
function inferredHipCm(waistCm: number, bodyFatPct: number, sex: Sex): number {
  const ratio =
    sex === "male"
      ? clamp(0.8 + 0.004 * (bodyFatPct - 15), 0.78, 0.98)
      : clamp(0.7 + 0.004 * (bodyFatPct - 25), 0.68, 0.92)
  return waistCm / ratio
}

/** Ramanujan's approximation. Exact enough that the error is invisible here. */
export function ellipsePerimeter(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
}

/**
 * Whole-body density from fat fraction, Siri's two-compartment model: fat at
 * 0.900 kg/L and fat-free tissue at 1.100 kg/L (Siri WE, 1961). It is the same
 * model the Navy body-fat estimate inverts, so using it here keeps the mass and
 * the tape talking about one body rather than two.
 */
export function bodyDensity(bodyFatPct: number): number {
  const f = clamp(bodyFatPct, 2, 65) / 100
  return 1 / (f / 0.9 + (1 - f) / 1.1)
}

export function sliceAt(profile: BodyProfile, fraction: number): number {
  // The epsilon is not decoration: every landmark is a multiple of 1/64, and
  // floating point will happily turn 29/64 times 64 into 28.999999999999996.
  return Math.min(profile.slices - 1, Math.max(0, Math.floor(fraction * profile.slices + 1e-6)))
}

/**
 * Turn a girth in cm into the width and depth scales that produce it.
 *
 * The cross-section keeps the base mesh's own roundness, nudged by body fat,
 * because a tape reading fixes a perimeter and not a shape: 84cm around the
 * waist can be a wide flat abdomen or a round one, and the difference between
 * them is the difference between a person and a plank. The base mesh's ratio of
 * depth to width is the honest starting point, since it came from a real body.
 */
function sectionFor(
  profile: BodyProfile,
  fraction: number,
  girthCm: number,
  heightCm: number,
  aspectBias: number,
): SectionScale {
  const s = sliceAt(profile, fraction)
  const a0 = profile.torsoHalfWidth[s]
  const b0 = profile.torsoHalfDepth[s]
  const base = profile.torsoGirth[s]
  if (!(a0 > 0) || !(b0 > 0) || !(base > 0)) return { width: 1, depth: 1 }

  // How far the real cross-section falls short of the ellipse through its own
  // extremes. Carried through so the target girth is read off the mesh's own
  // shape rather than off an idealisation of it.
  const shape = base / ellipsePerimeter(a0, b0)
  const aspect = (b0 / a0) * clamp(aspectBias, LIMITS.aspect[0], LIMITS.aspect[1])
  const unit = shape * ellipsePerimeter(1, aspect)
  if (!(unit > 0)) return { width: 1, depth: 1 }

  const a = girthCm / heightCm / unit
  return { width: a / a0, depth: (a * aspect) / b0 }
}

function boundedSection(section: SectionScale): SectionScale {
  const width = clamp(section.width, LIMITS.torsoWidth[0], LIMITS.torsoWidth[1])
  const depth = clamp(section.depth, LIMITS.torsoDepth[0], LIMITS.torsoDepth[1])
  return { width, depth }
}

function limitSection(section: SectionScale, note: () => void): SectionScale {
  const limited = boundedSection(section)
  if (limited.width !== section.width || limited.depth !== section.depth) note()
  return limited
}

/**
 * The volume of the deformed mesh, in litres, from its own cross-sections.
 *
 * An affine scale of a cross-section scales its area by exactly the product of
 * the two factors, so this is not an approximation of the deformation; it is
 * the deformation, integrated. The approximation is only that a slice is a
 * prism, which over 64 slices costs very little.
 */
export function modelVolumeLitres(
  profile: BodyProfile,
  torsoScale: (fraction: number) => SectionScale,
  armFill: number,
  legFill: number,
  heightCm: number,
): number {
  const dy = 1 / profile.slices
  let volume = 0
  for (let s = 0; s < profile.slices; s++) {
    const fraction = (s + 0.5) / profile.slices
    const torso = torsoScale(fraction)
    volume += profile.torsoArea[s] * torso.width * torso.depth * dy
    volume += 2 * profile.leg.area[s] * legFill * legFill * dy
    volume += 2 * profile.arm.area[s] * armFill * armFill * dy
  }
  return (volume * heightCm ** 3) / 1000
}

/**
 * Every parameter the renderer needs, from every input that has a body in it.
 *
 * Age and ancestry are deliberately absent. They change what the assessment
 * says, and they do not change the shape of a body in any way this model could
 * honestly draw, so nothing here pretends otherwise.
 */
export function bodyParams(input: BodyInput, profile: BodyProfile): BodyParams {
  const notes: string[] = []
  const inRange = (value: number, range: readonly [number, number] | number[], label: string) => {
    const held = clamp(Number.isFinite(value) ? value : range[0], range[0], range[1])
    if (Math.abs(held - value) > 1e-6) notes.push(label)
    return held
  }

  const sex: Sex = input.sex === "female" ? "female" : "male"
  const heightCm = inRange(input.heightCm, LIMITS.heightCm, "height")
  const weightKg = inRange(input.weightKg, LIMITS.weightKg, "weight")
  const waistCm = inRange(input.waistCm, LIMITS.waistCm, "waist")
  const neckCm = inRange(input.neckCm, LIMITS.neckCm, "neck")
  const shoulderRatio = inRange(input.shoulderRatio, LIMITS.shoulderRatio, "shoulders")
  const muscle = inRange(input.muscle, LIMITS.muscle, "muscle")
  const bodyFatPct = inRange(input.bodyFatPct, LIMITS.bodyFatPct, "body fat")
  const measuredHip = input.hipCm > 0
  const hipCm = measuredHip
    ? inRange(input.hipCm, LIMITS.hipCm, "hips")
    : inferredHipCm(waistCm, bodyFatPct, sex)

  const L = profile.landmarks

  // A rounder cross-section with more fat on it, a flatter one with less. Held
  // inside a sixth either way, because this is a tendency and not a measurement.
  const aspectBias = clamp(1 + (bodyFatPct - 25) * 0.005, LIMITS.aspect[0], LIMITS.aspect[1])

  const hip = sectionFor(profile, L.hip, hipCm, heightCm, aspectBias)
  const waist = sectionFor(profile, L.waist, waistCm, heightCm, aspectBias)

  // Chest is inferred. It follows the waist, but not one for one: a bigger
  // belly does come with a bigger chest, and nowhere near as fast, which is the
  // whole difference between a heavy man and a barrel. The exponent makes the
  // chest move about half as far as the waist in proportional terms.
  const chestSlice = sliceAt(profile, L.chest)
  const baseChestCm = profile.torsoGirth[chestSlice] * heightCm
  const waistSlice = sliceAt(profile, L.waist)
  const baseWaistCm = profile.torsoGirth[waistSlice] * heightCm
  const waistRatio = baseWaistCm > 0 ? waistCm / baseWaistCm : 1
  const chestFromMuscle = 1 + 0.2 * (muscle - 0.35)
  const chestGirthCm = baseChestCm * Math.pow(waistRatio, 0.55) * chestFromMuscle

  // Limb thickness before the scale has had its say: muscle first, then the
  // fat that sits on an arm and a thigh as well as on a belly.
  const limbFromBuild = 1 + 0.3 * (muscle - 0.35) + 0.5 * Math.max(0, bodyFatPct - 18) / 100

  // Shoulder breadth is mostly the slider, because biacromial breadth is bone
  // and barely moves with weight. The quarter-power on the waist is there so a
  // much wider torso does not end up with the shoulders of a smaller person.
  const shoulderWidthRaw =
    (1 + (shoulderRatio - SHOULDER_REFERENCE[sex]) * 0.55) *
    Math.pow(Math.max(waist.width, 0.1), 0.22)
  const shoulderWidth = clamp(
    shoulderWidthRaw,
    LIMITS.shoulderWidth[0],
    LIMITS.shoulderWidth[1],
  )

  const targetLitres = weightKg / bodyDensity(bodyFatPct)

  /**
   * What the scale says that the tape did not. A person can weigh 15kg more
   * than their waist accounts for, and that mass is real and it is mostly on
   * their limbs and their back. One monotonic response moves those unmeasured
   * dimensions toward the scale until a safe bound is reached. It never argues
   * with a measured cross-section, and any mass left over is disclosed below.
   */
  const limitedHip = limitSection(hip, () => notes.push("hips"))
  const limitedWaist = limitSection(waist, () => notes.push("waist"))
  type MassShape = {
    chestCm: number
    chestRaw: SectionScale
    chest: SectionScale
    armRaw: number
    legRaw: number
    arm: number
    leg: number
    shoulder: SectionScale
    volumeLitres: number
  }
  const shapeAt = (response: number): MassShape => {
    const chestCm = chestGirthCm * Math.max(0.05, 1 + 0.18 * response)
    const chestRaw = sectionFor(profile, L.chest, chestCm, heightCm, aspectBias)
    const chest = boundedSection(chestRaw)
    const limb = limbFromBuild * Math.max(0.05, 1 + 0.45 * response)
    const armRaw = limb
    const legRaw = limb * (sex === "female" ? 1.02 : 1)
    const arm = clamp(armRaw, LIMITS.limb[0], LIMITS.limb[1])
    const leg = clamp(legRaw, LIMITS.limb[0], LIMITS.limb[1])
    const shoulder: SectionScale = {
      width: shoulderWidth,
      depth: clamp(chestRaw.depth, LIMITS.shoulderDepth[0], LIMITS.shoulderDepth[1]),
    }
    const volumeLitres = modelVolumeLitres(
      profile,
      (fraction) =>
        torsoSectionAt(profile, fraction, {
          hip: limitedHip,
          waist: limitedWaist,
          chest,
          shoulder,
        }),
      arm,
      leg,
      heightCm,
    )
    return { chestCm, chestRaw, chest, armRaw, legRaw, arm, leg, shoulder, volumeLitres }
  }

  const preVolume = shapeAt(0).volumeLitres
  const requestedResponse = preVolume > 0 ? targetLitres / preVolume - 1 : 0
  const response = clamp(requestedResponse, LIMITS.massResponse[0], LIMITS.massResponse[1])
  const fitted = shapeAt(response)

  const { chestCm, chestRaw, chest, armRaw, legRaw, arm, leg, shoulder, volumeLitres } = fitted
  if (chest.width !== chestRaw.width || chest.depth !== chestRaw.depth) notes.push("chest")
  if (arm !== armRaw || leg !== legRaw) notes.push("limbs")
  if (
    shoulder.width !== shoulderWidthRaw ||
    shoulder.depth !== chestRaw.depth
  ) {
    notes.push("shoulders")
  }
  const volumeGap = targetLitres > 0 ? Math.abs(volumeLitres - targetLitres) / targetLitres : 0
  if (
    (Math.abs(response - requestedResponse) > 1e-6 && volumeGap > 0.02) ||
    volumeGap > 0.12
  ) {
    notes.push("weight")
  }

  const neckReferenceCm = NECK_REFERENCE[sex] * heightCm
  const neckRaw = neckCm / neckReferenceCm
  const neck = clamp(neckRaw, LIMITS.neck[0], LIMITS.neck[1])
  if (Math.abs(neck - neckRaw) > 1e-6) notes.push("neck")

  const limited = {
    hip: limitedHip,
    waist: limitedWaist,
    chest,
    shoulder,
  }

  const metres = heightCm / 100
  return {
    stature: heightCm / REFERENCE_STATURE_CM,
    ...limited,
    neck,
    arm,
    leg,
    read: {
      bmi: weightKg / (metres * metres),
      waistCm,
      hipCm,
      chestCm,
      neckCm,
      volumeLitres,
      targetLitres,
    },
    notes: [...new Set(notes)],
  }
}

/**
 * The torso's scale at any height, anchored at the landmarks and smooth in
 * between.
 *
 * Smooth matters more than it sounds: this curve is what a slice of the mesh is
 * multiplied by, so a kink in it is a crease in a person. It relaxes to the
 * base mesh at the neck, which is why a wide waist no longer arrives at the
 * skull, and it holds the hip value down to the crotch, where the legs take
 * over.
 */
export function torsoSectionAt(
  profile: BodyProfile,
  fraction: number,
  scales: { hip: SectionScale; waist: SectionScale; chest: SectionScale; shoulder: SectionScale },
): SectionScale {
  const L = profile.landmarks
  const anchors: [number, SectionScale][] = [
    [0, scales.hip],
    [L.hip, scales.hip],
    [L.waist, scales.waist],
    [L.chest, scales.chest],
    [L.shoulder, scales.shoulder],
    [L.neck, { width: 1, depth: 1 }],
    [1, { width: 1, depth: 1 }],
  ]

  const y = clamp(fraction, 0, 1)
  anchors.sort((a, b) => a[0] - b[0])
  for (let i = 0; i < anchors.length - 1; i++) {
    const [ay, a] = anchors[i]
    const [by, b] = anchors[i + 1]
    if (y < ay || y > by) continue
    const span = by - ay
    const t = span <= 0 ? 0 : (y - ay) / span
    const k = t * t * (3 - 2 * t)
    return { width: a.width + (b.width - a.width) * k, depth: a.depth + (b.depth - a.depth) * k }
  }
  return { width: 1, depth: 1 }
}

/** The one-line, adult version of whatever the model refused to draw. */
export function clampNote(params: BodyParams): string | null {
  if (params.notes.length === 0) return null
  const parts = params.notes
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
  return `Drawn at the edge of what this model can hold: ${list}. Your numbers are unchanged.`
}
