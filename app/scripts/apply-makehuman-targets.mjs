/**
 * Apply MakeHuman's sparse target deltas to its CC0 base OBJ and retain only
 * the visible body face group. Target entries are zero-based vertex indices
 * followed by xyz deltas, matching MakeHuman's Target.apply semantics.
 *
 * Usage:
 * node scripts/apply-makehuman-targets.mjs <base.obj> <output.obj> <target=weight>...
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const [baseArg, outputArg, ...targetArgs] = process.argv.slice(2)
if (!baseArg || !outputArg || targetArgs.length === 0) {
  console.error(
    "Usage: node scripts/apply-makehuman-targets.mjs <base.obj> <output.obj> <target=weight>...",
  )
  process.exit(1)
}

const targets = targetArgs.map((spec) => {
  const separator = spec.lastIndexOf("=")
  const path = spec.slice(0, separator)
  const weight = Number(spec.slice(separator + 1))
  if (separator <= 0 || !Number.isFinite(weight)) {
    throw new Error(`Invalid target specification: ${spec}`)
  }
  return { path: resolve(path), weight }
})

const baseLines = readFileSync(resolve(baseArg), "utf8").split(/\r?\n/)
const vertexCount = baseLines.filter((line) => line.startsWith("v ")).length
const deltas = Array.from({ length: vertexCount }, () => [0, 0, 0])

for (const target of targets) {
  let affected = 0
  for (const line of readFileSync(target.path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue
    const [indexText, dxText, dyText, dzText] = line.trim().split(/\s+/)
    const index = Number(indexText)
    const delta = [Number(dxText), Number(dyText), Number(dzText)]
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount || delta.some((n) => !Number.isFinite(n))) {
      throw new Error(`Invalid target row in ${target.path}: ${line}`)
    }
    for (let axis = 0; axis < 3; axis++) deltas[index][axis] += delta[axis] * target.weight
    affected++
  }
  console.log(`${target.path}: ${affected} deltas at weight ${target.weight}`)
}

const vertices = []
const textureCoordinates = []
const bodyFaces = []
let vertexIndex = 0
let group = ""

for (const line of baseLines) {
  if (line.startsWith("v ")) {
    const [, xText, yText, zText] = line.trim().split(/\s+/)
    const base = [Number(xText), Number(yText), Number(zText)]
    const moved = base.map((value, axis) => value + deltas[vertexIndex][axis])
    vertices.push(`v ${moved.map((value) => value.toFixed(6)).join(" ")}`)
    vertexIndex++
  } else if (line.startsWith("vt ")) {
    textureCoordinates.push(line)
  } else if (line.startsWith("g ")) {
    group = line.slice(2).trim()
  } else if (line.startsWith("f ") && group === "body") {
    bodyFaces.push(line)
  }
}

if (bodyFaces.length === 0) throw new Error("The source OBJ has no faces in its body group.")

const output = [
  "# Female body generated from MakeHuman CC0 base mesh and macro targets.",
  "# Source and licence evidence: public/body/LICENSE.txt",
  ...vertices,
  ...textureCoordinates,
  "g body",
  ...bodyFaces,
  "",
].join("\n")

writeFileSync(resolve(outputArg), output)
console.log(`written: ${resolve(outputArg)} (${vertices.length} vertices, ${bodyFaces.length} body faces)`)
