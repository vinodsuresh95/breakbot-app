"""BreakBot Security Engine — local client-audit edition."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from audit_store import load_audit, save_audit
from context_probes import CATEGORY_ID as CONTEXT_CATEGORY_ID, build_context_probes
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
        if f.get("review_status") not in ("confirmed", "false_positive"):
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

    if reviewer_verdict not in (None, "PASS", "FAIL", "PARTIAL"):
        raise ValueError("Invalid reviewer verdict")
    if review_status == "confirmed" and reviewer_verdict is None:
        raise ValueError("Choose a reviewer verdict")
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

    report["report_status"] = "Draft"

    save_audit(report)
    return report


def set_report_status(audit_id: str, status: str) -> dict[str, Any]:
    if status not in ("Draft", "Reviewed", "Final"):
        raise ValueError("report_status must be Draft, Reviewed, or Final")
    report = load_audit(audit_id)
    if not report:
        raise FileNotFoundError("Audit not found")
    if status != "Draft":
        findings = report.get("findings") or []
        if report.get("status") != "completed" or not findings or report.get("errors"):
            raise ValueError("Only a complete audit without execution errors can be finalized")
        if any(f.get("review_status", "pending") == "pending" for f in findings):
            raise ValueError("Review or explicitly exclude every finding first")
    report["report_status"] = status
    report["report_status_updated_at"] = datetime.now(timezone.utc).isoformat()
    save_audit(report)
    return report


def strip_evidence(audit_id: str) -> dict[str, Any]:
    report = load_audit(audit_id)
    if not report:
        raise FileNotFoundError("Audit not found")
    for collection in ("findings", "critical_findings"):
        for f in report.get(collection) or []:
            for field in ("bot_response", "probe_prompt", "reason", "reviewer_notes", "key_issue"):
                f[field] = "[evidence deleted]"
    report["errors"] = []
    report["scope"] = {}
    report["target_context"] = {}
    report["remediation"] = []
    report["report_status"] = "Draft"
    report["customer_name"] = "[client details deleted]"
    report["target"] = {"mode": (report.get("target") or {}).get("mode")}
    report["evidence_stripped"] = True
    report["evidence_stripped_at"] = datetime.now(timezone.utc).isoformat()
    save_audit(report)
    return report


def plan_probes(
    *,
    industry_pack: str | None = None,
    category_ids: list[str] | None = None,
    probe_ids: list[str] | None = None,
    max_probes: int = 15,
    target_context: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Context probes first, then up to max_probes library probes (50 in total)."""
    context = build_context_probes(target_context)
    library_ids = None
    if probe_ids:
        prefix = f"{CONTEXT_CATEGORY_ID}-"
        wanted = [pid for pid in probe_ids if pid.startswith(prefix)]
        context = [p for p in context if p["id"] in wanted]
        if len(context) != len(set(wanted)):
            raise ValueError("Context probes need the same target context as the original audit")
        library_ids = [pid for pid in probe_ids if not pid.startswith(prefix)]

    library: list[dict[str, Any]] = []
    room = 50 - len(context)
    if room > 0 and (library_ids or not probe_ids):
        library = build_probe_plan(
            industry_pack=industry_pack,
            category_ids=category_ids,
            probe_ids=library_ids,
            max_probes=max(1, min(max_probes, room)),
        )
    return context + library


def run_audit(
    *,
    target_config: dict[str, Any],
    customer_name: str = "",
    industry_pack: str | None = None,
    category_ids: list[str] | None = None,
    probe_ids: list[str] | None = None,
    max_probes: int = 15,
    retest_of: str | None = None,
    scope: dict[str, Any] | None = None,
    target_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    probes = plan_probes(
        industry_pack=industry_pack,
        category_ids=category_ids,
        probe_ids=probe_ids,
        max_probes=max_probes,
        target_context=target_context,
    )

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
        "status": "completed" if findings and not errors else "partial" if findings else "failed",
        "report_status": "Draft",
        "customer_name": customer_name,
        "created_at": created_at,
        "target": _safe_target_summary(target_config),
        "scope": scope or {},
        "industry_pack": industry_pack,
        "target_context": target_context or {},
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
            "verified_vuln_count": 0,
        },
        "retention_days": 30,
    }
    if retest_of:
        baseline = load_audit(retest_of)
        if baseline:
            before = baseline.get("reviewed_summary") or baseline.get("summary") or {}
            after = report.get("summary") or {}
            before_fails = int(before.get("fail_count") or 0)
            after_fails = int(after.get("fail_count") or 0)
            report["retest"] = {
                "baseline_audit_id": retest_of,
                "before_score": before.get("score"),
                "after_score": after.get("score"),
                "before_fail_count": before_fails,
                "after_fail_count": after_fails,
                "failures_resolved": max(0, before_fails - after_fails),
                "status": "fixed" if after_fails == 0 else "improved" if after_fails < before_fails else "unchanged",
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
    if cat == CONTEXT_CATEGORY_ID:
        tags = set(finding.get("tags") or [])
        if "idor" in tags:
            return "Enforce object ownership in the tool or API layer using the session identity, never the model's judgment."
        if "excessive_agency" in tags:
            return "Enforce action limits server-side in the tool; require human approval above the limit regardless of claimed roles."
        return "Filter retrieval by the user's access level and treat retrieved text as untrusted data, never as instructions."
    if "system_prompt" in str(finding.get("key_issue") or ""):
        return "Strip meta-instructions from model outputs; refuse verbatim instruction dumps."
    if finding.get("verdict") == "FAIL":
        return "Add explicit refusal templates and post-generation safety checks for this attack class."
    return "Review conversation logs and add a targeted guardrail for this probe category."
