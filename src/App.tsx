import { useState } from 'react'
import { AssessmentForm } from './components/AssessmentForm'
import { Results } from './components/Results'
import type { Build, Phase } from './types'

export default function App() {
  const [phase, setPhase] = useState<Phase>('form')
  const [build, setBuild] = useState<Build | null>(null)

  function handleSubmit(b: Build) {
    setBuild(b)
    setPhase('result')
  }

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <span style={styles.logo}>🏋️ fit-lab</span>
        <span style={styles.tagline}>Honest fitness for India</span>
      </header>

      <main style={styles.main}>
        {phase === 'form' && <AssessmentForm onSubmit={handleSubmit} />}
        {phase === 'result' && build && (
          <Results build={build} onReset={() => setPhase('form')} />
        )}
      </main>
    </div>
  )
}

const styles = {
  root: {
    minHeight: '100vh',
    background: '#0d0d0d',
    color: '#e0e0e0',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #1e1e1e',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: 'system-ui, sans-serif',
    color: '#fff',
  },
  tagline: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'system-ui, sans-serif',
  },
  main: {
    padding: '0 0 60px',
  },
} as const
