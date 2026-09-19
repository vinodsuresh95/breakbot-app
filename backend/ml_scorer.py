"""ML-based lead tier scoring — blends LLM scores with heuristic features."""

from __future__ import annotations

import re
from typing import Any

import numpy as np
from sklearn.preprocessing import MinMaxScaler


def _tier_from_score(score: float) -> str:
    if score >= 80:
        return "A"
    if score >= 60:
        return "B"
    if score >= 40:
        return "C"
    return "D"


def _feature_vector(prospect: dict[str, Any], llm_result: dict[str, Any] | None) -> np.ndarray:
    llm = llm_result or {}
    llm_score = float(llm.get("total_score") or prospect.get("score") or 50)

    chatbot = (prospect.get("chatbot") or "").lower()
    has_chatbot = 1.0 if chatbot and chatbot not in ("unknown", "—", "-") else 0.2

    email = prospect.get("email") or ""
    has_email = 1.0 if re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email) else 0.0

    title = (prospect.get("title") or "").lower()
    authority = 0.3
    if any(k in title for k in ("cto", "ceo", "chief", "head of ai", "vp")):
        authority = 1.0
    elif any(k in title for k in ("director", "lead", "manager")):
        authority = 0.7

    stage = prospect.get("stage") or "researched"
    stage_boost = {
        "replied": 1.0,
        "opened": 0.9,
        "meeting": 1.0,
        "audit": 1.0,
        "customer": 1.0,
        "sent": 0.6,
        "drafted": 0.5,
        "researched": 0.4,
    }.get(stage, 0.3)

    country = prospect.get("country") or ""
    region_fit = 0.7
    if any(x in country for x in ("USA", "UK", "Germany", "India", "Singapore")):
        region_fit = 1.0

    features = np.array([[llm_score, has_chatbot, has_email, authority, stage_boost, region_fit]])
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(features)[0]
    return scaled


def blend_lead_score(prospect: dict[str, Any], llm_result: dict[str, Any] | None = None) -> dict[str, Any]:
    """Combine Claude qualification with sklearn-normalised feature weights."""
    llm = llm_result or {}
    llm_score = float(llm.get("total_score") or prospect.get("score") or 50)

    vec = _feature_vector(prospect, llm)
    weights = np.array([0.45, 0.15, 0.15, 0.10, 0.10, 0.05])
    ml_component = float(np.dot(vec, weights) * 100)
    blended = round(0.7 * llm_score + 0.3 * ml_component)

    tier = llm.get("tier") or _tier_from_score(blended)
    return {
        "total_score": blended,
        "tier": tier,
        "ml_component": round(ml_component),
        "llm_component": round(llm_score),
        "top_reason": llm.get("top_reason"),
        "recommended_action": llm.get("recommended_action"),
        "skip_reason": llm.get("skip_reason"),
    }
