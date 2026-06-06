const express = require('express');
const pool    = require('../db');
const { generateBillPDF } = require('../pdfHelper');
const { uploadPDF } = require('../supabaseHelper');

const router = express.Router();

// ── Helper: compute payment status from paid/balance ──
function computePaymentStatus(amountPaid, balanceAmount) {
  const paid = parseFloat(amountPaid) || 0;
  const balance = parseFloat(balanceAmount) || 0;
  if (balance <= 0 && paid > 0) return 'paid';
  if (balance > 0 && paid > 0) return 'partial';
  return 'unpaid';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/bills/customer-outstanding — get outstanding balance for a customer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/customer-outstanding', async (req, res) => {
  try {
    const { customer_id, customer_name } = req.query;
    if (!customer_id && !customer_name) {
      return res.status(400).json({ error: 'customer_id or customer_name is required' });
    }
    
    let query = `
      SELECT COALESCE(SUM(balance_amount), 0) AS outstanding_balance
      FROM bills
      WHERE balance_amount > 0
    `;
    let params = [];
    if (customer_id) {
      params.push(customer_id);
      query += ` AND customer_id = $${params.length}`;
    } else {
      params.push(customer_name);
      query += ` AND customer_name = $${params.length}`;
    }
    
    const result = await pool.query(query, params);
    res.json({ outstanding_balance: parseFloat(result.rows[0].outstanding_balance) || 0 });
  } catch (err) {
    console.error('Fetch customer outstanding error:', err.message);
    res.status(500).json({ error: 'Failed to fetch customer outstanding balance.' });
  }
});

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

    const fullBillData = { 
      ...bill.rows[0], 
      items: items.rows,
      is_permanent: true,
      accessed_at: new Date().toISOString()
    };
    
    res.json(fullBillData);
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
    const { customer_name, customer_id, items, gst_percent, show_balance, previous_balance } = req.body;

    if (!customer_name) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }
    if (!items || !items.length) {
      return res.status(400).json({ error: 'At least one item is required.' });
    }

    await client.query('BEGIN');

    const subtotal  = items.reduce((s, i) => s + (i.price * i.quantity), 0);
    const gstPct    = parseFloat(gst_percent) || 0;
    const gstAmount = subtotal * (gstPct / 100);
    const itemsTotal = subtotal + gstAmount;

    const reqPrevBalance = parseFloat(previous_balance) || 0;
    const finalTotal = itemsTotal + reqPrevBalance;

    // Balance fields
    const paid    = 0;
    const balance = finalTotal;
    const showBal = show_balance !== false; // default true
    const status  = 'unpaid';

    // Get next sequential bill number
    const seqResult = await client.query(`SELECT nextval('bill_number_seq') AS num`);
    const billId    = String(seqResult.rows[0].num);

    // 2. Clear/deduct old bills and write logs to balance_history if prev balance is selected
    if (reqPrevBalance > 0) {
      const outstandingRes = await client.query(
        `SELECT id, balance_amount, amount_paid FROM bills
         WHERE (customer_id = $1 OR (customer_id IS NULL AND customer_name = $2))
           AND balance_amount > 0
         ORDER BY created_at ASC`,
        [customer_id || null, customer_name]
      );

      let remainingRollover = reqPrevBalance;
      for (const row of outstandingRes.rows) {
        if (remainingRollover <= 0) break;

        const oldBal = parseFloat(row.balance_amount) || 0;
        const oldPaid = parseFloat(row.amount_paid) || 0;

        if (oldBal <= remainingRollover) {
          // Clear this bill completely
          await client.query(
            `UPDATE bills SET balance_amount = 0, payment_status = 'paid' WHERE id = $1`,
            [row.id]
          );
          await client.query(
            `INSERT INTO balance_history (bill_id, old_balance, new_balance, old_paid, new_paid, note)
             VALUES ($1, $2, 0, $3, $3, $4)`,
            [row.id, oldBal, oldPaid, `Carried forward to Bill #${billId}`]
          );
          remainingRollover -= oldBal;
        } else {
          // Deduct partially from this bill
          const newBal = oldBal - remainingRollover;
          await client.query(
            `UPDATE bills SET balance_amount = $1, payment_status = 'partial' WHERE id = $2`,
            [newBal, row.id]
          );
          await client.query(
            `INSERT INTO balance_history (bill_id, old_balance, new_balance, old_paid, new_paid, note)
             VALUES ($1, $2, $3, $4, $4, $5)`,
            [row.id, oldBal, newBal, oldPaid, `Partially carried forward to Bill #${billId}`]
          );
          remainingRollover = 0;
        }
      }
    }

    // 3. Insert new bill
    await client.query(
      `INSERT INTO bills (id, customer_name, customer_id, gst_percent, gst_amount, subtotal, total, amount_paid, balance_amount, payment_status, show_balance, previous_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [billId, customer_name, customer_id || null, gstPct, gstAmount, subtotal, finalTotal, paid, balance, status, showBal, reqPrevBalance]
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

    // Generate and upload PDF
    let pdfUrl = null;
    try {
      const pdfBuffer = await generateBillPDF(saved.rows[0], savedItems.rows);
      pdfUrl = await uploadPDF(billId, pdfBuffer);
      if (pdfUrl) {
        await pool.query('UPDATE bills SET pdf_url = $1 WHERE id = $2', [pdfUrl, billId]);
        saved.rows[0].pdf_url = pdfUrl;
      }
    } catch (pdfErr) {
      console.error('⚠️ PDF Upload/Generation background error:', pdfErr.message);
    }

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
//  PUT /api/bills/:id/balance — update balance
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.put('/:id/balance', async (req, res) => {
  const client = await pool.connect();
  try {
    const { amount_paid, balance_amount, note } = req.body;
    const billId = req.params.id;

    // Get current bill
    const current = await pool.query('SELECT * FROM bills WHERE id = $1', [billId]);
    if (!current.rows.length) return res.status(404).json({ error: 'Bill not found.' });

    const oldBill   = current.rows[0];
    const newPaid   = parseFloat(amount_paid) || 0;
    const newBal    = parseFloat(balance_amount) || 0;
    const newStatus = computePaymentStatus(newPaid, newBal);

    await client.query('BEGIN');

    // Update bill
    await client.query(
      `UPDATE bills SET amount_paid = $1, balance_amount = $2, payment_status = $3 WHERE id = $4`,
      [newPaid, newBal, newStatus, billId]
    );

    // Log to balance_history
    await client.query(
      `INSERT INTO balance_history (bill_id, old_balance, new_balance, old_paid, new_paid, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [billId, parseFloat(oldBill.balance_amount) || 0, newBal, parseFloat(oldBill.amount_paid) || 0, newPaid, note || null]
    );

    await client.query('COMMIT');

    const updated = await pool.query('SELECT * FROM bills WHERE id = $1', [billId]);
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update balance error:', err.message);
    res.status(500).json({ error: 'Failed to update balance.' });
  } finally {
    client.release();
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/bills/:id/balance-history
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/:id/balance-history', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM balance_history WHERE bill_id = $1 ORDER BY changed_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch balance history.' });
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/bills/:id/full — complete report data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/:id/full', async (req, res) => {
  try {
    const bill = await pool.query('SELECT * FROM bills WHERE id = $1', [req.params.id]);
    if (!bill.rows.length) return res.status(404).json({ error: 'Bill not found.' });

    const items = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id',
      [req.params.id]
    );

    const fullReport = {
      bill: bill.rows[0],
      items: items.rows,
      report_metadata: {
        generated_at: new Date().toISOString(),
        report_id: req.params.id,
        is_permanent: true,
        total_items: items.rows.length,
        grand_total: bill.rows[0].total
      }
    };
    
    res.json(fullReport);
  } catch (err) {
    console.error('Error fetching full report:', err.message);
    res.status(500).json({ error: 'Failed to fetch complete report.' });
  }
});

module.exports = router;