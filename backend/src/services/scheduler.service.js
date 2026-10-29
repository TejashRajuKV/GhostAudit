// Scheduled batch fraud-scan service.
// Runs the same detection engine as POST /api/v1/cases/scan, without an HTTP request.
const axios = require('axios');
require('dotenv').config();

async function runScheduledScan() {
  // Invoke the scan controller logic by faking a minimal req/res against the route handler.
  // Simpler & robust: call our own HTTP endpoint with a service token if available;
  // otherwise perform detection directly via the shared module.
  const { runScanCore } = require('./scan-core.service');
  const { appendAudit } = require('./audit.service');
  const { broadcast } = require('../controllers/notification.controller');

  const result = runScanCore('scheduler');
  appendAudit('SCHEDULED_SCAN', 'system', null, 'scheduler', { newCases: result.newCases.length });
  if (result.newCases.length > 0) {
    try {
      broadcast(`[Scheduled scan] ${result.newCases.length} new case(s)`, result.newCases.slice(0, 3).map(c => `${c.type}: ${c.vendor}`).join(', '), '/dashboard');
    } catch (e) { /* non-fatal */ }
  }
  console.log(`⏰ Scheduled scan complete — ${result.newCases.length} new case(s)`);
  return result;
}

module.exports = { runScheduledScan };
