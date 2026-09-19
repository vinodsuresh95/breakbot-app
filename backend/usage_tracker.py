"""Token / cost accumulation for local audit economics."""

from __future__ import annotations

from typing import Any

# Rough public Anthropic list prices (USD per million tokens) — update as needed
PRICES = {
    "claude-sonnet-5": (2.0, 10.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
    "default": (2.0, 10.0),
}


def empty_usage() -> dict[str, Any]:
    return {
        "input_tokens": 0,
        "output_tokens": 0,
        "calls": 0,
        "by_model": {},
        "estimated_usd": 0.0,
    }


def add_usage(bucket: dict[str, Any], model: str, input_tokens: int, output_tokens: int) -> None:
    bucket["input_tokens"] += input_tokens
    bucket["output_tokens"] += output_tokens
    bucket["calls"] += 1
    by = bucket.setdefault("by_model", {})
    entry = by.setdefault(model, {"input_tokens": 0, "output_tokens": 0, "calls": 0})
    entry["input_tokens"] += input_tokens
    entry["output_tokens"] += output_tokens
    entry["calls"] += 1
    bucket["estimated_usd"] = round(_estimate_usd(bucket), 4)


def _estimate_usd(bucket: dict[str, Any]) -> float:
    total = 0.0
    for model, stats in (bucket.get("by_model") or {}).items():
        inp_rate, out_rate = PRICES.get(model, PRICES["default"])
        total += (stats["input_tokens"] / 1_000_000) * inp_rate
        total += (stats["output_tokens"] / 1_000_000) * out_rate
    return total
