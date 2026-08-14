import { Help, Glyph, TapCard } from "../components/controls"
import type { ReactNode } from "react"
import { Stage } from "../components/Stage"
import type { Sex } from "../lib/calc"
import { groupAnswered, safetyComplete } from "../lib/flow"
import type { GroupState } from "../lib/flow"
import type { ConditionId, ReadinessId } from "../lib/screening"
import {
  CONDITIONS,
  SCOFF_QUESTIONS,
  SCOFF_TAGS,
  applicableConditions,
  pruneConditions,
  readinessItems,
} from "../lib/screening"
import type { StageNode } from "./nodes"
import type { GlyphName } from "../components/controls"

/**
 * Safety, before any goal. PRODUCT.md principle 7, and the one screen where
 * making things shorter is not allowed to make them weaker.
 *
 * So the questions are the same questions. What changed is that twelve stacked
 * Yes/No rows became two groups of tick-what-applies cards, which is how a
 * person actually reads a list like this: scanning for the one that is true
 * rather than answering twelve times.
 *
 * The important part is that not ticking anything is not an answer. Each group
 * has to be closed explicitly, either by ticking something or by saying none of
 * it applies, and until both are closed the flow does not move. An unanswered
 * screen silently recorded as "no" is exactly the failure this screen exists to
 * prevent.
 */

const READINESS_GLYPH: Record<ReadinessId, GlyphName> = {
  chestPain: "heart",
  faintness: "spiral",
  supervisedOnly: "clipboard",
  heartOrBp: "pulse",
  chronic: "clipboard",
  jointProblem: "joint",
  pregnant: "pregnant",
}

export function SafetyStage({
  nodes,
  sex,
  flags,
  onFlags,
  flagsNone,
  onFlagsNone,
  conditions,
  onConditions,
  scoff,
  onScoff,
  scoffNone,
  onScoffNone,
  onBack,
  onNext,
}: {
  nodes: StageNode[]
  /** Null cannot reach here in the flow, but the type says what is true. */
  sex: Sex | null
  flags: ReadinessId[]
  onFlags: (next: ReadinessId[]) => void
  flagsNone: boolean
  onFlagsNone: (next: boolean) => void
  conditions: ConditionId[]
  onConditions: (next: ConditionId[]) => void
  scoff: number[]
  onScoff: (next: number[]) => void
  scoffNone: boolean
  onScoffNone: (next: boolean) => void
  onBack: () => void
  onNext: () => void
}) {
  const items = readinessItems(sex)
  const readinessGroup: GroupState = { selected: flags.length, none: flagsNone }
  const foodGroup: GroupState = { selected: scoff.length, none: scoffNone }
  const done = safetyComplete(readinessGroup, foodGroup)

  // Only the conditions somebody has actually opened the door to. A bone or
  // joint problem opens knee and back; a long-term condition opens the medical
  // list; heart or blood pressure opens hypertension.
  const available = applicableConditions(flags)

  function toggleFlag(id: ReadinessId) {
    const next = flags.includes(id) ? flags.filter((x) => x !== id) : [...flags, id]
    onFlags(next)
    if (next.length > 0) onFlagsNone(false)
    // Taking back the answer that offered a condition takes the condition with
    // it, so a result page can never carry advice for something unticked.
    const kept = pruneConditions(conditions, next)
    if (kept.length !== conditions.length) onConditions(kept)
  }

  function toggleScoff(i: number) {
    const next = scoff.includes(i) ? scoff.filter((x) => x !== i) : [...scoff, i]
    onScoff(next)
    if (next.length > 0) onScoffNone(false)
  }

  const waiting = done
    ? null
    : !groupAnswered(readinessGroup)
      ? "Answer the health group to continue"
      : "Answer the food group to continue"

  return (
    <Stage
      nodes={nodes}
      current="safety"
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!done}
      waiting={waiting}
    >
      <Group
        title="Health"
        glyph="shield"
        answered={groupAnswered(readinessGroup)}
        prompt="Tap anything that applies."
      >
        {items.map((item) => (
          <TapCard
            key={item.id}
            on={flags.includes(item.id)}
            onToggle={() => toggleFlag(item.id)}
            title={item.short}
            detail={item.question}
            glyph={READINESS_GLYPH[item.id]}
          />
        ))}
        <TapCard
          on={flagsNone}
          tone="clear"
          title="None of these apply"
          onToggle={() => {
            const next = !flagsNone
            onFlagsNone(next)
            if (next) {
              onFlags([])
              onConditions([])
            }
          }}
        />
      </Group>

      {available.length > 0 && (
        <Group title="Which one" glyph="clipboard" answered={false} prompt="Optional. It changes the advice, not the answer.">
          {CONDITIONS.filter((c) => available.includes(c.id)).map((c) => (
            <TapCard
              key={c.id}
              on={conditions.includes(c.id)}
              onToggle={() =>
                onConditions(
                  conditions.includes(c.id)
                    ? conditions.filter((x) => x !== c.id)
                    : [...conditions, c.id],
                )
              }
              title={c.label}
            />
          ))}
        </Group>
      )}

      <Group
        title="Food"
        glyph="plate"
        answered={groupAnswered(foodGroup)}
        prompt="Tap anything that applies."
      >
        {SCOFF_QUESTIONS.map((q, i) => (
          <TapCard
            key={q}
            on={scoff.includes(i)}
            onToggle={() => toggleScoff(i)}
            title={SCOFF_TAGS[i]}
            detail={q}
          />
        ))}
        <TapCard
          on={scoffNone}
          tone="clear"
          title="None of these apply"
          onToggle={() => {
            const next = !scoffNone
            onScoffNone(next)
            if (next) onScoff([])
          }}
        />
      </Group>

      <Help title="Why we ask">
        <p>
          The health group is the PAR-Q+ framework with the 2015 ACSM revision. That revision matters: the
          old blanket &ldquo;see a doctor before any exercise&rdquo; line referred so many people that it
          deterred exercise, and deterring exercise costs more health than it saves. Most people tick
          nothing and carry straight on.
        </p>
        <p>
          The food group is SCOFF (Morgan, Reid &amp; Lacey, <em>BMJ</em> 1999). It is here because a
          product that hands you a body fat estimate and a target weight can do real damage to the wrong
          person, and it should at least ask. Its published accuracy comes from clinical settings, which is
          not where this runs, so it is a prompt and never a diagnosis.
        </p>
        <p>Neither group is stored or sent anywhere. Nothing here is a diagnosis.</p>
      </Help>
    </Stage>
  )
}

function Group({
  title,
  glyph,
  answered,
  prompt,
  children,
}: {
  title: string
  glyph: GlyphName
  answered: boolean
  prompt: string
  children: ReactNode
}) {
  return (
    <section className="group" aria-label={title}>
      <div className="group-head">
        <span className={answered ? "group-mark group-mark-on" : "group-mark"} aria-hidden="true">
          <Glyph name={answered ? "check" : glyph} size={14} />
        </span>
        <h2 className="group-title">{title}</h2>
        <span className="group-prompt">{prompt}</span>
      </div>
      <div className="group-cards">{children}</div>
    </section>
  )
}
