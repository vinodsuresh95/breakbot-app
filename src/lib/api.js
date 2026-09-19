const API = import.meta.env.VITE_API_URL || '/api'
const KEY_STORAGE = 'bb_dashboard_key'

export function getDashboardKey() {
  try {
    return sessionStorage.getItem(KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

export function setDashboardKey(key) {
  sessionStorage.setItem(KEY_STORAGE, key)
}

export function clearDashboardKey() {
  sessionStorage.removeItem(KEY_STORAGE)
}

function authHeaders(extra = {}) {
  const key = getDashboardKey()
  return {
    'Content-Type': 'application/json',
    ...(key ? { 'X-Dashboard-Key': key } : {}),
    ...extra,
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: authHeaders(options.headers),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || data.error || `Request failed (${res.status})`)
  return data
}

export async function checkHealth() {
  try {
    const data = await request('/health')
    return data.status === 'ok'
  } catch {
    return false
  }
}

export async function verifyDashboardKey(key) {
  const res = await fetch(`${API}/auth/verify`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Dashboard-Key': key,
    },
  })
  if (!res.ok) return false
  const data = await res.json().catch(() => ({}))
  return data.ok === true
}

export async function dashboardAuthRequired() {
  try {
    const data = await request('/health')
    return Boolean(data.dashboard_auth_required)
  } catch {
    return true
  }
}

export async function runAgent(agentId, prospect) {
  return request('/agents/run', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, prospect }),
  })
}

export async function chatAgent(agentId, messages, prospect = null) {
  return request('/agents/chat', {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, messages, prospect }),
  })
}

export async function generateBrief(pipelineContext) {
  return request('/brief', {
    method: 'POST',
    body: JSON.stringify({ context: pipelineContext }),
  })
}

export async function sendEmail({ to, subject, body, prospectId, company }) {
  return request('/email/send', {
    method: 'POST',
    body: JSON.stringify({ to, subject, body, prospect_id: prospectId, company }),
  })
}

export async function runOutreachFlow(prospect, { autoSend = false, steps = null } = {}) {
  return request('/outreach/run', {
    method: 'POST',
    body: JSON.stringify({ prospect, auto_send: autoSend, steps }),
  })
}

export async function submitWaitlist(data) {
  return request('/waitlist', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function runDailyAutomation(prospects) {
  return request('/automation/daily', {
    method: 'POST',
    body: JSON.stringify({ prospects }),
  })
}

export async function fetchProbeLibrary() {
  return request('/probes/library')
}

export async function pingAuditTarget(target) {
  return request('/audit/ping', { method: 'POST', body: JSON.stringify({ target }) })
}

export async function runSecurityAudit(payload) {
  return request('/audit/run', { method: 'POST', body: JSON.stringify(payload) })
}

export async function listAudits(limit = 20) {
  return request(`/audit?limit=${limit}`)
}

export async function getAudit(auditId) {
  return request(`/audit/${auditId}`)
}
