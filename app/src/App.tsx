import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Choice, Kicker, Number_, Pills, Progress, Slider, Swatches, YesNo } from "./components/ui"
import { HAIRS, SKINS, defaultShoulderRatio } from "./components/Character"
import type { Look } from "./components/Character"
import { BodyView } from "./components/BodyView"
import { MuscleView } from "./components/MuscleView"
import { PhotoCheck } from "./components/PhotoCheck"
import type { Ancestry, Profile, Sex } from "./lib/calc"
import { navyBodyFat } from "./lib/calc"
import type { GoalKind, Intent, TrainingAge } from "./lib/goals"
import type { ConditionId, HealthAnswers } from "./lib/screening"
import { CONDITIONS, SCOFF_QUESTIONS } from "./lib/screening"
import { SCALE_LABELS, TIPI } from "./lib/personality"
import type { MuscleId, Place } from "./data/exercises"
import { MUSCLES } from "./data/exercises"
import { Result } from "./steps/Result"

type Stage = "intro" | "character" | "photo" | "health" | "goal" | "personality" | "result"

const FLOW: Stage[] = ["character", "photo", "health", "goal", "personality"]

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

const ANCESTRIES: { id: Ancestry; label: string }[] = [
  { id: "south-asian", label: "South Asian" },
  { id: "east-asian", label: "East or South-East Asian" },
  { id: "other", label: "Something else" },
  { id: "unsaid", label: "Rather not say" },
]

const STAGES: Stage[] = ["intro", "character", "photo", "health", "goal", "personality", "result"]

/**
 * A development-only shortcut so a given step can be opened directly, without
 * walking the whole flow to look at one screen. Stripped from production
 * builds by the DEV guard, and it prefills only what that step needs to render.
 */
function devJump(): Stage | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null
  const asked = new URLSearchParams(window.location.search).get("stage")
  return asked && (STAGES as string[]).includes(asked) ? (asked as Stage) : null
}

