import { useEffect, useMemo, useState } from "react"
import { Check, ExternalLink as ExternalLinkIcon } from "lucide-react"
import type { FoundationSlot } from "../lib/foundation"
import type { Dose } from "../lib/dose"
import type { ScheduleItem, WeeklySchedule } from "../lib/schedule"
import { checklistDateKey, loadCompleted, saveCompleted, toggleCompleted } from "../lib/checklist"
import { guideById } from "../data/evidence"
import { ExternalLink } from "./ui"
import { ValueChip } from "./viz"

function itemId(dayNumber: number, item: ScheduleItem): string {
  return `${dayNumber}:${item.exerciseId}:${item.kind}`
}

function itemDose(item: ScheduleItem, dose: Dose): string {
  if (dose.kind === "aerobic") {
    const minutes = item.aerobicMinutes ?? dose.minutesPerWeek
    return `${minutes[0]}–${minutes[1]} min`
  }
  if (dose.kind === "interval") {
    return `${dose.rounds[0]}–${dose.rounds[1]} rounds · ${dose.workSeconds[0]}–${dose.workSeconds[1]}s work`
  }
  if (dose.kind === "referral") return "Referral only"
  const sets = item.scheduledSets ?? dose.sets
  return `${sets} sets × ${dose.repsLow}–${dose.repsHigh} reps · ${dose.rir[0]}–${dose.rir[1]} RIR · ${dose.restSeconds[0]}–${dose.restSeconds[1]}s rest`
}

export function WeeklyChecklist({
  schedule,
  slots,
  doses,
}: {
  schedule: WeeklySchedule
  slots: FoundationSlot[]
  doses: Dose[]
}) {
  const validIdsKey = schedule.days
    .flatMap((day) => day.items.map((item) => itemId(day.dayNumber, item)))
    .sort()
    .join("|")
  const validIds = useMemo(() => new Set(validIdsKey ? validIdsKey.split("|") : []), [validIdsKey])
  const [storageKey, setStorageKey] = useState(() => checklistDateKey(new Date()))
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  useEffect(() => {
    function refreshDateKey() {
      if (document.visibilityState === "visible") setStorageKey(checklistDateKey(new Date()))
    }
    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const timer = window.setTimeout(() => setStorageKey(checklistDateKey(new Date())), nextMidnight.getTime() - now.getTime() + 100)
    document.addEventListener("visibilitychange", refreshDateKey)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", refreshDateKey)
    }
  }, [storageKey])

  useEffect(() => {
    try {
      setCompleted(loadCompleted(window.localStorage, storageKey, validIds))
    } catch (error) {
      console.warn("Could not restore today's workout checklist; using in-memory state.", error)
      setCompleted(new Set())
    }
  }, [storageKey, validIds])

  function toggle(id: string) {
    setCompleted((current) => {
      const next = toggleCompleted(current, id)
      try {
        saveCompleted(window.localStorage, storageKey, next)
      } catch (error) {
        console.warn("Could not persist today's workout checklist; keeping it in memory.", error)
      }
      return next
    })
  }

  return (
    <div className="workout-week">
      {schedule.days.map((day) => (
        <section key={day.dayNumber} className={`card workout-day workout-day-${day.kind}`}>
          <div className="workout-day-head">
            <h3 className="workout-day-title">Day {day.dayNumber} — {day.label}</h3>
            {day.kind !== "rest" && (
              <ValueChip label="~min" value={`${day.estimatedMinutes[0]}–${day.estimatedMinutes[1]}`} />
            )}
          </div>
          {day.kind === "rest" ? (
            <p className="workout-rest">No assigned work.</p>
          ) : (
            <ul className="workout-items">
              {day.items.map((item) => {
                const slot = slots[item.slotIndex]
                const dose = doses[item.slotIndex]
                const guide = guideById(slot.exercise.guideId)
                const id = itemId(day.dayNumber, item)
                const checked = completed.has(id)
                return (
                  <li key={id} className={checked ? "workout-item workout-item-done" : "workout-item"}>
                    <label className="workout-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(id)}
                        aria-label={`Mark ${slot.exercise.name} complete for Day ${day.dayNumber}`}
                      />
                      <span className="workout-check-box" aria-hidden="true">
                        {checked && <Check size={15} />}
                      </span>
                      <span className="workout-item-copy">
                        <span className="workout-item-name">{slot.exercise.name}</span>
                        <span className="workout-item-dose">{itemDose(item, dose)}</span>
                      </span>
                    </label>
                    {guide && (
                      <ExternalLink
                        href={guide.url}
                        label={`How to do ${slot.exercise.name}, Tier ${slot.exercise.tier}: ${guide.title} — ${guide.provider}, opens in a new tab`}
                      >
                        <ExternalLinkIcon size={15} aria-hidden="true" />
                        How to · {slot.exercise.tier}
                      </ExternalLink>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
