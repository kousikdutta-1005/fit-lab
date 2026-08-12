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
 * whole muscle group can be selected by string without shipping a lookup table.
 */
function Muscles({ active }: { active: MuscleId[] }) {
  const { scene } = useGLTF(MODEL)
  const root = useRef<THREE.Group>(null)

  const cloned = useMemo(() => scene.clone(true), [scene])

  const materials = useMemo(() => {
    const on = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ff5f6d"),
      emissive: new THREE.Color("#ff3b52"),
      emissiveIntensity: 0.75,
      roughness: 0.45,
      metalness: 0.05,
    })
    const off = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#16323a"),
      emissive: new THREE.Color("#0d6b70"),
      emissiveIntensity: 0.14,
      roughness: 0.7,
      metalness: 0.05,
      transparent: true,
      opacity: 0.35,
    })
    return { on, off }
  }, [])

  useEffect(() => {
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const group = mesh.name.split("__")[0] as MuscleId
      const lit = active.includes(group)
      mesh.material = lit ? materials.on : materials.off
      mesh.renderOrder = lit ? 1 : 0
    })
  }, [cloned, active, materials])

  // The source model is right-side only, so mirror it for a whole figure.
  useFrame((state) => {
    if (root.current) root.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.24) * 0.7
  })

  const box = useMemo(() => {
    const b = new THREE.Box3().setFromObject(cloned)
    const size = b.getSize(new THREE.Vector3())
    const center = b.getCenter(new THREE.Vector3())
    const scale = 2.6 / Math.max(size.x, size.y, size.z)
    return { center, scale }
  }, [cloned])

  return (
    <group ref={root}>
      <group scale={box.scale} position={[-box.center.x * box.scale, -box.center.y * box.scale, -box.center.z * box.scale]}>
        <primitive object={cloned} />
        <primitive object={cloned.clone(true)} scale={[-1, 1, 1]} />
      </group>
    </group>
  )
}

export default function MuscleScene({ active, height }: { active: MuscleId[]; height: number }) {
  return (
    <div style={{ height, width: "100%" }}>
      <Canvas dpr={[1, 1.7]} camera={{ position: [0, 0.1, 4.2], fov: 40 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[3, 3, 3]} intensity={20} color="#ffffff" distance={14} />
        <pointLight position={[-3, 1, -2]} intensity={12} color="#4be3d0" distance={12} />
        <Muscles active={active} />
      </Canvas>
    </div>
  )
}

useGLTF.preload(MODEL)
