"""Persist audit reports as JSON files (v1 — replace with DB later)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

AUDIT_DIR = Path(__file__).resolve().parent / "data" / "audits"
AUDIT_DIR.mkdir(parents=True, exist_ok=True)


def save_audit(report: dict[str, Any]) -> str:
    audit_id = report.get("audit_id") or str(uuid.uuid4())
    report["audit_id"] = audit_id
    report.setdefault("saved_at", datetime.now(timezone.utc).isoformat())
    path = AUDIT_DIR / f"{audit_id}.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return audit_id


def load_audit(audit_id: str) -> dict[str, Any] | None:
    path = AUDIT_DIR / f"{audit_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_audits(limit: int = 20) -> list[dict[str, Any]]:
    files = sorted(AUDIT_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    out = []
    for path in files[:limit]:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            out.append(
                {
                    "audit_id": data.get("audit_id"),
                    "customer_name": data.get("customer_name"),
                    "status": data.get("status"),
                    "security_score": data.get("summary", {}).get("score"),
                    "probe_count": data.get("probe_count"),
                    "created_at": data.get("created_at"),
                }
            )
        except json.JSONDecodeError:
            continue
    return out
