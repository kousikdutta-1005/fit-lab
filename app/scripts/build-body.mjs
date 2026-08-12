/**
 * Prepare the body base mesh.
 *
 * Source: "Male base mesh with muscle detail" by C.J..Goldman, CC-BY-4.0.
 * https://sketchfab.com/3d-models/male-base-mesh-with-muscle-detail-244061a0323b4d2e9c60d9aba374c937
 * Attribution is required and is carried in public/body/LICENSE.txt and in the UI.
 *
 * Why a real mesh at all: a hand-rolled parametric body reads as a mannequin no
 * matter how carefully the proportions are set. A real human mesh, deformed by
 * the user's own measurements, is both better looking and still honest, because
 * the deformation is driven entirely by numbers the user entered.
 *
 * This script normalises the mesh so the runtime can reason in stature
 * fractions, and measures the mesh's own width profile so the runtime knows
 * what it is deforming FROM.
 *
 * Usage: node scripts/build-body.mjs <scene.gltf>
 */

import { NodeIO } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"
import { dedup, prune, weld } from "@gltf-transform/functions"
import { mkdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

const SLICES = 64

async function main() {
  const src = process.argv[2]
  if (!src) {
    console.error("Usage: node scripts/build-body.mjs <scene.gltf>")
    process.exit(1)
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.read(src)
  const root = doc.getRoot()

  // Textures are dead weight: the runtime material is a hologram.
  for (const t of root.listTextures()) t.dispose()
  for (const m of root.listMaterials()) {
    m.setBaseColorFactor([1, 1, 1, 1])
    m.setMetallicFactor(0)
    m.setRoughnessFactor(0.6)
  }

  await doc.transform(prune(), dedup(), weld())

  const prims = root.listMeshes().flatMap((m) => m.listPrimitives())

  // Pass one: find the bounds in the source orientation.
  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]
  for (const p of prims) {
    const pos = p.getAttribute("POSITION")
    const a = pos.getMin([])
    const b = pos.getMax([])
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], a[i])
      max[i] = Math.max(max[i], b[i])
    }
  }

  // The source is Z-up. Work out which axis is really the long one rather than
  // assuming, so a differently exported mesh does not silently come out lying down.
  const spans = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const up = spans.indexOf(Math.max(...spans))
  const side = [0, 1, 2].filter((i) => i !== up).sort((a, b) => spans[b] - spans[a])
  const [wide, deep] = side

  const height = spans[up]
  console.log(`source spans: ${spans.map((s) => s.toFixed(2)).join(" x ")} | up axis: ${"xyz"[up]}`)

  // Pass two: rewrite every vertex as Y-up, feet at y=0, height 1, centred.
  const midWide = (min[wide] + max[wide]) / 2
  const midDeep = (min[deep] + max[deep]) / 2

  for (const p of prims) {
    for (const semantic of ["POSITION", "NORMAL"]) {
      const attr = p.getAttribute(semantic)
      if (!attr) continue
      const isPos = semantic === "POSITION"
      const v = []
      for (let i = 0; i < attr.getCount(); i++) {
        attr.getElement(i, v)
        const x = isPos ? (v[wide] - midWide) / height : v[wide]
        const y = isPos ? (v[up] - min[up]) / height : v[up]
        const z = isPos ? (v[deep] - midDeep) / height : v[deep]
        attr.setElement(i, [x, y, z])
      }
    }
  }

  // Orientation is now baked into the vertices, so any node transform left in
  // place would rotate it a second time and lay the figure on its face.
  for (const node of root.listNodes()) {
    node.setTranslation([0, 0, 0])
    node.setRotation([0, 0, 0, 1])
    node.setScale([1, 1, 1])
  }

  // Pass three: measure the mesh's own half-width and half-depth at each height,
  // which is what the runtime deformation scales relative to.
  const halfWidth = new Array(SLICES).fill(0)
  const halfDepth = new Array(SLICES).fill(0)
  const v = []
  for (const p of prims) {
    const pos = p.getAttribute("POSITION")
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v)
      const slice = Math.min(SLICES - 1, Math.max(0, Math.floor(v[1] * SLICES)))
      halfWidth[slice] = Math.max(halfWidth[slice], Math.abs(v[0]))
      halfDepth[slice] = Math.max(halfDepth[slice], Math.abs(v[2]))
    }
  }

  // Torso slices only: arms sit at the same height as the chest and would
  // otherwise be mistaken for a very wide ribcage.
  const torsoHalfWidth = new Array(SLICES).fill(0)
  for (const p of prims) {
    const pos = p.getAttribute("POSITION")
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v)
      if (Math.abs(v[0]) > 0.14) continue
      const slice = Math.min(SLICES - 1, Math.max(0, Math.floor(v[1] * SLICES)))
      torsoHalfWidth[slice] = Math.max(torsoHalfWidth[slice], Math.abs(v[0]))
    }
  }

  const out = resolve("public/body/base.glb")
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, await io.writeBinary(doc))

  const profile = {
    slices: SLICES,
    note: "Half-width and half-depth of the base mesh at each height slice, in stature fractions. Feet at 0, crown at 1.",
    halfWidth: halfWidth.map((n) => +n.toFixed(4)),
    halfDepth: halfDepth.map((n) => +n.toFixed(4)),
    torsoHalfWidth: torsoHalfWidth.map((n) => +n.toFixed(4)),
  }
  writeFileSync(resolve("src/data/body-profile.json"), JSON.stringify(profile, null, 1))

  let verts = 0
  for (const p of prims) verts += p.getAttribute("POSITION").getCount()

  console.log(`vertices: ${verts}`)
  console.log(`written: ${out} ${(statSync(out).size / 1024).toFixed(0)} KB`)
  console.log("profile: src/data/body-profile.json")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
