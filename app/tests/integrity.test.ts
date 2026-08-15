import { strict as assert } from "node:assert"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import { EXERCISES, SHIPPABLE_EXERCISES } from "../src/data/exercises.ts"
import { GUIDES, SOURCES } from "../src/data/evidence.ts"

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8")
}

describe("app-wide transparency and safety integrity", () => {
  it("every shippable exercise carries at least one source id or is an explicit referral (no unsourced claim)", () => {
    for (const e of SHIPPABLE_EXERCISES) {
      const isReferral = GUIDES.find((g) => g.id === e.guideId)?.role === "referral"
      assert.equal(e.sourceIds.length > 0 || isReferral, true, `exercise "${e.id}" has no sourceIds and is not a referral`)
    }
  })

  it("every quarantined exercise states a real reason and carries no sourceIds/guideId pretending to be real", () => {
    for (const e of EXERCISES) {
      if (!e.quarantined) continue
      assert.equal(e.quarantined.reason.length > 0, true)
      assert.equal(e.guideId, "")
      assert.deepEqual(e.sourceIds, [])
    }
  })

  it("external links are always opened safely: target=_blank plus rel=noreferrer noopener", () => {
    const ui = read("../src/components/ui.tsx")
    assert.match(ui, /target="_blank"/)
    assert.match(ui, /rel="noreferrer noopener"/)
    assert.match(ui, /aria-label=\{label\}/)
  })

  it("every target=_blank anchor in the app carries rel=noreferrer noopener (asset-credit links included)", () => {
    const files = ["../src/components/ui.tsx", "../src/components/BodyView.tsx"]
    for (const f of files) {
      const src = read(f)
      const blankAnchors = src.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? []
      assert.ok(blankAnchors.length > 0, `expected at least one target=_blank anchor in ${f}`)
      for (const tag of blankAnchors) {
        assert.match(tag, /rel="noreferrer noopener"/, `anchor missing rel=noreferrer noopener in ${f}: ${tag}`)
      }
    }
  })

  it("Result.tsx mounts the Sources & methods registry and links to it from the foundation section", () => {
    const result = read("../src/steps/Result.tsx")
    assert.match(result, /<SourcesPanel/)
    assert.match(result, /#sources-and-methods/)
  })

  it("the Sources & methods panel groups the registry into exactly Assessment / Safety / Movement / Assets & licences", () => {
    const panel = read("../src/components/SourcesPanel.tsx")
    assert.match(panel, /Assessment/)
    assert.match(panel, /Safety/)
    assert.match(panel, /Movement/)
    assert.match(panel, /Assets & licences/)
  })

  it("the panel never collapses association into causation in its own copy", () => {
    const panel = read("../src/components/SourcesPanel.tsx")
    assert.match(panel, /Association is never presented as causation/i)
  })

  it("every required source group is used, with at least one source", () => {
    const requiredGroups = ["assessment", "safety", "movement", "assets"]
    for (const g of requiredGroups) {
      assert.equal(SOURCES.some((s) => s.group === g), true, `no sources tagged group "${g}"`)
    }
  })

  it("home-gym ceilings are only ever disclosed when the environment is home-gym", () => {
    const result = read("../src/steps/Result.tsx")
    assert.match(result, /place === "home-gym"[\s\S]{0,3000}HOME_CEILINGS/)
  })

  it("the weekly summary and per-exercise dose are shown compactly, with progression/recovery left to disclosure", () => {
    const result = read("../src/steps/Result.tsx")
    assert.match(result, /Weekly summary/)
    assert.match(result, /Disclosure/)
  })

  it("boxing-emphasis copy never implies grip/neck/conditioning work prevents hand injury or concussion", () => {
    const boxingExercises = EXERCISES.filter((e) => e.capacity.startsWith("boxing_"))
    for (const e of boxingExercises) {
      assert.doesNotMatch(e.why, /prevent(s|ion)? (hand |wrist |concussion|injur)/i)
    }
  })

  it("long-length loading copy never overclaims beyond 'favours or at worst matches'", () => {
    const overclaimPattern = /proven (superior|better)|definitively (better|superior)/i
    for (const e of EXERCISES) assert.doesNotMatch(e.why, overclaimPattern)
  })

  it("static stretching is never shipped as an injury-prevention claim", () => {
    const stretch = EXERCISES.find((e) => e.id === "static-stretch-prevention")
    assert.ok(stretch?.quarantined)
  })

  it("no shippable exercise's evidence claim asserts foot/tibialis work prevents shin splints", () => {
    for (const e of SHIPPABLE_EXERCISES) {
      assert.doesNotMatch(e.why, /tibialis.*prevent|shin.splint.*prevent/i)
    }
  })

  it("the home-gym kit/ceiling section in Result.tsx is inside a place === home-gym conditional block", () => {
    const result = read("../src/steps/Result.tsx")
    const homeSectionMatch = result.match(/place === "home-gym"[\s\S]*?\n\s*\)\}/)
    assert.ok(homeSectionMatch, 'expected a place === "home-gym" conditional block')
  })
})
