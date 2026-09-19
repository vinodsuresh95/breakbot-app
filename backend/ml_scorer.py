"""Deterministic lead scoring — blends LLM qualification with weighted heuristics."""

from __future__ import annotations

import re
from typing import Any


def _tier_from_score(score: float) -> str:
    if score >= 80:
        return "A"
    if score >= 60:
        return "B"
    if score >= 40:
        return "C"
    return "D"


def _heuristic_score(prospect: dict[str, Any]) -> float:
    """Weighted 0–100 score from observable prospect fields."""
    chatbot = (prospect.get("chatbot") or "").lower()
    has_chatbot = 100.0 if chatbot and chatbot not in ("unknown", "—", "-") else 15.0

    email = prospect.get("email") or ""
    has_email = 100.0 if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email) else 0.0

    title = (prospect.get("title") or "").lower()
    if any(k in title for k in ("cto", "ceo", "chief", "head of ai", "vp")):
        authority = 100.0
    elif any(k in title for k in ("director", "lead", "manager")):
        authority = 70.0
    else:
        authority = 30.0

    industry = (prospect.get("industry") or "").lower()
    ai_maturity = 85.0 if any(k in industry for k in ("ai", "saas", "fintech", "platform")) else 55.0

    country = prospect.get("country") or ""
    region_fit = 100.0 if any(x in country for x in ("USA", "UK", "Germany", "India", "Singapore")) else 70.0

    stage = prospect.get("stage") or "researched"
    reachability = {
        "replied": 100.0,
        "opened": 90.0,
        "meeting": 100.0,
        "audit": 100.0,
        "customer": 100.0,
        "sent": 60.0,
        "drafted": 50.0,
        "researched": 40.0,
    }.get(stage, 30.0)

    weights = {
        "has_chatbot": 0.15,
        "has_email": 0.15,
        "authority": 0.15,
        "ai_maturity": 0.10,
        "region_fit": 0.05,
        "reachability": 0.05,
    }
    parts = {
        "has_chatbot": has_chatbot,
        "has_email": has_email,
        "authority": authority,
        "ai_maturity": ai_maturity,
        "region_fit": region_fit,
        "reachability": reachability,
    }
    return round(sum(parts[k] * weights[k] for k in weights))


def blend_lead_score(prospect: dict[str, Any], llm_result: dict[str, Any] | None = None) -> dict[str, Any]:
    """Combine Claude qualification (40%) with deterministic heuristics (60%)."""
    llm = llm_result or {}
    llm_score = float(llm.get("total_score") or prospect.get("score") or 50)
    heuristic = _heuristic_score(prospect)
    blended = round(0.4 * llm_score + 0.6 * heuristic)

    tier = llm.get("tier") or _tier_from_score(blended)
    return {
        "total_score": blended,
        "tier": tier,
        "heuristic_component": heuristic,
        "llm_component": round(llm_score),
        "top_reason": llm.get("top_reason"),
        "recommended_action": llm.get("recommended_action"),
        "skip_reason": llm.get("skip_reason"),
    }
