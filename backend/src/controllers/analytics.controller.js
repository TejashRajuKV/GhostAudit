const { benfordsLaw, duplicateInvoices, thresholdEvasion, vendorRiskScores, msmeDelayedPayments, complianceDrift, riskForecast, peerBenchmark, shadowProcurement } = require('../services/analytics.service');
const { appendAudit } = require('../services/audit.service');
const { getDb } = require('../db');

// GET /api/analytics/benford?vendor_id=
function getBenford(req, res) {
  try {
    const vendorId = req.query.vendor_id ? parseInt(req.query.vendor_id) : null;
    res.json(benfordsLaw(vendorId));
  } catch (err) {
    res.status(500).json({ error: 'Benford analysis failed', details: err.message });
  }
}

// GET /api/analytics/duplicates
function getDuplicates(req, res) {
  try {
    res.json(duplicateInvoices());
  } catch (err) {
    res.status(500).json({ error: 'Duplicate scan failed', details: err.message });
  }
}

// GET /api/analytics/thresholds
function getThresholds(req, res) {
  try {
    res.json(thresholdEvasion());
  } catch (err) {
    res.status(500).json({ error: 'Threshold analysis failed', details: err.message });
  }
}

// GET /api/analytics/risk-scores
function getRiskScores(req, res) {
  try {
    res.json({ vendors: vendorRiskScores() });
  } catch (err) {
    res.status(500).json({ error: 'Risk scoring failed', details: err.message });
  }
}

// POST /api/analytics/save — persist a run for the evidence record
function saveRun(req, res) {
  try {
    const db = getDb();
    const { run_type, result } = req.body;
    if (!run_type || !result) return res.status(400).json({ error: 'run_type and result required' });
    const info = db.prepare(
      'INSERT INTO analyzer_runs (run_type, result_json, created_by) VALUES (?, ?, ?)'
    ).run(run_type, JSON.stringify(result), req.user?.email || 'system');
    appendAudit('ANALYZER_SAVED', 'analyzer_run', info.lastInsertRowid, req.user?.email, { run_type });
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save run', details: err.message });
  }
}

// GET /api/analytics/runs
function listRuns(req, res) {
  const db = getDb();
  res.json(db.prepare('SELECT id, run_type, created_by, created_at FROM analyzer_runs ORDER BY created_at DESC LIMIT 50').all());
}


// Tier 3 endpoints
function getMsmeDelays(req, res) {
  try { res.json(msmeDelayedPayments()); }
  catch (e) { res.status(500).json({ error: 'MSME delay scan failed', details: e.message }); }
}
function getDrift(req, res) {
  try { res.json(complianceDrift()); }
  catch (e) { res.status(500).json({ error: 'Drift analysis failed', details: e.message }); }
}
function getForecast(req, res) {
  try { res.json(riskForecast()); }
  catch (e) { res.status(500).json({ error: 'Forecast failed', details: e.message }); }
}
function getPeerBenchmark(req, res) {
  try { res.json(peerBenchmark()); }
  catch (e) { res.status(500).json({ error: 'Peer benchmark failed', details: e.message }); }
}
function getShadowProcurement(req, res) {
  try { res.json(shadowProcurement()); }
  catch (e) { res.status(500).json({ error: 'Shadow procurement scan failed', details: e.message }); }
}

module.exports = { getBenford, getDuplicates, getThresholds, getRiskScores, saveRun, listRuns, getMsmeDelays, getDrift, getForecast, getPeerBenchmark, getShadowProcurement };
