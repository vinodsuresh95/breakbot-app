"""BreakBot FastAPI backend — AI agents, ML scoring, email, automation."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents import AGENTS, BRIEF_SYSTEM
from ai_client import call_claude, chat_claude, prospect_prompt, FAST_MODEL
from auth import require_dashboard_key
from email_service import send_email, smtp_configured
from ml_scorer import blend_lead_score
from audit_engine import run_audit
from audit_store import list_audits, load_audit
from probe_registry import get_industry_pack, library_stats, load_library
from waitlist_service import save_waitlist

load_dotenv()

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
scheduler = BackgroundScheduler()


class Prospect(BaseModel):
    id: int | str | None = None
    company: str = ""
    country: str = ""
    industry: str = ""
    contact: str = ""
    title: str = ""
    email: str = ""
    linkedin: str = ""
    chatbot: str = ""
    stage: str = "researched"
    score: int = 0
    tier: str = "C"
    notes: str = ""
    researchData: dict[str, Any] | None = None
    draftEmail: dict[str, Any] | None = None


class AgentRunRequest(BaseModel):
    agent_id: str
    prospect: Prospect


class AgentChatRequest(BaseModel):
    agent_id: str
    messages: list[dict[str, str]]
    prospect: Prospect | None = None


class BriefRequest(BaseModel):
    context: str


class EmailSendRequest(BaseModel):
    to: str
    subject: str
    body: str
    prospect_id: int | str | None = None
    company: str | None = None


class OutreachRunRequest(BaseModel):
    prospect: Prospect
    auto_send: bool = False
    steps: list[str] | None = None


class WaitlistRequest(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    chatbot: str = ""
    industry: str = ""
    message: str = ""
    source: str = "website"


class DailyAutomationRequest(BaseModel):
    prospects: list[Prospect] = Field(default_factory=list)


class AuditTarget(BaseModel):
    mode: str = "http_json"  # http_json | demobot
    url: str = ""
    method: str = "POST"
    headers: dict[str, str] = Field(default_factory=dict)
    message_field: str = "message"
    response_field: str = "response"
    auth_bearer: str | None = None
    timeout_seconds: float = 45


class AuditRunRequest(BaseModel):
    target: AuditTarget
    customer_name: str = ""
    industry_pack: str | None = None
    category_ids: list[str] | None = None
    probe_ids: list[str] | None = None
    max_probes: int = 12
    authorization_confirmed: bool = False


class TargetPingRequest(BaseModel):
    target: AuditTarget


def _run_agent(agent_id: str, prospect: dict[str, Any]) -> dict[str, Any]:
    agent = AGENTS.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_id}")

    prompt = prospect_prompt(prospect)
    result = call_claude(agent["system"], prompt, json_mode=True)

    if agent_id == "qualifier":
        result = blend_lead_score(prospect, result)

    return result


def _draft_email_if_needed(prospect: dict[str, Any]) -> dict[str, Any]:
    if prospect.get("draftEmail") and prospect["draftEmail"].get("subject"):
        return prospect["draftEmail"]
    return call_claude(AGENTS["writer"]["system"], prospect_prompt(prospect), json_mode=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="BreakBot API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173", "https://breakbot.netlify.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/auth/verify")
def auth_verify(_: None = Depends(require_dashboard_key)):
    return {"ok": True}


@app.get("/api/health")
def health():
    key_set = bool(os.getenv("DASHBOARD_API_KEY", "").strip())
    return {
        "status": "ok",
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
        "smtp": smtp_configured(),
        "airtable": bool(os.getenv("AIRTABLE_TOKEN") and os.getenv("AIRTABLE_BASE_ID")),
        "dashboard_auth_required": key_set,
    }


@app.get("/api/probes/stats")
def probes_stats():
    """Public probe counts only — not the attack library itself."""
    return library_stats()


@app.get("/api/probes/library")
def probes_library(_: None = Depends(require_dashboard_key)):
    return load_library()


@app.get("/api/probes/industry/{pack_id}")
def probes_industry_pack(pack_id: str, _: None = Depends(require_dashboard_key)):
    pack = get_industry_pack(pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail=f"Unknown industry pack: {pack_id}")
    return pack


@app.post("/api/agents/run")
def agents_run(req: AgentRunRequest, _: None = Depends(require_dashboard_key)):
    prospect = req.prospect.model_dump()
    return {"agent_id": req.agent_id, "result": _run_agent(req.agent_id, prospect)}


@app.post("/api/agents/chat")
def agents_chat(req: AgentChatRequest, _: None = Depends(require_dashboard_key)):
    agent = AGENTS.get(req.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {req.agent_id}")

    system = agent["system"]
    if req.prospect:
        system += f"\n\nCurrent prospect context:\n{prospect_prompt(req.prospect.model_dump())}"

    # Detect send-email intent in last user message
    last_user = next((m["content"] for m in reversed(req.messages) if m.get("role") == "user"), "")
    send_intent = any(k in last_user.lower() for k in ("send email", "email them", "send outreach", "send now"))

    reply = chat_claude(system, req.messages)

    email_action = None
    if send_intent and req.prospect:
        p = req.prospect.model_dump()
        draft = _draft_email_if_needed(p)
        if p.get("email"):
            email_action = send_email(
                to=p["email"],
                subject=draft.get("subject", "BreakBot — chatbot security audit"),
                body=draft.get("body", ""),
            )
            email_action["draft"] = draft

    return {"reply": reply, "email_action": email_action}


@app.post("/api/brief")
def brief(req: BriefRequest, _: None = Depends(require_dashboard_key)):
    text = call_claude(BRIEF_SYSTEM, req.context, json_mode=False, model=FAST_MODEL, max_tokens=700)
    return {"text": text}


@app.post("/api/email/send")
def email_send(req: EmailSendRequest, _: None = Depends(require_dashboard_key)):
    if not req.to or not req.subject or not req.body:
        raise HTTPException(status_code=400, detail="to, subject, and body are required")
    result = send_email(to=req.to, subject=req.subject, body=req.body)
    return result


def _execute_outreach(req: OutreachRunRequest) -> dict[str, Any]:
    """Full pipeline: SCOUT → JUDGE → NOVA → optional HERMES send."""
    prospect = req.prospect.model_dump()
    steps = req.steps or ["scout", "qualifier", "writer", "sender"]
    results: dict[str, Any] = {}

    for step in steps:
        if step == "scout":
            research = _run_agent("scout", prospect)
            prospect["researchData"] = research
            results["scout"] = research
        elif step == "qualifier":
            score = _run_agent("qualifier", prospect)
            prospect["score"] = score.get("total_score", prospect.get("score", 0))
            prospect["tier"] = score.get("tier", prospect.get("tier", "C"))
            results["qualifier"] = score
        elif step == "writer":
            draft = _run_agent("writer", prospect)
            prospect["draftEmail"] = draft
            results["writer"] = draft
        elif step == "sender":
            schedule = _run_agent("sender", prospect)
            results["sender"] = schedule

    if req.auto_send and prospect.get("email") and prospect.get("draftEmail"):
        draft = prospect["draftEmail"]
        email_result = send_email(
            to=prospect["email"],
            subject=draft.get("subject", "BreakBot security audit"),
            body=draft.get("body", ""),
        )
        results["email"] = email_result

    return {"prospect": prospect, "results": results}


@app.post("/api/outreach/run")
def outreach_run(req: OutreachRunRequest, _: None = Depends(require_dashboard_key)):
    return _execute_outreach(req)


@app.post("/api/waitlist")
async def waitlist(req: WaitlistRequest):
    result = await save_waitlist(req.model_dump())
    return {"success": True, **result}


@app.post("/api/automation/daily")
def automation_daily(req: DailyAutomationRequest, _: None = Depends(require_dashboard_key)):
    """Draft follow-ups for hot leads — never auto-sends email without explicit approval."""
    actions = []
    for p in req.prospects:
        pdata = p.model_dump()
        should_run = (
            pdata.get("tier") in ("A", "B")
            and pdata.get("stage") in ("researched", "drafted")
            and pdata.get("email")
        )
        if not should_run:
            continue
        flow = _execute_outreach(
            OutreachRunRequest(prospect=p, auto_send=False, steps=["writer", "sender"])
        )
        actions.append({"company": pdata.get("company"), "result": flow})

    return {"processed": len(actions), "actions": actions, "auto_send": False}


@app.post("/api/audit/ping")
def audit_ping(req: TargetPingRequest, _: None = Depends(require_dashboard_key)):
    from target_client import TargetClient

    return TargetClient(req.target.model_dump()).ping()


@app.post("/api/audit/run")
def audit_run(req: AuditRunRequest, _: None = Depends(require_dashboard_key)):
    if not req.authorization_confirmed:
        raise HTTPException(
            status_code=400,
            detail="You must confirm you have authorization to test this target.",
        )
    report = run_audit(
        target_config=req.target.model_dump(),
        customer_name=req.customer_name,
        industry_pack=req.industry_pack,
        category_ids=req.category_ids,
        probe_ids=req.probe_ids,
        max_probes=req.max_probes,
    )
    return report


@app.get("/api/audit")
def audit_list(_: None = Depends(require_dashboard_key), limit: int = 20):
    return {"audits": list_audits(limit=limit)}


@app.get("/api/audit/{audit_id}")
def audit_get(audit_id: str, _: None = Depends(require_dashboard_key)):
    report = load_audit(audit_id)
    if not report:
        raise HTTPException(status_code=404, detail="Audit not found")
    return report


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
