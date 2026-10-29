const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const { getNetwork } = require('../controllers/network.controller');

router.get('/', authenticateToken, getNetwork);

module.exports = router;
