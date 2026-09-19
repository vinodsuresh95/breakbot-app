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
CHAT_MODEL = "claude-sonnet-4-20250514"
FAST_MODEL = "claude-haiku-4-5-20251001"

client = Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


def parse_json(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"```json|```", "", text or "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw": text}


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
) -> str | dict[str, Any]:
    if not client:
        raise RuntimeError("ANTHROPIC_API_KEY not configured on backend")

    prompt = user_msg
    if json_mode:
        prompt += "\n\nRespond ONLY with valid JSON. No markdown."

    message = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    text = message.content[0].text if message.content else ""
    return parse_json(text) if json_mode else text


def chat_claude(system: str, messages: list[dict[str, str]], max_tokens: int = 1000) -> str:
    if not client:
        raise RuntimeError("ANTHROPIC_API_KEY not configured on backend")

    message = client.messages.create(
        model=CHAT_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )
    return message.content[0].text if message.content else ""
