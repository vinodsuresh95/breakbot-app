"""Client-safe HTML report export for local audits."""

from __future__ import annotations

import html
from datetime import datetime, timezone
from typing import Any

from audit_engine import effective_verdict


def build_html_report(report: dict[str, Any], *, client_safe: bool = True) -> str:
    """Generate a printable HTML report.

    client_safe=True → only confirmed findings (or clear DRAFT banner if unreviewed).
    """
    customer = html.escape(report.get("customer_name") or "Client")
    audit_id = html.escape(report.get("audit_id") or "")
    status = html.escape(report.get("report_status") or "Draft")
    created = html.escape(report.get("created_at") or "")
    scope = report.get("scope") or {}
    summary = report.get("reviewed_summary") or report.get("summary") or {}
    cost = report.get("cost") or {}
    findings = report.get("findings") or []

    any_reviewed = any(f.get("review_status") not in (None, "pending") for f in findings)
    draft_warning = (report.get("report_status") or "Draft") == "Draft" or not any_reviewed

    if client_safe and any_reviewed:
        deliverable = [f for f in findings if f.get("review_status") == "confirmed"]
    else:
        deliverable = findings

    verified_fails = [f for f in deliverable if effective_verdict(f) == "FAIL"]
    remediation = report.get("remediation") or []

    rows = []
    for f in deliverable:
        verdict = effective_verdict(f)
        evidence = ""
        if not report.get("evidence_stripped"):
            evidence = f"""
            <div class="evidence"><strong>Probe:</strong> {_esc(f.get('probe_prompt'))}</div>
            <div class="evidence"><strong>Response:</strong> {_esc((f.get('bot_response') or '')[:1500])}</div>
            """
        rows.append(
            f"""
            <div class="finding {verdict.lower()}">
              <div class="finding-head">
                <span class="badge">{_esc(verdict)}</span>
                <span>{_esc(f.get('probe_id'))} · {_esc(f.get('severity'))}</span>
                <span class="mut">{_esc(f.get('category_name'))}</span>
              </div>
              <p>{_esc(f.get('reviewer_notes') or f.get('reason'))}</p>
              <p class="mut">OWASP / ref: {_esc(str(f.get('owasp_ref') or '—'))}</p>
              {evidence}
              <p class="mut">Review: {_esc(f.get('review_status') or 'pending')}
                {(' · AI was: ' + _esc(f.get('verdict'))) if f.get('reviewer_verdict') else ''}
              </p>
            </div>
            """
        )

    fp_count = cost.get("false_positive_count") or sum(
        1 for f in findings if f.get("review_status") == "false_positive"
    )

    rem_html = "".join(
        f"<li><strong>{_esc(r.get('issue'))}</strong> — {_esc(r.get('recommendation'))}</li>"
        for r in remediation
    )

    if draft_warning:
        warning_banner = (
            '<div class="warn">DRAFT — AI-generated findings only. '
            "Do not send to the client until manually reviewed and marked Final.</div>"
        )
    elif (report.get("report_status") or "") == "Reviewed":
        warning_banner = (
            '<div class="info">REVIEWED — findings have reviewer overrides. '
            "Mark as Final before client delivery.</div>"
        )
    else:
        warning_banner = '<div class="info">FINAL — approved for client delivery.</div>'

    auth_note = _esc(scope.get("authorization_notes") or "Written authorization on file (operator confirmation).")
    window = _esc(scope.get("testing_window") or "As agreed with client")
    limitations = _esc(
        scope.get("limitations")
        or "Single-turn probes; LLM-as-judge may err; staging environment may differ from production."
    )

    empty_msg = (
        "<p class='mut'>No confirmed findings yet — complete manual review and mark findings as Confirmed.</p>"
        if client_safe and any_reviewed and not rows
        else "<p class='mut'>No findings.</p>"
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>BreakBot Audit — {customer}</title>
<style>
  body {{ font-family: Georgia, serif; color: #1a1a1a; max-width: 820px; margin: 40px auto; padding: 0 24px; line-height: 1.55; }}
  h1 {{ font-size: 28px; margin-bottom: 4px; }}
  h2 {{ font-size: 18px; margin-top: 32px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }}
  .mut {{ color: #666; font-size: 13px; }}
  .meta {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 16px 0 24px; font-size: 14px; }}
  .score {{ font-size: 42px; font-weight: bold; }}
  .warn {{ background: #fff3cd; border: 1px solid #ffc107; padding: 12px 14px; margin: 16px 0; }}
  .info {{ background: #e7f3ff; border: 1px solid #90caf9; padding: 12px 14px; margin: 16px 0; }}
  .finding {{ border: 1px solid #ddd; border-radius: 6px; padding: 14px; margin: 12px 0; }}
  .finding.fail {{ border-left: 4px solid #c62828; }}
  .finding.pass {{ border-left: 4px solid #2e7d32; }}
  .finding.partial {{ border-left: 4px solid #ef6c00; }}
  .badge {{ font-weight: bold; margin-right: 8px; }}
  .finding-head {{ display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; margin-bottom: 8px; font-size: 13px; }}
  .evidence {{ background: #f7f7f7; padding: 8px 10px; margin: 8px 0; font-family: ui-monospace, monospace; font-size: 12px; white-space: pre-wrap; }}
  footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }}
  @media print {{ .warn, .info {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }} }}
</style>
</head>
<body>
  {warning_banner}
  <p class="mut">BreakBot · Local Client Audit · Report status: <strong>{status}</strong></p>
  <h1>Chatbot / AI Agent Security Audit</h1>
  <p class="mut">Prepared for {customer} · Audit ID {audit_id}</p>

  <div class="meta">
    <div><strong>Date</strong><br/>{created}</div>
    <div><strong>Security score</strong><br/><span class="score">{summary.get('score', '—')}</span> / 100 · Grade {html.escape(str(summary.get('grade', '—')))}</div>
    <div><strong>Probes executed</strong><br/>{report.get('probes_executed', 0)}</div>
    <div><strong>Verified failures</strong><br/>{len(verified_fails) if any_reviewed else summary.get('fail_count', 0)} (false positives marked: {fp_count})</div>
  </div>

  <h2>1. Executive summary</h2>
  <p>
    BreakBot executed {_esc(str(report.get('probes_executed', 0)))} adversarial probes against the authorized target
    ({_esc((report.get('target') or {}).get('mode'))}
    {(' · ' + _esc((report.get('target') or {}).get('url'))) if (report.get('target') or {}).get('url') else ''}).
    Industry pack: {_esc(report.get('industry_pack') or 'core only')}.
  </p>

  <h2>2. Scope &amp; authorization</h2>
  <p><strong>Authorization:</strong> {auth_note}</p>
  <p><strong>Testing window:</strong> {window}</p>
  <p><strong>Limitations:</strong> {limitations}</p>

  <h2>3. Findings</h2>
  {"".join(rows) if rows else empty_msg}

  <h2>4. Recommended remediation</h2>
  <ul>{rem_html or "<li class='mut'>No remediation items.</li>"}</ul>

  <h2>5. Cost &amp; effort (internal)</h2>
  <p class="mut">
    Duration: {cost.get('duration_seconds', '—')}s ·
    Claude calls: {cost.get('calls', '—')} ·
    Tokens in/out: {cost.get('input_tokens', 0)} / {cost.get('output_tokens', 0)} ·
    Est. API cost: ${cost.get('estimated_usd', 0)}
  </p>

  <footer>
    Generated {html.escape(datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'))} by BreakBot (local operator edition).
    This report must not be redistributed without the client's consent.
    AI judge output is advisory — human review is required for Final status.
  </footer>
</body>
</html>
"""


def _esc(value: Any) -> str:
    return html.escape(str(value if value is not None else ""))
