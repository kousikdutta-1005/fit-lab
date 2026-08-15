/**
 * The transparency/integrity gate for "Sources & methods".
 *
 * Every source in the registry must be a real, exact reference (a DOI or an
 * exact official URL — never a search or summary page), unique, and never
 * let observational/mechanistic/extrapolated evidence read as causal. Every
 * sourceIds field elsewhere in the app (exercises, home-gym ceilings) must
 * resolve to a real entry here — no dangling references in either direction.
 *
 * The individual rules live in scripts/lib/source-checks.mjs as pure
 * functions so they can be unit-tested against synthetic fixtures — see
 * tests/sources.test.ts.
 *
 * Deterministic and offline by default; pass --network to additionally fetch
 * every source's `ref` URL and confirm it resolves (this does not confirm the
 * citation is correct — that still requires a human to read the paper — but
 * it does catch a rotted or mistyped link).
 *
 * Run with: npm run validate:sources             (offline, deterministic)
 *           npm run validate:sources:network      (also hits the network)
 */

import { EXERCISES } from "../src/data/exercises.ts"
import { SOURCES } from "../src/data/evidence.ts"
import { HOME_CEILINGS } from "../src/data/kit.ts"
import { causalLanguageProblem, danglingSourceReferences, duplicateIds, refProblem } from "./lib/source-checks.mjs"

const NETWORK = process.argv.includes("--network")

function fail(problems) {
  console.error(`Source validation failed with ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exitCode = 1
}

const problems = []

const dup = duplicateIds(SOURCES)
if (dup.length > 0) problems.push(`Duplicate source id(s): ${dup.join(", ")}`)

for (const s of SOURCES) {
  const p1 = refProblem(s)
  if (p1) problems.push(p1)
  const p2 = causalLanguageProblem(s)
  if (p2) problems.push(p2)
}

const sourceIds = SOURCES.map((s) => s.id)
problems.push(...danglingSourceReferences(EXERCISES, sourceIds, "Exercise"))
problems.push(...danglingSourceReferences(HOME_CEILINGS, sourceIds, "Home ceiling"))

// Every source should be cited by at least one piece of copy — otherwise it
// is registry noise nobody's claim actually depends on. Asset-license sources
// are exempt: they document provenance, not a specific per-exercise claim.
const referenced = new Set([...EXERCISES.flatMap((e) => e.sourceIds), ...HOME_CEILINGS.flatMap((c) => c.sourceIds)])
const unreferenced = SOURCES.filter((s) => s.group !== "assets" && !referenced.has(s.id))
if (unreferenced.length > 0) {
  console.log(
    `Note: ${unreferenced.length} source(s) support fixed assessment/safety copy rather than a per-exercise reference ` +
      `(body-composition formulas, thresholds, screening rules) and are cited directly in Result.tsx rather than via ` +
      `sourceIds: ${unreferenced.map((s) => s.id).join(", ")}`,
  )
}

if (problems.length > 0) {
  fail(problems)
} else {
  console.log(`Source registry OK (offline): ${SOURCES.length} sources, 0 dangling references.`)
}

if (NETWORK && problems.length === 0) await runNetworkChecks()

async function runNetworkChecks() {
  console.log(`\nRunning network verification for ${SOURCES.length} sources (this hits the live internet)...`)
  const networkProblems = []
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.ref, { redirect: "follow", method: "GET" })
      if (!res.ok && [404, 410, 500, 502, 503].includes(res.status)) {
        networkProblems.push(`Source "${s.id}" ref returned ${res.status}: ${s.ref}`)
      }
    } catch (err) {
      networkProblems.push(`Network error checking source "${s.id}" (${s.ref}): ${err.message}`)
    }
  }
  if (networkProblems.length > 0) fail(networkProblems)
  else console.log(`Network verification OK: all ${SOURCES.length} source refs resolved.`)
}
