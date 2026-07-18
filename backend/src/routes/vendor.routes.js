const express = require('express');
const { getVendors, verifyGst } = require('../controllers/vendor.controller');

const router = express.Router();

router.get('/', getVendors);
router.get('/:id/gst-verify', verifyGst);

module.exports = router;
