const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { initDb } = require('./db');
const authRoutes = require('./routes/auth.routes');
const caseRoutes = require('./routes/case.routes');
const reportRoutes = require('./routes/report.routes');
const transactionRoutes = require('./routes/transaction.routes');
const vendorRoutes = require('./routes/vendor.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const networkRoutes = require('./routes/network.routes');
const notificationRoutes = require('./routes/notification.routes');
const copilotRoutes = require('./routes/copilot.routes');
const tier3Routes = require('./routes/tier3.routes');
const { requestLogger, errorLogger } = require('./middleware/logger.middleware');
const { verifyChain } = require('./services/audit.service');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

const allowedOrigins = ['http://localhost:5173', process.env.FRONTEND_URL];
app.use(cors({ 
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.includes('onrender.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }, 
  credentials: true 
}));

// Parse cookies
app.use(cookieParser());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple in-memory rate limiting for auth endpoints (brute-force protection)
const rateBuckets = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const bucket = rateBuckets.get(key) || [];
    const recent = bucket.filter(t => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: 'Too many requests, slow down' });
    }
    recent.push(now);
    rateBuckets.set(key, recent);
    next();
  };
}
app.use('/api/v1/auth', rateLimit(20, 60 * 1000));

// Request logging
app.use(requestLogger);

// API Versioning - All routes now under /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/cases', caseRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/vendors', vendorRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/network', networkRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/copilot', copilotRoutes);
app.use('/api/v1/intel', tier3Routes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'GhostAudit Backend', version: '1.1.0' }));

// Audit-chain integrity endpoint (admin only)
const { requireRole } = require('./middleware/rbac.middleware');
const { authenticateToken } = require('./middleware/auth.middleware');
app.get('/api/v1/audit/verify', authenticateToken, requireRole('admin'), (req, res) => {
  res.json(verifyChain());
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorLogger);
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// Scheduled batch scans (cron-style): every N hours if SCAN_INTERVAL_HOURS set
let scanTimer = null;
function startScheduler() {
  const hours = parseFloat(process.env.SCAN_INTERVAL_HOURS || '0');
  if (!hours || hours <= 0) return;
  const { runScheduledScan } = require('./services/scheduler.service');
  scanTimer = setInterval(() => {
    console.log(`⏰ Scheduled fraud scan (every ${hours}h)`);
    runScheduledScan().catch(e => console.error('Scheduled scan failed:', e.message));
  }, hours * 3600 * 1000);
  console.log(`⏰ Fraud scanner scheduled every ${hours} hour(s)`);
}

// Init DB then start server
(async () => {
  await initDb();
  // Integrity self-check of the audit chain at boot
  try {
    const check = verifyChain();
    if (!check.valid) console.error(`🚨 AUDIT CHAIN BROKEN at entry #${check.brokenAt}: ${check.reason}`);
    else console.log(`🔗 Audit chain verified OK (${check.checked} entries)`);
  } catch (e) { /* first run — empty chain */ }
  startScheduler();
  app.listen(PORT, () => {
    console.log(`🚀 GhostAudit backend v1.1.0 running on http://localhost:${PORT}`);
  });
})();

