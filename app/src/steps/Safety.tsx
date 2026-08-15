import { Help, Glyph, TapCard } from "../components/controls"
import { useState } from "react"
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
  const [page, setPage] = useState<"health" | "food">("health")
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

  const pageDone = page === "health" ? groupAnswered(readinessGroup) : groupAnswered(foodGroup)
  const waiting = pageDone ? null : `Answer the ${page} group to continue`

  return (
    <Stage
      nodes={nodes}
      current="safety"
      onBack={page === "health" ? onBack : () => setPage("health")}
      onNext={page === "health" ? () => setPage("food") : onNext}
      nextDisabled={!pageDone || (page === "food" && !done)}
      nextLabel={page === "health" ? "Continue to food" : "Continue to goal"}
      waiting={waiting}
      substepLabel={`Safety ${page === "health" ? "1" : "2"} of 2 · ${page === "health" ? "Health" : "Food"}`}
    >
      {page === "health" ? (
        <>
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
          <Help title="Why we ask about health">
            <p>
              This is the PAR-Q+ framework with the 2015 ACSM revision. The old blanket
              &ldquo;see a doctor before any exercise&rdquo; line referred so many people that it deterred
              exercise. Most people tick nothing and carry straight on.
            </p>
            <p>Nothing here is stored or sent anywhere. Screening is not a diagnosis.</p>
          </Help>
        </>
      ) : (
        <>
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
          <Help title="Why we ask about food">
            <p>
              This is SCOFF (Morgan, Reid &amp; Lacey, <em>BMJ</em> 1999). A product that shows a
              body-fat estimate and target weight can do real damage to the wrong person, so this gate comes
              before any goal.
            </p>
            <p>
              Its published accuracy comes from clinical settings, not this one. It is a prompt, never a
              diagnosis, and nothing is stored or sent.
            </p>
          </Help>
        </>
      )}
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
