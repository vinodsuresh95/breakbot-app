/** Industry pack metadata — mirrors public/prompt_library.json industry_packs */

export const INDUSTRY_PACKS = [
  // ── Original 8 ──
  { id: "FIN",  name: "Fintech & Banking",              icon: "🏦", probes: 18, market: "Neobanks, UPI bots, lending, wealth" },
  { id: "HLTH", name: "Healthcare & Life Sciences",     icon: "🏥", probes: 18, market: "Symptom checkers, patient portals" },
  { id: "LEGAL", name: "Legal & Compliance",            icon: "⚖️", probes: 16, market: "Contract AI, compliance Q&A" },
  { id: "ECOM", name: "E-commerce & Retail",             icon: "🛒", probes: 16, market: "Shopping assistants, returns bots" },
  { id: "SAAS", name: "SaaS & B2B",                      icon: "☁️", probes: 16, market: "Support bots, admin copilots" },
  { id: "INS",  name: "Insurance",                       icon: "🛡️", probes: 15, market: "Claims bots, FNOL, underwriting" },
  { id: "EDU",  name: "Education & EdTech",              icon: "🎓", probes: 14, market: "Tutoring bots, LMS assistants" },
  { id: "GOV",  name: "Government & Public Sector",      icon: "🏛️", probes: 14, market: "Citizen services, benefits bots" },
  // ── New 8 (v3.2) ──
  { id: "REAL", name: "Real Estate & PropTech",          icon: "🏠", probes: 15, market: "Property search, mortgage, RERA" },
  { id: "TEL",  name: "Telecom & Connectivity",          icon: "📡", probes: 15, market: "Carrier support, SIM, TRAI" },
  { id: "HR",   name: "HR & Recruiting",                 icon: "👔", probes: 16, market: "ATS bots, HR policy copilots" },
  { id: "IND",  name: "India — RBI, DPDP & Compliance",  icon: "🇮🇳", probes: 18, market: "NBFCs, UPI, Aadhaar, DPDP Act" },
  { id: "TRAV", name: "Travel & Hospitality",            icon: "✈️", probes: 14, market: "Airlines, hotels, OTAs" },
  { id: "AUTO", name: "Automotive & Dealership",         icon: "🚗", probes: 14, market: "Dealer bots, auto finance" },
  { id: "LOG",  name: "Logistics & Supply Chain",        icon: "📦", probes: 13, market: "Tracking, customs, warehouse" },
  { id: "MEDIA", name: "Media, Gaming & Entertainment", icon: "🎬", probes: 12, market: "Streaming, gaming, moderation" },
]

export const CORE_PROBES = 436
export const INDUSTRY_PACK_COUNT = INDUSTRY_PACKS.length
export const INDUSTRY_PROBES = INDUSTRY_PACKS.reduce((n, p) => n + p.probes, 0)
/** Full probe library — core + all 16 industry packs (matches prompt_library.json total_with_industry) */
export const TOTAL_LIBRARY = CORE_PROBES + INDUSTRY_PROBES
/** Headline number for marketing — e.g. hero, CTAs */
export const HEADLINE_PROBES = `${TOTAL_LIBRARY}+`
/** Typical audit: core + one industry vertical */
export const TYPICAL_AUDIT = (packId) => {
  const pack = INDUSTRY_PACKS.find(p => p.id === packId)
  return CORE_PROBES + (pack?.probes || 15)
}

// Back-compat alias used on website
export const TOTAL_PROBES = TOTAL_LIBRARY

/** Load industry pack via authenticated API (dashboard only). */
export async function loadIndustryPack(packId) {
  const { fetchProbeLibrary } = await import('../lib/api.js')
  const lib = await fetchProbeLibrary()
  const pack = lib.industry_packs?.find(p => p.id === packId)
  if (!pack) throw new Error(`Unknown industry pack: ${packId}`)
  return pack
}

/** Core OWASP probes + one industry's probes — requires dashboard auth. */
export async function loadAllProbesForIndustry(packId) {
  const { fetchProbeLibrary } = await import('../lib/api.js')
  const lib = await fetchProbeLibrary()
  const core = lib.categories.flatMap(c =>
    c.prompts.map(p => ({ ...p, source: 'core', category: c.name }))
  )
  const industry = (lib.industry_packs?.find(p => p.id === packId)?.prompts || [])
    .map(p => ({ ...p, source: 'industry' }))
  return [...core, ...industry]
}

/** All packs grouped for marketing UI */
export const INDUSTRY_GROUPS = [
  { label: "Financial services", ids: ["FIN", "INS", "IND"] },
  { label: "Health & compliance", ids: ["HLTH", "LEGAL", "GOV"] },
  { label: "Consumer & retail", ids: ["ECOM", "TRAV", "AUTO", "REAL"] },
  { label: "Enterprise & ops", ids: ["SAAS", "HR", "LOG", "TEL"] },
  { label: "Other", ids: ["EDU", "MEDIA"] },
]
