/**
 * The automatic full-body foundation.
 *
 * The user never picks a muscle. This module deterministically covers every
 * required capacity exactly once per environment, applies the age-65+
 * balance overlay and the always-on mobility bonus, filters out anything
 * unsafe for the current safety verdict, and — only on an explicit post-
 * result emphasis tap — appends up to `EMPHASIS_SLOT_CAP` optional slots.
 * Nothing here reads or requires a new onboarding field: the only signals
 * used are the ones `App.tsx` already collects (screen kind, conditions,
 * pregnancy/joint flags, age, environment, emphasis).
 */

import type { CapacityId, Emphasis } from "../data/capacities.ts"
import { EMPHASIS_SLOT_CAP, REQUIRED_CAPACITIES } from "../data/capacities.ts"
import type { Exercise, Place } from "../data/exercises.ts"
import { SHIPPABLE_EXERCISES } from "../data/exercises.ts"
import type { ConditionId, Screen } from "./screening.ts"

export type SafetyContext = {
  screenKind: Screen["kind"]
  conditions: ConditionId[]
  jointProblem: boolean
  pregnant: boolean
  age: number
}

export type FoundationSlot = {
  capacity: CapacityId
  exercise: Exercise
  /** True for a slot only present because of an emphasis tap. */
  optional: boolean
}

const TIER_SCORE: Record<Exercise["tier"], number> = { S: 2, A: 1, B: 0 }
const CERTAINTY_SCORE: Record<Exercise["evidenceCertainty"], number> = {
  established: 4,
  probable: 3,
  mechanistic: 2,
  extrapolated: 1,
  limited: 0,
}

/** Deterministic: same inputs always rank the same exercise first. */
function pickBest(pool: Exercise[]): Exercise | null {
  if (pool.length === 0) return null
  return [...pool].sort((a, b) => {
    const tier = TIER_SCORE[b.tier] - TIER_SCORE[a.tier]
    if (tier !== 0) return tier
    const certainty = CERTAINTY_SCORE[b.evidenceCertainty] - CERTAINTY_SCORE[a.evidenceCertainty]
    if (certainty !== 0) return certainty
    return a.id.localeCompare(b.id)
  })[0]
}

function filterForSafety(pool: Exercise[], ctx: SafetyContext): Exercise[] {
  return pool.filter((e) => {
    // Impact/jumping work is dropped under pregnancy or a flagged joint problem,
    // never overridden by a generic plan.
    if (e.impact && (ctx.pregnant || ctx.jointProblem)) return false
    if (ctx.conditions.includes("knee-pain") && e.impact) return false
    return true
  })
}

/** Age threshold the longevity-report convention uses for the balance overlay. */
export const BALANCE_OVERLAY_AGE = 65

export const EMPHASIS_CAPACITIES: Record<Exclude<Emphasis, "general">, CapacityId[]> = {
  running: ["run_progression", "run_hamstring_resilience", "run_strides"],
  boxing: ["boxing_grip_forearm", "boxing_conditioning"],
  outdoors: ["outdoors_loaded_carry_walk", "outdoors_trip_prep", "outdoors_landing_awareness"],
}

/**
 * Builds the deterministic foundation. Returns an empty list under a "stop"
 * safety verdict — no generic plan ever overrides medical caution.
 */
export function buildFoundation(place: Place, ctx: SafetyContext, emphasis: Emphasis = "general"): FoundationSlot[] {
  if (ctx.screenKind === "stop") return []

  const slots: FoundationSlot[] = []
  const requiredCapacities: CapacityId[] = [...REQUIRED_CAPACITIES]
  if (ctx.age >= BALANCE_OVERLAY_AGE) requiredCapacities.push("balance")
  requiredCapacities.push("mobility")

  for (const capacity of requiredCapacities) {
    const pool = filterForSafety(
      SHIPPABLE_EXERCISES.filter((e) => e.capacity === capacity && e.environments.includes(place)),
      ctx,
    )
    const pick = pickBest(pool)
    if (pick) slots.push({ capacity, exercise: pick, optional: false })
  }

  if (emphasis !== "general") {
    const optionalCapacities = EMPHASIS_CAPACITIES[emphasis]
    let added = 0
    for (const capacity of optionalCapacities) {
      if (added >= EMPHASIS_SLOT_CAP) break
      const pool = filterForSafety(
        SHIPPABLE_EXERCISES.filter((e) => e.capacity === capacity && e.environments.includes(place)),
        ctx,
      )
      const pick = pickBest(pool)
      if (pick) {
        slots.push({ capacity, exercise: pick, optional: true })
        added += 1
      }
    }
  }

  return slots
}

/** Every capacity id used anywhere in the foundation, for coverage tests. */
export function allFoundationCapacities(): CapacityId[] {
  return [...REQUIRED_CAPACITIES, "balance", "mobility", ...Object.values(EMPHASIS_CAPACITIES).flat()]
}
