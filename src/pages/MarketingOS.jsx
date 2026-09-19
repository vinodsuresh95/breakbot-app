import { useState, useEffect, useRef, useCallback } from "react";
import * as backend from "../lib/api.js";
import { loadProspects, normalizeLinkedIn } from "../data/prospects.js";
import SecurityAuditPanel from "../components/SecurityAuditPanel.jsx";

// ── THEME ─────────────────────────────────────────────────────────────────────
const C = {
  bg:"#070706", sur:"#0d0c0a", sur2:"#141210", sur3:"#1a1814",
  bdr:"#1e1d1a", bdr2:"#2a2825",
  red:"#E8341A", rdim:"rgba(232,52,26,0.1)", rglow:"rgba(232,52,26,0.05)",
  cream:"#f0ede6", mut:"#6b6860", dim:"#2e2b26",
  grn:"#2dba6e", amb:"#e09a20", blu:"#3a8fd4", pur:"#a855f7", cyan:"#06b6d4",
};

// ── PIPELINE STAGES ───────────────────────────────────────────────────────────
const STAGES = [
  { id:"researched",  label:"Researched",    color:C.mut,  bg:"rgba(107,104,96,.12)",  bdr:"rgba(107,104,96,.25)",  icon:"🔍" },
  { id:"drafted",     label:"Email Drafted", color:C.blu,  bg:"rgba(58,143,212,.1)",   bdr:"rgba(58,143,212,.25)",  icon:"✍️" },
  { id:"sent",        label:"Sent",          color:C.amb,  bg:"rgba(224,154,32,.1)",   bdr:"rgba(224,154,32,.25)",  icon:"📤" },
  { id:"opened",      label:"Opened",        color:C.cyan, bg:"rgba(6,182,212,.1)",    bdr:"rgba(6,182,212,.25)",   icon:"👁" },
  { id:"replied",     label:"Replied",       color:C.pur,  bg:"rgba(168,85,247,.1)",   bdr:"rgba(168,85,247,.25)",  icon:"💬" },
  { id:"followup1",   label:"Follow-up 1",   color:C.amb,  bg:"rgba(224,154,32,.1)",   bdr:"rgba(224,154,32,.25)",  icon:"🔁" },
  { id:"followup2",   label:"Follow-up 2",   color:C.amb,  bg:"rgba(224,154,32,.08)",  bdr:"rgba(224,154,32,.2)",   icon:"🔂" },
  { id:"meeting",     label:"Meeting Booked",color:C.grn,  bg:"rgba(45,186,110,.1)",   bdr:"rgba(45,186,110,.25)",  icon:"📅" },
  { id:"audit",       label:"Audit Agreed",  color:C.grn,  bg:"rgba(45,186,110,.12)",  bdr:"rgba(45,186,110,.3)",   icon:"✅" },
  { id:"customer",    label:"Paying Customer",color:C.grn, bg:"rgba(45,186,110,.15)",  bdr:"rgba(45,186,110,.4)",   icon:"💰" },
  { id:"lost",        label:"Not Interested",color:C.red,  bg:"rgba(232,52,26,.08)",   bdr:"rgba(232,52,26,.2)",    icon:"❌" },
];

// ── AGENTS ────────────────────────────────────────────────────────────────────
const AGENTS = [
  {
    id:"scout", name:"SCOUT", role:"Lead Researcher", emoji:"🔍", color:"rgba(58,143,212,.15)",
    desc:"Finds and profiles prospect companies. Researches their AI products, chatbot stack, compliance exposure, and decision-makers.",
    system:`You are SCOUT, the Lead Research Agent for BreakBot — an AI chatbot security testing startup by Vinod based in Bengaluru.

Your job: Research a company and produce a detailed prospect profile to help personalise outreach.

For every company given to you, produce a JSON profile with:
- company_name, website, country, industry
- what_they_do (2 sentences max)
- ai_chatbot_details (what AI/chatbot products they have deployed, if known)
- compliance_exposure (which regulations apply: EU AI Act, FCA, DPDP, FTC, MAS etc.)
- decision_maker_title (who to target: CTO, Head of AI, Chief Compliance Officer etc.)
- pain_point (the specific security risk BreakBot would address for them)
- personalization_hook (one specific thing about their product/news that makes the email feel personal)
- urgency_angle (why they need this NOW — regulation deadline, recent AI launch, etc.)
- recommended_channel (email / LinkedIn / WhatsApp)
- recommended_tone (technical / executive / compliance-focused)

Be specific and factual. If you don't know something, say "unknown" not a guess.
Output ONLY valid JSON, no markdown.`
  },
  {
    id:"writer", name:"NOVA", role:"Email Copywriter", emoji:"✍️", color:"rgba(168,85,247,.15)",
    desc:"Writes hyper-personalised, human-sounding cold emails based on prospect research. No templates. Every email unique.",
    system:`You are NOVA, the Email Copywriter Agent for BreakBot — an AI chatbot security testing startup by Vinod.

Your job: Write cold outreach emails that feel human, personal, and specific — NOT like a template blast.

BreakBot context:
- Tests AI agents and chatbots for 680+ security failures — 436 core OWASP probes plus 16 industry packs (fintech, SaaS, India RBI/DPDP, telecom, HR, legal, and more)
- Finds jailbreaks, data leaks, prompt injections, tool/MCP abuse, compliance violations
- First audit is completely free, report delivered in 24 hours
- Vinod has 9 years ML/AI experience at Microsoft and enterprise AI platforms
- Website: breakbot.netlify.app

Email rules you follow:
1. Subject line under 8 words — specific to their company or product
2. First line references something REAL about them (product, news, recent launch)
3. The "problem" paragraph describes their specific risk — not generic
4. One concrete example of what BreakBot typically finds (pick the most relevant)
5. CTA is a question, not a command — "Worth a quick look?" not "Book a call now"
6. Total email under 150 words — short emails get read
7. Sound like a smart founder emailing a peer — not a sales rep
8. Never use: "I hope this finds you well", "I wanted to reach out", "synergy", "leverage"
9. Sign as Vinod, BreakBot founder

Output JSON with: subject, body, ps_line (optional postscript), tone_notes`
  },
  {
    id:"linkedin", name:"LINK", role:"LinkedIn Strategist", emoji:"🔗", color:"rgba(0,119,181,.2)",
    desc:"Writes LinkedIn connection requests and DMs. Manages profile comment strategy to warm up prospects before cold outreach.",
    system:`You are LINK, the LinkedIn Strategy Agent for BreakBot — an AI chatbot security testing startup by Vinod.

Your job: Write LinkedIn outreach that doesn't feel like spam.

CRITICAL RULES:
- Use ONLY the exact LinkedIn profile URL provided in the prospect data. NEVER invent, guess, or shorten LinkedIn URLs.
- Reference the contact by their exact name and title from the prospect record.
- If no LinkedIn URL is provided, say "linkedin_url_missing" in your JSON and do not fabricate a profile.

Vinod's LinkedIn context:
- ~2,000 followers, 9 yrs ML/AI, Microsoft background, building BreakBot full-time
- Personal brand: AI security expert and founder
- Goal: warm relationships, not spray-and-pray

For LinkedIn outreach, produce:
1. linkedin_profile_url (copy EXACTLY from prospect data — full https URL)
2. connection_request (under 300 characters — LinkedIn limit)
3. initial_dm (sent 2-3 days after connection accepts — casual, not salesy, under 100 words)
4. followup_dm (if no reply after 5 days — adds new value, references something they posted)
5. comment_strategy (what kind of comment to leave on their recent posts to warm them up BEFORE connecting)

Rules:
- Connection requests must reference something specific about them
- DMs open with their name and a genuine observation, not a pitch
- Always offer value before asking for anything
- The "ask" is always soft: "happy to share what we typically find on chatbots like yours"

Output JSON with all five fields.`
  },
  {
    id:"sender", name:"HERMES", role:"Send & Schedule Agent", emoji:"📤", color:"rgba(45,186,110,.15)",
    desc:"Manages email timing, send schedules, and prevents over-contacting. Knows the optimal send time per region.",
    system:`You are HERMES, the Send & Schedule Agent for BreakBot.

Your job: Determine the optimal email send strategy for each prospect.

Rules you follow:
- USA: Tuesday-Thursday, 9-11am EST
- UK: Tuesday-Wednesday, 8-10am GMT  
- Germany/DACH: Tuesday-Thursday, 8-9am CET (earlier is better — Germans value punctuality)
- India: Tuesday-Wednesday, 10am-12pm IST
- MENA: Sunday-Tuesday (weekend is Thursday-Friday in Gulf), 9-11am GST
- Singapore: Tuesday-Thursday, 9-11am SGT
- Australia: Tuesday-Wednesday, 9-11am AEST
- Canada: Tuesday-Thursday, 9-11am EST/PST depending on city

Spacing rules:
- Initial email → Follow-up 1: wait 5 business days
- Follow-up 1 → Follow-up 2: wait 7 business days
- After Follow-up 2: wait 30 days before any re-contact
- Never send more than 3 touches in a 30-day window to the same prospect

Output JSON with: recommended_send_time, timezone, followup_1_date, followup_2_date, notes`
  },
  {
    id:"followup", name:"ECHO", role:"Follow-up Agent", emoji:"🔁", color:"rgba(224,154,32,.15)",
    desc:"Writes follow-up emails that add new value each time. Never sends the same message twice. Knows when to stop.",
    system:`You are ECHO, the Follow-up Agent for BreakBot.

Your job: Write follow-up emails that don't feel like nagging. Each follow-up must add new value.

Follow-up rules:
- Follow-up 1 (5 days after send): Reference something new — a recent piece of AI security news, a new OWASP finding, or a result from testing a similar company's chatbot. Short. Under 80 words.
- Follow-up 2 (12 days after send): The "last touch" — offer something specific and free, make it easy to say yes. Under 60 words. End with a clear opt-out option.
- Never say: "Just following up", "Circling back", "Checking in", "Bumping this to the top"

Effective follow-up patterns:
- "Saw this and thought of you" + new relevant article/regulation update
- "Quick question" — ask one specific yes/no question
- "We just found [X] in a [industry] chatbot — thought you'd want to see it"
- The "break-up email": "No worries if timing is off — happy to reconnect when it makes sense"

Output JSON with: followup_1_subject, followup_1_body, followup_2_subject, followup_2_body`
  },
  {
    id:"analyst", name:"ARIA", role:"Pipeline Analyst", emoji:"📊", color:"rgba(232,52,26,.15)",
    desc:"Analyses outreach performance, identifies what's working, and gives Vinod weekly recommendations to improve conversion.",
    system:`You are ARIA, the Pipeline Analyst Agent for BreakBot.

Your job: Analyse outreach data and give actionable recommendations to improve conversion.

Metrics you track:
- Open rate by region, industry, and subject line pattern
- Reply rate by email length, tone, and first-line type
- Stage conversion rates (sent→opened, opened→replied, replied→meeting)
- Best performing prospect profiles
- Time-to-response patterns

Output format: 
- top_insight (the single most important finding)
- what_working (2-3 things performing well)
- what_to_fix (2-3 things underperforming)
- recommended_ab_test (one specific thing to test next week)
- best_prospect_profile (describe the prospects most likely to convert based on data)
- weekly_priority (the single action Vinod should take this week)

Be brutally honest. If open rates are low, say the subject lines are bad. If no one replies, say the emails are too salesy. Give specific fixes, not vague advice.`
  },
  {
    id:"qualifier", name:"JUDGE", role:"Lead Qualifier", emoji:"⚖️", color:"rgba(168,85,247,.15)",
    desc:"Scores every lead 1-10 based on fit, urgency, and ability to pay. Tells Vinod which leads to prioritise this week.",
    system:`You are JUDGE, the Lead Qualification Agent for BreakBot.

Your job: Score every prospect and tell Vinod which ones to spend time on.

Scoring criteria (each out of 10, total out of 100):
- Fit score: Do they have an AI chatbot? (0=no chatbot, 10=multiple production chatbots)
- Urgency score: Regulatory pressure they're under right now (0=none, 10=active enforcement/deadline)
- Authority score: Is this person the decision maker? (0=intern, 10=CTO/CEO/Compliance Head)
- Budget score: Company size and funding stage (0=bootstrapped startup, 10=Series B+ or enterprise)
- Timing score: Did they recently launch AI features? (0=no AI yet, 10=just launched, post-launch anxiety)
- Channel score: How reachable are they? (0=email bounced, 10=active LinkedIn + direct email)

For each prospect give:
- total_score (out of 100)
- tier (A=80+, B=60-79, C=40-59, D=below 40)
- top_reason (why they score high or low)
- recommended_action (what to do with them this week)
- skip_reason (if below 40, why to deprioritize)

Prioritise ruthlessly. Vinod has 5-6 hours/week. Only A and B tier prospects deserve his personal attention.`
  },
];

