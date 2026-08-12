import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Callout, Choice, Kicker, Number_, Progress, YesNo } from "./components/ui"
import type { Profile, Sex } from "./lib/calc"
import type { GoalKind, Intent, TrainingAge } from "./lib/goals"
import type { ConditionId, HealthAnswers } from "./lib/screening"
import { CONDITIONS } from "./lib/screening"
import type { MuscleId, Place } from "./data/exercises"
import { MUSCLES } from "./data/exercises"
import { Result } from "./steps/Result"

type Stage = "intro" | "basics" | "tape" | "health" | "goal" | "result"

const STEPS: Stage[] = ["basics", "tape", "health", "goal"]

const GOALS: { id: GoalKind; label: string; note: string }[] = [
  { id: "lose-fat", label: "Lose fat", note: "Bring weight and waist down" },
  { id: "build-muscle", label: "Build muscle", note: "Add size and shape" },
  { id: "get-stronger", label: "Get stronger", note: "Lift more than you can now" },
  { id: "stay-healthy", label: "Just be healthier", note: "No number in mind" },
]

const TRAINING_AGES: { id: TrainingAge; label: string; note: string }[] = [
  { id: "none", label: "Never trained", note: "Or nothing in the last year" },
  { id: "under-1", label: "Under a year", note: "Started recently" },
  { id: "1-3", label: "One to three years", note: "Consistently" },
  { id: "3-plus", label: "Over three years", note: "Consistently" },
]

const PLACES: { id: Place; label: string; note: string }[] = [
  { id: "home-nothing", label: "At home, with nothing", note: "A floor, a chair, a wall" },
  { id: "home-band", label: "At home, with a band", note: "Or a few dumbbells" },
  { id: "gym", label: "A gym", note: "Full equipment" },
]

const EFFORTS: { id: Intent["effort"]; label: string; note: string }[] = [
  { id: "comfortable", label: "Comfortable", note: "I could keep going at the end of a set" },
  { id: "challenging", label: "Hard", note: "The last few reps are a struggle" },
  { id: "near-failure", label: "Almost to failure", note: "One or two reps left in me" },
]

