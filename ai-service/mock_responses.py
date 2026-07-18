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
