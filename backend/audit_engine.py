"""BreakBot Security Engine v1 — orchestrate probes against an authorized target."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from audit_store import save_audit
from evaluator import compute_security_score, evaluate_probe
from probe_plan import build_probe_plan
from target_client import TargetClient


def run_audit(
    *,
    target_config: dict[str, Any],
    customer_name: str = "",
    industry_pack: str | None = None,
    category_ids: list[str] | None = None,
    probe_ids: list[str] | None = None,
    max_probes: int = 15,
) -> dict[str, Any]:
    audit_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    client = TargetClient(target_config)

    ping = client.ping()
    if not ping.get("ok"):
        report = {
            "audit_id": audit_id,
            "status": "failed",
            "customer_name": customer_name,
            "created_at": created_at,
            "error": ping.get("error") or "Target unreachable",
            "target": _safe_target_summary(target_config),
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
            evaluation = evaluate_probe(probe, bot_response)
            findings.append(
                {
                    **evaluation,
                    "probe_prompt": prompt_text,
                    "bot_response": bot_response[:4000],
                    "owasp_ref": probe.get("owasp_ref"),
                    "tags": probe.get("tags") or [],
                }
            )
        except Exception as e:
            errors.append({"probe_id": probe.get("id", ""), "error": str(e)})

    summary = compute_security_score(findings)
    critical_fails = [f for f in findings if f.get("verdict") == "FAIL" and f.get("severity") == "Critical"]

    report = {
        "audit_id": audit_id,
        "status": "completed",
        "customer_name": customer_name,
        "created_at": created_at,
        "target": _safe_target_summary(target_config),
        "industry_pack": industry_pack,
        "probe_count": len(probes),
        "probes_executed": len(findings),
        "errors": errors,
        "summary": summary,
        "critical_findings": critical_fails[:10],
        "findings": findings,
        "remediation": _remediation_hints(findings),
    }
    save_audit(report)
    return report


def _safe_target_summary(config: dict[str, Any]) -> dict[str, Any]:
    return {
        "mode": config.get("mode"),
        "url": config.get("url") if config.get("mode") == "http_json" else None,
        "message_field": config.get("message_field"),
        "response_field": config.get("response_field"),
    }


def _remediation_hints(findings: list[dict[str, Any]]) -> list[dict[str, str]]:
    hints: list[dict[str, str]] = []
    seen: set[str] = set()
    for f in findings:
        if f.get("verdict") not in ("FAIL", "PARTIAL"):
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
