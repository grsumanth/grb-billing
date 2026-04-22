const express = require('express');
const axios   = require('axios');
const pool    = require('../db');
const auth    = require('../middleware/auth');

const router = express.Router();

// ── Format Indian phone number ────────────────────
function formatIndianPhone(phone) {
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');
  // Remove country code if present
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits; // returns 10-digit number
}

// ── POST /api/sms/send-bill ───────────────────────
router.post('/send-bill', auth, async (req, res) => {
  try {
    const { bill_id, phone } = req.body;
    if (!bill_id || !phone) {
      return res.status(400).json({ error: 'Bill ID and phone number are required.' });
    }

    // Format phone
    const digits = formatIndianPhone(phone);
    if (digits.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
    }

    // Fetch bill
    const billResult = await pool.query('SELECT * FROM bills WHERE id = $1', [bill_id]);
    if (!billResult.rows.length) return res.status(404).json({ error: 'Bill not found.' });
    const bill = billResult.rows[0];

    // Fetch items
    const itemsResult = await pool.query(
      'SELECT product_name, quantity, price, total FROM bill_items WHERE bill_id = $1',
      [bill_id]
    );
    const items = itemsResult.rows;

    // Build SMS message
    const itemLines = items.map(i => `${i.product_name} x${i.quantity} = Rs.${parseFloat(i.total).toFixed(0)}`).join(', ');
    const gstLine = parseFloat(bill.gst_amount) > 0 ? ` GST:Rs.${parseFloat(bill.gst_amount).toFixed(0)}` : '';
    const message = `GRB Pooja Items\nBill #${bill.id}\n${itemLines}\nSubtotal:Rs.${parseFloat(bill.subtotal).toFixed(0)}${gstLine}\nTOTAL:Rs.${parseFloat(bill.total).toFixed(0)}\nThank you!`;

    // Send via Fast2SMS
    const response = await axios({
      method: 'get',
      url: 'https://www.fast2sms.com/dev/bulkV2',
      params: {
        authorization: process.env.FAST2SMS_API,
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: digits
      }
    });

    console.log('Fast2SMS response:', response.data);

    if (response.data.return === true) {
      res.json({ message: `Bill SMS sent to +91${digits} successfully.` });
    } else {
      console.error('Fast2SMS error:', response.data);
      res.status(500).json({ error: response.data.message || 'SMS sending failed. Check Fast2SMS balance.' });
    }
  } catch (err) {
    console.error('SMS error:', err.message);
    res.status(500).json({ error: 'Failed to send SMS. Please try again.' });
  }
});

// ── POST /api/sms/whatsapp-link ───────────────────
// Returns a WhatsApp link with bill details pre-filled
router.post('/whatsapp-link', auth, async (req, res) => {
  try {
    const { bill_id, phone } = req.body;
    if (!bill_id || !phone) {
      return res.status(400).json({ error: 'Bill ID and phone are required.' });
    }

    const digits = formatIndianPhone(phone);
    if (digits.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
    }

    // Fetch bill + items
    const billResult = await pool.query('SELECT * FROM bills WHERE id = $1', [bill_id]);
    if (!billResult.rows.length) return res.status(404).json({ error: 'Bill not found.' });
    const bill = billResult.rows[0];

    const itemsResult = await pool.query(
      'SELECT product_name, quantity, price, total FROM bill_items WHERE bill_id = $1',
      [bill_id]
    );
    const items = itemsResult.rows;

    // Build WhatsApp message
    const itemLines = items.map((i,idx) => `${idx+1}. ${i.product_name} x${i.quantity} = ₹${parseFloat(i.total).toFixed(2)}`).join('\n');
    const gstLine = parseFloat(bill.gst_amount) > 0 ? `\nGST (${bill.gst_percent}%): ₹${parseFloat(bill.gst_amount).toFixed(2)}` : '';
    const msg = `🙏 *GRB Pooja Items*\n━━━━━━━━━━━━━━\n*Bill #${bill.id}*\nCustomer: ${bill.customer_name}\n\n*Items:*\n${itemLines}\n━━━━━━━━━━━━━━\nSubtotal: ₹${parseFloat(bill.subtotal).toFixed(2)}${gstLine}\n*TOTAL: ₹${parseFloat(bill.total).toFixed(2)}*\n━━━━━━━━━━━━━━\nThank you for your purchase! 🙏`;

    const waLink = `https://wa.me/91${digits}?text=${encodeURIComponent(msg)}`;
    res.json({ link: waLink });
  } catch (err) {
    console.error('WhatsApp link error:', err.message);
    res.status(500).json({ error: 'Failed to generate WhatsApp link.' });
  }
});

module.exports = router;