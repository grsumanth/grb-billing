const express    = require('express');
const bcrypt     = require('bcryptjs');
const pool       = require('../db');
const { sendOTP, sendBill } = require('../emailHelper');
const auth       = require('../middleware/auth');

const router = express.Router();

// In-memory OTP store { email: { otp, expiry } }
const otpStore = {};

// ── POST /api/email/forgot-password ───────────────
// Send OTP to email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    // Check user exists
    const result = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }

    const user = result.rows[0];

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore[email.toLowerCase()] = { otp, expiry, userId: user.id };

    // Send email
    await sendOTP(user.email, otp, user.name);

    res.json({ message: 'OTP sent to your email. Valid for 10 minutes.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// ── POST /api/email/verify-otp ────────────────────
// Verify OTP
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

  const stored = otpStore[email.toLowerCase()];
  if (!stored) return res.status(400).json({ error: 'No OTP found. Please request again.' });
  if (Date.now() > stored.expiry) {
    delete otpStore[email.toLowerCase()];
    return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
  }
  if (stored.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
  }

  // Mark as verified
  otpStore[email.toLowerCase()].verified = true;
  res.json({ message: 'OTP verified successfully.' });
});

// ── POST /api/email/reset-password ────────────────
// Reset password after OTP verified
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const stored = otpStore[email.toLowerCase()];
    if (!stored || !stored.verified) {
      return res.status(400).json({ error: 'Please verify OTP first.' });
    }
    if (stored.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }
    if (Date.now() > stored.expiry) {
      delete otpStore[email.toLowerCase()];
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    // Hash and update password
    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, stored.userId]);

    // Clean up OTP
    delete otpStore[email.toLowerCase()];

    res.json({ message: 'Password reset successfully. You can now login.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// ── POST /api/email/send-bill ─────────────────────
// Send bill to customer email (protected route)
router.post('/send-bill', auth, async (req, res) => {
  try {
    const { bill_id, to_email } = req.body;
    if (!bill_id || !to_email) {
      return res.status(400).json({ error: 'Bill ID and email are required.' });
    }

    // Fetch bill with items
    const billResult = await pool.query('SELECT * FROM bills WHERE id = $1', [bill_id]);
    if (!billResult.rows.length) return res.status(404).json({ error: 'Bill not found.' });

    const bill = billResult.rows[0];
    const itemsResult = await pool.query('SELECT * FROM bill_items WHERE bill_id = $1', [bill_id]);
    bill.items = itemsResult.rows;

    await sendBill(to_email, bill.customer_name, bill);

    res.json({ message: `Bill sent to ${to_email} successfully.` });
  } catch (err) {
    console.error('Send bill error:', err.message);
    res.status(500).json({ error: 'Failed to send bill. Check email address and try again.' });
  }
});

module.exports = router;