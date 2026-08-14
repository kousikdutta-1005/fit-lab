import { MuscleView } from "../components/MuscleView"
import { Help, Tape, Tiles } from "../components/controls"
import { Stage } from "../components/Stage"
import { goalComplete, goalFields } from "../lib/flow"
import type { GoalState } from "../lib/flow"
import type { GoalKind, TrainingAge } from "../lib/goals"
import type { Place } from "../data/exercises"
import { MUSCLES } from "../data/exercises"
import type { StageNode } from "./nodes"

/**
 * The goal.
 *
 * Every question here is conditional on the goal, because a question whose
 * answer is ignored is friction wearing a label. Stay healthy and get stronger
 * need no target weight and no timeline: the assessment for those does not use
 * either. Only build muscle needs training age, because that is the one place
 * it changes a rate. The training environment only selects viable variants;
 * the app prescribes complete movement coverage rather than asking the person
 * to choose body parts.
 *
 * Two questions were removed outright. How hard your sets will be, and how many
 * days a week you will train, were both asked in onboarding and then used only
 * to raise warnings — and with a default prefilled, the warning was being
 * generated from a number nobody had given.
 */

const GOALS: { id: GoalKind; label: string; glyph: "flame" | "dumbbell" | "bolt" | "leaf" }[] = [
  { id: "lose-fat", label: "Lose fat", glyph: "flame" },
  { id: "build-muscle", label: "Build muscle", glyph: "dumbbell" },
  { id: "get-stronger", label: "Get stronger", glyph: "bolt" },
  { id: "stay-healthy", label: "Be healthier", glyph: "leaf" },
]

const TIMELINES: { id: string; label: string; weeks: number }[] = [
  { id: "6", label: "6 weeks", weeks: 6 },
  { id: "12", label: "3 months", weeks: 12 },
  { id: "26", label: "6 months", weeks: 26 },
  { id: "52", label: "A year", weeks: 52 },
]

const TRAINING_AGES: { id: TrainingAge; label: string }[] = [
  { id: "none", label: "Never" },
  { id: "under-1", label: "Under a year" },
  { id: "1-3", label: "1–3 years" },
  { id: "3-plus", label: "3+ years" },
]

const PLACES: { id: Place; label: string; note: string; glyph: "home" | "gym" }[] = [
  { id: "home-gym", label: "Home gym", note: "Defined minimum kit", glyph: "home" },
  { id: "commercial-gym", label: "Commercial gym", note: "Full facility", glyph: "gym" },
]

const FULL_BODY = MUSCLES.map((muscle) => muscle.id)

export function GoalStage({
  nodes,
  state,
  onChange,
  weightKg,
  onBack,
  onNext,
}: {
  nodes: StageNode[]
  state: GoalState
  onChange: (next: Partial<GoalState>) => void
  /** Their measured weight, which is where the target tape opens. */
  weightKg: number
  onBack: () => void
  onNext: () => void
}) {
  const fields = goalFields(state.kind)
  const done = goalComplete(state)

  const waiting = done
    ? null
    : state.kind === null
      ? "Pick a goal"
      : fields.target && state.targetWeightKg === null
        ? "Set a target weight"
        : fields.timeline && state.weeks === null
          ? "Pick a timeline"
          : fields.trainingAge && state.trainingAge === null
            ? "Say how long you have trained"
            : state.place === null
              ? "Say where you will train"
              : null

  return (
    <Stage
      nodes={nodes}
      current="goal"
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!done}
      nextLabel="See the read"
      waiting={waiting}
      scene={(height) => (
        <>
          <MuscleView active={FULL_BODY} height={height} />
          <p className="scene-strip mono">Full-body movement foundation</p>
        </>
      )}
    >
      <Tiles
        label="Your goal"
        columns={2}
        value={state.kind}
        onChange={(kind) =>
          onChange({
            kind,
            // Nothing is seeded into state here. The tape below opens on their
            // own weight so it has somewhere to start, but a number the person
            // never touched is not a target they set, and the flow will not
            // move until they have.
            targetWeightKg: goalFields(kind).target ? state.targetWeightKg : null,
            weeks: goalFields(kind).timeline ? state.weeks : null,
            trainingAge: goalFields(kind).trainingAge ? state.trainingAge : null,
          })
        }
        options={GOALS}
      />

      {fields.target && (
        <Tape
          label="Target weight"
          unit="kg"
          min={30}
          max={200}
          value={state.targetWeightKg ?? Math.round(weightKg)}
          onChange={(v) => onChange({ targetWeightKg: v })}
          onTouch={() =>
            onChange({ targetWeightKg: state.targetWeightKg ?? Math.round(weightKg) })
          }
        />
      )}

      {fields.timeline && (
        <Tiles
          label="By when"
          columns={4}
          compact
          value={state.weeks === null ? null : String(state.weeks)}
          onChange={(id) => onChange({ weeks: TIMELINES.find((t) => t.id === id)?.weeks ?? null })}
          options={TIMELINES.map((t) => ({ id: t.id, label: t.label }))}
        />
      )}

      {fields.trainingAge && (
        <Tiles
          label="Trained for"
          columns={2}
          compact
          value={state.trainingAge}
          onChange={(trainingAge) => onChange({ trainingAge })}
          options={TRAINING_AGES}
        />
      )}

      <Tiles
        label="Training environment"
        columns={2}
        compact
        value={state.place}
        onChange={(place) => onChange({ place })}
        options={PLACES}
      />

      <Help title="Why so few">
        <p>
          Only what changes an answer is asked. A target weight and a timeline are the two halves of a rate,
          so they appear for fat loss and muscle gain and nowhere else. Training history only changes the
          rate muscle arrives at, so it appears for muscle and nowhere else. Your environment only decides
          which movement variants are available. The app chooses complete full-body coverage.
        </p>
        <p>
          How hard your sets are, and how many days a week you train, are the two things that most decide
          whether a year of training changes anything. They are not asked here because the answer at this
          point would be a prediction about a future you, and a warning built on a guess is worse than no
          warning. Both are named on the result page instead.
        </p>
        <p>
          The anatomy is the Open 3D Model of Human Anatomy, CC BY-SA 4.0. It shows the full-body coverage;
          it is not a body-part selector.
        </p>
      </Help>
    </Stage>
  )
}
