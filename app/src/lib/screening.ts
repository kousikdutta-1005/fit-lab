/**
 * Safety screening, run before any goal is assessed.
 *
 * Built on the PAR-Q+ framework and the 2015 ACSM screening revision. The 2015
 * revision matters: the old blanket "consult your physician before any exercise"
 * line referred so many people that it deterred exercise, and deterring exercise
 * costs more health than it saves. So this screens for the things that genuinely
 * warrant a doctor, and otherwise gets out of the way.
 *
 * This is not a diagnosis and it is not a clinical instrument.
 */

import type { Profile } from "./calc.ts"
import { bmi, round } from "./calc.ts"

export type HealthAnswers = {
  /** Chest pain at rest or on light activity. */
  chestPain: boolean
  /** Fainting or dizziness causing loss of balance in the last 12 months. */
  faintness: boolean
  /** A doctor has said to only do medically supervised activity. */
  supervisedOnly: boolean
  /** Diagnosed heart condition or high blood pressure. */
  heartOrBp: boolean
  /** Any other diagnosed chronic condition. */
  chronic: boolean
  /** Bone, joint or soft tissue problem that activity could worsen. */
  jointProblem: boolean
  /** Currently pregnant or within 12 weeks postpartum. */
  pregnant: boolean
  /** Conditions selected for tailoring. */
  conditions: ConditionId[]
  /** SCOFF answers, in the order given by SCOFF_QUESTIONS. */
  scoff: boolean[]
}

/**
 * SCOFF. Morgan JF, Reid F, Lacey JH. BMJ 1999;319(7223):1467-8.
 *
 * Two or more yes answers warrant a proper conversation with a clinician. This
 * is a screening prompt and not a diagnosis, and its published accuracy comes
 * from clinical settings, which is not where this runs.
 *
 * It is here because pointing appearance-focused body assessment at people aged
 * 18 to 30 without it would be careless. An eating disorder is the one thing
 * this product could actively make worse.
 */
export const SCOFF_QUESTIONS = [
  "Do you make yourself sick because you feel uncomfortably full?",
  "Do you worry you have lost control over how much you eat?",
  "Have you recently lost more than about 6kg in three months?",
  "Do you believe yourself to be fat when others say you are thin?",
  "Would you say that food dominates your life?",
]

export function scoffScore(answers: boolean[]): number {
  return answers.filter(Boolean).length
}

/**
 * Short tags shown beside the verbatim SCOFF wording, purely so five questions
 * can be scanned rather than read as a paragraph. The published question is
 * always displayed with its tag; nothing here replaces it. Changing the wording
 * of a validated instrument would change what it measures.
 */
export const SCOFF_TAGS = [
  "Making yourself sick",
  "Losing control",
  "Recent weight loss",
  "Thin or fat",
  "Food and your life",
]

/**
 * The readiness questions, each with a short label for scanning and the full
 * question underneath it. The semantics are the ones the PAR-Q+ framework and
 * the 2015 ACSM revision ask for, and the ids match HealthAnswers exactly, so
 * a card that is ticked is a yes and nothing else.
 */
export type ReadinessId =
  | "chestPain"
  | "faintness"
  | "supervisedOnly"
  | "heartOrBp"
  | "chronic"
  | "jointProblem"
  | "pregnant"

export const READINESS: {
  id: ReadinessId
  short: string
  question: string
  /** Only asked where it can apply. */
  femaleOnly?: boolean
  /** Selecting this opens the condition list, which tailors the advice. */
  opensConditions?: boolean
}[] = [
  {
    id: "chestPain",
    short: "Chest pain",
    question: "At rest, or during light everyday activity.",
  },
  {
    id: "faintness",
    short: "Dizziness or fainting",
    question: "In the last 12 months, lost your balance from dizziness or lost consciousness.",
  },
  {
    id: "supervisedOnly",
    short: "Told to train supervised",
    question: "A doctor has said you should only exercise under medical supervision.",
  },
  {
    id: "heartOrBp",
    short: "Heart or blood pressure",
    question: "A doctor has diagnosed a heart condition or high blood pressure.",
    opensConditions: true,
  },
  {
    id: "chronic",
    short: "Long-term condition",
    question: "Any other long-term diagnosed condition.",
    opensConditions: true,
  },
  {
    id: "jointProblem",
    short: "Bone, joint or muscle",
    question: "A problem that could get worse with activity.",
  },
  {
    id: "pregnant",
    short: "Pregnant or postpartum",
    question: "Currently pregnant, or within twelve weeks of giving birth.",
    femaleOnly: true,
  },
]

export function readinessItems(sex: "male" | "female") {
  return READINESS.filter((item) => !item.femaleOnly || sex === "female")
}

export type ConditionId =
  | "type-2-diabetes"
  | "hypertension"
  | "pcos"
  | "hypothyroid"
  | "knee-pain"
  | "back-pain"
  | "asthma"

export const CONDITIONS: { id: ConditionId; label: string }[] = [
  { id: "type-2-diabetes", label: "Type 2 diabetes" },
  { id: "hypertension", label: "High blood pressure" },
  { id: "pcos", label: "PCOS" },
  { id: "hypothyroid", label: "Hypothyroidism" },
  { id: "knee-pain", label: "Knee pain or arthritis" },
  { id: "back-pain", label: "Low back pain" },
  { id: "asthma", label: "Asthma" },
]

export type Screen =
  | { kind: "stop"; title: string; body: string; reasons: string[] }
  | { kind: "caution"; title: string; body: string; notes: Note[] }
  | { kind: "clear"; title: string; body: string; notes: Note[] }

