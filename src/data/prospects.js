/** Demo prospect records only — add real leads via the dashboard or your CRM. */

export const PROSPECTS = [
  {
    id: 1,
    company: "Acme Fintech",
    country: "🇮🇳 India",
    industry: "Fintech",
    contact: "Demo Contact",
    title: "CTO",
    email: "cto@example.com",
    linkedin: "",
    chatbot: "Customer support bot on website",
    stage: "researched",
    score: 72,
    tier: "B",
    notes: "Sample record for dashboard demo",
    history: [],
    addedAt: new Date().toISOString(),
  },
  {
    id: 2,
    company: "Nova SaaS",
    country: "🇺🇸 USA",
    industry: "SaaS",
    contact: "Demo Lead",
    title: "Head of AI",
    email: "ai@example.com",
    linkedin: "",
    chatbot: "In-app copilot for enterprise admins",
    stage: "drafted",
    score: 81,
    tier: "A",
    notes: "Sample record for dashboard demo",
    history: [],
    addedAt: new Date().toISOString(),
  },
]

export function normalizeLinkedIn(url) {
  if (!url || url === "—") return ""
  const trimmed = url.trim()
  if (trimmed.startsWith("http")) return trimmed
  return `https://${trimmed.replace(/^\/\//, "")}`
}

export function loadProspects(storage) {
  const saved = storage.get("bb_prospects", null)
  return saved?.length ? saved : PROSPECTS
}
