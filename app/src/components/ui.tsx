import type { ReactNode } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card } from "@/components/ui/card"

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
    <Card className="card" style={{ padding: "0.95rem 1.05rem", borderLeft: `3px solid ${color}` }}>
      <p style={{ margin: 0, fontWeight: 600, color }}>{title}</p>
      <div style={{ marginTop: 6, color: "var(--ink-muted)", lineHeight: 1.6, fontSize: "0.94rem" }}>
        {children}
      </div>
    </Card>
  )
}

/**
 * Progressive disclosure. The honest answer is long, and a phone should not
 * demand nine screens of scrolling before the reader knows what they were
 * told. Nothing is deleted to achieve that; it is folded, and one tap away.
 *
 * Built on shadcn's (Radix) Accordion primitive for correct keyboard
 * operability and screen-reader state announcements — same external API as
 * before (title/hint/defaultOpen/children), so no caller needed to change.
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
    <Accordion type="single" collapsible defaultValue={defaultOpen ? "item" : undefined} className="disclosure-accordion">
      <AccordionItem value="item" className="card disclosure">
        <AccordionTrigger className="disclosure-summary tap">
          <span>
            <span className="disclosure-title">{title}</span>
            {hint && <span className="disclosure-hint">{hint}</span>}
          </span>
        </AccordionTrigger>
        <AccordionContent className="disclosure-body">{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
