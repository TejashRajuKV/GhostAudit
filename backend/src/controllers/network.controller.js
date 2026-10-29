const { buildNetwork } = require('../services/network.service');

// GET /api/network — vendor collusion graph data
function getNetwork(req, res) {
  try {
    res.json(buildNetwork());
  } catch (err) {
    res.status(500).json({ error: 'Network build failed', details: err.message });
  }
}

module.exports = { getNetwork };
