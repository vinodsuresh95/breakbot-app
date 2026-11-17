import { useState } from 'react'

// Netlify functions. Locally they run under `netlify dev` (port 8888), proxied by Vite.
const FN = '/.netlify/functions'

const STATUS_LABEL = { queued: 'Queued', running: 'Attacking…', error: 'No reply' }

// fetch() throws a TypeError when the server can't be reached at all.
function friendly(err, fallback) {
  if (err instanceof TypeError) return "Couldn't reach the BreakBot server. Check your connection and try again."
  return err.message || fallback
}

async function readError(res, fallback) {
  const data = await res.json().catch(() => ({}))
  return data.error || fallback
}

function ProbeCard({ item }) {
  const [open, setOpen] = useState(false)
  const r = item.result
  const badge = r ? r.verdict : STATUS_LABEL[item.status]
  const badgeClass = r ? `v-${r.verdict.toLowerCase()}` : `s-${item.status}`
  return (
    <div className={`demo-card ${r ? 'is-done' : ''}`}>
      <div className="demo-card-head">
        <span className={`demo-badge ${badgeClass}`}>{badge}</span>
        <div className="demo-card-title">
          <strong>{item.title}</strong>
          <span>{item.category} · {item.severity}</span>
        </div>
        {r && (
          <button type="button" className="demo-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            {open ? 'Hide' : 'Details'}
          </button>
        )}
      </div>
      {r && <p className="demo-reason">{r.reason}</p>}
      {r && open && (
        <div className="demo-evidence">
          <p className="demo-ev-lbl">Attack sent</p>
          <pre>{r.prompt}</pre>
          <p className="demo-ev-lbl">Bot replied</p>
          <pre>{r.response || '(empty reply)'}</pre>
        </div>
      )}
    </div>
  )
}

export default function LiveDemo() {
  const [phase, setPhase] = useState('idle') // idle | running | done
  const [items, setItems] = useState([])
  const [runError, setRunError] = useState('')
  const [report, setReport] = useState({ state: 'idle', error: '' }) // idle | sending | sent

  const update = (id, patch) => setItems(list => list.map(it => (it.id === id ? { ...it, ...patch } : it)))

  const run = async () => {
    setPhase('running')
    setRunError('')
    setReport({ state: 'idle', error: '' })
    try {
      const res = await fetch(`${FN}/demo-probe`)
      if (!res.ok) throw new Error(await readError(res, 'The demo is unavailable right now.'))
      const { probes } = await res.json()
      setItems(probes.map(p => ({ ...p, status: 'queued', result: null })))

      for (const p of probes) {
        update(p.id, { status: 'running' })
        const r = await fetch(`${FN}/demo-probe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.id }),
        })
        if (r.status === 429) {
          update(p.id, { status: 'queued' })
          throw new Error(await readError(r, 'Too many demo runs. Please try again shortly.'))
        }
        if (!r.ok) {
          update(p.id, { status: 'error' })
          continue
        }
        const { result } = await r.json()
        update(p.id, { status: 'done', result })
      }
    } catch (err) {
      setRunError(friendly(err, 'Something went wrong. Please try again.'))
    }
    setPhase('done')
  }

  const done = items.filter(it => it.result)
  const failed = done.filter(it => it.result.verdict === 'FAIL').length
  const partial = done.filter(it => it.result.verdict === 'PARTIAL').length

  const requestReport = async (e) => {
    e.preventDefault()
    const form = e.target
    setReport({ state: 'sending', error: '' })
    try {
      const res = await fetch(`${FN}/demo-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.value,
          company: form.company.value,
          results: done.map(({ result: { id, verdict, reason, response } }) => ({ id, verdict, reason, response })),
        }),
      })
      if (!res.ok) throw new Error(await readError(res, 'Could not build your report. Please try again.'))
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = 'BreakBot-Executive-Summary.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setReport({ state: 'sent', error: '' })
    } catch (err) {
      setReport({ state: 'idle', error: friendly(err, 'Could not build your report. Please try again.') })
    }
  }

  return (
    <section className="demo-sec" id="demo">
      <div className="container">
        <div className="reveal">
          <p className="sec-label">Live demo</p>
          <h2 className="sec-title">Watch BreakBot attack<br/><em>a real AI support bot.</em></h2>
          <p className="sec-sub">
            Aria is a support bot for AcmeCorp, a fictional bank. It runs on a production LLM with a typical real-world
            setup: internal notes, offer codes and authority to issue credits. Run 5 live attacks and see which ones get through.
          </p>
        </div>

        <div className="demo-box reveal">
          {phase === 'idle' && (
            <div className="demo-start">
              <button className="btn-primary" type="button" onClick={run}>Run 5 live attacks ↗</button>
              <p className="demo-note">Takes about 30 seconds · No signup needed to watch</p>
            </div>
          )}

          {items.length > 0 && (
            <div className="demo-list">
              {items.map(it => <ProbeCard key={it.id} item={it} />)}
            </div>
          )}

          {runError && <p className="demo-error" role="alert">{runError}</p>}

          {phase === 'done' && done.length > 0 && (
            <div className="demo-result">
              <p className="demo-score">
                <strong className={failed ? 'bad' : 'good'}>{failed} of {done.length}</strong> attacks succeeded
                {partial > 0 && <>, {partial} partially</>}
              </p>

              {report.state !== 'sent' ? (
                <form className="demo-form" onSubmit={requestReport}>
                  <p className="demo-form-title">Get the Executive Security Summary (PDF)</p>
                  <p className="demo-form-sub">Top findings with the exact attack, the bot's reply, and the recommended fix.</p>
                  <div className="demo-form-row">
                    <input className="wl-inp" name="email" type="email" placeholder="Work email" required aria-label="Work email" />
                    <input className="wl-inp" name="company" type="text" placeholder="Company (optional)" aria-label="Company" />
                    <button className="wl-submit demo-submit" type="submit" disabled={report.state === 'sending'}>
                      {report.state === 'sending' ? 'Building PDF…' : 'Download PDF →'}
                    </button>
                  </div>
                  {report.error && <p className="demo-error" role="alert">{report.error}</p>}
                  <p className="demo-note">We save your email so we can follow up about BreakBot. No spam.</p>
                </form>
              ) : (
                <div className="demo-sent">
                  <p>✓ Your summary is downloading.</p>
                  <a href="#waitlist" className="btn-secondary">Run this on your own bot →</a>
                </div>
              )}

              <button className="demo-rerun" type="button" onClick={run}>Run the attacks again</button>
            </div>
          )}

          {phase === 'done' && done.length === 0 && !runError && (
            <p className="demo-error" role="alert">The demo bot didn't respond. Please try again in a minute.</p>
          )}
          {phase === 'done' && done.length === 0 && (
            <button className="demo-rerun" type="button" onClick={run}>Try again</button>
          )}
        </div>
      </div>
    </section>
  )
}
