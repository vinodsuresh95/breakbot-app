"""BreakBot Python backend — AI agents, ML scoring, email, automation."""

from __future__ import annotations

import json
import os
import re
from typing import Any

from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
# claude-sonnet-4-20250514 retired Jun 2026 — use current Sonnet
CHAT_MODEL = os.getenv("CHAT_MODEL", "claude-sonnet-5")
FAST_MODEL = os.getenv("FAST_MODEL", "claude-haiku-4-5-20251001")

client = Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


def _extract_text(message) -> str:
    """Prefer text blocks — Sonnet 5+ may prepend thinking blocks."""
    parts: list[str] = []
    for block in message.content or []:
        if getattr(block, "type", None) == "text" and getattr(block, "text", None):
            parts.append(block.text)
    if parts:
        return "\n".join(parts)
    # Fallback for older SDKs / single-block responses
    if message.content and getattr(message.content[0], "text", None):
        return message.content[0].text
    return ""


def parse_json(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"```json|```", "", text or "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw": text} if text else {"raw": None, "error": "empty_model_response"}


def prospect_prompt(prospect: dict[str, Any]) -> str:
    linkedin = prospect.get("linkedin", "")
    return f"""Company: {prospect.get('company', '')}
Country: {prospect.get('country', '')}
Industry: {prospect.get('industry', '')}
Contact: {prospect.get('contact', '')} ({prospect.get('title', '')})
Email: {prospect.get('email', '')}
LinkedIn profile URL (USE THIS EXACT URL — do not change or guess): {linkedin}
Chatbot: {prospect.get('chatbot', '')}
Current stage: {prospect.get('stage', '')}
Score: {prospect.get('score', 0)}/100
Notes: {prospect.get('notes', '')}
Research: {json.dumps(prospect.get('researchData') or {}, ensure_ascii=False)}"""


def call_claude(
    system: str,
    user_msg: str,
    *,
    json_mode: bool = False,
    model: str = CHAT_MODEL,
    max_tokens: int = 1500,
    usage_bucket: dict[str, Any] | None = None,
) -> str | dict[str, Any]:
    if not client:
        raise RuntimeError("ANTHROPIC_API_KEY not configured on backend")

    prompt = user_msg
    if json_mode:
        prompt += "\n\nRespond ONLY with valid JSON. No markdown."

    try:
        message = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as e:
        raise RuntimeError(f"Claude API error ({model}): {e}") from e

    if usage_bucket is not None and getattr(message, "usage", None):
        from usage_tracker import add_usage

        add_usage(
            usage_bucket,
            model,
            int(message.usage.input_tokens or 0),
            int(message.usage.output_tokens or 0),
        )

    text = _extract_text(message)
    return parse_json(text) if json_mode else text


def chat_claude(system: str, messages: list[dict[str, str]], max_tokens: int = 1000) -> str:
    if not client:
        raise RuntimeError("ANTHROPIC_API_KEY not configured on backend")

    try:
        message = client.messages.create(
            model=CHAT_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
    except Exception as e:
        raise RuntimeError(f"Claude API error ({CHAT_MODEL}): {e}") from e

    return _extract_text(message)
