import type { Build } from '../types'
import { Character3D } from './Character3D'

interface ResultsProps {
  build: Build
  onReset: () => void
}

export function Results({ build, onReset }: ResultsProps) {
  const bmi = build.weightKg / Math.pow(build.heightCm / 100, 2)
  const whr = build.hipCm ? (build.waistCm / build.hipCm).toFixed(2) : null

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Your Assessment</h2>

      <Character3D build={build} />

      <div style={styles.metrics}>
        <Metric label="BMI" value={bmi.toFixed(1)} note={bmiLabel(bmi)} />
        <Metric label="Waist" value={`${build.waistCm} cm`} />
        {whr && <Metric label="Waist-Hip Ratio" value={whr} note={whrLabel(whr, build.sex)} />}
        {build.gripKg && (
          <Metric label="Grip Strength" value={`${build.gripKg} kg`} note={gripLabel(build.gripKg, build.sex, build.age)} />
        )}
      </div>

      <button style={styles.reset} onClick={onReset}>
        Start Over
      </button>
    </div>
  )
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={styles.metricValue}>{value}</span>
      {note && <span style={styles.metricNote}>{note}</span>}
    </div>
  )
}

function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return 'Underweight'
  if (bmi < 25) return 'Normal'
  if (bmi < 30) return 'Overweight'
  return 'Obese'
}

function whrLabel(whr: string, sex: Build['sex']): string {
  const v = parseFloat(whr)
  if (sex === 'female') return v > 0.85 ? 'High risk' : v > 0.8 ? 'Moderate risk' : 'Low risk'
  return v > 1.0 ? 'High risk' : v > 0.9 ? 'Moderate risk' : 'Low risk'
}

/** NHANES-based grip strength reference ranges (simplified). */
function gripLabel(gripKg: number, sex: Build['sex'], age: number): string {
  // Reference medians by sex and broad age band (kg, dominant hand)
  const ref =
    sex === 'male'
      ? age < 30 ? 46 : age < 50 ? 44 : 38
      : age < 30 ? 28 : age < 50 ? 27 : 23

  if (gripKg >= ref * 1.1) return 'Above average'
  if (gripKg >= ref * 0.9) return 'Average'
  return 'Below average — worth improving'
}

const styles = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '24px 20px',
    fontFamily: 'system-ui, sans-serif',
    color: '#e0e0e0',
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 16,
  },
  metrics: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    marginTop: 20,
  },
  metric: {
    background: '#1a1a1a',
    borderRadius: 8,
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: '#a0a0a0',
    flex: 1,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
  },
  metricNote: {
    fontSize: 11,
    color: '#888',
    width: '100%',
    marginTop: 2,
  },
  reset: {
    marginTop: 24,
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#a0a0a0',
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: 14,
  },
} as const
