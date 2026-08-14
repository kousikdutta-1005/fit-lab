import { useCallback, useId, useRef } from "react"
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react"

/**
 * The control kit.
 *
 * The old flow was a document: labelled fields stacked down a page, one
 * question per row, read top to bottom. This is the replacement, and the rule
 * behind all of it is that a control should be a thing you operate rather than
 * a thing you read. A tape you drag. A tile you press. A card you tick.
 *
 * Accessibility is not traded away for that. Every control here is a real
 * button or a real ARIA slider, keyboard operable, labelled, and at least 44px
 * in the direction a thumb comes from.
 */

/* ------------------------------------------------------------------ glyphs */

export type GlyphName =
  | "body"
  | "shield"
  | "target"
  | "flame"
  | "dumbbell"
  | "bolt"
  | "leaf"
  | "home"
  | "band"
  | "gym"
  | "heart"
  | "pulse"
  | "spiral"
  | "clipboard"
  | "joint"
  | "pregnant"
  | "ruler"
  | "scale"
  | "person"
  | "plate"
  | "info"
  | "check"

const GLYPHS: Record<GlyphName, ReactNode> = {
  body: (
    <>
      <circle cx="12" cy="4.6" r="2.4" />
      <path d="M12 7.2v7.4M7.6 10.4h8.8M9.4 21.4L12 14.6l2.6 6.8" />
    </>
  ),
  shield: <path d="M12 2.6l7 2.8v6c0 4.9-3 7.9-7 10.2-4-2.3-7-5.3-7-10.2v-6z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="12" cy="12" r="0.6" />
    </>
  ),
  flame: <path d="M12 2.4c3 3.8 5 6 5 8.9a5 5 0 11-10 0c0-1.9 1-3.2 2.6-4.7C11.2 5.2 12 4 12 2.4z" />,
  dumbbell: <path d="M3.5 9.5v5M6.8 7v10M17.2 7v10M20.5 9.5v5M6.8 12h10.4" />,
  bolt: <path d="M13.4 2.4L5.6 13.2h5.4l-1.4 8.4 7.8-10.8h-5.4z" />,
  leaf: (
    <>
      <path d="M20.4 3.6C10.6 3.6 4.4 8 4.4 15a5.6 5.6 0 001.2 3.6" />
      <path d="M5.6 20.4C6.4 12.8 12 7.6 20.4 3.6" />
    </>
  ),
  home: <path d="M4 11l8-7 8 7v9.2h-5.6v-6h-4.8v6H4z" />,
  band: (
    <>
      <ellipse cx="12" cy="12" rx="8.4" ry="4.6" />
      <path d="M6.6 8.6v6.8M17.4 8.6v6.8" />
    </>
  ),
  gym: (
    <>
      <path d="M3.5 9v6M20.5 9v6M6.8 6.6v10.8M17.2 6.6v10.8M6.8 12h10.4" />
    </>
  ),
  heart: <path d="M12 20.4S4.8 15.8 4.8 10.6A4.1 4.1 0 0112 7.2a4.1 4.1 0 017.2 3.4c0 5.2-7.2 9.8-7.2 9.8z" />,
  pulse: <path d="M2.6 12.4h4.2l2.2-6.6 4 13.2 2.2-6.6h6.2" />,
  spiral: <path d="M12 12a2.8 2.8 0 112.8-2.8 5.8 5.8 0 11-5.8 5.8 8.8 8.8 0 118.8-8.8" />,
  clipboard: (
    <>
      <path d="M9.2 4.2h5.6v2.8H9.2z" />
      <path d="M7.6 5.6H5.4v15.2h13.2V5.6h-2.2" />
    </>
  ),
  joint: (
    <>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M4.6 19.4l5-5M14.4 9.6l5-5" />
    </>
  ),
  pregnant: (
    <>
      <circle cx="11.6" cy="4.4" r="2.2" />
      <path d="M11 7.4c-1.9 0-3 1.6-3 3.6 0 2.6 1.8 3.8 3.8 3.8s3.4-1.2 3.4-3-1.4-2.8-3.2-2.8" />
      <path d="M9.4 21.2l.8-6M14.4 21.2l-1-6" />
    </>
  ),
  ruler: <path d="M2.8 8.4h18.4v7.2H2.8zM7 8.4v3.4M11 8.4v4.4M15 8.4v3.4M19 8.4v4.4" />,
  scale: <path d="M4.6 20.4h14.8M6.8 20.4l1.8-9h6.8l1.8 9M12 11.4V7M9.4 4.8h5.2" />,
  person: (
    <>
      <circle cx="12" cy="5" r="2.6" />
      <path d="M6.6 20.6c0-3.4 2.4-6 5.4-6s5.4 2.6 5.4 6" />
    </>
  ),
  plate: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 3.8v5M12 15.2v5M3.8 12h5M15.2 12h5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 11.2v5.2M12 7.6v.9" />
    </>
  ),
  check: <path d="M4.4 12.6l4.8 4.8 10.4-10.8" />,
}

