/**
 * Build the anatomy asset.
 *
 * Source: the Open 3D Model of Human Anatomy, by the anatomy departments of
 * Leiden UMC, UMC Utrecht, Maastricht UMC, KU Leuven KULAK, Amsterdam UMC
 * (VUmc), Radboud UMC Nijmegen and University of Gent, funded by the Dutch
 * Ministry of Education, Culture and Science.
 *
 * Licensed CC BY-SA 4.0. https://anatomytool.org/open3dmodel
 * This derivative is therefore also CC BY-SA 4.0. See public/anatomy/LICENSE.txt.
 *
 * What this does, and why:
 *
 * The source models are superb and enormous. The upper limb alone is 6.6MB and
 * 1.37 million triangles, which would break the rule that this has to work on a
 * cheap phone. So we keep only the muscles the product actually names, throw
 * away every texture (the holographic material is generated at runtime), and
 * decimate hard. The anatomy stays correct; the detail we cannot use never
 * reaches anybody's phone.
 *
 * Usage:
 *   node scripts/build-anatomy.mjs <upper-limb.glb> <lower-limb.glb>
 */

import { NodeIO } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"
import { dedup, mergeDocuments, prune, simplify, weld } from "@gltf-transform/functions"
import { MeshoptSimplifier } from "meshoptimizer"
import draco3d from "draco3dgltf"
import { mkdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

/**
 * Which anatomical structures belong to which muscle group the product names.
 * Bursae, tendon sheaths, arteries and ligaments are deliberately excluded:
 * they are anatomically real and visually noisy, and the reader is being shown
 * what they are training, not sitting an anatomy exam.
 */
const GROUPS = {
  chest: [/^Pectoralis major/i, /head of pectoralis major/i, /^Pectoralis minor/i],
  back: [
    /^Latissimus dorsi/i,
    /^Trapezius muscle/i,
    /part of [Tt]rapezius muscle/i,
    /^Rhomboid/i,
    /^Serratus anterior/i,
  ],
  shoulders: [/^Deltoid muscle/i, /part of deltoid muscle/i],
  biceps: [/head of biceps brachii$/i],
  triceps: [/head of triceps brachii$/i],
  quads: [/^Rectus femoris$/i, /^Vastus/i],
  hamstrings: [/head of biceps femoris$/i, /^Semitendinosus muscle$/i, /^Semimembranosus muscle$/i],
  glutes: [/^Gluteus (maximus|medius|minimus) muscle$/i],
  calves: [/head of gastrocnemius$/i, /^Soleus muscle$/i],
}

const EXCLUDE = /bursa|bursae|sheath|artery|vein|nerve|ligament|syndesmosis|cord|tendon/i

/**
 * Bones are kept as context, dimmed at runtime. Without them the muscles float
 * in the dark with nothing to hang off, which reads as broken rather than as
 * anatomy. Skull and hands and feet are dropped: high polygon counts, and they
 * carry none of the muscles this product names.
 */
const CONTEXT = [
  /vertebra/i, /^Sacrum/i, /^Coccyx/i, /rib/i, /^Sternum/i, /^Clavicle/i, /^Scapula/i,
  /^Humerus/i, /^Radius/i, /^Ulna/i, /^Femur/i, /^Tibia/i, /^Fibula/i, /^Patella/i,
  /^Hip bone/i, /^Ilium/i, /^Ischium/i, /^Pubis/i,
  /^Skull/i, /^Cranium/i, /^Mandible/i, /^Maxilla/i, /^Frontal bone/i, /^Parietal bone/i,
  /^Occipital bone/i, /^Temporal bone/i, /^Sphenoid/i, /^Ethmoid/i, /^Zygomatic/i,
  /^Nasal bone/i, /^Lacrimal/i, /^Palatine/i, /^Vomer/i, /^Atlas/i, /^Axis/i,
  /^Calcaneus/i, /^Talus/i,
]
const CONTEXT_EXCLUDE = /tooth|teeth|dental|phalanx|metacarpal|metatarsal|carpal|tarsal|navicular|cuboid|cuneiform|hyoid/i

function baseName(name) {
  return name.replace(/\.[rl]$/i, "").trim()
}

function groupFor(rawName) {
  if (!rawName) return null
  if (EXCLUDE.test(rawName)) return null
  const name = baseName(rawName)
  for (const [group, patterns] of Object.entries(GROUPS)) {
    if (patterns.some((p) => p.test(name))) return group
  }
  return null
}

function isContext(rawName) {
  if (!rawName) return false
  if (CONTEXT_EXCLUDE.test(rawName)) return false
  const name = baseName(rawName)
  return CONTEXT.some((p) => p.test(name))
}

/**
 * Run the simplifier over only the meshes whose owning node matches, by
 * temporarily detaching the rest. gltf-transform's simplify() is document-wide.
 */
async function simplifyScoped(doc, match, ratio, error) {
  const detached = []
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    if (!match(node.getName())) {
      detached.push([node, mesh])
      node.setMesh(null)
    }
  }
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error, cleanup: false }))
  for (const [node, mesh] of detached) node.setMesh(mesh)
}

