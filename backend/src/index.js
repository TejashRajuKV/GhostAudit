const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDb } = require('./db');
const authRoutes = require('./routes/auth.routes');
const caseRoutes = require('./routes/case.routes');
const reportRoutes = require('./routes/report.routes');
const transactionRoutes = require('./routes/transaction.routes');
const vendorRoutes = require('./routes/vendor.routes');

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/vendors', vendorRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'GhostAudit Backend' }));

// Init DB then start server
(async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log(`🚀 GhostAudit backend running on http://localhost:${PORT}`);
  });
})();

