/**
 * The shape of the required path.
 *
 * There are three data moments and nothing else: the body, the safety screen,
 * and the goal. Every rule about what a person must answer lives here rather
 * than inside a component, because "is this question required" is the kind of
 * logic that quietly rots when it is spelled out inside JSX, and because it is
 * the part worth testing.
 *
 * Two rules run through all of it:
 *
 *   - Nothing is asked whose answer is ignored. A question that changes no
 *     output is friction with a label on it.
 *   - Nothing is assumed silently where the assumption would be reported back
 *     as if it were an answer. That is why the safety groups need an explicit
 *     "none of these" rather than treating an untouched group as all-no.
 */

import type { Sex } from "./calc.ts"
import type { GoalKind, TrainingAge } from "./goals.ts"
import type { MuscleId, Place } from "../data/exercises.ts"
import { readinessItems } from "./screening.ts"

export type Stage = "intro" | "body" | "safety" | "goal" | "result"

/** The three moments a person actually gives data in. */
export const DATA_STAGES = ["body", "safety", "goal"] as const
export type DataStage = (typeof DATA_STAGES)[number]

export const STAGES: Stage[] = ["intro", "body", "safety", "goal", "result"]

export const DATA_STAGE_LABEL: Record<DataStage, string> = {
  body: "Body",
  safety: "Safety",
  goal: "Goal",
}

export function nextStage(stage: Stage): Stage {
  const i = STAGES.indexOf(stage)
  return STAGES[Math.min(i + 1, STAGES.length - 1)]
}

export function previousStage(stage: Stage): Stage {
  const i = STAGES.indexOf(stage)
  return STAGES[Math.max(i - 1, 0)]
}

/**
 * The measurements. Each one is here because it moves the body-fat estimate,
 * a percentile, a safety threshold or the deformation of the mesh. Nothing
 * else survived.
 *
 * Hip is female-only because the Navy formula only uses it there; asking a man
 * for it would be collecting a number to throw away.
 *
 * Sex is nullable everywhere in this module, and that is the point. It changes
 * the body-fat formula, the FFMI ceiling, the waist threshold, the percentile
 * table, which mesh is drawn and whether pregnancy is even a question. A
 * default of "male" would answer all of that on the person's behalf and then
 * report it back as though they had said it.
 */
export type MetricId = "sex" | "age" | "height" | "weight" | "waist" | "neck" | "hip"

export type NumericMetricId = Exclude<MetricId, "sex">

const BASE_METRICS: MetricId[] = ["sex", "age", "height", "weight", "waist", "neck"]

export function bodyMetrics(sex: Sex | null): MetricId[] {
  return sex === "female" ? [...BASE_METRICS, "hip"] : BASE_METRICS
}

export type BodyValues = Partial<Record<NumericMetricId, number>>

export function requiredBodyMetrics(sex: Sex | null): NumericMetricId[] {
  return bodyMetrics(sex).filter((m): m is NumericMetricId => m !== "sex")
}

export function missingBodyMetrics(sex: Sex | null, values: BodyValues): NumericMetricId[] {
  return requiredBodyMetrics(sex).filter((m) => typeof values[m] !== "number")
}

/**
 * Complete means every applicable reading is set *and* sex has been chosen.
 *
 * While sex is unanswered the hip is not in the required list, because whether
 * it is required is one of the things sex decides. That is not a loophole: the
 * body is incomplete regardless until sex is answered, and answering it female
 * puts the hip straight back on the list.
 */
export function bodyComplete(sex: Sex | null, values: BodyValues): boolean {
  if (sex === null) return false
  return missingBodyMetrics(sex, values).length === 0
}

/**
 * A group on the safety screen. Selecting nothing is not an answer, so the
 * group is only settled when the person has either ticked something or said
 * plainly that none of it applies.
 */
export type GroupState = { selected: number; none: boolean }

export function groupAnswered(group: GroupState): boolean {
  return group.none || group.selected > 0
}

export function safetyComplete(readiness: GroupState, food: GroupState): boolean {
  return groupAnswered(readiness) && groupAnswered(food)
}

/**
 * Whether a change of sex invalidates an answer already given to the readiness
 * group.
 *
 * It does whenever the set of applicable questions changes, and the direction
 * that matters most is male to female: "none of these apply" was said about a
 * list that did not contain pregnancy, so carrying it across would confirm, on
 * the person's behalf, an answer to a question they were never shown. The
 * other direction is invalidated too, because a confirmation made about a
 * longer list is not the same answer as one made about a shorter one.
 */
export function readinessSetChanged(previous: Sex | null, next: Sex | null): boolean {
  const applicable = (sex: Sex | null) => readinessItems(sex).map((item) => item.id).join(",")
  return applicable(previous) !== applicable(next)
}

/** Which goal questions change an output for this goal, and which do not. */
export type GoalFields = {
  /** A target weight only means something when the goal is a weight change. */
  target: boolean
  /** Same for the timeline: it is the denominator of the rate. */
  timeline: boolean
  /** Training age only changes the gain-rate model, so only muscle needs it. */
  trainingAge: boolean
}

export function goalFields(kind: GoalKind | null): GoalFields {
  const weightGoal = kind === "lose-fat" || kind === "build-muscle"
  return {
    target: weightGoal,
    timeline: weightGoal,
    trainingAge: kind === "build-muscle",
  }
}

export type GoalState = {
  kind: GoalKind | null
  targetWeightKg: number | null
  weeks: number | null
  trainingAge: TrainingAge | null
  place: Place | null
  focus: MuscleId[]
}

export function goalComplete(state: GoalState): boolean {
  if (state.kind === null) return false
  const fields = goalFields(state.kind)
  if (fields.target && state.targetWeightKg === null) return false
  if (fields.timeline && state.weeks === null) return false
  if (fields.trainingAge && state.trainingAge === null) return false
  if (state.place === null) return false
  return state.focus.length > 0
}