export function Glyph({ name, size = 22 }: { name: GlyphName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "0 0 auto", display: "block" }}
    >
      {GLYPHS[name]}
    </svg>
  )
}

/* -------------------------------------------------------------------- tape */

const VISIBLE_STEPS = 34

/**
 * A tape measure you drag, with the reading held under a fixed needle.
 *
 * A range input works, but it reads as a form field and it hides the units:
 * you learn where you are on a track, not what number you are on. A tape shows
 * the neighbouring values, which is what a tape does, and it is the right
 * motif for a product whose whole claim is that the figure answers the tape.
 *
 * It is an ARIA slider underneath, so arrows, Home, End, Page Up and Page Down
 * all work and a screen reader announces the value with its unit.
 */
export function Tape({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const strip = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; value: number } | null>(null)

  const snap = useCallback(
    (v: number) => {
      const stepped = Math.round((v - min) / step) * step + min
      return Math.min(max, Math.max(min, Number(stepped.toFixed(4))))
    },
    [max, min, step],
  )

  const nudge = (by: number) => onChange(snap(value + by * step))

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, value }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    const el = strip.current
    if (!start || !el) return
    const width = el.getBoundingClientRect().width || 1
    const unitsPerPx = (VISIBLE_STEPS * step) / width
    const next = snap(start.value + (start.x - e.clientX) * unitsPerPx)
    if (next !== value) onChange(next)
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    drag.current = null
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, number> = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -10,
      PageUp: 10,
    }
    if (e.key in keys) {
      e.preventDefault()
      nudge(keys[e.key])
      return
    }
    if (e.key === "Home") {
      e.preventDefault()
      onChange(min)
    }
    if (e.key === "End") {
      e.preventDefault()
      onChange(max)
    }
  }

  // Ticks are positioned as a percentage of the strip, so nothing has to be
  // measured to draw them: the strip always shows VISIBLE_STEPS steps.
  const span = VISIBLE_STEPS * step
  const first = Math.max(min, snap(value - span / 2))
  const last = Math.min(max, snap(value + span / 2))
  const ticks: number[] = []
  for (let v = first; v <= last + 1e-6; v += step) ticks.push(Number(v.toFixed(4)))
  const majorEvery = step === 1 ? 5 : 5
  const shown = format ? format(value) : String(value)

  return (
    <div className="tape">
      <div className="tape-top">
        <span className="tape-label mono">{label}</span>
        <span className="tape-read">
          <span className="readout">{shown}</span>
          {unit && <span className="tape-unit mono">{unit}</span>}
        </span>
      </div>

      <div className="tape-row">
        <button
          type="button"
          className="tape-step tap"
          onClick={() => nudge(-1)}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>

        <div
          ref={strip}
          className="tape-strip"
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={unit ? `${shown} ${unit}` : shown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          {ticks.map((v) => {
            const index = Math.round((v - min) / step)
            const major = index % majorEvery === 0
            const left = 50 + ((v - value) / span) * 100
            return (
              <span key={v} className={major ? "tick tick-major" : "tick"} style={{ left: `${left}%` }}>
                {major && <span className="tick-label mono">{format ? format(v) : v}</span>}
              </span>
            )
          })}
          <span className="tape-needle" aria-hidden="true" />
        </div>

        <button
          type="button"
          className="tape-step tap"
          onClick={() => nudge(1)}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- tiles */

export type TileOption<T extends string> = {
  id: T
  label: string
  note?: string
  glyph?: GlyphName
}

/** One choice from a small set, as pressable tiles rather than a radio list. */
export function Tiles<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 2,
  compact = false,
}: {
  label: string
  options: TileOption<T>[]
  value: T | null
  onChange: (v: T) => void
  columns?: number
  compact?: boolean
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div role="group" aria-label={label} className="tiles" style={{ "--cols": columns } as CSSProperties}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={compact ? "tile tile-compact" : "tile"}
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.glyph && <Glyph name={o.glyph} size={compact ? 18 : 22} />}
            <span className="tile-text">
              <span className="tile-label">{o.label}</span>
              {o.note && <span className="tile-note">{o.note}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- cards */

/** A tick-anything-that-applies card. Pressed means yes, and nothing else. */
export function TapCard({
  on,
  onToggle,
  title,
  detail,
  glyph,
  tone = "warn",
}: {
  on: boolean
  onToggle: () => void
  title: string
  detail?: string
  glyph?: GlyphName
  tone?: "warn" | "clear"
}) {
  return (
    <button type="button" className={`tapcard tapcard-${tone}`} aria-pressed={on} onClick={onToggle}>
      <span className="tapbox" aria-hidden="true">
        {on ? <Glyph name="check" size={15} /> : glyph ? <Glyph name={glyph} size={16} /> : null}
      </span>
      <span className="tapcard-text">
        <span className="tapcard-title">{title}</span>
        {detail && <span className="tapcard-detail">{detail}</span>}
      </span>
    </button>
  )
}

/* -------------------------------------------------------------------- chip */

/** A reading in the rail: what it is, what it says, and whether it is set. */
export function Chip({
  label,
  value,
  active,
  onClick,
  glyph,
}: {
  label: string
  value: string
  active: boolean
  onClick: () => void
  glyph?: GlyphName
}) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={active}
      aria-label={`${label}, ${value === "—" ? "not set" : value}`}
      onClick={onClick}
    >
      {glyph && <Glyph name={glyph} size={15} />}
      <span className="chip-text">
        <span className="chip-label mono">{label}</span>
        <span className={value === "—" ? "chip-value chip-unset mono" : "chip-value mono"}>{value}</span>
      </span>
    </button>
  )
}

/* ---------------------------------------------------------------- progress */

/** Three nodes, because there are three data moments. No step counter. */
export function NodeProgress({
  nodes,
  current,
}: {
  nodes: { id: string; label: string; glyph: GlyphName; done: boolean }[]
  current: string
}) {
  const index = nodes.findIndex((n) => n.id === current)
  return (
    <ol
      className="nodes"
      aria-label={`${nodes[index]?.label ?? ""}, part ${index + 1} of ${nodes.length}`}
    >
      {nodes.map((n, i) => {
        const state = n.id === current ? "now" : n.done ? "done" : "todo"
        return (
          <li key={n.id} className={`node node-${state}`}>
            <span className="node-dot" aria-hidden="true">
              <Glyph name={n.done && n.id !== current ? "check" : n.glyph} size={15} />
            </span>
            <span className="node-label">{n.label}</span>
            {i < nodes.length - 1 && <span className="node-line" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}

/* -------------------------------------------------------------------- help */

/** Guidance stays folded away until somebody asks for it. */
export function Help({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <details className="help" id={id}>
      <summary className="help-summary tap">
        <Glyph name="info" size={15} />
        <span>{title}</span>
      </summary>
      <div className="help-body">{children}</div>
    </details>
  )
}