export type Note = { title: string; body: string }

export function screen(profile: Profile, answers: HealthAnswers): Screen {
  const reasons: string[] = []

  if (answers.chestPain)
    reasons.push("Chest pain at rest or during light activity needs to be looked at before you train, not after.")
  if (answers.faintness)
    reasons.push("Losing balance from dizziness, or losing consciousness, in the last year.")
  if (answers.supervisedOnly)
    reasons.push("A doctor has already told you to only do supervised activity.")

  const value = bmi(profile.weightKg, profile.heightCm)
  if (value < 16.5)
    reasons.push(
      `A BMI of ${round(value)} is in the severely underweight range, where training advice is the wrong tool and medical advice is the right one.`,
    )

  if (profile.age < 16)
    reasons.push("Under-16s should get training guidance from a doctor or a qualified coach who can see them in person.")

  if (reasons.length > 0) {
    return {
      kind: "stop",
      title: "We are going to stop here.",
      body: "This is the one place fit-lab will not hand you a plan. Not as a formality, and not to protect ourselves. These are the specific things that should be checked by a doctor before you start training, and a website cannot check them.",
      reasons,
    }
  }

  // Disordered eating is handled separately from cardiac risk, because the
  // right response is different: not "get cleared", but "this product is the
  // wrong tool for you right now".
  const scoff = scoffScore(answers.scoff)
  if (scoff >= 2) {
    return {
      kind: "stop",
      title: "We are not going to give you a body assessment.",
      body: "Some of your answers match a screening questionnaire used to pick up disordered eating. It is a prompt, not a diagnosis, and a website cannot tell the difference. But a product that hands you a body fat estimate and a target weight is capable of making this worse, so it is not going to.",
      reasons: [
        "Please talk to a doctor, a psychologist, or someone you trust about your eating. That is a more useful next step than any number this page could give you.",
        "None of this means anything is wrong with you or your body. It means a form on a website is the wrong instrument for the question.",
      ],
    }
  }

  const notes = conditionNotes(answers)

  if (scoff === 1) {
    notes.unshift({
      title: "One thing worth sitting with",
      body: "One of your answers touched on a difficult relationship with food. That on its own means very little, and most people who answer yes to one are fine. It is worth noticing rather than acting on. If more than one of those questions had felt true, it would be worth talking to someone.",
    })
  }

  if (answers.pregnant) {
    notes.unshift({
      title: "Pregnant or recently postpartum",
      body: "Exercise during an uncomplicated pregnancy is recommended, not merely allowed, and the WHO asks for the same 150 minutes a week. But the exceptions are specific and only your doctor knows which apply to you. Take this assessment to them rather than acting on it alone.",
    })
  }

  if (answers.heartOrBp || answers.chronic || answers.jointProblem || answers.pregnant) {
    return {
      kind: "caution",
      title: "You can train. Read these first.",
      body: "Nothing here stops you, and being told to sit still would be worse for you than training sensibly. But some of what follows should be adjusted, and one conversation with your doctor is worth more than anything on this page.",
      notes,
    }
  }

  return {
    kind: "clear",
    title: "Nothing here needs a doctor first.",
    body: "You answered no to everything that would warrant medical clearance under the current screening guidance. You can start. The old advice to check with a doctor before any exercise at all is not what the evidence supports, and it keeps more people on the sofa than it keeps safe.",
    notes,
  }
}

function conditionNotes(answers: HealthAnswers): Note[] {
  const out: Note[] = []
  const has = (c: ConditionId) => answers.conditions.includes(c)

  if (has("type-2-diabetes"))
    out.push({
      title: "Type 2 diabetes",
      body: "Resistance training and walking each improve blood sugar control on their own, and together they do more than either alone. Two things to know: check your glucose before you train, and if you take insulin or a sulfonylurea, carry something sweet. If you have been told you have eye changes from diabetes, ask your doctor before doing anything heavy or straining.",
    })

  if (has("hypertension"))
    out.push({
      title: "High blood pressure",
      body: "Training lowers blood pressure over time, so this is a reason to train rather than a reason not to. Breathe out as you push and avoid holding your breath under a heavy weight, which spikes pressure sharply. If your readings are very high and not yet controlled, get them controlled first.",
    })

  if (has("pcos"))
    out.push({
      title: "PCOS",
      body: "Resistance training improves insulin sensitivity, which is the mechanism that matters most in PCOS. Weight loss is often slower than the calculators suggest and that is the condition, not a failure of discipline. Strength gains are a better measure of progress here than the scale.",
    })

  if (has("hypothyroid"))
    out.push({
      title: "Hypothyroidism",
      body: "If your thyroid is treated and stable, train normally. If it is not yet stable, fatigue and slow progress are the condition talking, and no training plan will out-argue it.",
    })

  if (has("knee-pain"))
    out.push({
      title: "Knee pain",
      body: "Legs still need training, and stronger legs usually mean less knee pain, not more. Work in the range that does not hurt and widen it as it improves. Sitting still is the option that makes this worse.",
    })

  if (has("back-pain"))
    out.push({
      title: "Low back pain",
      body: "Most back pain improves with movement and gets worse with rest. Start light, keep the load close to your body, and build up. If pain runs down your leg, or you have numbness or weakness, that is a doctor's question first.",
    })

  if (has("asthma"))
    out.push({
      title: "Asthma",
      body: "Keep your reliever inhaler with you, warm up for longer than feels necessary, and be careful with cold or polluted air. On days when the air quality is bad, train indoors.",
    })

  return out
}
