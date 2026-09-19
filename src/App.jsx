import { useState, useEffect } from 'react'
import Website from './pages/Website.jsx'
import MarketingOS from './pages/MarketingOS.jsx'

// Dashboard is at secret URL only — not linked publicly
const DASHBOARD_SECRET = 'bb-command-2026'

export default function App() {
  const [page, setPage] = useState('website')

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

  if (page === 'dashboard') return <MarketingOS />
  return <Website />
}
