/**
 * Goal realism. This is the part of fit-lab that no other product does.
 *
 * It answers two questions, not one:
 *   - Is this goal beyond what a body can actually do in the time given?
 *   - Is this goal so far below your capacity that it will waste a year?
 *
 * The second question is the one nobody asks, and in India it is the more
 * common failure by a wide margin.
 *
 * Honesty note carried into the UI: every rate model below is a practitioner
 * model, not a randomised trial, and all of them were built on predominantly
 * white North American cohorts. There is essentially no South Asian data.
 */

import type { Profile, Sex } from "./calc.ts"
import { bmi, ffmi, ffmiCeiling, leanMassKg, round } from "./calc.ts"

export type GoalKind = "lose-fat" | "build-muscle" | "get-stronger" | "stay-healthy"

export type TrainingAge = "none" | "under-1" | "1-3" | "3-plus"

/**
 * Everything past the goal itself is optional, and absent means absent.
 *
 * The onboarding only asks for a field where that field changes an output for
 * the goal chosen, so a plan flag must never be raised from a value nobody
 * gave. A warning invented out of a default is worse than no warning: it is a
 * claim about a person made up by the form.
 */
export type Intent = {
  kind: GoalKind
  /** Target bodyweight in kg. Only asked for lose-fat and build-muscle. */
  targetWeightKg?: number
  /** How many weeks they want it in. Only asked alongside a target. */
  weeks?: number
  /** Only asked for build-muscle, where it changes the gain rate. */
  trainingAge?: TrainingAge
  /** Not asked in onboarding. Present only if something else supplies it. */
  daysPerWeek?: number
  /** Not asked in onboarding. Present only if something else supplies it. */
  effort?: "comfortable" | "challenging" | "near-failure"
}

export type Verdict =
  | "impossible"
  | "too-fast"
  | "realistic"
  | "too-slow"
  | "under-powered"

export type Assessment = {
  verdict: Verdict
  headline: string
  detail: string
  /** What the same goal looks like on an achievable timeline. */
  honestWeeks?: number
  /** Problems with the plan rather than the goal itself. */
  flags: Flag[]
}

export type Flag = {
  title: string
  body: string
  severity: "note" | "warn"
}

/**
 * Safe fat loss: 0.5-1.0% of bodyweight per week.
 * Garthe et al. 2011 found slow losers kept lean mass and strength; fast losers
 * did not. Helms et al. 2014 reaches the same range from the other direction.
 */
const FAT_LOSS_SAFE_MAX = 0.01
const FAT_LOSS_SAFE_MIN = 0.005

/**
 * Lean mass gain per month as a fraction of bodyweight, from the Alan Aragon
 * model. Halved for women, which is well established in absolute terms.
 */
const GAIN_RATE: Record<TrainingAge, number> = {
  none: 0.0125,
  "under-1": 0.0125,
  "1-3": 0.0075,
  "3-plus": 0.00375,
}

function gainPerWeek(weightKg: number, trainingAge: TrainingAge, sex: Sex): number {
  const monthly = GAIN_RATE[trainingAge] * weightKg
  const sexAdjusted = sex === "male" ? monthly : monthly * 0.5
  return sexAdjusted / 4.345
}

export function assess(profile: Profile, intent: Intent, bodyFatPct: number): Assessment {
  const flags = planFlags(intent)

  if (intent.kind === "stay-healthy") {
    return {
      verdict: "realistic",
      headline: "This is achievable, and it is worth more than it sounds.",
      detail:
        "The World Health Organization asks for 150 to 300 minutes of moderate activity a week plus two strength sessions. Most of the health benefit arrives early, in the gap between doing nothing and doing something. You do not need a gym to collect it.",
      flags,
    }
  }

  if (intent.kind === "get-stronger") {
    return {
      verdict: "realistic",
      headline: "Strength is the fastest thing your body will give you.",
      detail:
        "For the first three to six months most of what you gain is your nervous system learning the movement, not new muscle. That is why beginners add weight almost every session and why the early progress is real even when the mirror has not changed yet. Expect to feel it in two to four weeks.",
      flags,
    }
  }

  const target = intent.targetWeightKg ?? profile.weightKg
  const delta = target - profile.weightKg
  const weeks = intent.weeks

  // Both remaining goals are a rate, and a rate needs a denominator. The flow
  // asks for one whenever it asks for a target, so this is a guard rather than
  // a path: what it must not do is invent a timeline and then judge the person
  // against it.
  if (weeks === undefined) {
    return {
      verdict: "realistic",
      headline: "No timeline given, so there is no pace to judge.",
      detail:
        "A target weight on its own cannot be called fast or slow. What can be said is that the direction is achievable for almost everybody; how long it takes is the part that needs a date against it.",
      flags,
    }
  }

  if (intent.kind === "lose-fat") return assessFatLoss(profile, target, delta, weeks, bodyFatPct, flags)

  const trainingAge = intent.trainingAge
  if (trainingAge === undefined) {
    return {
      verdict: "realistic",
      headline: "How fast muscle arrives depends on how long you have trained.",
      detail:
        "That was not given, and the rate model is worthless without it. A beginner and someone three years in are told very different things about the same target, so the honest answer here is that this one cannot be paced.",
      flags,
    }
  }
  return assessMuscleGain(profile, trainingAge, target, delta, weeks, bodyFatPct, flags)
}

