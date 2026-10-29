// ────────────────────────────────────────────────────────────────
// Tier 3 advanced intelligence module — GhostAudit
// Deterministic, explainable detectors built on the SQLite ledger.
// Each function returns { feature, ...findings } shaped JSON that
// both the API and the AI prompts can consume.
// ────────────────────────────────────────────────────────────────
const crypto = require('crypto');
const { getDb } = require('../db');

const H = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);

// ── #18 Compliance DNA ─────────────────────────────────────────
// Learns a vendor's normal financial fingerprint (amount profile,
// timing profile, cadence) and scores current behaviour against it.
function complianceDna(vendorId) {
  const db = getDb();
  const v = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId);
  if (!v) return { error: 'VENDOR_NOT_FOUND' };
  const rows = db.prepare(`
    SELECT amount, invoice_date, payment_date, description, approval_threshold
    FROM transactions WHERE vendor_id = ? ORDER BY invoice_date`).all(vendorId);
  if (rows.length < 5) return { error: 'Insufficient history (need ≥5 transactions)', n: rows.length };

  const amounts = rows.map(r => r.amount).sort((a, b) => a - b);
  const med = amounts[Math.floor(amounts.length / 2)];
  const mad = amounts.map(a => Math.abs(a - med)).sort((a, b) => a - b)[Math.floor(amounts.length / 2)] || 1e-9;
  const gaps = rows.slice(1).map((r, i) =>
    Math.round((new Date(r.invoice_date) - new Date(rows[i].invoice_date)) / 86400000));
  const gapMed = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  const weekdayHist = {};
  for (const r of rows) {
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(r.invoice_date).getDay()];
    weekdayHist[wd] = (weekdayHist[wd] || 0) + 1;
  }
  const dna = {
    fingerprint_id: H({ vendorId, n: rows.length }),
    median_amount: +med.toFixed(2),
    mad_spread: +mad.toFixed(2),
    typical_invoice_gap_days: gapMed,
    weekday_profile: weekdayHist,
    avg_threshold_ratio: +(rows.reduce((s, r) => s + (r.approval_threshold > 0 ? r.amount / r.approval_threshold : 0), 0) / rows.length).toFixed(3),
    sample_size: rows.length,
  };

  // Score last 30 days of activity against the DNA
  const cutoff = new Date(Math.max(...rows.map(r => new Date(r.invoice_date)))) - 30 * 86400000;
  const recent = rows.filter(r => new Date(r.invoice_date) > cutoff);
  const deviations = recent.filter(r => Math.abs(r.amount - med) / (1.4826 * mad) > 3)
    .map(r => ({ invoice_amount: r.amount, robust_z: +(((r.amount - med) / (1.4826 * mad))).toFixed(2) }));
  const score = Math.min(100, deviations.length * 25 + (recent.length > rows.length * 0.5 ? 20 : 0));
  return { vendor_id: vendorId, vendor: v.name, dna, recent_deviation_count: deviations.length,
    deviations, behavioral_score: score,
    verdict: score >= 60 ? '⚠️ Behaviour deviates sharply from historical fingerprint' : '✅ Behaviour consistent with Compliance DNA' };
}

// ── #23 Behavioral Pattern Monitoring ──────────────────────────
// Detects behavioural shifts: weekend invoicing spikes, velocity
// surges, off-hours clustering, escalating round-number usage.
function behavioralMonitoring() {
  const db = getDb();
  const vendors = db.prepare('SELECT id, name FROM vendors').all();
  const alerts = [];
  for (const v of vendors) {
    const rows = db.prepare('SELECT amount, invoice_date FROM transactions WHERE vendor_id=? ORDER BY invoice_date').all(v.id);
    if (rows.length < 6) continue;
    const half = Math.floor(rows.length / 2);
    const stats = (arr) => ({
      weekendPct: arr.filter(r => [0, 6].includes(new Date(r.invoice_date).getDay())).length / arr.length,
      roundPct: arr.filter(r => r.amount % 1000 === 0).length / arr.length,
      perMonth: arr.length / Math.max(1, (new Date(arr[arr.length - 1].invoice_date) - new Date(arr[0].invoice_date)) / 2592000000),
    });
    const before = stats(rows.slice(0, half)), after = stats(rows.slice(half));
    if (after.weekendPct > Math.max(0.25, before.weekendPct * 2))
      alerts.push({ vendor: v.name, vendor_id: v.id, pattern: 'WEEKEND_SPIKE', detail: `Weekend invoicing rose ${(before.weekendPct * 100).toFixed(0)}% → ${(after.weekendPct * 100).toFixed(0)}%` });
    if (after.roundPct > Math.max(0.3, before.roundPct * 1.8))
      alerts.push({ vendor: v.name, vendor_id: v.id, pattern: 'ROUND_NUMBER_SHIFT', detail: `Round-number invoices rose ${(before.roundPct * 100).toFixed(0)}% → ${(after.roundPct * 100).toFixed(0)}%` });
    if (after.perMonth > before.perMonth * 2 && after.perMonth > 2)
      alerts.push({ vendor: v.name, vendor_id: v.id, pattern: 'VELOCITY_SURGE', detail: `Invoice velocity ${before.perMonth.toFixed(1)} → ${after.perMonth.toFixed(1)}/month` });
  }
  return { monitored_vendors: vendors.length, alerts, note: 'first-half vs second-half behavioural comparison per vendor' };
}

