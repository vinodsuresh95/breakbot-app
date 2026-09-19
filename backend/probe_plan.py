"""Select probes for an audit run."""

from __future__ import annotations

import random
from typing import Any

from probe_registry import get_industry_pack, load_library

SEVERITY_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}


def _flatten_core(category_ids: list[str] | None = None) -> list[dict[str, Any]]:
    lib = load_library()
    probes: list[dict[str, Any]] = []
    for cat in lib.get("categories") or []:
        if category_ids and cat.get("id") not in category_ids:
            continue
        for p in cat.get("prompts") or []:
            probes.append(
                {
                    **p,
                    "category_id": cat.get("id"),
                    "category_name": cat.get("name"),
                    "owasp_ref": cat.get("owasp_ref"),
                    "source": "core",
                }
            )
    return probes


def _flatten_industry(pack_id: str) -> list[dict[str, Any]]:
    pack = get_industry_pack(pack_id)
    if not pack:
        return []
    return [
        {
            **p,
            "category_id": pack_id,
            "category_name": pack.get("name"),
            "owasp_ref": pack.get("regulations"),
            "source": "industry",
        }
        for p in pack.get("prompts") or []
    ]


def build_probe_plan(
    *,
    industry_pack: str | None = None,
    category_ids: list[str] | None = None,
    probe_ids: list[str] | None = None,
    max_probes: int = 15,
    industry_probe_cap: int = 5,
) -> list[dict[str, Any]]:
    """Critical-first sampling from core + optional industry pack."""
    if probe_ids:
        all_probes = _flatten_core() + (
            _flatten_industry(industry_pack) if industry_pack else []
        )
        by_id = {p["id"]: p for p in all_probes if p.get("id")}
        return [by_id[pid] for pid in probe_ids if pid in by_id][:max_probes]

    core = _flatten_core(category_ids)
    core.sort(key=lambda p: (SEVERITY_ORDER.get(p.get("severity", "Medium"), 9), p.get("id", "")))

    industry: list[dict[str, Any]] = []
    if industry_pack:
        industry = _flatten_industry(industry_pack)
        industry.sort(key=lambda p: (SEVERITY_ORDER.get(p.get("severity", "Medium"), 9), p.get("id", "")))

    n_industry = min(industry_probe_cap, len(industry), max(0, max_probes // 3))
    n_core = max_probes - n_industry

    # Spread core picks across categories for coverage
    by_cat: dict[str, list[dict]] = {}
    for p in core:
        by_cat.setdefault(p["category_id"], []).append(p)

    picked: list[dict] = []
    cat_keys = list(by_cat.keys())
    random.shuffle(cat_keys)
    idx = 0
    while len(picked) < n_core and cat_keys:
        cid = cat_keys[idx % len(cat_keys)]
        bucket = by_cat[cid]
        if bucket:
            picked.append(bucket.pop(0))
        else:
            cat_keys.remove(cid)
            continue
        idx += 1
        if idx > n_core * len(by_cat) + 10:
            break

    if len(picked) < n_core:
        remaining = [p for p in core if p not in picked]
        picked.extend(remaining[: n_core - len(picked)])

    picked.extend(industry[:n_industry])
    return picked[:max_probes]
