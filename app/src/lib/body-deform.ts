/**
 * Moving the actual vertices, region by region.
 *
 * The rule that makes this look like a body rather than a balloon: every vertex
 * belongs to a part, every part is scaled about its own centre, and the parts
 * are blended by weights that vary smoothly, so there is no seam anywhere to
 * find. A single scale applied to a whole horizontal slice — which is what this
 * replaced — cannot tell an arm from a rib, and so it thickened both when the
 * waist tape moved, and stretched the arms sideways when the shoulders did.
 *
 * What each part answers to:
 *
 *   torso   waist, hip and inferred chest girth, in width and depth separately
 *   arm     limb thickness, about the arm's own axis, plus a rigid sideways
 *           shift so it stays attached to a wider or narrower shoulder
 *   leg     limb thickness about each leg's own axis, plus a shift that follows
 *           the pelvis and fades to nothing at the floor, so feet stay planted
 *   neck    the neck tape, over the neck and the top of the trapezius only
 *   head    nothing at all, ever
 *
 * Nothing here reads from the DOM or from three.js, so all of it is testable in
 * a plain Node process against the real mesh.
 */

import { clamp } from "./calc.ts"
import type { BodyParams } from "./body-model.ts"
import { sliceAt, torsoSectionAt } from "./body-model.ts"
import type { BodyProfile } from "./body-profile.ts"

export type RegionWeights = {
  torso: number
  arm: number
  leg: number
  neck: number
  head: number
}

