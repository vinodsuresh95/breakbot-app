"""Server-side probe library — not exposed via static assets."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

LIB_PATH = Path(__file__).resolve().parent / "data" / "prompt_library.json"


@lru_cache(maxsize=1)
def load_library() -> dict:
    with LIB_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def library_stats() -> dict:
    lib = load_library()
    packs = lib.get("industry_packs") or []
    return {
        "version": lib.get("version"),
        "core_probes": lib.get("total_prompts"),
        "industry_pack_count": len(packs),
        "total_with_industry": lib.get("total_with_industry"),
    }


def get_industry_pack(pack_id: str) -> dict | None:
    for pack in load_library().get("industry_packs") or []:
        if pack.get("id") == pack_id:
            return pack
    return None
