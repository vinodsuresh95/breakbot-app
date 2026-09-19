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
