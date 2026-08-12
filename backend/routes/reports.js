const express = require('express');
const pool    = require('../db');
const { 
  uploadFullBackupToDrive, 
  downloadBackupFromDrive, 
  restoreBackupFromDrive,
  processPendingBackups,
  getDriveClient
} = require('../googleDriveHelper');

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

    const custCount = await pool.query('SELECT COUNT(*) AS total_customers FROM customers');

    res.json({
      today: today.rows[0],
      allTime: {
        ...allTime.rows[0],
        total_customers: parseInt(custCount.rows[0].total_customers) || 0
      }
    });
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

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await pool.query(`
      SELECT
        DATE(created_at)            AS date,
        COUNT(*)                    AS bill_count,
        COALESCE(SUM(total),0)      AS revenue,
        COALESCE(SUM(gst_amount),0) AS gst,
        COALESCE(SUM(amount_paid),0) AS paid,
        COALESCE(SUM(balance_amount),0) AS outstanding
      FROM bills
      WHERE created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [cutoffDate.toISOString()]);

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/reports/customer-history/:id — get history for a customer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/customer-history/:id', async (req, res) => {
  try {
    const custId = req.params.id;
    const custRes = await pool.query('SELECT * FROM customers WHERE id = $1', [custId]);
    if (!custRes.rows.length) return res.status(404).json({ error: 'Customer not found.' });
    const customer = custRes.rows[0];

    const billsRes = await pool.query(
      `SELECT b.*, c.phone AS customer_phone 
       FROM bills b 
       LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.customer_id = $1 OR b.customer_name ILIKE $2 
       ORDER BY b.created_at DESC`,
      [custId, customer.name]
    );

    const itemsRes = await pool.query(
      `SELECT bi.product_name, MAX(bi.type) as type, SUM(bi.quantity) as total_qty, COUNT(bi.id) as purchases_count
       FROM bill_items bi
       JOIN bills b ON bi.bill_id = b.id
       WHERE b.customer_id = $1 OR b.customer_name ILIKE $2
       GROUP BY bi.product_name
       ORDER BY total_qty DESC
       LIMIT 5`,
      [custId, customer.name]
    );

    res.json({
      customer,
      bills: billsRes.rows,
      topProducts: itemsRes.rows
    });
  } catch (err) {
    console.error('Customer history error:', err.message);
    res.status(500).json({ error: 'Failed to fetch customer history.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/reports/product-analytics — product selling reports
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/product-analytics', async (req, res) => {
  try {
    const { range, start_date, end_date } = req.query;
    
    let dateCondition = '';
    let params = [];
    
    if (range === 'today') {
      dateCondition = 'WHERE b.created_at >= CURRENT_DATE';
    } else if (range === 'week') {
      dateCondition = "WHERE b.created_at >= DATE_TRUNC('week', NOW())";
    } else if (range === 'month') {
      dateCondition = "WHERE b.created_at >= DATE_TRUNC('month', NOW())";
    } else if (range === 'custom' && start_date && end_date) {
      params.push(start_date, end_date);
      dateCondition = 'WHERE b.created_at BETWEEN $1::timestamp AND $2::timestamp + interval \'1 day\'';
    }

    const query = `
      SELECT 
        bi.product_name,
        COALESCE(SUM(bi.quantity), 0) AS quantity_sold,
        COALESCE(SUM(bi.total), 0) AS revenue_generated,
        COUNT(DISTINCT bi.bill_id) AS bill_count
      FROM bill_items bi
      JOIN bills b ON bi.bill_id = b.id
      ${dateCondition}
      GROUP BY bi.product_name
      ORDER BY quantity_sold DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Product analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch product analytics.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/reports/backup-drive-status — get GDrive backup status
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/backup-drive-status', async (req, res) => {
  try {
    const drive = getDriveClient();
    const driveConfigured = !!drive;

    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) AS total_bills,
        COUNT(CASE WHEN backup_status IN ('Backed Up', 'Completed') THEN 1 END) AS backed_up,
        COUNT(CASE WHEN backup_status = 'Pending' THEN 1 END) AS pending,
        COUNT(CASE WHEN backup_status = 'Pending (Waiting for Payment)' THEN 1 END) AS waiting_payment,
        COUNT(CASE WHEN backup_status = 'Failed' THEN 1 END) AS failed
      FROM bills
    `);

    const stats = statsResult.rows[0];
    res.json({
      configured: driveConfigured,
      total_bills: parseInt(stats.total_bills) || 0,
      backed_up: parseInt(stats.backed_up) || 0,
      pending: parseInt(stats.pending) || 0,
      waiting_payment: parseInt(stats.waiting_payment) || 0,
      failed: parseInt(stats.failed) || 0
    });
  } catch (err) {
    console.error('Backup drive status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch backup status.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  POST /api/reports/backup-drive — manual GDrive backup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/backup-drive', async (req, res) => {
  try {
    const drive = getDriveClient();
    if (!drive) {
      return res.status(400).json({ error: 'Google Drive client is not configured.' });
    }

    // 1. Process any pending/failed bill PDFs
    await processPendingBackups();

    // 2. Upload full database JSON backup to GDrive
    const uploadInfo = await uploadFullBackupToDrive();

    res.json({
      message: 'Backup process completed successfully.',
      file_id: uploadInfo.id,
      file_name: uploadInfo.name,
      link: uploadInfo.webViewLink
    });
  } catch (err) {
    console.error('Manual backup error:', err.message);
    res.status(500).json({ error: 'Failed to complete Google Drive backup: ' + err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/reports/backup-drive-list — list database JSON backups from GDrive
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/backup-drive-list', async (req, res) => {
  try {
    const list = await downloadBackupFromDrive();
    res.json(list);
  } catch (err) {
    console.error('List backup files error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve backup list from Google Drive: ' + err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  POST /api/reports/backup-drive-restore — restore database from a GDrive file ID
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/backup-drive-restore', async (req, res) => {
  try {
    const { file_id } = req.body;
    if (!file_id) {
      return res.status(400).json({ error: 'file_id is required' });
    }

    // 1. Download backup JSON payload from Google Drive
    const payload = await restoreBackupFromDrive(file_id);

    // 2. Execute DB restore
    await restoreDatabasePayload(payload);

    res.json({ message: 'Database restored successfully from Google Drive backup.' });
  } catch (err) {
    console.error('GDrive restore error:', err.message);
    res.status(500).json({ error: 'Failed to restore database from Google Drive: ' + err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GET /api/reports/backup-export — export DB JSON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.get('/backup-export', async (req, res) => {
  try {
    const bills = await pool.query('SELECT * FROM bills ORDER BY created_at ASC');
    const billItems = await pool.query('SELECT * FROM bill_items');
    const customers = await pool.query('SELECT * FROM customers ORDER BY created_at ASC');
    const products = await pool.query('SELECT * FROM products ORDER BY created_at ASC');
    const balanceHistory = await pool.query('SELECT * FROM balance_history ORDER BY changed_at ASC');
    
    res.json({
      bills: bills.rows,
      bill_items: billItems.rows,
      customers: customers.rows,
      products: products.rows,
      balance_history: balanceHistory.rows
    });
  } catch (err) {
    console.error('Backup export error:', err.message);
    res.status(500).json({ error: 'Failed to export database backup.' });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  POST /api/reports/backup-import — restore DB JSON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
router.post('/backup-import', async (req, res) => {
  try {
    await restoreDatabasePayload(req.body);
    res.json({ message: 'Database restored successfully.' });
  } catch (err) {
    console.error('Backup import error:', err.message);
    res.status(500).json({ error: 'Failed to restore database: ' + err.message });
  }
});

/**
 * Reusable helper to restore database from backup payload
 */
async function restoreDatabasePayload(payload) {
  const client = await pool.connect();
  try {
    const { bills, bill_items, customers, products, balance_history } = payload;
    
    await client.query('BEGIN');
    
    // Delete all existing data
    await client.query('DELETE FROM balance_history');
    await client.query('DELETE FROM bill_items');
    await client.query('DELETE FROM bills');
    await client.query('DELETE FROM customers');
    await client.query('DELETE FROM products');
    
    // Restore products
    if (products && products.length) {
      for (const p of products) {
        await client.query(
          `INSERT INTO products (id, product_name, type, price, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [p.id, p.product_name, p.type, p.price, p.created_at, p.updated_at]
        );
      }
    }
    
    // Restore customers
    if (customers && customers.length) {
      for (const c of customers) {
        await client.query(
          `INSERT INTO customers (id, name, phone, email, address, notes, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [c.id, c.name, c.phone, c.email, c.address, c.notes, c.created_at]
        );
      }
    }
    
    // Restore bills
    if (bills && bills.length) {
      for (const b of bills) {
        await client.query(
          `INSERT INTO bills (id, customer_name, customer_id, gst_percent, gst_amount, subtotal, total, amount_paid, balance_amount, payment_status, show_balance, pdf_url, previous_balance, created_at, carried_to_bill_id, gd_file_id, gd_file_link, backup_status, backup_date_time) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            b.id, b.customer_name, b.customer_id, b.gst_percent, b.gst_amount, 
            b.subtotal, b.total, b.amount_paid, b.balance_amount, b.payment_status, 
            b.show_balance, b.pdf_url, b.previous_balance, b.created_at,
            b.carried_to_bill_id || null, b.gd_file_id || null, b.gd_file_link || null,
            b.backup_status || 'Pending (Waiting for Payment)', b.backup_date_time || null
          ]
        );
      }
    }
    
    // Restore bill items
    if (bill_items && bill_items.length) {
      for (const bi of bill_items) {
        await client.query(
          `INSERT INTO bill_items (id, bill_id, product_id, product_name, type, quantity, price, total) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [bi.id, bi.bill_id, bi.product_id, bi.product_name, bi.type, bi.quantity, bi.price, bi.total]
        );
      }
    }
    
    // Restore balance history
    if (balance_history && balance_history.length) {
      for (const bh of balance_history) {
        await client.query(
          `INSERT INTO balance_history (id, bill_id, old_balance, new_balance, old_paid, new_paid, note, changed_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [bh.id, bh.bill_id, bh.old_balance, bh.new_balance, bh.old_paid, bh.new_paid, bh.note, bh.changed_at]
        );
      }
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = router;