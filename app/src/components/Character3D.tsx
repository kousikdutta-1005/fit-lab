import { useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { Build } from "./Character"

/**
 * The body, as a scan.
 *
 * No avatar service will do this honestly. The free ones (Ready Player Me,
 * DiceBear, Avataaars) do not vary body shape by measurement at all, and the
 * one that genuinely does, SMPL via Meshcapade, is a paid B2B service whose
 * underlying model is licensed for non-commercial research only. So the
 * silhouette here is generated directly from the tape.
 *
 * Rendering is done with free MIT libraries. Only the part nobody will do
 * honestly is written here.
 *
 * It is deliberately a hologram rather than a person. It is a readout of a
 * body, it says so, and it cannot flatter: every radius below is a
 * consequence of a number the user entered.
 */

const SEGMENTS = 30

/** Circumference in cm to a radius in scene units. */
function radiusOf(cm: number): number {
  return (cm / (2 * Math.PI)) * 0.03
}

/**
 * A vertical profile of the torso, swept into a solid. The proportions come
 * from the measurements; only the smoothing between them is invented.
 */
function torsoProfile(build: Build): THREE.Vector2[] {
  const { sex, waistCm, shoulderRatio, muscle, bodyFat } = build

  const waist = radiusOf(waistCm)
  const soft = Math.min(1, Math.max(0, (bodyFat - 12) / 28))

  const shoulder = waist * shoulderRatio * 0.92
  const chest = waist * (sex === "female" ? 1.04 : 1.11) + muscle * 0.055
  const hip = waist * (sex === "female" ? 1.15 : 1.03)
  const belly = waist * (1 + soft * 0.17)

  const pts: [number, number][] = [
    [hip * 0.8, 0.0],
    [hip * 0.98, 0.09],
    [hip, 0.22],
    [belly, 0.4],
    [waist * (1 + soft * 0.05), 0.55],
    [chest * 0.95, 0.74],
    [chest, 0.9],
    [shoulder, 1.06],
    [shoulder * 0.66, 1.18],
    [shoulder * 0.26, 1.24],
  ]

  return pts.map(([x, y]) => new THREE.Vector2(Math.max(0.02, x), y))
}

function useLimbTransform(
  from: [number, number, number],
  to: [number, number, number],
) {
  return useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const dir = new THREE.Vector3().subVectors(b, a)
    const length = dir.length()
    const position = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    )
    return { position, quaternion, length }
  }, [from, to])
}

function Limb({
  from,
  to,
  radius,
  materials,
}: {
  from: [number, number, number]
  to: [number, number, number]
  radius: number
  materials: { solid: THREE.Material; wire: THREE.Material }
}) {
  const { position, quaternion, length } = useLimbTransform(from, to)
  const geom = useMemo(
    () => new THREE.CapsuleGeometry(radius, Math.max(0.02, length - radius * 2), 4, SEGMENTS),
    [radius, length],
  )
  return (
    <group position={position} quaternion={quaternion}>
      <mesh geometry={geom} material={materials.solid} />
      <mesh geometry={geom} material={materials.wire} scale={1.02} />
    </group>
  )
}

