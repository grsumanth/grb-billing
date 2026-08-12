const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const pool     = require('../db');

const router = express.Router();

// ── POST /api/auth/signup ──────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { name, username, pin } = req.body;

    if (!name || !username || !pin) {
      return res.status(400).json({ error: 'Name, username and security PIN are required.' });
    }

    const cleanUsername = username.toLowerCase().trim();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }
    if (!/^[a-z0-9_.]+$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username can only contain lowercase letters, numbers, underscores, and dots.' });
    }

    if (!/^\d{4}$|^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'Security PIN must be exactly 4 or 6 digits.' });
    }

    // Check duplicate username
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with this username already exists.' });
    }

    // Hash security PIN as the password
    const hashed = await bcrypt.hash(pin, 12);

    // SECURITY: Always assign 'user' role. Admin must be set via DB directly.
    const result = await pool.query(
      `INSERT INTO users (id, name, username, password, role)
       VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id, name, username, role, created_at`,
      [name.trim(), cleanUsername, hashed, 'user']
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// ── POST /api/auth/login ───────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, pin } = req.body;

    if (!username || !pin) {
      return res.status(400).json({ error: 'Username and security PIN are required.' });
    }

    const cleanUsername = username.toLowerCase().trim();

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [cleanUsername]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid username or security PIN.' });
    }

    const user = result.rows[0];

    // Check PIN
    const match = await bcrypt.compare(pin, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or security PIN.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── GET /api/auth/me ───────────────────────────────
router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json({ user: req.user });
});

// ── POST /api/auth/logout ──────────────────────────
router.post('/logout', (req, res) => {
  // JWT is stateless — client just deletes the token
  res.json({ message: 'Logged out successfully.' });
});

module.exports = router;