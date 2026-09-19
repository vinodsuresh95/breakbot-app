"""Dashboard API key authentication."""

from __future__ import annotations

import os

from fastapi import Header, HTTPException


def require_dashboard_key(x_dashboard_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("DASHBOARD_API_KEY", "").strip()
    if not expected:
        # Dev-only: warn via health endpoint; do not block local work without a key configured.
        return
    if not x_dashboard_key or x_dashboard_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing dashboard API key")
