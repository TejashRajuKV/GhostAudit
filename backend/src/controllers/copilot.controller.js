// "Ask your ledger" — lightweight RAG copilot.
// Retrieves relevant ledger context (vendors, cases, transactions, policy docs)
// with keyword scoring, then sends it to the AI service as grounded context.
const { getDb } = require('../db');
const axios = require('axios');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

function tokenize(q) {
  return q.toLowerCase().replace(/[^a-z0-9₹ ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}

function retrieve(question) {
  const db = getDb();
  const tokens = tokenize(question);
  const context = { vendors: [], cases: [], transactions: [], policies: [] };

  const vendors = db.prepare('SELECT * FROM vendors').all();
  const cases = db.prepare(`SELECT c.*, v.name as vendor_name FROM cases c LEFT JOIN vendors v ON c.vendor_id=v.id`).all();
  const txs = db.prepare(`SELECT t.*, v.name as vendor_name FROM transactions t LEFT JOIN vendors v ON t.vendor_id=v.id ORDER BY invoice_date DESC LIMIT 400`).all();
  const policies = db.prepare('SELECT * FROM policy_docs').all();

  const score = (text) => {
    const lc = (text || '').toLowerCase();
    return tokens.reduce((s, t) => s + (lc.includes(t) ? 1 : 0), 0);
  };

  for (const v of vendors) { const s = score(`${v.name} ${v.address} ${v.gstin}`); if (s > 0) context.vendors.push({ ...v, _score: s }); }
  for (const c of cases) { const s = score(`${c.summary} ${c.fraud_type} ${c.vendor_name} ${c.status}`); if (s > 0) context.cases.push({ id: c.id, vendor_name: c.vendor_name, fraud_type: c.fraud_type, status: c.status, severity: c.severity, confidence: c.confidence, summary: c.summary, _score: s }); }
  for (const t of txs) { const s = score(`${t.description} ${t.invoice_number} ${t.vendor_name}`); if (s > 0) context.transactions.push({ id: t.id, vendor_name: t.vendor_name, amount: t.amount, invoice_number: t.invoice_number, invoice_date: t.invoice_date, description: t.description, is_flagged: t.is_flagged, _score: s }); }
  for (const p of policies) { const s = score(`${p.title} ${p.chunk}`); if (s > 0) context.policies.push({ title: p.title, chunk: p.chunk.slice(0, 500), _score: s }); }

  // Fallback: aggregate stats so generic questions ("what's our total spend?") still work
  const totals = {
    totalTransactions: txs.length,
    flaggedCount: txs.filter(t => t.is_flagged).length,
    openCases: cases.filter(c => ['OPEN', 'ANALYZED'].includes(c.status)).length,
    confirmedCases: cases.filter(c => c.status === 'CONFIRMED').length,
    ghostVendors: vendors.filter(v => v.is_ghost).length,
  };

  const top = (arr, n) => arr.sort((a, b) => b._score - a._score).slice(0, n);
  return {
    vendors: top(context.vendors, 5),
    cases: top(context.cases, 8),
    transactions: top(context.transactions, 15),
    policies: top(context.policies, 4),
    totals,
  };
}

async function askLedger(req, res) {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'question required' });

    const ctx = retrieve(question);

    try {
      const aiRes = await axios.post(`${AI_SERVICE_URL}/ask`, { question, context: ctx }, { timeout: 120000 });
      return res.json({ ...aiRes.data, retrieved: { vendors: ctx.vendors.length, cases: ctx.cases.length, transactions: ctx.transactions.length, policies: ctx.policies.length } });
    } catch (aiErr) {
      // Deterministic fallback answer from retrieved data if AI unavailable
      const lines = [];
      if (ctx.cases.length) lines.push(`Found ${ctx.cases.length} related case(s): ` + ctx.cases.slice(0, 3).map(c => `#${c.id} ${c.vendor_name} (${c.fraud_type}, ${c.status})`).join('; '));
      if (ctx.transactions.length) lines.push(`Related invoices: ` + ctx.transactions.slice(0, 5).map(t => `${t.invoice_number} ₹${t.amount.toLocaleString('en-IN')} (${t.vendor_name})`).join(', '));
      if (ctx.policies.length) lines.push(ctx.policies[0].chunk);
      if (!lines.length) lines.push(`No specific matches. Overview: ${ctx.totals.openCases} open cases, ${ctx.totals.confirmedCases} confirmed, ${ctx.totals.flaggedCount} flagged transactions, ${ctx.totals.ghostVendors} suspected ghost vendors.`);
      return res.json({ answer: lines.join('\n'), _source: 'retrieval-fallback' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Ledger Q&A failed', details: err.message });
  }
}

// POST /api/copilot/policy — ingest policy/compliance text for RAG
function ingestPolicy(req, res) {
  const db = getDb();
  const { title, text } = req.body;
  if (!title || !text) return res.status(400).json({ error: 'title and text required' });
  // naive chunking ~800 chars on sentence boundaries
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) || [text];
  let chunk = '';
  const chunks = [];
  for (const s of sentences) {
    chunk += s.trim() + ' ';
    if (chunk.length >= 800) { chunks.push(chunk.trim()); chunk = ''; }
  }
  if (chunk.trim()) chunks.push(chunk.trim());
  const stmt = db.prepare('INSERT INTO policy_docs (title, chunk) VALUES (?, ?)');
  for (const c of chunks) stmt.run(title, c);
  res.json({ success: true, chunks: chunks.length });
}

// GET /api/copilot/policy
function listPolicies(req, res) {
  const db = getDb();
  res.json(db.prepare('SELECT id, title, substr(chunk,1,120) as preview, created_at FROM policy_docs ORDER BY created_at DESC LIMIT 50').all());
}

module.exports = { askLedger, ingestPolicy, listPolicies };
