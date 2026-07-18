from gemma_client import call_gemma, extract_json
import json


def build_risk_replay_prompt(case_data: dict, transactions: list) -> str:
    tx_summary = "\n".join([
        f"  - Invoice {t.get('invoice_number','?')}: ₹{t.get('amount',0):,.0f} on {t.get('invoice_date','?')} | {t.get('description','?')}"
        for t in transactions
    ])
    return f"""You are an expert financial fraud investigator AI. Analyze this flagged case step by step.

CASE DETAILS:
- Case ID: {case_data.get('id')}
- Vendor: {case_data.get('vendor_name', 'Unknown')}
- GSTIN: {case_data.get('gstin', 'N/A')}
- Fraud Type: {case_data.get('fraud_type')}
- Severity: {case_data.get('severity')}
- Confidence: {case_data.get('confidence')}%
- Summary: {case_data.get('summary')}

TRANSACTIONS INVOLVED:
{tx_summary}

Produce a step-by-step risk reasoning trail. Respond ONLY with valid JSON in this exact format:
{{
  "steps": [
    {{"step": 1, "title": "Initial Observation", "observation": "...", "significance": "..."}},
    {{"step": 2, "title": "Pattern Analysis", "observation": "...", "significance": "..."}},
    {{"step": 3, "title": "Red Flag Assessment", "observation": "...", "significance": "..."}},
    {{"step": 4, "title": "Risk Conclusion", "observation": "...", "significance": "..."}}
  ],
  "preliminary_verdict": "HIGH_RISK"
}}

The preliminary_verdict must be one of: HIGH_RISK, MEDIUM_RISK, LOW_RISK.
Be specific about the numbers and patterns. Do not be generic."""


def generate_risk_replay(case_data: dict, transactions: list) -> dict:
    prompt = build_risk_replay_prompt(case_data, transactions)
    raw = call_gemma(prompt, max_tokens=1200)
    return extract_json(raw)


def build_prosecutor_prompt(case_data: dict, transactions: list, risk_replay: dict) -> str:
    tx_summary = "\n".join([
        f"  - ₹{t.get('amount',0):,.0f} ({t.get('invoice_number','?')}) on {t.get('invoice_date','?')}"
        for t in transactions
    ])
    steps_summary = "\n".join([
        f"  Step {s['step']}: {s['title']} — {s['observation']}"
        for s in risk_replay.get('steps', [])
    ])
    return f"""You are acting as both prosecutor and defense counsel in a financial fraud compliance review.

CASE: {case_data.get('vendor_name')} | {case_data.get('fraud_type')} | Confidence: {case_data.get('confidence')}%
TRANSACTIONS:
{tx_summary}

RISK ANALYSIS STEPS:
{steps_summary}

Your job: present both sides fairly, then deliver a final verdict.

Respond ONLY with valid JSON:
{{
  "evidence_for_risk": [
    "Specific evidence point 1 with amounts/dates",
    "Specific evidence point 2",
    "Specific evidence point 3"
  ],
  "plausible_defense": [
    "Innocent explanation 1",
    "Innocent explanation 2"
  ],
  "verdict": "CONFIRMED_FRAUD",
  "confidence": 87,
  "verdict_reasoning": "One paragraph explaining the final verdict decision, weighing evidence vs defense."
}}

The verdict must be one of: CONFIRMED_FRAUD, SUSPECTED, DISMISSED.
Be precise about rupee amounts and dates. Do not fabricate information."""


def generate_prosecutor_verdict(case_data: dict, transactions: list, risk_replay: dict) -> dict:
    prompt = build_prosecutor_prompt(case_data, transactions, risk_replay)
    raw = call_gemma(prompt, max_tokens=1200)
    return extract_json(raw)


def build_explain_prompt(case_data: dict, verdict_data: dict) -> str:
    return f"""You are summarizing a financial compliance anomaly for a small business owner.

FINDING:
- Business flagged: {case_data.get('vendor_name')}
- Type of issue: {case_data.get('fraud_type', '').replace('_', ' ').title()}
- Verdict: {verdict_data.get('verdict')}
- Reasoning: {verdict_data.get('verdict_reasoning', '')}

Write a 2-3 line summary in layman terms explaining exactly what the anomaly is and why it was flagged. Do not include recommendations or jargon.

Return ONLY the raw 2-3 line summary. Do NOT return JSON. Do NOT wrap it in any tags like <explanation>."""


def generate_explanation(case_data: dict, verdict_data: dict) -> str:
    prompt = build_explain_prompt(case_data, verdict_data)
    raw = call_gemma(prompt, max_tokens=600).strip()
    
    # Sometimes Gemma wraps in json or <explanation> tags despite instructions
    import re
    raw = re.sub(r'<explanation>', '', raw, flags=re.IGNORECASE)
    raw = re.sub(r'</explanation>', '', raw, flags=re.IGNORECASE)
    
    # Check if it looks like JSON
    if raw.startswith('{'):
        try:
            parsed = json.loads(raw)
            if 'summary' in parsed:
                raw = parsed['summary']
        except json.JSONDecodeError:
            pass
            
    return raw.strip()


def build_report_prompt(cases: list) -> str:
    case_summaries = []
    for i, c in enumerate(cases, 1):
        case_summaries.append(f"""
Case {i}: {c.get('vendor_name', 'Unknown Vendor')}
- Fraud Type: {c.get('fraud_type', 'N/A').replace('_', ' ').title()}
- Verdict: {c.get('verdict', 'SUSPECTED')}
- Confidence: {c.get('confidence', 0)}%
- Summary: {c.get('summary', '')}
- Key Evidence: {', '.join(json.loads(c.get('evidence') or '[]')[:2])}
""")

    return f"""You are a senior financial compliance officer writing a formal audit report.

ANALYZED CASES ({len(cases)} total):
{''.join(case_summaries)}

Generate a formal audit report. Respond ONLY with valid JSON:
{{
  "executive_summary": "2-3 paragraph executive summary of findings suitable for a bank or auditor",
  "findings": [
    {{
      "case_number": 1,
      "vendor": "...",
      "fraud_type": "...",
      "verdict": "...",
      "narrative": "2-3 sentence formal finding description",
      "risk_level": "CRITICAL | HIGH | MEDIUM"
    }}
  ],
  "risk_rating": "HIGH",
  "recommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2",
    "Specific recommendation 3",
    "Specific recommendation 4"
  ]
}}

The risk_rating must be one of: CRITICAL, HIGH, MEDIUM, LOW.
Use formal, professional language. Be specific about vendors and amounts."""


def generate_audit_report(cases: list) -> dict:
    prompt = build_report_prompt(cases)
    raw = call_gemma(prompt, max_tokens=2000)
    return extract_json(raw)
