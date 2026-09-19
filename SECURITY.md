# Security notes

## If real prospect PII was ever committed

The initial public commit may have contained real names/emails in `src/data/prospects.js`. Those records are removed in later commits, but **Git history still contains them**.

Options:

1. Make the GitHub repository **private**
2. Rewrite history with [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) or `git filter-repo`
3. Rotate any outreach that may have been exposed

## Production checklist

- [ ] Set `DASHBOARD_API_KEY` to a long random string (32+ chars)
- [ ] Never expose `backend/data/prompt_library.json` as a static file
- [ ] Keep `ANTHROPIC_API_KEY` and SMTP credentials only in server env
- [ ] Require human approval before any outbound email
- [ ] Store real prospects in a database — not in frontend source
