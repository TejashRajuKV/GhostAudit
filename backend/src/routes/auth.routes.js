const express = require('express');
const router = express.Router();
const { login, logout, refresh } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { loginValidation } = require('../middleware/validation.middleware');

router.post('/login', loginValidation, login);
router.post('/logout', logout);
router.post('/refresh', authenticateToken, refresh);

module.exports = router;
