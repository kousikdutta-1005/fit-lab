import { Suspense, lazy, useEffect, useRef, useState } from "react"
import type { Build } from "./Character"
import { Character } from "./Character"
import type { Look } from "./Character"

const Character3D = lazy(() => import("./Character3D"))

/**
 * The 3D layer is an enhancement and never a requirement.
 *
 * It loads only when the element is on screen, only when the device reports
 * more than a couple of cores, and never when the connection says it is slow.
 * If any of that fails, or WebGL is missing, the flat figure renders instead
 * and the assessment is completely unaffected.
 *
 * PRODUCT.md: "The game layer must degrade to text without losing the
 * assessment."
 */
function capable(): boolean {
  if (typeof window === "undefined") return false
  try {
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl")
    if (!gl) return false
  } catch {
    return false
  }
  const cores = navigator.hardwareConcurrency ?? 4
  if (cores <= 2) return false
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection
  if (conn?.saveData) return false
  if (conn?.effectiveType && /2g/.test(conn.effectiveType)) return false
  return true
}

export function BodyView({
  build,
  look,
  height = 400,
}: {
  build: Build
  look: Look
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!capable() || !ref.current) return
    const el = ref.current
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin: "160px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ minHeight: height }}>
      {show ? (
        <Suspense fallback={<Flat build={build} look={look} height={height} />}>
          <Character3D build={build} height={height} />
        </Suspense>
      ) : (
        <Flat build={build} look={look} height={height} />
      )}
    </div>
  )
}

function Flat({ build, look, height }: { build: Build; look: Look; height: number }) {
  return (
    <div style={{ display: "grid", placeItems: "center", height }}>
      <Character build={build} look={look} height={height * 0.82} />
    </div>
  )
}
