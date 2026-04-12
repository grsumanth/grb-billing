const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const app = express();

// ── Middleware ─────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Serve frontend static files ────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ─────────────────────────────────────
app.use('/api/bills',     require('./routes/bills'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/reports',   require('./routes/reports'));

// ── Health check ───────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'GRB Billing' });
});

// ── Fallback → serve dashboard ─────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
});

// ── Start ──────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀  GRB Billing running at http://localhost:${PORT}`);
});