import { Callout, Disclosure, Headline, Kicker } from "../components/ui"
import { BodyView } from "../components/BodyView"
import { MuscleView } from "../components/MuscleView"
import { Gauge, Radar, Timeline } from "../components/viz"
import { PERCENTILE_SOURCE, context, percentileOf } from "../lib/percentiles"
import type { Look } from "../components/Character"
import type { Profile } from "../lib/calc"
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
import { PERSONALITY_CAVEAT, scoreTipi } from "../lib/personality"
import type { Intent } from "../lib/goals"
import { assess } from "../lib/goals"
import type { HealthAnswers } from "../lib/screening"
import { screen } from "../lib/screening"
import type { MuscleId, Place } from "../data/exercises"
import { MUSCLES, gapFor, pickExercises } from "../data/exercises"

const VERDICT_LABEL: Record<string, string> = {
  impossible: "Not achievable as stated",
  "too-fast": "Achievable, but not this fast",
  realistic: "Achievable",
  "too-slow": "Achievable, and you are aiming below yourself",
  "under-powered": "The plan will not deliver the goal",
}

export function Result({
  profile,
  health,
  intent,
  place,
  focus,
  look,
  shoulderRatio,
  muscle,
  tipi,
  onRestart,
}: {
  profile: Profile
  health: HealthAnswers
  intent: Intent
  place: Place
  focus: MuscleId[]
  look: Look
  shoulderRatio: number
  muscle: number
  tipi: number[]
  onRestart: () => void
}) {
  const scr = screen(profile, health)

  if (scr.kind === "stop") {
    return (
      <div className="wrap" style={{ paddingTop: "3.5rem", paddingBottom: "5rem" }}>
        <Kicker>Where this stops</Kicker>
        <h1 className="display" style={{ margin: "0.6rem 0 1rem" }}>
          {scr.title}
        </h1>
        <p className="lede">{scr.body}</p>
        <div className="card" style={{ padding: "1.15rem", marginTop: "1.5rem", borderLeft: "3px solid var(--stop)" }}>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.7rem" }}>
            {scr.reasons.map((r) => (
              <li key={r} style={{ lineHeight: 1.6 }}>
                {r}
              </li>
            ))}
          </ul>
        </div>
        <p style={{ color: "var(--muted)", marginTop: "1.5rem", lineHeight: 1.65 }}>
          None of this means you cannot train. It means the first step is a person who can examine you, not a
          form on a website. Come back after that and this will still be here.
        </p>
        <button className="btn btn-quiet" onClick={onRestart} style={{ marginTop: "1.5rem" }}>
          Start again
        </button>
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
  const traits = scoreTipi(tipi)

  const gap = gapFor(place)

  return (
    <div className="wrap" style={{ paddingTop: "3.5rem", paddingBottom: "5rem" }}>
      <Kicker>Your read</Kicker>
      <h1 className="display" style={{ margin: "0.6rem 0 1rem" }}>
        Here is where you <em>actually</em> stand.
      </h1>
      <p className="lede">
        Nothing on this page was sent anywhere. It was all worked out on your own device, and it disappears when
        you close the tab.
      </p>

      <Headline
        label={VERDICT_LABEL[verdict.verdict]}
        title={verdict.headline}
        tone={
          verdict.verdict === "impossible" ? "stop" : verdict.verdict === "realistic" ? "good" : "warn"
        }
        body={verdict.detail}
      >
        {verdict.honestWeeks && <Timeline wanted={intent.weeks} honest={verdict.honestWeeks} />}
      </Headline>

      <div className="card scanline" style={{ padding: "0.5rem", marginTop: "1.5rem", overflow: "hidden" }}>
        <BodyView
          build={{
            sex: profile.sex,
            heightCm: profile.heightCm,
            waistCm: profile.waistCm,
            hipCm: profile.sex === "female" ? profile.hipCm : 0,
            shoulderRatio,
            muscle,
            bodyFat: bfMid ?? 22,
          }}
          look={look}
          height={380}
        />
      </div>

      {/* Safety first, always, per the design principles. */}
      <section style={{ marginTop: "2.5rem" }}>
        <Callout tone={scr.kind === "caution" ? "warn" : "note"} title={scr.title}>
          <p style={{ margin: 0 }}>{scr.body}</p>
        </Callout>
        {scr.notes.length > 0 && (
          <div style={{ display: "grid", gap: "0.85rem", marginTop: "0.85rem" }}>
            {scr.notes.map((n) => (
              <div key={n.title} className="card" style={{ padding: "1rem 1.1rem" }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{n.title}</p>
                <p style={{ margin: "5px 0 0", color: "var(--muted)", lineHeight: 1.6 }}>{n.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: "3rem" }}>
        <h2 className="h2">Where you actually stand</h2>
        <p style={{ color: "var(--muted)", marginTop: "0.4rem", lineHeight: 1.6 }}>
          Every number here is placed against {" "}
          <strong style={{ color: "var(--ink)" }}>71,543 real people</strong>, measured by the US national
          health survey. A tape is out by two to five centimetres in ordinary use, so the lit band is the
          honest range rather than a single confident number.
        </p>
        <div style={{ marginTop: "1.2rem", display: "grid", gap: "0.85rem" }}>
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

      <section style={{ marginTop: "1.4rem" }}>
        <p style={{ color: "var(--faint)", fontSize: "0.82rem", lineHeight: 1.55, margin: 0 }}>
          Percentiles from {PERCENTILE_SOURCE.label}. {PERCENTILE_SOURCE.detail}
        </p>
      </section>

      {verdict.flags.length > 0 && (
        <section style={{ marginTop: "2.2rem", display: "grid", gap: "0.85rem" }}>
          {verdict.flags.map((f) => (
            <Callout key={f.title} tone={f.severity === "warn" ? "warn" : "note"} title={f.title}>
              <p style={{ margin: 0 }}>{f.body}</p>
            </Callout>
          ))}
        </section>
      )}

      <section style={{ marginTop: "2.2rem" }}>
        <h2 className="h2">What to actually do</h2>
        <p style={{ color: "var(--muted)", marginTop: "0.4rem" }}>
          These are not ranked by muscle activation studies. Activation is not growth. They are ranked on whether
          you can keep making them harder, whether they load the muscle in a stretched position, whether they are
          safe on your own, and whether you can get at the equipment.
        </p>

        <div className="card" style={{ padding: "0.4rem", marginTop: "1.4rem", overflow: "hidden" }}>
          <MuscleView active={focus} height={320} />
          <p
            className="mono"
            style={{
              margin: "0 0 0.5rem 0.9rem",
              fontSize: "0.6rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--faint)",
            }}
          >
            Lit in red: what you picked. Open 3D Model of Human Anatomy, CC BY-SA 4.0
          </p>
        </div>

        <div style={{ marginTop: "1.4rem", display: "grid", gap: "1.4rem" }}>
          {focus.map((id) => {
            const muscle = MUSCLES.find((m) => m.id === id)
            const picks = pickExercises(id, place)
            if (!muscle) return null
            return (
              <div key={id}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>{muscle.label}</h3>
                  <span style={{ color: "var(--muted)", fontSize: "0.88rem" }}>{muscle.plain}</span>
                </div>
                {picks.length === 0 ? (
                  <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
                    Nothing here can be trained properly with what you have. That is the honest answer rather
                    than a bad substitute.
                  </p>
                ) : (
                  <ol style={{ margin: "0.6rem 0 0", padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
                    {picks.map((e, i) => (
                      <li key={e.id} className="card" style={{ padding: "0.85rem 1rem", display: "flex", gap: "0.8rem" }}>
                        <span
                          className="tnum"
                          aria-hidden="true"
                          style={{ color: "var(--muted)", fontWeight: 600, flex: "0 0 auto" }}
                        >
                          {i + 1}
                        </span>
                        <span>
                          <span style={{ display: "block", fontWeight: 500 }}>{e.name}</span>
                          <span style={{ display: "block", color: "var(--muted)", fontSize: "0.92rem", marginTop: 2, lineHeight: 1.55 }}>
                            {e.why}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>

        {gap && (
          <div style={{ marginTop: "1.6rem" }}>
            <Callout tone="warn" title="What your setup cannot do">
              <p style={{ margin: 0 }}>{gap}</p>
            </Callout>
          </div>
        )}
      </section>

      <section style={{ marginTop: "2.2rem" }}>
        <Disclosure title="How you are built on the inside" hint="Ten questions, read as a sketch">
        <p style={{ color: "var(--muted)", marginTop: "0.4rem", lineHeight: 1.6 }}>{PERSONALITY_CAVEAT}</p>
        <div className="card" style={{ padding: "1.2rem", marginTop: "1.2rem", display: "grid", placeItems: "center" }}>
          <Radar
            points={traits.map((tr) => ({
              label: tr.label === "Conscientiousness" ? "Follow-through" : tr.label,
              value: tr.score,
              highlight: tr.trait === "conscientiousness",
            }))}
          />
        </div>

        <div style={{ marginTop: "0.85rem", display: "grid", gap: "0.85rem" }}>
          {traits.map((tr) => (
            <div key={tr.trait} className="card" style={{ padding: "1rem 1.1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600 }}>{tr.label}</span>
                <span className="tnum" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                  {tr.band === "lower" ? "Lower" : tr.band === "higher" ? "Higher" : "Middle"}
                </span>
              </div>
              <div
                aria-hidden="true"
                style={{ marginTop: 8, height: 4, borderRadius: 999, background: "var(--rule)", overflow: "hidden" }}
              >
                <div
                  style={{
                    width: `${((tr.score - 1) / 6) * 100}%`,
                    height: "100%",
                    background: tr.trait === "conscientiousness" ? "var(--accent)" : "var(--muted)",
                  }}
                />
              </div>
              <p style={{ margin: "0.7rem 0 0", color: "var(--muted)", lineHeight: 1.6 }}>{tr.reading}</p>
            </div>
          ))}
        </div>
        </Disclosure>
      </section>

      <section style={{ marginTop: "3rem" }}>
        <h2 className="h2">What this is not</h2>
        <p style={{ color: "var(--muted)", marginTop: "0.5rem", lineHeight: 1.65 }}>
          This is an assessment, not a programme. It does not tell you what to lift on Tuesday, and it is not a
          diagnosis. Every number here is an estimate built from population data, and population data describes
          any single person badly. If something feels wrong in your body, a doctor beats a website.
        </p>
      </section>

      <div style={{ display: "flex", gap: "0.7rem", marginTop: "2.5rem", flexWrap: "wrap" }}>
        <button className="btn btn-quiet" onClick={onRestart}>
          Start again
        </button>
        <button className="btn btn-quiet" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>
    </div>
  )
}