async function main() {
  const args = process.argv.slice(2)
  const split = args.indexOf("--context")
  const muscleSources = split === -1 ? args : args.slice(0, split)
  const contextSources = split === -1 ? [] : args.slice(split + 1)

  if (muscleSources.length === 0) {
    console.error("Usage: node scripts/build-anatomy.mjs <muscle.glb...> [--context <skeleton.glb...>]")
    process.exit(1)
  }

  await MeshoptSimplifier.ready

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  })

  const out = resolve("public/anatomy/muscles.glb")
  mkdirSync(dirname(out), { recursive: true })

  let merged = null
  const found = new Map()
  const sources = [...muscleSources, ...contextSources]

  for (const src of sources) {
    const doc = await io.read(src)
    let kept = 0

    for (const node of doc.getRoot().listNodes()) {
      const raw = node.getName()
      const group = groupFor(raw)
      if (group && node.getMesh()) {
        node.setName(`${group}__${baseName(raw)}`)
        found.set(group, (found.get(group) ?? 0) + 1)
        kept++
      } else if (node.getMesh() && isContext(raw)) {
        node.setName(`context__${baseName(raw)}`)
        found.set("context", (found.get("context") ?? 0) + 1)
        kept++
      } else if (node.getMesh()) {
        node.setMesh(null)
      }
    }

    console.log(`${src}: kept ${kept} structures`)
    if (!merged) merged = doc
    else mergeDocuments(merged, doc)
  }

  const root = merged.getRoot()
  const scenes = root.listScenes()
  const primary = scenes[0]
  for (const extra of scenes.slice(1)) {
    for (const node of extra.listChildren()) primary.addChild(node)
    extra.dispose()
  }
  root.setDefaultScene(primary)

  for (const texture of root.listTextures()) texture.dispose()
  for (const material of root.listMaterials()) {
    material.setBaseColorFactor([0.62, 0.24, 0.26, 1])
    material.setMetallicFactor(0.05)
    material.setRoughnessFactor(0.65)
  }

  // Merging brings a second buffer with it; GLB allows only one.
  const buffers = merged.getRoot().listBuffers()
  for (const extra of buffers.slice(1)) {
    for (const accessor of merged.getRoot().listAccessors()) {
      if (accessor.getBuffer() === extra) accessor.setBuffer(buffers[0])
    }
    extra.dispose()
  }

  await merged.transform(prune(), dedup(), weld())

  // Bones are dim context and never inspected closely, so they take a far
  // heavier cut than the muscles, which are the thing being looked at.
  await simplifyScoped(merged, (name) => !name.startsWith("context__"), 0.95, 0.0004)
  await simplifyScoped(merged, (name) => name.startsWith("context__"), 0.05, 0.02)

  await merged.transform(prune())

  let tris = 0
  for (const mesh of merged.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices()
      tris += idx ? idx.getCount() / 3 : 0
    }
  }

  // Drop Draco. Keeping it would force every visitor to fetch a WASM decoder
  // from a CDN before they could see anything, which costs more than the bytes
  // it saves at this mesh size.
  for (const ext of merged.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === "KHR_draco_mesh_compression") ext.dispose()
  }

  writeFileSync(out, await io.writeBinary(merged))

  console.log("\ngroups found:", Object.fromEntries([...found].sort()))
  console.log("triangles:", Math.round(tris).toLocaleString())
  console.log("written:", out, (statSync(out).size / 1024 / 1024).toFixed(2), "MB")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
