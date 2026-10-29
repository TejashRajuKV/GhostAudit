const { getDb } = require('../db');
const axios = require('axios');
const { appendAudit } = require('../services/audit.service');
const { broadcast } = require('../controllers/notification.controller');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Core detection engine — shared by HTTP endpoint and scheduler
function runScanCore(userEmail) {
    const db = getDb();

    // Clear old auto-generated cases from previous scans
    db.prepare("DELETE FROM cases WHERE status = 'OPEN' AND id NOT IN (SELECT case_id FROM verdicts)").run();

    const vendors = db.prepare('SELECT * FROM vendors').all();
    const transactions = db.prepare('SELECT * FROM transactions').all();

    const cases = [];

    // --- DETECTION 1: Split Invoice / Round-Tripping ---
    const txByVendor = {};
    for (const tx of transactions) {
      if (!txByVendor[tx.vendor_id]) txByVendor[tx.vendor_id] = [];
      txByVendor[tx.vendor_id].push(tx);
    }

    for (const [vendorId, txList] of Object.entries(txByVendor)) {
      const vendor = vendors.find(v => v.id == vendorId);
      if (!vendor) continue;

      // Group by 30-day window
      const windowGroups = groupByWindow(txList, 30);
      for (const group of windowGroups) {
        if (group.length < 3) continue;
        const total = group.reduce((s, t) => s + t.amount, 0);
        const threshold = group[0].approval_threshold;

        // If each invoice is just below threshold but total far exceeds it
        const allBelowThreshold = group.every(t => t.amount < threshold);
        const totalExceedsThreshold = total > threshold * 1.5;

        if (allBelowThreshold && totalExceedsThreshold) {
          const existing = db.prepare(
            "SELECT id FROM cases WHERE vendor_id = ? AND fraud_type = 'SPLIT_INVOICE'"
          ).get(vendorId);
          if (!existing) {
            const txIdsArray = group.map(t => t.id);
            const txIds = JSON.stringify(txIdsArray);
            const confidence = Math.min(95, 60 + group.length * 8);
            const result = db.prepare(
              `INSERT INTO cases (vendor_id, transaction_ids, fraud_type, severity, confidence, status, summary)
               VALUES (?, ?, 'SPLIT_INVOICE', 'HIGH', ?, 'OPEN', ?)`
            ).run(
              vendorId, txIds, confidence,
              `${group.length} invoices to ${vendor.name} totalling ₹${total.toLocaleString('en-IN')} in a 30-day window — each below the ₹${threshold.toLocaleString('en-IN')} approval threshold. Possible threshold-bypass pattern.`
            );
            db.prepare(`UPDATE transactions SET is_flagged = 1 WHERE id IN (${txIdsArray.map(() => '?').join(',')})`).run(...txIdsArray);
            cases.push({ id: result.lastInsertRowid, type: 'SPLIT_INVOICE', vendor: vendor.name });
          }
        }
      }

      // Round-Tripping: check circular payments between vendors within 7 days
      for (const tx of txList) {
        for (const otherVendorId of Object.keys(txByVendor)) {
          if (otherVendorId == vendorId) continue;
          const otherTxList = txByVendor[otherVendorId];
          for (const otherTx of otherTxList) {
            const daysDiff = Math.abs(new Date(tx.invoice_date) - new Date(otherTx.invoice_date)) / (1000 * 60 * 60 * 24);
            const amountMatch = Math.abs(tx.amount - otherTx.amount) / tx.amount < 0.05; // within 5%
            if (daysDiff <= 7 && amountMatch) {
              const existingCircular = db.prepare(
                "SELECT id FROM cases WHERE vendor_id = ? AND fraud_type = 'ROUND_TRIPPING'"
              ).get(vendorId);
              if (!existingCircular) {
                const txIdsArray = [tx.id, otherTx.id];
                const txIds = JSON.stringify(txIdsArray);
                const vendor2 = vendors.find(v => v.id == otherVendorId);
                const result = db.prepare(
                  `INSERT INTO cases (vendor_id, transaction_ids, fraud_type, severity, confidence, status, summary)
                   VALUES (?, ?, 'ROUND_TRIPPING', 'HIGH', 82, 'OPEN', ?)`
                ).run(
                  vendorId, txIds,
                  `Circular payment detected: ${vendor.name} (₹${tx.amount.toLocaleString('en-IN')}) ↔ ${vendor2?.name || 'Unknown'} (₹${otherTx.amount.toLocaleString('en-IN')}) within ${Math.round(daysDiff)} days. Amounts differ by less than 5%.`
                );
                db.prepare(`UPDATE transactions SET is_flagged = 1 WHERE id IN (?, ?)`).run(...txIdsArray);
                cases.push({ id: result.lastInsertRowid, type: 'ROUND_TRIPPING', vendor: vendor.name });
              }
            }
          }
        }
      }

      // --- DETECTION 2: Ghost Vendor ---
      if (vendor.ghost_score >= 70) {
        const existing = db.prepare(
          "SELECT id FROM cases WHERE vendor_id = ? AND fraud_type = 'GHOST_VENDOR'"
        ).get(vendorId);
        if (!existing) {
          const txIdsArray = txList.map(t => t.id);
          const txIds = JSON.stringify(txIdsArray);
          const result = db.prepare(
            `INSERT INTO cases (vendor_id, transaction_ids, fraud_type, severity, confidence, status, summary)
             VALUES (?, ?, 'GHOST_VENDOR', 'CRITICAL', ?, 'OPEN', ?)`
          ).run(
            vendorId, txIds, vendor.ghost_score,
            `${vendor.name} flagged as a potential shell/ghost vendor. Ghost score: ${vendor.ghost_score}/100. Issues: ${getGhostIssues(vendor).join(', ')}.`
          );
          db.prepare(`UPDATE transactions SET is_flagged = 1 WHERE id IN (${txIdsArray.map(() => '?').join(',')})`).run(...txIdsArray);
          cases.push({ id: result.lastInsertRowid, type: 'GHOST_VENDOR', vendor: vendor.name });
        }
      }
      // --- DETECTION 3: Delayed Payment ---
      for (const tx of txList) {
        if (!tx.payment_date) continue;
        const daysDiff = (new Date(tx.payment_date) - new Date(tx.invoice_date)) / (1000 * 60 * 60 * 24);
        if (daysDiff > 45) {
          const existing = db.prepare(
            "SELECT id FROM cases WHERE vendor_id = ? AND fraud_type = 'DELAYED_PAYMENT'"
          ).get(vendorId);
          if (!existing) {
            const txIdsArray = [tx.id];
            const txIds = JSON.stringify(txIdsArray);
            const result = db.prepare(
              `INSERT INTO cases (vendor_id, transaction_ids, fraud_type, severity, confidence, status, summary)
               VALUES (?, ?, 'DELAYED_PAYMENT', 'MEDIUM', 100, 'OPEN', ?)`
            ).run(
              vendorId, txIds,
              `Payment of ₹${tx.amount.toLocaleString('en-IN')} to ${vendor.name} was made ${Math.round(daysDiff)} days after invoice date, violating the 45-day MSME payment rule.`
            );
            db.prepare(`UPDATE transactions SET is_flagged = 1 WHERE id = ?`).run(tx.id);
            cases.push({ id: result.lastInsertRowid, type: 'DELAYED_PAYMENT', vendor: vendor.name });
          }
        }
      }
    }

    const allCases = db.prepare(`
      SELECT c.*, v.name as vendor_name, v.gstin, v.ghost_score
      FROM cases c LEFT JOIN vendors v ON c.vendor_id = v.id
      ORDER BY c.confidence DESC
    `).all();

    appendAudit('CASE_SCAN', 'system', null, userEmail, { newCases: cases.length, detected: cases.map(c => ({ id: c.id, type: c.type, vendor: c.vendor })) });
    if (cases.length > 0) {
      try { broadcast(`${cases.length} new fraud case(s) detected`, cases.slice(0,3).map(c => `${c.type}: ${c.vendor}`).join(', '), '/dashboard'); } catch (e) { /* non-fatal */ }
    }

    return { newCases: cases, cases: allCases };
}

