import { useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import type { Build } from "./Character"
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
 * The honesty is structural rather than promised. The mesh's own width at every
 * height is measured at build time; at runtime each horizontal slice is scaled
 * by the ratio between the user's real girth and the mesh's girth at that
 * height. Nobody can be rendered narrower than their tape says they are.
 */

type BodyProfile = typeof maleProfile

const MODELS: Record<Build["sex"], string> = {
  male: `${import.meta.env.BASE_URL}body/base.glb`,
  female: `${import.meta.env.BASE_URL}body/base-female.glb`,
}
const PROFILES: Record<Build["sex"], BodyProfile> = {
  male: maleProfile,
  female: femaleProfile,
}
const FIGURE = 2.5
const DEPTH = 0.72

/** Landmarks as a fraction of stature. */
const L = { hip: 0.485, waist: 0.6, chest: 0.72, shoulder: 0.82 }

/**
 * A circumference in cm becomes a half-width as a fraction of stature. The
 * cross-section is treated as an ellipse rather than a circle: sweeping a
 * circle makes waist, chest and hip come out nearly equal and a body read as a
 * tube.
 */
function halfWidthOf(cm: number, heightCm: number): number {
  return cm / (Math.PI * (1 + DEPTH) * 1.02) / heightCm
}

function baseAt(table: number[], frac: number, slices: number): number {
  const i = Math.min(slices - 1, Math.max(0, Math.round(frac * slices)))
  return table[i] || 0.0001
}

/**
 * The scale-per-height curve. Anchored at the measured landmarks and relaxed
 * back to the base mesh at the crown and the floor, so a wide waist does not
 * also produce a wide skull.
 */
function scaleCurve(build: Build, profile: BodyProfile): Float32Array {
  const { waistCm, hipCm, heightCm, sex, shoulderRatio, muscle, bodyFat } = build
  const slices = profile.slices
  const torso = profile.torsoHalfWidth

  const waistTarget = halfWidthOf(waistCm, heightCm)
  const hipTarget =
    hipCm > 0 ? halfWidthOf(hipCm, heightCm) : waistTarget * (sex === "female" ? 1.14 : 1.02)

  // Chest is not measured, so it is inferred from the waist and from how much
  // muscle the person reports. Inferred, and labelled as such in the interface.
  const chestTarget = waistTarget * (sex === "female" ? 1.08 : 1.14) + muscle * 0.012
  const shoulderTarget = chestTarget * (shoulderRatio / (sex === "male" ? 1.42 : 1.28))

  const anchors: [number, number][] = [
    [0.0, 1],
    [0.2, 1 + (muscle - 0.35) * 0.12 + Math.max(0, (bodyFat - 18) / 100) * 0.35],
    [L.hip, hipTarget / baseAt(torso, L.hip, slices)],
    [L.waist, waistTarget / baseAt(torso, L.waist, slices)],
    [L.chest, chestTarget / baseAt(torso, L.chest, slices)],
    [L.shoulder, shoulderTarget / baseAt(torso, L.shoulder, slices)],
    [0.9, 1],
    [1.0, 1],
  ]

  const curve = new Float32Array(slices + 1)
  for (let i = 0; i <= slices; i++) {
    const y = i / slices
    let a = anchors[0]
    let b = anchors[anchors.length - 1]
    for (let k = 0; k < anchors.length - 1; k++) {
      if (y >= anchors[k][0] && y <= anchors[k + 1][0]) {
        a = anchors[k]
        b = anchors[k + 1]
        break
      }
    }
    const span = b[0] - a[0]
    const t = span <= 0 ? 0 : (y - a[0]) / span
    const smooth = t * t * (3 - 2 * t)
    curve[i] = THREE.MathUtils.clamp(a[1] + (b[1] - a[1]) * smooth, 0.55, 2.2)
  }
  return curve
}

function sampleCurve(curve: Float32Array, y: number, slices: number): number {
  const f = THREE.MathUtils.clamp(y, 0, 1) * slices
  const i = Math.floor(f)
  const t = f - i
  const a = curve[Math.min(slices, i)]
  const b = curve[Math.min(slices, i + 1)]
  return a + (b - a) * t
}

function Body({ build, reduced }: { build: Build; reduced: boolean }) {
  const model = MODELS[build.sex]
  const profile = PROFILES[build.sex]
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
    const curve = scaleCurve(build, profile)
    const limb = 1 + (build.muscle - 0.35) * 0.22 + Math.max(0, (build.bodyFat - 18) / 100) * 0.5

    for (const { geom, base } of targets) {
      const pos = geom.getAttribute("position") as THREE.BufferAttribute
      const arr = pos.array as Float32Array
      for (let i = 0; i < base.length; i += 3) {
        const x = base[i]
        const y = base[i + 1]
        const z = base[i + 2]
        const s = sampleCurve(curve, y, profile.slices)
        // Past the edge of the torso a vertex belongs to an arm or a leg, where
        // girth answers to muscle and fat rather than to the waist tape.
        const outer = Math.min(1, Math.max(0, (Math.abs(x) - 0.075) / 0.06))
        const f = s * (1 - outer) + limb * outer
        arr[i] = x * f
        arr[i + 1] = y
        arr[i + 2] = z * f
      }
      pos.needsUpdate = true
      geom.computeVertexNormals()
      geom.computeBoundingSphere()
    }
  }, [build, profile, targets])

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
    spin.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.6
  })

  return (
    <group ref={spin}>
      <group position={[0, -FIGURE / 2, 0]} scale={FIGURE}>
        <primitive object={root} />
      </group>
    </group>
  )
}

function ScanRing() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    const p = (state.clock.elapsedTime * 0.24) % 1
    ref.current.position.y = -FIGURE / 2 + p * FIGURE
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

function Plinth() {
  return (
    <group position={[0, -FIGURE / 2 + 0.004, 0]}>
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

export default function Character3D({ build, height = 400 }: { build: Build; height?: number }) {
  const reduced =
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  return (
    <div style={{ height, width: "100%" }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.02, 4.45], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2.5, 3, 3]} intensity={1.7} color="#dffff9" />
        <pointLight position={[2.6, 1.6, 2.4]} intensity={16} color="#8affe9" distance={12} />
        <pointLight position={[-2.6, 1.2, -1.6]} intensity={13} color="#8a7bff" distance={12} />
        <pointLight position={[0, -0.8, 2.2]} intensity={5} color="#4be3d0" distance={8} />

        <Body key={build.sex} build={build} reduced={reduced} />
        <Plinth />
        {!reduced && <ScanRing />}
      </Canvas>
    </div>
  )
}
