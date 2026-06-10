const express = require('express');
const pool    = require('../db');

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/products — list all
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query  = 'SELECT id, product_name, product_name AS name, type, price, created_at, updated_at FROM products';
    let params = [];

    if (search) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(search.trim());
      if (isUuid) {
        query += ' WHERE id = $1';
        params = [search.trim()];
      } else {
        query += ' WHERE product_name ILIKE $1 OR CAST(price AS TEXT) ILIKE $1 OR CAST(id AS TEXT) ILIKE $1 OR type ILIKE $1';
        params = [`%${search}%`];
      }
    }

    query += ' ORDER BY product_name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch products error:', err.message);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/products/:id — single
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, product_name, product_name AS name, type, price, created_at, updated_at FROM products WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  POST /api/products — create
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/', async (req, res) => {
  try {
    const name = req.body.product_name || req.body.name;
    const { type, price } = req.body;

    if (!name || !price || !type) {
      return res.status(400).json({ error: 'Name, price, and unit type are required.' });
    }
    if (!['Piece', 'Box', 'Pack'].includes(type)) {
      return res.status(400).json({ error: 'Unit type must be Piece, Box, or Pack.' });
    }
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Price must be a positive number.' });
    }

    const result = await pool.query(
      `INSERT INTO products (product_name, type, price) VALUES ($1, $2, $3) RETURNING id, product_name, product_name AS name, type, price, created_at, updated_at`,
      [name.trim(), type, parseFloat(price)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err.message);
    res.status(500).json({ error: 'Failed to create product.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PUT /api/products/:id — update
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.put('/:id', async (req, res) => {
  try {
    const name = req.body.product_name || req.body.name;
    const { type, price } = req.body;

    if (!name || !price || !type) {
      return res.status(400).json({ error: 'Name, price, and unit type are required.' });
    }
    if (!['Piece', 'Box', 'Pack'].includes(type)) {
      return res.status(400).json({ error: 'Unit type must be Piece, Box, or Pack.' });
    }

    const result = await pool.query(
      `UPDATE products SET product_name = $1, type = $2, price = $3, updated_at = NOW()
       WHERE id = $4 RETURNING id, product_name, product_name AS name, type, price, created_at, updated_at`,
      [name.trim(), type, parseFloat(price), req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Product not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err.message);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DELETE /api/products/:id
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found.' });
    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product.' });
  }
});

module.exports = router;