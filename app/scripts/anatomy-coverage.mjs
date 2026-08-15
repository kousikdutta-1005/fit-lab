import { NodeIO, Primitive } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"

/**
 * Counts groups with at least one triangle surface reachable from the default
 * scene. A node name alone is not coverage: the build may have orphaned the
 * node or pruned its geometry.
 */
export async function anatomyGroupCoverage(filePath) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.read(filePath)
  const coverage = new Map()
  const scene = doc.getRoot().getDefaultScene()
  if (!scene) return coverage

  scene.traverse((node) => {
    const mesh = node.getMesh()
    const separator = node.getName().indexOf("__")
    if (!mesh || separator <= 0) return

    const renderable = mesh.listPrimitives().some((primitive) => {
      const mode = primitive.getMode()
      if (
        mode !== Primitive.Mode.TRIANGLES &&
        mode !== Primitive.Mode.TRIANGLE_STRIP &&
        mode !== Primitive.Mode.TRIANGLE_FAN
      ) {
        return false
      }

      const positions = primitive.getAttribute("POSITION")
      const drawCount = primitive.getIndices()?.getCount() ?? positions?.getCount() ?? 0
      return (positions?.getCount() ?? 0) >= 3 && drawCount >= 3
    })
    if (!renderable) return

    const group = node.getName().slice(0, separator)
    coverage.set(group, (coverage.get(group) ?? 0) + 1)
  })

  return coverage
}
