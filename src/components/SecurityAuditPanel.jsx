import { useState, useEffect } from 'react'
import * as backend from '../lib/api.js'
import { INDUSTRY_PACKS } from '../data/industryPacks.js'

const C = {
  sur: '#141210', sur2: '#1a1814', bdr: '#2a2825', cream: '#f0ede6', mut: '#6b6860',
  grn: '#2dba6e', red: '#E8341A', amb: '#e09a20', cyan: '#06b6d4',
}

export default function SecurityAuditPanel() {
  const [mode, setMode] = useState('demobot')
  const [url, setUrl] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [industryPack, setIndustryPack] = useState('FIN')
  const [maxProbes, setMaxProbes] = useState(8)
  const [authorized, setAuthorized] = useState(false)
  const [authNotes, setAuthNotes] = useState('')
  const [testingWindow, setTestingWindow] = useState('')
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const refreshHistory = () =>
    backend.listAudits(15).then((r) => setHistory(r.audits || [])).catch(() => {})

  useEffect(() => { refreshHistory() }, [report])

  const runAudit = async () => {
    setError('')
    setRunning(true)
    setReport(null)
    try {
      const result = await backend.runSecurityAudit({
        customer_name: customerName || 'Unnamed target',
        industry_pack: industryPack || null,
        max_probes: maxProbes,
        authorization_confirmed: authorized,
        authorization_notes: authNotes,
        testing_window: testingWindow,
        target: {
          mode,
          url: mode === 'http_json' ? url : '',
          message_field: 'message',
          response_field: 'response',
        },
      })
      setReport(result)
      if (result.status === 'failed') setError(result.error || 'Audit failed')
    } catch (e) {
      setError(e.message || 'Audit failed')
    } finally {
      setRunning(false)
    }
  }

  const review = async (probeId, review_status, reviewer_verdict = null) => {
    if (!report?.audit_id) return
    setBusy(probeId)
    try {
      const notes = window.prompt('Reviewer notes (optional)', '') ?? ''
      const updated = await backend.reviewFinding(report.audit_id, {
        probe_id: probeId,
        review_status,
        reviewer_verdict,
        reviewer_notes: notes,
      })
      setReport(updated)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const setStatus = async (report_status) => {
    if (!report?.audit_id) return
    try {
      setReport(await backend.setAuditReportStatus(report.audit_id, report_status))
    } catch (e) {
      setError(e.message)
    }
  }

  const doExport = async () => {
    if (!report?.audit_id) return
    try {
      await backend.downloadAuditReport(report.audit_id, true)
    } catch (e) {
      setError(e.message)
    }
  }

  const doStrip = async () => {
    if (!report?.audit_id) return
    if (!window.confirm('Delete probe/response evidence from this audit?')) return
    try {
      setReport(await backend.stripAuditEvidence(report.audit_id))
    } catch (e) {
      setError(e.message)
    }
  }

  const doDelete = async () => {
    if (!report?.audit_id) return
    if (!window.confirm('Permanently delete this audit and all findings?')) return
    try {
      await backend.deleteAudit(report.audit_id)
      setReport(null)
      refreshHistory()
    } catch (e) {
      setError(e.message)
    }
  }

  const cost = report?.cost || {}
  const score = report?.reviewed_summary || report?.summary || {}

  return (
    <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
      <p style={{ color: C.mut, fontSize: 12, maxWidth: 720, lineHeight: 1.6, marginBottom: 16 }}>
        <strong style={{ color: C.cream }}>Local Client Audit Edition</strong> — run on your Mac only (127.0.0.1).
        Always get written authorization, review every FAIL/PARTIAL yourself, then export a client report.
        Never send raw AI output without review.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 980 }}>
        <div style={{ background: C.sur, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 16 }}>
          <label style={lbl}>Target mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={inp}>
            <option value="demobot">Internal demo bot (practice)</option>
            <option value="http_json">Client staging HTTP API</option>
          </select>

          {mode === 'http_json' && (
            <>
              <label style={lbl}>Staging chatbot URL</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://staging.client.com/chat" style={inp} />
            </>
          )}

          <label style={lbl}>Client / project name</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Acme Corp pilot" style={inp} />

          <label style={lbl}>Industry pack</label>
          <select value={industryPack} onChange={(e) => setIndustryPack(e.target.value)} style={inp}>
            {INDUSTRY_PACKS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <label style={lbl}>Probe count ({maxProbes}) — start with 3–8, then 25–50</label>
          <input type="range" min={3} max={50} value={maxProbes} onChange={(e) => setMaxProbes(Number(e.target.value))} style={{ width: '100%' }} />

          <label style={lbl}>Authorization notes</label>
          <input value={authNotes} onChange={(e) => setAuthNotes(e.target.value)} placeholder="Email from CTO 19 Sep — staging only" style={inp} />

          <label style={lbl}>Testing window</label>
          <input value={testingWindow} onChange={(e) => setTestingWindow(e.target.value)} placeholder="19 Sep 10:00–14:00 IST" style={inp} />

          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />
            Written authorization confirmed for this staging target
          </label>

          <button type="button" onClick={runAudit} disabled={running || !authorized} style={btn}>
            {running ? 'Running audit…' : 'Run security audit'}
          </button>
          {error && <p style={{ color: C.red, fontSize: 11, marginTop: 10 }}>{error}</p>}
        </div>

        <div style={{ background: C.sur, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.mut, marginBottom: 8 }}>Recent audits (local disk only)</div>
          {history.length === 0 && <p style={{ color: C.mut, fontSize: 11 }}>No audits yet.</p>}
          {history.map((a) => (
            <button
              key={a.audit_id}
              type="button"
              onClick={() => backend.getAudit(a.audit_id).then(setReport).catch(() => {})}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: C.sur2, border: `1px solid ${C.bdr}`, borderRadius: 6, padding: 8, marginBottom: 6, color: C.cream, cursor: 'pointer', fontSize: 11 }}
            >
              {a.customer_name || 'Audit'} · {a.report_status || 'Draft'} · score {a.security_score ?? '—'}
              {a.estimated_usd != null && <> · ~${a.estimated_usd}</>}
            </button>
          ))}
        </div>
      </div>

      {report && report.status === 'completed' && (
        <div style={{ marginTop: 20, maxWidth: 980 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.cream }}>Report: <strong>{report.report_status || 'Draft'}</strong></span>
            <button type="button" style={smBtn} onClick={() => setStatus('Draft')}>Draft</button>
            <button type="button" style={smBtn} onClick={() => setStatus('Reviewed')}>Reviewed</button>
            <button type="button" style={{ ...smBtn, background: C.grn, color: '#000' }} onClick={() => setStatus('Final')}>Final</button>
            <button type="button" style={smBtn} onClick={doExport}>Export HTML report</button>
            <button type="button" style={smBtn} onClick={doStrip}>Delete evidence</button>
            <button type="button" style={{ ...smBtn, borderColor: C.red, color: C.red }} onClick={doDelete}>Delete audit</button>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <Stat label="Score" value={`${score.score ?? '—'}/100`} sub={`Grade ${score.grade || '—'}`} />
            <Stat label="Fails" value={score.fail_count} color={C.red} />
            <Stat label="Partial" value={score.partial_count} color={C.amb} />
            <Stat label="Pass" value={score.pass_count} color={C.grn} />
            <Stat label="Duration" value={`${cost.duration_seconds ?? '—'}s`} />
            <Stat label="Est. API $" value={`$${cost.estimated_usd ?? 0}`} sub={`${cost.calls || 0} Claude calls`} />
            <Stat label="Verified vulns" value={cost.verified_vuln_count ?? 0} />
            <Stat label="False positives" value={cost.false_positive_count ?? 0} />
          </div>

          <h3 style={h3}>Manual review — confirm or mark false positive before export</h3>
          {(report.findings || []).map((f, i) => (
            <div key={i} style={{ background: C.sur, border: `1px solid ${C.bdr}`, borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ color: f.verdict === 'FAIL' ? C.red : f.verdict === 'PASS' ? C.grn : C.amb, fontWeight: 700 }}>AI: {f.verdict}</span>
                <span style={{ color: C.mut }}>{f.probe_id} · {f.severity}</span>
                <span style={{ color: C.cyan }}>Review: {f.review_status || 'pending'}</span>
                {f.reviewer_verdict && <span style={{ color: C.cream }}>→ {f.reviewer_verdict}</span>}
              </div>
              <div style={{ color: C.cream, marginBottom: 6 }}>{f.reason}</div>
              <div style={{ color: C.mut, marginBottom: 4 }}><strong>Probe:</strong> {f.probe_prompt?.slice(0, 220)}</div>
              <div style={{ color: C.mut, marginBottom: 8, whiteSpace: 'pre-wrap' }}><strong>Response:</strong> {f.bot_response?.slice(0, 400)}</div>
              {f.reviewer_notes && <div style={{ color: C.amb, marginBottom: 8 }}>Notes: {f.reviewer_notes}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy === f.probe_id} style={smBtn} onClick={() => review(f.probe_id, 'confirmed', 'FAIL')}>Confirm FAIL</button>
                <button type="button" disabled={busy === f.probe_id} style={smBtn} onClick={() => review(f.probe_id, 'confirmed', 'PARTIAL')}>Confirm PARTIAL</button>
                <button type="button" disabled={busy === f.probe_id} style={smBtn} onClick={() => review(f.probe_id, 'false_positive', 'PASS')}>False positive</button>
                <button type="button" disabled={busy === f.probe_id} style={smBtn} onClick={() => review(f.probe_id, 'excluded')}>Exclude</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.sur2, border: `1px solid ${C.bdr}`, borderRadius: 8, padding: '10px 14px', minWidth: 90 }}>
      <div style={{ fontSize: 9, color: C.mut, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || C.cream }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.mut }}>{sub}</div>}
    </div>
  )
}

const lbl = { display: 'block', fontSize: 9, color: C.mut, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 10, marginBottom: 4 }
const inp = { width: '100%', background: '#0d0c0a', border: `1px solid ${C.bdr}`, color: C.cream, padding: '8px 10px', borderRadius: 6, fontSize: 12 }
const btn = { marginTop: 14, width: '100%', background: C.cyan, color: '#000', border: 'none', padding: 12, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }
const smBtn = { background: C.sur2, border: `1px solid ${C.bdr}`, color: C.cream, padding: '6px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer' }
const h3 = { color: C.cream, fontSize: 14, margin: '16px 0 8px' }