export default function App() {
  const [stage, setStage] = useState<Stage>("intro")

  const [age, setAge] = useState<number | "">("")
  const [sex, setSex] = useState<Sex | null>(null)
  const [heightCm, setHeight] = useState<number | "">("")
  const [weightKg, setWeight] = useState<number | "">("")
  const [waistCm, setWaist] = useState<number | "">("")
  const [neckCm, setNeck] = useState<number | "">("")
  const [hipCm, setHip] = useState<number | "">("")

  const [chestPain, setChestPain] = useState<boolean | null>(null)
  const [faintness, setFaintness] = useState<boolean | null>(null)
  const [supervisedOnly, setSupervised] = useState<boolean | null>(null)
  const [heartOrBp, setHeartOrBp] = useState<boolean | null>(null)
  const [chronic, setChronic] = useState<boolean | null>(null)
  const [jointProblem, setJoint] = useState<boolean | null>(null)
  const [pregnant, setPregnant] = useState<boolean | null>(null)
  const [conditions, setConditions] = useState<ConditionId[]>([])

  const [kind, setKind] = useState<GoalKind | null>(null)
  const [targetWeightKg, setTarget] = useState<number | "">("")
  const [weeks, setWeeks] = useState<number | "">(12)
  const [trainingAge, setTrainingAge] = useState<TrainingAge | null>(null)
  const [daysPerWeek, setDays] = useState<number | "">(3)
  const [effort, setEffort] = useState<Intent["effort"] | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const [focus, setFocus] = useState<MuscleId[]>([])

  const profile: Profile | null = useMemo(() => {
    if (age === "" || !sex || heightCm === "" || weightKg === "" || waistCm === "" || neckCm === "")
      return null
    return {
      age,
      sex,
      heightCm,
      weightKg,
      waistCm,
      neckCm,
      hipCm: hipCm === "" ? 0 : hipCm,
    }
  }, [age, sex, heightCm, weightKg, waistCm, neckCm, hipCm])

  const basicsDone = age !== "" && sex !== null && heightCm !== "" && weightKg !== ""
  const tapeDone = waistCm !== "" && neckCm !== "" && (sex === "male" || hipCm !== "")
  const healthDone =
    chestPain !== null &&
    faintness !== null &&
    supervisedOnly !== null &&
    heartOrBp !== null &&
    chronic !== null &&
    jointProblem !== null &&
    (sex === "male" || pregnant !== null)
  const goalDone =
    kind !== null &&
    trainingAge !== null &&
    effort !== null &&
    place !== null &&
    daysPerWeek !== "" &&
    focus.length > 0 &&
    (kind === "stay-healthy" || kind === "get-stronger" || (targetWeightKg !== "" && weeks !== ""))

  if (stage === "intro") return <Intro onStart={() => setStage("basics")} />

  if (stage === "result" && profile && kind && trainingAge && effort && place) {
    const health: HealthAnswers = {
      chestPain: !!chestPain,
      faintness: !!faintness,
      supervisedOnly: !!supervisedOnly,
      heartOrBp: !!heartOrBp,
      chronic: !!chronic,
      jointProblem: !!jointProblem,
      pregnant: !!pregnant,
      conditions,
    }
    const intent: Intent = {
      kind,
      targetWeightKg: targetWeightKg === "" ? undefined : targetWeightKg,
      weeks: weeks === "" ? 12 : weeks,
      trainingAge,
      daysPerWeek: daysPerWeek === "" ? 3 : daysPerWeek,
      effort,
    }
    return (
      <Result
        profile={profile}
        health={health}
        intent={intent}
        place={place}
        focus={focus}
        onRestart={() => setStage("intro")}
      />
    )
  }

  const index = STEPS.indexOf(stage)

  return (
    <div className="wrap" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <Progress step={index + 1} total={STEPS.length} />

      {stage === "basics" && (
        <Section
          kicker={`Step 1 of ${STEPS.length}`}
          title="Start with the plain facts."
          lede="Nothing here leaves your device. There is no account and nothing is saved."
        >
          <div style={{ display: "grid", gap: "1.1rem" }}>
            <div>
              <span style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>Sex at birth</span>
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <Choice on={sex === "female"} onClick={() => setSex("female")} title="Female" />
                <Choice on={sex === "male"} onClick={() => setSex("male")} title="Male" />
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: 8 }}>
                Asked because the body fat formula and the rate of muscle gain genuinely differ, not to decide
                what kind of training you get.
              </p>
            </div>
            <Number_ label="Age" value={age} onChange={setAge} min={10} max={100} suffix="years" />
            <Number_ label="Height" value={heightCm} onChange={setHeight} min={120} max={220} suffix="cm" />
            <Number_ label="Weight" value={weightKg} onChange={setWeight} min={25} max={250} suffix="kg" />
          </div>
          <Nav onBack={() => setStage("intro")} onNext={() => setStage("tape")} nextDisabled={!basicsDone} />
        </Section>
      )}

      {stage === "tape" && (
        <Section
          kicker={`Step 2 of ${STEPS.length}`}
          title="Now the tape."
          lede="This is the part most people skip, and it matters more than the scale. For Indian bodies the waist tells the truth more reliably than weight does."
        >
          <div style={{ display: "grid", gap: "1.1rem" }}>
            <Number_
              label="Waist"
              hint="Around your belly button, standing relaxed. Do not hold your stomach in."
              value={waistCm}
              onChange={setWaist}
              min={40}
              max={200}
              suffix="cm"
            />
            <Number_
              label="Neck"
              hint="Just below the Adam's apple, tape sloping slightly down at the front."
              value={neckCm}
              onChange={setNeck}
              min={20}
              max={70}
              suffix="cm"
            />
            {sex === "female" && (
              <Number_
                label="Hips"
                hint="Around the widest part."
                value={hipCm}
                onChange={setHip}
                min={50}
                max={200}
                suffix="cm"
              />
            )}
          </div>
          <div style={{ marginTop: "1.3rem" }}>
            <Callout title="Why not just the scale">
              <p style={{ margin: 0 }}>
                South Asian bodies carry more fat around the organs at the same weight than European bodies do.
                A person can sit at a perfectly normal BMI and still be carrying the risk. The waist catches
                that. The scale does not.
              </p>
            </Callout>
          </div>
          <Nav onBack={() => setStage("basics")} onNext={() => setStage("health")} nextDisabled={!tapeDone} />
        </Section>
      )}

      {stage === "health" && (
        <Section
          kicker={`Step 3 of ${STEPS.length}`}
          title="Before any of the rest."
          lede="Seven questions, based on the standard screening form. Most people answer no to all of them and carry straight on."
        >
          <div>
            <YesNo
              question="Do you get chest pain at rest, or during light everyday activity?"
              value={chestPain}
              onChange={setChestPain}
            />
            <YesNo
              question="In the last 12 months, have you lost your balance from dizziness, or lost consciousness?"
              value={faintness}
              onChange={setFaintness}
            />
            <YesNo
              question="Has a doctor ever said you should only exercise under medical supervision?"
              value={supervisedOnly}
              onChange={setSupervised}
            />
            <YesNo
              question="Has a doctor diagnosed you with a heart condition or high blood pressure?"
              value={heartOrBp}
              onChange={setHeartOrBp}
            />
            <YesNo
              question="Do you have any other long-term diagnosed condition?"
              value={chronic}
              onChange={setChronic}
            />
            <YesNo
              question="Do you have a bone, joint or muscle problem that could get worse with activity?"
              value={jointProblem}
              onChange={setJoint}
            />
            {sex === "female" && (
              <YesNo
                question="Are you pregnant, or within twelve weeks of giving birth?"
                value={pregnant}
                onChange={setPregnant}
              />
            )}
          </div>

          <div style={{ marginTop: "1.6rem" }}>
            <span style={{ display: "block", fontWeight: 500, marginBottom: 4 }}>
              Any of these? Choose all that apply.
            </span>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0 0 0.8rem" }}>
              These change the advice rather than stop it.
            </p>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {CONDITIONS.map((c) => (
                <Choice
                  key={c.id}
                  on={conditions.includes(c.id)}
                  onClick={() =>
                    setConditions((prev) =>
                      prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                    )
                  }
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <Nav onBack={() => setStage("tape")} onNext={() => setStage("goal")} nextDisabled={!healthDone} />
        </Section>
      )}

      {stage === "goal" && (
        <Section
          kicker={`Step 4 of ${STEPS.length}`}
          title="What do you want, and by when?"
          lede="Answer honestly rather than modestly. Aiming too low is a real failure here, and it is the more common one."
        >
          <Group label="What are you after">
            {GOALS.map((g) => (
              <Choice key={g.id} on={kind === g.id} onClick={() => setKind(g.id)} title={g.label} note={g.note} />
            ))}
          </Group>

          {(kind === "lose-fat" || kind === "build-muscle") && (
            <div style={{ display: "grid", gap: "1.1rem", marginTop: "1.5rem" }}>
              <Number_
                label="Target weight"
                hint="The number you have in your head. Put the real one."
                value={targetWeightKg}
                onChange={setTarget}
                min={25}
                max={250}
                suffix="kg"
              />
              <Number_ label="In how long" value={weeks} onChange={setWeeks} min={2} max={260} suffix="weeks" />
            </div>
          )}

          <Group label="How long have you trained">
            {TRAINING_AGES.map((t) => (
              <Choice
                key={t.id}
                on={trainingAge === t.id}
                onClick={() => setTrainingAge(t.id)}
                title={t.label}
                note={t.note}
              />
            ))}
          </Group>

          <Group label="Where will you train">
            {PLACES.map((p) => (
              <Choice key={p.id} on={place === p.id} onClick={() => setPlace(p.id)} title={p.label} note={p.note} />
            ))}
          </Group>

          <div style={{ marginTop: "1.5rem" }}>
            <Number_
              label="Days a week you will actually train"
              hint="What your life allows, not what you wish it allowed."
              value={daysPerWeek}
              onChange={setDays}
              min={1}
              max={7}
              suffix="days"
            />
          </div>

          <Group label="How hard will your sets be">
            {EFFORTS.map((e) => (
              <Choice key={e.id} on={effort === e.id} onClick={() => setEffort(e.id)} title={e.label} note={e.note} />
            ))}
          </Group>

          <Group label="Which parts do you want exercises for">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
              {MUSCLES.map((m) => {
                const on = focus.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFocus((prev) => (on ? prev.filter((x) => x !== m.id) : [...prev, m.id]))}
                    style={{
                      minHeight: 40,
                      padding: "0 0.95rem",
                      borderRadius: 999,
                      cursor: "pointer",
                      font: "inherit",
                      border: `1px solid ${on ? "var(--accent)" : "var(--rule)"}`,
                      background: on ? "color-mix(in srgb, var(--accent) 12%, var(--card))" : "var(--card)",
                      color: "var(--ink)",
                    }}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </Group>

          <Nav
            onBack={() => setStage("health")}
            onNext={() => setStage("result")}
            nextDisabled={!goalDone}
            nextLabel="See the read"
          />
        </Section>
      )}
    </div>
  )
}

function Section({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string
  title: string
  lede: string
  children: ReactNode
}) {
  return (
    <div style={{ marginTop: "2rem" }}>
      <Kicker>{kicker}</Kicker>
      <h1 className="display" style={{ margin: "0.5rem 0 0.8rem", fontSize: "clamp(1.7rem, 4.6vw, 2.4rem)" }}>
        {title}
      </h1>
      <p className="lede" style={{ marginBottom: "2rem" }}>
        {lede}
      </p>
      {children}
    </div>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: "1.7rem" }}>
      <span style={{ display: "block", fontWeight: 500, marginBottom: "0.7rem" }}>{label}</span>
      <div style={{ display: "grid", gap: "0.5rem" }}>{children}</div>
    </div>
  )
}

function Nav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continue",
}: {
  onBack: () => void
  onNext: () => void
  nextDisabled: boolean
  nextLabel?: string
}) {
  return (
    <div style={{ display: "flex", gap: "0.6rem", marginTop: "2.5rem" }}>
      <button className="btn btn-quiet" onClick={onBack}>
        Back
      </button>
      <button className="btn" onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </button>
    </div>
  )
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="wrap" style={{ paddingTop: "4.5rem", paddingBottom: "5rem" }}>
      <Kicker>fit-lab</Kicker>
      <h1 className="display" style={{ margin: "0.8rem 0 1.2rem" }}>
        Nobody will tell you if your goal is <em>impossible</em>.
      </h1>
      <p className="lede">
        Every fitness product in India is paid for by aspiration. Gyms sell memberships, apps sell coaches,
        trainers sell protein powder. Something that earns money from you believing your goal is achievable
        cannot be the thing that tells you it is not.
      </p>
      <p className="lede" style={{ marginTop: "1rem" }}>
        This has nothing to sell you. So it can say the true thing: what your body is actually doing right now,
        whether the goal in your head is reachable, how long it would honestly take, and which exercises are
        worth your time in a gym or on a bare floor.
      </p>

      <div className="card" style={{ padding: "1.2rem 1.3rem", marginTop: "2rem" }}>
        <p style={{ margin: 0, fontWeight: 600 }}>It cuts both ways.</p>
        <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", lineHeight: 1.65 }}>
          Fifteen kilos in eight weeks is not going to happen, and something should say so. But the more common
          failure here is the opposite one: light weights, comfortable sets, the same routine for a year, and
          nothing to show for it. That gets named too.
        </p>
      </div>

      <button className="btn" onClick={onStart} style={{ marginTop: "2rem" }}>
        Start. It takes about three minutes
      </button>

      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "1.5rem", lineHeight: 1.6 }}>
        No account, no email, nothing stored. Every calculation runs on your own device and nothing you type is
        sent anywhere. This is not medical advice and it does not diagnose anything.
      </p>
    </div>
  )
}
