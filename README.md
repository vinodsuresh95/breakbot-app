# BreakBot — AI agent red-teaming platform (MVP)

## Architecture

| Layer | Stack | Purpose |
|-------|-------|---------|
| Frontend | React + Vite | Marketing site + Marketing OS dashboard |
| Backend | FastAPI + Claude | 7 AI agents, lead scoring, email send, waitlist |
| Probe library | `backend/data/prompt_library.json` | 680 probes — **server-side only** |

**Public:** `/` (marketing + waitlist)  
**Dashboard:** `/bb-command-2026` — requires `DASHBOARD_API_KEY`

## Run locally

### 1. Python backend

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set ANTHROPIC_API_KEY + DASHBOARD_API_KEY
python main.py         # http://127.0.0.1:8001
```

### 2. React frontend

```bash
npm install
npm run dev            # http://localhost:3000 — proxies /api → backend
```

Open `/bb-command-2026` and enter the same `DASHBOARD_API_KEY` from `.env`.

## Security

| Asset | Protection |
|-------|------------|
| Agent runs, email send, outreach | `X-Dashboard-Key` header required when `DASHBOARD_API_KEY` is set |
| Probe library | Served only via `GET /api/probes/library` (authenticated) |
| Waitlist | Public `POST /api/waitlist` only |
| Prospect data | Demo records in repo — use dashboard/localStorage or a DB for real leads |

**Production:** always set a long random `DASHBOARD_API_KEY`. Never commit `backend/.env`.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Powers all 7 agents |
| `DASHBOARD_API_KEY` | Yes (prod) | Protects dashboard API |
| `SMTP_*` | For email send | Gmail app password works |
| `AIRTABLE_*` | Optional | Waitlist → Airtable |

## Security Engine v1

Authenticated dashboard → **Security Audit** tab, or API:

```bash
curl -X POST http://127.0.0.1:8001/api/audit/run \
  -H "Content-Type: application/json" \
  -H "X-Dashboard-Key: YOUR_KEY" \
  -d '{
    "authorization_confirmed": true,
    "customer_name": "Pilot",
    "industry_pack": "FIN",
    "max_probes": 8,
    "target": { "mode": "demobot" }
  }'
```

Flow: probe selection → target HTTP/demobot → rules + LLM judge → score + JSON report in `backend/data/audits/`.

## Next milestone

Async jobs, multi-turn sessions, PDF export, CI webhook (`POST /api/audit/run` from GitHub Actions).