function assessFatLoss(
  profile: Profile,
  target: number,
  delta: number,
  weeks: number,
  bodyFatPct: number,
  flags: Flag[],
): Assessment {
  if (delta >= 0) {
    return {
      verdict: "realistic",
      headline: "You have asked to lose fat without losing weight.",
      detail:
        "That is possible, and it has a name: recomposition. It is slow, it works best for beginners, and the scale is the wrong instrument to measure it with. Use the tape around your waist instead.",
      flags,
    }
  }

  const toLose = Math.abs(delta)
  const targetBmi = bmi(target, profile.heightCm)
  const ratePerWeek = toLose / weeks / profile.weightKg

  // A goal weight in genuinely unhealthy territory is not a pacing problem.
  if (targetBmi < 17.5) {
    return {
      verdict: "impossible",
      headline: "This is not a target we will help you reach.",
      detail: `A weight of ${round(target)}kg puts you at a BMI of ${round(targetBmi)}, which is below the healthy range for any adult. Please talk to a doctor before setting a weight goal. That is not a formality here, it is the whole answer.`,
      flags,
    }
  }

  const safeWeeks = Math.ceil(toLose / (FAT_LOSS_SAFE_MAX * profile.weightKg))

  if (ratePerWeek > FAT_LOSS_SAFE_MAX * 1.6) {
    return {
      verdict: "impossible",
      headline: `Losing ${round(toLose)}kg in ${weeks} weeks is not going to happen.`,
      detail: `That is ${round(ratePerWeek * 100, 2)}% of your bodyweight a week. Above about 1% you stop losing mostly fat and start losing muscle with it, which is why crash diets end with a smaller, softer version of the same body and a metabolism that fights back. The honest number is ${safeWeeks} weeks, about ${Math.round(safeWeeks / 4.345)} months.`,
      honestWeeks: safeWeeks,
      flags,
    }
  }

  if (ratePerWeek > FAT_LOSS_SAFE_MAX) {
    return {
      verdict: "too-fast",
      headline: `${round(toLose)}kg in ${weeks} weeks is faster than your body can do cleanly.`,
      detail: `At ${round(ratePerWeek * 100, 2)}% of bodyweight per week you are just past the line where muscle starts going with the fat. Give it ${safeWeeks} weeks instead and you keep the muscle, keep your strength, and keep the result.`,
      honestWeeks: safeWeeks,
      flags,
    }
  }

  if (ratePerWeek < FAT_LOSS_SAFE_MIN * 0.5 && bodyFatPct > (profile.sex === "male" ? 20 : 30)) {
    const briskWeeks = Math.ceil(toLose / (FAT_LOSS_SAFE_MIN * profile.weightKg))
    return {
      verdict: "too-slow",
      headline: "You are being more cautious than you need to be.",
      detail: `Losing ${round(toLose)}kg over ${weeks} weeks is well within what your body can do. At a still-comfortable pace you would be there in about ${briskWeeks} weeks. Stretching it over ${weeks} means a much longer stretch of being careful, and that is usually where people give up. Aiming low is its own way of failing.`,
      honestWeeks: briskWeeks,
      flags,
    }
  }

  return {
    verdict: "realistic",
    headline: `${round(toLose)}kg in ${weeks} weeks is a good target.`,
    detail: `That works out to ${round(ratePerWeek * 100, 2)}% of your bodyweight a week, inside the range where the weight you lose is mostly fat and the muscle stays. Expect the mirror to lag the scale by a few weeks. Belly fat is usually the last to move, and no amount of core work speeds that up, because fat is not lost from the place you train.`,
    flags,
  }
}

