/** Verified prospect records — source of truth for contact data. */
export const PROSPECTS = [
  {
    id: 1,
    company: "Wylth",
    country: "🇮🇳 India",
    industry: "Fintech",
    contact: "Rishabh Sood",
    title: "CTO",
    email: "rishabh@wylth.com",
    linkedin: "https://www.linkedin.com/in/rishabh-sood-8b784a14/",
    chatbot: "WhatsApp AI assistant serving 87k clients",
    stage: "researched",
    score: 88,
    tier: "A",
    notes: "",
    history: [],
    addedAt: new Date().toISOString(),
  },
  {
    id: 2,
    company: "BotCity",
    country: "🇧🇷 Brazil",
    industry: "AI Automation",
    contact: "Gabriel Archanjo",
    title: "CEO",
    email: "gabriel@botcity.dev",
    linkedin: "https://www.linkedin.com/in/gabrielarchanjo",
    chatbot: "Bot automation platform with AI agents",
    stage: "drafted",
    score: 74,
    tier: "B",
    notes: "",
    history: [],
    addedAt: new Date().toISOString(),
  },
  {
    id: 3,
    company: "Corezoid",
    country: "🇺🇦 Ukraine",
    industry: "Platform",
    contact: "Dmitry Makarichev",
    title: "CTO",
    email: "dmitry@corezoid.com",
    linkedin: "https://www.linkedin.com/in/dmitry-makarichev-97288733",
    chatbot: "Process orchestration + chatbot platform",
    stage: "sent",
    score: 71,
    tier: "B",
    notes: "",
    history: [{ date: "2026-08-01", action: "Email sent — initial outreach" }],
    addedAt: new Date().toISOString(),
  },
  {
    id: 4,
    company: "Optimize Financial",
    country: "🇺🇸 USA",
    industry: "Fintech",
    contact: "Curtis Raymond",
    title: "Head of AI",
    email: "curtis@optimizefinancial.com",
    linkedin: "https://www.linkedin.com/in/curtis-raymond",
    chatbot: "Financial advisory AI chatbot",
    stage: "opened",
    score: 92,
    tier: "A",
    notes: "Opened email 3x",
    history: [
      { date: "2026-08-02", action: "Email sent" },
      { date: "2026-08-03", action: "Email opened (×3)" },
    ],
    addedAt: new Date().toISOString(),
  },
  {
    id: 5,
    company: "AmeriCare Health",
    country: "🇺🇸 USA",
    industry: "Healthcare",
    contact: "John Wardwell",
    title: "Chief AI Officer",
    email: "jwardwell@americare.com",
    linkedin: "https://www.linkedin.com/in/johnwardwell",
    chatbot: "Patient-facing symptom checker chatbot",
    stage: "replied",
    score: 95,
    tier: "A",
    notes: "Interested, asked for more details",
    history: [
      { date: "2026-08-01", action: "Email sent" },
      { date: "2026-08-04", action: "Replied — interested" },
    ],
    addedAt: new Date().toISOString(),
  },
];

/** Patch stale localStorage records with verified LinkedIn URLs. */
export const LINKEDIN_CORRECTIONS = Object.fromEntries(
  PROSPECTS.map((p) => [p.id, { linkedin: p.linkedin, contact: p.contact, title: p.title, email: p.email }])
);

export function normalizeLinkedIn(url) {
  if (!url || url === "—") return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http")) return trimmed;
  return `https://${trimmed.replace(/^\/\//, "")}`;
}

export function loadProspects(storage) {
  const saved = storage.get("bb_prospects", null);
  const base = saved?.length ? saved : PROSPECTS;
  return base.map((p) => (LINKEDIN_CORRECTIONS[p.id] ? { ...p, ...LINKEDIN_CORRECTIONS[p.id] } : p));
}
