import { useState, useEffect } from 'react'
import { setDashboardKey, verifyDashboardKey, dashboardAuthRequired } from '../lib/api.js'

export default function DashboardGate({ children }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    dashboardAuthRequired().then((required) => {
      if (!required) {
        setDashboardKey('dev')
        window.location.reload()
        return
      }
      setChecking(false)
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = await verifyDashboardKey(key.trim())
    setLoading(false)
    if (!ok) {
      setError('Invalid API key. Set DASHBOARD_API_KEY in backend/.env and enter the same value here.')
      return
    }
    setDashboardKey(key.trim())
    window.location.reload()
  }

  if (checking) {
    return (
      <div className="dash-gate">
        <div className="dash-gate-card"><p>Checking access…</p></div>
        <style>{`.dash-gate { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #030712; color: #94a3b8; }`}</style>
      </div>
    )
  }

  return (
    <div className="dash-gate">
      <div className="dash-gate-card">
        <p className="dash-gate-label">BreakBot Command</p>
        <h1>Dashboard access</h1>
        <p>Enter your dashboard API key. This protects agent runs, email send, and the probe library.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Dashboard API key"
            autoComplete="current-password"
            required
          />
          {error && <p className="dash-gate-error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Unlock dashboard'}
          </button>
        </form>
      </div>
      <style>{`
        .dash-gate { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #030712; color: #f1f5f9; font-family: 'JetBrains Mono', monospace; padding: 24px; }
        .dash-gate-card { width: 100%; max-width: 420px; background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 28px; }
        .dash-gate-label { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #22d3ee; margin-bottom: 10px; }
        .dash-gate h1 { font-family: 'Outfit', sans-serif; font-size: 28px; margin-bottom: 8px; }
        .dash-gate p { color: #94a3b8; font-size: 13px; line-height: 1.6; margin-bottom: 18px; }
        .dash-gate input { width: 100%; background: #030712; border: 1px solid #334155; color: #f1f5f9; padding: 11px 12px; border-radius: 8px; margin-bottom: 10px; }
        .dash-gate button { width: 100%; background: linear-gradient(135deg, #22d3ee, #06b6d4); color: #030712; border: none; padding: 12px; border-radius: 8px; font-weight: 700; cursor: pointer; }
        .dash-gate-error { color: #f87171; font-size: 12px; margin-bottom: 10px; }
      `}</style>
    </div>
  )
}
