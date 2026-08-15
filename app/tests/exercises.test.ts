import { strict as assert } from "node:assert"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import { EXERCISES, MUSCLES, SHIPPABLE_EXERCISES, exerciseById } from "../src/data/exercises.ts"
import type { Place } from "../src/data/exercises.ts"
import { CAPACITIES, REQUIRED_CAPACITIES } from "../src/data/capacities.ts"

const PLACES: Place[] = ["home-gym", "commercial-gym"]

describe("the anatomy display surface stays byte-compatible", () => {
  it("keeps exactly the 10 existing muscle-display ids the anatomy validator and 3D scene depend on", () => {
    const ids = MUSCLES.map((m) => m.id).sort()
    assert.deepEqual(ids, [
      "back",
      "biceps",
      "calves",
      "chest",
      "core",
      "glutes",
      "hamstrings",
      "quads",
      "shoulders",
      "triceps",
    ])
  })

  it("has renderable anatomy for every recommendation group", () => {
    const output = execFileSync(process.execPath, ["scripts/validate-anatomy-coverage.mjs"], { encoding: "utf8" })
    for (const { id } of MUSCLES) assert.match(output, new RegExp(`${id} \\([1-9][0-9]*\\)`))
    assert.match(output, /core \(4\)/)
  })

  it("keeps the goal anatomy display-only with no muscle-selection handler", () => {
    const goal = readFileSync(new URL("../src/steps/Goal.tsx", import.meta.url), "utf8")
    const anatomy = readFileSync(new URL("../src/components/MuscleScene.tsx", import.meta.url), "utf8")
    assert.match(goal, /Full-body movement foundation/)
    assert.doesNotMatch(goal, /focus|toggleMuscle|muscle-pick|Which parts|onToggle/)
    assert.doesNotMatch(anatomy, /onClick|onToggle|ThreeEvent/)
  })

  it("maps every concrete (non-abstract) required capacity onto a real muscle-display id", () => {
    const muscleIds = new Set(MUSCLES.map((m) => m.id))
    for (const capacity of CAPACITIES) {
      if (capacity.anatomy === null) continue // abstract capacities intentionally render no anatomy
      assert.equal(muscleIds.has(capacity.anatomy), true, `capacity "${capacity.id}" maps to unknown muscle "${capacity.anatomy}"`)
    }
  })

  it("never forces an abstract capacity (aerobic/balance/mobility) onto a fake muscle mapping", () => {
    const abstractIds = ["aerobic_base", "balance", "mobility"]
    for (const id of abstractIds) {
      const c = CAPACITIES.find((x) => x.id === id)
      assert.equal(c?.anatomy, null)
    }
  })
})

describe("the exercise catalogue", () => {
  it("has no duplicate exercise ids", () => {
    const ids = EXERCISES.map((e) => e.id)
    assert.equal(new Set(ids).size, ids.length)
  })

  it("covers every required capacity in both environments with at least one shippable exercise", () => {
    for (const place of PLACES) {
      for (const capacity of REQUIRED_CAPACITIES) {
        const pool = SHIPPABLE_EXERCISES.filter((e) => e.capacity === capacity && e.environments.includes(place))
        assert.equal(pool.length > 0, true, `no shippable ${place} exercise covers required capacity "${capacity}"`)
      }
    }
  })

  it("only ever assigns exercises to environments the Place type actually has", () => {
    for (const e of EXERCISES) {
      for (const env of e.environments) assert.equal(PLACES.includes(env), true)
    }
  })

  it("quarantines every exercise with no valid guide, and ships nothing quarantined", () => {
    for (const e of EXERCISES) {
      if (e.quarantined) {
        assert.equal(SHIPPABLE_EXERCISES.includes(e), false)
        assert.equal(e.guideId, "")
      } else {
        assert.notEqual(e.guideId, "")
      }
    }
  })

  it("resolves exerciseById for a known id and returns undefined for an unknown one", () => {
    assert.equal(exerciseById("aerobic-base")?.name, "Brisk walking, jogging or cycling")
    assert.equal(exerciseById("does-not-exist"), undefined)
  })
})
