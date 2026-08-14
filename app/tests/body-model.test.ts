/**
 * What the body model has to be true of, checked against the real meshes.
 *
 * These tests exist because the failure they guard against is not a crash. A
 * broken deformation renders perfectly happily; it just renders something that
 * is not a person, and no type system will notice. So the assertions here are
 * about shape: that a metric moves what it should and leaves alone what it
 * should not, that a head is a head at every setting, that feet stay on the
 * floor, and that nothing anywhere goes to infinity.
 *
 * Run with: npm test
 */

import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { bodyParams, LIMITS, modelVolumeLitres, torsoSectionAt } from "../src/lib/body-model.ts"
import type { BodyInput } from "../src/lib/body-model.ts"
import { buildDeformation } from "../src/lib/body-deform.ts"
import type { BodyProfile } from "../src/lib/body-profile.ts"
import { navyBodyFat } from "../src/lib/calc.ts"

const here = dirname(fileURLToPath(import.meta.url))
const load = (file: string): BodyProfile => JSON.parse(readFileSync(resolve(here, "..", file), "utf8"))

const PROFILES: Record<"male" | "female", BodyProfile> = {
  male: load("src/data/body-profile.json"),
  female: load("src/data/body-profile-female.json"),
}

/** The two readings the brief names, and the ones every check starts from. */
const FEMALE: BodyInput = {
  sex: "female",
  heightCm: 165,
  weightKg: 60,
  waistCm: 72,
  neckCm: 32,
  hipCm: 92,
  shoulderRatio: 1.28,
  muscle: 0.35,
  bodyFatPct: 0,
}
const MALE: BodyInput = {
  sex: "male",
  heightCm: 175,
  weightKg: 75,
  waistCm: 84,
  neckCm: 37,
  hipCm: 0,
  shoulderRatio: 1.42,
  muscle: 0.35,
  bodyFatPct: 0,
}

/** Body fat comes from the tape, exactly as the app derives it. */
function withFat(input: BodyInput): BodyInput {
  const fat = navyBodyFat({
    age: 30,
    sex: input.sex,
    ancestry: "unsaid",
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    waistCm: input.waistCm,
    neckCm: input.neckCm,
    hipCm: input.hipCm || input.waistCm * 1.1,
  })
  return { ...input, bodyFatPct: fat ?? 22 }
}

const female = withFat(FEMALE)
const male = withFat(MALE)

function paramsFor(input: BodyInput) {
  return bodyParams(input, PROFILES[input.sex])
}

/** Every base vertex of a mesh, read straight out of the committed GLB. */
function baseVertices(sex: "male" | "female"): Float32Array {
  const file = sex === "male" ? "public/body/base.glb" : "public/body/base-female.glb"
  const bytes = readFileSync(resolve(here, "..", file))
  const jsonLength = bytes.readUInt32LE(12)
  const json = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength))
  const binStart = 20 + jsonLength + 8
  const out: number[] = []
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const accessor = json.accessors[prim.attributes.POSITION]
      const view = json.bufferViews[accessor.bufferView]
      assert.equal(accessor.componentType, 5126, "positions are expected to be float32")
      const start = binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
      const stride = view.byteStride ?? 12
      for (let i = 0; i < accessor.count; i++) {
        const at = start + i * stride
        out.push(bytes.readFloatLE(at), bytes.readFloatLE(at + 4), bytes.readFloatLE(at + 8))
      }
    }
  }
  assert.ok(out.length > 3000, `expected a real mesh, got ${out.length / 3} vertices`)
  return Float32Array.from(out)
}

const MESHES = { male: baseVertices("male"), female: baseVertices("female") }

function deformed(input: BodyInput): { base: Float32Array; out: Float32Array } {
  const base = MESHES[input.sex]
  const out = new Float32Array(base.length)
  buildDeformation(PROFILES[input.sex], paramsFor(input)).apply(base, out)
  return { base, out }
}