export default function App() {
  const jump = devJump()
  const [stage, setStage] = useState<Stage>(jump ?? "intro")

  const [sex, setSex] = useState<Sex>("male")
  const [ancestry, setAncestry] = useState<Ancestry>("unsaid")
  const [age, setAge] = useState<number | "">(jump ? 27 : "")
  const [heightCm, setHeight] = useState(170)
  const [weightKg, setWeight] = useState(70)
  const [waistCm, setWaist] = useState(84)
  const [neckCm, setNeck] = useState(37)
  const [hipCm, setHip] = useState(95)
  const [shoulderRatio, setShoulder] = useState(defaultShoulderRatio("male"))
  const [muscle, setMuscle] = useState(0.35)

  const [look, setLook] = useState<Look>({
    skin: SKINS[2],
    hair: HAIRS[0],
    hairStyle: "short",
    facial: "none",
  })

  const [chestPain, setChestPain] = useState<boolean | null>(null)
  const [faintness, setFaintness] = useState<boolean | null>(null)
  const [supervisedOnly, setSupervised] = useState<boolean | null>(null)
  const [heartOrBp, setHeartOrBp] = useState<boolean | null>(null)
  const [chronic, setChronic] = useState<boolean | null>(null)
  const [jointProblem, setJoint] = useState<boolean | null>(null)
  const [pregnant, setPregnant] = useState<boolean | null>(null)
  const [conditions, setConditions] = useState<ConditionId[]>([])
  const [scoff, setScoff] = useState<(boolean | null)[]>(Array(SCOFF_QUESTIONS.length).fill(jump ? false : null))

  const [kind, setKind] = useState<GoalKind | null>(jump ? "lose-fat" : null)
  const [targetWeightKg, setTarget] = useState<number | "">(jump ? 64 : "")
  const [weeks, setWeeks] = useState<number | "">(12)
  const [trainingAge, setTrainingAge] = useState<TrainingAge | null>(jump ? "none" : null)
  const [daysPerWeek, setDays] = useState<number | "">(3)
  const [effort, setEffort] = useState<Intent["effort"] | null>(jump ? "comfortable" : null)
  const [place, setPlace] = useState<Place | null>(jump ? "gym" : null)
  const [focus, setFocus] = useState<MuscleId[]>(["chest", "back", "quads"])

  const [tipi, setTipi] = useState<number[]>(Array(TIPI.length).fill(jump ? 5 : 0))

  const profile: Profile | null = useMemo(() => {
    if (age === "") return null
    return { age, sex, ancestry, heightCm, weightKg, waistCm, neckCm, hipCm }
  }, [age, sex, ancestry, heightCm, weightKg, waistCm, neckCm, hipCm])

  const bodyFat = profile ? (navyBodyFat(profile) ?? 22) : 22

  const characterDone = age !== ""
  const healthDone =
    chestPain !== null &&
    faintness !== null &&
    supervisedOnly !== null &&
    heartOrBp !== null &&
    chronic !== null &&
    jointProblem !== null &&
    (sex === "male" || pregnant !== null) &&
    scoff.every((a) => a !== null)
  const goalDone =
    kind !== null &&
    trainingAge !== null &&
    effort !== null &&
    place !== null &&
    daysPerWeek !== "" &&
    focus.length > 0 &&
    (kind === "stay-healthy" || kind === "get-stronger" || (targetWeightKg !== "" && weeks !== ""))
  const personalityDone = tipi.every((v) => v > 0)

  function setSexAndDefaults(next: Sex) {
    setSex(next)
    setShoulder(defaultShoulderRatio(next))
    if (next === "male") setPregnant(null)
  }

  if (stage === "intro") return <Intro onStart={() => setStage("character")} />

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
      scoff: scoff.map(Boolean),
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
        look={look}
        shoulderRatio={shoulderRatio}
        muscle={muscle}
        tipi={tipi}
        onRestart={() => setStage("intro")}
      />
    )
  }

  const index = FLOW.indexOf(stage)
  const figure = (
    <BodyView
      build={{ sex, heightCm, waistCm, hipCm: sex === "female" ? hipCm : 0, shoulderRatio, muscle, bodyFat }}
      look={look}
      height={340}
    />
  )

  return (
    <div className="wrap" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
      <Progress step={index + 1} total={FLOW.length} />

      {stage === "character" && (
        <Section
          kicker={`Step 1 of ${FLOW.length}`}
          title="Build the one that looks like you."
          lede="Not the one you want to look like. The figure is drawn from your measurements, so it moves when the tape does and not when you would prefer it to."
        >
          <div
            className="card scanline"
            style={{ padding: "0.4rem", marginBottom: "1.5rem", overflow: "hidden", position: "sticky", top: "0.75rem", zIndex: 2 }}
          >
            {figure}
            <p
              className="mono"
              style={{
                position: "absolute",
                bottom: 10,
                left: 14,
                margin: 0,
                fontSize: "0.62rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--faint)",
              }}
            >
              Live from your measurements
            </p>
          </div>

          <div style={{ display: "grid", gap: "1.3rem" }}>
            <Pills
              label="Sex at birth"
              value={sex}
              onChange={setSexAndDefaults}
              options={[
                { id: "female" as Sex, label: "Female" },
                { id: "male" as Sex, label: "Male" },
              ]}
            />

            <Number_ label="Age" value={age} onChange={setAge} min={14} max={100} suffix="years" />

            <div>
              <Pills label="Ancestry" value={ancestry} onChange={setAncestry} options={ANCESTRIES} />
              <p style={{ color: "var(--muted)", fontSize: "0.87rem", marginTop: 8, lineHeight: 1.55 }}>
                Asked for one reason: the healthy thresholds genuinely differ. Asian bodies carry at a BMI of 23
                roughly the risk European bodies carry at 25, so using one number for everyone would quietly tell
                some people they are fine when they are not. You can skip it and we will say which numbers we used.
              </p>
            </div>

            <Slider
              label="Height"
              value={heightCm}
              onChange={setHeight}
              min={130}
              max={210}
              display={`${heightCm} cm`}
            />
            <Slider
              label="Weight"
              value={weightKg}
              onChange={setWeight}
              min={35}
              max={180}
              display={`${weightKg} kg`}
            />
            <Slider
              label="Waist"
              hint="Measured around your belly button, standing relaxed, not holding it in."
              value={waistCm}
              onChange={setWaist}
              min={50}
              max={160}
              display={`${waistCm} cm`}
            />
            <Slider
              label="Neck"
              hint="Just below the Adam's apple."
              value={neckCm}
              onChange={setNeck}
              min={25}
              max={60}
              display={`${neckCm} cm`}
            />
            {sex === "female" && (
              <Slider
                label="Hips"
                hint="Around the widest part."
                value={hipCm}
                onChange={setHip}
                min={60}
                max={170}
                display={`${hipCm} cm`}
              />
            )}
            <Slider
              label="Shoulders"
              hint="How broad you are across the top, relative to your waist."
              value={shoulderRatio}
              onChange={setShoulder}
              min={1.05}
              max={1.75}
              step={0.01}
              display={shoulderRatio.toFixed(2)}
            />
            <Slider
              label="How much muscle you carry"
              hint="Your honest guess. The photo step is there to check it."
              value={muscle}
              onChange={setMuscle}
              min={0}
              max={1}
              step={0.01}
              display={muscle < 0.3 ? "Light" : muscle < 0.65 ? "Average" : "Well built"}
            />

            <Swatches label="Skin" colors={SKINS} value={look.skin} onChange={(c) => setLook({ ...look, skin: c })} />
            <Swatches label="Hair" colors={HAIRS} value={look.hair} onChange={(c) => setLook({ ...look, hair: c })} />
            <Pills
              label="Hair style"
              value={look.hairStyle}
              onChange={(v) => setLook({ ...look, hairStyle: v })}
              options={[
                { id: "short" as const, label: "Short" },
                { id: "medium" as const, label: "Medium" },
                { id: "long" as const, label: "Long" },
                { id: "tied" as const, label: "Tied up" },
                { id: "none" as const, label: "Shaved" },
              ]}
            />
            <Pills
              label="Facial hair"
              value={look.facial}
              onChange={(v) => setLook({ ...look, facial: v })}
              options={[
                { id: "none" as const, label: "None" },
                { id: "stubble" as const, label: "Stubble" },
                { id: "beard" as const, label: "Beard" },
              ]}
            />
          </div>

          <Nav onBack={() => setStage("intro")} onNext={() => setStage("photo")} nextDisabled={!characterDone} />
        </Section>
      )}

      {stage === "photo" && (
        <Section
          kicker={`Step 2 of ${FLOW.length}`}
          title="Check it against yourself."
          lede="Optional, and it never leaves your device. This is the step that decides whether the rest of the assessment is worth anything."
        >
          <PhotoCheck>{figure}</PhotoCheck>

          <div style={{ display: "grid", gap: "1.2rem", marginTop: "1.5rem" }}>
            <Slider
              label="Waist"
              value={waistCm}
              onChange={setWaist}
              min={50}
              max={160}
              display={`${waistCm} cm`}
            />
            <Slider
              label="Shoulders"
              value={shoulderRatio}
              onChange={setShoulder}
              min={1.05}
              max={1.75}
              step={0.01}
              display={shoulderRatio.toFixed(2)}
            />
            <Slider
              label="How much muscle you carry"
              value={muscle}
              onChange={setMuscle}
              min={0}
              max={1}
              step={0.01}
              display={muscle < 0.3 ? "Light" : muscle < 0.65 ? "Average" : "Well built"}
            />
          </div>

          <Nav onBack={() => setStage("character")} onNext={() => setStage("health")} nextDisabled={false} />
        </Section>
      )}

      {stage === "health" && (
        <Section
          kicker={`Step 3 of ${FLOW.length}`}
          title="Before any of the rest."
          lede="Most people answer no to all of these and carry straight on. They are here because a few of them genuinely change what we should say to you."
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

          <div style={{ marginTop: "2rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>About food</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.92rem", margin: "0.3rem 0 0.6rem", lineHeight: 1.6 }}>
              These five are a standard screening set. They are here because a product that hands you a body fat
              number and a target weight can do real damage to the wrong person, and it should at least ask.
            </p>
            <div>
              {SCOFF_QUESTIONS.map((q, i) => (
                <YesNo
                  key={q}
                  question={q}
                  value={scoff[i]}
                  onChange={(v) => setScoff((prev) => prev.map((x, j) => (j === i ? v : x)))}
                />
              ))}
            </div>
          </div>

          <div style={{ marginTop: "1.8rem" }}>
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
          <Nav onBack={() => setStage("photo")} onNext={() => setStage("goal")} nextDisabled={!healthDone} />
        </Section>
      )}

      {stage === "goal" && (
        <Section
          kicker={`Step 4 of ${FLOW.length}`}
          title="What do you want, and by when?"
          lede="Answer honestly rather than modestly. Aiming too low is a real failure here, and it is the one nobody names."
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
                min={30}
                max={200}
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
            <div className="card" style={{ padding: "0.4rem", marginBottom: "0.6rem", overflow: "hidden" }}>
              <MuscleView active={focus} height={360} />
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
                Open 3D Model of Human Anatomy · CC BY-SA 4.0
              </p>
            </div>
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

          <Nav onBack={() => setStage("health")} onNext={() => setStage("personality")} nextDisabled={!goalDone} />
        </Section>
      )}

      {stage === "personality" && (
        <Section
          kicker={`Step 5 of ${FLOW.length}`}
          title="How you are built on the inside."
          lede="Ten questions. Not to tell you who you are, but because the habits that hold and the habits that slip are fairly predictable, and it is easier to build around yourself than to fight yourself."
        >
          <p style={{ fontWeight: 500, marginBottom: "1rem" }}>I see myself as:</p>
          <div style={{ display: "grid", gap: "1.4rem" }}>
            {TIPI.map((item, i) => (
              <div key={item.text}>
                <span style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{item.text}</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {SCALE_LABELS.map((l, j) => {
                    const v = j + 1
                    const on = tipi[i] === v
                    return (
                      <button
                        key={l}
                        type="button"
                        title={l}
                        aria-label={l}
                        aria-pressed={on}
                        onClick={() => setTipi((prev) => prev.map((x, k) => (k === i ? v : x)))}
                        style={{
                          minHeight: 40,
                          minWidth: 40,
                          flex: "1 1 auto",
                          borderRadius: 8,
                          cursor: "pointer",
                          font: "inherit",
                          fontSize: "0.8rem",
                          border: `1px solid ${on ? "var(--accent)" : "var(--rule)"}`,
                          background: on ? "color-mix(in srgb, var(--accent) 14%, var(--card))" : "var(--card)",
                          color: on ? "var(--ink)" : "var(--muted)",
                        }}
                      >
                        {v}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.86rem", marginTop: "1rem" }}>
            1 is disagree strongly, 4 is neither, 7 is agree strongly.
          </p>

          <Nav
            onBack={() => setStage("goal")}
            onNext={() => setStage("result")}
            nextDisabled={!personalityDone}
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
  const demo = {
    sex: "male" as const,
    heightCm: 175,
    waistCm: 88,
    hipCm: 0,
    shoulderRatio: 1.46,
    muscle: 0.5,
    bodyFat: 20,
  }
  const demoLook: Look = { skin: SKINS[2], hair: HAIRS[0], hairStyle: "short", facial: "none" }

  return (
    <div className="wrap" style={{ paddingTop: "3rem", paddingBottom: "5rem" }}>
      <div className="rise">
        <p className="kicker">fit-lab</p>
        <h1 className="display" style={{ margin: "1rem 0 1.3rem" }}>
          Everything aimed at you is paid for by your <em>insecurity</em>.
        </h1>
      </div>

      <div
        className="card scanline rise"
        style={{ padding: "0.4rem", margin: "0 0 2rem", overflow: "hidden", animationDelay: "0.1s" }}
      >
        <BodyView build={demo} look={demoLook} height={360} />
      </div>

      <div className="rise" style={{ animationDelay: "0.18s" }}>
        <p className="lede">
          Apps sell subscriptions, coaches sell plans, supplement brands sell powder, and creators sell the body
          they were born with. None of them can afford to tell you that you are closer than you think, or that
          the thing you want will take two years, or that the part of you that you are trying to fix is mostly
          fine.
        </p>
        <p className="lede" style={{ marginTop: "1rem" }}>
          This is free and sells nothing, so it can say all three. Build a body from your own measurements,
          check it against a photo so it stays honest, and get a straight read on where you actually stand.
        </p>
      </div>

      <div
        className="card rise"
        style={{ padding: "1.3rem 1.4rem", marginTop: "2rem", animationDelay: "0.26s" }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>It cuts both ways.</p>
        <p style={{ margin: "0.55rem 0 0", color: "var(--muted)", lineHeight: 1.65 }}>
          Fifteen kilos in eight weeks is not going to happen, and something should say so. But the more common
          failure is the quiet one: light weights, comfortable sets, the same routine for a year, and nothing to
          show for it. That gets named too.
        </p>
      </div>

      <div className="rise" style={{ animationDelay: "0.34s" }}>
        <button className="btn" onClick={onStart} style={{ marginTop: "2rem" }}>
          Build your body
        </button>

        <div
          style={{
            display: "flex",
            gap: "1.4rem",
            flexWrap: "wrap",
            marginTop: "1.6rem",
            color: "var(--faint)",
            fontSize: "0.78rem",
          }}
          className="mono"
        >
          <span>NO ACCOUNT</span>
          <span>NOTHING STORED</span>
          <span>PHOTO NEVER LEAVES YOUR DEVICE</span>
          <span>NOT MEDICAL ADVICE</span>
        </div>
      </div>
    </div>
  )
}
