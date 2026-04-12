const express = require('express');
const pool    = require('../db');

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/bills — list all bills
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/', async (req, res) => {
  try {
    const { date, customer } = req.query;
    let query  = 'SELECT * FROM bills';
    let params = [];
    let conds  = [];

    if (date) {
      params.push(date);
      conds.push(`DATE(created_at) = $${params.length}`);
    }
    if (customer) {
      params.push(`%${customer}%`);
      conds.push(`customer_name ILIKE $${params.length}`);
    }

    if (conds.length) query += ' WHERE ' + conds.join(' AND ');
    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bills.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/bills/:id — single bill + items
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/:id', async (req, res) => {
  try {
    const bill = await pool.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    if (!bill.rows.length) return res.status(404).json({ error: 'Bill not found.' });

    const items = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id',
      [req.params.id]
    );

    res.json({ ...bill.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bill.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  POST /api/bills — create a new bill
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { customer_name, customer_id, items, gst_percent } = req.body;

    if (!customer_name) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }
    if (!items || !items.length) {
      return res.status(400).json({ error: 'At least one item is required.' });
    }

    const subtotal  = items.reduce((s, i) => s + (i.price * i.quantity), 0);
    const gstPct    = parseFloat(gst_percent) || 0;
    const gstAmount = subtotal * (gstPct / 100);
    const total     = subtotal + gstAmount;

    // Get next sequential bill number from Supabase (works across all devices)
    const seqResult = await pool.query(`SELECT nextval('bill_number_seq') AS num`);
    const billId    = String(seqResult.rows[0].num).padStart(4, '0');

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO bills (id, customer_name, customer_id, gst_percent, gst_amount, subtotal, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [billId, customer_name, customer_id || null, gstPct, gstAmount, subtotal, total]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO bill_items (bill_id, product_id, product_name, type, quantity, price, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [billId, item.product_id || null, item.product_name, item.type || 'Piece', item.quantity, item.price, item.price * item.quantity]
      );
    }

    await client.query('COMMIT');

    const saved      = await pool.query('SELECT * FROM bills WHERE id = $1', [billId]);
    const savedItems = await pool.query('SELECT * FROM bill_items WHERE bill_id = $1', [billId]);

    res.status(201).json({ ...saved.rows[0], items: savedItems.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create bill error:', err.message);
    res.status(500).json({ error: 'Failed to create bill.' });
  } finally {
    client.release();
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DELETE /api/bills/:id
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM bills WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Bill not found.' });
    res.json({ message: 'Bill deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete bill.' });
  }
});

module.exports = router;