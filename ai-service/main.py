import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.insert(0, os.path.dirname(__file__))

from prompts.gemma_prompts import (
    generate_risk_replay,
    generate_prosecutor_verdict,
    generate_explanation,
    generate_audit_report,
    generate_playbook,
    generate_ask,
    generate_negotiation_email,
)
from mock_responses import (
    MOCK_RISK_REPLAY,
    MOCK_PROSECUTOR,
    MOCK_EXPLANATION,
    MOCK_REPORT,
    MOCK_PLAYBOOK,
    MOCK_ASK,
    MOCK_NEGOTIATION,
)

# Set USE_MOCK=true in .env to always use mock (for demos without API access)
USE_MOCK = os.environ.get("USE_MOCK", "false").lower() == "true"

app = FastAPI(title="GhostAudit AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    case: dict
    transactions: List[dict]


class ReportRequest(BaseModel):
    cases: List[dict]


@app.get("/health")
def health():
    api_keys = [k.strip() for k in os.environ.get("GEMINI_API_KEY", "").split(",") if k.strip()]
    return {
        "status": "ok",
        "service": "GhostAudit AI Service",
        "model": os.environ.get("GEMMA_MODEL", "gemma-4-31b-it"),
        "mock_mode": USE_MOCK,
        "api_key_set": bool(api_keys),
    }


@app.post("/analyze")
async def analyze_case(req: AnalyzeRequest):
    """Full Gemma analysis: Risk Replay → Prosecutor → Plain-Language Explanation."""

    # If mock mode, return realistic canned responses instantly
    if USE_MOCK:
        return {
            "risk_replay": MOCK_RISK_REPLAY,
            "evidence": MOCK_PROSECUTOR["evidence_for_risk"],
            "defense": MOCK_PROSECUTOR["plausible_defense"],
            "verdict": MOCK_PROSECUTOR["verdict"],
            "confidence": MOCK_PROSECUTOR["confidence"],
            "verdict_reasoning": MOCK_PROSECUTOR["verdict_reasoning"],
            "explanation": MOCK_EXPLANATION,
            "_source": "mock",
        }

    try:
        risk_replay  = generate_risk_replay(req.case, req.transactions)
        prosecutor   = generate_prosecutor_verdict(req.case, req.transactions, risk_replay)
        explanation  = generate_explanation(req.case, prosecutor)
        return {
            "risk_replay": risk_replay,
            "evidence":    prosecutor.get("evidence_for_risk", []),
            "defense":     prosecutor.get("plausible_defense", []),
            "verdict":     prosecutor.get("verdict", "SUSPECTED"),
            "confidence":  prosecutor.get("confidence", 50),
            "verdict_reasoning": prosecutor.get("verdict_reasoning", ""),
            "explanation": explanation,
            "_source": "gemma",
        }
    except RuntimeError as e:
        # Gemma API unavailable — fall back to mock so demo isn't broken
        print(f"[WARN] Gemma API error, falling back to mock: {e}")
        return {
            "risk_replay": MOCK_RISK_REPLAY,
            "evidence": MOCK_PROSECUTOR["evidence_for_risk"],
            "defense": MOCK_PROSECUTOR["plausible_defense"],
            "verdict": MOCK_PROSECUTOR["verdict"],
            "confidence": MOCK_PROSECUTOR["confidence"],
            "verdict_reasoning": MOCK_PROSECUTOR["verdict_reasoning"],
            "explanation": MOCK_EXPLANATION,
            "_source": "mock_fallback",
            "_error": str(e),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


@app.post("/generate-report")
async def generate_report(req: ReportRequest):
    """Generate a formal audit-ready report from analyzed cases."""
    if USE_MOCK:
        return {**MOCK_REPORT, "_source": "mock"}
    try:
        report = generate_audit_report(req.cases)
        return {**report, "_source": "gemma"}
    except RuntimeError as e:
        print(f"[WARN] Gemma API error, falling back to mock report: {e}")
        return {**MOCK_REPORT, "_source": "mock_fallback", "_error": str(e)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")



class AskRequest(BaseModel):
    question: str
    context: dict


@app.post("/ask")
async def ask_ledger(req: AskRequest):
    """RAG-grounded Q&A over the ledger context supplied by the backend."""
    if USE_MOCK:
        return {**MOCK_ASK, "_source": "mock"}
    try:
        result = generate_ask(req.question, req.context)
        return {**result, "_source": "gemma"}
    except RuntimeError as e:
        print(f"[WARN] Gemma API error, falling back to mock ask: {e}")
        return {**MOCK_ASK, "_source": "mock_fallback", "_error": str(e)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ledger Q&A failed: {str(e)}")


@app.post("/playbook")
async def remediation_playbook(req: AnalyzeRequest):
    """Generate a step-by-step remediation playbook for a analyzed case."""
    if USE_MOCK:
        return {**MOCK_PLAYBOOK, "_source": "mock"}
    try:
        verdict_data = {"verdict": req.case.get("fraud_type"), "confidence": req.case.get("confidence")}
        pb = generate_playbook(req.case, req.transactions, verdict_data)
        return {**pb, "_source": "gemma"}
    except RuntimeError as e:
        print(f"[WARN] Gemma API error, falling back to mock playbook: {e}")
        return {**MOCK_PLAYBOOK, "_source": "mock_fallback", "_error": str(e)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Playbook generation failed: {str(e)}")



class NegotiateRequest(BaseModel):
    case: dict
    verdict: Optional[dict] = None
    explanation: Optional[str] = None
    tone: Optional[str] = "professional"


@app.post("/negotiate")
async def negotiate_vendor(req: NegotiateRequest):
    """AI Negotiator: draft a clarification/recovery email to the vendor."""
    if USE_MOCK:
        return {**MOCK_NEGOTIATION, "_source": "mock"}
    try:
        result = generate_negotiation_email(req.case, req.verdict or {}, req.explanation or "", req.tone or "professional")
        return {**result, "_source": "gemma"}
    except RuntimeError as e:
        print(f"[WARN] Gemma API error, falling back to mock negotiation: {e}")
        return {**MOCK_NEGOTIATION, "_source": "mock_fallback", "_error": str(e)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Negotiation drafting failed: {str(e)}")
