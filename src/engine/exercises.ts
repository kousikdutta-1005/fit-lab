import type { Build, MuscleGroup } from '../types'
import { computeBmi } from './score'

// ---------------------------------------------------------------------------
// Fitness tier derived from BMI + grip (if available)
// ---------------------------------------------------------------------------

type Tier = 'beginner' | 'intermediate' | 'advanced'

export function fitnessTier(build: Build): Tier {
  const bmi = computeBmi(build.weightKg, build.heightCm)
  // Basic heuristic — in future will factor in grip percentile
  if (bmi > 32 || bmi < 17) return 'beginner'
  if (bmi > 27) return 'beginner'
  return 'intermediate'
}

// ---------------------------------------------------------------------------
// Exercise database
// Each entry has gym (barbell/machine) and floor (bodyweight) variants
// ---------------------------------------------------------------------------

export function getPrescription(build: Build): MuscleGroup[] {
  const goal = build.goal
  const tier = fitnessTier(build)

  // Volume: beginners do less total sets
  const sets = tier === 'beginner' ? '2–3' : tier === 'intermediate' ? '3–4' : '4–5'
  const reps =
    goal === 'build-muscle' ? '8–12'
    : goal === 'lose-fat' ? '12–15'
    : goal === 'improve-cardio' ? '15–20'
    : '10–15'
  const rest =
    goal === 'build-muscle' ? '90 s'
    : goal === 'lose-fat' ? '45 s'
    : '60 s'

  const groups: MuscleGroup[] = [
    {
      name: 'Chest',
      emoji: '💪',
      gym: [
        { name: 'Barbell Bench Press', sets, reps, rest, tip: 'Retract scapulae before unracking' },
        { name: 'Incline Dumbbell Press', sets, reps, rest },
        { name: 'Cable Fly', sets, reps: '12–15', rest: '45 s' },
      ],
      floor: [
        { name: 'Push-Up', sets, reps, rest, tip: 'Full ROM — chest to 2 cm above floor' },
        { name: 'Wide Push-Up', sets, reps, rest },
        { name: 'Diamond Push-Up', sets, reps: '8–12', rest },
      ],
    },
    {
      name: 'Back',
      emoji: '🔙',
      gym: [
        { name: 'Barbell Row', sets, reps, rest, tip: 'Pull to lower chest, not upper' },
        { name: 'Lat Pulldown', sets, reps, rest },
        { name: 'Seated Cable Row', sets, reps, rest },
      ],
      floor: [
        { name: 'Inverted Row (under a table)', sets, reps, rest, tip: 'Keep body rigid' },
        { name: 'Superman Hold', sets, reps: '12 s hold', rest },
        { name: 'Resistance Band Row', sets, reps, rest },
      ],
    },
    {
      name: 'Legs',
      emoji: '🦵',
      gym: [
        { name: 'Barbell Squat', sets, reps, rest, tip: 'Break parallel; knees track toes' },
        { name: 'Romanian Deadlift', sets, reps, rest },
        { name: 'Leg Press', sets, reps, rest },
      ],
      floor: [
        { name: 'Bodyweight Squat', sets, reps, rest },
        { name: 'Bulgarian Split Squat', sets, reps, rest, tip: 'Rear foot on a chair' },
        { name: 'Glute Bridge', sets, reps, rest },
      ],
    },
    {
      name: 'Shoulders',
      emoji: '🎯',
      gym: [
        { name: 'Overhead Press', sets, reps, rest },
        { name: 'Lateral Raise', sets, reps: '12–15', rest: '45 s' },
        { name: 'Face Pull', sets, reps: '15–20', rest: '45 s', tip: 'Crucial for shoulder health' },
      ],
      floor: [
        { name: 'Pike Push-Up', sets, reps, rest },
        { name: 'Band Lateral Raise', sets, reps: '15', rest: '45 s' },
        { name: 'Wall Handstand Hold', sets, reps: '20 s', rest },
      ],
    },
    {
      name: 'Arms',
      emoji: '💪',
      gym: [
        { name: 'Barbell Curl', sets, reps, rest },
        { name: 'Tricep Pushdown', sets, reps, rest },
        { name: 'Hammer Curl', sets, reps, rest },
      ],
      floor: [
        { name: 'Close-Grip Push-Up', sets, reps, rest },
        { name: 'Chin-Up (or Negative)', sets, reps: '5–8', rest, tip: 'Jump up, lower slowly if can\'t do full rep' },
        { name: 'Resistance Band Curl', sets, reps, rest },
      ],
    },
    {
      name: 'Core',
      emoji: '🎽',
      gym: [
        { name: 'Cable Crunch', sets, reps: '15–20', rest: '45 s' },
        { name: 'Hanging Leg Raise', sets, reps: '10–15', rest },
        { name: 'Plank', sets, reps: '30–60 s', rest: '45 s' },
      ],
      floor: [
        { name: 'Dead Bug', sets, reps: '10/side', rest: '45 s', tip: 'Keep lower back pressed to floor' },
        { name: 'Hollow Body Hold', sets, reps: '20–30 s', rest: '45 s' },
        { name: 'Plank', sets, reps: '30–60 s', rest: '45 s' },
      ],
    },
    {
      name: 'Cardio',
      emoji: '🏃',
      gym: [
        { name: 'Treadmill Incline Walk', sets: '1', reps: '20–30 min', rest: '—', tip: '5–7% incline, 5–6 km/h' },
        { name: 'Rowing Machine', sets: '1', reps: '15–20 min', rest: '—' },
        { name: 'Stationary Bike', sets: '1', reps: '20–30 min', rest: '—' },
      ],
      floor: [
        { name: 'Jump Rope', sets: '5', reps: '1 min on / 30 s off', rest: '30 s' },
        { name: 'Burpees', sets: '4', reps: '10', rest: '60 s' },
        { name: 'Brisk Walk / Jog', sets: '1', reps: '30 min', rest: '—', tip: 'Outside works perfectly' },
      ],
    },
  ]

  // For lose-fat / cardio goals, bump cardio to the top
  if (goal === 'lose-fat' || goal === 'improve-cardio') {
    const cardioIdx = groups.findIndex((g) => g.name === 'Cardio')
    if (cardioIdx > 0) groups.unshift(groups.splice(cardioIdx, 1)[0])
  }

  return groups
}
