# BreakBot — React frontend + Python backend

## Architecture

| Layer | Stack | Purpose |
|-------|-------|---------|
| Frontend | React + Vite | Marketing site + Marketing OS dashboard |
| Backend | FastAPI + Claude + scikit-learn | 7 AI agents, ML lead scoring, email send, waitlist |

**Public routes:** `/` (marketing only — no demo)  
**Private dashboard:** `/bb-command-2026`

## Run locally

### 1. Python backend (required for dashboard agents)

```bash
cd backend
python3.13 -m venv .venv          # use 3.11–3.13 (not 3.14 yet)
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # add ANTHROPIC_API_KEY + SMTP if sending email
python main.py                    # http://127.0.0.1:8000
```

### 2. React frontend

```bash
npm install
npm run dev                       # http://localhost:5173 — proxies /api → backend
```

## Dashboard features

- **Company search** (top bar): type a company → Research, Score, Draft email, Send email, Full pipeline
- **Manual send**: prospect detail → "Send Email Now" (or ask any agent: "send email to Wylth")
- **Daily automation**: `POST /api/automation/daily` — auto-drafts and sends for Tier A/B prospects

## Environment variables (backend/.env)

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Powers all 7 agents |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` | For real email | Gmail app password works |
| `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID` | Optional | Waitlist leads |

## Production deploy

- **Frontend:** Netlify (`npm run build` → `dist/`)
- **Backend:** Railway / Render / Fly.io — set `VITE_API_URL=https://your-api.railway.app/api` at build time
- Demo page removed intentionally — audits are waitlist-only
