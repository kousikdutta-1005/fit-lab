import { useState } from 'react'
import type { Build, GoalType } from '../types'

interface AssessmentFormProps {
  onSubmit: (build: Build) => void
}

export function AssessmentForm({ onSubmit }: AssessmentFormProps) {
  const [sex, setSex] = useState<Build['sex']>('male')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [neckCm, setNeckCm] = useState('')
  const [hipCm, setHipCm] = useState('')
  const [age, setAge] = useState('')
  const [gripKg, setGripKg] = useState('')
  const [goal, setGoal] = useState<GoalType>('lose-fat')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [timelineWeeks, setTimelineWeeks] = useState('')
  const [equipment, setEquipment] = useState<Build['equipment']>('gym')
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
    onSubmit({
      sex, heightCm: h, weightKg: w, waistCm: wa, age: a,
      neckCm: neckCm ? parseFloat(neckCm) : undefined,
      hipCm: hipCm ? parseFloat(hipCm) : undefined,
      gripKg: gripKg ? parseFloat(gripKg) : undefined,
      goal,
      targetWeightKg: targetWeightKg ? parseFloat(targetWeightKg) : undefined,
      timelineWeeks: timelineWeeks ? parseInt(timelineWeeks) : undefined,
      equipment,
    })
  }

  const showTargetWeight = goal === 'lose-fat' || goal === 'build-muscle'

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <h2 style={s.heading}>Your Starting Point</h2>

      <div style={s.field}>
        <label style={s.label}>Sex</label>
        <div style={s.seg}>
          {(['male', 'female'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setSex(v)}
              style={{ ...s.segBtn, ...(sex === v ? s.segActive : {}) }}>
              {v === 'male' ? 'Male' : 'Female'}
            </button>
          ))}
        </div>
      </div>

      <F label="Age (years) *" val={age} set={setAge} min={10} max={100} />
      <F label="Height (cm) *" val={heightCm} set={setHeightCm} min={100} max={250} />
      <F label="Weight (kg) *" val={weightKg} set={setWeightKg} min={20} max={300} />
      <F label="Waist circumference (cm) *" val={waistCm} set={setWaistCm} min={40} max={200}
        hint="At navel level, relaxed" />
      <F label="Neck circumference (cm)" val={neckCm} set={setNeckCm} min={20} max={60}
        hint="Optional — improves body fat estimate" />
      {sex === 'female' && (
        <F label="Hip circumference (cm)" val={hipCm} set={setHipCm} min={60} max={200}
          hint="At widest point" />
      )}
      <F label="Grip strength (kg, dominant hand)" val={gripKg} set={setGripKg} min={1} max={100}
        hint="Optional — squeeze a luggage scale, or skip" />

      <div style={s.field}>
        <label style={s.label}>Primary goal</label>
        <div style={{ ...s.seg, flexWrap: 'wrap' as const, gap: 6 }}>
          {([
            ['lose-fat', 'Lose fat'],
            ['build-muscle', 'Build muscle'],
            ['improve-cardio', 'Cardio'],
            ['general-fitness', 'General'],
          ] as [GoalType, string][]).map(([g, lbl]) => (
            <button key={g} type="button" onClick={() => setGoal(g)}
              style={{ ...s.segBtn, ...(goal === g ? s.segActive : {}), flex: 'unset', padding: '7px 14px' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {showTargetWeight && (
        <F label={`Target weight (kg)`} val={targetWeightKg} set={setTargetWeightKg} min={20} max={300} />
      )}
      {showTargetWeight && (
        <F label="Timeline (weeks)" val={timelineWeeks} set={setTimelineWeeks} min={4} max={104}
          hint="How long are you willing to commit?" />
      )}

      <div style={s.field}>
        <label style={s.label}>Training environment</label>
        <div style={s.seg}>
          {(['gym', 'floor'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setEquipment(v)}
              style={{ ...s.segBtn, ...(equipment === v ? s.segActive : {}) }}>
              {v === 'gym' ? '🏋️ Gym' : '🏠 Home / Floor'}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={s.error}>{error}</p>}
      <button type="submit" style={s.submit}>Get My Assessment →</button>
    </form>
  )
}

function F({ label, val, set, min, max, hint }: {
  label: string; val: string; set: (v: string) => void; min?: number; max?: number; hint?: string
}) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      {hint && <span style={s.hint}>{hint}</span>}
      <input style={s.input} type="number" value={val}
        onChange={(e) => set(e.target.value)} min={min} max={max} />
    </div>
  )
}

const s = {
  form: { maxWidth: 420, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, sans-serif', color: '#e0e0e0' },
  heading: { fontSize: 22, fontWeight: 700, marginBottom: 20, color: '#fff' },
  field: { marginBottom: 16, display: 'flex', flexDirection: 'column' as const, gap: 4 },
  label: { fontSize: 13, color: '#a0a0a0' },
  hint: { fontSize: 11, color: '#555', fontStyle: 'italic' as const },
  input: { background: '#1e1e1e', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 10px', fontSize: 15, width: '100%', boxSizing: 'border-box' as const },
  seg: { display: 'flex', gap: 8 },
  segBtn: { flex: 1, padding: '8px 0', background: '#1e1e1e', border: '1px solid #333', borderRadius: 6, color: '#a0a0a0', cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  segActive: { background: '#2d6a4f', border: '1px solid #2d6a4f', color: '#fff' },
  error: { color: '#ff6b6b', fontSize: 13, marginBottom: 8 },
  submit: { width: '100%', padding: '12px 0', background: '#2d6a4f', border: 'none', borderRadius: 8, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
} as const
