import { Disclosure } from "./ui"
import { ExternalLink } from "./ui"
import type { EvidenceKind, Source, SourceGroup, TechniqueGuide } from "../data/evidence"

/**
 * The full "Sources & methods" registry. Every user-visible claim on the
 * result page — body-composition formulas, safety screening, exercise
 * evidence, weekly movement guidance, equipment advice, and asset/anatomy
 * licensing — resolves to an entry here. Grouped exactly as required:
 * Assessment / Safety / Movement / Assets & licences.
 */

const KIND_LABEL: Record<EvidenceKind, string> = {
  guideline: "Guideline",
  rct: "Randomised trial",
  meta_analysis: "Meta-analysis",
  observational: "Observational association",
  biomechanical: "Biomechanical inference",
  sport_extrapolation: "Sport extrapolation",
  editorial_inference: "Editorial/product judgement",
  dataset: "Reference dataset",
  asset_license: "Asset licence",
}

const GROUP_LABEL: Record<SourceGroup, string> = {
  assessment: "Assessment",
  safety: "Safety",
  movement: "Movement",
  assets: "Assets & licences",
}

const GROUP_ORDER: SourceGroup[] = ["assessment", "safety", "movement", "assets"]

export function SourcesPanel({ sources, guides }: { sources: Source[]; guides: TechniqueGuide[] }) {
  return (
    <div className="sources-panel" id="sources-and-methods">
      <p className="read-note">
        Every factual claim and every recommendation on this page resolves to one of the entries below: who
        made it, what kind of evidence it is, when it was last checked, and exactly what it is being used to
        support. Association is never presented as causation, and a guideline is never presented as a trial.
      </p>
      {GROUP_ORDER.map((group) => {
        const items = sources.filter((s) => s.group === group)
        if (items.length === 0) return null
        return (
          <Disclosure key={group} title={GROUP_LABEL[group]} hint={`${items.length} sources`}>
            <ul className="source-list">
              {items.map((s) => (
                <li key={s.id} className="source-item">
                  <p className="source-title">
                    <ExternalLink href={s.ref} label={`${s.title} — ${s.org}, opens in a new tab`}>
                      {s.title}
                    </ExternalLink>
                  </p>
                  <p className="source-meta mono">
                    {s.org} · {s.year} · {KIND_LABEL[s.kind]} · accessed {s.accessed}
                  </p>
                  <p className="source-claim">{s.claim}</p>
                  {s.limitation && <p className="source-limitation">Limitation: {s.limitation}</p>}
                </li>
              ))}
            </ul>
          </Disclosure>
        )
      })}
      <Disclosure title="Technique guides" hint={`${guides.length} verified guides`}>
        <ul className="source-list">
          {guides.map((g) => (
            <li key={g.id} className="source-item">
              <p className="source-title">
                <ExternalLink href={g.url} label={`${g.title} — ${g.provider}, opens in a new tab`}>
                  {g.title}
                </ExternalLink>
              </p>
              <p className="source-meta mono">
                {g.provider} · {g.format} · verified {g.verifiedAt} · {g.role === "referral" ? "referral only" : "primary"}
              </p>
              <p className="source-claim">{g.authorityRationale}</p>
              {g.safetyOverride && <p className="source-limitation">Safety: {g.safetyOverride}</p>}
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  )
}
