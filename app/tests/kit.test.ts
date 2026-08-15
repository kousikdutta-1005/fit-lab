import { strict as assert } from "node:assert"
import { describe, it } from "node:test"

import { HOME_CEILINGS, HOME_KIT, kitById } from "../src/data/kit.ts"

describe("the generic, prioritized home-kit list", () => {
  it("is vendor-free and brand-free", () => {
    const bannedBrands = /nike|adidas|rogue|bowflex|peloton|amazon|decathlon/i
    for (const item of HOME_KIT) {
      assert.doesNotMatch(item.label, bannedBrands)
      assert.doesNotMatch(item.guidance, bannedBrands)
    }
  })

  it("carries no local/fragile pricing", () => {
    for (const item of HOME_KIT) {
      assert.doesNotMatch(item.guidance, /\u20B9|rs\.|inr|\$\d/i)
    }
  })

  it("has a unique, gapless priority order starting at 1", () => {
    const priorities = HOME_KIT.map((k) => k.priority).sort((a, b) => a - b)
    assert.deepEqual(
      priorities,
      HOME_KIT.map((_, i) => i + 1),
    )
  })

  it("puts adjustable dumbbells first, matching the broad 2.5-24kg novice guidance (not a universal dose)", () => {
    const first = HOME_KIT.find((k) => k.priority === 1)
    assert.match(first?.label ?? "", /dumbbell/i)
    assert.match(first?.guidance ?? "", /2\.5.*24kg/)
  })

  it("requires a purpose-built rated band anchor, never furniture", () => {
    const bandItem = HOME_KIT.find((k) => k.id === "kit-bands")
    assert.match(bandItem?.guidance ?? "", /rated/i)
    const allSafety = HOME_KIT.flatMap((k) => k.safety).join(" ")
    assert.match(allSafety, /never anchor to furniture|furniture/i)
  })

  it("never requires standing/jumping on an unrated bench", () => {
    const benchItem = HOME_KIT.find((k) => k.id === "kit-bench")
    const allSafety = benchItem?.safety.join(" ") ?? ""
    assert.match(allSafety, /never stand or jump/i)
  })

  it("does not force an expensive cardio machine when a safe outdoor option exists", () => {
    const conditioning = HOME_KIT.find((k) => k.id === "kit-conditioning")
    assert.match(conditioning?.guidance ?? "", /never required/i)
  })

  it("resolves kitById for a known id and returns undefined for an unknown one", () => {
    assert.equal(kitById("kit-dumbbells")?.priority, 1)
    assert.equal(kitById("does-not-exist"), undefined)
  })
})

describe("home-gym ceiling disclosures", () => {
  it("names a real, specific ceiling rather than a vague limitation for each entry", () => {
    for (const c of HOME_CEILINGS) {
      assert.equal(c.label.length > 0, true)
      assert.equal(c.reason.length > 10, true)
      assert.equal(c.sourceIds.length > 0, true)
    }
  })

  it("never papers over a ceiling by claiming a home alternative is fully equivalent", () => {
    for (const c of HOME_CEILINGS) {
      assert.doesNotMatch(c.reason, /fully equivalent|just as good|no difference/i)
    }
  })

  it("covers every documented ceiling category the product spec requires", () => {
    const ids = HOME_CEILINGS.map((c) => c.id)
    assert.equal(ids.includes("ceiling-maximal-bilateral-strength"), true)
    assert.equal(ids.includes("ceiling-hip-flexed-knee-flexion"), true)
    assert.equal(ids.includes("ceiling-heavy-soleus"), true)
    assert.equal(ids.includes("ceiling-isolated-lumbar-extension"), true)
    assert.equal(ids.includes("ceiling-unsafe-vertical-pull"), true)
    assert.equal(ids.includes("ceiling-bone-stimulus"), true)
  })
})
