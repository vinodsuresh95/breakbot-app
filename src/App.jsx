import { useState, useEffect } from 'react'
import Website from './pages/Website.jsx'
import MarketingOS from './pages/MarketingOS.jsx'
import DashboardGate from './components/DashboardGate.jsx'
import { getDashboardKey, clearDashboardKey, verifyDashboardKey } from './lib/api.js'

const DASHBOARD_PATH = import.meta.env.VITE_DASHBOARD_PATH || 'bb-command-2026'
export default function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [access, setAccess] = useState('checking')
  useEffect(() => {
    const navigate = () => setPath(window.location.pathname)
    window.addEventListener('popstate', navigate)
    window._nav = p => { window.history.pushState({}, '', '/' + p); navigate() }
    return () => { window.removeEventListener('popstate', navigate); delete window._nav }
  }, [])
  useEffect(() => {
    if (path !== '/' + DASHBOARD_PATH) return
    let active = true
    verifyDashboardKey(getDashboardKey()).then(ok => {
      if (!active) return
      if (!ok) clearDashboardKey()
      setAccess(ok ? 'open' : 'locked')
    }).catch(() => { if (active) setAccess('locked') })
    return () => { active = false }
  }, [path])
  if (path !== '/' + DASHBOARD_PATH) return <Website />
  if (access === 'checking') return <p style={{padding:32}}>Checking dashboard access…</p>
  if (access !== 'open') return <DashboardGate />
  return <><button onClick={() => {clearDashboardKey(); setAccess('locked')}} style={{position:'fixed',bottom:12,right:20,zIndex:1000}}>Lock dashboard</button><MarketingOS /></>
}
