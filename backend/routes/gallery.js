const express = require('express');
const pool    = require('../db');

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/gallery — list all categories
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, price, images, created_at FROM gallery ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch gallery error:', err.message);
    res.status(500).json({ error: 'Failed to fetch gallery.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/gallery/:id — single category
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, price, images, created_at FROM gallery WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Gallery category not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fetch gallery item error:', err.message);
    res.status(500).json({ error: 'Failed to fetch gallery item.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  POST /api/gallery — create category
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/', async (req, res) => {
  try {
    const { name, price, images } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required.' });
    }
    const parsedPrice = parseFloat(price) || 0;
    const imagesJson = JSON.stringify(images || []);

    const result = await pool.query(
      `INSERT INTO gallery (name, price, images) VALUES ($1, $2, $3) 
       RETURNING id, name, price, images, created_at`,
      [name.trim(), parsedPrice, imagesJson]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create gallery item error:', err.message);
    res.status(500).json({ error: 'Failed to create gallery item.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PUT /api/gallery/:id — update category or images
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.put('/:id', async (req, res) => {
  try {
    const { name, price, images } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required.' });
    }
    const parsedPrice = parseFloat(price) || 0;
    
    // Check if the item exists first
    const checkItem = await pool.query('SELECT id, images FROM gallery WHERE id = $1', [req.params.id]);
    if (!checkItem.rows.length) {
      return res.status(404).json({ error: 'Gallery category not found.' });
    }
    
    // If new images array is supplied, use it; otherwise preserve current images
    const finalImages = images ? JSON.stringify(images) : JSON.stringify(checkItem.rows[0].images || []);

    const result = await pool.query(
      `UPDATE gallery SET name = $1, price = $2, images = $3 WHERE id = $4 
       RETURNING id, name, price, images, created_at`,
      [name.trim(), parsedPrice, finalImages, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update gallery item error:', err.message);
    res.status(500).json({ error: 'Failed to update gallery item.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DELETE /api/gallery/:id — delete category
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM gallery WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Gallery category not found.' });
    res.json({ message: 'Gallery category deleted successfully.' });
  } catch (err) {
    console.error('Delete gallery item error:', err.message);
    res.status(500).json({ error: 'Failed to delete gallery item.' });
  }
});

module.exports = router;
