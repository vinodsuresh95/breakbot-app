"""Small evidence-redaction helpers for persisted audit reports."""

from __future__ import annotations

import re


PATTERNS = (
    re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{12,}"),
    re.compile(
        r"(?i)\b(api[_-]?key|access[_-]?token|secret|password)\b(\s*[:=]\s*)"
        r"[^\s,;\"']{6,}"
    ),
    re.compile(r"\bsk-(?:ant-)?[A-Za-z0-9_-]{12,}\b"),
)


def redact_text(value: str) -> str:
    text = value or ""
    text = PATTERNS[0].sub("Bearer [REDACTED]", text)
    text = PATTERNS[1].sub(lambda match: f"{match.group(1)}{match.group(2)}[REDACTED]", text)
    text = PATTERNS[2].sub("[REDACTED_API_KEY]", text)
    return text
