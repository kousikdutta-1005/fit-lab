import type { ReactNode } from "react"

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="kicker">{children}</p>
}

export function Choice({
  on,
  onClick,
  title,
  note,
}: {
  on: boolean
  onClick: () => void
  title: string
  note?: string
}) {
  return (
    <button type="button" className="choice" aria-pressed={on} onClick={onClick}>
      <span
        aria-hidden="true"
        style={{
          marginTop: 3,
          width: 16,
          height: 16,
          flex: "0 0 auto",
          borderRadius: 999,
          border: `1px solid ${on ? "var(--accent)" : "var(--rule)"}`,
          background: on ? "var(--accent)" : "transparent",
          boxShadow: on ? "inset 0 0 0 3px var(--card)" : undefined,
        }}
      />
      <span>
        <span style={{ display: "block", fontWeight: 500 }}>{title}</span>
        {note && (
          <span style={{ display: "block", color: "var(--muted)", fontSize: "0.9rem", marginTop: 2 }}>
            {note}
          </span>
        )}
      </span>
    </button>
  )
}

export function Number_({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string
  hint?: string
  value: number | ""
  onChange: (v: number | "") => void
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontWeight: 500, marginBottom: 2 }}>{label}</span>
      {hint && (
        <span style={{ display: "block", color: "var(--muted)", fontSize: "0.88rem", marginBottom: 6 }}>
          {hint}
        </span>
      )}
      <span style={{ position: "relative", display: "block" }}>
        <input
          className="field"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ paddingRight: suffix ? "3rem" : undefined }}
        />
        {suffix && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "0.85rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            {suffix}
          </span>
        )}
      </span>
    </label>
  )
}

export function YesNo({
  question,
  value,
  onChange,
}: {
  question: string
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "0.9rem 0",
        borderBottom: "1px solid var(--rule)",
        flexWrap: "wrap",
      }}
    >
      <span style={{ flex: "1 1 16rem", minWidth: 0 }}>{question}</span>
      <span style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
        {[
          { l: "No", v: false },
          { l: "Yes", v: true },
        ].map((o) => (
          <button
            key={o.l}
            type="button"
            onClick={() => onChange(o.v)}
            aria-pressed={value === o.v}
            style={{
              minHeight: 40,
              minWidth: 62,
              borderRadius: 999,
              cursor: "pointer",
              font: "inherit",
              fontWeight: 500,
              border: `1px solid ${value === o.v ? "var(--accent)" : "var(--rule)"}`,
              background:
                value === o.v ? "color-mix(in srgb, var(--accent) 12%, var(--card))" : "var(--card)",
              color: "var(--ink)",
            }}
          >
            {o.l}
          </button>
        ))}
      </span>
    </div>
  )
}

export function Stat({
  label,
  value,
  band,
  note,
}: {
  label: string
  value: string
  band?: { label: string; tone: "low" | "ok" | "raised" | "high" }
  note?: string
}) {
  const color =
    band?.tone === "high" || band?.tone === "low"
      ? "var(--stop)"
      : band?.tone === "raised"
        ? "var(--accent)"
        : "var(--good)"
  return (
    <div style={{ padding: "1rem 0", borderBottom: "1px solid var(--rule)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline" }}>
        <span style={{ color: "var(--muted)", fontSize: "0.92rem" }}>{label}</span>
        <span className="tnum" style={{ fontWeight: 600, fontSize: "1.05rem" }}>
          {value}
        </span>
      </div>
      {band && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 7 }}>
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: color, flex: "0 0 auto" }} />
          <span style={{ color, fontWeight: 500, fontSize: "0.9rem" }}>{band.label}</span>
        </div>
      )}
      {note && (
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.55 }}>{note}</p>
      )}
    </div>
  )
}

export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: "note" | "warn" | "stop"
  title: string
  children: ReactNode
}) {
  const color = tone === "stop" ? "var(--stop)" : tone === "warn" ? "var(--accent)" : "var(--muted)"
  return (
    <div
      className="card"
      style={{
        padding: "1.05rem 1.15rem",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, color }}>{title}</p>
      <div style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

export function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={step}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${step} of ${total}`}
      style={{ display: "flex", gap: 5 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            height: 3,
            flex: 1,
            borderRadius: 999,
            background: i < step ? "var(--accent)" : "var(--rule)",
          }}
        />
      ))}
    </div>
  )
}
