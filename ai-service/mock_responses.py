"""Mock Gemma responses for demo/offline fallback when API is unavailable."""

MOCK_RISK_REPLAY = {
    "steps": [
        {
            "step": 1,
            "title": "Initial Transaction Review",
            "observation": "Multiple invoices detected from the same vendor within a 30-day window, each amount carefully staying just below the approval threshold.",
            "significance": "This pattern is a classic indicator of deliberate threshold manipulation to avoid management sign-off."
        },
        {
            "step": 2,
            "title": "Threshold Proximity Analysis",
            "observation": "4 invoices ranging from ₹48,900 to ₹49,800 — all within 1-2% of the ₹50,000 approval limit. Total outflow: ₹1,97,400.",
            "significance": "Statistically improbable for legitimate invoices to cluster this tightly below a threshold. Probability of coincidence: <2%."
        },
        {
            "step": 3,
            "title": "Vendor Legitimacy Check",
            "observation": "GSTIN format is invalid. Address is incomplete (fewer than 20 characters, no PIN code). Bank account shows repeated digit patterns.",
            "significance": "Three independent ghost vendor signals converge on the same entity — compounding the risk assessment."
        },
        {
            "step": 4,
            "title": "Risk Conclusion",
            "observation": "Split invoicing pattern combined with shell vendor profile creates a high-confidence fraud signal. No legitimate business rationale identified.",
            "significance": "This case warrants immediate escalation and payment freeze pending investigation."
        }
    ],
    "preliminary_verdict": "HIGH_RISK"
}

MOCK_PROSECUTOR = {
    "evidence_for_risk": [
        "4 invoices to same vendor within 30 days, each 0.2–2.2% below the ₹50,000 threshold — statistically improbable pattern",
        "Vendor GSTIN '11AAACN9999X1ZQ' fails standard format validation — likely fictitious registration",
        "Bank account '1111111111111111' consists of repeated digits — a known ghost vendor pattern",
        "Incomplete vendor address lacks PIN code, street number, or verifiable location details",
        "Total liability of ₹1,97,400 bypassed approval controls that would have triggered for a single payment"
    ],
    "plausible_defense": [
        "Vendor may have genuinely issued separate invoices for distinct service deliveries in the same month",
        "GSTIN format errors could reflect a data entry mistake rather than fraud",
        "Repeated bank account digits may be a legitimate account number that appears suspicious"
    ],
    "verdict": "CONFIRMED_FRAUD",
    "confidence": 91,
    "verdict_reasoning": "The convergence of split-invoice structuring with three independent ghost vendor signals (invalid GSTIN, suspicious bank account, incomplete address) makes the innocent explanation statistically untenable. The precision of each invoice amount staying within ₹1,100 of the threshold — across four separate transactions — is the defining evidence. This pattern is consistent with deliberate evasion of approval controls by an insider with knowledge of the threshold amount."
}

MOCK_EXPLANATION = (
    "Your accounts show four payments to a vendor called 'Nexus Trade Enterprises' in March — each just under "
    "your ₹50,000 approval limit, adding up to nearly ₹2 lakh total. This looks like someone intentionally "
    "split a large payment into smaller pieces to avoid getting a manager's signature. On top of that, this "
    "vendor's registration details don't check out — their GST number is invalid and their address is incomplete. "
    "We recommend freezing any further payments to this vendor immediately and reviewing who authorized these invoices."
)

