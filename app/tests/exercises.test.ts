import { strict as assert } from "node:assert"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  MUSCLES,
  equipmentFor,
  fullBodyFoundation,
  gapFor,
  pickExercises,
} from "../src/data/exercises.ts"
import type { Place } from "../src/data/exercises.ts"

const PLACES: Place[] = ["home-gym", "commercial-gym"]

describe("training environments", () => {
  it("maps the home gym to the defined minimum-kit tags", () => {
    assert.deepEqual(
      [...equipmentFor("home-gym")].sort(),
      ["none", "band", "bar", "dumbbell", "bench"].sort(),
    )
  })

  it("maps the commercial gym to every existing equipment tag", () => {
    assert.deepEqual(
      [...equipmentFor("commercial-gym")].sort(),
      ["none", "band", "bar", "dumbbell", "barbell", "machine", "bench"].sort(),
    )
  })

  it("filters every ranked pick to equipment available in that environment", () => {
    for (const place of PLACES) {
      const allowed = equipmentFor(place)
      for (const muscle of MUSCLES) {
        for (const exercise of pickExercises(muscle.id, place)) {
          assert.equal(exercise.muscle, muscle.id)
          assert.equal(allowed.includes(exercise.equipment), true)
        }
      }
    }
  })

  it("does not present zero equipment as an equivalent training environment", () => {
    assert.match(gapFor("home-gym") ?? "", /adjustable dumbbells/)
    assert.match(gapFor("home-gym") ?? "", /safe anchor/)
    assert.match(gapFor("home-gym") ?? "", /pull-up solution/)
    assert.equal(gapFor("commercial-gym"), null)
  })
})

describe("automatic full-body coverage", () => {
  it("includes every existing muscle group exactly once in both environments", () => {
    const expected = MUSCLES.map(({ id }) => id)

    for (const place of PLACES) {
      const foundation = fullBodyFoundation(place)
      const covered = foundation.map(({ muscle }) => muscle.id)
      assert.deepEqual(covered, expected)
      assert.equal(new Set(covered).size, MUSCLES.length)
      assert.equal(foundation.every(({ exercises }) => exercises.length > 0), true)
    }
  })

  it("keeps the goal anatomy display-only with no muscle-selection handler", () => {
    const goal = readFileSync(new URL("../src/steps/Goal.tsx", import.meta.url), "utf8")
    const anatomy = readFileSync(new URL("../src/components/MuscleScene.tsx", import.meta.url), "utf8")
    const result = readFileSync(new URL("../src/steps/Result.tsx", import.meta.url), "utf8")

    assert.match(goal, /Full-body movement foundation/)
    assert.doesNotMatch(goal, /focus|toggleMuscle|muscle-pick|Which parts|onToggle/)
    assert.doesNotMatch(anatomy, /onClick|onToggle|ThreeEvent/)
    assert.doesNotMatch(result, /e\.why/)
  })
})
