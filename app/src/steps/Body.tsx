import { useState } from "react"
import { BodyView } from "../components/BodyView"
import { Character } from "../components/Character"
import type { Build } from "../components/Character"
import { NEUTRAL_SHAPE, figureLabel } from "../lib/figure"
import { Chip, Glyph, Help, Tape, Tiles } from "../components/controls"
import type { GlyphName } from "../components/controls"
import { Stage } from "../components/Stage"
import type { Sex } from "../lib/calc"
import { bmi, round } from "../lib/calc"
import { bodyComplete, missingBodyMetrics } from "../lib/flow"
import type { BodyValues, MetricId, NumericMetricId } from "../lib/flow"
import type { StageNode } from "./nodes"

/**
 * The body.
 *
 * Only the readings that change something are here: sex, age, height, weight,
 * waist, neck, and hip for women because that is the only place the Navy
 * formula uses it. Ancestry, a guess at your own shoulders, a guess at your own
 * muscle mass, skin, hair — all of it collected an answer and either used it
 * for nothing or used a guess as if it were a measurement.
 *
 * The screen is one scene: the figure holds the viewport, the readings sit in a
 * rail underneath it, and one tape at a time is open. Tap a reading, drag the
 * tape, watch the figure answer. That last part is the entire product, and the
 * old layout buried it under nine sliders.
 */

type Metric = {
  label: string
  unit: string
  min: number
  max: number
  /** Where the tape opens when nothing has been measured yet. */
  seed: number
  glyph: GlyphName
}

const METRICS: Record<NumericMetricId, Metric> = {
  age: { label: "Age", unit: "years", min: 14, max: 100, seed: 25, glyph: "person" },
  height: { label: "Height", unit: "cm", min: 130, max: 210, seed: 170, glyph: "ruler" },
  weight: { label: "Weight", unit: "kg", min: 35, max: 180, seed: 70, glyph: "scale" },
  waist: { label: "Waist", unit: "cm", min: 50, max: 160, seed: 84, glyph: "ruler" },
  neck: { label: "Neck", unit: "cm", min: 25, max: 60, seed: 37, glyph: "ruler" },
  hip: { label: "Hips", unit: "cm", min: 60, max: 170, seed: 95, glyph: "ruler" },
}

export function BodyStage({
  nodes,
  sex,
  onSex,
  values,
  onValue,
  build,
  onBack,
  onNext,
}: {
  nodes: StageNode[]
  /** Null until it is chosen. It is never assumed. */
  sex: Sex | null
  onSex: (s: Sex) => void
  values: BodyValues
  onValue: (metric: NumericMetricId, value: number) => void
  /** Null while sex is unanswered, because both meshes are sexed. */
  build: Build | null
  onBack: () => void
  onNext: () => void
}) {
  const [open, setOpen] = useState<MetricId>("sex")
  const order: NumericMetricId[] =
    sex === "female"
      ? ["age", "height", "weight", "waist", "neck", "hip"]
      : ["age", "height", "weight", "waist", "neck"]

  // Switching back to male while the hip tape is open must not leave a tape
  // for a reading that is no longer asked for.
  const active: MetricId =
    open !== "sex" && !order.includes(open as NumericMetricId) ? "sex" : open

  const done = bodyComplete(sex, values)
  const missing = missingBodyMetrics(sex, values)
  const metric = active === "sex" ? null : METRICS[active]

  // Only what has actually been entered, so nothing seeded is ever announced
  // as a measurement.
  const label = figureLabel({
    heightCm: values.height,
    weightKg: values.weight,
    waistCm: values.waist,
    hipCm: sex === "female" ? values.hip : undefined,
  })

  const shown = (m: NumericMetricId) => {
    const v = values[m]
    return v === undefined ? "—" : `${v}`
  }

  const strip = [
    values.height === undefined ? null : `${values.height}cm`,
    values.weight === undefined ? null : `${values.weight}kg`,
    values.height === undefined || values.weight === undefined
      ? null
      : `BMI ${round(bmi(values.weight, values.height))}`,
    values.waist === undefined ? null : `waist ${values.waist}`,
  ].filter(Boolean) as string[]

  return (
    <Stage
      nodes={nodes}
      current="body"
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!done}
      waiting={
        done
          ? null
          : sex === null
            ? "Choose sex at birth to build the figure"
            : `Still to measure: ${missing.map((m) => METRICS[m].label.toLowerCase()).join(", ")}`
      }
      scene={(height) =>
        build === null ? (
          // Neither base mesh is neutral, so before sex is answered the figure
          // is an outline that is plainly nobody, and it says so.
          <>
            <div style={{ display: "grid", placeItems: "center", height, opacity: 0.55 }}>
              <Character shape={NEUTRAL_SHAPE} height={height * 0.72} label={figureLabel(null)} />
            </div>
            <p className="scene-strip mono">Illustration only</p>
          </>
        ) : (
          <>
            <BodyView build={build} height={height} label={label} />
            {strip.length > 0 && <p className="scene-strip mono">{strip.join(" · ")}</p>}
          </>
        )
      }
    >
      <div className="rail" role="group" aria-label="Your readings">
        <Chip
          label="Sex"
          value={sex === null ? "—" : sex === "female" ? "Female" : "Male"}
          active={active === "sex"}
          onClick={() => setOpen("sex")}
          glyph="person"
        />
        {order.map((m) => (
          <Chip
            key={m}
            label={METRICS[m].label}
            value={shown(m)}
            active={active === m}
            onClick={() => setOpen(m)}
            glyph={METRICS[m].glyph}
          />
        ))}
      </div>

      {metric === null ? (
        <Tiles
          label="Sex at birth"
          columns={2}
          value={sex}
          onChange={(next) => {
            onSex(next)
            setOpen("age")
          }}
          options={[
            { id: "female" as Sex, label: "Female", glyph: "person" },
            { id: "male" as Sex, label: "Male", glyph: "person" },
          ]}
        />
      ) : (
        <Tape
          label={metric.label}
          unit={metric.unit}
          min={metric.min}
          max={metric.max}
          value={values[active as NumericMetricId] ?? metric.seed}
          onChange={(v) => onValue(active as NumericMetricId, v)}
          // The number the tape opens on is a starting point, not an answer, so
          // it is committed the moment the tape is actually operated. Without
          // this, anybody whose real measurement happens to equal the starting
          // point could never set it: they would drag, land on the number that
          // was already shown, and the reading would still count as unset.
          onTouch={() =>
            onValue(active as NumericMetricId, values[active as NumericMetricId] ?? metric.seed)
          }
        />
      )}

      <Help title="How to measure">
        <ul>
          <li>
            <strong>Waist.</strong> Around your belly button, standing relaxed, breathing out, not holding
            it in.
          </li>
          <li>
            <strong>Neck.</strong> Just below the Adam&apos;s apple, tape sloping slightly down at the front.
          </li>
          <li>
            <strong>Hips.</strong> Around the widest part.
          </li>
          <li>
            A tape is out by two to five centimetres in ordinary use, which is why everything derived from
            it is shown later as a band rather than a number.
          </li>
          <li>
            Shoulder width and muscle mass are <strong>not</strong> measured here. A guess at your own build
            is not a measurement, so the figure draws both from a conservative default and the assessment
            never claims otherwise.
          </li>
        </ul>
      </Help>

      <p className="tray-foot mono">
        <Glyph name="check" size={13} />
        Worked out on this device. Nothing is sent anywhere.
      </p>
    </Stage>
  )
}
