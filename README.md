# BreakBot — Local Client Audit Edition

Run BreakBot on your Mac for the first 2–3 authorized clients. Not customer-facing SaaS yet.

## Operating model

```text
Client staging endpoint (authorized)
        ↓
You run BreakBot locally (127.0.0.1)
        ↓
Manual review of FAIL / PARTIAL
        ↓
Export HTML report (Draft → Reviewed → Final)
        ↓
Delete evidence / credentials
```

**Do not build yet:** cloud multi-tenant SaaS, Postgres, billing, customer portal, CI/CD for clients.

## Run locally

### 1. Backend (loopback only)

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # ANTHROPIC_API_KEY (+ optional DASHBOARD_API_KEY)
python main.py         # http://127.0.0.1:8001 — NOT 0.0.0.0
```

### 2. Frontend

```bash
npm install
npm run dev            # http://localhost:3000
```

Open: **http://localhost:3000/bb-command-2026** → **Security Audit**

Demonstrate via screen share — do not tunnel your Mac publicly.

## Client audit workflow

1. Written authorization + staging URL (HTTPS preferred)
2. 3-probe connectivity → 8-probe run → 25–50 if stable
3. Manually **Confirm FAIL**, mark **False positive**, or **Exclude**
4. Set report status **Reviewed** → **Final**
5. **Export HTML report**
6. **Delete evidence** / **Delete audit** + rotate client credentials

## What is protected

| Asset | Protection |
|-------|------------|
| Backend bind | `127.0.0.1` by default |
| Audits on disk | `backend/data/audits/` (gitignored) |
| Secrets | `backend/.env` (gitignored) |
| Probe library | Server-side only |
| Dashboard APIs | `DASHBOARD_API_KEY` when set (fail-closed if `APP_ENV=production`) |
| HTTP targets | HTTPS required unless `ALLOW_HTTP_TARGETS=true` |
| Evidence | Secret redaction on persist |

See `SECURITY.md` for the full checklist.

## GitHub note

If the repo was public with prospect data in history: make it **private** or rewrite history before sharing with clients.


## Verified local workflow changes

- Every finding must be reviewed or explicitly excluded before Reviewed/Final.
- Editing a review returns the report to Draft. Failed/partial runs cannot be Final.
- Client HTML exports contain reviewed findings only and omit internal API costs.
- Empty runs have no security score. Keyword matches are advisory signals.
- Configure request/response field paths and an optional bearer token in the audit panel.
- Retention is a reminder (7–365 days), not automatic deletion. Due audits are marked in history.
- Evidence deletion removes prompts, replies, reviewer text, scope, and copied evidence; delete the audit to remove the entire record.
- Print the exported HTML using the browser's Save as PDF option.
- SCOUT has no live browsing. Its output is explicitly unverified; confirm facts before outreach.

Validation: `backend/.venv/bin/python -m unittest discover -s backend/tests -v` and `npm run build`.
Tests use temporary audit storage and mocked model/target calls, never customer endpoints.

Remaining limitations: synchronous single-turn audits (maximum 50 probes), local file storage,
no live-source research, and operator review required. Existing API cost rates are estimates;
check the provider invoice before using them for billing. This build is not a certification
of OWASP coverage or regulatory compliance.

## Public live demo (Netlify)

The homepage `#demo` section runs 5 live attacks against a fictional bot (Aria, AcmeCorp), then offers an
**Executive Security Summary PDF** in exchange for an email. Leads go to the Airtable `Leads` table with `Source = demo-pdf`.

| Function | Purpose | Default limits (env var) |
|----------|---------|--------------------------|
| `demo-probe` | Runs one attack + judge | 25 / IP / 10 min (`LIVE_DEMO_RATE_PER_IP`), 500 / day (`LIVE_DEMO_DAILY_CAP`) |
| `demo-report` | Saves lead, returns PDF | 5 / IP / hour (`DEMO_REPORT_RATE_PER_IP`), 300 / day |
| `demobot`, `judge` | Legacy, unused by the site | 30 / IP / 10 min, 500 / day |
| `waitlist` | Website form → Airtable | 5 / IP / hour |

Setting any limit to `0` switches that function off. Probes and the demo bot prompt live in `netlify/lib/demo.js`.
Also set a monthly spend limit in the Anthropic Console as a backstop.

Local: `npx netlify dev` (port 8888) alongside `npm run dev`; Vite proxies `/.netlify/functions` to it.
Tests: `npm run test:functions`.
