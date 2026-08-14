import { useMemo, useState } from "react"
import { DEFAULT_MUSCLE, defaultShoulderRatio } from "./lib/figure"
import type { Ancestry, Profile, Sex } from "./lib/calc"
import { navyBodyFat } from "./lib/calc"
import type { GoalState, NumericMetricId, Stage } from "./lib/flow"
import { STAGES, bodyComplete, goalComplete, readinessSetChanged, safetyComplete } from "./lib/flow"
import type { Intent } from "./lib/goals"
import type { ConditionId, HealthAnswers, ReadinessId } from "./lib/screening"
import { SCOFF_QUESTIONS, pruneConditions, readinessItems } from "./lib/screening"
import { Intro } from "./steps/Intro"
import { BodyStage } from "./steps/Body"
import { SafetyStage } from "./steps/Safety"
import { GoalStage } from "./steps/Goal"
import { Result } from "./steps/Result"
import type { StageNode } from "./steps/nodes"

/**
 * The required path is three data moments: body, safety, goal.
 *
 * What used to be here as well: a photo step, a character creator with skin,
 * hair and facial hair, a second copy of three of the sliders, and a
 * ten-question personality inventory. None of them changed a number on the
 * result page, and the shortest honest description of the old flow is that it
 * asked for twenty-eight things in order to use nine.
 *
 * This component holds state and routes between screens. Every rule about what
 * is required lives in lib/flow.ts, where it is tested.
 */

/** A development-only shortcut so one screen can be opened without walking to it. */
function devJump(): Stage | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null
  const asked = new URLSearchParams(window.location.search).get("stage")
  return asked && (STAGES as string[]).includes(asked) ? (asked as Stage) : null
}

const SEED: Record<NumericMetricId, number> = {
  age: 27,
  height: 175,
  weight: 78,
  waist: 88,
  neck: 38,
  hip: 96,
}

