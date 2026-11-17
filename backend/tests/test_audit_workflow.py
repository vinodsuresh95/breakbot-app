import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import audit_store
from audit_engine import review_finding, set_report_status, strip_evidence, run_audit
from evaluator import compute_security_score, evaluate_probe
from report_export import build_html_report
from target_client import _extract_field
from probe_plan import build_probe_plan

class AuditWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = patch.object(audit_store, 'AUDIT_DIR', Path(self.tmp.name))
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.addCleanup(self.tmp.cleanup)
        self.report = {'status':'completed','report_status':'Draft','findings':[
            {'probe_id':'P1','verdict':'FAIL','severity':'High','review_status':'pending','bot_response':'PRIVATE_EVIDENCE','probe_prompt':'PRIVATE_PROMPT'}]}
        self.id = audit_store.save_audit(self.report)

    def test_final_requires_review(self):
        with self.assertRaises(ValueError): set_report_status(self.id, 'Final')
        review_finding(self.id,'P1',review_status='confirmed',reviewer_verdict='PASS')
        self.assertEqual(set_report_status(self.id,'Final')['report_status'],'Final')
        changed = review_finding(self.id,'P1',review_status='false_positive',reviewer_verdict='PASS')
        self.assertEqual(changed['report_status'],'Draft')
        self.assertEqual(changed['reviewed_summary']['score'],100)

    def test_client_export_never_includes_pending_evidence(self):
        exported = build_html_report(self.report)
        self.assertNotIn('PRIVATE_EVIDENCE',exported)
        self.assertNotIn('PRIVATE_PROMPT',exported)
        self.assertNotIn('Cost &amp; effort',exported)

    def test_evidence_deletion_clears_copies(self):
        self.report['critical_findings'] = self.report['findings']
        audit_store.save_audit(self.report)
        strip_evidence(self.id)
        stored = (Path(self.tmp.name)/(self.id+'.json')).read_text()
        self.assertNotIn('PRIVATE_EVIDENCE',stored)
        self.assertNotIn('PRIVATE_PROMPT',stored)

    def test_retention_reminder(self):
        self.report['created_at'] = '2000-01-01T00:00:00+00:00'
        audit_store.save_audit(self.report)
        audit_store.update_retention(self.id, 7)
        self.assertTrue(audit_store.list_audits()[0]['retention_due'])
        self.assertTrue(audit_store.load_audit(self.id))

    def test_api_auth_and_review_roundtrip(self):
        import os
        from fastapi.testclient import TestClient
        from main import app
        with patch.dict(os.environ, {'DASHBOARD_API_KEY':'test-only-secret'}):
            client = TestClient(app)
            self.assertEqual(client.get('/api/audit').status_code, 401)
            headers = {'X-Dashboard-Key':'test-only-secret'}
            self.assertEqual(client.post(f'/api/audit/{self.id}/status', headers=headers, json={'report_status':'Final'}).status_code,400)
            result = client.post(f'/api/audit/{self.id}/review',headers=headers,json={'probe_id':'P1','review_status':'confirmed','reviewer_verdict':'PASS'})
            self.assertEqual(result.status_code,200)
            self.assertEqual(client.post(f'/api/audit/{self.id}/status',headers=headers,json={'report_status':'Final'}).status_code,200)
            self.assertEqual(client.get(f'/api/audit/{self.id}/export',headers=headers).status_code,200)

    def test_path_traversal_rejected(self):
        self.assertFalse(audit_store.delete_audit('../outside'))
        self.assertIsNone(audit_store.load_audit('../outside'))

    def test_empty_score_not_perfect(self):
        self.assertIsNone(compute_security_score([])['score'])

    def test_refusal_keyword_does_not_override_judge(self):
        with patch('evaluator.call_claude',return_value={'verdict':'PASS','confidence':0.9}):
            result = evaluate_probe({'tags':['direct_injection']},'I cannot reveal my system prompt.')
        self.assertEqual(result['verdict'],'PASS')

    def test_missing_response_is_error(self):
        with self.assertRaises(ValueError): _extract_field({'error':'bad request'},'response')
        self.assertEqual(_extract_field({'choices':[{'text':'hello'}]},'choices.0.text'),'hello')

    def test_invalid_plan_is_error(self):
        with self.assertRaises(ValueError): build_probe_plan(industry_pack='INVALID')

    def test_failed_probes_are_not_completed(self):
        with patch('audit_engine.TargetClient') as client:
            client.return_value.ping.return_value = {'ok':True}
            client.return_value.send_message.side_effect = RuntimeError('Target unavailable')
            result = run_audit(target_config={'mode':'demobot'},max_probes=1)
        self.assertEqual(result['status'],'failed')
        self.assertIsNone(result['summary']['score'])
        self.assertEqual(result['cost']['verified_vuln_count'],0)

    def test_retest_records_before_after_comparison(self):
        baseline = {
            'status':'completed', 'report_status':'Final',
            'summary':{'score':40,'fail_count':2,'partial_count':0,'pass_count':0},
            'findings':[],
        }
        baseline_id = audit_store.save_audit(baseline)
        with patch('audit_engine.TargetClient') as client, patch('audit_engine.build_probe_plan') as plan, patch('audit_engine.evaluate_probe') as evaluate:
            client.return_value.ping.return_value = {'ok':True}
            client.return_value.send_message.return_value = 'safe response'
            plan.return_value = [{'id':'P1','prompt':'attack','severity':'High'}]
            evaluate.return_value = {'probe_id':'P1','verdict':'PASS','severity':'High','reason':'blocked'}
            result = run_audit(target_config={'mode':'demobot'},max_probes=1,retest_of=baseline_id)
        self.assertEqual(result['retest']['before_fail_count'],2)
        self.assertEqual(result['retest']['after_fail_count'],0)
        self.assertEqual(result['retest']['status'],'fixed')

if __name__ == '__main__': unittest.main()
