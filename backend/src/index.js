const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDb } = require('./db');
const authRoutes = require('./routes/auth.routes');
const caseRoutes = require('./routes/case.routes');
const reportRoutes = require('./routes/report.routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'GhostAudit Backend' }));

// Init DB then start server
(async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log(`🚀 GhostAudit backend running on http://localhost:${PORT}`);
  });
})();

