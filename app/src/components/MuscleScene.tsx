import { useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import type { ThreeEvent } from "@react-three/fiber"
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
function Muscles({ active, onToggle }: { active: MuscleId[]; onToggle?: (id: MuscleId) => void }) {
  const { scene } = useGLTF(MODEL)
  const spin = useRef<THREE.Group>(null)

  const materials = useMemo(() => {
    // Flesh rather than plastic: physical material with a little sheen and
    // clearcoat reads closer to an ecorche than flat shading does.
    const on = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#c02a33"),
      emissive: new THREE.Color("#7d0f18"),
      emissiveIntensity: 0.55,
      roughness: 0.52,
      metalness: 0,
      clearcoat: 0.45,
      clearcoatRoughness: 0.6,
      sheen: 0.6,
      sheenColor: new THREE.Color("#ff8a7a"),
      sheenRoughness: 0.7,
      side: THREE.DoubleSide,
    })
    const off = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#7d5f5c"),
      emissive: new THREE.Color("#221a1c"),
      emissiveIntensity: 0.3,
      roughness: 0.72,
      metalness: 0,
      sheen: 0.35,
      sheenColor: new THREE.Color("#c39b93"),
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    })
    // Bone sits behind everything and is never the subject.
    const bone = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#d9d2c4"),
      emissive: new THREE.Color("#2a2a26"),
      emissiveIntensity: 0.16,
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

  /**
   * Picking a muscle off the model itself.
   *
   * Every mesh carries its group as a name prefix, written by
   * scripts/build-anatomy.mjs, so the raycast hit is already the answer. The
   * chips below the scene do the same job for keyboard and for anybody whose
   * device never loads this canvas, so nothing here is the only way in.
   */
  const pick = (event: ThreeEvent<MouseEvent>) => {
    if (!onToggle) return
    const group = (event.object as THREE.Mesh).name.split("__")[0]
    if (!group || group === "context") return
    event.stopPropagation()
    onToggle(group as MuscleId)
  }

  return (
    <group ref={spin}>
      <primitive
        object={figure}
        onClick={pick}
        onPointerOver={onToggle ? () => (document.body.style.cursor = "pointer") : undefined}
        onPointerOut={onToggle ? () => (document.body.style.cursor = "") : undefined}
      />
    </group>
  )
}

export default function MuscleScene({
  active,
  height,
  onToggle,
}: {
  active: MuscleId[]
  height: number
  onToggle?: (id: MuscleId) => void
}) {
  return (
    <div style={{ height, width: "100%" }}>
      <Canvas dpr={[1, 1.7]} camera={{ position: [0, 0, 3.9], fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#ffe9dd", "#0a1418", 0.55]} />
        {/* Key from the front right, cool rim from behind left: standard
            sculpture lighting, which is what makes musculature legible. */}
        <directionalLight position={[3, 3.5, 4]} intensity={2.6} color="#fff2e8" />
        <directionalLight position={[-3.5, 1.5, -2.5]} intensity={2.2} color="#4be3d0" />
        <pointLight position={[0, -1.2, 3]} intensity={9} color="#ff7a6b" distance={11} />
        <pointLight position={[0, 2.4, -2.5]} intensity={7} color="#8a7bff" distance={11} />
        <Muscles active={active} onToggle={onToggle} />
      </Canvas>
    </div>
  )
}

useGLTF.preload(MODEL)
