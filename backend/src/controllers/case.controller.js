const { getDb } = require('../db');
const axios = require('axios');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// POST /api/cases/scan — run detection engine
async function scanCases(req, res) {
  try {
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
            const txIds = JSON.stringify(group.map(t => t.id));
            const confidence = Math.min(95, 60 + group.length * 8);
            const result = db.prepare(
              `INSERT INTO cases (vendor_id, transaction_ids, fraud_type, severity, confidence, status, summary)
               VALUES (?, ?, 'SPLIT_INVOICE', 'HIGH', ?, 'OPEN', ?)`
            ).run(
              vendorId, txIds, confidence,
              `${group.length} invoices to ${vendor.name} totalling ₹${total.toLocaleString('en-IN')} in a 30-day window — each below the ₹${threshold.toLocaleString('en-IN')} approval threshold. Possible threshold-bypass pattern.`
            );
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
                const txIds = JSON.stringify([tx.id, otherTx.id]);
                const vendor2 = vendors.find(v => v.id == otherVendorId);
                const result = db.prepare(
                  `INSERT INTO cases (vendor_id, transaction_ids, fraud_type, severity, confidence, status, summary)
                   VALUES (?, ?, 'ROUND_TRIPPING', 'HIGH', 82, 'OPEN', ?)`
                ).run(
                  vendorId, txIds,
                  `Circular payment detected: ${vendor.name} (₹${tx.amount.toLocaleString('en-IN')}) ↔ ${vendor2?.name || 'Unknown'} (₹${otherTx.amount.toLocaleString('en-IN')}) within ${Math.round(daysDiff)} days. Amounts differ by less than 5%.`
                );
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
          const txIds = JSON.stringify(txList.map(t => t.id));
          const result = db.prepare(
            `INSERT INTO cases (vendor_id, transaction_ids, fraud_type, severity, confidence, status, summary)
             VALUES (?, ?, 'GHOST_VENDOR', 'CRITICAL', ?, 'OPEN', ?)`
          ).run(
            vendorId, txIds, vendor.ghost_score,
            `${vendor.name} flagged as a potential shell/ghost vendor. Ghost score: ${vendor.ghost_score}/100. Issues: ${getGhostIssues(vendor).join(', ')}.`
          );
          cases.push({ id: result.lastInsertRowid, type: 'GHOST_VENDOR', vendor: vendor.name });
        }
      }
    }

    const allCases = db.prepare(`
      SELECT c.*, v.name as vendor_name, v.gstin, v.ghost_score
      FROM cases c LEFT JOIN vendors v ON c.vendor_id = v.id
      ORDER BY c.confidence DESC
    `).all();

    res.json({ scanned: true, newCasesFound: cases.length, cases: allCases });
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
    }, { timeout: 60000 });

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

// POST /api/cases/:id/feedback
function submitFeedback(req, res) {
  const db = getDb();
  const { status } = req.body; // 'CONFIRMED', 'DISMISSED'
  if (!['CONFIRMED', 'DISMISSED'].includes(status)) {
    return res.status(400).json({ error: 'Status must be CONFIRMED or DISMISSED' });
  }
  db.prepare("UPDATE cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, req.params.id);
  res.json({ success: true, status });
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

module.exports = { scanCases, getCases, getCaseById, generateVerdict, getVerdict, submitFeedback };
