import { Callout, Kicker, Stat } from "../components/ui"
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
  waistRaised,
  whtr,
  whtrBand,
} from "../lib/calc"
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
  onRestart,
}: {
  profile: Profile
  health: HealthAnswers
  intent: Intent
  place: Place
  focus: MuscleId[]
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

  const value = bmi(profile.weightKg, profile.heightCm)
  const bBand = bmiBand(value)
  const ratio = whtr(profile.waistCm, profile.heightCm)
  const wBand = whtrBand(ratio)
  const bf = bodyFatRange(profile)
  const bfMid = navyBodyFat(profile)
  const lean = bfMid === null ? null : leanMassKg(profile.weightKg, bfMid)
  const index = lean === null ? null : ffmi(lean, profile.heightCm)
  const ceiling = ffmiCeiling(profile.sex)
  const verdict = assess(profile, intent, bfMid ?? 25)

  const verdictColor =
    verdict.verdict === "impossible"
      ? "var(--stop)"
      : verdict.verdict === "realistic"
        ? "var(--good)"
        : "var(--accent)"

  const gap = gapFor(place)

  return (
    <div className="wrap" style={{ paddingTop: "3.5rem", paddingBottom: "5rem" }}>
      <Kicker>Your read</Kicker>
      <h1 className="display" style={{ margin: "0.6rem 0 1rem" }}>
        Here is where you <em>actually</em> stand.
      </h1>
      <p className="lede">
        Nothing on this page was sent anywhere. It was all worked out on your phone or laptop, and it
        disappears when you close the tab.
      </p>

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
        <h2 className="h2">The numbers, with their error bars</h2>
        <p style={{ color: "var(--muted)", marginTop: "0.4rem" }}>
          A tape measure is out by two to five centimetres in ordinary use, which is enough to move you across a
          line. So these are bands, not verdicts.
        </p>
        <div style={{ marginTop: "1.2rem" }}>
          <Stat
            label="BMI"
            value={round(value).toFixed(1)}
            band={bBand}
            note={bBand.note}
          />
          <Stat
            label="Waist to height"
            value={round(ratio, 2).toFixed(2)}
            band={wBand}
            note={wBand.note}
          />
          <Stat
            label="Waist"
            value={`${round(profile.waistCm)} cm`}
            band={
              waistRaised(profile.waistCm, profile.sex)
                ? { label: "Above the Indian threshold", tone: "raised" }
                : { label: "Below the Indian threshold", tone: "ok" }
            }
            note={`For Indian bodies the line is ${profile.sex === "male" ? "90" : "80"}cm, lower than the figures used for European populations.`}
          />
          {bf && (
            <Stat
              label="Body fat, estimated"
              value={`${round(bf.low).toFixed(0)}–${round(bf.high).toFixed(0)}%`}
              note="From the US Navy tape formula. It carries roughly four percentage points of error and has never been validated on South Asian bodies. Treat the direction it moves as real and the number itself as rough."
            />
          )}
          {index !== null && (
            <Stat
              label="Fat-free mass index"
              value={round(index).toFixed(1)}
              note={`Natural trainees cluster below about ${ceiling}. That number rests on 74 athletes measured in 1995, so read it as a signpost rather than a limit.`}
            />
          )}
        </div>
      </section>

      <section style={{ marginTop: "3rem" }}>
        <h2 className="h2">Your goal, checked</h2>
        <div
          className="card"
          style={{ padding: "1.3rem 1.35rem", marginTop: "1rem", borderLeft: `3px solid ${verdictColor}` }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: verdictColor, fontSize: "0.9rem" }}>
            {VERDICT_LABEL[verdict.verdict]}
          </p>
          <p className="h2" style={{ margin: "0.5rem 0 0" }}>
            {verdict.headline}
          </p>
          <p style={{ margin: "0.7rem 0 0", color: "var(--muted)", lineHeight: 1.65 }}>{verdict.detail}</p>
          {verdict.honestWeeks && (
            <p
              className="tnum"
              style={{
                margin: "1rem 0 0",
                paddingTop: "0.9rem",
                borderTop: "1px solid var(--rule)",
                fontWeight: 500,
              }}
            >
              The honest timeline: about {verdict.honestWeeks} weeks.
            </p>
          )}
        </div>

        {verdict.flags.length > 0 && (
          <div style={{ display: "grid", gap: "0.85rem", marginTop: "1rem" }}>
            {verdict.flags.map((f) => (
              <Callout key={f.title} tone={f.severity === "warn" ? "warn" : "note"} title={f.title}>
                <p style={{ margin: 0 }}>{f.body}</p>
              </Callout>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: "3rem" }}>
        <h2 className="h2">What to actually do</h2>
        <p style={{ color: "var(--muted)", marginTop: "0.4rem" }}>
          These are not ranked by muscle activation studies. Activation is not growth. They are ranked on whether
          you can keep making them harder, whether they load the muscle in a stretched position, whether they are
          safe on your own, and whether you can get at the equipment.
        </p>

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

      <section style={{ marginTop: "3rem" }}>
        <h2 className="h2">What this is not</h2>
        <p style={{ color: "var(--muted)", marginTop: "0.5rem", lineHeight: 1.65 }}>
          This is an assessment, not a programme. It does not tell you what to lift on Tuesday, and it is not a
          diagnosis. Every number here is an estimate from population data, and population data is a poor
          description of any single person. If something feels wrong in your body, a doctor beats a website.
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