/**
 * The widest the torso gets at a height, and how deep it is there, with the
 * arms left out.
 *
 * At chest and waist height an A-posed mesh has a forearm hanging in the same
 * horizontal band as the ribcage, and it is further from the midline than any
 * part of the torso. Measure the band naively and you measure the arm, which is
 * exactly the mistake the deformation itself used to make.
 */
function torsoExtent(profile: BodyProfile, v: Float32Array, base: Float32Array, at: number, band = 0.012) {
  let width = 0
  let depth = 0
  let count = 0
  const slice = Math.min(profile.slices - 1, Math.floor(at * profile.slices))
  const axis = profile.arm.axisX[slice]
  const radius = profile.arm.radiusX[slice]
  for (let i = 0; i < v.length; i += 3) {
    const y = base[i + 1]
    if (Math.abs(y - at) > band) continue
    if (radius > 0 && Math.abs(Math.abs(base[i]) - axis) < radius * 2.2) continue
    count++
    width = Math.max(width, Math.abs(v[i]))
    depth = Math.max(depth, Math.abs(v[i + 2]))
  }
  return { width, depth, count }
}

describe("the measured profiles", () => {
  for (const [sex, profile] of Object.entries(PROFILES)) {
    it(`${sex}: has a complete, finite, plausibly ordered set of landmarks`, () => {
      const L = profile.landmarks
      for (const [name, value] of Object.entries(L)) {
        assert.ok(Number.isFinite(value), `${name} is not finite`)
        assert.ok(value > 0 && value <= 1, `${name} is outside the body: ${value}`)
      }
      assert.ok(L.crotch < L.waist, "the crotch must be below the waist")
      assert.ok(L.hip > L.crotch && L.hip < L.waist, "the hip must be between them")
      assert.ok(L.waist < L.chest, "the waist must be below the chest")
      assert.ok(L.chest < L.shoulder, "the chest must be below the shoulder")
      assert.ok(L.shoulder < L.neck, "the shoulder must be below the neck")
      assert.ok(L.neck < L.headBase, "the neck must be below the head")
    })

    it(`${sex}: has finite, non-negative tables of the declared length`, () => {
      const tables: number[][] = [
        profile.halfWidth,
        profile.halfDepth,
        profile.torsoHalfWidth,
        profile.torsoHalfDepth,
        profile.torsoGirth,
        profile.torsoArea,
        profile.arm.axisX,
        profile.arm.radiusX,
        profile.arm.area,
        profile.leg.axisX,
        profile.leg.radiusX,
        profile.leg.area,
      ]
      for (const table of tables) {
        assert.equal(table.length, profile.slices)
        assert.ok(table.every((n) => Number.isFinite(n) && n >= 0))
      }
      assert.ok(profile.torsoCentreZ.every(Number.isFinite))
    })

    it(`${sex}: measures a body a tape would recognise`, () => {
      const stature = sex === "male" ? 175 : 162
      const at = (frac: number) => profile.torsoGirth[Math.floor(frac * profile.slices)] * stature
      const waist = at(profile.landmarks.waist)
      const hip = at(profile.landmarks.hip)
      const chest = at(profile.landmarks.chest)
      assert.ok(waist > 60 && waist < 95, `waist off a lean base mesh: ${waist}`)
      assert.ok(hip > 80 && hip < 110, `hip off a lean base mesh: ${hip}`)
      assert.ok(chest > 78 && chest < 115, `chest off a lean base mesh: ${chest}`)
      assert.ok(hip > waist, "the hip should read wider than the waist on both meshes")
    })
  }
})

