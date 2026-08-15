import { useState } from "react"
import { Callout, Disclosure, ExternalLink, Kicker } from "../components/ui"
import { SourcesPanel } from "../components/SourcesPanel"
import { BodyView } from "../components/BodyView"
import { MuscleView } from "../components/MuscleView"
import { Glyph, Tiles } from "../components/controls"
import { ThemeToggle } from "../components/ThemeToggle"
import { DEFAULT_MUSCLE, defaultShoulderRatio, figureLabel } from "../lib/figure"
import { Gauge, Timeline, ValueChip, VerdictCard } from "../components/viz"
import { PERCENTILE_SOURCE, context, percentileOf } from "../lib/percentiles"
import type { Ancestry, Profile } from "../lib/calc"
import {
  bmi,
  bmiBand,
  bodyFatRange,
  ffmi,
  ffmiCeiling,
  leanMassKg,
  navyBodyFat,
  round,
  thresholds,
  waistRaised,
  whtr,
  whtrBand,
} from "../lib/calc"
import type { Intent } from "../lib/goals"
import { assess } from "../lib/goals"
import type { HealthAnswers } from "../lib/screening"
import { notesDefaultOpen, screen } from "../lib/screening"
import type { Place } from "../data/exercises"
import { exerciseById } from "../data/exercises"
import { capacityById } from "../data/capacities"
import type { Emphasis } from "../data/capacities"
import { EMPHASES } from "../data/capacities"
import type { FoundationSlot, SafetyContext } from "../lib/foundation"
import { buildFoundation } from "../lib/foundation"
import type { Dose } from "../lib/dose"
import { applyWeeklyVolumeCap, doseForSlot, weeklySummary } from "../lib/dose"
import type { WeeklySchedule } from "../lib/schedule"
import { buildWeeklySchedule, clampChosenDays, weeklyDayBounds } from "../lib/schedule"
import { HOME_CEILINGS, HOME_KIT } from "../data/kit"
import { GUIDES, SOURCES, guideById } from "../data/evidence"

/**
 * The read.
 *
 * The order is the argument: the verdict, then the safety line, then the
 * figures as gauges, then the body as evidence, then what to actually do. Every
 * factual claim and every caveat that was on this page before is still on it.
 * What changed is that the long ones are folded into disclosures instead of
 * being stacked in front of the thing the reader came for.
 *
 * Nothing was invented and nothing necessary was cut. Where a number is rough,
 * the gauge still says so, one tap away, next to the number rather than in a
 * paragraph four screens down.
 */

const VERDICT_LABEL: Record<string, string> = {
  impossible: "Not achievable as stated",
  "too-fast": "Achievable, but not this fast",
  realistic: "Achievable",
  "too-slow": "Achievable, and aiming below yourself",
  "under-powered": "The plan will not deliver the goal",
}

const ANCESTRIES: { id: Ancestry; label: string }[] = [
  { id: "south-asian", label: "South Asian" },
  { id: "east-asian", label: "East or South-East Asian" },
  { id: "other", label: "Something else" },
  { id: "unsaid", label: "Rather not say" },
]

/** Print with every disclosure opened, or the page prints as headlines only. */
function printAll() {
  for (const d of Array.from(document.querySelectorAll("details"))) d.open = true
  window.print()
}

