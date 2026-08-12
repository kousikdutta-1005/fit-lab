import { useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import type { MuscleId } from "../data/exercises"

const MODEL = `${import.meta.env.BASE_URL}anatomy/muscles.glb`

/**
 * Renders the muscle mesh and lights up whichever groups are selected.
 *
 * Node names carry a group prefix, written by scripts/build-anatomy.mjs, so a
 * whole muscle group is selected by string without shipping a lookup table.
 *
 * The source model covers one side of the body only, so it is mirrored to make
 * a whole figure. Mirroring by negative scale reverses triangle winding, which
 * is why the materials here are explicitly double sided: without that, the
 * mirrored half renders inside out and reads as black.
 */
function Muscles({ active }: { active: MuscleId[] }) {
  const { scene } = useGLTF(MODEL)
  const spin = useRef<THREE.Group>(null)

  const materials = useMemo(() => {
    const on = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e8474f"),
      emissive: new THREE.Color("#ff3547"),
      emissiveIntensity: 0.62,
      roughness: 0.4,
      metalness: 0.04,
      side: THREE.DoubleSide,
    })
    const off = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#33565f"),
      emissive: new THREE.Color("#10383d"),
      emissiveIntensity: 0.25,
      roughness: 0.66,
      metalness: 0.04,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    })
    // Bone sits behind everything and is never the subject.
    const bone = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#8e9bb0"),
      emissive: new THREE.Color("#1a2634"),
      emissiveIntensity: 0.2,
      roughness: 0.85,
      metalness: 0.02,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    return { on, off, bone }
  }, [])

  /**
   * Assemble once: the half we were given, plus its mirror, centred on the
   * union of both. Building this during render would rebuild it every frame
   * and the material pass below would never reach the copy.
   */
  const figure = useMemo(() => {
    const container = new THREE.Group()

    const right = scene.clone(true)
    const left = scene.clone(true)
    left.scale.x = -1

    container.add(right, left)

    const box = new THREE.Box3().setFromObject(container)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = 2.55 / Math.max(size.y, 0.001)

    const wrapper = new THREE.Group()
    container.position.set(-center.x, -center.y, -center.z)
    wrapper.add(container)
    wrapper.scale.setScalar(scale)

    return wrapper
  }, [scene])

  useEffect(() => {
    figure.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const group = mesh.name.split("__")[0]
      if (group === "context") {
        mesh.material = materials.bone
        mesh.renderOrder = 0
        return
      }
      const lit = active.includes(group as MuscleId)
      mesh.material = lit ? materials.on : materials.off
      mesh.renderOrder = lit ? 2 : 1
    })
  }, [figure, active, materials])

  useFrame((state) => {
    if (spin.current) spin.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.22) * 0.75
  })

  return (
    <group ref={spin}>
      <primitive object={figure} />
    </group>
  )
}

export default function MuscleScene({ active, height }: { active: MuscleId[]; height: number }) {
  return (
    <div style={{ height, width: "100%" }}>
      <Canvas dpr={[1, 1.7]} camera={{ position: [0, 0, 3.9], fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={1.1} />
        <hemisphereLight args={["#bfefff", "#0a1418", 0.7]} />
        <directionalLight position={[2.5, 3, 3]} intensity={2.4} />
        <directionalLight position={[-3, 1, -2]} intensity={1.1} color="#4be3d0" />
        <pointLight position={[0, -1.5, 2.5]} intensity={6} color="#8a7bff" distance={10} />
        <Muscles active={active} />
      </Canvas>
    </div>
  )
}

useGLTF.preload(MODEL)
