import { Callout, Disclosure, Kicker } from "../components/ui"
import { BodyView } from "../components/BodyView"
import { MuscleView } from "../components/MuscleView"
import { Glyph, Tiles } from "../components/controls"
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
import { fullBodyFoundation, gapFor } from "../data/exercises"

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
  const gap = gapFor(place)
  const foundation = fullBodyFoundation(place)
  const fullBody = foundation.map(({ muscle }) => muscle.id)

  return (
    <div className="read">
      <header className="read-head">
        <Kicker>Your read</Kicker>
        <button type="button" className="ghost tap" onClick={onRestart}>
          Start again
        </button>
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
          <h2 className="section-title">Current full-body foundation</h2>
        </div>

        <p className="read-note">
          The app chooses complete movement coverage. Your training environment only selects the available
          variants. This is the current structural catalogue; the next evidence layer will replace and verify
          the final exercise set.
        </p>

        <div className="card evidence">
          <MuscleView active={fullBody} height={300} />
          <p className="scene-strip mono">Lit in red: complete full-body coverage</p>
        </div>

        <div className="picks">
          {foundation.map(({ muscle, exercises }) => {
            return (
              <div key={muscle.id} className="pick">
                <div className="pick-head">
                  <h3 className="pick-title">{muscle.label}</h3>
                  <span className="pick-plain">{muscle.plain}</span>
                </div>
                {exercises.length === 0 ? (
                  <p className="read-note">
                    The current catalogue has no variant for this environment. The evidence layer must close
                    that gap before the catalogue is final.
                  </p>
                ) : (
                  <ol className="exlist">
                    {exercises.map((e, i) => (
                      <li key={e.id} className="card ex">
                        <div className="ex-summary">
                          <span className="ex-index tnum" aria-hidden="true">
                            {i + 1}
                          </span>
                          <span className="ex-name">{e.name}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>

        {gap && (
          <div className="read-section">
            <Callout tone="note" title="Home-gym definition">
              <p style={{ margin: 0 }}>{gap}</p>
            </Callout>
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
            The exercise list below is the temporary catalogue carried forward for this structural layer.
            It is not the final evidence-reviewed prescription.
          </p>
          <p className="why-body">
            Two things decide most of whether a year of training changes anything: how hard your sets are, and
            how often you train. Sets that stop five or more reps short of failure produce very little growth,
            and roughly ten hard sets per muscle per week is where growth becomes reliable. You were not asked
            to predict either, because a warning built on a prediction is a warning about nobody.
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
            Nothing on this page was sent anywhere. It was worked out on your own device and it disappears
            when you close the tab.
          </p>
        </Disclosure>
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
