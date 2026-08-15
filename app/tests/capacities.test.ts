import { strict as assert } from "node:assert"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import { CAPACITIES, EMPHASES, EMPHASIS_SLOT_CAP, REQUIRED_CAPACITIES, capacityById } from "../src/data/capacities.ts"
import type { CapacityId } from "../src/data/capacities.ts"

describe("the required-capacity universal foundation", () => {
  it("covers every movement demand the product spec names, exactly once each", () => {
    const required = new Set(REQUIRED_CAPACITIES)
    const expected: CapacityId[] = [
      "aerobic_base",
      "knee_extension", // squat
      "hip_hinge",
      "knee_flexion",
      "horizontal_push",
      "vertical_push",
      "horizontal_pull",
      "vertical_pull",
      "calf_soleus",
      "hip_ab_ad",
      "scapular_cuff",
      "grip_carry",
      "trunk_control",
      "elbow_flexion",
      "elbow_extension",
      "lumbar_extension",
    ]
    for (const capacity of expected) {
      assert.equal(required.has(capacity), true, `required capacity list is missing "${capacity}"`)
    }
    assert.equal(REQUIRED_CAPACITIES.length, new Set(REQUIRED_CAPACITIES).size)
  })

  it("keeps balance, mobility and floor_transfer as conditional/always-on additions, not required baseline slots", () => {
    assert.equal(REQUIRED_CAPACITIES.includes("balance"), false)
    assert.equal(REQUIRED_CAPACITIES.includes("mobility"), false)
    assert.equal(REQUIRED_CAPACITIES.includes("floor_transfer"), false)
    assert.equal(capacityById("balance").group, "conditional")
    assert.equal(capacityById("mobility").group, "conditional")
    assert.equal(capacityById("floor_transfer").group, "conditional")
  })

  it("resolves capacityById for a known id and throws for an unknown one", () => {
    assert.equal(capacityById("aerobic_base").label, "Aerobic base")
    assert.throws(() => capacityById("not-a-real-id" as never))
  })

  it("never maps an abstract capacity to a fake anatomy region", () => {
    const abstractIds: CapacityId[] = [
      "aerobic_base",
      "balance",
      "mobility",
      "floor_transfer",
      "run_progression",
      "run_strides",
      "boxing_grip_forearm",
      "boxing_conditioning",
      "outdoors_loaded_carry_walk",
      "outdoors_trip_prep",
      "outdoors_stair_intervals",
      "yoga_session",
      "neck_isometric",
      "dorsiflexion",
    ]
    for (const c of CAPACITIES) {
      if (abstractIds.includes(c.id)) {
        assert.equal(c.anatomy, null)
      }
    }
  })
})

describe("the optional post-result emphasis", () => {
  it("offers exactly the six approved chips: general, running, boxing, outdoors, yoga, calisthenics", () => {
    assert.deepEqual(
      EMPHASES.map((e) => e.id).sort(),
      ["boxing", "calisthenics", "general", "outdoors", "running", "yoga"],
    )
  })

  it("keeps 'general' as the untouched, inference-free default with no extra capacities of its own", () => {
    const general = EMPHASES.find((e) => e.id === "general")
    assert.match(general?.plain ?? "", /no extra inference/i)
  })

  it("declares the emphasis slot cap at 3, matching the product's 'at most three' rule", () => {
    assert.equal(EMPHASIS_SLOT_CAP, 3)
  })
})

describe("no new required onboarding fields were introduced for emphasis or the evidence layer", () => {
  it("flow.ts's required-field logic never references emphasis, capacity, dose, guide or environment ceilings", () => {
    const flow = readFileSync(new URL("../src/lib/flow.ts", import.meta.url), "utf8")
    assert.doesNotMatch(flow, /emphasis|capacity|CapacityId|doseForSlot|guideId/i)
  })

  it("the emphasis chip is client-local UI state, not a flow/screening input", () => {
    const screening = readFileSync(new URL("../src/lib/screening.ts", import.meta.url), "utf8")
    assert.doesNotMatch(screening, /emphasis/i)
  })
})
