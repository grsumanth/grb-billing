const express = require('express');
const pool    = require('../db');

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/reports/summary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/summary', async (req, res) => {
  try {
    const today = await pool.query(`
      SELECT
        COUNT(*)                    AS bills_today,
        COALESCE(SUM(total),0)      AS sales_today,
        COALESCE(SUM(gst_amount),0) AS gst_today,
        COALESCE(SUM(amount_paid),0) AS paid_today,
        COALESCE(SUM(balance_amount),0) AS outstanding_today
      FROM bills
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    const allTime = await pool.query(`
      SELECT
        COUNT(*)                    AS total_bills,
        COALESCE(SUM(total),0)      AS total_revenue,
        COALESCE(SUM(gst_amount),0) AS total_gst,
        COALESCE(SUM(amount_paid),0) AS total_paid,
        COALESCE(SUM(balance_amount),0) AS total_outstanding
      FROM bills
    `);

    res.json({ today: today.rows[0], allTime: allTime.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch summary.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/reports/outstanding — bills with balance > 0
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/outstanding', async (req, res) => {
  try {
    const { customer } = req.query;
    let query = `
      SELECT id, customer_name, customer_id, total, amount_paid, 
             balance_amount, payment_status, created_at
      FROM bills
      WHERE balance_amount > 0
    `;
    let params = [];

    if (customer) {
      params.push(`%${customer}%`);
      query += ` AND customer_name ILIKE $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    // Total outstanding
    const totalResult = await pool.query(`
      SELECT COALESCE(SUM(balance_amount), 0) AS total_outstanding
      FROM bills WHERE balance_amount > 0
    `);

    res.json({
      bills: result.rows,
      total_outstanding: totalResult.rows[0].total_outstanding
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch outstanding bills.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/reports/daily?days=30
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/daily', async (req, res) => {
  try {
    let days = 30;
    if (req.query.days !== undefined) {
      const parsed = parseInt(req.query.days, 10);
      if (isNaN(parsed)) {
        return res.status(400).json({ error: 'Days must be a valid number.' });
      }
      days = parsed;
    }
    if (days < 1 || days > 365) {
      return res.status(400).json({ error: 'Days must be between 1 and 365.' });
    }

    const result = await pool.query(`
      SELECT
        DATE(created_at)            AS date,
        COUNT(*)                    AS bill_count,
        COALESCE(SUM(total),0)      AS revenue,
        COALESCE(SUM(gst_amount),0) AS gst,
        COALESCE(SUM(amount_paid),0) AS paid,
        COALESCE(SUM(balance_amount),0) AS outstanding
      FROM bills
      WHERE created_at >= NOW() - MAKE_INTERVAL(days => $1)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [days]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily report.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/reports/top-products?limit=5
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/top-products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const result = await pool.query(`
      SELECT
        product_name,
        SUM(quantity) AS total_qty,
        SUM(total)    AS total_revenue
      FROM bill_items
      GROUP BY product_name
      ORDER BY total_revenue DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch top products.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/reports/recent-bills?limit=5
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/recent-bills', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const result = await pool.query(`
      SELECT id, customer_name, total, gst_amount, amount_paid, balance_amount, payment_status, created_at
      FROM bills
      WHERE DATE(created_at) = CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recent bills.' });
  }
});

module.exports = router;