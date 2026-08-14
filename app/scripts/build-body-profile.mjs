/**
 * Re-measure the committed body meshes and write their profiles.
 *
 * The meshes themselves are built by build-body.mjs from ~12MB source files
 * that are deliberately not in the repository. The profile, though, is only a
 * measurement of the committed mesh, so it can be rebuilt at any time from what
 * is here. validate-body-assets.mjs recomputes it and fails if the committed
 * table has drifted from the mesh it claims to describe.
 *
 * Usage: node scripts/build-body-profile.mjs [--check]
 */

import { NodeIO } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { buildProfile, pointsOf } from "./body-profile.mjs"

export const BODIES = [
  { name: "male", model: "public/body/base.glb", profile: "src/data/body-profile.json" },
  { name: "female", model: "public/body/base-female.glb", profile: "src/data/body-profile-female.json" },
]

export async function measure(io, body) {
  const doc = await io.read(resolve(body.model))
  return buildProfile(pointsOf(doc))
}

function report(name, profile, statureCm) {
  const { landmarks: L, slices } = profile
  const at = (table, frac) => table[Math.min(slices - 1, Math.round(frac * slices))]
  console.log(`\n${name} at ${statureCm}cm:`)
  console.log(`  landmarks ${JSON.stringify(L)}`)
  for (const [label, frac] of [
    ["hip", L.hip],
    ["waist", L.waist],
    ["chest", L.chest],
    ["shoulder", L.shoulder],
    ["neck", L.neck],
  ]) {
    const w = at(profile.torsoHalfWidth, frac) * statureCm * 2
    const d = at(profile.torsoHalfDepth, frac) * statureCm * 2
    const g = at(profile.torsoGirth, frac) * statureCm
    console.log(
      `  ${label.padEnd(9)} y=${frac.toFixed(3)} width ${w.toFixed(1)}cm depth ${d.toFixed(1)}cm tape ${g.toFixed(1)}cm`,
    )
  }
  const armSlices = profile.arm.radiusX.filter((r) => r > 0).length
  const legSlices = profile.leg.radiusX.filter((r) => r > 0).length
  console.log(`  arm tracked over ${armSlices} slices, legs over ${legSlices}`)
  const armAt = (frac) => {
    const i = Math.round(frac * slices)
    const rx = profile.arm.radiusX[i] * statureCm
    const rz = profile.arm.radiusZ[i] * statureCm
    return `axis ${(profile.arm.axisX[i] * statureCm).toFixed(1)}cm girth ~${(Math.PI * (rx + rz)).toFixed(1)}cm`
  }
  console.log(`  upper arm ${armAt(0.7)} | forearm ${armAt(0.58)}`)
  const legAt = (frac) => {
    const i = Math.round(frac * slices)
    return `axis ${(profile.leg.axisX[i] * statureCm).toFixed(1)}cm tape ${(profile.leg.girth[i] * statureCm).toFixed(1)}cm`
  }
  console.log(`  thigh ${legAt(0.42)} | calf ${legAt(0.2)}`)

  if (process.argv.includes("--slices")) {
    console.log("  slice  y      torsoW  torsoD  tape   armAxis armR   legAxis legTape")
    for (let s = 0; s < slices; s++) {
      const cm = (n) => (n * statureCm).toFixed(1).padStart(6)
      console.log(
        `  ${String(s).padStart(2)}   ${(s / slices).toFixed(3)} ${cm(profile.torsoHalfWidth[s] * 2)}  ${cm(
          profile.torsoHalfDepth[s] * 2,
        )}  ${cm(profile.torsoGirth[s])} ${cm(profile.arm.axisX[s])} ${cm(profile.arm.radiusX[s])} ${cm(
          profile.leg.axisX[s],
        )} ${cm(profile.leg.girth[s])}`,
      )
    }
  }
}

async function main() {
  const check = process.argv.includes("--check")
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  let drifted = false

  for (const body of BODIES) {
    const profile = await measure(io, body)
    const text = JSON.stringify(profile, null, 1)
    const path = resolve(body.profile)
    if (check) {
      const committed = readFileSync(path, "utf8")
      if (committed !== text) {
        console.error(`${body.name}: committed profile does not match the mesh. Run node scripts/build-body-profile.mjs`)
        drifted = true
      } else {
        console.log(`${body.name}: profile matches the mesh`)
      }
    } else {
      writeFileSync(path, text)
      console.log(`${body.name}: wrote ${body.profile}`)
    }
    report(body.name, profile, body.name === "male" ? 175 : 162)
  }

  if (drifted) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
