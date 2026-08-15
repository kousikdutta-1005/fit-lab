import type { ReactNode } from "react"
import { NodeProgress } from "./controls"
import type { GlyphName } from "./controls"
import { useMeasuredHeight } from "./use-measure"
import { ThemeToggle } from "./ThemeToggle"

/**
 * One data moment, composed as a scene.
 *
 * The shape is the same every time and it is not a document: a thin header
 * carrying the three nodes, a scene that takes whatever height is left, and a
 * tray of controls pinned within thumb reach at the bottom. On a wider screen
 * the same two pieces sit side by side.
 *
 * The scene is given its measured height rather than a guessed one, because
 * the 3D canvas needs a pixel number and the correct number is "what is left
 * on this phone", which only the layout knows.
 */
export function Stage({
  nodes,
  current,
  scene,
  children,
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continue",
  waiting,
}: {
  nodes: { id: string; label: string; glyph: GlyphName; done: boolean }[]
  current: string
  /** Given the pixel height available to it. Omitted for a checklist screen. */
  scene?: (height: number) => ReactNode
  children: ReactNode
  onBack: () => void
  onNext: () => void
  nextDisabled: boolean
  nextLabel?: string
  /** What is still missing, said in as few words as it can be said. */
  waiting?: string | null
}) {
  const [sceneRef, sceneHeight] = useMeasuredHeight<HTMLDivElement>(320)

  return (
    <div className={scene ? "stage" : "stage stage-list"}>
      <header className="stage-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <NodeProgress nodes={nodes} current={current} />
        <ThemeToggle />
      </header>

      <div className="stage-main">
        {scene && (
          <div className="stage-scene scanline" ref={sceneRef}>
            {scene(sceneHeight)}
          </div>
        )}

        <div className="stage-tray">
          <div className="tray-scroll">{children}</div>
          <div className="tray-nav">
            {/* Named for assistive tech, because "Back" is also a muscle and
                two buttons called Back on one screen is a real ambiguity. */}
            <button type="button" className="btn btn-quiet tap" onClick={onBack} aria-label="Go back">
              Back
            </button>
            <button type="button" className="btn tap" onClick={onNext} disabled={nextDisabled}>
              {nextLabel}
            </button>
          </div>
          {waiting && (
            <p className="tray-waiting mono" role="status">
              {waiting}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