describe("parameters from ordinary readings", () => {
  it("draws the female reading close to the base mesh", () => {
    const p = paramsFor(female)
    assert.equal(p.notes.length, 0, `unexpected clamp: ${p.notes}`)
    for (const value of [p.waist.width, p.waist.depth, p.hip.width, p.chest.width, p.neck, p.arm, p.leg]) {
      assert.ok(value > 0.75 && value < 1.35, `an ordinary body should not need ${value}`)
    }
    assert.ok(Math.abs(p.stature - 165 / 170) < 1e-9)
  })

  it("draws the male reading close to the base mesh", () => {
    const p = paramsFor(male)
    assert.equal(p.notes.length, 0, `unexpected clamp: ${p.notes}`)
    for (const value of [p.waist.width, p.waist.depth, p.hip.width, p.chest.width, p.neck, p.arm, p.leg]) {
      assert.ok(value > 0.75 && value < 1.35, `an ordinary body should not need ${value}`)
    }
  })

  it("puts the mass it was given into the body it draws", () => {
    for (const input of [male, female]) {
      const p = paramsFor(input)
      const off = Math.abs(p.read.volumeLitres - p.read.targetLitres) / p.read.targetLitres
      assert.ok(off < 0.12, `${input.sex}: drawn volume is ${(off * 100).toFixed(1)}% from the weight given`)
    }
  })

  it("never returns anything but a finite, bounded number", () => {
    const extremes: BodyInput[] = []
    for (const sex of ["male", "female"] as const) {
      for (const heightCm of [130, 210]) {
        for (const weightKg of [35, 180]) {
          for (const waistCm of [50, 160]) {
            for (const neckCm of [25, 60]) {
              for (const muscle of [0, 1]) {
                for (const shoulderRatio of [1.05, 1.75]) {
                  extremes.push(
                    withFat({
                      sex,
                      heightCm,
                      weightKg,
                      waistCm,
                      neckCm,
                      hipCm: sex === "female" ? (waistCm < 80 ? 60 : 170) : 0,
                      shoulderRatio,
                      muscle,
                      bodyFatPct: 0,
                    }),
                  )
                }
              }
            }
          }
        }
      }
    }
    assert.equal(extremes.length, 128)

    for (const input of extremes) {
      const p = paramsFor(input)
      const named: [string, number, readonly number[]][] = [
        ["waist width", p.waist.width, LIMITS.torsoWidth],
        ["waist depth", p.waist.depth, LIMITS.torsoDepth],
        ["hip width", p.hip.width, LIMITS.torsoWidth],
        ["hip depth", p.hip.depth, LIMITS.torsoDepth],
        ["chest width", p.chest.width, LIMITS.torsoWidth],
        ["chest depth", p.chest.depth, LIMITS.torsoDepth],
        ["shoulder width", p.shoulder.width, LIMITS.shoulderWidth],
        ["neck", p.neck, LIMITS.neck],
        ["arm", p.arm, LIMITS.limb],
        ["leg", p.leg, LIMITS.limb],
      ]
      for (const [name, value, range] of named) {
        assert.ok(Number.isFinite(value), `${name} is not finite for ${JSON.stringify(input)}`)
        assert.ok(
          value >= range[0] - 1e-9 && value <= range[1] + 1e-9,
          `${name} left its documented range at ${value} for ${JSON.stringify(input)}`,
        )
      }
      assert.ok(Number.isFinite(p.read.volumeLitres) && p.read.volumeLitres > 1)
    }
  })

  it("says so when it has stopped, rather than drawing a monster", () => {
    const impossible = withFat({ ...MALE, heightCm: 130, weightKg: 180, waistCm: 160, muscle: 1 })
    const p = paramsFor(impossible)
    assert.ok(p.notes.length > 0, "an impossible body should be reported as clamped")
    assert.ok(p.waist.width <= LIMITS.torsoWidth[1] + 1e-9)
  })
})