// POST /api/cases/scan — run detection engine
async function scanCases(req, res) {
  try {
    const result = runScanCore(req.user?.email);
    res.json({ scanned: true, newCasesFound: result.newCases.length, cases: result.cases });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: 'Scan failed', details: err.message });
  }
}

// GET /api/cases
function getCases(req, res) {
  const db = getDb();
  const { sort = 'confidence', order = 'desc', status } = req.query;
  const validSorts = ['confidence', 'severity', 'created_at', 'fraud_type'];
  const sortCol = validSorts.includes(sort) ? sort : 'confidence';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';
  const statusFilter = status ? 'AND c.status = ?' : '';
  const params = status ? [status] : [];

  const cases = db.prepare(`
    SELECT c.*, v.name as vendor_name, v.gstin, v.ghost_score,
           vd.verdict, vd.confidence as verdict_confidence
    FROM cases c
    LEFT JOIN vendors v ON c.vendor_id = v.id
    LEFT JOIN verdicts vd ON c.id = vd.case_id
    WHERE 1=1 ${statusFilter}
    ORDER BY c.${sortCol} ${sortDir}
  `).all(...params);

  res.json(cases);
}

// GET /api/cases/:id
function getCaseById(req, res) {
  const db = getDb();
  const { id } = req.params;
  const c = db.prepare(`
    SELECT c.*, v.name as vendor_name, v.gstin, v.address, v.bank_account, v.ghost_score, v.is_ghost
    FROM cases c LEFT JOIN vendors v ON c.vendor_id = v.id WHERE c.id = ?
  `).get(id);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const txIds = JSON.parse(c.transaction_ids || '[]');
  const transactions = txIds.length
    ? db.prepare(`SELECT * FROM transactions WHERE id IN (${txIds.map(() => '?').join(',')}) ORDER BY invoice_date ASC`).all(...txIds)
    : [];

  const verdict = db.prepare('SELECT * FROM verdicts WHERE case_id = ?').get(id);
  res.json({ ...c, transactions, verdict });
}

