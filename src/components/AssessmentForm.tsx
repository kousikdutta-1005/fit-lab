import { useState } from 'react'
import type { Build } from '../types'

interface AssessmentFormProps {
  onSubmit: (build: Build) => void
}

export function AssessmentForm({ onSubmit }: AssessmentFormProps) {
  const [sex, setSex] = useState<Build['sex']>('male')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [hipCm, setHipCm] = useState('')
  const [age, setAge] = useState('')
  const [gripKg, setGripKg] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const h = parseFloat(heightCm)
    const w = parseFloat(weightKg)
    const wa = parseFloat(waistCm)
    const a = parseFloat(age)

    if (!h || !w || !wa || !a) {
      setError('Please fill in all required fields.')
      return
    }

    const build: Build = {
      sex,
      heightCm: h,
      weightKg: w,
      waistCm: wa,
      age: a,
      hipCm: hipCm ? parseFloat(hipCm) : undefined,
      gripKg: gripKg ? parseFloat(gripKg) : undefined,
    }

    onSubmit(build)
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.heading}>Your Starting Point</h2>

      {/* Sex selector */}
      <div style={styles.field}>
        <label style={styles.label}>Sex</label>
        <div style={styles.segmented}>
          {(['male', 'female'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSex(s)}
              style={{
                ...styles.segBtn,
                ...(sex === s ? styles.segBtnActive : {}),
              }}
            >
              {s === 'male' ? 'Male' : 'Female'}
            </button>
          ))}
        </div>
      </div>

      <Field label="Age (years) *" value={age} onChange={setAge} type="number" min={10} max={100} />
      <Field label="Height (cm) *" value={heightCm} onChange={setHeightCm} type="number" min={100} max={250} />
      <Field label="Weight (kg) *" value={weightKg} onChange={setWeightKg} type="number" min={20} max={300} />
      <Field label="Waist circumference (cm) *" value={waistCm} onChange={setWaistCm} type="number" min={40} max={200} />

      {sex === 'female' && (
        <Field label="Hip circumference (cm)" value={hipCm} onChange={setHipCm} type="number" min={60} max={200} />
      )}

      <Field
        label="Grip strength (kg, dominant hand)"
        value={gripKg}
        onChange={setGripKg}
        type="number"
        min={1}
        max={100}
        hint="Optional — squeeze a luggage scale or estimate"
      />

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" style={styles.submit}>
        Get My Assessment
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Small reusable field
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  min?: number
  max?: number
  hint?: string
}

function Field({ label, value, onChange, type = 'text', min, max, hint }: FieldProps) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {hint && <span style={styles.hint}>{hint}</span>}
      <input
        style={styles.input}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles (inline, no external dependencies)
// ---------------------------------------------------------------------------

const styles = {
  form: {
    maxWidth: 400,
    margin: '0 auto',
    padding: '24px 20px',
    fontFamily: 'system-ui, sans-serif',
    color: '#e0e0e0',
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 20,
    color: '#fff',
  },
  field: {
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  label: {
    fontSize: 13,
    color: '#a0a0a0',
  },
  hint: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  input: {
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#fff',
    padding: '8px 10px',
    fontSize: 15,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  segmented: {
    display: 'flex',
    gap: 8,
  },
  segBtn: {
    flex: 1,
    padding: '8px 0',
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#a0a0a0',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  segBtnActive: {
    background: '#2d6a4f',
    border: '1px solid #2d6a4f',
    color: '#fff',
  },
  error: {
    color: '#ff6b6b',
    fontSize: 13,
    marginBottom: 8,
  },
  submit: {
    width: '100%',
    padding: '12px 0',
    background: '#2d6a4f',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  },
} as const