describe("each metric moves what it should and nothing else", () => {
  /**
   * Isolation holds body fat fixed on purpose. In the app the neck and the hip
   * are both arguments to the Navy body-fat estimate, so moving either of them
   * legitimately moves the whole figure a little by that route. That path is
   * tested separately; what is tested here is that a measurement does not reach
   * somewhere it has no business reaching directly.
   */
  const nudge = (input: BodyInput, change: Partial<BodyInput>) => paramsFor({ ...input, ...change })

  it("waist moves the waist and barely touches the shoulders", () => {
    const base = paramsFor(male)
    const wide = nudge(male, { waistCm: 104 })
    assert.ok(wide.waist.width > base.waist.width * 1.12, "a 20cm waist should be visible")
    assert.ok(wide.chest.width > base.chest.width, "the chest follows the waist a little")
    assert.ok(
      wide.chest.width / base.chest.width < wide.waist.width / base.waist.width,
      "the chest must follow the waist by less than the waist moved",
    )
    assert.ok(wide.shoulder.width / base.shoulder.width < 1.06, "shoulders are bone, not belly")
    assert.equal(wide.neck, base.neck, "the waist has no business at the neck")
  })

  it("neck moves the neck and nothing else at all", () => {
    const base = paramsFor(male)
    const thick = nudge(male, { neckCm: 44 })
    assert.ok(thick.neck > base.neck * 1.15, "a 7cm neck should be visible")
    assert.equal(thick.waist.width, base.waist.width)
    assert.equal(thick.hip.width, base.hip.width)
    assert.equal(thick.shoulder.width, base.shoulder.width)
    assert.equal(thick.arm, base.arm)
  })

  it("hips move the pelvis and not the waist", () => {
    const base = paramsFor(female)
    const wide = nudge(female, { hipCm: 108 })
    assert.ok(wide.hip.width > base.hip.width * 1.12)
    assert.equal(wide.waist.width, base.waist.width)
  })

  it("reaches the rest of the figure only through the body-fat estimate", () => {
    // The same neck reading, once with body fat recomputed from the tape and
    // once without. The difference between them is the whole of the indirect
    // route, and it should be small enough to be a nuance rather than a leak.
    const direct = paramsFor({ ...male, neckCm: 44 })
    const viaFat = paramsFor(withFat({ ...MALE, neckCm: 44 }))
    const drift = Math.abs(viaFat.waist.width / direct.waist.width - 1)
    assert.ok(drift > 0, "a neck reading does change the body-fat estimate")
    assert.ok(drift < 0.06, `and it should move the waist by a nuance, not ${(drift * 100).toFixed(1)}%`)
  })

  it("weight moves the limbs and never the measured waist", () => {
    const base = paramsFor(male)
    const heavy = nudge(male, { weightKg: 100 })
    const light = nudge(male, { weightKg: 58 })
    assert.equal(heavy.waist.width, base.waist.width, "the tape is not up for negotiation")
    assert.equal(light.waist.width, base.waist.width)
    assert.ok(heavy.arm > base.arm * 1.06, `25kg should show on the limbs: ${base.arm} -> ${heavy.arm}`)
    assert.ok(light.arm < base.arm * 0.96, `17kg less should show too: ${base.arm} -> ${light.arm}`)
    assert.ok(heavy.chest.width > base.chest.width, "some of it lands on the chest")
  })

  it("muscle thickens limbs even though the scale has not moved", () => {
    const base = paramsFor(male)
    const built = nudge(male, { muscle: 0.9 })
    assert.ok(built.arm > base.arm * 1.02, `muscle should still read: ${base.arm} -> ${built.arm}`)
    assert.equal(built.waist.width, base.waist.width)
  })

  it("shoulders answer to the shoulder slider", () => {
    const base = paramsFor(male)
    const broad = nudge(male, { shoulderRatio: 1.7 })
    const narrow = nudge(male, { shoulderRatio: 1.1 })
    assert.ok(broad.shoulder.width > base.shoulder.width * 1.08)
    assert.ok(narrow.shoulder.width < base.shoulder.width * 0.94)
    assert.equal(broad.waist.width, base.waist.width)
  })

  it("height changes stature, and makes the same tape read wider", () => {
    const short = nudge(male, { heightCm: 150 })
    const tall = nudge(male, { heightCm: 195 })
    assert.ok(tall.stature > short.stature * 1.25, "a 45cm difference has to be visible")
    assert.ok(
      short.waist.width > tall.waist.width * 1.15,
      "an 84cm waist is a wide body on a short frame and a narrow one on a tall frame",
    )
  })
})

