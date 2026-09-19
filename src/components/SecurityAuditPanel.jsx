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
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    backend.listAudits(10).then((r) => setHistory(r.audits || [])).catch(() => {})
  }, [report])

  const runAudit = async () => {
    setError('')
    setRunning(true)
    setReport(null)
    try {
      const payload = {
        customer_name: customerName || 'Unnamed target',
        industry_pack: industryPack || null,
        max_probes: maxProbes,
        authorization_confirmed: authorized,
        target: {
          mode,
          url: mode === 'http_json' ? url : '',
          message_field: 'message',
          response_field: 'response',
        },
      }
      const result = await backend.runSecurityAudit(payload)
      setReport(result)
      if (result.status === 'failed') setError(result.error || 'Audit failed')
    } catch (e) {
      setError(e.message || 'Audit failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
      <p style={{ color: C.mut, fontSize: 12, maxWidth: 640, lineHeight: 1.6, marginBottom: 16 }}>
        Security Engine v1 — runs selected probes against an <strong style={{ color: C.cream }}>authorized</strong> target,
        captures responses, evaluates with rules + AI judge, and stores a reproducible report.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>
        <div style={{ background: C.sur, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 16 }}>
          <label style={lbl}>Target mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={inp}>
            <option value="demobot">Internal demo bot (test engine)</option>
            <option value="http_json">Customer HTTP API</option>
          </select>

          {mode === 'http_json' && (
            <>
              <label style={lbl}>Chatbot API URL</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.customer.com/chat" style={inp} />
              <p style={hint}>POST JSON: {`{"message":"..."}`} → read {`response`} field</p>
            </>
          )}

          <label style={lbl}>Customer / project name</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Acme Corp pilot" style={inp} />

          <label style={lbl}>Industry pack</label>
          <select value={industryPack} onChange={(e) => setIndustryPack(e.target.value)} style={inp}>
            {INDUSTRY_PACKS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <label style={lbl}>Max probes this run ({maxProbes})</label>
          <input type="range" min={3} max={25} value={maxProbes} onChange={(e) => setMaxProbes(Number(e.target.value))} style={{ width: '100%' }} />

          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />
            I confirm I have authorization to test this target
          </label>

          <button type="button" onClick={runAudit} disabled={running || !authorized} style={btn}>
            {running ? 'Running audit…' : 'Run security audit'}
          </button>
          {error && <p style={{ color: C.red, fontSize: 11, marginTop: 10 }}>{error}</p>}
        </div>

        <div style={{ background: C.sur, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.mut, marginBottom: 8 }}>Recent audits</div>
          {history.length === 0 && <p style={{ color: C.mut, fontSize: 11 }}>No audits yet.</p>}
          {history.map((a) => (
            <button
              key={a.audit_id}
              type="button"
              onClick={() => backend.getAudit(a.audit_id).then(setReport).catch(() => {})}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: C.sur2, border: `1px solid ${C.bdr}`, borderRadius: 6, padding: 8, marginBottom: 6, color: C.cream, cursor: 'pointer', fontSize: 11 }}
            >
              {a.customer_name || 'Audit'} · score {a.security_score ?? '—'} · {a.probe_count ?? 0} probes
            </button>
          ))}
        </div>
      </div>

      {report && report.status === 'completed' && (
        <div style={{ marginTop: 20, maxWidth: 960 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <Stat label="Security score" value={`${report.summary?.score ?? '—'}/100`} sub={`Grade ${report.summary?.grade}`} />
            <Stat label="Fails" value={report.summary?.fail_count} color={C.red} />
            <Stat label="Partial" value={report.summary?.partial_count} color={C.amb} />
            <Stat label="Pass" value={report.summary?.pass_count} color={C.grn} />
            <Stat label="Probes run" value={report.probes_executed} />
          </div>

          {report.critical_findings?.length > 0 && (
            <>
              <h3 style={h3}>Critical failures</h3>
              {report.critical_findings.map((f, i) => (
                <Finding key={i} f={f} />
              ))}
            </>
          )}

          <h3 style={h3}>All findings</h3>
          {(report.findings || []).map((f, i) => (
            <Finding key={i} f={f} compact />
          ))}

          {report.remediation?.length > 0 && (
            <>
              <h3 style={h3}>Remediation hints</h3>
              {report.remediation.map((r, i) => (
                <div key={i} style={{ fontSize: 11, color: C.mut, marginBottom: 8, paddingLeft: 8, borderLeft: `2px solid ${C.cyan}` }}>
                  <strong style={{ color: C.cream }}>{r.issue}</strong> — {r.recommendation}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.sur2, border: `1px solid ${C.bdr}`, borderRadius: 8, padding: '10px 14px', minWidth: 100 }}>
      <div style={{ fontSize: 9, color: C.mut, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || C.cream }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.mut }}>{sub}</div>}
    </div>
  )
}

function Finding({ f, compact }) {
  const vc = f.verdict === 'FAIL' ? C.red : f.verdict === 'PASS' ? C.grn : C.amb
  return (
    <div style={{ background: C.sur, border: `1px solid ${C.bdr}`, borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 11 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: vc, fontWeight: 700 }}>{f.verdict}</span>
        <span style={{ color: C.mut }}>{f.probe_id} · {f.severity}</span>
        <span style={{ color: C.mut }}>{Math.round((f.confidence || 0) * 100)}% conf</span>
      </div>
      {!compact && <div style={{ color: C.cream, marginBottom: 6 }}>{f.reason}</div>}
      <div style={{ color: C.mut, marginBottom: 4 }}><strong>Probe:</strong> {f.probe_prompt?.slice(0, 200)}{(f.probe_prompt?.length || 0) > 200 ? '…' : ''}</div>
      {!compact && (
        <div style={{ color: C.mut, whiteSpace: 'pre-wrap' }}><strong>Response:</strong> {f.bot_response?.slice(0, 500)}{(f.bot_response?.length || 0) > 500 ? '…' : ''}</div>
      )}
    </div>
  )
}

const lbl = { display: 'block', fontSize: 9, color: C.mut, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 10, marginBottom: 4 }
const inp = { width: '100%', background: '#0d0c0a', border: `1px solid ${C.bdr}`, color: C.cream, padding: '8px 10px', borderRadius: 6, fontSize: 12 }
const hint = { fontSize: 10, color: C.mut, marginTop: 4 }
const btn = { marginTop: 14, width: '100%', background: C.cyan, color: '#000', border: 'none', padding: 12, borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: 1 }
const h3 = { color: C.cream, fontSize: 14, margin: '16px 0 8px' }
