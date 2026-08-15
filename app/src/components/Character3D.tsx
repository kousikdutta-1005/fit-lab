import { Suspense, useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import type { Build } from "./Character"
import type { BodyParams } from "../lib/body-model"
import { buildDeformation } from "../lib/body-deform"
import type { BodyProfile } from "../lib/body-profile"
import femaleProfile from "../data/body-profile-female.json"
import maleProfile from "../data/body-profile.json"

/**
 * The body: a real human mesh, deformed by the user's own measurements.
 *
 * No avatar API would do this honestly. The free ones do not vary body shape by
 * measurement at all, and the one that genuinely does, SMPL via Meshcapade, is
 * paid and licensed for non-commercial research only. So the lawful male and
 * female base meshes are selected here, and the deformation is written here.
 *
 * The arithmetic all lives in lib/body-model.ts and lib/body-deform.ts, which
 * know nothing about three.js and are tested against the real meshes. This file
 * does three things and no more: load the right mesh for the sex, hand the
 * pristine vertices to the deformation, and stand the result on the floor at
 * the person's own height.
 */

const MODELS: Record<Build["sex"], string> = {
  male: `${import.meta.env.BASE_URL}body/base.glb`,
  female: `${import.meta.env.BASE_URL}body/base-female.glb`,
}
const PROFILES: Record<Build["sex"], BodyProfile> = {
  male: maleProfile as BodyProfile,
  female: femaleProfile as BodyProfile,
}

/** How tall the figure stands when the person is 170cm. */
const REFERENCE_FIGURE = 2.5
/**
 * The floor. Fixed, so that a taller figure is visibly a taller figure rather
 * than the same figure drawn larger. The camera below is framed to hold the
 * tallest body this model supports, 210cm, with the crown still inside the
 * picture and the plinth still under the feet.
 */
const FLOOR = -1.62

function Body({
  build,
  params,
  reduced,
}: {
  build: Build
  params: BodyParams
  reduced: boolean
}) {
  const model = MODELS[build.sex]
  const profile = PROFILES[build.sex]
  const facing = build.sex === "male" ? Math.PI : 0
  const { scene } = useGLTF(model)
  const spin = useRef<THREE.Group>(null)

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#0e4a52"),
        emissive: new THREE.Color("#1bb9a8"),
        emissiveIntensity: 0.26,
        roughness: 0.3,
        metalness: 0.05,
        transmission: 0.3,
        thickness: 1.1,
        transparent: true,
        opacity: 0.92,
        clearcoat: 0.85,
        clearcoatRoughness: 0.3,
        side: THREE.DoubleSide,
      }),
    [],
  )

  /** Clone once, keeping pristine positions to deform from every time. */
  const { root, targets, shellMaterials } = useMemo(() => {
    const clone = scene.clone(true)
    const targets: { geom: THREE.BufferGeometry; base: Float32Array }[] = []
    const shellMaterials: THREE.MeshBasicMaterial[] = []
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry = mesh.geometry.clone()
      mesh.material = material
      const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute
      targets.push({ geom: mesh.geometry, base: Float32Array.from(pos.array as Float32Array) })
    })
    // A faint wire shell over the skin: this is a scan of a body, and it should
    // look like one rather than like a game character.
    const shells: THREE.Mesh[] = []
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || (mesh as THREE.Mesh & { userData: { shell?: boolean } }).userData.shell) return
      const shellMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color("#8bffee"),
        wireframe: true,
        transparent: true,
        opacity: 0.09,
      })
      shellMaterials.push(shellMaterial)
      const shell = new THREE.Mesh(mesh.geometry, shellMaterial)
      shell.userData.shell = true
      shell.scale.setScalar(1.004)
      shells.push(shell)
    })
    for (const shell of shells) clone.add(shell)

    return { root: clone, targets, shellMaterials }
  }, [scene, material])

  useEffect(() => {
    // Always from the pristine copy, never from the last shape drawn, so that
    // dragging a slider cannot compound and switching sex cannot leave a trace.
    const deformation = buildDeformation(profile, params)
    for (const { geom, base } of targets) {
      const pos = geom.getAttribute("position") as THREE.BufferAttribute
      deformation.apply(base, pos.array as Float32Array)
      pos.needsUpdate = true
      geom.computeVertexNormals()
      geom.computeBoundingSphere()
    }
  }, [params, profile, targets])

  useEffect(
    () => () => {
      for (const { geom } of targets) geom.dispose()
      for (const shellMaterial of shellMaterials) shellMaterial.dispose()
    },
    [shellMaterials, targets],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    if (!spin.current || reduced) return
    spin.current.rotation.y = facing + Math.sin(state.clock.elapsedTime * 0.2) * 0.6
  })

  return (
    <group ref={spin} rotation={[0, facing, 0]}>
      <group position={[0, FLOOR, 0]} scale={REFERENCE_FIGURE * params.stature}>
        <primitive object={root} />
      </group>
    </group>
  )
}

function ScanRing({ figure }: { figure: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    const p = (state.clock.elapsedTime * 0.24) % 1
    ref.current.position.y = FLOOR + p * figure
    const m = ref.current.material as THREE.MeshBasicMaterial
    m.opacity = 0.5 * Math.sin(p * Math.PI)
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.26, 0.5, 72]} />
      <meshBasicMaterial color="#7bffe9" transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  )
}

/**
 * The plinth never changes size, and that is the point of it. Without something
 * of a fixed size on the floor, a figure drawn taller is only a figure drawn
 * bigger, and height stops being visible at all.
 */
function Plinth() {
  return (
    <group position={[0, FLOOR + 0.004, 0]}>
      {[
        [0.4, 0.43, 0.55],
        [0.6, 0.615, 0.22],
      ].map(([a, b, o]) => (
        <mesh key={a} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[a, b, 72]} />
          <meshBasicMaterial color="#4be3d0" transparent opacity={o} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

function ContextGuard({ onUnavailable }: { onUnavailable: () => void }) {
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    const handleLost = (event: Event) => {
      event.preventDefault()
      onUnavailable()
    }
    canvas.addEventListener("webglcontextlost", handleLost)
    return () => canvas.removeEventListener("webglcontextlost", handleLost)
  }, [gl, onUnavailable])

  return null
}

export default function Character3D({
  build,
  params,
  height = 400,
  label,
  onUnavailable,
}: {
  build: Build
  params: BodyParams
  height?: number
  label: string
  onUnavailable: () => void
}) {
  const reduced =
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  return (
    // A canvas has no accessible name of its own, so the figure is announced
    // here or not at all.
    <div style={{ height, width: "100%" }} role="img" aria-label={label}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, -0.02, 4.55], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ContextGuard onUnavailable={onUnavailable} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[2.5, 3, 3]} intensity={1.7} color="#dffff9" />
        <pointLight position={[2.6, 1.6, 2.4]} intensity={16} color="#8affe9" distance={12} />
        <pointLight position={[-2.6, 1.2, -1.6]} intensity={13} color="#8a7bff" distance={12} />
        <pointLight position={[0, -0.8, 2.2]} intensity={5} color="#4be3d0" distance={8} />

        <Suspense fallback={null}>
          <Body key={build.sex} build={build} params={params} reduced={reduced} />
        </Suspense>
        <Plinth />
        {!reduced && <ScanRing figure={REFERENCE_FIGURE * (build.heightCm / 170)} />}
      </Canvas>
    </div>
  )
}

useGLTF.preload(MODELS.male)
useGLTF.preload(MODELS.female)