export default function App() {
  const jump = devJump()
  const [stage, setStage] = useState<Stage>(jump ?? "intro")

  // Unanswered, not male. Sex changes the body-fat formula, the FFMI ceiling,
  // the waist threshold, the percentile table, which mesh is drawn and whether
  // pregnancy is asked about at all. A default would answer all of that and
  // then report it back as though the person had said it.
  const [sex, setSex] = useState<Sex | null>(jump ? "male" : null)
  const [ancestry, setAncestry] = useState<Ancestry>("unsaid")
  const [values, setValues] = useState<Partial<Record<NumericMetricId, number>>>(jump ? SEED : {})

  const [flags, setFlags] = useState<ReadinessId[]>([])
  const [flagsNone, setFlagsNone] = useState(!!jump)
  const [conditions, setConditions] = useState<ConditionId[]>([])
  const [scoff, setScoff] = useState<number[]>([])
  const [scoffNone, setScoffNone] = useState(!!jump)

  const [goal, setGoal] = useState<GoalState>({
    kind: jump ? "lose-fat" : null,
    targetWeightKg: jump ? 72 : null,
    weeks: jump ? 12 : null,
    trainingAge: jump ? "none" : null,
    place: jump ? "gym" : null,
    focus: jump ? ["chest", "back", "quads"] : [],
  })

  const nodes: StageNode[] = [
    { id: "body", label: "Body", glyph: "body", done: bodyComplete(sex, values) },
    {
      id: "safety",
      label: "Safety",
      glyph: "shield",
      done: safetyComplete(
        { selected: flags.length, none: flagsNone },
        { selected: scoff.length, none: scoffNone },
      ),
    },
    { id: "goal", label: "Goal", glyph: "target", done: goalComplete(goal) },
  ]

  const profile: Profile | null = useMemo(() => {
    if (sex === null || !bodyComplete(sex, values)) return null
    return {
      age: values.age as number,
      sex,
      ancestry,
      heightCm: values.height as number,
      weightKg: values.weight as number,
      waistCm: values.waist as number,
      neckCm: values.neck as number,
      hipCm: sex === "female" ? (values.hip as number) : 0,
    }
  }, [ancestry, sex, values])

  /**
   * The figure is alive from the first frame, drawing from a starting body
   * until each reading replaces it. Nothing unset is reported as measured
   * anywhere: the rail shows a dash, the strip under the figure leaves it out,
   * the figure's own accessible label names only what was entered, and the flow
   * does not move until every reading is set.
   *
   * Null until sex is answered, because both base meshes are sexed and there is
   * no honest way to draw one at somebody who has not said which applies.
   */
  const preview = useMemo(() => {
    if (sex === null) return null
    const heightCm = values.height ?? 170
    const weightKg = values.weight ?? 70
    const waistCm = values.waist ?? 82
    const neckCm = values.neck ?? (sex === "female" ? 33 : 37)
    const hipCm = sex === "female" ? (values.hip ?? 95) : 0
    const guess: Profile = {
      age: values.age ?? 27,
      sex,
      ancestry,
      heightCm,
      weightKg,
      waistCm,
      neckCm,
      hipCm,
    }
    return {
      sex,
      heightCm,
      weightKg,
      waistCm,
      neckCm,
      hipCm,
      shoulderRatio: defaultShoulderRatio(sex),
      muscle: DEFAULT_MUSCLE,
      bodyFat: navyBodyFat(guess) ?? 22,
    }
  }, [ancestry, sex, values])

  function setValue(metric: NumericMetricId, value: number) {
    setValues((prev) => ({ ...prev, [metric]: value }))
  }

  function changeSex(next: Sex) {
    const invalidates = readinessSetChanged(sex, next)
    setSex(next)
    if (!invalidates) return

    // The safety screen is not the same screen once sex changes. Going male to
    // female adds the pregnancy question, and a "none of these apply" given
    // about a list that did not contain it would confirm, on the person's
    // behalf, an answer to a question they were never shown. So the
    // confirmation is withdrawn and the group goes back to unanswered.
    setFlagsNone(false)
    const applicable = new Set(readinessItems(next).map((item) => item.id))
    setFlags((prev) => {
      const kept = prev.filter((f) => applicable.has(f))
      setConditions((current) => pruneConditions(current, kept))
      return kept
    })
  }

  if (stage === "intro") return <Intro onStart={() => setStage("body")} />

  if (stage === "body") {
    return (
      <BodyStage
        nodes={nodes}
        sex={sex}
        onSex={changeSex}
        values={values}
        onValue={setValue}
        build={preview}
        onBack={() => setStage("intro")}
        onNext={() => setStage("safety")}
      />
    )
  }

  if (stage === "safety") {
    return (
      <SafetyStage
        nodes={nodes}
        sex={sex}
        flags={flags}
        onFlags={setFlags}
        flagsNone={flagsNone}
        onFlagsNone={setFlagsNone}
        conditions={conditions}
        onConditions={setConditions}
        scoff={scoff}
        onScoff={setScoff}
        scoffNone={scoffNone}
        onScoffNone={setScoffNone}
        onBack={() => setStage("body")}
        onNext={() => setStage("goal")}
      />
    )
  }

  if (stage === "goal") {
    return (
      <GoalStage
        nodes={nodes}
        state={goal}
        onChange={(next) => setGoal((prev) => ({ ...prev, ...next }))}
        weightKg={values.weight ?? 70}
        onBack={() => setStage("safety")}
        onNext={() => setStage("result")}
      />
    )
  }

  if (profile && goal.kind && goal.place) {
    const health: HealthAnswers = {
      chestPain: flags.includes("chestPain"),
      faintness: flags.includes("faintness"),
      supervisedOnly: flags.includes("supervisedOnly"),
      heartOrBp: flags.includes("heartOrBp"),
      chronic: flags.includes("chronic"),
      jointProblem: flags.includes("jointProblem"),
      pregnant: flags.includes("pregnant"),
      conditions,
      scoff: SCOFF_QUESTIONS.map((_, i) => scoff.includes(i)),
    }
    const intent: Intent = {
      kind: goal.kind,
      targetWeightKg: goal.targetWeightKg ?? undefined,
      weeks: goal.weeks ?? undefined,
      trainingAge: goal.trainingAge ?? undefined,
    }
    return (
      <Result
        profile={profile}
        health={health}
        intent={intent}
        place={goal.place}
        focus={goal.focus}
        ancestry={ancestry}
        onAncestry={setAncestry}
        onRestart={() => setStage("intro")}
      />
    )
  }

  // Only reachable by deep-linking past the data, so it goes back to the start
  // rather than rendering a read built out of nothing.
  return <Intro onStart={() => setStage("body")} />
}
