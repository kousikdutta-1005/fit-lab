/**
 * The shape of what scripts/body-profile.mjs measures off each mesh.
 *
 * Every array is indexed by height slice, feet at 0 and crown at the last one,
 * and every length is a fraction of stature. Keeping the type here rather than
 * inferring it from the JSON means a profile that has drifted from the code
 * fails to compile instead of failing to look human.
 */

export type BodyLandmarks = {
  /** Where the two legs become one body. */
  crotch: number
  /** The widest the pelvis gets, which is where a hip tape goes. */
  hip: number
  /** The navel, where the app asks for the waist reading. */
  waist: number
  /** Where a chest tape goes. Inferred rather than measured, throughout. */
  chest: number
  /** The widest the torso gets below the neck. */
  shoulder: number
  /** The thinnest cross-section above the shoulders. */
  neck: number
  /** Above this the head is left exactly as the mesh made it. */
  headBase: number
  /** The top and bottom of the tracked arm. */
  armTop: number
  armBottom: number
}

export type LimbProfile = {
  /** The limb's own centre, as a distance from the midline. */
  axisX: number[]
  axisZ: number[]
  radiusX: number[]
  radiusZ: number[]
  /** Convex-hull area of one limb's cross-section. */
  area: number[]
}

export type BodyProfile = {
  slices: number
  note: string
  landmarks: BodyLandmarks
  halfWidth: number[]
  halfDepth: number[]
  torsoHalfWidth: number[]
  torsoHalfDepth: number[]
  torsoCentreZ: number[]
  /** Convex-hull perimeter of the torso cross-section: what a tape reads. */
  torsoGirth: number[]
  torsoArea: number[]
  arm: LimbProfile
  leg: LimbProfile & { girth: number[] }
}