// ── STORAGE ───────────────────────────────────────────────────────────────────
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ── STAGE CONFIG ──────────────────────────────────────────────────────────────
const stageMap = Object.fromEntries(STAGES.map(s => [s.id, s]));

// ── COMPONENT: STATUS DOT ─────────────────────────────────────────────────────
const Dot = ({ active }) => (
  <span style={{ width:7, height:7, borderRadius:"50%", background: active ? C.grn : C.dim, display:"inline-block", boxShadow: active ? `0 0 5px ${C.grn}` : "none" }} />
);

// ── COMPONENT: STAGE BADGE ────────────────────────────────────────────────────
const StageBadge = ({ stageId }) => {
  const s = stageMap[stageId] || STAGES[0];
  return (
    <span style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, padding:"2px 8px", borderRadius:20, background:s.bg, color:s.color, border:`1px solid ${s.bdr}`, whiteSpace:"nowrap" }}>
      {s.icon} {s.label}
    </span>
  );
};

// ── COMPONENT: TIER BADGE ─────────────────────────────────────────────────────
const TierBadge = ({ tier }) => {
  const cfg = { A:{c:C.grn,bg:"rgba(45,186,110,.12)",b:"rgba(45,186,110,.3)"}, B:{c:C.blu,bg:"rgba(58,143,212,.1)",b:"rgba(58,143,212,.25)"}, C:{c:C.amb,bg:"rgba(224,154,32,.1)",b:"rgba(224,154,32,.25)"}, D:{c:C.mut,bg:"rgba(107,104,96,.1)",b:C.bdr} };
  const t = cfg[tier] || cfg.D;
  return <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, padding:"2px 8px", borderRadius:20, background:t.bg, color:t.c, border:`1px solid ${t.b}` }}>Tier {tier}</span>;
};

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function MarketingOS() {
  const [backendReady, setBackendReady] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [searchOpen, setSearchOpen]     = useState(false);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [view, setView]           = useState("dashboard");
  const [prospects, setProspects] = useState(() => loadProspects(LS));
  const [activeAgent, setActiveAgent] = useState(null);
  const [agentChat, setAgentChat] = useState({});
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState(null); // selected prospect
  const [addForm, setAddForm]     = useState(null);
  const [runningAgent, setRunningAgent] = useState(null);
  const [agentOutput, setAgentOutput] = useState({});
  const chatEnd = useRef(null);
  const searchRef = useRef(null);

  // ── NOTIFICATION SYSTEM ────────────────────────────────────────────────────
  const [notifs, setNotifs]           = useState(() => LS.get("bb_notifs", []));
  const [notifOpen, setNotifOpen]     = useState(false);
  const [toastQueue, setToastQueue]   = useState([]);
  const unread = notifs.filter(n => !n.read).length;

  useEffect(() => { LS.set("bb_notifs", notifs); }, [notifs]);

  // Notification types and their config
  const NOTIF_CFG = {
    stage_change:  { color: C.pur,  icon: "🔄", label: "Stage Update"    },
    agent_done:    { color: C.blu,  icon: "🤖", label: "Agent Complete"   },
    email_drafted: { color: C.cyan, icon: "✍️",  label: "Email Ready"     },
    scored:        { color: C.amb,  icon: "⚖️",  label: "Prospect Scored" },
    researched:    { color: C.grn,  icon: "🔍",  label: "Research Done"   },
    followup_due:  { color: C.red,  icon: "⏰",  label: "Follow-up Due"   },
    replied:       { color: C.grn,  icon: "💬",  label: "Replied!"        },
    customer:      { color: C.grn,  icon: "💰",  label: "New Customer!"   },
    email_sent:    { color: C.grn,  icon: "📤",  label: "Email Sent"      },
    system:        { color: C.mut,  icon: "ℹ️",  label: "System"          },
  };

  const pushNotif = useCallback((type, title, body, meta = {}) => {
    const n = {
      id: Date.now() + Math.random(),
      type, title, body, meta,
      ts: new Date().toISOString(),
      read: false,
    };
    setNotifs(prev => {
      const next = [n, ...prev].slice(0, 100); // keep last 100
      LS.set("bb_notifs", next);
      return next;
    });
    // Toast
    setToastQueue(prev => [...prev, n]);
    setTimeout(() => setToastQueue(prev => prev.filter(t => t.id !== n.id)), 4500);
  }, []);

  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  const clearNotifs = () => { setNotifs([]); LS.set("bb_notifs", []); };

  useEffect(() => { LS.set("bb_prospects", prospects); }, [prospects]);

  // Apply verified LinkedIn corrections on load (fixes stale localStorage)
  useEffect(() => {
    const corrected = loadProspects(LS);
    setProspects(corrected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [agentChat, activeAgent]);

  useEffect(() => {
    backend.checkHealth().then(ok => {
      setBackendReady(ok);
      if (ok) pushNotif("system", "Python backend connected", "All 7 AI agents ready via FastAPI.");
    });
    const timer = setInterval(() => backend.checkHealth().then(setBackendReady), 30000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onClick = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const searchMatches = companySearch.trim().length >= 1
    ? prospects.filter(p =>
        p.company?.toLowerCase().includes(companySearch.toLowerCase()) ||
        p.contact?.toLowerCase().includes(companySearch.toLowerCase()) ||
        p.email?.toLowerCase().includes(companySearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const updateProspect = (id, changes, silent = false) => {
    setProspects(prev => {
      const old = prev.find(p => p.id === id);
      const next = prev.map(p => p.id === id ? { ...p, ...changes } : p);
      LS.set("bb_prospects", next);

      // Fire stage-change notification
      if (!silent && old && changes.stage && changes.stage !== old.stage) {
        const fromS = stageMap[old.stage];
        const toS   = stageMap[changes.stage];
        const isWin = changes.stage === "customer";
        pushNotif(
          isWin ? "customer" : "stage_change",
          isWin ? `🎉 New customer: ${old.company}!` : `${old.company} → ${toS?.label}`,
          isWin
            ? `${old.contact} at ${old.company} is now a paying customer. Great work!`
            : `Moved from ${fromS?.label || old.stage} to ${toS?.label || changes.stage}`,
          { prospectId: id, company: old.company, from: old.stage, to: changes.stage }
        );
      }
      return next;
    });
  };

  const addHistory = (id, action) => {
    setProspects(prev => {
      const next = prev.map(p => p.id === id ? {
        ...p,
        history: [...(p.history||[]), { date: new Date().toLocaleDateString(), action, ts: new Date().toISOString() }]
      } : p);
      LS.set("bb_prospects", next);
      return next;
    });
  };

  // ── SEND EMAIL ─────────────────────────────────────────────────────────────
  const sendEmailToProspect = async (prospect, draftOverride = null) => {
    if (!backendReady) { alert("Start the Python backend first: cd backend && pip install -r requirements.txt && python main.py"); return; }
    const draft = draftOverride || prospect.draftEmail;
    if (!prospect.email) { alert("No email address for this prospect"); return; }
    if (!draft?.subject || !draft?.body) {
      alert("No email draft yet — run NOVA first or use 'Draft & Send'");
      return;
    }
    setSendingEmail(prospect.id);
    try {
      const res = await backend.sendEmail({
        to: prospect.email,
        subject: draft.subject,
        body: draft.body + (draft.ps_line ? `\n\nP.S. ${draft.ps_line}` : ""),
        prospectId: prospect.id,
        company: prospect.company,
      });
      updateProspect(prospect.id, { stage: "sent" }, true);
      addHistory(prospect.id, res.sent ? `Email sent to ${prospect.email}` : `Email simulated (SMTP not configured)`);
      pushNotif("email_sent",
        res.sent ? `Email sent to ${prospect.company}` : `Draft ready for ${prospect.company}`,
        res.message || draft.subject,
        { prospectId: prospect.id, company: prospect.company }
      );
    } catch (e) {
      alert(`Send failed: ${e.message}`);
    }
    setSendingEmail(null);
  };

  const handleSearchAction = async (prospect, action) => {
    setSearchOpen(false);
    setCompanySearch("");
    setSelected(prospect);
    if (action === "view") { setView("prospect-detail"); return; }
    if (!backendReady) { alert("Python backend not running"); return; }
    if (action === "research") { await runAgent("scout", prospect); setView("prospect-detail"); return; }
    if (action === "score") { await runAgent("qualifier", prospect); setView("prospect-detail"); return; }
    if (action === "draft") { await runAgent("writer", prospect); setView("prospect-detail"); return; }
    if (action === "send") {
      let draft = prospect.draftEmail;
      if (!draft?.subject) draft = await runAgent("writer", prospect);
      await sendEmailToProspect({ ...prospect, draftEmail: draft }, draft);
      setView("prospect-detail");
      return;
    }
    if (action === "full") {
      try {
        const { prospect: updated, results } = await backend.runOutreachFlow(prospect, { autoSend: false, steps: ["scout", "qualifier", "writer", "sender"] });
        updateProspect(prospect.id, { ...updated, researchData: results.scout, draftEmail: results.writer, score: results.qualifier?.total_score, tier: results.qualifier?.tier }, true);
        addHistory(prospect.id, "Full outreach pipeline completed (SCOUT → JUDGE → NOVA → HERMES)");
        pushNotif("agent_done", `Outreach ready for ${prospect.company}`, "Research, score, and email draft complete — review and send when ready", { prospectId: prospect.id, company: prospect.company });
      } catch (e) { alert(e.message); }
      setView("prospect-detail");
    }
  };

  // ── RUN AGENT ON PROSPECT ──────────────────────────────────────────────────
  const runAgent = async (agentId, prospect) => {
    if (!backendReady) { alert("Python backend not running — start it in backend/"); return; }
    const agent = AGENTS.find(a => a.id === agentId);
    if (!agent) return;
    setRunningAgent(`${agentId}-${prospect.id}`);
    let output = null;

    try {
      const { result } = await backend.runAgent(agentId, prospect);
      output = result;
      setAgentOutput(prev => ({ ...prev, [`${agentId}-${prospect.id}`]: result }));
      if (agentId === "qualifier" && result.total_score) {
        const tier = result.tier || (result.total_score >= 80 ? "A" : result.total_score >= 60 ? "B" : result.total_score >= 40 ? "C" : "D");
        updateProspect(prospect.id, { score: result.total_score, tier }, true);
        addHistory(prospect.id, `JUDGE scored: ${result.total_score}/100 (Tier ${tier})`);
        pushNotif("scored",
          `${prospect.company} scored ${result.total_score}/100 — Tier ${tier}`,
          result.top_reason || result.recommended_action || "Score updated",
          { prospectId: prospect.id, company: prospect.company }
        );
      }
      if (agentId === "writer" && result.subject) {
        updateProspect(prospect.id, { draftEmail: result, stage: "drafted" }, true);
        addHistory(prospect.id, `NOVA drafted email: "${result.subject}"`);
        pushNotif("email_drafted",
          `Email drafted for ${prospect.company}`,
          `Subject: "${result.subject}" — ready to review and send`,
          { prospectId: prospect.id, company: prospect.company }
        );
      }
      if (agentId === "scout" && result.company_name) {
        updateProspect(prospect.id, { researchData: result }, true);
        addHistory(prospect.id, "SCOUT completed research profile");
        pushNotif("researched",
          `${prospect.company} research complete`,
          result.pain_point ? `Key finding: ${result.pain_point}` : "Research profile ready",
          { prospectId: prospect.id, company: prospect.company }
        );
      }
      if (agentId === "followup") {
        addHistory(prospect.id, "ECHO generated follow-up emails");
        pushNotif("agent_done",
          `Follow-up emails ready for ${prospect.company}`,
          "ECHO has drafted follow-up 1 and 2 — review in prospect detail",
          { prospectId: prospect.id, company: prospect.company }
        );
      }
      if (agentId === "linkedin") {
        const linkedinUrl = normalizeLinkedIn(prospect.linkedin);
        const output = linkedinUrl && (!result.linkedin_profile_url || !result.linkedin_profile_url.includes("linkedin.com"))
          ? { ...result, linkedin_profile_url: linkedinUrl }
          : result;
        updateProspect(prospect.id, { linkedinOutput: output }, true);
        addHistory(prospect.id, "LINK generated LinkedIn outreach");
        pushNotif("agent_done",
          `LinkedIn outreach ready for ${prospect.company}`,
          output.connection_request ? `Connection request drafted for ${linkedinUrl || "profile"}` : "Connection request, DM, and comment strategy drafted by LINK",
          { prospectId: prospect.id, company: prospect.company }
        );
      }
      if (agentId === "sender") {
        addHistory(prospect.id, "HERMES calculated optimal send schedule");
        pushNotif("agent_done",
          `Send schedule set for ${prospect.company}`,
          result.recommended_send_time ? `Best time: ${result.recommended_send_time} (${result.timezone})` : "Schedule calculated",
          { prospectId: prospect.id, company: prospect.company }
        );
      }
      // Generic fallback for analyst
      if (agentId === "analyst") {
        pushNotif("agent_done",
          "Pipeline analysis complete",
          result.top_insight || result.weekly_priority || "ARIA has analysed your pipeline — check the output",
          {}
        );
      }
    } catch (e) {
      setAgentOutput(prev => ({ ...prev, [`${agentId}-${prospect.id}`]: { error: e.message } }));
    }
    setRunningAgent(null);
    return output;
  };

  // ── CHAT WITH AGENT ────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || !backendReady || loading) return;
    const agent = AGENTS.find(a => a.id === activeAgent);
    if (!agent) return;
    const msg = chatInput.trim();
    setChatInput(""); setLoading(true);
    const key = activeAgent;
    const hist = agentChat[key] || [];
    const newHist = [...hist, { role:"user", content:msg }];
    setAgentChat(prev => ({ ...prev, [key]: newHist }));
    try {
      const sel = document.getElementById("prospect-select");
      const prospect = sel ? prospects.find(x => String(x.id) === sel.value) : null;
      const data = await backend.chatAgent(activeAgent, newHist, prospect);
      let reply = data.reply || "Error";
      if (data.email_action) {
        reply += `\n\n📤 ${data.email_action.message}`;
        if (data.email_action.sent && prospect) {
          updateProspect(prospect.id, { stage: "sent" }, true);
          addHistory(prospect.id, `Email sent via ${agent.name} chat command`);
        }
      }
      setAgentChat(prev => ({ ...prev, [key]: [...newHist, { role:"assistant", content:reply }] }));
    } catch(e) {
      setAgentChat(prev => ({ ...prev, [key]: [...newHist, { role:"assistant", content:`Error: ${e.message}` }] }));
    }
    setLoading(false);
  };

  // ── FOLLOW-UP DUE CHECKER — runs once on load ──────────────────────────────
  useEffect(() => {
    if (!backendReady) return;
    const now = new Date();
    prospects.forEach(p => {
      if (p.stage === "sent") {
        // Find when email was sent from history
        const sentEntry = (p.history || []).find(h => h.action?.toLowerCase().includes("email sent") || h.action?.toLowerCase().includes("sent"));
        if (sentEntry && sentEntry.ts) {
          const sentDate = new Date(sentEntry.ts);
          const daysSince = Math.floor((now - sentDate) / (1000 * 60 * 60 * 24));
          if (daysSince >= 5) {
            pushNotif("followup_due",
              `Follow-up overdue: ${p.company}`,
              `Email sent ${daysSince} days ago with no reply. Time to send follow-up #1.`,
              { prospectId: p.id, company: p.company, daysSince }
            );
          }
        }
      }
    });
    // Daily summary notif (once per day)
    const lastSummary = LS.get("bb_last_summary", null);
    const today = new Date().toDateString();
    if (lastSummary !== today && prospects.length > 0) {
      const tierA = prospects.filter(p => p.tier === "A").length;
      const pending = prospects.filter(p => p.stage === "sent").length;
      const won = prospects.filter(p => p.stage === "customer").length;
      pushNotif("system",
        `Good morning — here's your BreakBot pipeline`,
        `${prospects.length} prospects total · ${tierA} Tier A · ${pending} awaiting reply · ${won} paying customers`,
        {}
      );
      LS.set("bb_last_summary", today);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendReady]);
  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s.id] = prospects.filter(p => p.stage === s.id).length;
    return acc;
  }, {});
  const totalA = prospects.filter(p => p.tier === "A").length;
  const totalB = prospects.filter(p => p.tier === "B").length;

  // ── GENERATE DAILY BRIEF ───────────────────────────────────────────────────
  const [brief, setBrief] = useState(() => LS.get("bb_brief", null));
  const [briefLoading, setBriefLoading] = useState(false);

  const generateBrief = async () => {
    if (!backendReady) { alert("Python backend not running"); return; }
    setBriefLoading(true);
    const today = new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" });
    const stageGroups = {};
    prospects.forEach(p => { if(!stageGroups[p.stage])stageGroups[p.stage]=[]; stageGroups[p.stage].push(p.company); });
    const context = `
Today: ${today} (IST)
Total prospects in pipeline: ${prospects.length}
Tier A (hot): ${prospects.filter(p=>p.tier==="A").map(p=>`${p.company} [${p.stage}]`).join(", ")||"none"}
Tier B: ${prospects.filter(p=>p.tier==="B").map(p=>`${p.company} [${p.stage}]`).join(", ")||"none"}
Pipeline: ${Object.entries(stageGroups).map(([s,ps])=>`${s}: ${ps.join(", ")}`).join(" | ")}
Overdue follow-ups (sent, no reply): ${prospects.filter(p=>p.stage==="sent").map(p=>p.company).join(", ")||"none"}
Recently replied: ${prospects.filter(p=>p.stage==="replied").map(p=>p.company).join(", ")||"none"}
Meetings booked: ${prospects.filter(p=>p.stage==="meeting").map(p=>p.company).join(", ")||"none"}
Paying customers: ${prospects.filter(p=>p.stage==="customer").length}
Recent activity: ${prospects.flatMap(p=>(p.history||[]).slice(-1).map(h=>`${p.company}: ${h.action}`)).slice(0,5).join("; ")||"none"}`.trim();
    try {
      const data = await backend.generateBrief(context);
      const briefData = { text: data.text, generatedAt: new Date().toISOString(), prospects: prospects.length };
      setBrief(briefData);
      LS.set("bb_brief", briefData);
    } catch(e) {
      setBrief({ text:`Error generating brief: ${e.message}`, generatedAt: new Date().toISOString(), error:true });
    }
    setBriefLoading(false);
  };

  // Auto-generate brief if it's a new day and one doesn't exist for today
  useEffect(() => {
    if (!backendReady || !brief) return;
    const briefDate = new Date(brief.generatedAt).toDateString();
    const today = new Date().toDateString();
    if (briefDate !== today) setBrief(null); // clear stale brief
  }, [backendReady]);

  // ── STYLES ─────────────────────────────────────────────────────────────────
  const inp = { background:C.sur2, border:`1px solid ${C.bdr2}`, color:C.cream, fontFamily:"'IBM Plex Mono',monospace", fontSize:12, padding:"9px 12px", borderRadius:6, outline:"none", width:"100%" };
  const btn = (bg, col, dis) => ({ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, background:dis?"#1a1714":bg, color:dis?C.mut:col, border:"none", padding:"8px 14px", borderRadius:5, cursor:dis?"not-allowed":"pointer", opacity:dis?0.5:1, whiteSpace:"nowrap" });
  const card = { background:C.sur, border:`1px solid ${C.bdr}`, borderRadius:10, padding:16 };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;background:${C.bg};color:${C.cream};font-family:'IBM Plex Sans',sans-serif;font-size:13px;overflow:hidden;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:${C.bdr2};border-radius:2px}
        select,select option{background:${C.sur2};color:${C.cream};}
        input[type=text]::placeholder,input[type=email]::placeholder,input[type=password]::placeholder,textarea::placeholder{color:${C.dim};}
        textarea{resize:vertical;}
        .nav-btn{background:transparent;border:none;color:${C.mut};cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:6px 12px;border-radius:5px;transition:all .15s;}
        .nav-btn:hover,.nav-btn.active{background:${C.rdim};color:${C.cream};}
        .nav-btn.active{color:${C.red};}
        .prospect-row:hover{background:${C.sur2}!important;}
        .agent-card:hover{border-color:${C.red}!important;cursor:pointer;}
        .run-btn:hover{background:rgba(232,52,26,.25)!important;}
      `}</style>

      <div style={{ display:"flex", width:"100vw", height:"100vh", overflow:"hidden", fontFamily:"'IBM Plex Sans',sans-serif" }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width:220, minWidth:220, background:C.sur, borderRight:`1px solid ${C.bdr}`, display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" }}>
          {/* Logo */}
          <div style={{ padding:"14px 16px", borderBottom:`1px solid ${C.bdr}`, display:"flex", alignItems:"center" }}>
            <div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, fontSize:13, letterSpacing:".12em" }}>BREAK<span style={{color:C.red}}>BOT</span></div>
              <div style={{ fontSize:9, color:C.mut, fontFamily:"'IBM Plex Mono',monospace" }}>MARKETING OS</div>
            </div>
          </div>

          {/* Nav */}
          <div style={{ padding:"10px 10px 4px" }}>
            <div style={{ fontSize:9, color:C.mut, fontFamily:"'IBM Plex Mono',monospace", textTransform:"uppercase", letterSpacing:".1em", padding:"0 4px 6px" }}>Command</div>
            {[
              { k:"brief",     icon:"☀️", label:"Daily Brief" },
              { k:"dashboard", icon:"📊", label:"Dashboard" },
              { k:"security",  icon:"🛡️", label:"Security Audit" },
              { k:"pipeline",  icon:"🗂", label:"Pipeline" },
              { k:"prospects", icon:"👥", label:"Prospects" },
              { k:"agents",    icon:"🤖", label:"AI Agents" },
            ].map(n => (
              <button key={n.k} className={`nav-btn ${view===n.k?"active":""}`} onClick={()=>{setView(n.k);setSelected(null);setActiveAgent(null);}} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", textAlign:"left", marginBottom:2 }}>
                <span style={{fontSize:13}}>{n.icon}</span> {n.label}
                {n.k==="brief"&&<span style={{marginLeft:"auto",fontSize:8,padding:"1px 5px",borderRadius:10,background:"rgba(45,186,110,.15)",color:C.grn,fontFamily:"'IBM Plex Mono',monospace"}}>8am</span>}
              </button>
            ))}
          </div>

          {/* Agents list */}
          <div style={{ padding:"10px 10px 4px", borderTop:`1px solid ${C.bdr}` }}>
            <div style={{ fontSize:9, color:C.mut, fontFamily:"'IBM Plex Mono',monospace", textTransform:"uppercase", letterSpacing:".1em", padding:"0 4px 6px" }}>Agents</div>
            {AGENTS.map(a => (
              <button key={a.id} className={`nav-btn ${activeAgent===a.id&&view==="agentchat"?"active":""}`}
                onClick={()=>{setActiveAgent(a.id);setView("agentchat");}}
                style={{ display:"flex", alignItems:"center", gap:8, width:"100%", textAlign:"left", marginBottom:2 }}>
                <span style={{fontSize:13}}>{a.emoji}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:600,color:C.cream,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                  <div style={{fontSize:8,color:C.mut}}>{a.role}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Stats */}
          <div style={{ marginTop:"auto", padding:12, borderTop:`1px solid ${C.bdr}` }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {[ {l:"Total",v:prospects.length,c:C.cream}, {l:"Tier A",v:totalA,c:C.grn}, {l:"Tier B",v:totalB,c:C.blu}, {l:"Won",v:prospects.filter(p=>p.stage==="customer").length,c:C.grn} ].map((s,i)=>(
                <div key={i} style={{background:C.sur2,borderRadius:6,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:9,color:C.mut,textTransform:"uppercase",letterSpacing:".06em"}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" }}>
          {/* Topbar */}
          <div style={{ height:50, background:C.sur, borderBottom:`1px solid ${C.bdr}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", flexShrink:0 }}>
            <div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, fontSize:13, color:C.cream }}>
                { view==="brief"?"☀️ Daily Brief": view==="dashboard"?"Marketing Command Center": view==="security"?"Security Engine v1": view==="pipeline"?"Outreach Pipeline": view==="prospects"?"Prospect Database": view==="agents"?"AI Agent Roster": view==="agentchat"&&activeAgent ? `${AGENTS.find(a=>a.id===activeAgent)?.emoji} ${AGENTS.find(a=>a.id===activeAgent)?.name} — ${AGENTS.find(a=>a.id===activeAgent)?.role}` : view==="prospect-detail"?"Prospect Detail":"" }
              </div>
              <div style={{ fontSize:9, color:C.mut, fontFamily:"'IBM Plex Mono',monospace" }}>7 AI agents · Python backend · localStorage persistence</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {/* Company search with quick actions */}
              <div ref={searchRef} style={{ position:"relative" }}>
                <input
                  value={companySearch}
                  onChange={e => { setCompanySearch(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search company..."
                  style={{ ...inp, width: 200, fontSize: 11 }}
                />
                {searchOpen && searchMatches.length > 0 && (
                  <div style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:4, background:C.sur, border:`1px solid ${C.bdr2}`, borderRadius:8, zIndex:100, boxShadow:"0 8px 24px rgba(0,0,0,.4)", overflow:"hidden", minWidth:320 }}>
                    {searchMatches.map(p => (
                      <div key={p.id} style={{ padding:"10px 12px", borderBottom:`1px solid ${C.bdr}` }}>
                        <div style={{ fontWeight:600, color:C.cream, fontSize:12, marginBottom:2 }}>{p.company}</div>
                        <div style={{ fontSize:10, color:C.mut, marginBottom:8 }}>{p.contact} · {p.email || "no email"}</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                          {[
                            { a:"view", l:"View", ic:"👁" },
                            { a:"research", l:"Research", ic:"🔍" },
                            { a:"score", l:"Score", ic:"⚖️" },
                            { a:"draft", l:"Draft email", ic:"✍️" },
                            { a:"send", l:"Send email", ic:"📤" },
                            { a:"full", l:"Full pipeline", ic:"🚀" },
                          ].map(({ a, l, ic }) => (
                            <button key={a} onClick={() => handleSearchAction(p, a)} disabled={!backendReady && a !== "view"}
                              style={{ ...btn(C.sur2, C.cream, !backendReady && a !== "view"), fontSize:9, padding:"4px 8px", border:`1px solid ${C.bdr}` }}>
                              {ic} {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!backendReady ? (
                <span style={{ fontSize:9, padding:"3px 9px", borderRadius:20, background:"rgba(224,154,32,.1)", color:C.amb, border:"1px solid rgba(224,154,32,.2)", fontFamily:"'IBM Plex Mono',monospace" }}>
                  ● Backend offline
                </span>
              ) : (
                <span style={{ fontSize:9, padding:"3px 9px", borderRadius:20, background:"rgba(45,186,110,.1)", color:C.grn, border:"1px solid rgba(45,186,110,.2)", fontFamily:"'IBM Plex Mono',monospace" }}>
                  ● Python backend live
                </span>
              )}
              <div style={{ position:"relative" }}>
                <button onClick={()=>setNotifOpen(v=>!v)}
                  style={{...btn(notifOpen?C.rdim:C.sur2, notifOpen?C.red:C.mut, false), border:`1px solid ${notifOpen?C.red:C.bdr}`, padding:"7px 10px", position:"relative"}}>
                  🔔
                  {unread > 0 && (
                    <span style={{position:"absolute",top:-5,right:-5,background:C.red,color:"#fff",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Mono',monospace",fontSize:8,fontWeight:700}}>
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              </div>
              <button onClick={()=>setAddForm({})} style={btn(C.red,"#000",false)}>+ Add Prospect</button>
            </div>
          </div>

          {/* NOTIFICATION PANEL — slides in from right */}
          {notifOpen && (
            <div style={{position:"fixed",top:50,right:0,width:360,height:"calc(100vh - 50px)",background:C.sur,borderLeft:`1px solid ${C.bdr}`,zIndex:50,display:"flex",flexDirection:"column",animation:"fadeIn .2s ease"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:`1px solid ${C.bdr}`,flexShrink:0}}>
                <div>
                  <div style={{fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,fontSize:13,color:C.cream}}>Notifications</div>
                  <div style={{fontSize:10,color:C.mut}}>{unread} unread · {notifs.length} total</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {unread>0&&<button onClick={markAllRead} style={{...btn("transparent",C.mut,false),fontSize:9,padding:"4px 8px",border:`1px solid ${C.bdr}`}}>Mark all read</button>}
                  {notifs.length>0&&<button onClick={clearNotifs} style={{...btn("transparent",C.mut,false),fontSize:9,padding:"4px 8px",border:`1px solid ${C.bdr}`}}>Clear</button>}
                  <button onClick={()=>setNotifOpen(false)} style={{...btn("transparent",C.mut,false),fontSize:13,padding:"4px 8px"}}>×</button>
                </div>
              </div>

              <div style={{flex:1,overflowY:"auto"}}>
                {notifs.length===0?(
                  <div style={{textAlign:"center",padding:"48px 20px",color:C.dim}}>
                    <div style={{fontSize:28,marginBottom:10}}>🔔</div>
                    <div style={{fontSize:12,fontFamily:"'IBM Plex Mono',monospace"}}>No notifications yet</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:6}}>Agent actions and stage changes will appear here</div>
                  </div>
                ):notifs.map(n=>{
                  const cfg = NOTIF_CFG[n.type] || NOTIF_CFG.system;
                  const ts = new Date(n.ts);
                  const ago = Math.floor((Date.now()-ts)/60000);
                  const agoStr = ago < 1 ? "just now" : ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.floor(ago/60)}h ago` : ts.toLocaleDateString();
                  return(
                    <div key={n.id} onClick={()=>{setNotifs(prev=>prev.map(x=>x.id===n.id?{...x,read:true}:x));if(n.meta?.prospectId){setSelected(prospects.find(p=>p.id===n.meta.prospectId));setView("prospect-detail");setNotifOpen(false);}}}
                      style={{padding:"12px 16px",borderBottom:`1px solid ${C.bdr}`,cursor:n.meta?.prospectId?"pointer":"default",background:n.read?"transparent":"rgba(232,52,26,.03)",transition:"background .15s"}}>
                      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                        <div style={{width:32,height:32,borderRadius:8,background:`${cfg.color}20`,border:`1px solid ${cfg.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                          {cfg.icon}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6,marginBottom:3}}>
                            <div style={{fontSize:12,fontWeight:600,color:n.read?C.mut:C.cream,lineHeight:1.4}}>{n.title}</div>
                            {!n.read&&<div style={{width:6,height:6,borderRadius:"50%",background:C.red,flexShrink:0,marginTop:3}}/>}
                          </div>
                          <div style={{fontSize:11,color:C.mut,lineHeight:1.5,marginBottom:4}}>{n.body}</div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:`${cfg.color}15`,color:cfg.color,fontFamily:"'IBM Plex Mono',monospace"}}>{cfg.label}</span>
                            <span style={{fontSize:9,color:C.dim,fontFamily:"'IBM Plex Mono',monospace"}}>{agoStr}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TOAST NOTIFICATIONS */}
          <div style={{position:"fixed",bottom:20,right:20,zIndex:200,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
            {toastQueue.map(t=>{
              const cfg = NOTIF_CFG[t.type] || NOTIF_CFG.system;
              return(
                <div key={t.id} style={{background:C.sur,border:`1px solid ${cfg.color}`,borderLeft:`3px solid ${cfg.color}`,borderRadius:10,padding:"12px 16px",maxWidth:320,boxShadow:`0 4px 24px rgba(0,0,0,.4)`,animation:"fadeIn .3s ease",pointerEvents:"all"}}>
                  <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:16,flexShrink:0}}>{cfg.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:C.cream,marginBottom:3}}>{t.title}</div>
                      <div style={{fontSize:11,color:C.mut,lineHeight:1.4}}>{t.body}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:18 }}>

            {/* ── DAILY BRIEF ── */}
            {view==="brief"&&(
              <div style={{animation:"fadeIn .3s ease",maxWidth:700}}>
                {/* Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                  <div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.red,textTransform:"uppercase",letterSpacing:".15em",marginBottom:8}}>☀️ BreakBot Daily Brief</div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:22,fontWeight:700,color:C.cream,marginBottom:4}}>
                      {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}
                    </div>
                    {brief&&<div style={{fontSize:11,color:C.mut}}>Generated {new Date(brief.generatedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={generateBrief} disabled={briefLoading||!backendReady}
                      style={{...btn(C.red,"#000",briefLoading||!backendReady),display:"flex",alignItems:"center",gap:6}}>
                      {briefLoading
                        ?<><span style={{display:"inline-block",width:10,height:10,border:`2px solid #000`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>Generating...</>
                        :"⟳ Generate brief"
                      }
                    </button>
                  </div>
                </div>

                {/* Brief content */}
                {!backendReady&&(
                  <div style={{...card,textAlign:"center",padding:40}}>
                    <div style={{fontSize:24,marginBottom:12}}>🐍</div>
                    <div style={{fontSize:14,color:C.cream,fontFamily:"'IBM Plex Mono',monospace",marginBottom:6}}>Python backend offline</div>
                    <div style={{fontSize:12,color:C.mut}}>Run: cd backend && pip install -r requirements.txt && python main.py</div>
                  </div>
                )}

                {backendReady&&!brief&&!briefLoading&&(
                  <div style={{...card,textAlign:"center",padding:48}}>
                    <div style={{fontSize:40,marginBottom:16}}>☀️</div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:16,fontWeight:700,color:C.cream,marginBottom:8}}>Good morning, Vinod.</div>
                    <div style={{fontSize:13,color:C.mut,marginBottom:24,lineHeight:1.7,maxWidth:400,margin:"0 auto 24px"}}>
                      Click "Generate brief" to get your personalised BreakBot update — pipeline status, top actions, and the one thing to do today.
                    </div>
                    <button onClick={generateBrief} style={{...btn(C.red,"#000",false),padding:"12px 28px",fontSize:13}}>
                      Generate today's brief →
                    </button>
                    <div style={{fontSize:10,color:C.dim,marginTop:12,fontFamily:"'IBM Plex Mono',monospace"}}>
                      Auto-sends to your WhatsApp at 8am IST once configured
                    </div>
                  </div>
                )}

                {briefLoading&&(
                  <div style={{...card,textAlign:"center",padding:48}}>
                    <div style={{display:"inline-block",width:32,height:32,border:`3px solid ${C.red}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite",marginBottom:16}}/>
                    <div style={{fontSize:13,color:C.mut}}>ARIA is analysing your pipeline...</div>
                  </div>
                )}

                {brief&&!briefLoading&&(
                  <>
                    <div style={{...card,padding:24,marginBottom:14}}>
                      <div style={{fontSize:13,color:C.cream,lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"'IBM Plex Sans',sans-serif"}}>
                        {brief.text}
                      </div>
                    </div>

                    {/* Quick action buttons from brief */}
                    <div style={{...card,marginBottom:14}}>
                      <div style={{fontSize:10,fontWeight:700,color:C.cream,fontFamily:"'IBM Plex Mono',monospace",textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}}>Quick Actions</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                        {[
                          {icon:"✍️",label:"Write follow-up emails",action:()=>{setActiveAgent("followup");setView("agentchat");}},
                          {icon:"⚖️",label:"Score all prospects",action:()=>{setActiveAgent("qualifier");setView("agentchat");setChatInput("Score all my current prospects and tell me who to contact today");}},
                          {icon:"📊",label:"Analyse pipeline",action:()=>{setActiveAgent("analyst");setView("agentchat");setChatInput("Analyse my pipeline and tell me what's working and what to fix");}},
                        ].map((a,i)=>(
                          <button key={i} onClick={a.action} style={{background:C.sur2,border:`1px solid ${C.bdr}`,borderRadius:8,padding:"12px 14px",cursor:"pointer",textAlign:"left"}}>
                            <div style={{fontSize:18,marginBottom:6}}>{a.icon}</div>
                            <div style={{fontSize:11,color:C.cream,fontFamily:"'IBM Plex Mono',monospace"}}>{a.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* WhatsApp setup */}
                    <div style={{background:"rgba(45,186,110,.05)",border:`1px solid rgba(45,186,110,.2)`,borderRadius:10,padding:18}}>
                      <div style={{fontSize:10,fontWeight:700,color:C.grn,fontFamily:"'IBM Plex Mono',monospace",textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>📱 Get this brief on WhatsApp every morning</div>
                      <div style={{fontSize:12,color:C.mut,lineHeight:1.7,marginBottom:12}}>
                        The daily brief can be automatically sent to your WhatsApp at 8am IST every weekday via a Netlify scheduled function. Three env vars needed:
                      </div>
                      <div style={{background:C.sur2,borderRadius:7,padding:"10px 14px",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.cream,lineHeight:1.9}}>
                        TWILIO_ACCOUNT_SID=ACxxxxxxxx<br/>
                        TWILIO_AUTH_TOKEN=xxxxxxxx<br/>
                        TWILIO_WHATSAPP_FROM=whatsapp:+14155238886<br/>
                        VINOD_WHATSAPP_NUMBER=whatsapp:+917411521327
                      </div>
                      <div style={{fontSize:11,color:C.mut,marginTop:10,lineHeight:1.6}}>
                        Twilio free trial: <strong style={{color:C.cream}}>$15 credit</strong> = ~1,500 WhatsApp messages. More than enough for daily briefs for a year.
                        Sign up at twilio.com → Console → Messaging → Try WhatsApp.
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── DASHBOARD ── */}
            {view==="security"&&(
              <SecurityAuditPanel />
            )}

            {view==="dashboard"&&(
              <div style={{animation:"fadeIn .3s ease"}}>
                {/* Pipeline overview */}
                <div style={{...card, marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.cream,textTransform:"uppercase",letterSpacing:".1em",marginBottom:12,fontFamily:"'IBM Plex Mono',monospace"}}>Pipeline Overview</div>
                  <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
                    {STAGES.map(s => (
                      <div key={s.id} style={{background:C.sur2,border:`1px solid ${C.bdr}`,borderRadius:8,padding:"10px 14px",minWidth:100,flexShrink:0,cursor:"pointer"}} onClick={()=>{setView("pipeline");}}>
                        <div style={{fontSize:16,marginBottom:4}}>{s.icon}</div>
                        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:20,fontWeight:700,color:s.color}}>{stageCounts[s.id]||0}</div>
                        <div style={{fontSize:9,color:C.mut,textTransform:"uppercase",letterSpacing:".06em",marginTop:2,lineHeight:1.3}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  {/* Top prospects */}
                  <div style={card}>
                    <div style={{fontSize:10,fontWeight:700,color:C.cream,textTransform:"uppercase",letterSpacing:".1em",marginBottom:12,fontFamily:"'IBM Plex Mono',monospace"}}>🔥 Top Priority Prospects</div>
                    {prospects.filter(p=>p.tier==="A").slice(0,4).map(p => (
                      <div key={p.id} onClick={()=>{setSelected(p);setView("prospect-detail");}} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.bdr}`,cursor:"pointer"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,color:C.cream,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.company}</div>
                          <div style={{fontSize:10,color:C.mut}}>{p.country} · {p.title}</div>
                        </div>
                        <StageBadge stageId={p.stage}/>
                        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:700,color:C.grn,flexShrink:0}}>{p.score}</div>
                      </div>
                    ))}
                    {prospects.filter(p=>p.tier==="A").length===0&&<div style={{fontSize:12,color:C.dim,textAlign:"center",padding:"16px 0"}}>No Tier A prospects yet — run JUDGE agent</div>}
                  </div>

                  {/* Recent activity */}
                  <div style={card}>
                    <div style={{fontSize:10,fontWeight:700,color:C.cream,textTransform:"uppercase",letterSpacing:".1em",marginBottom:12,fontFamily:"'IBM Plex Mono',monospace"}}>📋 Recent Activity</div>
                    {prospects.flatMap(p=>(p.history||[]).map(h=>({...h,company:p.company,id:p.id}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map((h,i)=>(
                      <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:i<7?`1px solid ${C.bdr}`:"none"}}>
                        <div style={{width:3,background:C.red,borderRadius:2,flexShrink:0,alignSelf:"stretch"}}/>
                        <div>
                          <div style={{fontSize:11,color:C.cream}}><strong style={{color:C.red}}>{h.company}</strong> — {h.action}</div>
                          <div style={{fontSize:9,color:C.mut}}>{h.date}</div>
                        </div>
                      </div>
                    ))}
                    {prospects.every(p=>!p.history?.length)&&<div style={{fontSize:12,color:C.dim,textAlign:"center",padding:"16px 0"}}>No activity yet</div>}
                  </div>
                </div>

                {/* Agent quick-launch */}
                <div style={{...card,marginTop:14}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.cream,textTransform:"uppercase",letterSpacing:".1em",marginBottom:12,fontFamily:"'IBM Plex Mono',monospace"}}>Quick Launch Agents</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
                    {AGENTS.map(a=>(
                      <div key={a.id} className="agent-card" onClick={()=>{setActiveAgent(a.id);setView("agentchat");}}
                        style={{background:a.color,border:`1px solid ${C.bdr}`,borderRadius:8,padding:"12px 8px",textAlign:"center",transition:"border-color .15s"}}>
                        <div style={{fontSize:22,marginBottom:5}}>{a.emoji}</div>
                        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:700,color:C.cream,marginBottom:2}}>{a.name}</div>
                        <div style={{fontSize:8,color:C.mut}}>{a.role.split(" ")[0]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── PIPELINE (KANBAN) ── */}
            {view==="pipeline"&&(
              <div style={{animation:"fadeIn .3s ease"}}>
                <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8,minHeight:"calc(100vh - 140px)"}}>
                  {STAGES.filter(s=>!["drafted","researched"].includes(s.id)).map(stage=>{
                    const cols = prospects.filter(p=>p.stage===stage.id);
                    return(
                      <div key={stage.id} style={{minWidth:220,maxWidth:220,flexShrink:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,padding:"6px 10px",background:stage.bg,border:`1px solid ${stage.bdr}`,borderRadius:7}}>
                          <span style={{fontSize:13}}>{stage.icon}</span>
                          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:700,color:stage.color}}>{stage.label}</span>
                          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:stage.color,marginLeft:"auto"}}>{cols.length}</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:7}}>
                          {cols.map(p=>(
                            <div key={p.id} className="prospect-row" onClick={()=>{setSelected(p);setView("prospect-detail");}}
                              style={{background:C.sur,border:`1px solid ${C.bdr}`,borderRadius:8,padding:"12px 12px",cursor:"pointer",transition:"background .15s"}}>
                              <div style={{fontWeight:600,color:C.cream,fontSize:12,marginBottom:3}}>{p.company}</div>
                              <div style={{fontSize:10,color:C.mut,marginBottom:6}}>{p.country} · {p.contact}</div>
                              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                                <TierBadge tier={p.tier||"C"}/>
                                <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.mut,marginLeft:"auto"}}>{p.score}/100</span>
                              </div>
                            </div>
                          ))}
                          {cols.length===0&&<div style={{fontSize:11,color:C.dim,textAlign:"center",padding:"20px 0",border:`1px dashed ${C.bdr}`,borderRadius:8}}>Empty</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── PROSPECTS TABLE ── */}
            {view==="prospects"&&(
              <div style={{animation:"fadeIn .3s ease"}}>
                <div style={{...card,overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${C.bdr}`}}>
                        {["Company","Country","Contact","Stage","Tier","Score","Actions"].map(h=>(
                          <th key={h} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.mut,textTransform:"uppercase",letterSpacing:".1em",padding:"8px 10px",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prospects.map(p=>(
                        <tr key={p.id} className="prospect-row" style={{borderBottom:`1px solid ${C.bdr}`,transition:"background .15s",cursor:"pointer"}} onClick={()=>{setSelected(p);setView("prospect-detail");}}>
                          <td style={{padding:"10px 10px",fontWeight:600,color:C.cream,fontSize:12}}>{p.company}</td>
                          <td style={{padding:"10px 10px",color:C.mut,fontSize:11,whiteSpace:"nowrap"}}>{p.country}</td>
                          <td style={{padding:"10px 10px",fontSize:11,color:C.mut,whiteSpace:"nowrap"}}>{p.contact}<br/><span style={{fontSize:9,color:C.dim}}>{p.title}</span></td>
                          <td style={{padding:"10px 10px"}}><StageBadge stageId={p.stage}/></td>
                          <td style={{padding:"10px 10px"}}><TierBadge tier={p.tier||"C"}/></td>
                          <td style={{padding:"10px 10px",fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:700,color:C.grn}}>{p.score||"—"}</td>
                          <td style={{padding:"10px 10px"}}>
                            <div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
                              {["scout","qualifier","writer"].map(aid=>{
                                const a = AGENTS.find(x=>x.id===aid);
                                const isRun = runningAgent===`${aid}-${p.id}`;
                                return(
                                  <button key={aid} className="run-btn" onClick={()=>runAgent(aid,p)} disabled={!backendReady||!!runningAgent}
                                    title={`Run ${a?.name}`}
                                    style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,padding:"4px 8px",borderRadius:4,border:`1px solid rgba(232,52,26,.25)`,background:"transparent",color:C.red,cursor:"pointer",opacity:(!backendReady||!!runningAgent)?0.4:1}}>
                                    {isRun ? <span style={{display:"inline-block",width:8,height:8,border:`2px solid ${C.red}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}}/> : a?.emoji}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── AGENTS ROSTER ── */}
            {view==="agents"&&(
              <div style={{animation:"fadeIn .3s ease",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                {AGENTS.map(a=>(
                  <div key={a.id} className="agent-card" onClick={()=>{setActiveAgent(a.id);setView("agentchat");}}
                    style={{...card,background:a.color,borderRadius:10,padding:20,cursor:"pointer",transition:"all .15s"}}>
                    <div style={{fontSize:32,marginBottom:10}}>{a.emoji}</div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:14,fontWeight:700,color:C.cream,marginBottom:3}}>{a.name}</div>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.red,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>{a.role}</div>
                    <div style={{fontSize:12,color:C.mut,lineHeight:1.6,marginBottom:12}}>{a.desc}</div>
                    <button style={{...btn(C.red,"#000",false),width:"100%",fontSize:11}}>Open Chat →</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── AGENT CHAT ── */}
            {view==="agentchat"&&activeAgent&&(()=>{
              const a = AGENTS.find(x=>x.id===activeAgent);
              const hist = agentChat[activeAgent]||[];
              return(
                <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:14,height:"calc(100vh - 110px)",animation:"fadeIn .3s ease"}}>
                  <div style={{...card,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                    <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${C.bdr}`,flexShrink:0}}>
                      <div style={{width:44,height:44,borderRadius:10,background:a.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{a.emoji}</div>
                      <div>
                        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,fontSize:14,color:C.cream}}>{a.name}</div>
                        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,color:C.red,textTransform:"uppercase",letterSpacing:".1em"}}>{a.role}</div>
                        <div style={{fontSize:11,color:C.mut,marginTop:3}}>{a.desc}</div>
                      </div>
                    </div>
                    <div style={{flex:1,overflowY:"auto",marginBottom:12,paddingRight:4}}>
                      {hist.length===0&&(
                        <div style={{display:"flex",gap:9,marginBottom:10}}>
                          <div style={{width:28,height:28,borderRadius:6,background:a.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{a.emoji}</div>
                          <div style={{maxWidth:"85%",padding:"9px 12px",borderRadius:"2px 8px 8px 8px",fontSize:12,lineHeight:1.6,background:C.sur2,border:`1px solid ${C.bdr}`,color:C.cream}}>
                            Hi Vinod! I'm {a.name}, your {a.role}. Ask me anything about your prospects or let me help you with outreach.
                          </div>
                        </div>
                      )}
                      {hist.map((m,i)=>(
                        <div key={i} style={{display:"flex",gap:9,flexDirection:m.role==="user"?"row-reverse":"row",marginBottom:10,animation:"fadeIn .25s ease"}}>
                          <div style={{width:26,height:26,borderRadius:6,background:m.role==="user"?C.rdim:a.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:2}}>{m.role==="user"?"⭐":a.emoji}</div>
                          <div style={{maxWidth:"85%",padding:"9px 12px",borderRadius:m.role==="user"?"8px 2px 8px 8px":"2px 8px 8px 8px",fontSize:12,lineHeight:1.6,background:m.role==="user"?C.rdim:C.sur2,border:`1px solid ${m.role==="user"?"rgba(232,52,26,.25)":C.bdr}`,color:C.cream,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{m.content}</div>
                        </div>
                      ))}
                      {loading&&<div style={{display:"flex",gap:9}}><div style={{width:26,height:26,borderRadius:6,background:a.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>{a.emoji}</div><div style={{padding:"9px 12px",background:C.sur2,border:`1px solid ${C.bdr}`,borderRadius:"2px 8px 8px 8px",display:"flex",gap:5,alignItems:"center"}}>{[0,.2,.4].map((d,i)=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:C.mut,display:"inline-block",animation:`pulse 1.2s ${d}s infinite`}}/>)}</div></div>}
                      <div ref={chatEnd}/>
                    </div>
                    <div style={{display:"flex",gap:8,flexShrink:0}}>
                      <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()} placeholder={backendReady?`Ask ${a.name} anything — try "send email to [company]"`:"Start Python backend to chat"} disabled={!backendReady||loading} style={{...inp,flex:1}}/>
                      <button onClick={sendChat} disabled={!backendReady||loading||!chatInput.trim()} style={btn(C.red,"#000",!backendReady||loading||!chatInput.trim())}>{loading?"...":"Send ↗"}</button>
                      {hist.length>0&&<button onClick={()=>setAgentChat(prev=>({...prev,[activeAgent]:[]}))} style={btn(C.sur2,C.mut,false)} title="Clear">↺</button>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div style={card}>
                      <div style={{fontSize:10,fontWeight:700,color:C.cream,fontFamily:"'IBM Plex Mono',monospace",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Run on prospect</div>
                      <select style={{...inp,marginBottom:8,cursor:"pointer"}} id="prospect-select">
                        {prospects.map(p=><option key={p.id} value={p.id}>{p.company} — {p.tier||"?"}</option>)}
                      </select>
                      <button onClick={()=>{
                        const sel = document.getElementById("prospect-select").value;
                        const p = prospects.find(x=>x.id===parseInt(sel)||x.id===sel);
                        if(p) runAgent(activeAgent, p);
                      }} disabled={!backendReady||!!runningAgent} style={{...btn(C.red,"#000",!backendReady||!!runningAgent),width:"100%"}}>
                        {runningAgent?`${a.emoji} Running...`:`${a.emoji} Run ${a.name}`}
                      </button>
                    </div>
                    {/* Last output */}
                    {Object.entries(agentOutput).filter(([k])=>k.startsWith(activeAgent)).slice(-1).map(([k,v])=>(
                      <div key={k} style={{...card,flex:1,overflowY:"auto"}}>
                        <div style={{fontSize:10,fontWeight:700,color:C.red,fontFamily:"'IBM Plex Mono',monospace",textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>Last output</div>
                        <pre style={{fontSize:10,color:C.mut,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"'IBM Plex Mono',monospace"}}>{JSON.stringify(v,null,2)}</pre>
                      </div>
                    ))}
                    <div style={card}>
                      <div style={{fontSize:10,fontWeight:700,color:C.cream,fontFamily:"'IBM Plex Mono',monospace",textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>Quick prompts</div>
                      {["Research my top 3 prospects this week","Which prospects should I contact today?","Write a follow-up for someone who opened but didn't reply","What's my best performing outreach channel?","Score all my current prospects"].map((q,i)=>(
                        <button key={i} onClick={()=>setChatInput(q)} style={{display:"block",width:"100%",textAlign:"left",background:C.sur2,border:`1px solid ${C.bdr}`,color:C.mut,fontSize:10,padding:"7px 10px",borderRadius:5,cursor:"pointer",marginBottom:5,fontFamily:"'IBM Plex Mono',monospace"}}>{q}</button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── PROSPECT DETAIL ── */}
            {view==="prospect-detail"&&selected&&(()=>{
              const p = prospects.find(x=>x.id===selected.id)||selected;
              return(
                <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:14,animation:"fadeIn .3s ease"}}>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {/* Header */}
                    <div style={card}>
                      <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:16}}>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:20,fontWeight:700,color:C.cream,marginBottom:4}}>{p.company}</div>
                          <div style={{fontSize:12,color:C.mut,marginBottom:8}}>{p.country} · {p.industry} · {p.contact} ({p.title})</div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            <StageBadge stageId={p.stage}/>
                            <TierBadge tier={p.tier||"C"}/>
                            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:C.grn,fontWeight:700}}>{p.score}/100</span>
                          </div>
                        </div>
                        <button onClick={()=>setView("prospects")} style={btn(C.sur2,C.mut,false)}>← Back</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        <div style={{background:C.sur2,borderRadius:7,padding:"10px 12px"}}>
                          <div style={{fontSize:9,color:C.mut,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4,fontFamily:"'IBM Plex Mono',monospace"}}>Email</div>
                          <div style={{fontSize:11,color:C.cream}}>{p.email||"—"}</div>
                        </div>
                        <div style={{background:C.sur2,borderRadius:7,padding:"10px 12px"}}>
                          <div style={{fontSize:9,color:C.mut,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4,fontFamily:"'IBM Plex Mono',monospace"}}>LinkedIn</div>
                          {p.linkedin ? (
                            <a href={normalizeLinkedIn(p.linkedin)} target="_blank" rel="noopener noreferrer"
                              style={{fontSize:11,color:C.blu,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>
                              {normalizeLinkedIn(p.linkedin)}
                            </a>
                          ) : (
                            <div style={{fontSize:11,color:C.dim}}>—</div>
                          )}
                        </div>
                        <div style={{background:C.sur2,borderRadius:7,padding:"10px 12px",gridColumn:"1/-1"}}>
                          <div style={{fontSize:9,color:C.mut,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4,fontFamily:"'IBM Plex Mono',monospace"}}>Their Chatbot</div>
                          <div style={{fontSize:11,color:C.cream}}>{p.chatbot||"Unknown"}</div>
                        </div>
                      </div>
                    </div>

                    {/* Update stage */}
                    <div style={card}>
                      <div style={{fontSize:10,fontWeight:700,color:C.cream,fontFamily:"'IBM Plex Mono',monospace",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Update Stage</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                        {STAGES.map(s=>(
                          <button key={s.id} onClick={()=>{updateProspect(p.id,{stage:s.id});addHistory(p.id,`Stage updated to: ${s.label}`);}} style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,padding:"4px 10px",borderRadius:20,border:`1px solid ${p.stage===s.id?s.color:C.bdr}`,background:p.stage===s.id?s.bg:"transparent",color:p.stage===s.id?s.color:C.mut,cursor:"pointer",fontWeight:p.stage===s.id?700:400}}>
                            {s.icon} {s.label}
                          </button>
                        ))}
                      </div>
                      <textarea placeholder="Add a note..." value={p.notes||""} onChange={e=>updateProspect(p.id,{notes:e.target.value})} style={{...inp,minHeight:64,lineHeight:1.6}}/>
                    </div>

                    {/* Drafted email */}
                    {p.draftEmail&&(
                      <div style={card}>
                        <div style={{fontSize:10,fontWeight:700,color:C.cream,fontFamily:"'IBM Plex Mono',monospace",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>✍️ Drafted Email (by NOVA)</div>
                        <div style={{background:C.sur2,borderRadius:7,padding:"12px 14px",marginBottom:8}}>
                          <div style={{fontSize:9,color:C.mut,fontFamily:"'IBM Plex Mono',monospace",marginBottom:4}}>SUBJECT</div>
                          <div style={{fontSize:13,fontWeight:600,color:C.cream}}>{p.draftEmail.subject}</div>
                        </div>
                        <div style={{background:C.sur2,borderRadius:7,padding:"12px 14px"}}>
                          <div style={{fontSize:9,color:C.mut,fontFamily:"'IBM Plex Mono',monospace",marginBottom:4}}>BODY</div>
                          <div style={{fontSize:12,color:C.mut,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{p.draftEmail.body}</div>
                          {p.draftEmail.ps_line&&<div style={{marginTop:8,fontSize:11,color:C.dim,fontStyle:"italic"}}>P.S. {p.draftEmail.ps_line}</div>}
                        </div>
                        <div style={{ display:"flex", gap:8, marginTop:10 }}>
                          <button onClick={() => sendEmailToProspect(p)} disabled={sendingEmail === p.id || !backendReady}
                            style={{ ...btn(C.grn, "#000", sendingEmail === p.id || !backendReady), flex:1 }}>
                            {sendingEmail === p.id ? "Sending..." : "📤 Send Email Now"}
                          </button>
                          <button onClick={() => { updateProspect(p.id, { stage:"sent" }); addHistory(p.id, "Email marked as sent manually"); }}
                            style={{ ...btn(C.sur2, C.mut, false) }}>
                            Mark sent
                          </button>
                        </div>
                      </div>
                    )}

                    {/* LinkedIn outreach */}
                    {p.linkedinOutput&&(
                      <div style={card}>
                        <div style={{fontSize:10,fontWeight:700,color:C.cream,fontFamily:"'IBM Plex Mono',monospace",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>🔗 LinkedIn Outreach (by LINK)</div>
                        {p.linkedinOutput.linkedin_profile_url&&(
                          <div style={{background:C.sur2,borderRadius:7,padding:"10px 12px",marginBottom:8}}>
                            <div style={{fontSize:9,color:C.mut,fontFamily:"'IBM Plex Mono',monospace",marginBottom:4}}>PROFILE</div>
                            <a href={normalizeLinkedIn(p.linkedinOutput.linkedin_profile_url||p.linkedin)} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.blu}}>
                              {normalizeLinkedIn(p.linkedinOutput.linkedin_profile_url||p.linkedin)}
                            </a>
                          </div>
                        )}
                        {p.linkedinOutput.connection_request&&(
                          <div style={{background:C.sur2,borderRadius:7,padding:"12px 14px",marginBottom:8}}>
                            <div style={{fontSize:9,color:C.mut,fontFamily:"'IBM Plex Mono',monospace",marginBottom:4}}>CONNECTION REQUEST</div>
                            <div style={{fontSize:12,color:C.mut,lineHeight:1.7}}>{p.linkedinOutput.connection_request}</div>
                          </div>
                        )}
                        {p.linkedinOutput.initial_dm&&(
                          <div style={{background:C.sur2,borderRadius:7,padding:"12px 14px"}}>
                            <div style={{fontSize:9,color:C.mut,fontFamily:"'IBM Plex Mono',monospace",marginBottom:4}}>INITIAL DM</div>
                            <div style={{fontSize:12,color:C.mut,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{p.linkedinOutput.initial_dm}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right panel */}
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {/* Run agents */}
                    <div style={card}>
                      <div style={{fontSize:10,fontWeight:700,color:C.cream,fontFamily:"'IBM Plex Mono',monospace",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Run Agents</div>
                      {AGENTS.map(a=>{
                        const isRun = runningAgent===`${a.id}-${p.id}`;
                        const out = agentOutput[`${a.id}-${p.id}`];
                        return(
                          <div key={a.id} style={{marginBottom:8}}>
                            <button onClick={()=>runAgent(a.id,p)} disabled={!backendReady||!!runningAgent}
                              style={{...btn(C.sur2,C.mut,!backendReady||!!runningAgent),width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:8,border:`1px solid ${C.bdr}`,padding:"9px 12px"}}>
                              <span style={{fontSize:14}}>{a.emoji}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:11,fontWeight:700,color:C.cream}}>{a.name}</div>
                                <div style={{fontSize:9,color:C.mut}}>{a.role}</div>
                              </div>
                              {isRun&&<span style={{display:"inline-block",width:10,height:10,border:`2px solid ${C.red}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>}
                              {out&&!isRun&&<span style={{fontSize:9,color:C.grn}}>✓</span>}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* History */}
                    <div style={{...card,flex:1,overflowY:"auto"}}>
                      <div style={{fontSize:10,fontWeight:700,color:C.cream,fontFamily:"'IBM Plex Mono',monospace",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>History</div>
                      {(p.history||[]).length===0&&<div style={{fontSize:11,color:C.dim,textAlign:"center",padding:"16px 0"}}>No history yet</div>}
                      {[...(p.history||[])].reverse().map((h,i)=>(
                        <div key={i} style={{display:"flex",gap:8,padding:"7px 0",borderBottom:i<(p.history.length-1)?`1px solid ${C.bdr}`:"none"}}>
                          <div style={{width:3,background:C.red,borderRadius:2,flexShrink:0,alignSelf:"stretch"}}/>
                          <div>
                            <div style={{fontSize:11,color:C.cream,lineHeight:1.4}}>{h.action}</div>
                            <div style={{fontSize:9,color:C.mut,marginTop:2}}>{h.date}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── ADD PROSPECT MODAL ── */}
      {addForm!==null&&(
        <div style={{position:"fixed",inset:0,background:"rgba(6,6,5,.88)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:C.sur,border:`1px solid ${C.bdr2}`,borderRadius:12,width:520,maxWidth:"95vw",padding:24,maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontWeight:700,fontSize:15,color:C.cream,marginBottom:6}}>Add New Prospect</div>
            <div style={{fontSize:12,color:C.mut,marginBottom:20}}>Add them manually then run SCOUT + JUDGE to automatically research and score them.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              {[["company","Company name *"],["country","Country"],["industry","Industry"],["contact","Contact name"],["title","Job title"],["email","Email address"],["linkedin","LinkedIn URL"],["chatbot","Their AI chatbot (describe)"]].map(([k,l])=>(
                <div key={k} style={{gridColumn:k==="chatbot"?"1/-1":"auto"}}>
                  <div style={{fontSize:9,color:C.mut,fontFamily:"'IBM Plex Mono',monospace",textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>{l}</div>
                  <input value={addForm[k]||""} onChange={e=>setAddForm(prev=>({...prev,[k]:e.target.value}))} style={inp} placeholder={l.replace(" *","")}/>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
              <button onClick={()=>setAddForm(null)} style={btn(C.sur2,C.mut,false)}>Cancel</button>
              <button onClick={()=>{
                if(!addForm.company){alert("Company name required");return;}
                const np={...addForm,id:Date.now(),stage:"researched",score:0,tier:"C",history:[{date:new Date().toLocaleDateString(),action:"Prospect added manually",ts:new Date().toISOString()}],addedAt:new Date().toISOString()};
                setProspects(prev=>{const n=[...prev,np];LS.set("bb_prospects",n);return n;});
                pushNotif("system",`${addForm.company} added to pipeline`,`Run SCOUT to research and JUDGE to score — then NOVA to draft the email`,{prospectId:np.id,company:addForm.company});
                setAddForm(null);
                setView("prospects");
              }} style={btn(C.red,"#000",!addForm?.company)}>Add Prospect →</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
