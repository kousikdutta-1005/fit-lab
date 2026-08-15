/**
 * Check the committed body assets before anything is built on them.
 *
 * Two failures this is here to catch. One is an asset that is not what it says
 * it is: not a GLB, not normalised, or the same mesh committed twice under two
 * sexes. The other is quieter and worse: a profile that has drifted from the
 * mesh it describes, which does not throw anywhere, it just draws a body with
 * its landmarks in the wrong places. So the profile is recomputed here from the
 * committed mesh and compared byte for byte with the committed table.
 */

import { NodeIO } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"
import { createHash } from "node:crypto"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { buildProfile, pointsOf } from "./body-profile.mjs"

const assets = [
  {
    name: "male",
    model: resolve("public/body/base.glb"),
    profile: resolve("src/data/body-profile.json"),
  },
  {
    name: "female",
    model: resolve("public/body/base-female.glb"),
    profile: resolve("src/data/body-profile-female.json"),
  },
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function inspectHeader(path) {
  const bytes = readFileSync(path)
  assert(bytes.length >= 20, `${path} is too small to be a GLB`)
  assert(bytes.toString("ascii", 0, 4) === "glTF", `${path} has no GLB magic header`)
  assert(bytes.readUInt32LE(4) === 2, `${path} is not glTF 2.0`)
  assert(bytes.readUInt32LE(8) === bytes.length, `${path} has an invalid declared length`)
  return createHash("sha256").update(bytes).digest("hex")
}

const TABLES = ["halfWidth", "halfDepth", "torsoHalfWidth", "torsoHalfDepth", "torsoGirth", "torsoArea"]
const LIMB_TABLES = ["axisX", "axisZ", "radiusX", "radiusZ", "area"]

function validateProfile(path, name) {
  const profile = JSON.parse(readFileSync(path, "utf8"))
  assert(Number.isInteger(profile.slices) && profile.slices > 0, `${name} profile has invalid slices`)
  for (const field of TABLES) {
    assert(
      Array.isArray(profile[field]) && profile[field].length === profile.slices,
      `${name} profile ${field} does not match its slice count`,
    )
    assert(
      profile[field].every((value) => Number.isFinite(value) && value >= 0),
      `${name} profile ${field} contains an invalid value`,
    )
  }
  for (const limb of ["arm", "leg"]) {
    for (const field of LIMB_TABLES) {
      const table = profile[limb][field]
      assert(
        Array.isArray(table) && table.length === profile.slices && table.every(Number.isFinite),
        `${name} profile ${limb}.${field} is not a finite table of the declared length`,
      )
    }
  }
  assert(
    profile.torsoCentreZ.length === profile.slices && profile.torsoCentreZ.every(Number.isFinite),
    `${name} profile torsoCentreZ is not a finite table of the declared length`,
  )

  // Landmarks in the wrong order draw a waist on a chest, and nothing else in
  // the stack would notice.
  const L = profile.landmarks
  const order = ["crotch", "hip", "waist", "chest", "shoulder", "neck", "headBase"]
  for (const key of [...order, "armTop", "armBottom"]) {
    assert(Number.isFinite(L?.[key]) && L[key] > 0 && L[key] <= 1, `${name} landmark ${key} is not on the body`)
  }
  for (let i = 1; i < order.length; i++) {
    assert(L[order[i]] > L[order[i - 1]], `${name} landmark ${order[i]} is not above ${order[i - 1]}`)
  }
  assert(L.armTop > L.armBottom, `${name} has an arm that ends below where it starts`)
  return profile
}

/**
 * The profile has to be a measurement of this mesh and not of an earlier one.
 * Recomputing is cheap; a stale table is invisible until someone looks at the
 * figure and cannot say why it is wrong.
 */
function assertProfileMatchesMesh(doc, committed, name) {
  const measured = buildProfile(pointsOf(doc))
  assert(
    JSON.stringify(measured) === JSON.stringify(committed),
    `${name} profile has drifted from its mesh. Run node scripts/build-body-profile.mjs`,
  )
}

async function validateModel(io, asset) {
  const doc = await io.read(asset.model)
  const primitives = doc.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives())
  assert(primitives.length > 0, `${asset.name} model has no mesh primitives`)

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  let vertices = 0
  for (const primitive of primitives) {
    const position = primitive.getAttribute("POSITION")
    assert(position, `${asset.name} primitive has no POSITION attribute`)
    vertices += position.getCount()
    const lo = position.getMin([])
    const hi = position.getMax([])
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], lo[axis])
      max[axis] = Math.max(max[axis], hi[axis])
    }
  }

  const tolerance = 0.0002
  assert(Math.abs(min[1]) <= tolerance, `${asset.name} feet are not at y=0: ${min[1]}`)
  assert(Math.abs(max[1] - 1) <= tolerance, `${asset.name} height is not 1: ${max[1]}`)
  assert(Math.abs(min[0] + max[0]) <= tolerance, `${asset.name} is not centred on X`)
  assert(Math.abs(min[2] + max[2]) <= tolerance, `${asset.name} is not centred on Z`)

  return { vertices, min, max, doc }
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const hashes = new Set()

for (const asset of assets) {
  assert(statSync(asset.model).size > 0, `${asset.name} model is empty`)
  const hash = inspectHeader(asset.model)
  assert(!hashes.has(hash), `${asset.name} model duplicates another body asset`)
  hashes.add(hash)
  const profile = validateProfile(asset.profile, asset.name)
  const result = await validateModel(io, asset)
  assertProfileMatchesMesh(result.doc, profile, asset.name)
  console.log(
    `${asset.name}: ${result.vertices} vertices, bounds ${result.min.map((n) => n.toFixed(4)).join(",")} to ${result.max.map((n) => n.toFixed(4)).join(",")}, sha256 ${hash}`,
  )
  console.log(`  landmarks ${JSON.stringify(profile.landmarks)}`)
}
