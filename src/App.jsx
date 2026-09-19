import { useState, useEffect } from 'react'
import Website from './pages/Website.jsx'
import MarketingOS from './pages/MarketingOS.jsx'
import DashboardGate from './components/DashboardGate.jsx'
import { getDashboardKey } from './lib/api.js'

const DASHBOARD_SECRET = import.meta.env.VITE_DASHBOARD_PATH || 'bb-command-2026'

export default function App() {
  const [page, setPage] = useState('website')
  const [unlocked, setUnlocked] = useState(() => Boolean(getDashboardKey()))

  useEffect(() => {
    const path = window.location.pathname.replace(/^\//, '')
    if (path === DASHBOARD_SECRET) setPage('dashboard')
    else setPage('website')
  }, [])

  window._nav = (p) => {
    window.history.pushState({}, '', '/' + p)
    if (p === DASHBOARD_SECRET) setPage('dashboard')
    else setPage('website')
  }

  if (page === 'dashboard') {
    if (!unlocked) return <DashboardGate />
    return <MarketingOS onLock={() => setUnlocked(false)} />
  }
  return <Website />
}
