import { useState } from 'react'

const INTRO_KEY = 'bb_intro_seen_v1'

const C = {
  bg: 'rgba(7,7,6,0.88)',
  card: '#0d0c0a',
  sur2: '#141210',
  bdr: '#2a2825',
  cream: '#f0ede6',
  mut: '#6b6860',
  red: '#E8341A',
  cyan: '#06b6d4',
  grn: '#2dba6e',
}

const STEPS = [
  {
    n: '01',
    title: 'Paste the client staging URL',
    body: 'On New Client Audit, switch to Client staging API and paste their HTTPS chat endpoint. Add bearer token only if required — it is cleared after the run and never stored.',
  },
  {
    n: '02',
    title: 'Run probes (start small)',
    body: 'Confirm written authorization, pick an industry pack, then run 3 connectivity probes or an 8-probe pilot. Practice anytime on the internal demo bot.',
  },
  {
    n: '03',
    title: 'You verify — then export Final',
    body: 'Raw AI logs are not auditor-ready. Confirm FAIL / mark false positives, set Draft → Reviewed → Final, then export the HTML report for the client.',
  },
]

export function introAlreadySeen() {
  try {
    return localStorage.getItem(INTRO_KEY) === '1'
  } catch {
    return false
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(INTRO_KEY, '1')
  } catch {}
}

/**
 * @param {{ open: boolean, onClose: () => void, onStartClient: () => void, onPracticeDemo: () => void }} props
 */
export default function DashboardIntro({ open, onClose, onStartClient, onPracticeDemo }) {
  const [step, setStep] = useState(0)
  if (!open) return null

  const finish = (fn) => {
    markIntroSeen()
    fn?.()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bb-intro-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: C.bg, backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) finish() }}
    >
      <div
        style={{
          width: '100%', maxWidth: 560, background: C.card,
          border: `1px solid ${C.bdr}`, borderRadius: 14, padding: 28,
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
        }}
      >
        <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: C.cyan, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 8 }}>
          How BreakBot audits work
        </p>
        <h2 id="bb-intro-title" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 24, color: C.cream, fontWeight: 600, margin: '0 0 8px', lineHeight: 1.25 }}>
          Client link → probes → human review → Final report
        </h2>
        <p style={{ color: C.mut, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
          Automated probes find raw issues. Regulated clients need <strong style={{ color: C.cream }}>your</strong> verification before anything is delivered.
        </p>

        {/* Flow strip */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22, alignItems: 'center' }}>
          {['URL', 'Probes', 'Human review', 'Final report'].map((label, i) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, padding: '5px 10px',
                borderRadius: 6, background: i === step ? 'rgba(6,182,212,.15)' : C.sur2,
                color: i === step ? C.cyan : C.mut, border: `1px solid ${i === step ? C.cyan : C.bdr}`,
              }}>{label}</span>
              {i < 3 && <span style={{ color: C.mut, fontSize: 12 }}>→</span>}
            </span>
          ))}
        </div>

        <div style={{ background: C.sur2, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 16, marginBottom: 18, minHeight: 110 }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.red, marginBottom: 6 }}>{STEPS[step].n}</div>
          <div style={{ color: C.cream, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{STEPS[step].title}</div>
          <div style={{ color: C.mut, fontSize: 13, lineHeight: 1.55 }}>{STEPS[step].body}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Step ${i + 1}`}
              style={{
                flex: 1, height: 4, border: 'none', borderRadius: 2, cursor: 'pointer',
                background: i === step ? C.cyan : C.bdr,
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {['Model-neutral', 'Human-verified', 'Auditor-ready'].map((chip) => (
            <span key={chip} style={{
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '.06em',
              textTransform: 'uppercase', padding: '5px 10px', borderRadius: 20,
              background: 'rgba(45,186,110,.1)', color: C.grn, border: '1px solid rgba(45,186,110,.25)',
            }}>{chip}</span>
          ))}
          <span style={{
            fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '.06em',
            textTransform: 'uppercase', padding: '5px 10px', borderRadius: 20,
            background: C.sur2, color: C.mut, border: `1px solid ${C.bdr}`,
          }}>Tool / MCP sandbox · coming next</span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => finish(onStartClient)}
            style={{
              flex: 1, minWidth: 160, background: C.cyan, color: '#000', border: 'none',
              padding: '12px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13,
            }}
          >
            Start a client audit
          </button>
          <button
            type="button"
            onClick={() => finish(onPracticeDemo)}
            style={{
              flex: 1, minWidth: 140, background: 'transparent', color: C.cream,
              border: `1px solid ${C.bdr}`, padding: '12px 16px', borderRadius: 8,
              fontWeight: 600, cursor: 'pointer', fontSize: 13,
            }}
          >
            Practice on demo bot
          </button>
        </div>
        <button
          type="button"
          onClick={() => { if (step < STEPS.length - 1) setStep(step + 1); else finish() }}
          style={{
            display: 'block', width: '100%', marginTop: 10, background: 'transparent',
            border: 'none', color: C.mut, fontSize: 11, cursor: 'pointer',
            fontFamily: "'IBM Plex Mono',monospace",
          }}
        >
          {step < STEPS.length - 1 ? 'Next step →' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}
