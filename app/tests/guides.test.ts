import { strict as assert } from "node:assert"
import { execFileSync } from "node:child_process"
import { describe, it } from "node:test"

import {
  danglingGuideReferences,
  duplicateIds,
  fallbackProblems,
  prohibitedUrlReasons,
  quarantineProblems,
} from "../scripts/lib/guide-checks.mjs"
import { EXERCISES, SHIPPABLE_EXERCISES } from "../src/data/exercises.ts"
import { GUIDES } from "../src/data/evidence.ts"

describe("guide validator rules, against small deterministic fixtures", () => {
  it("rejects a YouTube search-results URL", () => {
    assert.equal(prohibitedUrlReasons("https://www.youtube.com/results?search_query=squat").length > 0, true)
  })

  it("rejects a YouTube channel URL", () => {
    assert.equal(prohibitedUrlReasons("https://www.youtube.com/channel/UC12345").length > 0, true)
  })

  it("rejects a YouTube playlist URL", () => {
    assert.equal(prohibitedUrlReasons("https://www.youtube.com/playlist?list=PL12345").length > 0, true)
  })

  it("rejects a YouTube Shorts URL", () => {
    assert.equal(prohibitedUrlReasons("https://www.youtube.com/shorts/abc123").length > 0, true)
  })

  it("rejects an affiliate/sales link", () => {
    assert.equal(prohibitedUrlReasons("https://amzn.to/3xyz").length > 0, true)
  })

  it("rejects a plain http URL (guides require https)", () => {
    assert.equal(prohibitedUrlReasons("http://example.com/guide").length > 0, true)
  })

  it("accepts an exact YouTube watch URL", () => {
    assert.deepEqual(prohibitedUrlReasons("https://www.youtube.com/watch?v=abc123"), [])
  })

  it("accepts an exact institutional page URL", () => {
    assert.deepEqual(prohibitedUrlReasons("https://www.orthoinfo.org/recovery/knee-conditioning-program/"), [])
  })

  it("flags duplicate ids", () => {
    assert.deepEqual(duplicateIds([{ id: "a" }, { id: "b" }, { id: "a" }]), ["a"])
  })

  it("flags an exercise shipped with no guide and not quarantined", () => {
    const problems = quarantineProblems([{ id: "e1", guideId: "", quarantined: undefined }], [])
    assert.equal(problems.length, 1)
    assert.match(problems[0], /has no valid guide and is not quarantined/)
  })

  it("flags a stale quarantine (guide exists but exercise is still marked quarantined)", () => {
    const problems = quarantineProblems([{ id: "e1", guideId: "g1", quarantined: { reason: "stale" } }], ["g1"])
    assert.equal(problems.length, 1)
    assert.match(problems[0], /also has a resolvable guide/)
  })

  it("passes a properly quarantined exercise and a properly shipped one", () => {
    const problems = quarantineProblems(
      [
        { id: "e1", guideId: "", quarantined: { reason: "no guide" } },
        { id: "e2", guideId: "g1", quarantined: undefined },
      ],
      ["g1"],
    )
    assert.deepEqual(problems, [])
  })

  it("flags a dangling guideId reference", () => {
    const problems = danglingGuideReferences([{ id: "e1", guideId: "g-missing", quarantined: undefined }], ["g-real"])
    assert.equal(problems.length, 1)
    assert.match(problems[0], /dangling guideId/)
  })

  it("flags a dangling referralGuideId reference", () => {
    const problems = danglingGuideReferences(
      [{ id: "e1", guideId: "g-real", referralGuideIds: ["g-missing"], quarantined: undefined }],
      ["g-real"],
    )
    assert.equal(problems.length, 1)
    assert.match(problems[0], /dangling referralGuideId/)
  })

  it("flags a fallbackGuideId that points at itself", () => {
    const problems = fallbackProblems([{ id: "g1", fallbackGuideId: "g1" }])
    assert.equal(problems.length, 1)
    assert.match(problems[0], /own fallback/)
  })

  it("flags a dangling fallbackGuideId", () => {
    const problems = fallbackProblems([{ id: "g1", fallbackGuideId: "g-missing" }])
    assert.equal(problems.length, 1)
    assert.match(problems[0], /dangling fallbackGuideId/)
  })
})

describe("the real guide registry passes every rule (integration)", () => {
  it("has no duplicate guide or exercise ids", () => {
    assert.deepEqual(duplicateIds(GUIDES), [])
    assert.deepEqual(duplicateIds(EXERCISES), [])
  })

  it("has no dangling guide references from any exercise", () => {
    assert.deepEqual(danglingGuideReferences(EXERCISES, GUIDES.map((g) => g.id)), [])
  })

  it("quarantines exactly the exercises with no valid guide, and nothing else", () => {
    assert.deepEqual(quarantineProblems(EXERCISES, GUIDES.map((g) => g.id)), [])
  })

  it("has no self-referencing or dangling guide fallbacks", () => {
    assert.deepEqual(fallbackProblems(GUIDES), [])
  })

  it("uses no prohibited URL pattern for any shippable exercise's guide", () => {
    const guideById = new Map(GUIDES.map((g) => [g.id, g]))
    for (const e of SHIPPABLE_EXERCISES) {
      const guide = guideById.get(e.guideId)
      assert.ok(guide, `exercise "${e.id}" must resolve a guide`)
      assert.deepEqual(prohibitedUrlReasons(guide!.url), [], `guide "${guide!.id}" (${guide!.url})`)
    }
  })

  it("ships nothing that is quarantined", () => {
    for (const e of EXERCISES) {
      if (e.quarantined) assert.equal(SHIPPABLE_EXERCISES.some((s) => s.id === e.id), false)
    }
  })

  it("the offline validator script exits cleanly against the real registry", () => {
    const output = execFileSync(process.execPath, ["scripts/validate-guides.mjs"], { encoding: "utf8" })
    assert.match(output, /Guide registry OK \(offline\)/)
  })
})
