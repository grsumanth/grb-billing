const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
require('dotenv').config();

const app = express();

// ── SECURITY: Helmet (secure HTTP headers) ─────────
app.use(helmet({
  contentSecurityPolicy: false, // disabled to allow inline scripts in frontend
  crossOriginEmbedderPolicy: false
}));

// ── SECURITY: CORS ─────────────────────────────────
const allowedOrigins = [
  'https://grb-billing.onrender.com',
  'http://localhost:5000'
];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ── SECURITY: Rate Limiting (general) ──────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', generalLimiter);

// ── SECURITY: Auth Rate Limiting (strict) ──────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 login attempts per 15 min
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ── SECURITY: OTP Rate Limiting ────────────────────
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 OTP requests per hour
  message: { error: 'Too many OTP requests. Please wait an hour.' }
});

// ── SECURITY: SMS Rate Limiting ────────────────────
const smsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // max 20 SMS per hour
  message: { error: 'SMS limit reached. Please try again later.' }
});

// ── Body Parser ────────────────────────────────────
app.use(express.json({ limit: '5mb' })); // increased for profile pic base64
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Serve Frontend ─────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Auth Routes (public + rate limited) ────────────
app.use('/api/auth/login',  authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth', require('./routes/auth'));

// ── Email Routes (OTP rate limited) ────────────────
app.use('/api/email/forgot-password', otpLimiter);
app.use('/api/email', require('./routes/email'));

// ── SMS/WhatsApp Routes ────────────────────────────
app.use('/api/sms', require('./routes/sms'));

// ── Protected API Routes ───────────────────────────
const auth = require('./middleware/auth');
app.use('/api/bills',     auth, require('./routes/bills'));
app.use('/api/customers', auth, require('./routes/customers'));
app.use('/api/products',  auth, require('./routes/products'));
app.use('/api/reports',   auth, require('./routes/reports'));
app.use('/api/profile',   auth, require('./routes/profile'));

// ── PDF Route (public) ─────────────────────────────
app.use('/api/bills', require('./routes/pdf'));

// ── Health Check (public) ──────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'GRB Billing', time: new Date().toISOString() });
});

// ── Global Error Handler ───────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// ── 404 Handler for API ────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// ── Fallback → serve login page ────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Start Server ───────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀  GRB Billing running at http://localhost:${PORT}`);
});

// ── Graceful shutdown ──────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = app;