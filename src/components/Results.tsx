import { lazy, Suspense, useState } from 'react'
import type { Build, FitnessScore, FeasibilityResult, MuscleGroup } from '../types'
import { computeFitnessScore } from '../engine/score'
import { computeFeasibility } from '../engine/feasibility'
import { getPrescription } from '../engine/exercises'

const Character3D = lazy(() =>
  import('./Character3D').then((m) => ({ default: m.Character3D }))
)

interface ResultsProps {
  build: Build
  onReset: () => void
}

export function Results({ build, onReset }: ResultsProps) {
  const score = computeFitnessScore(build)
  const feasibility = computeFeasibility(build)
  const prescription = getPrescription(build)
  const [equipment, setEquipment] = useState<'gym' | 'floor'>(build.equipment)
  const [openGroup, setOpenGroup] = useState<string | null>(prescription[0]?.name ?? null)

  return (
    <div style={s.container}>
      <Suspense fallback={<div style={{ height: 400, background: '#111', borderRadius: 8 }} />}>
        <Character3D build={build} />
      </Suspense>

      <ScoreCard score={score} />
      <FeasibilityCard feasibility={feasibility} goal={build.goal} />

      <div style={s.section}>
        <div style={s.sectionHead}>
          <h3 style={s.sectionTitle}>Your Exercise Plan</h3>
          <div style={s.equipToggle}>
            {(['gym', 'floor'] as const).map((e) => (
              <button key={e} onClick={() => setEquipment(e)}
                style={{ ...s.equipBtn, ...(equipment === e ? s.equipActive : {}) }}>
                {e === 'gym' ? '🏋️ Gym' : '🏠 Floor'}
              </button>
            ))}
          </div>
        </div>
        {prescription.map((group) => (
          <ExerciseGroup key={group.name} group={group} equipment={equipment}
            isOpen={openGroup === group.name}
            onToggle={() => setOpenGroup(openGroup === group.name ? null : group.name)} />
        ))}
      </div>

      <button style={s.reset} onClick={onReset}>← Start Over</button>
    </div>
  )
}

function ScoreCard({ score }: { score: FitnessScore }) {
  const color = score.overall >= 75 ? '#52b788' : score.overall >= 50 ? '#e9c46a' : '#e76f51'
  return (
    <div style={s.scoreCard}>
      <div style={{ ...s.circle, borderColor: color }}>
        <span style={{ ...s.scoreNum, color }}>{score.overall}</span>
        <span style={s.scoreOf}>/ 100</span>
      </div>
      <div style={s.scoreMetrics}>
        <SM label="BMI" value={`${score.bmi}`} sub={cap(score.bmiCategory)} />
        <SM label="Body Fat" value={`${score.bodyFatPct}%`} sub="estimated" />
        <SM label="Fitness Age" value={`${score.fitnessAge}`} sub="estimated" />
        {score.whr !== undefined && <SM label="WHR" value={`${score.whr}`} sub={score.whrRisk ?? ''} />}
        {score.gripPercentile !== undefined && <SM label="Grip" value={`${score.gripPercentile}th %ile`} sub="NHANES" />}
      </div>
    </div>
  )
}

function SM({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={s.sm}>
      <span style={s.smLabel}>{label}</span>
      <span style={s.smValue}>{value}</span>
      <span style={s.smSub}>{sub}</span>
    </div>
  )
}

const GOAL_LABELS: Record<string, string> = {
  'lose-fat': 'Fat Loss', 'build-muscle': 'Muscle Gain',
  'improve-cardio': 'Cardio', 'general-fitness': 'General Fitness',
}

