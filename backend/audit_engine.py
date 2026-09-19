"""BreakBot Security Engine — local client-audit edition."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from audit_store import load_audit, save_audit
from evaluator import compute_security_score, evaluate_probe
from probe_plan import build_probe_plan
from probe_registry import library_stats
from redaction import redact_text
from target_client import TargetClient
from usage_tracker import empty_usage


def effective_verdict(finding: dict[str, Any]) -> str:
    if finding.get("review_status") == "false_positive":
        return "PASS"
    if finding.get("review_status") == "excluded":
        return "EXCLUDED"
    if finding.get("reviewer_verdict") in ("FAIL", "PASS", "PARTIAL"):
        return finding["reviewer_verdict"]
    return finding.get("verdict") or "PARTIAL"


def compute_reviewed_summary(findings: list[dict[str, Any]]) -> dict[str, Any]:
    mapped = []
    for f in findings:
        if f.get("review_status") == "excluded":
            continue
        mapped.append({**f, "verdict": effective_verdict(f)})
    return compute_security_score(mapped)


def review_finding(
    audit_id: str,
    probe_id: str,
    *,
    review_status: str,
    reviewer_verdict: str | None = None,
    reviewer_notes: str = "",
) -> dict[str, Any]:
    report = load_audit(audit_id)
    if not report:
        raise FileNotFoundError("Audit not found")

    allowed_status = {"pending", "confirmed", "false_positive", "excluded"}
    if review_status not in allowed_status:
        raise ValueError(f"Invalid review_status: {review_status}")

    now = datetime.now(timezone.utc).isoformat()
    found = False
    for f in report.get("findings") or []:
        if f.get("probe_id") != probe_id:
            continue
        found = True
        f["review_status"] = review_status
        f["reviewer_verdict"] = reviewer_verdict
        f["reviewer_notes"] = reviewer_notes
        f["reviewed_at"] = now

    if not found:
        raise ValueError(f"Finding not found: {probe_id}")

    report["reviewed_summary"] = compute_reviewed_summary(report.get("findings") or [])
    report["critical_findings"] = [
        f
        for f in (report.get("findings") or [])
        if effective_verdict(f) == "FAIL" and f.get("severity") == "Critical"
    ][:10]
    report["remediation"] = _remediation_hints(report.get("findings") or [])

    fp = sum(1 for f in report.get("findings") or [] if f.get("review_status") == "false_positive")
    verified = sum(
        1
        for f in report.get("findings") or []
        if f.get("review_status") == "confirmed" and effective_verdict(f) == "FAIL"
    )
    cost = report.setdefault("cost", {})
    cost["false_positive_count"] = fp
    cost["verified_vuln_count"] = verified

    if report.get("report_status") == "Draft":
        report["report_status"] = "Reviewed"

    save_audit(report)
    return report


def set_report_status(audit_id: str, status: str) -> dict[str, Any]:
    if status not in ("Draft", "Reviewed", "Final"):
        raise ValueError("report_status must be Draft, Reviewed, or Final")
    report = load_audit(audit_id)
    if not report:
        raise FileNotFoundError("Audit not found")
    report["report_status"] = status
    report["report_status_updated_at"] = datetime.now(timezone.utc).isoformat()
    save_audit(report)
    return report


def strip_evidence(audit_id: str) -> dict[str, Any]:
    report = load_audit(audit_id)
    if not report:
        raise FileNotFoundError("Audit not found")
    for f in report.get("findings") or []:
        f["bot_response"] = "[evidence deleted]"
        prompt = f.get("probe_prompt") or ""
        f["probe_prompt"] = (prompt[:80] + "…") if len(prompt) > 80 else prompt
    for f in report.get("critical_findings") or []:
        f["bot_response"] = "[evidence deleted]"
    report["evidence_stripped"] = True
    report["evidence_stripped_at"] = datetime.now(timezone.utc).isoformat()
    save_audit(report)
    return report


def run_audit(
    *,
    target_config: dict[str, Any],
    customer_name: str = "",
    industry_pack: str | None = None,
    category_ids: list[str] | None = None,
    probe_ids: list[str] | None = None,
    max_probes: int = 15,
    scope: dict[str, Any] | None = None,
) -> dict[str, Any]:
    audit_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    usage = empty_usage()
    started = time.perf_counter()
    try:
        client = TargetClient(target_config, usage_bucket=usage)
    except (TypeError, ValueError) as exc:
        report = {
            "audit_id": audit_id,
            "status": "failed",
            "report_status": "Draft",
            "customer_name": customer_name,
            "created_at": created_at,
            "error": redact_text(str(exc)),
            "target": _safe_target_summary(target_config),
            "scope": scope or {},
            "cost": {
                **usage,
                "duration_seconds": round(time.perf_counter() - started, 1),
                "probe_count": 0,
            },
        }
        save_audit(report)
        return report

    ping = client.ping()
    if not ping.get("ok"):
        report = {
            "audit_id": audit_id,
            "status": "failed",
            "report_status": "Draft",
            "customer_name": customer_name,
            "created_at": created_at,
            "error": ping.get("error") or "Target unreachable",
            "target": _safe_target_summary(target_config),
            "scope": scope or {},
            "cost": {
                **usage,
                "duration_seconds": round(time.perf_counter() - started, 1),
                "probe_count": 0,
            },
        }
        save_audit(report)
        return report

    probes = build_probe_plan(
        industry_pack=industry_pack,
        category_ids=category_ids,
        probe_ids=probe_ids,
        max_probes=max(1, min(max_probes, 50)),
    )

    findings: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []

    for probe in probes:
        prompt_text = probe.get("prompt") or ""
        try:
            bot_response = client.send_message(prompt_text)
            evaluation = evaluate_probe(probe, bot_response, usage_bucket=usage)
            findings.append(
                {
                    **evaluation,
                    "probe_prompt": prompt_text,
                    "bot_response": redact_text(bot_response[:4000]),
                    "owasp_ref": probe.get("owasp_ref"),
                    "tags": probe.get("tags") or [],
                }
            )
        except Exception as e:
            errors.append({"probe_id": probe.get("id", ""), "error": redact_text(str(e))})

    duration = round(time.perf_counter() - started, 1)
    summary = compute_security_score(findings)
    reviewed_summary = compute_reviewed_summary(findings)
    critical_fails = [
        f
        for f in findings
        if effective_verdict(f) == "FAIL" and f.get("severity") == "Critical"
    ]

    report = {
        "audit_id": audit_id,
        "status": "completed",
        "report_status": "Draft",
        "customer_name": customer_name,
        "created_at": created_at,
        "target": _safe_target_summary(target_config),
        "scope": scope or {},
        "industry_pack": industry_pack,
        "probe_library_version": library_stats().get("version"),
        "probe_plan": [p.get("id") for p in probes],
        "probe_count": len(probes),
        "probes_executed": len(findings),
        "errors": errors,
        "summary": summary,
        "reviewed_summary": reviewed_summary,
        "critical_findings": critical_fails[:10],
        "findings": findings,
        "remediation": _remediation_hints(findings),
        "cost": {
            **usage,
            "duration_seconds": duration,
            "probe_count": len(findings),
            "false_positive_count": 0,
            "verified_vuln_count": reviewed_summary.get("fail_count", 0),
        },
        "retention_days": 30,
    }
    save_audit(report)
    return report


def _safe_target_summary(config: dict[str, Any]) -> dict[str, Any]:
    raw_url = config.get("url") if config.get("mode") == "http_json" else None
    safe_url = None
    if raw_url:
        parsed = urlsplit(raw_url)
        hostname = parsed.hostname or ""
        netloc = hostname
        if parsed.port:
            netloc = f"{hostname}:{parsed.port}"
        safe_url = urlunsplit((parsed.scheme, netloc, parsed.path, "", ""))
    return {
        "mode": config.get("mode"),
        "url": safe_url,
        "message_field": config.get("message_field"),
        "response_field": config.get("response_field"),
    }


def _remediation_hints(findings: list[dict[str, Any]]) -> list[dict[str, str]]:
    hints: list[dict[str, str]] = []
    seen: set[str] = set()
    for f in findings:
        if effective_verdict(f) not in ("FAIL", "PARTIAL"):
            continue
        if f.get("review_status") == "false_positive":
            continue
        issue = f.get("key_issue") or f.get("category_id") or "general"
        if issue in seen:
            continue
        seen.add(issue)
        hints.append(
            {
                "issue": issue,
                "recommendation": _hint_for(f),
                "probe_id": f.get("probe_id") or "",
            }
        )
    return hints[:12]


def _hint_for(finding: dict[str, Any]) -> str:
    cat = (finding.get("category_id") or "").upper()
    if cat.startswith("LLM01"):
        return "Harden instruction hierarchy; never echo system prompts; use input sanitization and tool-guardrails."
    if cat.startswith("LLM02"):
        return "Add jailbreak regression tests; layer policy filters on outputs; block DAN-style mode switches."
    if "system_prompt" in str(finding.get("key_issue") or ""):
        return "Strip meta-instructions from model outputs; refuse verbatim instruction dumps."
    if finding.get("verdict") == "FAIL":
        return "Add explicit refusal templates and post-generation safety checks for this attack class."
    return "Review conversation logs and add a targeted guardrail for this probe category."
