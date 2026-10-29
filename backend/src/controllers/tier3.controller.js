// Tier 3 advanced-intelligence endpoints controller.
const t3 = require('../services/tier3.service');
const { appendAudit } = require('../services/audit.service');
const wrap = (fn) => (req, res) => {
  try { const out = fn(req, res); if (out && out.error) return res.status(400).json({ error: true, code: out.error, message: out.details || out.error }); }
  catch (e) { return res.status(500).json({ error: true, code: 'TIER3_FAILED', message: e.message }); }
};

const getComplianceDna = wrap((req, res) => {
  const id = parseInt(req.params.vendorId || req.query.vendor_id);
  res.json(t3.complianceDna(id));
});
const getBehavioral = wrap((req, res) => res.json(t3.behavioralMonitoring()));
const getInvisibleEmployee = wrap((req, res) => res.json(t3.invisibleEmployee()));
const getDigitalTwin = wrap((req, res) => res.json(t3.digitalTwin()));
const getMultiRegulator = wrap((req, res) => res.json(t3.multiRegulator()));
const getDossier = wrap((req, res) => res.json(t3.evidenceDossier(parseInt(req.params.vendorId))));
const getCoach = wrap((req, res) => res.json(t3.formalizationCoach(req.query.vendor_id ? parseInt(req.query.vendor_id) : null)));
const runShock = wrap((req, res) => res.json(t3.regulatoryShock(req.body.preset, req.body.custom_days)));
const runAdShield = wrap((req, res) => res.json(t3.adShield(req.body.text || '')));
const runDarkPattern = wrap((req, res) => res.json(t3.darkPatternAudit(req.body.description || '')));
const runCollateral = wrap((req, res) => res.json(t3.collateralAudit(req.body || {})));
const runHsn = wrap((req, res) => res.json(t3.hsnCompliance(Array.isArray(req.body.records) ? req.body.records : [])));
const runChatScan = wrap((req, res) => res.json(t3.informalChannelScan(req.body.transcript || '')));
const runContractDiff = wrap((req, res) => res.json(t3.contractVsVerbal(req.body.contract || '', req.body.transcript || '')));
const getReverseAudit = wrap((req, res) => res.json(t3.reverseAudit()));
const getCloneQueue = wrap((req, res) => res.json(t3.behaviorCloneQueue(req.user?.email)));
const saveMemory = wrap((req, res) => {
  const out = t3.rememberCase(req.body.case || {}, req.body.outcome || 'NOTED');
  appendAudit('MEMORY_STORED', 'compliance_memory', out.signature, req.user?.email, {});
  res.json(out);
});
const recall = wrap((req, res) => res.json(t3.recallMemory(req.body.case || req.query || {})));

module.exports = {
  getComplianceDna, getBehavioral, getInvisibleEmployee, getDigitalTwin, getMultiRegulator,
  getDossier, getCoach, runShock, runAdShield, runDarkPattern, runCollateral, runHsn,
  runChatScan, runContractDiff, getReverseAudit, getCloneQueue, saveMemory, recall,
};