function FeasibilityCard({ feasibility, goal }: { feasibility: FeasibilityResult; goal: string }) {
  const color = feasibility.verdict === 'achievable' ? '#52b788' : feasibility.verdict === 'stretch' ? '#e9c46a' : '#e76f51'
  const icon = feasibility.verdict === 'achievable' ? '✅' : feasibility.verdict === 'stretch' ? '⚠️' : '❌'
  return (
    <div style={s.feasCard}>
      <div style={s.feasHead}>
        <span style={s.feasGoal}>{GOAL_LABELS[goal] ?? goal}</span>
        <span style={{ ...s.feasVerdict, color }}>{icon} {cap(feasibility.verdict)}</span>
      </div>
      <p style={s.feasSummary}>{feasibility.summary}</p>
      {(feasibility.weeksToGoal != null || feasibility.dailyCalorieDelta != null) && (
        <div style={s.feasStats}>
          {feasibility.weeksToGoal != null && <span>⏱ ~{feasibility.weeksToGoal} weeks</span>}
          {feasibility.dailyCalorieDelta != null && (
            <span>{feasibility.dailyCalorieDelta < 0 ? '🔻' : '🔺'} {Math.abs(feasibility.dailyCalorieDelta)} kcal/day</span>
          )}
        </div>
      )}
    </div>
  )
}

function ExerciseGroup({ group, equipment, isOpen, onToggle }: {
  group: MuscleGroup; equipment: 'gym' | 'floor'; isOpen: boolean; onToggle: () => void
}) {
  const exercises = equipment === 'gym' ? group.gym : group.floor
  return (
    <div style={s.exGroup}>
      <button style={s.exHead} onClick={onToggle}>
        <span>{group.emoji} {group.name}</span>
        <span style={{ fontSize: 10, color: '#666' }}>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div style={{ padding: '0 16px 12px' }}>
          {exercises.map((ex) => (
            <div key={ex.name} style={s.exRow}>
              <div style={s.exName}>{ex.name}</div>
              <div style={s.exDetail}>{ex.sets} sets × {ex.reps} · {ex.rest} rest</div>
              {ex.tip && <div style={s.exTip}>💡 {ex.tip}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function cap(str: string) { return str.charAt(0).toUpperCase() + str.slice(1) }

const s = {
  container: { maxWidth: 480, margin: '0 auto', padding: '20px 20px 60px', fontFamily: 'system-ui, sans-serif', color: '#e0e0e0' },
  scoreCard: { display: 'flex', gap: 20, alignItems: 'center', background: '#161616', borderRadius: 12, padding: '20px 16px', margin: '20px 0' },
  circle: { width: 80, height: 80, borderRadius: '50%', border: '4px solid', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  scoreNum: { fontSize: 28, fontWeight: 800, lineHeight: 1 as const },
  scoreOf: { fontSize: 11, color: '#666' },
  scoreMetrics: { display: 'flex', flexWrap: 'wrap' as const, gap: 12, flex: 1 },
  sm: { display: 'flex', flexDirection: 'column' as const, gap: 1 },
  smLabel: { fontSize: 10, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  smValue: { fontSize: 15, fontWeight: 700, color: '#fff' },
  smSub: { fontSize: 10, color: '#666' },
  feasCard: { background: '#161616', borderRadius: 12, padding: 16, marginBottom: 20 },
  feasHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  feasGoal: { fontSize: 13, color: '#a0a0a0', fontWeight: 600 },
  feasVerdict: { fontSize: 14, fontWeight: 700 },
  feasSummary: { fontSize: 13, color: '#b0b0b0', lineHeight: 1.5 as const, margin: '0 0 8px' },
  feasStats: { display: 'flex', gap: 16, fontSize: 13, color: '#888' },
  section: { marginBottom: 16 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 },
  equipToggle: { display: 'flex', gap: 6 },
  equipBtn: { padding: '5px 12px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 6, color: '#a0a0a0', cursor: 'pointer', fontSize: 12 },
  equipActive: { background: '#2d6a4f', border: '1px solid #2d6a4f', color: '#fff' },
  exGroup: { background: '#161616', borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
  exHead: { width: '100%', background: 'none', border: 'none', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#e0e0e0', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' as const },
  exRow: { borderTop: '1px solid #222', padding: '10px 0' },
  exName: { fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 },
  exDetail: { fontSize: 12, color: '#888' },
  exTip: { fontSize: 11, color: '#52b788', marginTop: 4 },
  reset: { marginTop: 8, background: 'transparent', border: '1px solid #333', borderRadius: 8, color: '#a0a0a0', padding: '10px 20px', cursor: 'pointer', fontSize: 14 },
} as const
