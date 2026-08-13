/// <reference types="@react-three/fiber" />
import { Suspense, useRef, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import type { ReactNode } from 'react'
import * as THREE from 'three'
import type { Build } from '../types'

const MALE_MESH = '/body/base.glb'
const FEMALE_MESH = '/body/base-female.glb'

interface AvatarProps {
  sex: Build['sex']
  waistScale: number
}

/**
 * Loads the sex-appropriate base mesh with fallback to male mesh on 404.
 */
function Avatar({ sex, waistScale }: AvatarProps) {
  const primaryPath = sex === 'female' ? FEMALE_MESH : MALE_MESH
  const [meshPath, setMeshPath] = useState(primaryPath)
  const [triedFallback, setTriedFallback] = useState(false)

  useEffect(() => {
    const path = sex === 'female' ? FEMALE_MESH : MALE_MESH
    setMeshPath(path)
    setTriedFallback(false)
  }, [sex])

  return (
    <AvatarMeshWithFallback
      path={meshPath}
      waistScale={waistScale}
      onError={() => {
        if (!triedFallback && meshPath !== MALE_MESH) {
          console.warn(`[fit-lab] ${meshPath} not found — falling back to ${MALE_MESH}`)
          setMeshPath(MALE_MESH)
          setTriedFallback(true)
        }
      }}
    />
  )
}

interface AvatarMeshWithFallbackProps {
  path: string
  waistScale: number
  onError: () => void
}

function AvatarMeshWithFallback({ path, waistScale, onError }: AvatarMeshWithFallbackProps) {
  const { scene } = useGLTF(path)
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!groupRef.current) return
    groupRef.current.scale.set(waistScale, 1, waistScale)
  }, [waistScale])

  // Trigger fallback if scene failed to load (drei throws on 404)
  useEffect(() => {
    if (!scene) onError()
  }, [scene, onError])

  return <primitive ref={groupRef} object={scene} />
}

// Preload both meshes to avoid waterfall when the user switches sex.
useGLTF.preload(MALE_MESH)
useGLTF.preload(FEMALE_MESH)

// ---------------------------------------------------------------------------
// WebGL guard
// ---------------------------------------------------------------------------

interface WebGLGuardProps {
  children: ReactNode
  fallback: ReactNode
}

function WebGLGuard({ children, fallback }: WebGLGuardProps) {
  const [hasWebGL] = useState<boolean>(() => {
    try {
      const canvas = document.createElement('canvas')
      return !!(
        canvas.getContext('webgl2') ??
        canvas.getContext('webgl') ??
        (canvas.getContext('experimental-webgl') as unknown)
      )
    } catch {
      return false
    }
  })
  return hasWebGL ? <>{children}</> : <>{fallback}</>
}

function NoWebGLFallback() {
  return (
    <div
      style={{
        width: '100%',
        height: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a1a',
        color: '#ccc',
        fontFamily: 'sans-serif',
        fontSize: 14,
        textAlign: 'center',
        padding: 24,
      }}
    >
      <p>
        3D preview unavailable (WebGL not supported).
        <br />
        Your assessment results are accurate — scroll down to see them.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface Character3DProps {
  build: Build
}

/**
 * Renders a 3D avatar whose sex and waist proportions reflect the user's Build.
 *
 * - Loads `body/base-female.glb` for female users, `body/base.glb` for male.
 * - Falls back to male mesh if the female mesh is missing (with a console warning).
 * - Degrades gracefully to a plain message when WebGL is unavailable.
 */
export function Character3D({ build }: Character3DProps) {
  const { sex, waistCm } = build

  // Normalise waist against population median reference to drive avatar width.
  const waistRef = sex === 'female' ? 68 : 72
  const waistScale = waistCm / waistRef

  return (
    <div style={{ width: '100%', height: 400, background: '#111', borderRadius: 8 }}>
      <WebGLGuard fallback={<NoWebGLFallback />}>
        <Canvas camera={{ position: [0, 1.5, 3], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 4, 2]} intensity={1} />
          <Suspense fallback={null}>
            <Avatar sex={sex} waistScale={waistScale} />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={1.5} maxDistance={6} />
        </Canvas>
      </WebGLGuard>
    </div>
  )
}
