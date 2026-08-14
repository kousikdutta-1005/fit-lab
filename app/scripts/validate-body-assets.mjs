import { NodeIO } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"
import { createHash } from "node:crypto"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"

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

function validateProfile(path, name) {
  const profile = JSON.parse(readFileSync(path, "utf8"))
  assert(Number.isInteger(profile.slices) && profile.slices > 0, `${name} profile has invalid slices`)
  for (const field of ["halfWidth", "halfDepth", "torsoHalfWidth"]) {
    assert(
      Array.isArray(profile[field]) && profile[field].length === profile.slices,
      `${name} profile ${field} does not match its slice count`,
    )
    assert(
      profile[field].every((value) => Number.isFinite(value) && value >= 0),
      `${name} profile ${field} contains an invalid value`,
    )
  }
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

  return { vertices, min, max }
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const hashes = new Set()

for (const asset of assets) {
  assert(statSync(asset.model).size > 0, `${asset.name} model is empty`)
  const hash = inspectHeader(asset.model)
  assert(!hashes.has(hash), `${asset.name} model duplicates another body asset`)
  hashes.add(hash)
  validateProfile(asset.profile, asset.name)
  const result = await validateModel(io, asset)
  console.log(
    `${asset.name}: ${result.vertices} vertices, bounds ${result.min.map((n) => n.toFixed(4)).join(",")} to ${result.max.map((n) => n.toFixed(4)).join(",")}, sha256 ${hash}`,
  )
}
