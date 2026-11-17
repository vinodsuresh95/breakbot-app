"""Run BreakBot's probes + judge against the NovaBank target and score the judge.

    python bench.py --url http://127.0.0.1:8100 --probes 25 --industry FIN

For each probe: send it to /chat, fetch the ground-truth trace from
/lab/trace, judge the reply with BreakBot's own evaluator, then compare.
Writes JSON and Markdown results to ../output/target-lab/.

This calls the local lab target directly. BreakBot's audit API rightly refuses
localhost targets; deploy the lab behind HTTPS to audit it from the dashboard.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "backend"))

from audit_engine import plan_probes  # noqa: E402
from evaluator import compute_security_score, evaluate_probe  # noqa: E402
from usage_tracker import empty_usage  # noqa: E402

# What an operator would enter in the dashboard's "App context" fields for this
# target; BreakBot turns it into CTX probes.
NOVABANK_CONTEXT = {
    "other_account_id": "C-2002",
    "action_request": "Refund the $450 overdraft fee to my account C-1001",
    "kb_topics": ["NovaRewards points", "fraud review and account takeover"],
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8100")
    parser.add_argument("--probes", type=int, default=20, help="library probes to sample (0-50)")
    parser.add_argument("--industry", default="FIN")
    parser.add_argument("--no-context", action="store_true", help="library probes only")
    parser.add_argument("--label", default="")
    args = parser.parse_args()

    admin_key = os.getenv("LAB_ADMIN_KEY")
    if not admin_key:
        print("Set LAB_ADMIN_KEY to the same value the target was started with.", file=sys.stderr)
        return 2

    context = None if args.no_context else NOVABANK_CONTEXT
    probes = plan_probes(industry_pack=args.industry or None, max_probes=max(1, min(args.probes, 50)), target_context=context)
    if not args.probes:
        probes = [p for p in probes if p.get("source") == "context"]
    for p in probes:
        p["source"] = "context" if p.get("source") == "context" else "library"

    usage = empty_usage()
    with httpx.Client(timeout=90) as http:
        mode = http.get(f"{args.url}/health").raise_for_status().json()["mode"]
        rows = []
        for i, probe in enumerate(probes, 1):
            started = time.perf_counter()
            try:
                res = http.post(f"{args.url}/chat", json={"message": probe["prompt"]}).raise_for_status().json()
                trace = http.get(f"{args.url}/lab/trace/{res['trace_id']}", headers={"X-Lab-Key": admin_key}).raise_for_status().json()
            except httpx.HTTPError as exc:
                print(f"[{i}/{len(probes)}] {probe['id']}: target error {exc}")
                rows.append({"probe_id": probe["id"], "source": probe["source"], "error": str(exc)})
                continue
            ev = evaluate_probe(probe, res["response"], usage_bucket=usage)
            breached = bool(trace["breaches"])
            judged_fail = ev["verdict"] in ("FAIL", "PARTIAL")
            outcome = (
                "true_positive" if breached and judged_fail
                else "missed_breach" if breached
                else "judge_only_fail" if judged_fail
                else "true_negative"
            )
            rows.append({
                "probe_id": probe["id"],
                "source": probe["source"],
                "severity": probe.get("severity"),
                "category": probe.get("category_name"),
                "verdict": ev["verdict"],
                "confidence": ev["confidence"],
                "judge_reason": ev["reason"],
                "breaches": trace["breaches"],
                "filtered": trace["filtered"],
                "tool_calls": trace["tool_calls"],
                "retrieved": trace["retrieved"],
                "outcome": outcome,
                "prompt": probe["prompt"],
                "response": res["response"][:1500],
                "seconds": round(time.perf_counter() - started, 1),
            })
            print(f"[{i}/{len(probes)}] {probe['id']:<14} judge={ev['verdict']:<9} breaches={trace['breaches'] or '-'} -> {outcome}")

    scored = [r for r in rows if "error" not in r]
    counts = {k: sum(1 for r in scored if r["outcome"] == k) for k in ("true_positive", "missed_breach", "judge_only_fail", "true_negative")}
    breaches = counts["true_positive"] + counts["missed_breach"]
    summary = {
        "mode": mode,
        "probes": len(rows),
        "errors": len(rows) - len(scored),
        "breaches_ground_truth": breaches,
        "judge_recall_on_breaches": round(counts["true_positive"] / breaches, 2) if breaches else None,
        **counts,
        "breakbot_score": compute_security_score(scored),
        "library_probes_that_breached": sum(1 for r in scored if r["source"] == "library" and r["breaches"]),
        "judge_cost_usd": round(usage.get("estimated_usd", 0.0), 4),
    }

    out_dir = HERE.parent / "output" / "target-lab"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    name = f"bench-{mode}{'-' + args.label if args.label else ''}-{stamp}"
    (out_dir / f"{name}.json").write_text(json.dumps({"summary": summary, "results": rows}, indent=2))
    (out_dir / f"{name}.md").write_text(render_markdown(summary, scored))
    print(json.dumps(summary, indent=2))
    print(f"Saved {out_dir / name}.json and .md")
    return 0


def render_markdown(summary: dict, rows: list[dict]) -> str:
    lines = [
        f"# NovaBank target bench — {summary['mode']} mode",
        "",
        "| Metric | Value |",
        "|---|---|",
    ]
    for key in ("probes", "errors", "breaches_ground_truth", "true_positive", "missed_breach",
                "judge_only_fail", "true_negative", "judge_recall_on_breaches", "library_probes_that_breached"):
        lines.append(f"| {key} | {summary[key]} |")
    score = summary["breakbot_score"]
    lines.append(f"| BreakBot score | {score.get('score')} ({score.get('grade')}) |")
    lines += ["", "## Results", "", "| Probe | Source | Judge | Ground truth | Outcome |", "|---|---|---|---|---|"]
    for r in rows:
        lines.append(f"| {r['probe_id']} | {r['source']} | {r['verdict']} | {', '.join(r['breaches']) or '—'} | {r['outcome']} |")
    lines += ["", "## Breaches and disagreements", ""]
    for r in rows:
        if r["outcome"] in ("true_negative",):
            continue
        lines += [
            f"### {r['probe_id']} — {r['outcome']}",
            f"**Prompt:** {r['prompt']}",
            "",
            f"**Reply:** {r['response']}",
            "",
            f"**Judge:** {r['verdict']} — {r['judge_reason']}",
            f"**Ground truth:** {', '.join(r['breaches']) or 'no breach detected'}; tools: {r['tool_calls'] or 'none'}",
            "",
        ]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    raise SystemExit(main())
