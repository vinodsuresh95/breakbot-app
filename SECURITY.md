# Security notes — Local Client Audit Edition

## Operating model

BreakBot is run **locally by you** for the first clients:

1. Client provides authorized **staging** endpoint
2. You run audits on your Mac (`127.0.0.1` only)
3. You manually review every FAIL / PARTIAL
4. You export a professional HTML report
5. You delete credentials and evidence after delivery

Do **not** expose the backend on your LAN or via a public tunnel for client work.

## Protect secrets & reports

Ensure `.gitignore` includes:

- `backend/.env`
- `backend/.venv/`
- `backend/data/audits/`
- `node_modules/`
- `dist/`

Never commit API keys or client audit JSON.

## GitHub history warning

If the repository was ever public with prospect PII in git history:

1. Make the repo **private**, or
2. Rewrite history (BFG / `git filter-repo`)

Do not share the repo URL with clients until cleaned.

## Client procedure checklist

- [ ] Written authorization
- [ ] Staging only (not production) for first run
- [ ] Agreed window + probe categories
- [ ] Connectivity check (3 probes)
- [ ] Security run (8 → 25–50)
- [ ] Manual review of every FAIL/PARTIAL
- [ ] Report status: Draft → Reviewed → Final
- [ ] Export HTML, deliver to client
- [ ] Strip evidence / delete audit + credentials
