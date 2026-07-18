const { getDb } = require('../db');
const axios = require('axios');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// POST /api/reports/generate
async function generateReport(req, res) {
  const db = getDb();
  try {
    const confirmedCases = db.prepare(`
      SELECT c.*, v.name as vendor_name, v.gstin, vd.*
      FROM cases c
      LEFT JOIN vendors v ON c.vendor_id = v.id
      LEFT JOIN verdicts vd ON c.id = vd.case_id
      WHERE c.status IN ('CONFIRMED', 'ANALYZED')
    `).all();

    if (confirmedCases.length === 0) {
      return res.status(400).json({ error: 'No analyzed cases to report. Generate verdicts first.' });
    }

    const aiRes = await axios.post(`${AI_SERVICE_URL}/generate-report`, {
      cases: confirmedCases
    }, { timeout: 90000 });

    const { executive_summary, findings, risk_rating, recommendations } = aiRes.data;
    const caseIds = JSON.stringify(confirmedCases.map(c => c.id));

    const result = db.prepare(`
      INSERT INTO reports (title, executive_summary, findings, risk_rating, recommendations, case_ids)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `GhostAudit Report — ${new Date().toLocaleDateString('en-IN')}`,
      executive_summary,
      JSON.stringify(findings),
      risk_rating,
      JSON.stringify(recommendations),
      caseIds
    );

    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(result.lastInsertRowid);
    res.json(report);
  } catch (err) {
    console.error('Report error:', err.message);
    res.status(502).json({ error: 'Report generation failed', details: err.message });
  }
}

// GET /api/reports
function getReports(req, res) {
  const db = getDb();
  const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
  res.json(reports);
}

// GET /api/reports/:id
function getReportById(req, res) {
  const db = getDb();
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
}

module.exports = { generateReport, getReports, getReportById };
