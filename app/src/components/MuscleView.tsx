import { Suspense, lazy, useEffect, useRef, useState } from "react"
import type { MuscleId } from "../data/exercises"

const MuscleScene = lazy(() => import("./MuscleScene"))

/**
 * The anatomy layer.
 *
 * The mesh is real. It comes from the Open 3D Model of Human Anatomy, built by
 * anatomists across seven universities and released CC BY-SA 4.0, cut down to
 * the muscles this product names. See public/anatomy/LICENSE.txt.
 *
 * This is the correct use for an anatomy model: showing what an exercise
 * trains. It is deliberately NOT used as the body, because its shape is fixed
 * and cannot answer to anybody's measurements.
 *
 * Like the body view, it is an enhancement and never a requirement.
 */
export function MuscleView({
  active,
  height = 300,
  onToggle,
}: {
  active: MuscleId[]
  height?: number
  /** Given when the model itself is a way of choosing, not only a picture. */
  onToggle?: (id: MuscleId) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    if (typeof window === "undefined") return
    try {
      const c = document.createElement("canvas")
      if (!(c.getContext("webgl2") ?? c.getContext("webgl"))) return
    } catch {
      return
    }
    if ((navigator.hardwareConcurrency ?? 4) <= 2) return
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection
    if (conn?.saveData || /2g/.test(conn?.effectiveType ?? "")) return

    const el = ref.current
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ height, position: "relative", maxWidth: 460, margin: "0 auto" }}>
      {show ? (
        <Suspense fallback={<Placeholder height={height} />}>
          <MuscleScene active={active} height={height} onToggle={onToggle} />
        </Suspense>
      ) : (
        <Placeholder height={height} />
      )}
    </div>
  )
}

function Placeholder({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        display: "grid",
        placeItems: "center",
        color: "var(--faint)",
        fontFamily: "var(--font-mono)",
        fontSize: "0.72rem",
        letterSpacing: "0.16em",
        textTransform: "uppercase",
      }}
    >
      Anatomy
    </div>
  )
}
