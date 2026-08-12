import { useEffect, useRef, useState } from "react"
import type { Tone } from "../lib/calc"

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
      {suffix && <span style={{ fontSize: "0.5em", color: "var(--muted)", marginLeft: 3 }}>{suffix}</span>}
    </span>
  )
}

/**
 * A value on a scale, drawn as a band rather than a point.
 *
 * The uncertainty is part of the drawing, not a footnote under it: the lit
 * segment spans the plausible range and the marker sits in the middle of it.
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
}) {
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))
  const color = TONE_COLOR[tone]
  const a = low === undefined ? value : low
  const b = high === undefined ? value : high

  return (
    <div className="card" style={{ padding: "1.15rem 1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
        <span className="mono" style={{ fontSize: "0.72rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)" }}>
          {label}
        </span>
        <span style={{ color }}>
          <Ticker value={value} dp={dp} suffix={suffix} />
        </span>
      </div>

      <div style={{ position: "relative", marginTop: "1rem", height: 30 }}>
        <div
          style={{
            position: "absolute",
            top: 11,
            left: 0,
            right: 0,
            height: 5,
            borderRadius: 999,
            background: "rgba(255,255,255,0.07)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: `${pct(a)}%`,
              width: `${Math.max(1.5, pct(b) - pct(a))}%`,
              top: 0,
              bottom: 0,
              background: `linear-gradient(90deg, ${color}, ${color})`,
              boxShadow: `0 0 14px ${color}`,
              borderRadius: 999,
            }}
          />
        </div>

        {stops.map((s) => (
          <div
            key={s.label}
            style={{ position: "absolute", left: `${pct(s.at)}%`, top: 0, transform: "translateX(-50%)" }}
          >
            <div style={{ width: 1, height: 11, background: "rgba(255,255,255,0.22)", margin: "0 auto" }} />
            <div
              className="mono"
              style={{ fontSize: "0.6rem", color: "var(--faint)", marginTop: 3, whiteSpace: "nowrap" }}
            >
              {s.label}
            </div>
          </div>
        ))}

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${pct(value)}%`,
            top: 7,
            transform: "translateX(-50%)",
            width: 3,
            height: 13,
            borderRadius: 2,
            background: "#fff",
            boxShadow: `0 0 10px ${color}`,
          }}
        />
      </div>

      {caption && (
        <p style={{ margin: "1rem 0 0", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.55 }}>{caption}</p>
      )}
    </div>
  )
}

/** Big Five as a radar, because five numbers compare better than five bars. */
export function Radar({
  points,
  size = 260,
}: {
  points: { label: string; value: number; highlight?: boolean }[]
  size?: number
}) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.34
  const n = points.length

  const at = (i: number, radius: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const
  }

  const shape = points
    .map((p, i) => {
      const [x, y] = at(i, (Math.max(1, Math.min(7, p.value)) / 7) * r)
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <svg width={size} height={size} role="img" aria-label="Your five trait scores, drawn as a shape">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={points.map((_, i) => at(i, r * f).join(",")).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      {points.map((_, i) => {
        const [x, y] = at(i, r)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
      })}

      <path d={`${shape} Z`} fill="rgba(75,227,208,0.16)" stroke="#4be3d0" strokeWidth={1.6} />

      {points.map((p, i) => {
        const [px, py] = at(i, (Math.max(1, Math.min(7, p.value)) / 7) * r)
        const [lx, ly] = at(i, r + 20)
        return (
          <g key={p.label}>
            <circle cx={px} cy={py} r={p.highlight ? 4 : 2.6} fill={p.highlight ? "#ffb545" : "#4be3d0"} />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={p.highlight ? "#ffb545" : "var(--muted)"}
              style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            >
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** A goal against the time it honestly takes. */
export function Timeline({ wanted, honest }: { wanted: number; honest: number }) {
  const max = Math.max(wanted, honest)
  const pct = (v: number) => (v / max) * 100
  const over = honest > wanted

  return (
    <div style={{ display: "grid", gap: "0.85rem", marginTop: "1.2rem" }}>
      {[
        { label: "What you asked for", weeks: wanted, color: over ? "var(--rose)" : "var(--lime)" },
        { label: "What it actually takes", weeks: honest, color: "var(--cyan)" },
      ].map((row) => (
        <div key={row.label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: "0.86rem", color: "var(--muted)" }}>{row.label}</span>
            <span className="mono" style={{ fontSize: "0.86rem", color: row.color }}>
              {row.weeks} weeks
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div
              style={{
                width: `${pct(row.weeks)}%`,
                height: "100%",
                borderRadius: 999,
                background: row.color,
                boxShadow: `0 0 14px ${row.color}`,
                transition: "width 0.9s cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
