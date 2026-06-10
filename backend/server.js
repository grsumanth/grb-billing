const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
require('dotenv').config();

// ── ENVIRONMENT VARIABLE VALIDATION (Reliability) ──
const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ CRITICAL: Missing required environment variables:\n   ${missingEnv.join('\n   ')}\nServer startup aborted.`);
  process.exit(1);
}

const app = express();

// ── SECURITY: Helmet (secure HTTP headers) ─────────
app.use(helmet({
  contentSecurityPolicy: false, // disabled to allow inline scripts in frontend
  crossOriginEmbedderPolicy: false
}));

// ── SECURITY: CORS ─────────────────────────────────
const allowedOrigins = [
  'https://grb-billing.onrender.com',
  'https://grsumanth.github.io',
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

// ── Observability: Structured Logging ──────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
    };
    console.log(JSON.stringify(logData));
  });
  next();
});

// ── SECURITY: Rate Limiting (general) ──────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test'
});
app.use('/api', generalLimiter);

// ── SECURITY: Auth Rate Limiting (strict) ──────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 login attempts per 15 min
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test'
});

// ── SECURITY: OTP Rate Limiting ────────────────────
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 OTP requests per hour
  message: { error: 'Too many OTP requests. Please wait an hour.' },
  skip: () => process.env.NODE_ENV === 'test'
});


// ── Body Parser ────────────────────────────────────
app.use(express.json({ limit: '5mb' })); // increased for profile pic base64
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Serve Frontend with Cache Control (Scalability) ──
app.use(express.static(path.join(__dirname, '../frontend'), {
  maxAge: '1d', // Cache static assets for 1 day
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache'); // Don't cache HTML files to ensure updates are fetched
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache CSS, JS, images for 1 day
    }
  }
}));

// ── Auth Routes (public + rate limited) ────────────
app.use('/api/auth/login',  authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth', require('./routes/auth'));

// ── Email Routes (OTP rate limited) ────────────────
app.use('/api/email/forgot-password', otpLimiter);
app.use('/api/email', require('./routes/email'));



// ── Protected API Routes ───────────────────────────
const auth = require('./middleware/auth');
app.use('/api/bills',     auth, require('./routes/bills'));
app.use('/api/customers', auth, require('./routes/customers'));
app.use('/api/products',  auth, require('./routes/products'));
app.use('/api/reports',   auth, require('./routes/reports'));
app.use('/api/profile',   auth, require('./routes/profile'));

// ── PDF Route (protected) ──────────────────────────
app.use('/api/bills', auth, require('./routes/pdf'));

// ── Health Check (public) ──────────────────────────
app.get('/api/health', async (req, res) => {
  const start = Date.now();
  let dbStatus = 'unhealthy';
  let dbLatency = null;
  
  try {
    const dbStart = Date.now();
    await require('./db').query('SELECT 1');
    dbLatency = `${Date.now() - dbStart}ms`;
    dbStatus = 'healthy';
  } catch (err) {
    dbStatus = `unhealthy: ${err.message}`;
  }

  const memory = process.memoryUsage();
  res.json({
    status: dbStatus === 'healthy' ? 'ok' : 'error',
    app: 'GRB Billing',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    database: {
      status: dbStatus,
      latency: dbLatency
    },
    system: {
      memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024 * 100) / 100} MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100} MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100} MB`
      },
      nodeVersion: process.version,
      platform: process.platform
    },
    responseTime: `${Date.now() - start}ms`
  });
});

// ── 404 Handler for API ────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// ── Global Error Handler (must be last) ────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// ── Fallback → serve login page ────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Start Server ───────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`🚀  GRB Billing running at http://localhost:${PORT}`);
  });

  // ── Graceful shutdown ──────────────────────────────
  const handleShutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down server gracefully...`);
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason instanceof Error ? reason.message : String(reason));
    process.exit(1);
  });
}

module.exports = app;