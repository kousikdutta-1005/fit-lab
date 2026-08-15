/**
 * Pure, dependency-free checks behind the technique-guide hard gate.
 *
 * Pulled out of scripts/validate-guides.mjs so the rules themselves — what
 * counts as a prohibited URL, what counts as a dangling reference, what
 * counts as a stale quarantine — can be unit-tested against small synthetic
 * fixtures (tests/guides.test.ts) without depending on the live data files or
 * the network. The real registries are validated by feeding them through
 * these same functions from validate-guides.mjs.
 */

export const PROHIBITED_URL_PATTERNS = [
  { re: /youtube\.com\/results/i, why: "a YouTube search page, not a specific video" },
  { re: /youtube\.com\/(channel|c|user)\//i, why: "a YouTube channel page, not a specific video" },
  { re: /youtube\.com\/playlist/i, why: "a YouTube playlist, not a specific video" },
  { re: /[?&]list=/i, why: "a playlist-qualified link, not a single exact video" },
  { re: /\/shorts\//i, why: "a YouTube Shorts link" },
  { re: /(amzn\.to|amazon\.[a-z.]+\/|affiliate|\/ref=|utm_source=aff)/i, why: "an affiliate/sales link" },
  { re: /\/search\?/i, why: "a generic search-results URL" },
  { re: /pinterest\.|reddit\.com|facebook\.com|instagram\.com|tiktok\.com/i, why: "a social feed link, not an institutional guide" },
]

/** Returns a list of reasons a guide URL is prohibited, or [] if it's fine. */
export function prohibitedUrlReasons(url) {
  const reasons = []
  if (!/^https:\/\//.test(url)) reasons.push("not an https URL")
  for (const { re, why } of PROHIBITED_URL_PATTERNS) if (re.test(url)) reasons.push(why)
  return reasons
}

/** Duplicate ids in a list of {id} records. */
export function duplicateIds(records) {
  const ids = records.map((r) => r.id)
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]
}

/**
 * Every exercise must be either shippable-with-a-valid-guide, or explicitly
 * quarantined — never both, never neither.
 */
export function quarantineProblems(exercises, guideIds) {
  const guideIdSet = new Set(guideIds)
  const problems = []
  for (const e of exercises) {
    const hasValidGuide = Boolean(e.guideId) && guideIdSet.has(e.guideId)
    if (!hasValidGuide && !e.quarantined) problems.push(`Exercise "${e.id}" has no valid guide and is not quarantined.`)
    if (hasValidGuide && e.quarantined) problems.push(`Exercise "${e.id}" is quarantined but also has a resolvable guide.`)
  }
  return problems
}

/** Dangling guideId / referralGuideIds references from exercises into guides. */
export function danglingGuideReferences(exercises, guideIds) {
  const guideIdSet = new Set(guideIds)
  const problems = []
  for (const e of exercises) {
    if (e.quarantined) continue
    if (e.guideId && !guideIdSet.has(e.guideId)) problems.push(`Exercise "${e.id}" references dangling guideId "${e.guideId}".`)
    for (const refId of e.referralGuideIds ?? []) {
      if (!guideIdSet.has(refId)) problems.push(`Exercise "${e.id}" references dangling referralGuideId "${refId}".`)
    }
  }
  return problems
}

/** A fallbackGuideId must exist, and never point at itself. */
export function fallbackProblems(guides) {
  const guideIdSet = new Set(guides.map((g) => g.id))
  const problems = []
  for (const g of guides) {
    if (!g.fallbackGuideId) continue
    if (g.fallbackGuideId === g.id) problems.push(`Guide "${g.id}" lists itself as its own fallback.`)
    else if (!guideIdSet.has(g.fallbackGuideId)) problems.push(`Guide "${g.id}" references dangling fallbackGuideId "${g.fallbackGuideId}".`)
  }
  return problems
}