/** Hermite smoothstep, clamped. The only easing used anywhere in here. */
function smooth01(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/**
 * Read a per-slice table at any height.
 *
 * Slice s was measured from the band between s/slices and (s+1)/slices, so it
 * describes the height at its centre. Getting that half-slice wrong puts every
 * landmark about 1.5cm off, which is enough to hang a waist off a navel.
 */
function sample(table: number[] | Float32Array, y: number, slices: number): number {
  const f = clamp(y * slices - 0.5, 0, slices - 1)
  const i = Math.floor(f)
  const t = f - i
  const a = table[i]
  const b = table[Math.min(slices - 1, i + 1)]
  return a + (b - a) * t
}

export type Deformation = {
  profile: BodyProfile
  params: BodyParams
  weightsAt: (x: number, y: number, z: number) => RegionWeights
  /** Write the deformed positions of `base` into `out`. Same length, in place is fine. */
  apply: (base: Float32Array, out: Float32Array) => void
}

/**
 * How wide a band each region fades across, as a fraction of stature. Around
 * 3cm on a 170cm body: wide enough that no edge is visible, narrow enough that
 * a waist does not leak into a neck.
 */
const FADE = 0.02

export function buildDeformation(profile: BodyProfile, params: BodyParams): Deformation {
  const slices = profile.slices
  const L = profile.landmarks

  // Per-slice tables, so the per-vertex loop is arithmetic and nothing else.
  const width = new Float32Array(slices)
  const depth = new Float32Array(slices)
  for (let s = 0; s < slices; s++) {
    const section = torsoSectionAt(profile, (s + 0.5) / slices, params)
    width[s] = section.width
    depth[s] = section.depth
  }

  // How far out the torso's own surface reaches at each height, which is where
  // its displacement stops growing. Below the crotch there is no torso to
  // measure, so the crotch value is held: letting the bound collapse to zero
  // there would make the pelvis and the top of the thigh disagree across the
  // one slice they share, and that shows up as a crease.
  const crotchSlice = sliceAt(profile, profile.landmarks.crotch)
  const boundX = new Float32Array(slices)
  const boundZ = new Float32Array(slices)
  for (let s = 0; s < slices; s++) {
    const from = Math.max(s, crotchSlice)
    boundX[s] = profile.torsoHalfWidth[from]
    boundZ[s] = profile.torsoHalfDepth[from]
  }

  const shoulderSlice = sliceAt(profile, L.shoulder)
  /** How far the edge of the shoulder moved. The arm goes with it, rigidly. */
  const armShift = profile.torsoHalfWidth[shoulderSlice] * (params.shoulder.width - 1)

  const neckSlice = sliceAt(profile, L.neck)
  const neckHalfWidth = profile.torsoHalfWidth[neckSlice] * 1.3
  const neckHalfDepth = profile.torsoHalfDepth[neckSlice] * 1.3

  /** The furthest the arm reaches: fingertips, and where thickening stops. */
  let armReach = 0
  for (let s = 0; s < slices; s++) {
    armReach = Math.max(armReach, profile.arm.axisX[s] + profile.arm.radiusX[s])
  }

  const headLo = L.headBase - FADE
  const neckLo = L.neck - 0.05
  const legHi = L.crotch + 0.03
  const legLo = L.crotch - 0.06
  const armFadeHi = L.armTop
  const armFadeLo = L.armTop - 0.06
  /** How much of a vertex's height is still arm rather than shoulder. */
  const armFade = (y: number) => 1 - smooth01((y - armFadeLo) / Math.max(armFadeHi - armFadeLo, 1e-4))

  const weightsAt = (x: number, y: number, z: number): RegionWeights => {
    const ax = Math.abs(x)
    const head = smooth01((y - headLo) / (FADE * 2))
    const below = 1 - head
    const neck = below * smooth01((y - neckLo) / (FADE * 2.5))

    let arm = 0
    const axis = sample(profile.arm.axisX, y, slices)
    const radiusX = sample(profile.arm.radiusX, y, slices)
    if (radiusX > 0) {
      const radiusZ = Math.max(sample(profile.arm.radiusZ, y, slices), 0.012)
      const dx = (ax - axis) / (radiusX + 0.008)
      // Generous front to back on purpose: an arm and a ribcage are separated
      // sideways and never in depth, so nothing is at risk of being claimed by
      // mistake, while a forearm seen edge-on is easily missed by a tight fit.
      const dz = (z - sample(profile.arm.axisZ, y, slices)) / (radiusZ * 1.35 + 0.02)
      // A box rather than an ellipse, because the radii were measured as a
      // bounding box. An ellipse through the same numbers misses the corners,
      // and the corners of an arm are the front and back of a forearm, which
      // would then be handed to the torso and dragged sideways by the waist.
      const d = Math.max(Math.abs(dx), Math.abs(dz))
      arm = (1 - smooth01((d - 1.05) / 0.65)) * below * armFade(y)
    }

    const leg = (1 - smooth01((y - legLo) / (legHi - legLo))) * (1 - arm)
    const torso = Math.max(0, 1 - head - neck - arm - leg)
    const sum = head + neck + arm + leg + torso
    if (sum <= 0) return { torso: 1, arm: 0, leg: 0, neck: 0, head: 0 }
    return { torso: torso / sum, arm: arm / sum, leg: leg / sum, neck: neck / sum, head: head / sum }
  }

  const apply = (base: Float32Array, out: Float32Array) => {
    for (let i = 0; i < base.length; i += 3) {
      const x = base[i]
      const y = base[i + 1]
      const z = base[i + 2]
      const w = weightsAt(x, y, z)
      const sign = x < 0 ? -1 : 1
      const ax = Math.abs(x)
      const centreZ = sample(profile.torsoCentreZ, y, slices)

      let dx = 0
      let dz = 0

      if (w.torso > 0) {
        // Saturating at the torso's own edge is what keeps this safe. Inside the
        // torso it is an ordinary scale about the midline. Outside it — an arm
        // that has caught a few percent of torso weight near the armpit — the
        // displacement stops growing, so the worst a blend can do is move a
        // vertex as far as the edge of the torso moved. Without that, an arm
        // 25cm from the midline picks up three times the displacement the ribs
        // do, and the shoulder tears.
        const halfWidth = sample(boundX, y, slices)
        const halfDepth = sample(boundZ, y, slices)
        const offsetZ = z - centreZ
        dx += w.torso * sign * Math.min(ax, halfWidth) * (sample(width, y, slices) - 1)
        dz +=
          w.torso *
          Math.sign(offsetZ) *
          Math.min(Math.abs(offsetZ), halfDepth) *
          (sample(depth, y, slices) - 1)
      }

      if (w.neck > 0) {
        const offsetZ = z - centreZ
        dx += w.neck * sign * Math.min(ax, neckHalfWidth) * (params.neck - 1)
        dz += w.neck * Math.sign(offsetZ) * Math.min(Math.abs(offsetZ), neckHalfDepth) * (params.neck - 1)
      }

      if (w.arm > 0) {
        // Hands keep their own size: a heavier person has slightly thicker
        // hands, not gloves, so the thickening runs out towards the fingertips.
        // It also runs out towards the shoulder, where a deltoid belongs to the
        // shoulder and not to the arm, and where an arm that thickened inwards
        // while the ribcage widened outwards would fold the armpit.
        const hand = 1 - smooth01((ax - (armReach - 0.05)) / 0.045)
        const fill = 1 + (params.arm - 1) * hand * armFade(y)
        const axis = sample(profile.arm.axisX, y, slices)
        const axisZ = sample(profile.arm.axisZ, y, slices)
        const reachX = Math.max(sample(profile.arm.radiusX, y, slices), 0.01) * 1.6
        const reachZ = Math.max(sample(profile.arm.radiusZ, y, slices), 0.01) * 1.6
        dx += w.arm * sign * (armShift + clamp(ax - axis, -reachX, reachX) * (fill - 1))
        dz += w.arm * clamp(z - axisZ, -reachZ, reachZ) * (fill - 1)
      }

      if (w.leg > 0) {
        // Feet stay on the floor and stay their own size, so the figure is
        // never standing on something that grew with its weight. Thickness is
        // released just above the ankle; the sideways lean that follows a wider
        // pelvis is released far more slowly, over the whole lower leg, because
        // a leg that swings out over 5cm of ankle is a leg with a kink in it.
        const planted = smooth01((y - 0.03) / 0.06)
        const leaning = smooth01((y - 0.03) / 0.3)
        const fill = 1 + (params.leg - 1) * planted
        const axis = sample(profile.leg.axisX, y, slices)
        const axisZ = sample(profile.leg.axisZ, y, slices)
        const reachX = Math.max(sample(profile.leg.radiusX, y, slices), 0.01) * 1.6
        const reachZ = Math.max(sample(profile.leg.radiusZ, y, slices), 0.01) * 1.6
        const shift = axis * (params.hip.width - 1) * leaning
        dx += w.leg * sign * (shift + clamp(ax - axis, -reachX, reachX) * (fill - 1))
        dz += w.leg * clamp(z - axisZ, -reachZ, reachZ) * (fill - 1)
      }

      out[i] = Number.isFinite(dx) ? x + dx : x
      out[i + 1] = y
      out[i + 2] = Number.isFinite(dz) ? z + dz : z
    }
  }

  return { profile, params, weightsAt, apply }
}