function assessMuscleGain(
  profile: Profile,
  trainingAge: TrainingAge,
  target: number,
  delta: number,
  weeks: number,
  bodyFatPct: number,
  flags: Flag[],
): Assessment {
  if (delta <= 0) {
    return {
      verdict: "realistic",
      headline: "You want to build muscle without gaining weight.",
      detail:
        "That is recomposition. It is real, it is slow, and it works best if you are new to training or carrying some extra fat. Judge it by the tape and by what you can lift, not by the scale.",
      flags,
    }
  }

  const lean = leanMassKg(profile.weightKg, bodyFatPct)
  // Assume roughly 60% of gained weight is lean in a controlled surplus.
  const projectedLean = lean + delta * 0.6
  const projectedFfmi = ffmi(projectedLean, profile.heightCm)
  const ceiling = ffmiCeiling(profile.sex)

  if (projectedFfmi > ceiling + 1.5) {
    return {
      verdict: "impossible",
      headline: "This target is past what a natural body has been shown to reach.",
      detail: `Carrying ${round(target)}kg at your height would put your fat-free mass index near ${round(projectedFfmi)}. Natural athletes cluster below about ${ceiling}. That figure comes from 74 men measured in 1995, so treat it as a signpost rather than a wall, but a goal set beyond it is usually a goal set by photographs of people who were not natural.`,
      flags,
    }
  }

  const leanNeeded = delta * 0.6
  const perWeek = gainPerWeek(profile.weightKg, trainingAge, profile.sex)
  const honestWeeks = Math.ceil(leanNeeded / perWeek)
  const perMonth = round(perWeek * 4.345, 2)

  if (honestWeeks > weeks * 1.5) {
    return {
      verdict: "impossible",
      headline: `${round(delta)}kg in ${weeks} weeks is not how fast muscle arrives.`,
      detail: `At your training experience a good month adds around ${perMonth}kg of lean mass, and that rate roughly halves with every year you train. Reaching this properly takes about ${honestWeeks} weeks, near ${Math.round(honestWeeks / 4.345)} months. You can hit the scale number faster by eating more, but most of what you add will be fat, and you will spend the following year losing it again.`,
      honestWeeks,
      flags,
    }
  }

  if (honestWeeks > weeks) {
    return {
      verdict: "too-fast",
      headline: `${round(delta)}kg in ${weeks} weeks is a little ahead of your body.`,
      detail: `A good month adds around ${perMonth}kg of lean mass at your stage. Give this ${honestWeeks} weeks and more of the weight you gain will be muscle rather than fat, which is the entire point of doing it slowly.`,
      honestWeeks,
      flags,
    }
  }

  if (honestWeeks * 2.5 < weeks) {
    return {
      verdict: "too-slow",
      headline: "You could aim higher than this.",
      detail: `${round(delta)}kg over ${weeks} weeks is far below what your body can do in that time. At around ${perMonth}kg of lean mass in a good month you would be there in roughly ${honestWeeks} weeks. Beginners get the fastest gains they will ever get, and that window does not stay open. Spending it on a target this modest is a real cost.`,
      honestWeeks,
      flags,
    }
  }

  return {
    verdict: "realistic",
    headline: `${round(delta)}kg in ${weeks} weeks is a fair target.`,
    detail: `At your stage a good month adds around ${perMonth}kg of lean mass. Some of what you gain will be fat, and that is normal. Judge this by the tape and by what you can lift, not by the scale alone.`,
    flags,
  }
}

/**
 * Problems with the plan rather than with the goal.
 *
 * Every branch here is guarded on the field being present. The onboarding no
 * longer asks how hard the sets will be or how many days a week a person will
 * train, so those warnings simply do not appear rather than appearing off the
 * back of a default nobody chose.
 */
export function planFlags(intent: Intent): Flag[] {
  const flags: Flag[] = []

  if (intent.effort === "comfortable") {
    flags.push({
      severity: "warn",
      title: "Comfortable sets are the most common reason nothing happens",
      body: "A set that stops five or more reps before you would fail produces very little growth. This is the single biggest difference between people who train for a year and change, and people who train for a year and do not. The last two or three reps are the ones that count. Everything before them is the entry fee.",
    })
  }

  if (intent.daysPerWeek !== undefined && intent.daysPerWeek <= 2 && intent.kind !== "stay-healthy") {
    flags.push({
      severity: "warn",
      title: `${intent.daysPerWeek} ${intent.daysPerWeek === 1 ? "day" : "days"} a week is below the useful threshold`,
      body: "Around ten hard sets per muscle per week is roughly where growth becomes reliable. Two sessions can carry that if every session is full-body and the sets are hard. One cannot. If two days is what your life allows, train full body both days and accept a slower result honestly, rather than expecting a fast one.",
    })
  }

  if (intent.daysPerWeek !== undefined && intent.daysPerWeek >= 6 && intent.trainingAge === "none") {
    flags.push({
      severity: "note",
      title: "Six days a week is more than a beginner needs",
      body: "Three or four hard sessions will give a new trainee nearly everything six will, and the plan you keep beats the plan you abandon in week five. Ambition is better spent on how hard each set is than on how many days you show up.",
    })
  }

  if (intent.weeks !== undefined && intent.weeks < 8 && intent.kind !== "stay-healthy") {
    flags.push({
      severity: "note",
      title: "Under eight weeks is shorter than visible change takes",
      body: "You will feel stronger in two to four weeks, which is real and worth having. Seeing a different shape in the mirror usually takes eight to twelve weeks, and other people noticing takes twelve to sixteen.",
    })
  }

  return flags
}
