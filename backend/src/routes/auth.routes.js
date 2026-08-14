const express = require('express');
const router = express.Router();
const { login, logout } = require('../controllers/auth.controller');
const { loginValidation } = require('../middleware/validation.middleware');

router.post('/login', loginValidation, login);
router.post('/logout', logout);

module.exports = router;
