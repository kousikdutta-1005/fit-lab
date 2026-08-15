import { strict as assert } from "node:assert"
import { describe, it } from "node:test"
import { checklistDateKey, loadCompleted, saveCompleted, toggleCompleted } from "../src/lib/checklist.ts"

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe("workout checklist state", () => {
  it("uses a local-calendar date key so today's checks do not leak into another day", () => {
    assert.equal(checklistDateKey(new Date(2026, 7, 15, 23, 30)), "fitlab-workout-2026-08-15")
    assert.notEqual(checklistDateKey(new Date(2026, 7, 15)), checklistDateKey(new Date(2026, 7, 16)))
  })

  it("toggles one item without mutating the previous state", () => {
    const before = new Set(["day-1:squat"])
    const added = toggleCompleted(before, "day-1:row")
    assert.deepEqual([...before], ["day-1:squat"])
    assert.deepEqual([...added].sort(), ["day-1:row", "day-1:squat"])
    assert.deepEqual([...toggleCompleted(added, "day-1:squat")], ["day-1:row"])
  })

  it("persists and restores only IDs that still exist in the current schedule", () => {
    const storage = memoryStorage()
    saveCompleted(storage, "today", new Set(["day-1:squat", "stale"]))
    const restored = loadCompleted(storage, "today", new Set(["day-1:squat", "day-1:row"]))
    assert.deepEqual([...restored], ["day-1:squat"])
  })
})