// POST /api/cases/:id/verdict — trigger AI Prosecutor via AI service
async function generateVerdict(req, res) {
  const db = getDb();
  const { id } = req.params;

  const caseData = db.prepare(`
    SELECT c.*, v.name as vendor_name, v.gstin, v.address, v.bank_account, v.ghost_score
    FROM cases c LEFT JOIN vendors v ON c.vendor_id = v.id WHERE c.id = ?
  `).get(id);
  if (!caseData) return res.status(404).json({ error: 'Case not found' });

  // Check if verdict already cached
  const existing = db.prepare('SELECT * FROM verdicts WHERE case_id = ?').get(id);
  if (existing && existing.verdict) return res.json(existing);

  const txIds = JSON.parse(caseData.transaction_ids || '[]');
  const transactions = txIds.length
    ? db.prepare(`SELECT * FROM transactions WHERE id IN (${txIds.map(() => '?').join(',')})`).all(...txIds)
    : [];

  try {
    const aiRes = await axios.post(`${AI_SERVICE_URL}/analyze`, {
      case: caseData,
      transactions
    }, { timeout: 180000 });

    const { risk_replay, evidence, defense, verdict, confidence, verdict_reasoning, explanation } = aiRes.data;

    db.prepare(`
      INSERT OR REPLACE INTO verdicts (case_id, risk_replay, evidence, defense, verdict, confidence, verdict_reasoning, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, JSON.stringify(risk_replay), JSON.stringify(evidence), JSON.stringify(defense),
           verdict, confidence, verdict_reasoning, explanation);

    // Update case status
    db.prepare("UPDATE cases SET status = 'ANALYZED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

    res.json(aiRes.data);
  } catch (err) {
    console.error('AI service error:', err.message);
    res.status(502).json({ error: 'AI service unavailable', details: err.message });
  }
}

// GET /api/cases/:id/verdict
function getVerdict(req, res) {
  const db = getDb();
  const verdict = db.prepare('SELECT * FROM verdicts WHERE case_id = ?').get(req.params.id);
  if (!verdict) return res.status(404).json({ error: 'No verdict yet. Call POST first.' });
  res.json(verdict);
}

// POST /api/cases/:id/feedback — human verdict on AI output (feeds calibration loop)
function submitFeedback(req, res) {
  const db = getDb();
  const { status, feedbackText } = req.body; // 'CONFIRMED', 'DISMISSED'
  if (!['CONFIRMED', 'DISMISSED'].includes(status)) {
    return res.status(400).json({ error: 'Status must be CONFIRMED or DISMISSED' });
  }

  const prev = db.prepare('SELECT status FROM cases WHERE id = ?').get(req.params.id);
  if (!prev) return res.status(404).json({ error: 'Case not found' });

  if (feedbackText) {
    db.prepare("UPDATE cases SET status = ?, feedback_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, feedbackText, req.params.id);
  } else {
    db.prepare("UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, req.params.id);
  }

  // Workflow history + hash-chained audit trail
  db.prepare('INSERT INTO case_history (case_id, user_email, from_status, to_status, note) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, req.user?.email || 'system', prev.status, status, feedbackText || null);
  appendAudit('CASE_FEEDBACK', 'case', parseInt(req.params.id), req.user?.email, { from: prev.status, to: status, feedback: feedbackText || null });

  res.json({ success: true, status });
}

// GET /api/cases/accuracy — AI-vs-human agreement calibration stats
function getAccuracy(req, res) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT vd.verdict as ai_verdict, c.status as human_status, COUNT(*) as n
    FROM verdicts vd JOIN cases c ON vd.case_id = c.id
    WHERE c.status IN ('CONFIRMED','DISMISSED')
    GROUP BY vd.verdict, c.status
  `).all();

  let agree = 0, total = 0;
  const matrix = {};
  for (const r of rows) {
    total += r.n;
    const aiSaysGuilty = ['GUILTY', 'HIGH_RISK', 'SUSPECTED'].includes((r.ai_verdict || '').toUpperCase());
    const humanAgrees = (r.human_status === 'CONFIRMED' && aiSaysGuilty) || (r.human_status === 'DISMISSED' && !aiSaysGuilty);
    if (humanAgrees) agree += r.n;
    matrix[`${r.ai_verdict} -> ${r.human_status}`] = r.n;
  }
  res.json({
    samples: total,
    agreementRate: total ? +(agree / total * 100).toFixed(1) : null,
    matrix,
    guidance: total < 5 ? 'Collect more reviewer decisions to calibrate.' :
      (agree / total) >= 0.8 ? 'AI verdicts align with human reviewers at 80%+ — high trust tier.' :
      'Reviewer overrides are frequent — consider raising confidence thresholds before auto-confirmation.'
  });
}

// PUT /api/cases/:id - Update case
function updateCase(req, res) {
  const db = getDb();
  const { id } = req.params;
  const { status, severity, assignedTo, description } = req.body;
  
  const updates = [];
  const values = [];
  
  if (status) {
    updates.push('status = ?');
    values.push(status);
  }
  if (severity) {
    updates.push('severity = ?');
    values.push(severity);
  }
  if (assignedTo !== undefined) {
    updates.push('assigned_to = ?');
    values.push(assignedTo);
  }
  if (description !== undefined) {
    updates.push('summary = ?');
    values.push(description);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  
  try {
    const prev = db.prepare('SELECT status FROM cases WHERE id = ?').get(id);
    db.prepare(`UPDATE cases SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const updatedCase = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
    if (status && prev && prev.status !== status) {
      db.prepare('INSERT INTO case_history (case_id, user_email, from_status, to_status, note) VALUES (?, ?, ?, ?, ?)')
        .run(id, req.user?.email || 'system', prev.status, status, 'Manual transition');
      appendAudit('CASE_STATUS_CHANGE', 'case', parseInt(id), req.user?.email, { from: prev.status, to: status });
    } else {
      appendAudit('CASE_UPDATE', 'case', parseInt(id), req.user?.email, { fields: updates.map(u => u.split(' =')[0]) });
    }
    res.json({ success: true, case: updatedCase });
  } catch (err) {
    console.error('Update case error:', err);
    res.status(500).json({ error: 'Failed to update case', details: err.message });
  }
}

// DELETE /api/cases/:id - Delete case
function deleteCase(req, res) {
  const db = getDb();
  const { id } = req.params;
  
  try {
    db.prepare('DELETE FROM verdicts WHERE case_id = ?').run(id);
    db.prepare('DELETE FROM cases WHERE id = ?').run(id);
    appendAudit('CASE_DELETE', 'case', parseInt(id), req.user?.email, { by: req.user?.role });
    res.json({ success: true, message: 'Case deleted successfully' });
  } catch (err) {
    console.error('Delete case error:', err);
    res.status(500).json({ error: 'Failed to delete case', details: err.message });
  }
}

// --- Helpers ---
function groupByWindow(transactions, days) {
  const sorted = [...transactions].sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date));
  const groups = [];
  let i = 0;
  while (i < sorted.length) {
    const group = [sorted[i]];
    const start = new Date(sorted[i].invoice_date);
    for (let j = i + 1; j < sorted.length; j++) {
      const diff = (new Date(sorted[j].invoice_date) - start) / (1000 * 60 * 60 * 24);
      if (diff <= days) group.push(sorted[j]);
    }
    if (group.length >= 2) groups.push(group);
    i++;
  }
  // Deduplicate groups by first tx id
  const seen = new Set();
  return groups.filter(g => {
    const key = g[0].id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getGhostIssues(vendor) {
  const issues = [];
  if (!vendor.gstin || vendor.gstin.length !== 15 || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(vendor.gstin)) {
    issues.push('Invalid GSTIN format');
  }
  if (!vendor.address || vendor.address.length < 20) issues.push('Incomplete address');
  if (vendor.bank_account && /^(.)\1+$/.test(vendor.bank_account)) issues.push('Suspicious bank account pattern');
  if (issues.length === 0) issues.push('Accumulated behavioral risk signals');
  return issues;
}

// GET /api/cases/:id/history — workflow state transitions
function getCaseHistory(req, res) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM case_history WHERE case_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(rows);
}


// POST /api/cases/:id/playbook — AI-generated remediation playbook
async function generatePlaybook(req, res) {
  const db = getDb();
  const { id } = req.params;
  const caseData = db.prepare(`
    SELECT c.*, v.name as vendor_name FROM cases c LEFT JOIN vendors v ON c.vendor_id = v.id WHERE c.id = ?
  `).get(id);
  if (!caseData) return res.status(404).json({ error: 'Case not found' });

  const txIds = JSON.parse(caseData.transaction_ids || '[]');
  const transactions = txIds.length
    ? db.prepare(`SELECT * FROM transactions WHERE id IN (${txIds.map(() => '?').join(',')})`).all(...txIds)
    : [];

  try {
    const aiRes = await axios.post(`${AI_SERVICE_URL}/playbook`, { case: caseData, transactions }, { timeout: 180000 });
    appendAudit('PLAYBOOK_GENERATED', 'case', parseInt(id), req.user?.email, null);
    res.json(aiRes.data);
  } catch (err) {
    console.error('Playbook error:', err.message);
    res.status(502).json({ error: 'Playbook generation failed', details: err.message });
  }
}

// ── Evidence Locker (tamper-evident attachments) ────────────────
// POST /api/cases/:id/evidence  { filename, mimeType, sizeBytes, contentBase64 }
function uploadEvidence(req, res) {
  const db = getDb();
  const crypto = require('crypto');
  const { filename, mimeType, sizeBytes, contentBase64 } = req.body;
  if (!filename || !contentBase64) return res.status(400).json({ error: 'filename and contentBase64 required' });

  const buf = Buffer.from(contentBase64, 'base64');
  if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'File exceeds 5MB limit' });

  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const fsx = require('fs');
  const pathx = require('path');
  const dir = pathx.resolve(__dirname, '../../../database/evidence/' + req.params.id);
  fsx.mkdirSync(dir, { recursive: true });
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  fsx.writeFileSync(pathx.join(dir, sha256.slice(0, 12) + '_' + safeName), buf);

  const info = db.prepare(`
    INSERT INTO evidence_files (case_id, filename, mime_type, size_bytes, sha256, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, safeName, mimeType || 'application/octet-stream', sizeBytes ?? buf.length, sha256, req.user?.email || 'system');

  appendAudit('EVIDENCE_UPLOAD', 'evidence', Number(info.lastInsertRowid), req.user?.email, { case_id: parseInt(req.params.id), filename: safeName, sha256 });
  res.json({ success: true, id: Number(info.lastInsertRowid), sha256 });
}

// GET /api/cases/:id/evidence
function listEvidence(req, res) {
  const db = getDb();
  const rows = db.prepare('SELECT id, case_id, filename, mime_type, size_bytes, sha256, uploaded_by, created_at FROM evidence_files WHERE case_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(rows);
}

module.exports = { 
  scanCases, 
  getCases, 
  getCaseById, 
  generateVerdict, 
  getVerdict, 
  submitFeedback,
  getAccuracy,
  updateCase,
  deleteCase,
  getCaseHistory,
  generatePlaybook,
  uploadEvidence,
  listEvidence,
  getCaseTimeline
};


// GET /api/v1/cases/:id/timeline — Feature #8 Timeline Investigation + Storyboard (#9)
function getCaseTimeline(req, res) {
  try {
    const db = getDb();
    const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Case not found' });
    const txIds = JSON.parse(c.transaction_ids || '[]');
    const events = [];
    const txs = txIds.length
      ? db.prepare(`SELECT * FROM transactions WHERE id IN (${txIds.map(()=>'?').join(',')}) ORDER BY invoice_date ASC`).all(...txIds)
      : [];
    for (const t of txs) {
      events.push({ date: t.invoice_date, type: 'INVOICE', title: `Invoice ${t.invoice_number} raised`, detail: `₹${Number(t.amount).toLocaleString('en-IN')} · threshold ₹${Number(t.approval_threshold||0).toLocaleString('en-IN')}`, amount: t.amount });
      if (t.payment_date) events.push({ date: t.payment_date, type: 'PAYMENT', title: `Payment made for ${t.invoice_number}`, detail: `Paid ${Math.round((new Date(t.payment_date)-new Date(t.invoice_date))/86400000)} days after invoice`, amount: t.amount });
    }
    const hist = db.prepare('SELECT action, created_at, actor FROM case_history WHERE case_id = ? ORDER BY created_at ASC').all(c.id);
    for (const h of hist) events.push({ date: (h.created_at||'').slice(0,10), type: 'REVIEW', title: h.action, detail: `by ${h.actor||'system'}` });
    events.sort((a,b) => String(a.date).localeCompare(String(b.date)));
    const verdict = db.prepare('SELECT * FROM verdicts WHERE case_id = ?').get(c.id);
    const storyboard = [
      `Act 1 — The Setup: ${c.fraud_type} pattern detected involving vendor #${c.vendor_id ?? '—'} across ${txs.length} transaction(s).`,
      `Act 2 — The Pattern: ${events.filter(e=>e.type==='INVOICE').map(e=>e.title).slice(0,3).join('; ')}.`,
      `Act 3 — The Flag: Case opened with severity ${c.severity || c.risk_score || 'UNKNOWN'} on ${(c.created_at||'').slice(0,10)}.`,
      verdict ? `Act 4 — The Verdict: AI Prosecutor returned "${verdict.verdict}" — ${String(verdict.reasoning||'').slice(0,140)}` : 'Act 4 — Awaiting AI Prosecutor verdict.',
    ];
    res.json({ caseId: Number(c.id), events, storyboard });
  } catch (e) { res.status(500).json({ error: 'Timeline build failed', details: e.message }); }
}

// ── AI Negotiator (Feature #43): draft a clarification email to the vendor ──
async function draftNegotiationEmail(req, res) {
  const db = getDb();
  const { id } = req.params;
  const caseData = db.prepare(`
    SELECT c.*, v.name as vendor_name, v.gstin, v.address FROM cases c
    LEFT JOIN vendors v ON c.vendor_id = v.id WHERE c.id = ?
  `).get(id);
  if (!caseData) return res.status(404).json({ error: 'Case not found' });

  const verdict = db.prepare('SELECT * FROM verdicts WHERE case_id = ?').get(id);
  let explanationText = null;
  if (verdict && verdict.explanation) {
    try { explanationText = JSON.parse(verdict.explanation); } catch (e) { explanationText = verdict.explanation; }
  }

  try {
    const aiRes = await axios.post(`${AI_SERVICE_URL}/negotiate`, {
      case: caseData,
      verdict: verdict ? { verdict: verdict.verdict, confidence: verdict.confidence } : null,
      explanation: explanationText,
      tone: req.body?.tone || 'professional',
    }, { timeout: 180000 });
    appendAudit('NEGOTIATION_DRAFTED', 'case', parseInt(id), req.user?.email, { tone: req.body?.tone || 'professional' });
    res.json(aiRes.data);
  } catch (err) {
    console.error('Negotiation draft error:', err.message);
    res.status(502).json({ error: 'Negotiation drafting failed', details: err.message });
  }
}

module.exports.draftNegotiationEmail = draftNegotiationEmail;
