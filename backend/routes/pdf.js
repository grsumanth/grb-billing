const express = require('express');
const pool = require('../db');
const { generateBillPDF, generateWhatsAppPDF } = require('../pdfHelper');

const router = express.Router();

// ── GET /api/bills/:id/pdf — public PDF download ──
router.get('/:id/pdf', async (req, res) => {
  try {
    const billResult = await pool.query(`
      SELECT b.*, c.phone AS customer_phone 
      FROM bills b 
      LEFT JOIN customers c ON b.customer_id = c.id 
      WHERE b.id = $1
    `, [req.params.id]);

    if (!billResult.rows.length) {
      return res.status(404).send('<h2>Bill not found.</h2>');
    }
    const bill = billResult.rows[0];

    const itemsResult = await pool.query(
      'SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id',
      [req.params.id]
    );
    const items = itemsResult.rows;

    let pdfBuffer;
    if (req.query.template === 'whatsapp') {
      pdfBuffer = await generateWhatsAppPDF(bill, items);
    } else {
      pdfBuffer = await generateBillPDF(bill, items);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="GRB-Bill-${bill.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err.message);
    res.status(500).send('<h2>Failed to generate PDF. Please try again.</h2>');
  }
});

module.exports = router;