"""Dashboard API key authentication."""

from __future__ import annotations

import os
import hmac

from fastapi import Header, HTTPException


def require_dashboard_key(x_dashboard_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("DASHBOARD_API_KEY", "").strip()
    if not expected:
        if os.getenv("APP_ENV", "development").strip().lower() in {
            "production",
            "prod",
            "staging",
        }:
            raise HTTPException(
                status_code=503,
                detail="Dashboard authentication is not configured",
            )
        return
    if not x_dashboard_key or not hmac.compare_digest(x_dashboard_key, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing dashboard API key")
