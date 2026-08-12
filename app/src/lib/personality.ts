/**
 * Personality, done the only way it can be done honestly.
 *
 * Big Five only. MBTI, Enneagram and somatotypes are in the anti-references for
 * the same reason: they sort people into types that do not survive retesting.
 *
 * The instrument is the Ten-Item Personality Inventory.
 * Gosling SD, Rentfrow PJ, Swann WB. "A very brief measure of the Big-Five
 * personality domains." Journal of Research in Personality 2003;37:504-528.
 *
 * TIPI is short, which is its whole point and also its main weakness: ten items
 * buy you breadth at the cost of precision. It is adequate for "roughly where do
 * you sit", and inadequate for anything finer. The product says so.
 *
 * Why this is here at all: conscientiousness is the trait most consistently
 * linked to health behaviour and to actually doing the thing, and personality
 * does still move in your twenties. So the product treats it as a description of
 * habits that can change, never as an identity.
 */

export type TraitId =
  | "extraversion"
  | "agreeableness"
  | "conscientiousness"
  | "stability"
  | "openness"

export type TipiItem = {
  /** "I see myself as..." */
  text: string
  trait: TraitId
  /** TIPI scores five of its ten items in reverse. */
  reverse: boolean
}

export const TIPI: TipiItem[] = [
  { text: "Extraverted, enthusiastic", trait: "extraversion", reverse: false },
  { text: "Critical, quarrelsome", trait: "agreeableness", reverse: true },
  { text: "Dependable, self-disciplined", trait: "conscientiousness", reverse: false },
  { text: "Anxious, easily upset", trait: "stability", reverse: true },
  { text: "Open to new experiences, complex", trait: "openness", reverse: false },
  { text: "Reserved, quiet", trait: "extraversion", reverse: true },
  { text: "Sympathetic, warm", trait: "agreeableness", reverse: false },
  { text: "Disorganised, careless", trait: "conscientiousness", reverse: true },
  { text: "Calm, emotionally stable", trait: "stability", reverse: false },
  { text: "Conventional, uncreative", trait: "openness", reverse: true },
]

export const SCALE_LABELS = [
  "Disagree strongly",
  "Disagree moderately",
  "Disagree a little",
  "Neither",
  "Agree a little",
  "Agree moderately",
  "Agree strongly",
]

export type TraitScore = {
  trait: TraitId
  label: string
  /** 1 to 7. */
  score: number
  band: "lower" | "middle" | "higher"
  reading: string
}

const TRAIT_LABEL: Record<TraitId, string> = {
  extraversion: "Extraversion",
  agreeableness: "Warmth",
  conscientiousness: "Conscientiousness",
  stability: "Emotional stability",
  openness: "Openness",
}

/** Answers are 1-7 in the order of TIPI. */
export function scoreTipi(answers: number[]): TraitScore[] {
  const byTrait = new Map<TraitId, number[]>()
  TIPI.forEach((item, i) => {
    const raw = answers[i]
    if (!raw) return
    const value = item.reverse ? 8 - raw : raw
    byTrait.set(item.trait, [...(byTrait.get(item.trait) ?? []), value])
  })

  return [...byTrait.entries()].map(([trait, values]) => {
    const score = values.reduce((a, b) => a + b, 0) / values.length
    const band = score < 3.5 ? "lower" : score > 5 ? "higher" : "middle"
    return { trait, label: TRAIT_LABEL[trait], score, band, reading: reading(trait, band) }
  })
}

function reading(trait: TraitId, band: "lower" | "middle" | "higher"): string {
  if (trait === "conscientiousness") {
    if (band === "lower")
      return "This is the one trait here that reliably predicts whether plans get carried out, and yours sits on the lower side. That is not a character flaw and it is not fixed. It does mean willpower is the wrong thing to rely on. Build the behaviour into your surroundings instead: same time, same place, kit already out, nothing to decide."
    if (band === "middle")
      return "You are in the middle, which is where most people are. You will follow through when the friction is low and drift when it is high. So the useful lever is not trying harder, it is making the thing easier to start."
    return "You follow through when you decide to, and that is the single most useful thing on this page. The risk for you is not quitting, it is overcommitting to a plan built for someone with more free time, and then treating a missed week as failure."
  }

  if (trait === "stability") {
    if (band === "lower")
      return "You feel setbacks strongly. In practice that means a bad week is more likely to end the whole attempt, so the thing that protects you is a plan with a floor: the smallest version you would still do on your worst day."
    if (band === "middle") return "Roughly average. Setbacks land, then pass."
    return "You take setbacks in your stride, which makes consistency easier for you than for most people."
  }

  if (trait === "extraversion") {
    if (band === "lower")
      return "You are likely to do better training alone or at quiet hours than in a busy class. That is a preference to design around, not to correct."
    if (band === "middle") return "You can take company or leave it. Either setting will work."
    return "Other people are fuel for you. Training with someone, or somewhere with people around, will probably hold better than doing it alone at home."
  }

  if (trait === "openness") {
    if (band === "lower")
      return "You prefer the familiar, which suits training better than it sounds. Repeating the same lifts is how progress is measured."
    if (band === "middle") return "Comfortable with routine and with variety."
    return "You will get bored of a fixed routine before it stops working. Keep the main lifts and rotate everything else, or you will change the plan just as it starts paying."
  }

  if (band === "lower")
    return "You are direct rather than accommodating. Useful for holding your own time against other people's demands on it."
  if (band === "middle") return "Roughly average."
  return "You put other people first, which is pleasant for everyone except you. The usual failure here is your training time being the first thing given away when someone needs something."
}

/**
 * The honest framing of what this section can and cannot say. Shown with the
 * results rather than buried, because ten items is genuinely not much.
 */
export const PERSONALITY_CAVEAT =
  "This is ten questions, so read it as a rough sketch and not a portrait. It is the Big Five, which is the only model of personality with solid evidence behind it, and deliberately not MBTI or Enneagram, which sort people into types that change when you retake them. None of this is who you are. Traits shift through your twenties, and the point here is only which habits are likely to need scaffolding."