export function Result({
  profile,
  health,
  intent,
  place,
  ancestry,
  onAncestry,
  onRestart,
}: {
  profile: Profile
  health: HealthAnswers
  intent: Intent
  place: Place
  ancestry: Ancestry
  /** Optional, after the fact, and it really does move the thresholds. */
  onAncestry: (a: Ancestry) => void
  onRestart: () => void
}) {
  const scr = screen(profile, health)
  const [emphasis, setEmphasis] = useState<Emphasis>("general")
  const [chosenDaysOverride, setChosenDaysOverride] = useState<number | null>(null)

  if (scr.kind === "stop") {
    return (
      <div className="read">
        <header className="read-head">
          <Kicker>Where this stops</Kicker>
        </header>
        <VerdictCard label="Stop" title={scr.title} tone="stop" />
        <p className="read-lede">{scr.body}</p>
        <div className="card stop-list">
          <ul>
            {scr.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <p className="read-note">
          None of this means you cannot train. It means the first step is a person who can examine you, not a
          form on a website. Come back after that and this will still be here.
        </p>
        <div className="read-actions">
          <button type="button" className="btn btn-quiet tap" onClick={onRestart}>
            Start again
          </button>
        </div>
      </div>
    )
  }

  const t = thresholds(profile.sex, profile.ancestry)
  const value = bmi(profile.weightKg, profile.heightCm)
  const bBand = bmiBand(value, t)
  const ratio = whtr(profile.waistCm, profile.heightCm)
  const wBand = whtrBand(ratio)
  const bf = bodyFatRange(profile)
  const bfMid = navyBodyFat(profile)
  const lean = bfMid === null ? null : leanMassKg(profile.weightKg, bfMid)
  const index = lean === null ? null : ffmi(lean, profile.heightCm)
  const ceiling = ffmiCeiling(profile.sex)
  const verdict = assess(profile, intent, bfMid ?? 25)

  const ctx: SafetyContext = {
    screenKind: scr.kind,
    conditions: health.conditions,
    jointProblem: health.jointProblem,
    pregnant: health.pregnant,
    age: profile.age,
  }
  const slots: FoundationSlot[] = buildFoundation(place, ctx, emphasis)
  const rawDoses: Dose[] = slots.map((slot) =>
    doseForSlot(slot, intent.kind, intent.trainingAge, { screenKind: scr.kind, age: profile.age }),
  )
  const { doses, regionNotes } = applyWeeklyVolumeCap(slots, rawDoses)
  const summary = weeklySummary(slots, doses)
  const dayBounds = weeklyDayBounds(summary)
  const chosenDays = clampChosenDays(chosenDaysOverride ?? dayBounds.optimal, dayBounds)
  const schedule: WeeklySchedule = buildWeeklySchedule(slots, doses, summary, chosenDays)
  const fullBody = Array.from(
    new Set(
      slots
        .map((s) => capacityById(s.capacity).anatomy)
        .filter((a): a is NonNullable<typeof a> => a !== null),
    ),
  )
  const requiredSlots = slots.filter((s) => !s.optional)
  const optionalSlots = slots.filter((s) => s.optional)

  return (
    <div className="read">
      <header className="read-head">
        <Kicker>Your read</Kicker>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ThemeToggle />
          <button type="button" className="ghost tap" onClick={onRestart}>
            Start again
          </button>
        </div>
      </header>

      <VerdictCard
        label={VERDICT_LABEL[verdict.verdict]}
        title={verdict.headline}
        tone={verdict.verdict === "impossible" ? "stop" : verdict.verdict === "realistic" ? "good" : "warn"}
      >
        {verdict.honestWeeks && intent.weeks !== undefined && (
          <Timeline wanted={intent.weeks} honest={verdict.honestWeeks} />
        )}
        <details className="why">
          <summary className="why-summary tap">The reasoning</summary>
          <p className="why-body">{verdict.detail}</p>
        </details>
      </VerdictCard>

      <div className="chipstrip">
        <ValueChip label="BMI" value={String(round(value))} tone={bBand.tone} />
        <ValueChip label="Waist ÷ height" value={round(ratio, 2).toFixed(2)} tone={wBand.tone} />
        {bf && <ValueChip label="Body fat" value={`${round(bf.low, 0)}–${round(bf.high, 0)}%`} />}
      </div>

      {/* Safety first, always, per the design principles. A caution is never
          folded away; only its longer notes are. */}
      <section className="read-section">
        {scr.kind === "caution" ? (
          // A caution is a warning, so it is never folded.
          <Callout tone="warn" title={scr.title}>
            <p style={{ margin: 0 }}>{scr.body}</p>
          </Callout>
        ) : (
          // A clear screen is fully said by its own title. The paragraph
          // explaining why the guidance changed in 2015 is worth keeping and
          // is not worth the top of the page.
          <Disclosure title={scr.title}>
            <p className="why-body">{scr.body}</p>
          </Disclosure>
        )}
        {scr.notes.length > 0 && (
          <div className="notes">
            {scr.notes.map((n) => (
              <Disclosure
                key={n.title}
                title={n.title}
                hint="What to do about it"
                defaultOpen={notesDefaultOpen(scr.kind)}
              >
                <p className="why-body">{n.body}</p>
              </Disclosure>
            ))}
          </div>
        )}
      </section>

      <section className="read-section">
        <div className="card evidence scanline">
          <BodyView
            build={{
              sex: profile.sex,
              heightCm: profile.heightCm,
              weightKg: profile.weightKg,
              waistCm: profile.waistCm,
              neckCm: profile.neckCm,
              hipCm: profile.sex === "female" ? profile.hipCm : 0,
              shoulderRatio: defaultShoulderRatio(profile.sex),
              muscle: DEFAULT_MUSCLE,
              bodyFat: bfMid ?? 22,
            }}
            height={330}
            label={figureLabel({
              heightCm: profile.heightCm,
              weightKg: profile.weightKg,
              waistCm: profile.waistCm,
              hipCm: profile.sex === "female" ? profile.hipCm : undefined,
            })}
          />
          <p className="scene-strip mono">
            {`${profile.heightCm}cm · ${profile.weightKg}kg · waist ${profile.waistCm} · neck ${profile.neckCm}${profile.sex === "female" ? ` · hip ${profile.hipCm}` : ""}`}
          </p>
        </div>
      </section>

      <section className="read-section">
        <div className="section-head">
          <Glyph name="target" size={16} />
          <h2 className="section-title">Where you stand</h2>
        </div>
        <div className="gauges">
          <Gauge
            label="BMI"
            value={round(value)}
            min={15}
            max={40}
            stops={[
              { at: 18.5, label: "18.5" },
              { at: t.overweight, label: String(t.overweight) },
              { at: t.obese, label: String(t.obese) },
            ]}
            tone={bBand.tone}
            percentile={(() => {
              const p = percentileOf("bmi", value, profile.sex, profile.age)
              return p ? { ...p, note: context("bmi", p.value) } : null
            })()}
            caption={bBand.note}
          />
          <Gauge
            label="Waist to height"
            value={round(ratio, 2)}
            dp={2}
            min={0.3}
            max={0.75}
            stops={[
              { at: 0.4, label: "0.4" },
              { at: 0.5, label: "0.5" },
              { at: 0.6, label: "0.6" },
            ]}
            tone={wBand.tone}
            percentile={(() => {
              const p = percentileOf("whtr", ratio, profile.sex, profile.age)
              return p ? { ...p, note: context("whtr", p.value) } : null
            })()}
            caption={wBand.note}
          />
          <Gauge
            label="Waist"
            value={round(profile.waistCm)}
            dp={0}
            suffix="cm"
            min={55}
            max={140}
            stops={[{ at: t.waist, label: `${t.waist}` }]}
            tone={waistRaised(profile.waistCm, t) ? "raised" : "ok"}
            percentile={(() => {
              const p = percentileOf("waist", profile.waistCm, profile.sex, profile.age)
              return p ? { ...p, note: context("waist", p.value) } : null
            })()}
            caption={`The line that applies to you is ${t.waist}cm. ${t.source}`}
          />
          {bf && (
            <Gauge
              label="Body fat, estimated"
              value={round((bf.low + bf.high) / 2)}
              low={bf.low}
              high={bf.high}
              dp={0}
              suffix="%"
              min={5}
              max={50}
              stops={
                profile.sex === "male"
                  ? [
                      { at: 12, label: "lean" },
                      { at: 20, label: "average" },
                      { at: 26, label: "raised" },
                    ]
                  : [
                      { at: 20, label: "lean" },
                      { at: 30, label: "average" },
                      { at: 36, label: "raised" },
                    ]
              }
              tone="ok"
              caption="The lit band is the honest range, not a margin of politeness. The US Navy tape formula carries roughly four percentage points of error and has never been validated on South Asian bodies. The direction it moves is real. The number is rough."
            />
          )}
          {index !== null && (
            <Gauge
              label="Fat-free mass index"
              value={round(index)}
              min={14}
              max={28}
              stops={[
                { at: 18, label: "18" },
                { at: ceiling, label: `${ceiling} ceiling` },
              ]}
              tone={index > ceiling ? "raised" : "ok"}
              caption={`Natural trainees cluster below about ${ceiling}. That figure rests on 74 athletes measured in 1995, so read it as a signpost and not a wall.`}
            />
          )}
        </div>
      </section>

      {verdict.flags.length > 0 && (
        <section className="read-section notes">
          {verdict.flags.map((f) => (
            <Callout key={f.title} tone={f.severity === "warn" ? "warn" : "note"} title={f.title}>
              <p style={{ margin: 0 }}>{f.body}</p>
            </Callout>
          ))}
        </section>
      )}

      <section className="read-section">
        <div className="section-head">
          <Glyph name="dumbbell" size={16} />
          <h2 className="section-title">Your weekly movement foundation</h2>
        </div>

        <p className="read-note">
          The app chose complete movement coverage automatically — you never pick a muscle. Your environment
          only changes which variant of each pattern is shown. Every card below has a verified technique
          guide and a starting dose; the full evidence behind each is in{" "}
          <a href="#sources-and-methods">Sources &amp; methods</a>.
        </p>

        <div className="card evidence">
          <MuscleView active={fullBody} height={300} />
          <p className="scene-strip mono">Lit: the concrete movement patterns in this week's foundation</p>
        </div>

        <div className="card" style={{ padding: "0.95rem 1.05rem" }}>
          <h3 className="pick-title" style={{ marginTop: 0 }}>
            Weekly summary
          </h3>
          <div className="chipstrip">
            <ValueChip label="Strength sessions/week" value={String(summary.strengthSessionsPerWeek)} />
            <ValueChip label="Weekly resistance sets" value={String(summary.totalWeeklySets)} />
            {summary.aerobicMinutesPerWeek && (
              <ValueChip
                label="Aerobic minutes/week"
                value={`${summary.aerobicMinutesPerWeek[0]}–${summary.aerobicMinutesPerWeek[1]}`}
              />
            )}
          </div>
          <p className="why-body" style={{ marginBottom: 0 }}>
            {summary.notes.join(" ")}
          </p>
          {regionNotes.length > 0 && (
            <p className="why-body" style={{ marginBottom: 0 }}>
              {regionNotes.join(" ")}
            </p>
          )}
        </div>

        <div className="card" style={{ padding: "0.95rem 1.05rem" }}>
          <h3 className="pick-title" style={{ marginTop: 0 }}>
            Your training week
          </h3>
          <p className="read-note" style={{ marginTop: 0 }}>
            {dayBounds.min === dayBounds.max
              ? `${dayBounds.min} day${dayBounds.min === 1 ? "" : "s"} a week delivers this in full — that number is fixed by what's prescribed below, not a choice.`
              : `Anywhere from ${dayBounds.min} to ${dayBounds.max} days a week delivers the same prescription in full; ${dayBounds.optimal} is the evidence-consistent default. Training frequency itself does not reliably change results once the weekly sets and minutes below stay the same — moving the slider only changes how they're spread across the week.`}
          </p>
          <div className="chipstrip" role="group" aria-label="Training days per week">
            <button
              type="button"
              className="btn btn-quiet tap"
              aria-label="Fewer training days per week"
              disabled={chosenDays <= dayBounds.min}
              onClick={() => setChosenDaysOverride(clampChosenDays(chosenDays - 1, dayBounds))}
            >
              −
            </button>
            <ValueChip label="Days/week" value={String(chosenDays)} />
            <button
              type="button"
              className="btn btn-quiet tap"
              aria-label="More training days per week"
              disabled={chosenDays >= dayBounds.max}
              onClick={() => setChosenDaysOverride(clampChosenDays(chosenDays + 1, dayBounds))}
            >
              +
            </button>
            {chosenDays !== dayBounds.optimal && (
              <button
                type="button"
                className="btn btn-quiet tap"
                onClick={() => setChosenDaysOverride(null)}
              >
                Reset to {dayBounds.optimal}
              </button>
            )}
          </div>

          <div className="picks" style={{ marginTop: "0.7rem" }}>
            {schedule.days.map((day) => (
              <div key={day.dayNumber} className="card" style={{ padding: "0.65rem 0.8rem" }}>
                <div className="chipstrip" style={{ marginBottom: day.kind === "rest" ? 0 : "0.3rem" }}>
                  <span className="tapcard-title">Day {day.dayNumber}</span>
                  <ValueChip
                    label="Type"
                    value={
                      day.kind === "rest"
                        ? "Rest"
                        : day.kind === "strength"
                          ? "Full-body strength"
                          : "Aerobic only"
                    }
                  />
                  {day.kind !== "rest" && (
                    <ValueChip label="~min" value={`${day.estimatedMinutes[0]}–${day.estimatedMinutes[1]}`} />
                  )}
                </div>
                {day.kind === "strength" && (
                  <p className="why-body" style={{ marginBottom: 0 }}>
                    {day.exerciseIds.length} exercise{day.exerciseIds.length === 1 ? "" : "s"}
                    {day.aerobicMinutes[1] > 0 ? ` plus ${day.aerobicMinutes[0]}–${day.aerobicMinutes[1]} min aerobic` : ""}:{" "}
                    {day.exerciseIds.map((id) => exerciseById(id)?.name ?? id).join(", ")}
                  </p>
                )}
                {day.kind === "aerobic-only" && (
                  <p className="why-body" style={{ marginBottom: 0 }}>
                    {day.aerobicMinutes[0]}–{day.aerobicMinutes[1]} min aerobic base, spread here instead of stacked
                    onto a lifting day.
                  </p>
                )}
              </div>
            ))}
          </div>
          <Disclosure title="How the week and the per-session time were worked out">
            <p className="why-body">
              Every exercise keeps the exact weekly frequency prescribed in its own dose card below — a
              high-soreness exercise capped at 2x/week still only appears on 2 of the strength days, evenly
              spaced, however many total days you choose. Frequency itself does not reliably change hypertrophy
              or strength once weekly sets are held constant (Schoenfeld, Grgic &amp; Krieger 2019), which is
              why the range above is safe to move inside rather than fixed at one number. Aerobic minutes are
              WHO 2020-guideline totals spread evenly across however many training days you pick, rather than
              concentrated into one or two. The per-session minute range is a rough estimate — sets × reps at
              an average tempo, plus the prescribed rest and a fixed warm-up and changeover allowance — not a
              measured time; real sessions vary with load-changing, coaching and how the person just performing
              actually feels.
            </p>
          </Disclosure>
        </div>

        <div className="section-head" style={{ marginTop: "1.2rem" }}>
          <h3 className="pick-title" style={{ margin: 0 }}>
            Optional emphasis
          </h3>
        </div>
        <p className="read-note">
          One tap only. The default below is the full foundation with no extra inference. Each emphasis adds
          at most a few clearly optional, explicitly-scoped extra slots — it never replaces the foundation.
        </p>
        <div className="chipstrip" role="group" aria-label="Optional emphasis">
          {EMPHASES.map((e) => (
            <button
              key={e.id}
              type="button"
              className={`btn tap ${emphasis === e.id ? "btn-active" : "btn-quiet"}`}
              aria-pressed={emphasis === e.id}
              onClick={() => setEmphasis(e.id)}
              title={e.plain}
            >
              {e.label}
            </button>
          ))}
        </div>

        <div className="picks">
          <FoundationGroup title="Foundation" slots={requiredSlots} doses={doses} slotAll={slots} />
          {optionalSlots.length > 0 && (
            <FoundationGroup title="Optional emphasis additions" slots={optionalSlots} doses={doses} slotAll={slots} />
          )}
        </div>

        {place === "home-gym" && (
          <div className="read-section">
            <h3 className="pick-title">What to buy, in order</h3>
            <p className="read-note">
              Generic and vendor-free, in the order that unlocks the most of the foundation above per rupee
              spent.
            </p>
            <ol className="exlist">
              {[...HOME_KIT]
                .sort((a, b) => a.priority - b.priority)
                .map((k) => (
                  <li key={k.id} className="card ex" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <div className="ex-summary">
                      <span className="ex-index tnum" aria-hidden="true">
                        {k.priority}
                      </span>
                      <span className="ex-name">{k.label}</span>
                    </div>
                    <p className="why-body">
                      <strong>Unlocks:</strong> {k.unlocks}
                    </p>
                    <p className="why-body">{k.guidance}</p>
                    {k.safety.length > 0 && (
                      <ul className="why-body" style={{ margin: 0, paddingLeft: "1.2rem" }}>
                        {k.safety.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
            </ol>
            <Disclosure title="What a home gym cannot fully match" hint="Real ceilings, not papered over">
              <ul className="why-body" style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {HOME_CEILINGS.map((c) => (
                  <li key={c.id} style={{ marginBottom: "0.6rem" }}>
                    <strong>{c.label}.</strong> {c.reason}
                  </li>
                ))}
              </ul>
            </Disclosure>
          </div>
        )}
      </section>

      <section className="read-section notes">
        <Disclosure title="Refine the thresholds" hint="Optional. Ancestry moves two of the lines above">
          <p className="why-body">
            Asked for one reason: the healthy thresholds genuinely differ. Asian bodies carry at a BMI of 23
            roughly the risk European bodies carry at 25, so one number for everyone quietly tells some people
            they are fine when they are not. It changes the BMI and waist lines on this page and nothing else,
            because nothing else has the evidence to change. Leaving it unsaid is a real answer and the page
            says which numbers it used either way.
          </p>
          <Tiles
            label="Ancestry"
            columns={2}
            compact
            value={ancestry}
            onChange={onAncestry}
            options={ANCESTRIES}
          />
        </Disclosure>

        <Disclosure title="How these numbers were worked out" hint="Sources, error bars and the weak parts">
          <p className="why-body">
            Every number here is placed against <strong>71,543 real people</strong>, measured by the US
            national health survey. A tape is out by two to five centimetres in ordinary use, so the lit band
            on each gauge is the honest range rather than a single confident number.
          </p>
          <p className="why-body">
            Percentiles from {PERCENTILE_SOURCE.label}. {PERCENTILE_SOURCE.detail}
          </p>
          <p className="why-body">
            Shoulder width and muscle mass were never measured. You were not asked to guess at either, because
            a guess is not a measurement, so the figure draws both from a conservative default and no number
            on this page rests on them.
          </p>
          <p className="why-body">
            Every exercise below is chosen for the movement pattern it covers, not a muscle group, and carries
            a verified technique guide. Sets default to 2–3 reps in reserve — training to failure is not
            required for growth or strength. The weekly-sets ceiling and floor per exercise come from the
            2026 ACSM position stand, and overlapping work across exercises is capped rather than left to
            stack silently. Full detail is in Sources &amp; methods below.
          </p>
        </Disclosure>

        <Disclosure title="What this is not" hint="The limits, stated plainly">
          <p className="why-body">
            This is an assessment, not a programme. It does not tell you what to lift on Tuesday, and it is
            not a diagnosis. Every number here is an estimate built from population data, and population data
            describes any single person badly. If something feels wrong in your body, a doctor beats a
            website.
          </p>
          <p className="why-body">
            Every dose shown is a safe starting range, not a guaranteed individual optimum. Adjust within the
            given range as your own recovery and technique tell you to.
          </p>
          <p className="why-body">
            Nothing on this page was sent anywhere. It was worked out on your own device and it disappears
            when you close the tab.
          </p>
        </Disclosure>
      </section>

      <section className="read-section">
        <div className="section-head">
          <Glyph name="target" size={16} />
          <h2 className="section-title">Sources &amp; methods</h2>
        </div>
        <p className="read-note">
          How fit-lab knows this. Every formula, threshold, safety rule, exercise pick and dose above resolves
          to a source here — guideline, trial, meta-analysis, observational association, biomechanical
          inference, or an explicitly labelled editorial/product judgement.
        </p>
        <SourcesPanel sources={SOURCES} guides={GUIDES} />
      </section>

      <div className="read-actions">
        <button type="button" className="btn btn-quiet tap" onClick={onRestart}>
          Start again
        </button>
        <button type="button" className="btn btn-quiet tap" onClick={printAll}>
          Print or save
        </button>
      </div>
    </div>
  )
}

function FoundationGroup({
  title,
  slots,
  doses,
  slotAll,
}: {
  title: string
  slots: FoundationSlot[]
  doses: Dose[]
  slotAll: FoundationSlot[]
}) {
  if (slots.length === 0) return null
  return (
    <div className="pick">
      <div className="pick-head">
        <h3 className="pick-title">{title}</h3>
      </div>
      <ol className="exlist">
        {slots.map((slot) => {
          const index = slotAll.indexOf(slot)
          const dose = doses[index]
          const capacity = capacityById(slot.capacity)
          const guide = guideById(slot.exercise.guideId)
          return (
            <li key={slot.exercise.id} className="card ex" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div className="ex-summary">
                <span className="ex-name">
                  {slot.exercise.name}
                  {slot.exercise.uncertain && (
                    <span className="pick-plain" title="An inferred substitute for the tested modality — not itself directly tested.">
                      {" "}
                      (inferred substitute)
                    </span>
                  )}
                </span>
                <span className="pick-plain">{capacity.label}</span>
              </div>
              {guide && (
                <p className="why-body" style={{ margin: 0 }}>
                  <ExternalLink href={guide.url} label={`${guide.title} — ${guide.provider}, opens in a new tab`}>
                    {guide.role === "referral" ? "Official referral" : "Technique guide"}: {guide.title} ({guide.provider})
                  </ExternalLink>
                </p>
              )}
              <DoseView dose={dose} />
              <p className="why-body" style={{ margin: 0 }}>
                {slot.exercise.why}
              </p>
              {slot.exercise.homeCeilingId && (
                <p className="source-limitation">
                  {HOME_CEILINGS.find((c) => c.id === slot.exercise.homeCeilingId)?.reason}
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function DoseView({ dose }: { dose: Dose }) {
  if (dose.kind === "referral") {
    return <p className="ex-name">Referral only — not a dosed exercise.</p>
  }
  if (dose.kind === "aerobic") {
    return (
      <p className="ex-name mono">
        {dose.minutesPerWeek[0]}–{dose.minutesPerWeek[1]} min/week · {dose.sessionsPerWeek}x/week
      </p>
    )
  }
  if (dose.kind === "interval") {
    return (
      <p className="ex-name mono">
        {dose.rounds[0]}–{dose.rounds[1]} rounds · {dose.workSeconds[0]}–{dose.workSeconds[1]}s work ·{" "}
        {dose.sessionsPerWeek}x/week
      </p>
    )
  }
  return (
    <p className="ex-name mono">
      {dose.sets} sets × {dose.repsLow}–{dose.repsHigh} reps · {dose.rir[0]}–{dose.rir[1]} RIR · rest{" "}
      {dose.restSeconds[0]}–{dose.restSeconds[1]}s · {dose.sessionsPerWeek}x/week
    </p>
  )
}
