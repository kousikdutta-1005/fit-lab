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

  const credit =
    build.sex === "female"
      ? {
          label: "Female base: MakeHuman Team · CC0",
          source:
            "https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/3dobjs/base.obj",
          licence:
            "https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.ASSETS.md",
        }
      : {
          label: "Male base: C.J..Goldman · CC BY 4.0",
          source:
            "https://sketchfab.com/3d-models/male-base-mesh-with-muscle-detail-244061a0323b4d2e9c60d9aba374c937",
          licence: "https://creativecommons.org/licenses/by/4.0/",
        }

  return (
    <figure ref={ref} style={{ minHeight: height, margin: 0, position: "relative" }}>
      {show ? (
        <Suspense fallback={<Flat build={build} look={look} height={height} />}>
          <Character3D build={build} height={height} />
        </Suspense>
      ) : (
        <Flat build={build} look={look} height={height} />
      )}
      <figcaption
        className="mono"
        style={{ position: "absolute", right: 8, top: 5, zIndex: 2, fontSize: "0.56rem", opacity: 0.58 }}
      >
        <a href={credit.source} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
          {credit.label}
        </a>
        {" · "}
        <a href={credit.licence} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
          licence
        </a>
      </figcaption>
    </figure>
  )
}

function Flat({ build, look, height }: { build: Build; look: Look; height: number }) {
  return (
    <div style={{ display: "grid", placeItems: "center", height }}>
      <Character build={build} look={look} height={height * 0.82} />
    </div>
  )
}
