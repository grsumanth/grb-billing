const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db');
const auth    = require('../middleware/auth');

const router = express.Router();

// ── GET /api/profile ──────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, role, profile_pic, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// ── PUT /api/profile ──────────────────────────────
router.put('/', auth, async (req, res) => {
  try {
    const { name, phone, profile_pic } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    const result = await pool.query(
      `UPDATE users SET name=$1, phone=$2, profile_pic=$3 WHERE id=$4
       RETURNING id, name, email, phone, role, profile_pic`,
      [name.trim(), phone||null, profile_pic||null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ── PUT /api/profile/password ─────────────────────
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both passwords are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    const user = await pool.query('SELECT password FROM users WHERE id=$1', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, user.rows[0].password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hashed, req.user.id]);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

module.exports = router;