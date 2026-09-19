"""Waitlist → Airtable."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx


async def save_waitlist(data: dict) -> dict:
    token = os.getenv("AIRTABLE_TOKEN")
    base_id = os.getenv("AIRTABLE_BASE_ID")

    if not token or not base_id:
        return {"saved": False, "airtable": False, "logged": True}

    payload = {
        "records": [
            {
                "fields": {
                    "Name": data.get("name") or "",
                    "Email": data.get("email") or "",
                    "Phone": data.get("phone") or "",
                    "Chatbot": data.get("chatbot") or "",
                    "Industry": data.get("industry") or "",
                    "Message": data.get("message") or "",
                    "Source": data.get("source") or "website",
                    "Submitted At": datetime.now(timezone.utc).isoformat(),
                }
            }
        ]
    }

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"https://api.airtable.com/v0/{base_id}/Leads",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
        )
        if not res.is_success:
            return {"saved": False, "airtable": False, "error": res.text}
        return {"saved": True, "airtable": True}
