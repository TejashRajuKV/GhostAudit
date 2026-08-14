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
const { requestLogger, errorLogger } = require('./middleware/logger.middleware');

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

// Request logging
app.use(requestLogger);

// API Versioning - All routes now under /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/cases', caseRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/vendors', vendorRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'GhostAudit Backend', version: '1.0.0' }));

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

// Init DB then start server
(async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log(`🚀 GhostAudit backend v1.0.0 running on http://localhost:${PORT}`);
  });
})();

