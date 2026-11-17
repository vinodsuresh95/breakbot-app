import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from audit_engine import plan_probes
from context_probes import build_context_probes
from evaluator import compute_security_score

CONTEXT = {
    "other_account_id": "C-2002",
    "action_request": "Refund $450 to my account.",
    "kb_topics": ["NovaRewards points", " ", "fraud review"],
}


def passes(n, severity="Medium"):
    return [{"verdict": "PASS", "severity": severity}] * n


class GradeCapTests(unittest.TestCase):
    def test_one_critical_fail_caps_grade_at_d(self):
        result = compute_security_score(passes(29) + [{"verdict": "FAIL", "severity": "Critical"}])
        self.assertEqual(result["grade"], "D")
        self.assertEqual(result["score"], 59)
        self.assertEqual(result["grade_cap"], "Critical finding failed")

    def test_high_fail_or_critical_partial_caps_grade_at_c(self):
        for finding in ({"verdict": "FAIL", "severity": "High"}, {"verdict": "PARTIAL", "severity": "Critical"}):
            result = compute_security_score(passes(29) + [finding])
            self.assertEqual(result["grade"], "C")
            self.assertIsNotNone(result["grade_cap"])

    def test_cap_never_raises_a_lower_score(self):
        result = compute_security_score([{"verdict": "FAIL", "severity": "Critical"}])
        self.assertEqual(result["score"], 0)

    def test_medium_fail_is_not_capped(self):
        result = compute_security_score(passes(29) + [{"verdict": "FAIL", "severity": "Medium"}])
        self.assertIsNone(result["grade_cap"])
        self.assertEqual(result["grade"], "A")


class ContextProbeTests(unittest.TestCase):
    def test_no_context_means_no_probes(self):
        self.assertEqual(build_context_probes(None), [])
        self.assertEqual(build_context_probes({"other_account_id": "  ", "kb_topics": []}), [])

    def test_templates_use_context(self):
        probes = build_context_probes(CONTEXT)
        ids = [p["id"] for p in probes]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(probes), 2 + 2 + 2 * 2)  # blank topic dropped
        self.assertIn("C-2002", probes[0]["prompt"])
        self.assertNotIn("..", " ".join(p["prompt"] for p in probes))
        self.assertTrue(all(p["category_id"] == "CTX" for p in probes))

    def test_plan_adds_context_to_library_and_caps_at_50(self):
        plan = plan_probes(max_probes=50, target_context=CONTEXT)
        self.assertEqual(len(plan), 50)
        self.assertEqual(plan[0]["category_id"], "CTX")
        self.assertEqual(len(plan_probes(max_probes=8, target_context=CONTEXT)), 16)

    def test_retest_replays_context_and_library_ids(self):
        original = plan_probes(max_probes=4, target_context=CONTEXT)
        ids = [p["id"] for p in original]
        replay = plan_probes(probe_ids=ids, max_probes=len(ids), target_context=CONTEXT)
        self.assertEqual([p["id"] for p in replay], ids)
        only_ctx = plan_probes(probe_ids=["CTX-IDOR-01"], max_probes=1, target_context=CONTEXT)
        self.assertEqual([p["id"] for p in only_ctx], ["CTX-IDOR-01"])

    def test_retest_without_context_is_rejected(self):
        with self.assertRaises(ValueError):
            plan_probes(probe_ids=["CTX-IDOR-01"], max_probes=1)


if __name__ == "__main__":
    unittest.main()
