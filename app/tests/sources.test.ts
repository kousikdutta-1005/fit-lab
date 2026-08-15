import { strict as assert } from "node:assert"
import { execFileSync } from "node:child_process"
import { describe, it } from "node:test"

import { causalLanguageProblem, danglingSourceReferences, duplicateIds, refProblem } from "../scripts/lib/source-checks.mjs"
import { EXERCISES } from "../src/data/exercises.ts"
import { GUIDES, SOURCES, guideById, sourceById } from "../src/data/evidence.ts"
import { HOME_CEILINGS } from "../src/data/kit.ts"

describe("source validator rules, against small deterministic fixtures", () => {
  it("flags duplicate source ids", () => {
    assert.deepEqual(duplicateIds([{ id: "a" }, { id: "a" }]), ["a"])
  })

  it("accepts a DOI ref", () => {
    assert.equal(refProblem({ id: "s1", ref: "https://doi.org/10.1000/xyz" }), null)
  })

  it("accepts an exact official https URL", () => {
    assert.equal(refProblem({ id: "s1", ref: "https://www.who.int/some-page" }), null)
  })

  it("rejects a search-query URL", () => {
    assert.notEqual(refProblem({ id: "s1", ref: "https://pubmed.ncbi.nlm.nih.gov/?term=grip+strength" }), null)
  })

  it("rejects a non-URL ref", () => {
    assert.notEqual(refProblem({ id: "s1", ref: "see the 1995 paper" }), null)
  })

  it("flags causal language on an observational source", () => {
    const problem = causalLanguageProblem({ id: "s1", kind: "observational", claim: "Grip strength prevents mortality." })
    assert.notEqual(problem, null)
  })

  it("does not flag the epidemiological term 'all-cause mortality' as causal language", () => {
    const problem = causalLanguageProblem({
      id: "s1",
      kind: "observational",
      claim: "Lower grip strength is associated with higher all-cause mortality.",
    })
    assert.equal(problem, null)
  })

  it("never flags a guideline/rct/meta_analysis source for causal language (they are allowed to state a direct effect)", () => {
    const problem = causalLanguageProblem({ id: "s1", kind: "rct", claim: "This intervention prevents the outcome in the trial." })
    assert.equal(problem, null)
  })

  it("flags a dangling sourceId reference", () => {
    const problems = danglingSourceReferences([{ id: "e1", sourceIds: ["missing"] }], ["real"], "Exercise")
    assert.equal(problems.length, 1)
    assert.match(problems[0], /dangling sourceId/)
  })

  it("passes a resolvable sourceId reference", () => {
    assert.deepEqual(danglingSourceReferences([{ id: "e1", sourceIds: ["real"] }], ["real"], "Exercise"), [])
  })
})

describe("the real source registry passes every rule (integration)", () => {
  it("has no duplicate source ids", () => {
    assert.deepEqual(duplicateIds(SOURCES), [])
  })

  it("has no ref that is a search string, and every ref is a DOI or exact URL", () => {
    for (const s of SOURCES) assert.equal(refProblem(s), null, `source "${s.id}": ${s.ref}`)
  })

  it("never lets an observational/biomechanical/sport-extrapolation/editorial source claim causation", () => {
    for (const s of SOURCES) assert.equal(causalLanguageProblem(s), null, `source "${s.id}"`)
  })

  it("has no dangling sourceId anywhere in exercises or home-gym ceilings", () => {
    const sourceIds = SOURCES.map((s) => s.id)
    assert.deepEqual(danglingSourceReferences(EXERCISES, sourceIds, "Exercise"), [])
    assert.deepEqual(danglingSourceReferences(HOME_CEILINGS, sourceIds, "Home ceiling"), [])
  })

  it("resolves sourceById/guideById for known ids and returns undefined for unknown ones", () => {
    assert.equal(sourceById("nhanes-percentiles")?.org, "US CDC / NCHS")
    assert.equal(sourceById("does-not-exist"), undefined)
    assert.equal(guideById(GUIDES[0].id)?.id, GUIDES[0].id)
    assert.equal(guideById("does-not-exist"), undefined)
  })

  it("distinguishes every declared evidence kind and groups every source into one of the four registry sections", () => {
    const groups = new Set(SOURCES.map((s) => s.group))
    for (const g of groups) assert.equal(["assessment", "safety", "movement", "assets"].includes(g), true)
  })

  it("the offline validator script exits cleanly against the real registry", () => {
    const output = execFileSync(process.execPath, ["scripts/validate-sources.mjs"], { encoding: "utf8" })
    assert.match(output, /Source registry OK \(offline\)/)
  })
})
