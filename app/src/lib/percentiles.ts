import table from "../data/percentiles.json"
import type { Sex } from "./calc"

/**
 * Where you actually stand, against real people.
 *
 * "Your BMI is 26.4" is noise. "Your BMI is higher than 71% of men aged 25 to
 * 29" is signal. This is the difference between a thermometer and a reading,
 * and it is the one thing here that a paid competitor structurally cannot match
 * honestly: their reference population is their own userbase, which is
 * self-selected for caring about fitness. NHANES is a nationally representative
 * probability sample.
 *
 * 71,543 weighted observations, US public domain, shipped in the bundle at
 * about 4KB. No lookup leaves the device.
 */

export type MetricId = "bmi" | "whtr" | "waist" | "grip"

export type Percentile = {
  /** 1-99, where 50 is the median. */
  value: number
  /** How many people are behind this band. */
  n: number
  band: string
  /** Plain sentence, ready to render. */
  sentence: string
}

type Band = { n: number; p: number[] }
type Metric = Record<string, Record<string, Band>>

const CENTILES: number[] = (table as { centiles: number[] }).centiles
const METRICS = (table as unknown as { metrics: Record<string, Metric> }).metrics

const BANDS: [number, number][] = [
  [18, 24],
  [25, 29],
  [30, 34],
  [35, 39],
  [40, 49],
  [50, 59],
  [60, 79],
]

function bandFor(age: number): string | null {
  const hit = BANDS.find(([lo, hi]) => age >= lo && age <= hi)
  return hit ? `${hit[0]}-${hit[1]}` : null
}

/**
 * Interpolate a percentile from the stored centile points, and extrapolate
 * gently past the ends rather than pretending 95 is the maximum.
 */
function interpolate(value: number, points: number[]): number {
  if (value <= points[0]) {
    const span = points[1] - points[0] || 1
    return Math.max(1, CENTILES[0] - ((points[0] - value) / span) * (CENTILES[1] - CENTILES[0]))
  }
  const last = points.length - 1
  if (value >= points[last]) {
    const span = points[last] - points[last - 1] || 1
    return Math.min(
      99,
      CENTILES[last] + ((value - points[last]) / span) * (CENTILES[last] - CENTILES[last - 1]),
    )
  }
  for (let i = 0; i < last; i++) {
    if (value >= points[i] && value <= points[i + 1]) {
      const t = (value - points[i]) / (points[i + 1] - points[i] || 1)
      return CENTILES[i] + t * (CENTILES[i + 1] - CENTILES[i])
    }
  }
  return 50
}

/** True where a higher number is the worse outcome. */
const HIGHER_IS_WORSE: Record<MetricId, boolean> = {
  bmi: true,
  whtr: true,
  waist: true,
  grip: false,
}

export function percentileOf(
  metric: MetricId,
  value: number,
  sex: Sex,
  age: number,
): Percentile | null {
  const band = bandFor(age)
  if (!band) return null
  const rows = METRICS[metric]?.[sex]?.[band]
  if (!rows) return null

  const pct = Math.round(interpolate(value, rows.p))
  const people = sex === "male" ? "men" : "women"

  const sentence = HIGHER_IS_WORSE[metric]
    ? `Higher than ${pct}% of ${people} aged ${band.replace("-", " to ")}.`
    : `Higher than ${pct}% of ${people} aged ${band.replace("-", " to ")}, which is the direction you want.`

  return { value: pct, n: rows.n, band, sentence }
}

/**
 * The honest reading of a percentile, which is not always the obvious one.
 * Being at the 50th percentile for waist in a population where most people
 * carry too much fat is not the reassurance it sounds like.
 */
export function context(metric: MetricId, pct: number): string | null {
  if (metric === "grip") {
    if (pct < 20)
      return "Below the 20th percentile. Grip strength is one of the better single predictors of long-term health, so this is worth taking seriously rather than as a curiosity."
    if (pct > 80) return "Above the 80th percentile. That is a genuinely strong result."
    return null
  }

  if (metric === "bmi" || metric === "waist" || metric === "whtr") {
    if (pct >= 40 && pct <= 60)
      return "Around the middle of the population. Worth saying plainly: the population this compares you to is not a healthy one, so average here is not the same as good."
    if (pct < 20) return "Well below most people. On this measure you are not the person who needs to worry."
    if (pct > 85) return "In the top band. This is the number with the most room to move."
  }
  return null
}

export const PERCENTILE_SOURCE = {
  label: "NHANES, US National Health and Nutrition Examination Survey",
  detail:
    "Weighted percentiles from 71,543 measured adults across four survey cycles, 2011 to 2018. US public domain. A US sample describes a US population: if your ancestry is South Asian or East Asian these percentiles place you against the wrong reference group, and the honest reading is the direction rather than the exact number.",
  url: "https://www.cdc.gov/nchs/nhanes/",
}