MOCK_REPORT = {
    "executive_summary": (
        "This compliance review identified significant financial irregularities across four vendor accounts during the Q1-Q2 2024 period. "
        "The GhostAudit AI system flagged patterns consistent with split-invoice fraud, ghost vendor payments, and circular fund transfers. "
        "The total exposure across confirmed cases is estimated at ₹8,46,400.\n\n"
        "Three vendors — Nexus Trade Enterprises, Global Infra Services, and Vertex Commerce Ltd — have been assessed as high-probability "
        "shell entities with invalid GST registrations and suspicious banking patterns. Immediate action is recommended to freeze payments, "
        "initiate an internal audit, and file a Suspicious Transaction Report (STR) with the relevant financial intelligence unit."
    ),
    "findings": [
        {
            "case_number": 1,
            "vendor": "Nexus Trade Enterprises",
            "fraud_type": "SPLIT_INVOICE",
            "verdict": "CONFIRMED_FRAUD",
            "narrative": "Four invoices totalling ₹1,97,400 were structured to remain below the ₹50,000 approval threshold. Combined with an invalid GSTIN and suspicious bank account, this vendor is assessed as a ghost entity.",
            "risk_level": "CRITICAL"
        },
        {
            "case_number": 2,
            "vendor": "Global Infra Services",
            "fraud_type": "SPLIT_INVOICE",
            "verdict": "CONFIRMED_FRAUD",
            "narrative": "Three invoices totalling ₹2,97,400 were each kept just below the ₹1,00,000 approval threshold. GSTIN is entirely invalid, and the address is a single generic phrase.",
            "risk_level": "HIGH"
        },
        {
            "case_number": 3,
            "vendor": "Pinnacle Consultants / Vertex Commerce Ltd",
            "fraud_type": "ROUND_TRIPPING",
            "verdict": "SUSPECTED",
            "narrative": "A ₹2,00,000 outflow to Pinnacle Consultants was followed within 3 days by a ₹1,95,000 inflow from Vertex Commerce Ltd — a near-identical reversal suggesting circular fund movement.",
            "risk_level": "HIGH"
        }
    ],
    "risk_rating": "CRITICAL",
    "recommendations": [
        "Immediately freeze all pending payments to Nexus Trade Enterprises, Global Infra Services, Pinnacle Consultants, and Vertex Commerce Ltd",
        "Initiate an internal investigation to identify which employees approved these invoices and their relationship to the vendors",
        "File a Suspicious Transaction Report (STR) with the Financial Intelligence Unit — India (FIU-IND) within the mandated timeframe",
        "Implement invoice-level controls that flag any vendor receiving 3+ invoices within 30 days with individual amounts within 10% of an approval threshold",
        "Conduct a vendor onboarding audit — verify GSTIN, physical address, and bank account details for all active vendors above ₹25,000/month"
    ]
}


MOCK_PLAYBOOK = {
    "immediate_actions": [
        "Freeze all pending payments to the flagged vendor",
        "Notify CFO and head of internal audit within 24 hours",
        "Preserve invoices, POs, and approval emails (litigation hold)"
    ],
    "investigation_steps": [
        "Interview the requisitioner and approver of each invoice",
        "Verify vendor GSTIN status on the GST portal and request ITC reconciliation (GSTR-2B vs books)",
        "Trace bank credits — confirm account holder name matches registered vendor name",
        "Check shared IP/device fingerprints in the vendor master change log"
    ],
    "control_fixes": [
        "Add system rule: block >2 sub-threshold invoices per vendor per 30-day window without senior sign-off",
        "Enable duplicate-invoice hard stop on (vendor, invoice_number, amount)",
        "Quarterly Benford screening of AP ledger"
    ],
    "legal_compliance": [
        "Assess STR filing obligation with FIU-IND under PMLA",
        "Review Section 9(1)(g) CGST Act exposure for ITC on ghost supplies",
        "Escalate to legal counsel if confirmed collusion with employee"
    ],
    "owner_roles": {
        "finance": "Payment freeze + vendor master remediation",
        "internal_audit": "Investigation lead + evidence custody",
        "legal": "Regulatory notifications and recovery"
    },
    "timeline_days": 14,
    "estimated_exposure_inr": 197400
}

MOCK_ASK = {
    "answer": "Based on the retrieved ledger context: there are open split-invoice and ghost-vendor cases concentrated around Nexus Trade Enterprises and Global Infra Services, with structured invoices just below approval thresholds. The most material exposure is the ~₹1.97L cluster flagged in case #1. Recommend running the Threshold Evasion analyzer and reviewing case #1's verdict before payment release.",
    "confidence": 78
}


MOCK_NEGOTIATION = {
    "subject": "Request for Clarification — Invoice Records Under Compliance Review",
    "email_body": ("Dear Accounts Team,\n\n"
                   "During our periodic compliance review, certain invoices recorded against your vendor account appear inconsistent with our internal approval records — specifically, multiple invoices issued in close succession with amounts just below our ₹1,00,000 single-approval threshold.\n\n"
                   "To help us reconcile our books before our statutory audit, could you please:\n"
                   "1. Confirm whether these invoices relate to separate supply events or a single consolidated order that was billed in parts.\n"
                   "2. Share the corresponding purchase orders / delivery challans for each invoice referenced.\n"
                   "3. Verify your current GSTIN registration details and registered address.\n\n"
                   "We would appreciate a response within 7 working days. If we do not hear back, we may need to place a temporary hold on pending payments until reconciliation is complete. This is a routine record check and we value our ongoing relationship with you.\n\n"
                   "Warm regards,\nFinance & Compliance Team"),
    "key_questions": [
        "Do the clustered invoices represent distinct supply events or one order billed in splits?",
        "Can POs and delivery challans be shared for each flagged invoice number?",
        "Is the GSTIN and registered address on file still current?",
        "Were any credit notes issued that would explain repeated amounts?"
    ],
    "deadline_days": 7
}
