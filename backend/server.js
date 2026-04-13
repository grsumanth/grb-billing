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

// ── Auth Routes (public) ───────────────────────────
app.use('/api/auth', require('./routes/auth'));

// ── Protected API Routes ───────────────────────────
const auth = require('./middleware/auth');
app.use('/api/bills',     auth, require('./routes/bills'));
app.use('/api/customers', auth, require('./routes/customers'));
app.use('/api/products',  auth, require('./routes/products'));
app.use('/api/reports',   auth, require('./routes/reports'));

// ── Health check (public) ──────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'GRB Billing' });
});

// ── Fallback → serve login page ────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Start ──────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀  GRB Billing running at http://localhost:${PORT}`);
});