describe("the deformed mesh is still a body", () => {
  const cases: [string, BodyInput][] = [
    ["female, ordinary", female],
    ["male, ordinary", male],
    ["female, light", withFat({ ...FEMALE, weightKg: 42, waistCm: 58, hipCm: 78, muscle: 0.05 })],
    ["female, heavy", withFat({ ...FEMALE, weightKg: 120, waistCm: 122, hipCm: 140, muscle: 0.5 })],
    ["male, light", withFat({ ...MALE, weightKg: 48, waistCm: 62, neckCm: 30, muscle: 0.05 })],
    ["male, heavy", withFat({ ...MALE, weightKg: 140, waistCm: 138, neckCm: 48, muscle: 0.8 })],
    ["male, shortest", withFat({ ...MALE, heightCm: 130, weightKg: 40 })],
    ["female, tallest", withFat({ ...FEMALE, heightCm: 210, weightKg: 95 })],
  ]

  for (const [name, input] of cases) {
    it(`${name}: every vertex is finite and inside a plausible body`, () => {
      const { out } = deformed(input)
      for (let i = 0; i < out.length; i += 3) {
        assert.ok(Number.isFinite(out[i]) && Number.isFinite(out[i + 1]) && Number.isFinite(out[i + 2]))
        assert.ok(Math.abs(out[i]) < 0.55, `x left the body at ${out[i]}`)
        assert.ok(Math.abs(out[i + 2]) < 0.35, `z left the body at ${out[i + 2]}`)
      }
    })

    it(`${name}: leaves the head exactly as the mesh made it`, () => {
      const { base, out } = deformed(input)
      const headBase = PROFILES[input.sex].landmarks.headBase
      let checked = 0
      for (let i = 0; i < out.length; i += 3) {
        if (base[i + 1] < headBase + 0.02) continue
        checked++
        assert.ok(Math.abs(out[i] - base[i]) < 1e-6, "the head moved sideways")
        assert.ok(Math.abs(out[i + 2] - base[i + 2]) < 1e-6, "the head moved forwards")
      }
      assert.ok(checked > 100, `expected a head to check, found ${checked} vertices`)
    })

    it(`${name}: keeps the feet on the floor and their own size`, () => {
      const { base, out } = deformed(input)
      let checked = 0
      for (let i = 0; i < out.length; i += 3) {
        if (base[i + 1] > 0.02) continue
        checked++
        assert.ok(Math.abs(out[i] - base[i]) < 0.004, "a foot slid sideways")
        assert.equal(out[i + 1], base[i + 1], "a foot left the floor")
      }
      assert.ok(checked > 20, `expected feet to check, found ${checked} vertices`)
    })

    it(`${name}: never turns a body into a plank or a barrel`, () => {
      const { base, out } = deformed(input)
      const profile = PROFILES[input.sex]
      const L = profile.landmarks
      for (const [label, at] of [
        ["waist", L.waist],
        ["chest", L.chest],
        ["hip", L.hip],
      ] as const) {
        const before = torsoExtent(profile, base, base, at)
        const after = torsoExtent(profile, out, base, at)
        const ratio = after.depth / after.width / (before.depth / before.width)
        assert.ok(ratio > 0.7 && ratio < 1.45, `${label} lost its cross-section: depth to width moved by ${ratio}`)
        assert.ok(after.depth > 0.02, `${label} became paper thin at ${after.depth}`)
        assert.ok(after.width > 0.02, `${label} became a knife edge at ${after.width}`)
      }
    })

    it(`${name}: has no seam, tear or crease anywhere on it`, () => {
      const { base, out } = deformed(input)
      // Two vertices near each other on the base mesh must still be near each
      // other afterwards. This is the test that a blend between two regions is
      // a blend and not a cut, and it is checked on the real mesh rather than
      // on a synthetic probe, so a tear anywhere in it would show.
      const cell = 0.03
      const buckets = new Map<string, number[]>()
      const key = (x: number, y: number, z: number) =>
        `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`
      for (let i = 0; i < base.length; i += 3) {
        const k = key(base[i], base[i + 1], base[i + 2])
        const list = buckets.get(k)
        if (list) list.push(i)
        else buckets.set(k, [i])
      }
      let worst = 0
      for (const list of buckets.values()) {
        for (let a = 0; a < list.length; a++) {
          for (let b = a + 1; b < list.length; b++) {
            const i = list[a]
            const j = list[b]
            const apart = Math.hypot(base[i] - base[j], base[i + 1] - base[j + 1], base[i + 2] - base[j + 2])
            if (apart > cell) continue
            const moved = Math.hypot(out[i] - out[j] - (base[i] - base[j]), out[i + 2] - out[j + 2] - (base[i + 2] - base[j + 2]))
            worst = Math.max(worst, moved / Math.max(apart, 1e-4))
          }
        }
      }
      // 1.35 is the armpit, and it is the tightest place on the model: an arm
      // that translates rigidly with the shoulder has to meet a ribcage that is
      // scaling, and the two can only agree so far. A torn mesh would score in
      // the thousands here, not in the ones.
      assert.ok(worst < 1.35, `neighbouring vertices were pulled ${worst.toFixed(2)} times their distance apart`)
    })
  }

  it("rebuilds from pristine vertices rather than compounding", () => {
    const base = MESHES.male
    const params = paramsFor(withFat({ ...MALE, waistCm: 120 }))
    const deformation = buildDeformation(PROFILES.male, params)
    const once = new Float32Array(base.length)
    const twice = new Float32Array(base.length)
    deformation.apply(base, once)
    deformation.apply(base, twice)
    for (let i = 0; i < once.length; i++) assert.equal(once[i], twice[i])

    // And drawing a different body then coming back lands in the same place.
    const other = buildDeformation(PROFILES.male, paramsFor(withFat({ ...MALE, waistCm: 62 })))
    const scratch = new Float32Array(base.length)
    other.apply(base, scratch)
    deformation.apply(base, scratch)
    for (let i = 0; i < once.length; i++) assert.equal(once[i], scratch[i])
  })

  it("answers the waist tape where the waist is, and not where the arms are", () => {
    const profile = PROFILES.male
    const L = profile.landmarks
    const base = MESHES.male
    const out = new Float32Array(base.length)
    buildDeformation(profile, paramsFor(withFat({ ...MALE, waistCm: 118 }))).apply(base, out)

    const waistBefore = torsoExtent(profile, base, base, L.waist)
    const waistAfter = torsoExtent(profile, out, base, L.waist)
    assert.ok(waistAfter.width > waistBefore.width * 1.15, "the waist did not answer the tape")

    // The hand is the furthest thing from the midline; a waist must not reach it.
    let handBefore = 0
    let handAfter = 0
    for (let i = 0; i < base.length; i += 3) {
      handBefore = Math.max(handBefore, Math.abs(base[i]))
      handAfter = Math.max(handAfter, Math.abs(out[i]))
    }
    assert.ok(handAfter < handBefore * 1.1, `a 34cm waist moved the fingertips: ${handBefore} -> ${handAfter}`)
  })

  it("thickens an arm about its own axis rather than sweeping it outwards", () => {
    const profile = PROFILES.male
    const base = MESHES.male
    const thin = new Float32Array(base.length)
    const thick = new Float32Array(base.length)
    buildDeformation(profile, paramsFor(withFat({ ...MALE, muscle: 0, weightKg: 60 }))).apply(base, thin)
    buildDeformation(profile, paramsFor(withFat({ ...MALE, muscle: 1, weightKg: 100 }))).apply(base, thick)

    // Somewhere along the upper arm, well clear of the torso.
    const slice = Math.floor(0.68 * profile.slices)
    const axis = profile.arm.axisX[slice]
    assert.ok(axis > 0.08, "expected a tracked arm at this height")
    let thinSpan = { lo: Infinity, hi: -Infinity }
    let thickSpan = { lo: Infinity, hi: -Infinity }
    for (let i = 0; i < base.length; i += 3) {
      if (Math.abs(base[i + 1] - 0.68) > 0.01) continue
      if (Math.abs(Math.abs(base[i]) - axis) > profile.arm.radiusX[slice] * 1.2) continue
      thinSpan = { lo: Math.min(thinSpan.lo, Math.abs(thin[i])), hi: Math.max(thinSpan.hi, Math.abs(thin[i])) }
      thickSpan = { lo: Math.min(thickSpan.lo, Math.abs(thick[i])), hi: Math.max(thickSpan.hi, Math.abs(thick[i])) }
    }
    assert.ok(thickSpan.hi - thickSpan.lo > (thinSpan.hi - thinSpan.lo) * 1.1, "the arm did not thicken")
    assert.ok(thickSpan.lo < thinSpan.lo, "a thicker arm grows inwards as well as outwards")
  })

  it("gives the neck tape the neck and leaves the chest out of it", () => {
    const profile = PROFILES.male
    const L = profile.landmarks
    const base = MESHES.male
    // Two drawn bodies that differ by nothing but a 10cm neck, so what is
    // compared is the neck tape's own reach and not the whole deformation.
    const thin = new Float32Array(base.length)
    const thick = new Float32Array(base.length)
    buildDeformation(profile, bodyParams({ ...male, neckCm: 37 }, profile)).apply(base, thin)
    buildDeformation(profile, bodyParams({ ...male, neckCm: 47 }, profile)).apply(base, thick)

    const neckThin = torsoExtent(profile, thin, base, L.neck, 0.008)
    const neckThick = torsoExtent(profile, thick, base, L.neck, 0.008)
    assert.ok(neckThick.width > neckThin.width * 1.08, "the neck did not answer the tape")

    for (const [label, at] of [
      ["chest", L.chest],
      ["waist", L.waist],
      ["hip", L.hip],
    ] as const) {
      const a = torsoExtent(profile, thin, base, at)
      const b = torsoExtent(profile, thick, base, at)
      assert.ok(Math.abs(b.width / a.width - 1) < 0.005, `a neck tape reached the ${label}`)
    }
  })

  it("weighs what it draws, across the whole supported range", () => {
    for (const sex of ["male", "female"] as const) {
      for (const weightKg of [45, 70, 110]) {
        const input = withFat({ ...(sex === "male" ? MALE : FEMALE), weightKg })
        const p = bodyParams(input, PROFILES[sex])
        const volume = modelVolumeLitres(
          PROFILES[sex],
          (fraction) => torsoSectionAt(PROFILES[sex], fraction, p),
          p.arm,
          p.leg,
          input.heightCm,
        )
        assert.ok(Math.abs(volume - p.read.volumeLitres) < 1e-6, "the reported volume is the drawn volume")
      }
    }
  })
})

