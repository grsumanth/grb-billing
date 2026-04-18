const express = require('express');
const pool    = require('../db');

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/customers — list / search
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query  = 'SELECT * FROM customers';
    let params = [];

    if (search) {
      query  += ' WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1';
      params  = [`%${search}%`];
    }

    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/customers/:id — single
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Customer not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  POST /api/customers — create
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required.' });
    }

    const dup = await pool.query('SELECT id FROM customers WHERE phone = $1', [phone]);
    if (dup.rows.length) {
      return res.status(409).json({ error: 'A customer with this phone number already exists.' });
    }

    const result = await pool.query(
      `INSERT INTO customers (name, phone, email, address, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), phone.trim(), email||null, address||null, notes||null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create customer.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PUT /api/customers/:id — update
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required.' });
    }

    const result = await pool.query(
      `UPDATE customers SET name=$1, phone=$2, email=$3, address=$4, notes=$5
       WHERE id=$6 RETURNING *`,
      [name.trim(), phone.trim(), email||null, address||null, notes||null, req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Customer not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update customer.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DELETE /api/customers/:id
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM customers WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Customer not found.' });
    res.json({ message: 'Customer deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete customer.' });
  }
});

module.exports = router;