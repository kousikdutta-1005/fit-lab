/**
 * The technique-guide hard gate.
 *
 * Every shippable exercise must point at a real, exact, credentialed guide —
 * never a search page, a channel, a playlist, a Shorts link, an affiliate/
 * sales page or a generic blog. This script is deterministic and offline by
 * default (safe to run in CI on every commit); pass --network to additionally
 * fetch every live URL and assert its resolved content actually matches what
 * the registry claims it is, which is the only way to catch a link that still
 * returns HTTP 200 for the wrong exercise (a documented ACE-catalogue
 * behaviour) or a YouTube video that was replaced/retitled/deleted.
 *
 * The individual rules live in scripts/lib/guide-checks.mjs as pure functions
 * so they can be unit-tested against synthetic fixtures — see
 * tests/guides.test.ts.
 *
 * Run with: npm run validate:guides             (offline, deterministic)
 *           npm run validate:guides:network      (also hits the network)
 */

import { EXERCISES, SHIPPABLE_EXERCISES } from "../src/data/exercises.ts"
import { GUIDES } from "../src/data/evidence.ts"
import { danglingGuideReferences, duplicateIds, fallbackProblems, prohibitedUrlReasons, quarantineProblems } from "./lib/guide-checks.mjs"

const NETWORK = process.argv.includes("--network")

function fail(problems) {
  console.error(`Guide validation failed with ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exitCode = 1
}

const problems = []

const dupGuideIds = duplicateIds(GUIDES)
if (dupGuideIds.length > 0) problems.push(`Duplicate guide id(s): ${dupGuideIds.join(", ")}`)

const dupExerciseIds = duplicateIds(EXERCISES)
if (dupExerciseIds.length > 0) problems.push(`Duplicate exercise id(s): ${dupExerciseIds.join(", ")}`)

const guideIds = GUIDES.map((g) => g.id)
problems.push(...quarantineProblems(EXERCISES, guideIds))
problems.push(...danglingGuideReferences(EXERCISES, guideIds))
problems.push(...fallbackProblems(GUIDES))

const guideById = new Map(GUIDES.map((g) => [g.id, g]))
for (const e of SHIPPABLE_EXERCISES) {
  const guide = guideById.get(e.guideId)
  if (!guide) continue // already reported by danglingGuideReferences
  for (const reason of prohibitedUrlReasons(guide.url)) {
    problems.push(`Guide "${guide.id}" (${guide.url}) looks like ${reason}.`)
  }
  for (const refId of e.referralGuideIds ?? []) {
    const ref = guideById.get(refId)
    if (ref && ref.role !== "referral") problems.push(`Exercise "${e.id}"'s referralGuideId "${refId}" is not marked role: "referral".`)
  }
}

// S-tier shippable exercises should have a same-exercise fallback where one
// exists in the registry; where none exists the absence must stay genuinely
// absent (no fallbackGuideId), never papered over with an unrelated exercise.
const sTierWithoutFallback = SHIPPABLE_EXERCISES.filter((e) => {
  const guide = guideById.get(e.guideId)
  return e.tier === "S" && guide?.role === "primary" && !guide.fallbackGuideId
})
if (sTierWithoutFallback.length > 0) {
  console.warn(
    `Note: ${sTierWithoutFallback.length} S-tier exercise(s) have no same-exercise fallback guide (explicitly absent, not papered over): ` +
      sTierWithoutFallback.map((e) => e.id).join(", "),
  )
}

if (problems.length > 0) {
  fail(problems)
} else {
  console.log(
    `Guide registry OK (offline): ${GUIDES.length} guides, ${SHIPPABLE_EXERCISES.length}/${EXERCISES.length} exercises shippable, ` +
      `${EXERCISES.length - SHIPPABLE_EXERCISES.length} quarantined.`,
  )
}

if (NETWORK && problems.length === 0) await runNetworkChecks()

async function checkYouTube(guide) {
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(guide.url)}&format=json`
  const res = await fetch(oembed)
  if (!res.ok) return `YouTube oEmbed failed (${res.status}) for "${guide.id}" — video may be private/deleted/moved.`
  const json = await res.json()
  if (!json.title || !json.author_name) return `YouTube oEmbed returned no title/channel for "${guide.id}".`
  return null
}

async function checkFetchContentMatch(guide) {
  const res = await fetch(guide.url, { redirect: "follow" })
  if (!res.ok) return `Fetch failed (${res.status}) for "${guide.id}" at ${guide.url} (resolved: ${res.url}).`
  const body = await res.text()
  if (!body.toLowerCase().includes(guide.expectedContent.toLowerCase())) {
    return `Content mismatch for "${guide.id}": expected page to mention "${guide.expectedContent}" — this catches an identity swap (e.g. ACE serving HTTP 200 for the wrong exercise id) that a status-only check misses.`
  }
  return null
}

async function runNetworkChecks() {
  console.log(`\nRunning network verification for ${GUIDES.length} guides (this hits the live internet)...`)
  const networkProblems = []
  for (const guide of GUIDES) {
    try {
      const problem =
        guide.verificationMethod === "youtube_oembed" ? await checkYouTube(guide) : await checkFetchContentMatch(guide)
      if (problem) networkProblems.push(problem)
    } catch (err) {
      networkProblems.push(`Network error checking "${guide.id}" (${guide.url}): ${err.message}`)
    }
  }
  if (networkProblems.length > 0) fail(networkProblems)
  else console.log(`Network verification OK: all ${GUIDES.length} guides resolved and matched expected content.`)
}
