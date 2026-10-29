const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireLevel } = require('../middleware/rbac.middleware');
const ctrl = require('../controllers/notification.controller');

router.get('/', authenticateToken, ctrl.listNotifications);
router.post('/', authenticateToken, requireLevel('reviewer'), ctrl.createNotification);
router.post('/read-all', authenticateToken, ctrl.markAllRead);
router.post('/:id/read', authenticateToken, ctrl.markRead);

module.exports = router;
