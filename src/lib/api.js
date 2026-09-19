const API = import.meta.env.VITE_API_URL || '/api'

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
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
