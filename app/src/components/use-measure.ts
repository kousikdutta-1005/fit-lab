import { useEffect, useRef, useState } from "react"

/**
 * Measures an element and reports its height in pixels.
 *
 * The 3D canvas and the SVG figure both need a number, and the number that
 * matters is "whatever is left after the controls have taken their share of a
 * 390x844 phone". So the scene is sized by CSS and the pixels are read back,
 * rather than a height being guessed in JavaScript and then fought over.
 */
export function useMeasuredHeight<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState(fallback)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box && box.height > 0) setHeight(Math.round(box.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return [ref, height] as const
}