// ── #22 Invisible Employee ─────────────────────────────────────
// Transactions with no approver trail / self-approved payments /
// payees matching internal staff patterns in descriptions.
function invisibleEmployee() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.*, v.name AS vendor_name FROM transactions t JOIN vendors v ON v.id = t.vendor_id
    WHERE (t.description LIKE '%salary%' OR t.description LIKE '%reimburse%' OR t.description LIKE '%personal%'
        OR t.description LIKE '%advance%' OR t.description LIKE '%cash withdrawal%' OR t.description LIKE '%staff%')`).all();
  const noTrail = db.prepare(`
    SELECT t.*, v.name AS vendor_name FROM transactions t JOIN vendors v ON v.id = t.vendor_id
    WHERE t.approval_threshold IS NULL OR t.approval_threshold = 0`).all();
  const personalPayees = rows.filter(r => /personal|staff|salary/i.test(r.description) && r.amount > 25000);
  return {
    policy: 'Payments to internal parties must carry an approval trail and be routed through payroll, not vendor invoices',
    flagged_internal_payments: rows.map(r => ({ id: r.id, vendor: r.vendor_name, amount: r.amount, invoice: r.invoice_number, description: r.description })),
    missing_approval_trail: { count: noTrail.length, total_value: noTrail.reduce((s, r) => s + r.amount, 0) },
    high_value_personal: personalPayees.map(r => ({ id: r.id, vendor: r.vendor_name, amount: r.amount, description: r.description })),
    risk_note: personalPayees.length ? '⚠️ Personal/staff payments via vendor channel bypass segregation of duties' : 'No shadow-payee pattern detected',
  };
}

// ── #24 Financial Digital Twin ─────────────────────────────────
// Live contextual model: cash-flow curve, spend mix, vendor graph
// summary, seasonality — one snapshot describing "the business".
function digitalTwin() {
  const db = getDb();
  const months = db.prepare(`
    SELECT strftime('%Y-%m', invoice_date) m, SUM(amount) inflow_spend, COUNT(*) tx, COUNT(DISTINCT vendor_id) active_vendors
    FROM transactions WHERE invoice_date IS NOT NULL GROUP BY m ORDER BY m DESC LIMIT 12`).all().reverse();
  const mix = db.prepare(`
    SELECT COALESCE(NULLIF(description,''),'unspecified') category, SUM(t.amount) total, COUNT(*) n
    FROM transactions t GROUP BY 1 ORDER BY total DESC LIMIT 10`).all();
  const totals = db.prepare(`SELECT SUM(amount) spend, AVG(amount) avg_tx, MAX(strftime('%Y-%m', invoice_date)) latest FROM transactions`).get();
  const health = (() => {
    if (months.length < 3) return 'INSUFFICIENT_HISTORY';
    const h = months.slice(-3).reduce((s, m) => s + m.inflow_spend, 0) / 3;
    const p = months.slice(-6, -3).reduce((s, m) => s + (m.inflow_spend || 0), 0) / Math.max(1, months.slice(-6, -3).length);
    if (!p) return 'NEW';
    return h > p * 1.3 ? 'GROWING' : h < p * 0.7 ? 'CONTRACTING' : 'STEADY';
  })();
  return { generated_at: new Date().toISOString(), health_status: health,
    monthly_curve: months, spend_mix: mix,
    headline: { total_spend: totals.spend, avg_transaction: +(totals.avg_tx || 0).toFixed(2), latest_month: totals.latest },
    note: 'Snapshot model of the business — compare successive snapshots to detect drift' };
}

// ── #26 Multi-Regulator Correlation ────────────────────────────
// One dashboard across GST (gstin validity), Companies/MSME (UAM),
// Income-Tax (PAN-in-GSTIN), DPDP and MSMED Act exposures.
function gstChecksum(gstin) {
  // Simplified GSTIN check: format + PAN part + check-digit presence
  if (!gstin || !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/.test(gstin)) return false;
  return true;
}
function multiRegulator() {
  const db = getDb();
  const vendors = db.prepare('SELECT * FROM vendors').all();
  const findings = [];
  let badGst = 0, dupPan = {}, dupBank = {};
  for (const v of vendors) {
    if (v.gstin && !gstChecksum(v.gstin)) { badGst++; findings.push({ regulator: 'GSTN', entity: v.name, issue: `Invalid GSTIN format: ${v.gstin}` }); }
    if (v.gstin && v.gstin.length >= 14) { const pan = v.gstin.slice(2, 12); dupPan[pan] = (dupPan[pan] || []).concat(v.name); }
    if (v.bank_account) dupBank[v.bank_account] = (dupBank[v.bank_account] || []).concat(v.name);
    if (v.is_ghost) findings.push({ regulator: 'KYC/AML', entity: v.name, issue: 'Vendor flagged ghost/unverified — source-of-funds review due' });
  }
  for (const [pan, names] of Object.entries(dupPan)) if (names.length > 1) findings.push({ regulator: 'Income Tax', entity: names.join(' + '), issue: `Same PAN (${pan}) behind multiple vendor entities` });
  for (const [acct, names] of Object.entries(dupBank)) if (names.length > 1) findings.push({ regulator: 'RBI/AML', entity: names.join(' + '), issue: `Shared bank account ${acct} across entities` });
  const msme = require('./analytics.service').msmeDelayedPayments();
  if (msme.total_violations) findings.push({ regulator: 'MSME Samadhaan', entity: 'Accounts payable', issue: `${msme.total_violations} payments beyond 45-day statutory limit` });
  return {
    regulators: ['GSTN', 'Income Tax (PAN)', 'RBI/AML (bank)', 'MSME Samadhaan', 'DPDP'],
    cross_findings: findings,
    summary_by_regulator: findings.reduce((acc, f) => (acc[f.regulator] = (acc[f.regulator] || 0) + 1, acc), {}),
    note: 'Correlates one finding set across multiple regulator lenses',
  };
}

// ── #27 Multi-Source Evidence Correlation ──────────────────────
// Joins transactions + cases + verdicts + evidence files + audit
// log entries into a single per-vendor dossier.
function evidenceDossier(vendorId) {
  const db = getDb();
  const v = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId);
  if (!v) return { error: 'VENDOR_NOT_FOUND' };
  const txs = db.prepare('SELECT * FROM transactions WHERE vendor_id=?').all(vendorId);
  const cases = db.prepare('SELECT * FROM cases WHERE vendor_id=?').all(vendorId);
  const verdicts = db.prepare(`SELECT vr.* FROM verdicts vr JOIN cases c ON vr.case_id=c.id WHERE c.vendor_id=?`).all(vendorId);
  const evidence = db.prepare(`SELECT ef.* FROM evidence_files ef WHERE ef.filename LIKE ? OR ef.uploaded_by IN (SELECT email FROM users LIMIT 1)`).all(`%${(v.name || '').split(' ')[0]}%`);
  const audit = db.prepare(`SELECT action, entity_type, entity_id, created_at FROM audit_log WHERE entity_type IN ('case','vendor') ORDER BY created_at DESC LIMIT 20`).all();
  const flaggedTx = txs.filter(t => t.is_flagged).length;
  const confirmed = cases.filter(c => c.status === 'CONFIRMED').length;
  const strength = Math.min(100, flaggedTx * 10 + cases.length * 15 + verdicts.length * 5 + confirmed * 20 + evidence.length * 10);
  return {
    vendor: { id: v.id, name: v.name, gstin: v.gstin, is_ghost: !!v.is_ghost },
    sources: {
      transactions: { count: txs.length, flagged: flaggedTx, total_value: txs.reduce((s, t) => s + t.amount, 0) },
      cases: cases.map(c => ({ id: c.id, type: c.fraud_type, severity: c.severity, status: c.status })),
      ai_verdicts: verdicts.map(x => ({ case_id: x.case_id, verdict: x.verdict, confidence: x.confidence })),
      evidence_files: evidence.map(e => ({ id: e.id, filename: e.filename, sha256: e.sha256 })),
      audit_events: audit.length,
    },
    evidence_strength: strength,
    recommendation: strength > 60 ? 'Compile dossier for external counsel / auditor' : 'Monitor — evidence still forming',
  };
}

// ── #33 MSME Formalization Coach ───────────────────────────────
// Scores formalization readiness (GST valid, registered address,
// bank verified, timely invoicing, threshold discipline) and emits
// prioritized coaching steps.
function formalizationCoach(vendorId) {
  const db = getDb();
  const v = vendorId ? db.prepare('SELECT * FROM vendors WHERE id=?').get(vendorId)
                     : db.prepare('SELECT * FROM vendors ORDER BY ghost_score DESC LIMIT 1').get();
  if (!v) return { error: 'VENDOR_NOT_FOUND' };
  const txs = db.prepare('SELECT * FROM transactions WHERE vendor_id=?').all(v.id);
  const checks = [
    { item: 'Valid GSTIN', pass: gstChecksum(v.gstin), step: 'Register on gst.gov.in; quote 15-digit GSTIN on every invoice' },
    { item: 'Verified bank account (KYC)', pass: !v.is_ghost, step: 'Complete vendor KYC: cancelled cheque + Aadhaar/PAN link' },
    { item: 'Documented registered address', pass: !!(v.address && v.address.length > 10), step: 'Add proof of address to vendor master record' },
    { item: 'Consistent invoice numbering', pass: txs.length > 0 && new Set(txs.map(t => t.invoice_number)).size === txs.length, step: 'Use sequential GST-compliant invoice numbers' },
    { item: 'Payment within 45 days discipline', pass: txs.every(t => !t.payment_date || (new Date(t.payment_date) - new Date(t.invoice_date)) / 86400000 <= 45), step: 'MSMED Act: agree credit terms ≤45 days; register dues on Samadhaan portal' },
    { item: 'Threshold-clean invoicing', pass: !txs.some(t => t.is_flagged), step: 'Avoid splitting bills around approval limits — keep one invoice per supply' },
  ];
  const score = Math.round(checks.filter(c => c.pass).length / checks.length * 100);
  return { vendor: v.name, readiness_score: score, band: score >= 80 ? 'FORMAL' : score >= 50 ? 'TRANSITIONING' : 'INFORMAL',
    checks, next_steps: checks.filter(c => !c.pass).map(c => c.step) };
}

// ── #34 Regulatory Shock Simulator ─────────────────────────────
// Applies parameterised rule shocks to the ledger and quantifies
// how many records newly fail and the value at stake.
const SHOCK_PRESETS = {
  LOWER_TDS_THRESHOLD: { label: 'TDS threshold lowered ₹50k → ₹25k', apply: (t) => t.amount >= 25000 && t.amount < 50000 },
  STRICT_45_DAY: { label: 'MSME payment window tightened 45 → 30 days', apply: null, dateBased: 30 },
  GST_RATE_HIKE: { label: 'GST slab moves 12% → 18% on supplied goods', costPct: 0.06 },
  CASH_LIMIT: { label: 'Cash payment cap lowered ₹10k → ₹5k', apply: (t) => (t.payment_method || '').toLowerCase().includes('cash') && t.amount > 5000 },
  APPROVAL_DROP: { label: 'Approval threshold cut ₹50k → ₹30k (more re-checks)', apply: (t) => t.amount >= 30000 && t.amount < 50000 },
};
function regulatoryShock(presetKey, customDays) {
  const db = getDb();
  const preset = SHOCK_PRESETS[presetKey];
  if (!preset) return { error: 'UNKNOWN_PRESET', available: Object.keys(SHOCK_PRESETS) };
  const txs = db.prepare(`SELECT t.*, v.name vendor_name FROM transactions t JOIN vendors v ON v.id=t.vendor_id`).all();
  let affected = [], extraCost = 0;
  for (const t of txs) {
    if (preset.dateBased) {
      if (t.payment_date) {
        const days = Math.round((new Date(t.payment_date) - new Date(t.invoice_date)) / 86400000);
        if (days > (customDays || preset.dateBased)) affected.push({ id: t.id, vendor: t.vendor_name, amount: t.amount, days });
      }
    } else if (preset.apply && preset.apply(t)) {
      affected.push({ id: t.id, vendor: t.vendor_name, amount: t.amount, invoice: t.invoice_number });
    } else if (preset.costPct) {
      extraCost += t.amount * preset.costPct;
      affected.push({ id: t.id, vendor: t.vendor_name, amount: t.amount, extra_gst: +(t.amount * preset.costPct).toFixed(2) });
    }
  }
  const exposure = affected.reduce((s, a) => s + a.amount, 0);
  return { shock: preset.label, records_affected: affected.length, total_exposure: +exposure.toFixed(2),
    additional_cost: +extraCost.toFixed(2), pct_of_book: +((affected.length / Math.max(1, txs.length)) * 100).toFixed(1),
    sample: affected.slice(0, 25),
    impact_verdict: affected.length > txs.length * 0.2 ? '🔴 High impact — renegotiate contracts now' : affected.length > 0 ? '🟡 Moderate impact — plan transition' : '🟢 Negligible impact' };
}

// ── #35 Advertising Compliance Auditor (Ad-Shield) ─────────────
// Scans marketing copy against ASCI code / claims-substantiation rules.
const AD_RULES = [
  { rule: 'SUPERLATIVE_UNSUBSTANTIATED', pattern: /\b(best|no\.?1|number one|finest|greatest|unmatched| unmatched)\b/i, law: 'ASCI Code §4 — objective claims need substantiation', fix: 'Remove superlative or attach verifiable survey data' },
  { rule: 'GUARANTEED_RETURN', pattern: /\b(guarantee[ds]?|assured|100%\s*return|risk[- ]free|sure\s*(shot|profit))\b/i, law: 'SEBI/ASCI — guaranteed-return claims are prohibited in financial ads', fix: 'Replace with disclaimer: subject to market risk' },
  { rule: 'FREE_SCAM_SIGNAL', pattern: /\b(free\b(?!\s*(trial|sample)))\b.*\b(offer|bonus|gift|prize)\b/i, law: 'Consumer Protection (Direct Selling) Rules — hidden costs in "free" offers', fix: 'Disclose all conditions and charges adjacent to the claim' },
  { rule: 'MEDICAL_CLAIM', pattern: /\b(cure|treats|eliminates disease|clinically proven|100% effective)\b/i, law: 'Drugs & Magic Remedies Act — therapeutic claims without CDSCO approval', fix: 'Delete therapeutic claims unless licensed' },
  { rule: 'FALSE URGENCY', pattern: /\b(last chance|expires tonight|only \d+ left|act now or lose)\b/i, law: 'CPA 2019 §2(28) misleading advertisement — artificial urgency', fix: 'Use real deadlines backed by policy' },
  { rule: 'COMPARATIVE_SLANDER', pattern: /\b(cheaper than|better than|worse than)\s+[A-Z][\w&]+/i, law: 'ASCI Code §4.2 — disparaging comparisons', fix: 'Make comparisons factual, named-source and testable' },
  { rule: 'TESTIMONIAL_UNDISCLOSED', pattern: /\b(i (used|bought|saved)|testimonial|customer says)\b/i, law: 'ASCI endorsement guidelines — disclose material connection', fix: 'Mark as paid testimonial; obtain written consent' },
];
function adShield(text) {
  if (!text || text.trim().length < 10) return { error: 'Provide at least 10 characters of ad copy' };
  const violations = [];
  for (const r of AD_RULES) {
    const m = text.match(r.pattern);
    if (m) violations.push({ rule: r.rule, matched_text: m[0], legal_basis: r.law, remediation: r.fix });
  }
  const score = Math.max(0, 100 - violations.length * 20);
  return { compliant: violations.length === 0, compliance_score: score,
    verdict: score >= 80 ? '🟢 Publishable' : score >= 50 ? '🟡 Fix flagged claims before publishing' : '🔴 Do not publish — rewrite required',
    violations, word_count: text.split(/\s+/).length };
}

// ── #36 Dark Pattern Auditor ───────────────────────────────────
// Audits app/UX flow descriptions for CCPA(2023)-listed dark patterns.
const DARK_PATTERNS = [
  { key: 'FALSIFY', name: 'Falsify', signal: /auto[- ]?renew without (notice|consent)|silently (extend|renew)/i, ccpa: 'CCPA Guideline 3.1 — Falsify' },
  { key: 'OBFUSCATION', name: 'Obfuscation', signal: /hidden (fee|charge|terms)|fine print only|price.*(without|excluding).*tax/i, ccpa: 'CCPA 3.2 — Obfuscation' },
  { key: 'BASKET_SNEAK', name: 'Basketchain Sneaking', signal: /added (to cart|to basket) (automatically|by default)|pre-?selected (add-on|insurance)/i, ccpa: 'CCPA 3.3 — Sneaking' },
  { key: 'PRESEL', name: 'Preselection', signal: /default(ed)? (opt[- ]?in|checked|selection)/i, ccpa: 'CCPA 3.4 — Preselection' },
  { key: 'RUG_PULL', name: 'Rug Pull', signal: /cancel(lation)?.*(difficult|hard to find|must call|visit store)/i, ccpa: 'CCPA 3.5 — Rug Pull' },
  { key: 'CONFIRM_SHAMING', name: 'Confirm Shaming', signal: /are you sure you (don'?t|not) (care|want to save)/i, ccpa: 'CCPA 3.6 — Confirm Shaming' },
  { key: 'NAVIGATION', name: 'Navigation Trap', signal: /(back|close) button.*(redirect|home|doesn'?t exit)/i, ccpa: 'CCPA 3.7 — Navigation trap' },
  { key: 'SCORE', name: 'Score Scheme', signal: /gamif|points (expire|multiplier).*pressure|streak.*purchase/i, ccpa: 'CCPA 3.8 — Score scheme' },
  { key: 'DISGUISED', name: 'Disguised Ads', signal: /advert(isement|orial).*looks like (content|news|message)/i, ccpa: 'CCPA 3.9 — Disguised advertisements' },
  { key: 'ENFORCED_CREATIVITY', name: 'Enforced Creativity', signal: /swipe (anywhere|to continue)|tap screen to proceed.*(ad|skip)/i, ccpa: 'CCPA 3.10 — Enforced creativity' },
  { key: 'MISLEADING_LEVERAGE', name: 'Misleading Leverage', signal: /urgent(!.*only|.*hurry)|limited period.*(no refund|non[- ]refundable)/i, ccpa: 'CCPA 3.11 — Misleading leverage' },
  { key: 'HIDDEN_COSTS', name: 'Hidden Costs', signal: /final price.*(higher|different)|fees? (shown )?(at checkout|only later)/i, ccpa: 'CCPA 3.12 — Hidden costs' },
  { key: 'DISGUISED_OPTIONS', name: 'Disguised Options', signal: /(accept|agree) button.*(much bigger|highlighted|same colour as background reject)/i, ccpa: 'CCPA 3.13 — Disguised options' },
  { key: 'DECEPTION', name: 'Deception', signal: /"we never sell your data".*(partner|affiliate|share)/i, ccpa: 'CCPA 3.14 — Deception' },
  { key: 'SOCIAL_PROOF', name: 'Social Proof', signal: /(\d+ people|everyone).*buying.*fake|countdown timer.*fake stock/i, ccpa: 'CCPA 3.15 — Social proof manipulation' },
];
function darkPatternAudit(description) {
  if (!description || description.trim().length < 10) return { error: 'Describe the user flow / screen copy (≥10 chars)' };
  const hits = DARK_PATTERNS.filter(d => d.signal.test(description))
    .map(d => ({ pattern: d.name, regulatory_reference: d.ccpa, why: 'May materially impair consumer autonomy — actionable under Consumer Protection Act 2019 §89(1)(f)' }));
  return { audited: true, dark_patterns_detected: hits.length, risk_band: hits.length >= 3 ? 'HIGH — penalty exposure up to ₹10 lakh (CPA 2019)' : hits.length ? 'MEDIUM' : 'LOW',
    findings: hits, recommendations: hits.length ? hits.map(h => `Redesign flow to remove "${h.pattern}" — make choice explicit, symmetrical and reversible`) : ['Flow appears free of listed CCPA dark patterns'] };
}

// ── #37 Property / Collateral Loan Auditor ─────────────────────
// Validates collateral documentation completeness & valuation sanity.
function collateralAudit(payload) {
  const docs = payload.documents || [];
  const REQUIRED = ['Title Deed', 'Encumbrance Certificate', 'Approved Layout Plan', 'Valuation Report', 'NOC / Occupancy Certificate', 'Insurance Cover Note'];
  const present = REQUIRED.filter(r => docs.some(d => new RegExp(r, 'i').test(d)));
  const missing = REQUIRED.filter(r => !present.includes(r));
  const loan = payload.loan_amount || 0, value = payload.market_value || 0;
  const ltv = value ? +((loan / value) * 100).toFixed(1) : null;
  const flags = [];
  if (ltv != null && ltv > 75) flags.push(`LTV ${ltv}% exceeds prudent 75% ceiling (RBI exposure norms)`);
  if (payload.valuation_date) {
    const ageDays = (Date.now() - new Date(payload.valuation_date)) / 86400000;
    if (ageDays > 180) flags.push(`Valuation report is ${Math.round(ageDays)} days old — refresh (max validity ~6 months)`);
  }
  if (docs.some(d => /disputed|mortgage.*existing|lien/i.test(d))) flags.push('Documents indicate existing lien/dispute — escalate to legal opinion');
  const completeness = Math.round(present.length / REQUIRED.length * 100);
  return { document_completeness_pct: completeness, documents_present: present, documents_missing: missing,
    ltv_pct: ltv, flags, verdict: missing.length === 0 && flags.length === 0 ? '✅ Collateral file audit-ready' :
      (missing.length > 2 || flags.length > 1 ? '🔴 Not sanction-ready' : '🟡 Conditional — clear observations before disbursal') };
}

// ── #38 Cross-Border Customs / HSN Compliance ──────────────────
// Validates HSN codes against GST slabs & import/export doc checklist.
const HSN_SLABS = { '61': 12, '62': 5, '84': 18, '85': 18, '30': 12, '27': 28, '09': 5, '87': 28, '29': 18, '72': 5 };
function hsnCompliance(records) {
  const issues = [];
  for (const r of records) {
    const hsn = String(r.hsn || '');
    if (!/^\d{4,8}$/.test(hsn)) { issues.push({ ref: r.ref || hsn, issue: `HSN "${r.hsn}" invalid — must be 4–8 digits` }); continue; }
    const prefix = hsn.slice(0, 2);
    const expected = HSN_SLABS[prefix];
    if (expected == null) issues.push({ ref: hsn, issue: `Chapter ${prefix} not recognised — verify against ICEGATE/CBIC tariff` });
    else if (r.gst_rate != null && Number(r.gst_rate) !== expected)
      issues.push({ ref: hsn, issue: `Declared GST ${r.gst_rate}% ≠ statutory ${expected}% for chapter ${prefix} — ITC mismatch risk` });
    if (r.export && !(r.shipping_bill || r.iec)) issues.push({ ref: hsn, issue: 'Export line missing Shipping Bill / IEC number' });
    if (r.import && !(r.bill_of_entry || r.billing_note)) issues.push({ ref: hsn, issue: 'Import line missing Bill of Entry' });
  }
  return { lines_checked: records.length, non_conformities: issues.length, issues,
    verdict: issues.length ? '⚠️ Fix HSN/duty mismatches before filing — penal interest u/s 74 CGST' : '✅ All HSN declarations conform' };
}

// ── #39 WhatsApp / Email Financial Compliance ──────────────────
// Analyses informal-channel transcripts for compliance signals.
function informalChannelScan(transcript) {
  const signals = [];
  const add = (sev, pat, why, m) => signals.push({ severity: sev, matched: m[0].slice(0, 120), signal: pat, implication: why });
  const P = [
    ['HIGH', 'Side-deal / off-book demand', /cash(?:\s?\s?basis| only)?\s+(discount|deal|back|payment)|off[- ]the[- ]record|no invoice/i, 'Possible unaccounted transaction — books & records offence (CGST §122)', 1],
    ['HIGH', 'Undisclosed commitment', /i (promise|confirm) (rate|price|delivery|commission)\s+\d|will give you extra/i, 'Verbal commitment conflicting with written contract', 1],
    ['MEDIUM', 'Invoice-splitting instruction', /send (it|them)? as (two|multiple|separate) (bills|invoices)|break the bill/i, 'Directs split invoicing — threshold evasion', 1],
    ['MEDIUM', 'Pressure / quid-pro-quo', /need some.?gift|festival.*expect|small favour/i, 'Bribery red-flag (PCA §8) in procurement chat', 1],
    ['LOW', 'Late-payment admission', /payment will be late|delay(ed)? (the )?payment|cash flow problem/i, 'MSMED 45-day exposure warning', 1],
    ['INFO', 'Personal-data sharing', /\b\d{10}\b|\baadhaar\b|\bpan card pic\b/i, 'DPDP 2023 — consent & security obligation triggered', 1],
  ];
  for (const [sev, name, rx, why, g] of P) { const m = transcript.match(rx); if (m) add(sev, name, why, m); }
  const score = Math.max(0, 100 - signals.reduce((s, x) => s + ({ HIGH: 30, MEDIUM: 15, LOW: 8, INFO: 4 })[x.severity], 0));
  return { channel_scan: true, risk_score: score, signals_found: signals.length, signals,
    advice: signals.some(s => s.severity === 'HIGH') ? 'Escalate: preserve device backup, do not act on message, refer to vigilance' : 'Informal channel hygiene acceptable' };
}

// ── #40 Verbal vs Written Contract Auditor ─────────────────────
// Compares contract clauses against communication transcripts.
function contractVsVerbal(contract, transcript) {
  const clauses = [];
  const grab = (label, rx, src) => { const m = src.match(rx); return m ? m[0] : null; };
  const pairs = [
    { term: 'Payment terms', cRx: /payment terms?:?\s*([^.;\n]{3,60})/i, vRx: /(pay|payment).{0,30}(\d+\s*days?|\d+\s*weeks?)/i },
    { term: 'Price / rate', cRx: /(price|rate|consideration):?\s*(₹|rs\.?)?\s*([\d,]{3,15})/i, vRx: /(rate|price|cost).{0,20}(₹|rs\.?)?\s?\d{2,}/i },
    { term: 'Delivery timeline', cRx: /deliver(y|ables?)\s*(by|within|on):?\s*([^.;\n]{3,60})/i, vRx: /(deliver|dispatch|ship).{0,30}(\d+\s*days?|[A-Z][a-z]+ \d+)/i },
    { term: 'Penalty / LD', cRx: /(penalt|liquidated damages):?\s*([^.;\n]{3,60})/i, vRx: /(penalt|cut|deduct).{0,30}(\d+(\.\d+)?%|₹\s?\d+)/i },
    { term: 'Quantity / scope', cRx: /quantity:?\s*([\d,]+\s*\w+)/i, vRx: /(\d+)\s*(units?|kg|tons?|pcs)\s*(only|total|needed)/i },
  ];
  let contradictions = 0;
  for (const p of pairs) {
    const c = grab(p.term, p.cRx, contract), v = grab(p.term, p.vRx, transcript);
    if (c && v) {
      const clash = c.toLowerCase().replace(/\s+/g, '') !== v.toLowerCase().replace(/\s+/g, '');
      clauses.push({ term: p.term, contract_clause: c, verbal_statement: v, status: clash ? 'POSSIBLE_CONTRADICTION' : 'CONSISTENT' });
      if (clash) contradictions++;
    } else if (v && !c) clauses.push({ term: p.term, contract_clause: null, verbal_statement: v, status: 'VERBAL_ONLY — not in contract (unenforceable / scope risk)' });
    else if (c && !v) clauses.push({ term: p.term, contract_clause: c, verbal_statement: null, status: 'WRITTEN_ONLY' });
  }
  return { terms_compared: clauses.length, contradictions,
    risk: contradictions ? `⚠️ ${contradictions} term(s) conflict between what was agreed verbally and signed — dispute exposure` : '✅ No material divergence detected',
    clauses, note: 'Heuristic NLP diff; flag for human counsel review where status=POSSIBLE_CONTRADICTION' };
}

// ── #15 Reverse Audit ──────────────────────────────────────────
// Predicts where fraud is most likely BEFORE it occurs using base
// rates from confirmed cases + structural opportunity signals.
function reverseAudit() {
  const db = getDb();
  const vendors = db.prepare('SELECT * FROM vendors').all();
  const confirmedByType = db.prepare(`SELECT fraud_type, COUNT(*) n FROM cases WHERE status='CONFIRMED' GROUP BY fraud_type`).all();
  const baseRate = {}; for (const r of confirmedByType) baseRate[r.fraud_type] = r.n;
  const risks = [];
  for (const v of vendors) {
    const txs = db.prepare('SELECT * FROM transactions WHERE vendor_id=?').all(v.id);
    const nearThreshold = txs.filter(t => t.approval_threshold > 0 && t.amount >= t.approval_threshold * 0.9 && t.amount < t.approval_threshold).length;
    const unverified = v.is_ghost ? 1 : 0;
    const pSplit = Math.min(0.95, 0.05 + nearThreshold * 0.12 + (baseRate.SPLIT_INVOICE ? 0.1 : 0));
    const pGhost = Math.min(0.95, unverified * 0.45 + (baseRate.GHOST_VENDOR ? 0.15 : 0) + (v.ghost_score > 60 ? 0.2 : 0));
    risks.push({ vendor: v.name, vendor_id: v.id,
      predicted: [
        { type: 'SPLIT_INVOICE', probability: +pSplit.toFixed(2), drivers: nearThreshold ? `${nearThreshold} invoices just below approval limit` : 'no threshold clustering' },
        { type: 'GHOST_VENDOR', probability: +pGhost.toFixed(2), drivers: unverified ? 'unverified vendor master' : 'KYC complete' },
      ].filter(x => x.probability >= 0.3).sort((a, b) => b.probability - a.probability) });
  }
  const hotspots = risks.filter(r => r.predicted.length).sort((a, b) => Math.max(...b.predicted.map(p => p.probability)) - Math.max(...a.predicted.map(p => p.probability))).slice(0, 8);
  return { method: 'opportunity-signal scoring × confirmed-case base rates', watchlist: hotspots,
    advice: 'Schedule pre-emptive sampling audits on these vendors this quarter' };
}

// ── #17 Investigator Behavior Cloning ──────────────────────────
// Learns reviewer priorities from case_history feedback and reranks
// the triage queue to match the senior investigator's habits.
function behaviorCloneQueue(userId) {
  const db = getDb();
  // case_history columns: from_status/to_status/note — also fold in
  // reviewer feedback stored on cases themselves (feedback_text).
  const hist = db.prepare(`SELECT ch.to_status AS action, ch.note AS details, c.fraud_type, c.severity, c.confidence
    FROM case_history ch JOIN cases c ON ch.case_id=c.id`).all();
  const fbRows = db.prepare(`SELECT fraud_type, severity, feedback_text AS action FROM cases WHERE feedback_text IS NOT NULL AND feedback_text != ''`).all()
    .map(r => ({ ...r, details: '' }));
  const all = hist.concat(fbRows);
  const confirmWeight = {}, overturnWeight = {};
  for (const h of all) {
    const key = `${h.fraud_type}|${h.severity}`;
    if (/CONFIRM/i.test(h.action || '')) confirmWeight[key] = (confirmWeight[key] || 0) + 1;
    if (/OVERTURN|REJECT|DISMISS/i.test(h.action || '')) overturnWeight[key] = (overturnWeight[key] || 0) + 1;
  }
  const sevRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const open = db.prepare(`SELECT c.*, v.name vendor FROM cases c JOIN vendors v ON v.id=c.vendor_id WHERE c.status IN ('OPEN','ANALYZED')`).all();
  const ranked = open.map(c => {
    const key = `${c.fraud_type}|${c.severity}`;
    const learned = (confirmWeight[key] || 0) * 10 - (overturnWeight[key] || 0) * 8;
    return { ...c, clone_priority: (sevRank[c.severity] || 0) * 5 + (c.confidence || 0) * 3 + learned };
  }).sort((a, b) => b.clone_priority - a.clone_priority);
  return { personalized_for: userId || 'team', training_samples: all.length,
    learned_bias: { confirms: confirmWeight, overturns: overturnWeight },
    queue: ranked.map((c, i) => ({ rank: i + 1, case_id: c.id, vendor: c.vendor, fraud_type: c.fraud_type, severity: c.severity, confidence: c.confidence, priority_score: +c.clone_priority.toFixed(1) })) };
}

// ── #14 Compliance Memory (persistent, cross-session) ──────────
// Vector-free embedding memory: stores case signatures + outcomes,
// recalls analogous past investigations for new cases.
function rememberCase(caseRow, outcome) {
  const db = getDb();
  try { db.exec(`CREATE TABLE IF NOT EXISTS compliance_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT, signature TEXT, fraud_type TEXT, vendor_pattern TEXT,
    outcome TEXT, details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); } catch (e) {}
  const sig = H({ t: caseRow.fraud_type, amt: caseRow.summary });
  db.prepare('INSERT INTO compliance_memory (signature, fraud_type, vendor_pattern, outcome, details) VALUES (?,?,?,?,?)')
    .run(sig, caseRow.fraud_type, caseRow.vendor_pattern || '', outcome, JSON.stringify(caseRow));
  return { stored: true, signature: sig };
}
function recallMemory(caseRow) {
  const db = getDb();
  try { db.exec('SELECT 1 FROM compliance_memory LIMIT 1'); } catch (e) { return { memories: 0, recalled: [] }; }
  const same = db.prepare('SELECT * FROM compliance_memory WHERE fraud_type=? ORDER BY created_at DESC LIMIT 5').all(caseRow.fraud_type);
  const exact = same.filter(m => m.signature === H({ t: caseRow.fraud_type, amt: caseRow.summary }));
  const outcomes = same.reduce((acc, m) => (acc[m.outcome] = (acc[m.outcome] || 0) + 1, acc), {});
  return { memories_with_similar_pattern: same.length, exact_signature_matches: exact.length,
    historical_outcomes: outcomes,
    guidance: same.length ? `Historically ${Object.entries(outcomes).sort((a,b)=>b[1]-a[1])[0][0].toLowerCase()} ${Object.values(outcomes).sort((a,b)=>b-a)[0]}/${same.length} times for ${caseRow.fraud_type} patterns — weigh accordingly` : 'No prior memory for this pattern' };
}

module.exports = {
  complianceDna, behavioralMonitoring, invisibleEmployee, digitalTwin, multiRegulator,
  evidenceDossier, formalizationCoach, regulatoryShock, adShield, darkPatternAudit,
  collateralAudit, hsnCompliance, informalChannelScan, contractVsVerbal,
  reverseAudit, behaviorCloneQueue, rememberCase, recallMemory,
};
