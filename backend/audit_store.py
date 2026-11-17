"""Persist local audit reports (file-based — no cloud DB)."""

from __future__ import annotations

import json
import os
import tempfile
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

AUDIT_DIR = Path(__file__).resolve().parent / "data" / "audits"
AUDIT_DIR.mkdir(parents=True, exist_ok=True)


def save_audit(report: dict[str, Any]) -> str:
    audit_id = str(uuid.UUID(report["audit_id"])) if report.get("audit_id") else str(uuid.uuid4())
    report["audit_id"] = audit_id
    report.setdefault("saved_at", datetime.now(timezone.utc).isoformat())
    path = AUDIT_DIR / f"{audit_id}.json"
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=AUDIT_DIR, delete=False) as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        temporary = handle.name
    os.replace(temporary, path)
    return audit_id


def load_audit(audit_id: str) -> dict[str, Any] | None:
    try:
        safe_id = str(uuid.UUID(audit_id))
    except (ValueError, AttributeError, TypeError):
        return None
    path = AUDIT_DIR / f"{safe_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_audits(limit: int = 20) -> list[dict[str, Any]]:
    files = sorted(AUDIT_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    out = []
    for path in files[:limit]:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            cost = data.get("cost") or {}
            out.append(
                {
                    "audit_id": data.get("audit_id"),
                    "customer_name": data.get("customer_name"),
                    "status": data.get("status"),
                    "report_status": data.get("report_status", "Draft"),
                    "security_score": data.get("reviewed_summary", data.get("summary", {})).get("score"),
                    "probe_count": data.get("probe_count"),
                    "created_at": data.get("created_at"),
                    "estimated_usd": cost.get("estimated_usd"),
                    "duration_seconds": cost.get("duration_seconds"),
                    "retention_days": data.get("retention_days", 30),
                    "retention_due": retention_due(data),
                }
            )
        except json.JSONDecodeError:
            continue
    return out


def delete_audit(audit_id: str) -> bool:
    try:
        audit_id = str(uuid.UUID(audit_id))
    except (ValueError, TypeError, AttributeError):
        return False
    path = AUDIT_DIR / f"{audit_id}.json"
    if not path.exists():
        return False
    path.unlink()
    return True


def retention_due(report: dict[str, Any]) -> bool:
    try:
        created = datetime.fromisoformat(report["created_at"])
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) >= created + timedelta(days=int(report.get("retention_days", 30)))
    except (KeyError, ValueError, TypeError):
        return False


def update_retention(audit_id: str, days: int) -> dict[str, Any]:
    if not 1 <= days <= 365:
        raise ValueError("Retention must be between 1 and 365 days")
    report = load_audit(audit_id)
    if report is None:
        raise FileNotFoundError("Audit not found")
    report["retention_days"] = days
    save_audit(report)
    return report
