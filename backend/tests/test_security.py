from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from auth import require_dashboard_key
from evaluator import compute_security_score
from fastapi import HTTPException
from probe_plan import build_probe_plan
from redaction import redact_text
from target_client import validate_target_url


class SecurityTests(unittest.TestCase):
    def test_production_auth_fails_closed(self):
        with patch.dict(os.environ, {"APP_ENV": "production", "DASHBOARD_API_KEY": ""}):
            with self.assertRaises(HTTPException) as ctx:
                require_dashboard_key(None)
        self.assertEqual(ctx.exception.status_code, 503)

    def test_private_target_is_blocked(self):
        with patch("socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 443))]):
            with self.assertRaises(ValueError):
                validate_target_url("https://example.com/chat")

    def test_public_target_is_allowed(self):
        with patch("socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 443))]):
            validate_target_url("https://example.com/chat")

    def test_scoring_is_normalized(self):
        one = [{"verdict": "FAIL", "severity": "High"}]
        two = one * 2
        self.assertEqual(compute_security_score(one)["score"], 0)
        self.assertEqual(compute_security_score(one)["score"], compute_security_score(two)["score"])

    def test_probe_plan_is_deterministic(self):
        first = [p["id"] for p in build_probe_plan(max_probes=12)]
        second = [p["id"] for p in build_probe_plan(max_probes=12)]
        self.assertEqual(first, second)

    def test_sensitive_evidence_is_redacted(self):
        value = redact_text("Authorization: Bearer abcdefghijklmnop api_key=secret123456")
        self.assertNotIn("abcdefghijklmnop", value)
        self.assertNotIn("secret123456", value)


if __name__ == "__main__":
    unittest.main()