function Figure({ build, reduced }: { build: Build; reduced: boolean }) {
  const group = useRef<THREE.Group>(null)
  const profile = useMemo(() => torsoProfile(build), [build])
  const torso = useMemo(() => new THREE.LatheGeometry(profile, SEGMENTS), [profile])

  const { sex, waistCm, shoulderRatio, muscle, bodyFat } = build
  const waist = radiusOf(waistCm)
  const shoulder = waist * shoulderRatio * 0.92
  const fatPad = Math.max(0, (bodyFat - 15) / 100)
  const armR = 0.036 + muscle * 0.024 + fatPad * 0.04
  const legR = 0.055 + muscle * 0.034 + fatPad * 0.05
  const hipX = waist * (sex === "female" ? 0.5 : 0.44)

  const materials = useMemo(() => {
    const solid = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#0e3d44"),
      emissive: new THREE.Color("#1ea99a"),
      emissiveIntensity: 0.5,
      roughness: 0.28,
      metalness: 0.1,
      transmission: 0.62,
      thickness: 1.1,
      transparent: true,
      opacity: 0.62,
      clearcoat: 0.7,
    })
    const wire = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#5cf0dc"),
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    })
    return { solid, wire }
  }, [])

  useFrame((state) => {
    if (!group.current || reduced) return
    const t = state.clock.elapsedTime
    group.current.rotation.y = Math.sin(t * 0.2) * 0.5
    group.current.position.y = -1.05 + Math.sin(t * 0.7) * 0.012
  })

  return (
    <group ref={group} position={[0, -1.05, 0]}>
      <mesh geometry={torso} material={materials.solid} position={[0, 0.86, 0]} />
      <mesh geometry={torso} material={materials.wire} position={[0, 0.86, 0]} scale={1.012} />

      <mesh material={materials.solid} position={[0, 2.24, 0]}>
        <sphereGeometry args={[0.132, SEGMENTS, 20]} />
      </mesh>
      <mesh material={materials.wire} position={[0, 2.24, 0]} scale={1.02}>
        <sphereGeometry args={[0.132, SEGMENTS, 20]} />
      </mesh>
      <mesh material={materials.solid} position={[0, 2.08, 0]}>
        <cylinderGeometry args={[0.048, 0.058, 0.11, 14]} />
      </mesh>

      <Limb from={[-shoulder * 0.95, 1.97, 0]} to={[-shoulder * 1.18, 1.44, 0.02]} radius={armR} materials={materials} />
      <Limb from={[-shoulder * 1.18, 1.44, 0.02]} to={[-shoulder * 1.22, 0.95, 0.05]} radius={armR * 0.84} materials={materials} />
      <Limb from={[shoulder * 0.95, 1.97, 0]} to={[shoulder * 1.18, 1.44, 0.02]} radius={armR} materials={materials} />
      <Limb from={[shoulder * 1.18, 1.44, 0.02]} to={[shoulder * 1.22, 0.95, 0.05]} radius={armR * 0.84} materials={materials} />

      <Limb from={[-hipX, 0.84, 0]} to={[-hipX * 0.92, 0.44, 0]} radius={legR} materials={materials} />
      <Limb from={[-hipX * 0.92, 0.44, 0]} to={[-hipX * 0.88, 0.04, 0]} radius={legR * 0.7} materials={materials} />
      <Limb from={[hipX, 0.84, 0]} to={[hipX * 0.92, 0.44, 0]} radius={legR} materials={materials} />
      <Limb from={[hipX * 0.92, 0.44, 0]} to={[hipX * 0.88, 0.04, 0]} radius={legR * 0.7} materials={materials} />
    </group>
  )
}

/** The sweep that makes it read as a scan in progress. */
function ScanRing() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    const p = (state.clock.elapsedTime * 0.26) % 1
    ref.current.position.y = -1.05 + p * 2.5
    const m = ref.current.material as THREE.MeshBasicMaterial
    m.opacity = 0.42 * Math.sin(p * Math.PI)
    const s = 1 + Math.sin(p * Math.PI) * 0.06
    ref.current.scale.setScalar(s)
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.34, 0.62, 72]} />
      <meshBasicMaterial color="#5cf0dc" transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** The plinth the figure stands on. */
function Base() {
  return (
    <group position={[0, -1.06, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.52, 0.56, 72]} />
        <meshBasicMaterial color="#4be3d0" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 0.735, 72]} />
        <meshBasicMaterial color="#4be3d0" transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <circleGeometry args={[0.56, 72]} />
        <meshBasicMaterial color="#0a2b2f" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Motes() {
  const ref = useRef<THREE.Points>(null)
  const geom = useMemo(() => {
    const n = 120
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 0.7 + Math.random() * 1.5
      const a = Math.random() * Math.PI * 2
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = Math.random() * 2.6 - 1.1
      pos[i * 3 + 2] = Math.sin(a) * r
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.045
  })

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial size={0.016} color="#4be3d0" transparent opacity={0.5} sizeAttenuation />
    </points>
  )
}

export default function Character3D({
  build,
  height = 400,
}: {
  build: Build
  height?: number
}) {
  const reduced =
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  return (
    <div style={{ height, width: "100%" }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.28, 3.5], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.7} />
        <pointLight position={[2.5, 2.5, 2.5]} intensity={18} color="#8affe9" distance={12} />
        <pointLight position={[-2.5, 1, -1.5]} intensity={14} color="#8a7bff" distance={12} />
        <pointLight position={[0, -1, 2]} intensity={6} color="#4be3d0" distance={8} />

        <Figure build={build} reduced={reduced} />
        <Base />
        {!reduced && <ScanRing />}
        {!reduced && <Motes />}
      </Canvas>
    </div>
  )
}
