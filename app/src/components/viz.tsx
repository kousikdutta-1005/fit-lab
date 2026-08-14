import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { Tone } from "../lib/calc"

function ordinal(n: number): string {
  const t = n % 100
  if (t >= 11 && t <= 13) return "th"
  return ["th", "st", "nd", "rd"][n % 10] ?? "th"
}

const TONE_COLOR: Record<Tone, string> = {
  low: "var(--amber)",
  ok: "var(--lime)",
  raised: "var(--amber)",
  high: "var(--rose)",
}

/** Numbers that count up read as a readout rather than a printed figure. */
export function Ticker({ value, dp = 1, suffix = "" }: { value: number; dp?: number; suffix?: string }) {
  const [shown, setShown] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setShown(value)
      return
    }
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 750)
      const eased = 1 - (1 - t) ** 3
      setShown(from + (value - from) * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value])

  return (
    <span className="readout">
      {shown.toFixed(dp)}
      {suffix && <span className="readout-suffix">{suffix}</span>}
    </span>
  )
}

/**
 * A value on a scale, drawn as a band rather than a point.
 *
 * The uncertainty is part of the drawing and not a footnote under it: the lit
 * segment spans the plausible range and the marker sits in the middle of it.
 *
 * The caption is where each gauge admits what is wrong with itself, and it runs
 * to several lines. It is folded rather than dropped, because a page of five
 * gauges each carrying four lines of caveat is a page nobody finishes, and a
 * caveat nobody reaches has been deleted in every sense that matters.
 */
export function Gauge({
  label,
  value,
  low,
  high,
  min,
  max,
  stops,
  tone,
  caption,
  dp = 1,
  suffix,
  percentile,
}: {
  label: string
  value: number
  /** Lower and upper bound of the honest range. */
  low?: number
  high?: number
  min: number
  max: number
  /** Boundaries between zones, drawn as ticks. */
  stops: { at: number; label: string }[]
  tone: Tone
  caption?: string
  dp?: number
  suffix?: string
  /** Where this value sits in the real population. */
  percentile?: { value: number; sentence: string; note?: string | null } | null
}) {
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))
  const color = TONE_COLOR[tone]
  const a = low === undefined ? value : low
  const b = high === undefined ? value : high

  return (
    <div className="card gauge">
      <div className="gauge-top">
        <span className="gauge-label mono">{label}</span>
        <span style={{ color }}>
          <Ticker value={value} dp={dp} suffix={suffix} />
        </span>
      </div>

      <div className="gauge-track">
        <div className="gauge-rail">
          <div
            className="gauge-band"
            style={{
              left: `${pct(a)}%`,
              width: `${Math.max(1.5, pct(b) - pct(a))}%`,
              background: color,
              boxShadow: `0 0 12px ${color}`,
            }}
          />
        </div>

        {stops.map((s) => (
          <div key={s.label} className="gauge-stop" style={{ left: `${pct(s.at)}%` }}>
            <span className="gauge-stop-tick" />
            <span className="gauge-stop-label mono">{s.label}</span>
          </div>
        ))}

        <div
          aria-hidden="true"
          className="gauge-needle"
          style={{ left: `${pct(value)}%`, boxShadow: `0 0 9px ${color}` }}
        />
      </div>

      {percentile && (
        <div className="gauge-pct">
          <span className="gauge-pct-value mono">
            {percentile.value}
            <span className="gauge-pct-ord">{ordinal(percentile.value)}</span>
          </span>
          <span className="gauge-pct-bar" aria-hidden="true">
            <span className="gauge-pct-fill" style={{ width: `${percentile.value}%` }} />
            <span className="gauge-pct-mark" style={{ left: `${percentile.value}%` }} />
          </span>
          <span className="gauge-pct-say">{percentile.sentence}</span>
        </div>
      )}

      {(caption || percentile?.note) && (
        <details className="why">
          <summary className="why-summary tap">Why, and its limits</summary>
          {percentile?.note && <p className="why-body">{percentile.note}</p>}
          {caption && <p className="why-body">{caption}</p>}
        </details>
      )}
    </div>
  )
}

/** A goal against the time it honestly takes. */
export function Timeline({ wanted, honest }: { wanted: number; honest: number }) {
  const max = Math.max(wanted, honest)
  const pct = (v: number) => (v / max) * 100
  const over = honest > wanted

  return (
    <div className="timeline">
      {[
        { label: "You asked for", weeks: wanted, color: over ? "var(--rose)" : "var(--lime)" },
        { label: "It actually takes", weeks: honest, color: "var(--cyan)" },
      ].map((row) => (
        <div key={row.label}>
          <div className="timeline-top">
            <span className="timeline-label">{row.label}</span>
            <span className="mono" style={{ fontSize: "0.84rem", color: row.color }}>
              {row.weeks} weeks
            </span>
          </div>
          <div className="timeline-rail">
            <div
              className="timeline-fill"
              style={{
                width: `${pct(row.weeks)}%`,
                background: row.color,
                boxShadow: `0 0 12px ${row.color}`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A single figure with its name, for the strip under the verdict. */
export function ValueChip({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="vchip">
      <span className="vchip-label mono">{label}</span>
      <span className="vchip-value mono" style={tone ? { color: TONE_COLOR[tone] } : undefined}>
        {value}
      </span>
    </div>
  )
}

/** The verdict, which is the one thing that should be readable at a glance. */
export function VerdictCard({
  label,
  title,
  tone,
  children,
}: {
  label: string
  title: string
  tone: "good" | "warn" | "stop"
  children?: ReactNode
}) {
  const color = tone === "stop" ? "var(--rose)" : tone === "warn" ? "var(--amber)" : "var(--lime)"
  return (
    <div className="card verdict" style={{ borderLeft: `3px solid ${color}` }}>
      <p className="verdict-label mono" style={{ color }}>
        {label}
      </p>
      <p className="verdict-title">{title}</p>
      {children}
    </div>
  )
}
