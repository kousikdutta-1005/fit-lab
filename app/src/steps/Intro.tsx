import { BodyView } from "../components/BodyView"
import { DEFAULT_MUSCLE, defaultShoulderRatio, figureLabel } from "../lib/figure"
import { useMeasuredHeight } from "../components/use-measure"
import { ThemeToggle } from "../components/ThemeToggle"

/**
 * The launch screen.
 *
 * It is a scan, a sentence and a button. The argument this product is built on
 * is long and it is all still in the README and on the result page; what it is
 * not is the first thing a person on a phone should have to read before they
 * are allowed to do anything.
 */
export function Intro({ onStart }: { onStart: () => void }) {
  const [ref, height] = useMeasuredHeight<HTMLDivElement>(360)

  const demo = {
    sex: "male" as const,
    heightCm: 175,
    weightKg: 78,
    waistCm: 88,
    neckCm: 38,
    hipCm: 0,
    shoulderRatio: defaultShoulderRatio("male"),
    muscle: DEFAULT_MUSCLE,
    bodyFat: 20,
  }

  return (
    <div className="stage stage-intro">
      <header className="stage-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p className="kicker">fit-lab</p>
        <ThemeToggle />
      </header>

      <div className="stage-main">
        <div className="stage-scene scanline" ref={ref}>
          <BodyView build={demo} height={height} label={figureLabel(null)} />
        </div>

        <div className="stage-tray">
          <div className="tray-scroll">
            <h1 className="intro-line">
              A body built from your <em>measurements</em>, and an honest read on where you stand.
            </h1>
            <p className="intro-sub mono">No account. Nothing leaves this device.</p>
          </div>
          <div className="tray-nav">
            <button type="button" className="btn tap" onClick={onStart} style={{ flex: "1 1 auto" }}>
              Start the scan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