describe("region weights", () => {
  it("partition every vertex of both meshes", () => {
    for (const sex of ["male", "female"] as const) {
      const deformation = buildDeformation(PROFILES[sex], paramsFor(sex === "male" ? male : female))
      const base = MESHES[sex]
      for (let i = 0; i < base.length; i += 3) {
        const w = deformation.weightsAt(base[i], base[i + 1], base[i + 2])
        const sum = w.torso + w.arm + w.leg + w.neck + w.head
        assert.ok(Math.abs(sum - 1) < 1e-6, `weights sum to ${sum}`)
        for (const value of Object.values(w)) assert.ok(value >= 0 && value <= 1)
      }
    }
  })

  it("call a head a head, a foot a leg, and a hand an arm", () => {
    const profile = PROFILES.male
    const deformation = buildDeformation(profile, paramsFor(male))
    assert.equal(deformation.weightsAt(0.02, 0.95, 0).head, 1)
    assert.equal(deformation.weightsAt(0.05, 0.01, 0).leg, 1)
    const handSlice = Math.floor(0.5 * profile.slices)
    const hand = deformation.weightsAt(profile.arm.axisX[handSlice], 0.5, profile.arm.axisZ[handSlice])
    assert.ok(hand.arm > 0.9, `a hand read as ${JSON.stringify(hand)}`)
    const belly = deformation.weightsAt(0.0, profile.landmarks.waist, 0.05)
    assert.ok(belly.torso > 0.95, `a belly read as ${JSON.stringify(belly)}`)
  })

  it("vary smoothly across the surface, with no edge anywhere to catch on", () => {
    // Continuity is checked between neighbouring vertices of the real mesh
    // rather than along a line through empty space: what has to be smooth is
    // the surface a person sees, and a mask can be as abrupt as it likes in
    // the air beside a fingertip without anyone ever seeing it.
    for (const sex of ["male", "female"] as const) {
      const deformation = buildDeformation(PROFILES[sex], paramsFor(sex === "male" ? male : female))
      const base = MESHES[sex]
      const cell = 0.02
      const buckets = new Map<string, number[]>()
      for (let i = 0; i < base.length; i += 3) {
        const k = `${Math.floor(base[i] / cell)},${Math.floor(base[i + 1] / cell)},${Math.floor(base[i + 2] / cell)}`
        const list = buckets.get(k)
        if (list) list.push(i)
        else buckets.set(k, [i])
      }
      let worst = 0
      for (const list of buckets.values()) {
        for (let a = 0; a < list.length; a++) {
          for (let b = a + 1; b < list.length; b++) {
            const i = list[a]
            const j = list[b]
            const wa = deformation.weightsAt(base[i], base[i + 1], base[i + 2])
            const wb = deformation.weightsAt(base[j], base[j + 1], base[j + 2])
            for (const key of ["torso", "arm", "leg", "neck", "head"] as const) {
              worst = Math.max(worst, Math.abs(wa[key] - wb[key]))
            }
          }
        }
      }
      // The bound is set by the mesh, not by the model: the ramps between
      // regions are about 4cm of stature wide and this mesh has vertices up to
      // 3cm apart, so two neighbours can legitimately sit at opposite ends of
      // one ramp. What this catches is a hard switch, which would score 1.
      assert.ok(worst < 0.75, `${sex}: neighbouring vertices disagree about their region by ${worst.toFixed(2)}`)
    }
  })

  it("follow a scale curve with no kink in it", () => {
    for (const sex of ["male", "female"] as const) {
      const profile = PROFILES[sex]
      const p = paramsFor(sex === "male" ? male : female)
      let previous = torsoSectionAt(profile, 0, p)
      let slope = 0
      for (let y = 0.002; y <= 1; y += 0.002) {
        const now = torsoSectionAt(profile, y, p)
        for (const key of ["width", "depth"] as const) {
          const step = now[key] - previous[key]
          assert.ok(Math.abs(step) < 0.02, `${sex}: the ${key} curve stepped at y=${y.toFixed(3)}`)
          assert.ok(Math.abs(step - slope) < 0.01, `${sex}: the ${key} curve kinked at y=${y.toFixed(3)}`)
          if (key === "width") slope = step
        }
        previous = now
      }
    }
  })
})
