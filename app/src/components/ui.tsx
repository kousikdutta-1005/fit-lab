import type { ReactNode } from "react"

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="kicker">{children}</p>
}

/**
 * Every outbound technique-guide/source link goes through this so the
 * safe-external-link attributes and the accessible name are never missed on
 * a one-off basis. `label` should name the destination and provider, e.g.
 * "Bird Dog — ACE, opens in a new tab".
 */
export function ExternalLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: ReactNode
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" aria-label={label} className="ext-link">
      {children}
    </a>
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
  const color = tone === "stop" ? "var(--rose)" : tone === "warn" ? "var(--amber)" : "var(--cyan)"
  return (
    <div className="card" style={{ padding: "0.95rem 1.05rem", borderLeft: `3px solid ${color}` }}>
      <p style={{ margin: 0, fontWeight: 600, color }}>{title}</p>
      <div style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.6, fontSize: "0.94rem" }}>
        {children}
      </div>
    </div>
  )
}

/**
 * Progressive disclosure. The honest answer is long, and a phone should not
 * demand nine screens of scrolling before the reader knows what they were
 * told. Nothing is deleted to achieve that; it is folded, and one tap away.
 *
 * Uses a native details element so it works without JavaScript, is keyboard
 * operable for free, and is announced correctly by screen readers.
 */
export function Disclosure({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details className="card disclosure" open={defaultOpen}>
      <summary className="disclosure-summary tap">
        <span>
          <span className="disclosure-title">{title}</span>
          {hint && <span className="disclosure-hint">{hint}</span>}
        </span>
        <span aria-hidden="true" className="disclosure-mark mono">
          OPEN
        </span>
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  )
}
