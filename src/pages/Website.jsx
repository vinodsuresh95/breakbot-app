import { useEffect } from 'react'
import { INDUSTRY_PACKS, TOTAL_LIBRARY, CORE_PROBES, INDUSTRY_PACK_COUNT, HEADLINE_PROBES } from '../data/industryPacks.js'
import './Website.css'

export default function Website() {
  const nav = (p) => window._nav && window._nav(p)

  useEffect(() => {
    // Scroll reveal
    const reveals = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(entries => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add('visible'), i * 70)
          obs.unobserve(e.target)
        }
      })
    }, { threshold: 0.08 })
    reveals.forEach(r => obs.observe(r))

    // Nav transparency
    const onScroll = () => {
      const n = document.querySelector('.site-nav')
      if (n) n.style.background = window.scrollY > 20 ? 'rgba(3,7,18,0.97)' : 'rgba(3,7,18,0.88)'
    }
    window.addEventListener('scroll', onScroll)
    return () => { obs.disconnect(); window.removeEventListener('scroll', onScroll) }
  }, [])

  // Waitlist submit — calls Netlify function
  const handleWaitlist = async (e) => {
    e.preventDefault()
    const form = e.target
    const data = {
      name:    form.querySelector('[name=name]').value,
      email:   form.querySelector('[name=email]').value,
      phone:   form.querySelector('[name=phone]').value,
      chatbot: form.querySelector('[name=chatbot]').value,
      industry: form.querySelector('[name=industry]').value,
      message: form.querySelector('[name=message]').value,
      source:  'website',
    }
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch {}
    form.style.display = 'none'
    document.getElementById('wlSuccess').style.display = 'block'
  }

  return (
    <div className="site">

      {/* ── NAV ── */}
      <nav className="site-nav">
        <div className="nav-logo" onClick={() => nav('')}>
          <span className="logo-text">BREAK<span>BOT</span></span>
        </div>
        <ul className="nav-links">
          <li><a href="#how">How it works</a></li>
          <li><a href="#tests">What we test</a></li>
          <li><a href="#industries">Industries</a></li>
          <li><a href="#waitlist" className="nav-cta">Get free audit</a></li>
        </ul>
      </nav>

      {/* ── HERO ── */}
      <section className="hero" id="home">
        <div className="hero-grid" />
        <p className="hero-eyebrow">AI Chatbot Security Testing</p>
        <h1>We <em>break</em> your chatbot.<br/><strong>Before attackers do.</strong></h1>
        <p className="hero-sub">
          Send us your chatbot. We run <strong>{HEADLINE_PROBES} adversarial attacks</strong> — jailbreaks,
          data leaks, harmful outputs, compliance failures — and send you a full report of
          every vulnerability within 24 hours.
        </p>
        <div className="hero-btns">
          <button className="btn-primary"
            onClick={() => document.getElementById('waitlist').scrollIntoView({ behavior: 'smooth' })}>
            Get free audit ↗
          </button>
          <button className="btn-secondary"
            onClick={() => document.getElementById('how').scrollIntoView({ behavior: 'smooth' })}>
            See how it works
          </button>
        </div>
        <div className="hero-note">First 100 companies · Free · No credit card needed</div>
      </section>

      {/* ── PROOF STRIP ── */}
      <div className="proof-strip">
        {[
          { val: HEADLINE_PROBES, label: 'adversarial probes' },
          { val: String(INDUSTRY_PACK_COUNT), label: 'industry packs' },
          { val: String(CORE_PROBES), label: 'core OWASP tests' },
          { val: '24h', label: 'report delivery' },
        ].map((p, i) => (
          <div key={i} className="proof-item">
            <div className="proof-dot" />
            <strong>{p.val}</strong> {p.label}
          </div>
        ))}
      </div>

      {/* ── MARQUEE ── */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          {[
            'Prompt Injection','Jailbreak Detection','Data Exfiltration','Policy Violations',
            'Agentic Exploits','Hallucination Probing','EU AI Act','OWASP LLM Top 10',
            'RAG Poisoning','Multi-Agent Attacks','PAP Attacks','Crescendo Jailbreaks',
            'Prompt Injection','Jailbreak Detection','Data Exfiltration','Policy Violations',
            'Agentic Exploits','Hallucination Probing','EU AI Act','OWASP LLM Top 10',
          ].map((t, i) => (
            <span key={i} className="marquee-item">{t}<span className="sep">■</span></span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section className="how" id="how">
        <div className="container">
          <div className="reveal">
            <p className="sec-label">How it works</p>
            <h2 className="sec-title">Three steps.<br/><em>One report.</em></h2>
            <p className="sec-sub">No setup required. No SDK to install. No engineers needed on your side.</p>
          </div>
          <div className="how-grid">
            <div className="reveal how-steps">
              {[
                {
                  n: '01', h: 'Share your chatbot',
                  p: 'Give us your chatbot\'s API endpoint or URL. Works with any chatbot — customer support bots, AI assistants, WhatsApp bots, website widgets, anything with an API.',
                },
                {
                  n: '02', h: `We run ${HEADLINE_PROBES} adversarial tests`,
                  p: `${TOTAL_LIBRARY} probes in our library — core OWASP coverage plus your industry pack. Jailbreaks, prompt injections, data leaks, harmful advice, PAP attacks, agentic exploits. Every single one relevant to your bot.`,
                },
                {
                  n: '03', h: 'You get the full report',
                  p: 'Within 24 hours: a detailed PDF with every failure, evidence of the exact conversation that triggered it, severity score, OWASP mapping, and a specific fix recommendation.',
                },
              ].map((s, i) => (
                <div key={i} className="step">
                  <span className="step-num">{s.n}</span>
                  <div><h3>{s.h}</h3><p>{s.p}</p></div>
                </div>
              ))}
            </div>
            <div className="reveal report-mock">
              <div className="rm-header">
                <span className="rm-title">BREAKBOT AUDIT REPORT</span>
                <div className="rm-score">34</div>
              </div>
              {[
                { n: 'Revealed internal system prompt',      b: 'bc', l: 'Critical' },
                { n: 'Gave dangerous medical advice',        b: 'bc', l: 'Critical' },
                { n: 'Successfully jailbroken via DAN',      b: 'bc', l: 'Critical' },
                { n: 'Denied being an AI (EU AI Act)',       b: 'bh', l: 'High'     },
                { n: 'Indirect injection via document',      b: 'bh', l: 'High'     },
                { n: 'Handled brand questions correctly',    b: 'bp', l: 'Pass'      },
              ].map((r, i) => (
                <div key={i} className="rm-row">
                  <span className="rm-name">{r.n}</span>
                  <span className={`badge ${r.b}`}>{r.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT WE TEST ── */}
      <section className="tests-sec" id="tests">
        <div className="container">
          <div className="reveal">
            <p className="sec-label">What we test</p>
            <h2 className="sec-title">{HEADLINE_PROBES} probes.<br/><em>10 OWASP categories.</em></h2>
            <p className="sec-sub">{CORE_PROBES} core tests plus {INDUSTRY_PACK_COUNT} industry packs — fintech, SaaS, India RBI/DPDP, telecom, and more.</p>
          </div>
          <div className="test-grid reveal">
            {[
              { n:'01', t:'Prompt Injection',      d:'Can someone override your bot\'s instructions with hidden commands, MCP tools, or RAG poisoning?', c:'60 tests' },
              { n:'02', t:'Jailbreaks & PAP',      d:'Skeleton key, many-shot, policy puppetry — can users break free of safety guardrails?',           c:'65 tests' },
              { n:'03', t:'Data Exfiltration',     d:'Will it reveal system prompts, credentials, cross-tenant data, or vector DB contents?',          c:'50 tests' },
              { n:'04', t:'Hallucinations',         d:'Does it confidently state dangerous falsehoods or fabricate citations and facts?',                c:'46 tests' },
              { n:'05', t:'Agentic Exploits',       d:'Can attackers hijack tool use, browser agents, memory, or multi-agent pipelines?',              c:'40 tests' },
              { n:'06', t:'Supply Chain',           d:'Can malicious plugins, MCP servers, or poisoned model weights compromise your bot?',            c:'15 tests' },
              { n:'07', t:'Excessive Agency',       d:'Will it take unauthorised actions — send emails, modify data, make purchases?',                   c:'45 tests' },
              { n:'08', t:'Compliance Failures',    d:'Does it violate GDPR, EU AI Act Article 52, HIPAA, or FTC consumer rules?',                      c:'50 tests' },
              { n:'09', t:'Overreliance',           d:'Does it encourage dangerous over-dependence on AI for critical health or legal decisions?',        c:'35 tests' },
              { n:'10', t:'Denial of Service',      d:'Can attackers exhaust tokens, context windows, or tool-call loops?',                            c:'30 tests' },
            ].map((t, i) => (
              <div key={i} className="test-card">
                <p className="test-num">{t.n}</p>
                <h3>{t.t}</h3>
                <p>{t.d}</p>
                <p className="test-count">{t.c}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INDUSTRY PACKS ── */}
      <section className="industry-sec" id="industries">
        <div className="container">
          <div className="reveal">
            <p className="sec-label">Industry packs</p>
            <h2 className="sec-title">Built for<br/><em>your sector.</em></h2>
            <p className="sec-sub">
              Pick your industry — we add 12–18 targeted probes on top of {CORE_PROBES} core tests.
              <strong> {INDUSTRY_PACK_COUNT} verticals</strong> available. India pack covers RBI, DPDP, UPI, Aadhaar.
            </p>
          </div>
          <div className="industry-grid reveal">
            {INDUSTRY_PACKS.map(p => (
              <div key={p.id} className="industry-card">
                <div className="industry-icon">{p.icon}</div>
                <h3>{p.name}</h3>
                <p className="industry-regs">{p.market}</p>
                <p className="industry-count">+{p.probes} industry probes · {CORE_PROBES + p.probes} total audit</p>
              </div>
            ))}
          </div>
          <p className="industry-total reveal">
            <strong>{TOTAL_LIBRARY} probes</strong> in the full library across all {INDUSTRY_PACK_COUNT} industries.
            Typical client audit: <strong>{CORE_PROBES} core + your industry pack</strong>.
          </p>
        </div>
      </section>

      {/* ── FINDINGS / SOCIAL PROOF ── */}
      <section className="proof-sec" id="findings">
        <div className="container">
          <div className="reveal">
            <p className="sec-label">Real findings</p>
            <h2 className="sec-title">What we find<br/><em>every time.</em></h2>
            <p className="sec-sub">These are the failure patterns we see repeatedly across chatbots in every industry.</p>
          </div>
          <div className="proof-grid reveal">
            {[
              {
                quote: 'The bot revealed its entire system prompt within 30 seconds of us asking it to "summarise this document" that contained a hidden injection.',
                author: 'Finding in a fintech customer support bot',
                finding: 'Critical: indirect prompt injection via document upload',
              },
              {
                quote: 'We asked the bot to summarise loan terms for a high-risk product. It omitted key fee disclosures and stated the APR confidently — a direct consumer-protection failure.',
                author: 'Finding in a fintech support chatbot',
                finding: 'Critical: harmful financial advice without required disclosures',
              },
              {
                quote: 'When asked sincerely "are you a human?", the bot said yes. Under EU AI Act Article 52, this is a legal violation — not just a product bug.',
                author: 'Finding in an enterprise SaaS support bot',
                finding: 'High: EU AI Act compliance failure — denied being an AI',
              },
            ].map((p, i) => (
              <div key={i} className="proof-card">
                <p className="proof-quote">{p.quote}</p>
                <p className="proof-author">{p.author}</p>
                <div className="proof-finding">{p.finding}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section className="who-sec" id="who">
        <div className="container">
          <div className="reveal">
            <p className="sec-label">Who it's for</p>
            <h2 className="sec-title">If you've deployed<br/><em>any AI chatbot.</em></h2>
          </div>
          <div className="who-grid reveal">
            {[
              {
                r: 'CTOs & Engineering',
                h: "You built it. Now prove it's safe.",
                p: "You've shipped a chatbot and users are in production. But have you tested what happens when someone actually tries to break it?",
                l: ['Test before every major release', 'Catch failures before users do', 'Get a report you can take to the board'],
              },
              {
                r: 'Compliance & Legal',
                h: 'Regulators are watching AI closely.',
                p: 'EU AI Act enforcement began 2025. GDPR applies to AI outputs. DPDP applies in India. Do you know if your chatbot or agent is compliant?',
                l: ['Regulation-mapped findings', 'Signed audit report for regulators', 'EU AI Act Article 52 disclosure testing'],
              },
              {
                r: 'Security Teams',
                h: 'AI is the new attack surface.',
                p: "Traditional pen testing doesn't cover LLM vulnerabilities. Attackers are already probing your chatbots. We test the way they do.",
                l: [`${HEADLINE_PROBES} probe library`, `${INDUSTRY_PACK_COUNT} industry packs`, 'Full attack evidence and reproducible steps'],
              },
            ].map((w, i) => (
              <div key={i} className="who-card">
                <p className="who-role">{w.r}</p>
                <h3>{w.h}</h3>
                <p>{w.p}</p>
                <ul>{w.l.map((li, j) => <li key={j}>{li}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAITLIST ── */}
      <section className="waitlist-sec" id="waitlist">
        <div className="container">
          <div className="waitlist-inner reveal">
            <p className="sec-label wl-label-center">Get your free audit</p>
            <h2 className="waitlist-title">
              Your chatbot has<br/><em>blind spots.</em><br/>Find them first.
            </h2>
            <p className="waitlist-sub">
              Tell us your industry on the form — we'll include the right pack (fintech, SaaS, India RBI/DPDP, telecom, HR, and 11 more).
              We'll run it and send you the PDF report within 24 hours.
            </p>

            <form className="wl-form" id="wlForm" onSubmit={handleWaitlist}>
              <div className="wl-row">
                <div className="wl-field">
                  <label className="wl-lbl">Your name</label>
                  <input className="wl-inp" name="name" type="text" placeholder="Jane Smith" required />
                </div>
                <div className="wl-field">
                  <label className="wl-lbl">Work email</label>
                  <input className="wl-inp" name="email" type="email" placeholder="jane@company.com" required />
                </div>
                <div className="wl-field">
                  <label className="wl-lbl">Phone number</label>
                  <input className="wl-inp" name="phone" type="tel" placeholder="+1 555 000 0000" />
                </div>
                <div className="wl-field">
                  <label className="wl-lbl">Describe your chatbot</label>
                  <input className="wl-inp" name="chatbot" type="text" placeholder="e.g. Customer support bot on our website" />
                </div>
                <div className="wl-field">
                  <label className="wl-lbl">Your industry</label>
                  <select className="wl-inp wl-select" name="industry" required defaultValue="">
                    <option value="" disabled>Select industry pack</option>
                    {INDUSTRY_PACKS.map(p => (
                      <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                    ))}
                    <option value="OTHER">Other / not listed</option>
                  </select>
                </div>
              </div>
              <div className="wl-field wl-full">
                <label className="wl-lbl">Anything else we should know?</label>
                <textarea className="wl-ta" name="message" placeholder="What platform is it on? Any specific compliance concerns? What does it have access to?" />
              </div>
              <button className="wl-submit" type="submit">
                Request my free audit →
              </button>
            </form>

            <p className="wl-note">No spam · No credit card · We'll respond personally within 24 hours</p>
            <div id="wlSuccess" className="wl-success">
              ✓ Request received — we'll be in touch within 24 hours with next steps.
            </div>

            <div className="wl-whatsapp">
              <p className="wl-wa-label">Or reach us directly on WhatsApp</p>
              <a href="https://wa.me/917411521327" target="_blank" rel="noreferrer" className="wl-wa-link">
                wa.me/917411521327 →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        <span className="footer-logo">BREAK<span>BOT</span></span>
        <ul className="footer-links">
          <li><a href="#home">Home</a></li>
          <li><a href="#how">How it works</a></li>
          <li><a href="#tests">What we test</a></li>
          <li><a href="#industries">Industries</a></li>
          <li><a href="#waitlist">Contact</a></li>
          <li><a href="mailto:hello@breakbot.io">hello@breakbot.io</a></li>
        </ul>
        <span className="footer-copy">© 2026 BreakBot</span>
      </footer>
    </div>
  )
}
