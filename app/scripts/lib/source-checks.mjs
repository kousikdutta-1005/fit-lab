/**
 * Pure, dependency-free checks behind the "Sources & methods" integrity gate.
 *
 * Pulled out of scripts/validate-sources.mjs so the rules can be unit-tested
 * against small synthetic fixtures (tests/sources.test.ts) without depending
 * on the live registry or the network.
 */

// "all-cause"/"some-cause" are epidemiological terms ("all-cause mortality"),
// not a causal claim, and must not trip the causal-language check.
const CAUSAL_VERBS = /(?<!all-)(?<!some-)\b(prevents?|cures?|causes?|eliminates?|guarantees?)\b/i
const NON_CAUSAL_KINDS = new Set(["observational", "biomechanical", "sport_extrapolation", "editorial_inference"])

export function duplicateIds(records) {
  const ids = records.map((r) => r.id)
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]
}

/** A ref must be a DOI or an exact URL, never a bare search string. */
export function refProblem(source) {
  const looksLikeDoi = /^https:\/\/doi\.org\//.test(source.ref)
  const looksLikeUrl = /^https?:\/\/[^\s]+$/.test(source.ref)
  if (!looksLikeDoi && !looksLikeUrl) return `Source "${source.id}" has a ref that is neither a DOI nor an exact URL: "${source.ref}".`
  if (/[?&](q|query|term|search)=|\/search\?/i.test(source.ref)) {
    return `Source "${source.id}" ref looks like a search query, not an exact citation: "${source.ref}".`
  }
  return null
}

/** Never let association/inference read as causation. */
export function causalLanguageProblem(source) {
  if (!NON_CAUSAL_KINDS.has(source.kind)) return null
  if (!CAUSAL_VERBS.test(source.claim)) return null
  return `Source "${source.id}" is kind "${source.kind}" but its claim uses causal language: "${source.claim}"`
}

/** Dangling sourceIds referenced from exercises/kit ceilings but absent from the registry. */
export function danglingSourceReferences(referencingRecords, sourceIds, recordLabel) {
  const sourceIdSet = new Set(sourceIds)
  const problems = []
  for (const r of referencingRecords) {
    for (const sid of r.sourceIds ?? []) {
      if (!sourceIdSet.has(sid)) problems.push(`${recordLabel} "${r.id}" references dangling sourceId "${sid}".`)
    }
  }
  return problems
}
