process.env.NODE_ENV = 'test';
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION IN TEST:', err);
});
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../server');
const pool = require('../db');

let token = '';
let testUserId = '';
let testCustomerId = '';
let testProductId = '';
let testBillId = '';

const testEmail = `test_user_${Date.now()}@example.com`;
const testPassword = 'Password123!';
const testPhone = `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`;

test.describe('GRB Billing API Integration Tests', () => {

  test.before(async () => {
    console.log('🧹 Preparing database for tests (destructive blanket deletions disabled to protect dev data)...');
  });

  test.after(async () => {
    console.log('🧹 Cleaning up database test records...');
    try {
      // 1. Clean up bill items and bill
      if (testBillId) {
        await pool.query('DELETE FROM bill_items WHERE bill_id = $1', [testBillId]);
        await pool.query('DELETE FROM bills WHERE id = $1', [testBillId]);
      }
      // 2. Clean up product
      if (testProductId) {
        await pool.query('DELETE FROM products WHERE id = $1', [testProductId]);
      }
      // 3. Clean up customer
      if (testCustomerId) {
        await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
      }
      // 4. Clean up user
      if (testUserId) {
        await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
      }
      console.log('✅ Cleanup complete.');
    } catch (err) {
      console.error('❌ Error during test cleanup:', err.message);
    } finally {
      // End pg connection pool so node process exits cleanly
      await pool.end();
    }
  });

  // 1. Health check
  test('GET /api/health should return ok status', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);

    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.app, 'GRB Billing');
  });

  // 2. Authentication - Signup validations
  test('POST /api/auth/signup should reject incomplete payloads', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: testEmail })
      .expect(400);

    assert.ok(res.body.error);
  });

  test('POST /api/auth/signup should create a new user and return a token', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'QA Auditor',
        email: testEmail,
        password: testPassword
      })
      .expect(201);

    assert.ok(res.body.token);
    assert.ok(res.body.user);
    assert.strictEqual(res.body.user.email, testEmail.toLowerCase());
    
    // Save token and user id for subsequent tests
    token = res.body.token;
    testUserId = res.body.user.id;
  });

  // 3. Authentication - Login
  test('POST /api/auth/login should reject invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword'
      })
      .expect(401);

    assert.ok(res.body.error);
  });

  test('POST /api/auth/login should authenticate valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword
      })
      .expect(200);

    assert.ok(res.body.token);
  });

  // 4. Access Control
  test('GET /api/products should reject requests without a valid token', async () => {
    const res = await request(app)
      .get('/api/products')
      .expect(401);

    assert.ok(res.body.error);
  });

  // 5. Products Management
  test('POST /api/products should create a new product when authenticated', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Incense Stick',
        type: 'Box',
        price: 49.99
      })
      .expect(201);

    assert.ok(res.body.id);
    assert.strictEqual(res.body.name, 'Test Incense Stick');
    assert.strictEqual(parseFloat(res.body.price), 49.99);

    testProductId = res.body.id;
  });

  test('POST /api/products should validate price inputs', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Invalid Price Item',
        price: -10
      })
      .expect(400);

    assert.ok(res.body.error);
  });

  // 6. Customers Management
  test('POST /api/customers should register a new customer', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'John Test Customer',
        phone: testPhone,
        email: 'john.test@example.com',
        address: '123 QA Lane'
      })
      .expect(201);

    assert.ok(res.body.id);
    assert.strictEqual(res.body.name, 'John Test Customer');
    assert.strictEqual(res.body.phone, testPhone);

    testCustomerId = res.body.id;
  });

  test('POST /api/customers should enforce phone number uniqueness', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Duplicate Customer',
        phone: testPhone
      })
      .expect(409);

    assert.ok(res.body.error);
  });

  // 7. Billing Flow & Transaction Integrity
  test('POST /api/bills should generate a bill and atomic items', async () => {
    const res = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_name: 'John Test Customer',
        customer_id: testCustomerId,
        gst_percent: 18,
        items: [
          {
            product_id: testProductId,
            product_name: 'Test Incense Stick',
            type: 'Box',
            quantity: 5,
            price: 49.99
          }
        ]
      })
      .expect(201);

    assert.ok(res.body.id);
    assert.strictEqual(res.body.customer_name, 'John Test Customer');
    assert.strictEqual(parseFloat(res.body.gst_percent), 18);
    
    // Subtotal: 5 * 49.99 = 249.95
    // GST Amount: 249.95 * 0.18 = 44.991 -> 44.99
    // Total: 249.95 + 44.99 = 294.94
    assert.strictEqual(parseFloat(res.body.subtotal), 249.95);
    assert.strictEqual(parseFloat(res.body.total), 294.94);
    assert.ok(res.body.items && res.body.items.length === 1);

    testBillId = res.body.id;
  });

  // 8. Balance Entry & Tracking
  test('PUT /api/bills/:id/balance should update bill payment status and balance', async () => {
    const res = await request(app)
      .put(`/api/bills/${testBillId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount_paid: 100.00,
        balance_amount: 194.94,
        note: 'Partial payment received in cash'
      })
      .expect(200);

    assert.strictEqual(parseFloat(res.body.amount_paid), 100.00);
    assert.strictEqual(parseFloat(res.body.balance_amount), 194.94);
    assert.strictEqual(res.body.payment_status, 'partial');
  });

  test('GET /api/bills/:id/balance-history should retrieve log of changes', async () => {
    const res = await request(app)
      .get(`/api/bills/${testBillId}/balance-history`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
    assert.strictEqual(parseFloat(res.body[0].new_balance), 194.94);
    assert.strictEqual(res.body[0].note, 'Partial payment received in cash');
  });

  test('GET /api/reports/outstanding should return bills with balance > 0', async () => {
    const res = await request(app)
      .get('/api/reports/outstanding')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.ok(res.body.bills);
    assert.ok(parseFloat(res.body.total_outstanding) >= 194.94);
    const found = res.body.bills.find(b => b.id === testBillId);
    assert.ok(found);
    assert.strictEqual(parseFloat(found.balance_amount), 194.94);
  });

  test('POST /api/bills should carry forward outstanding balance and mark old bills paid when settled', async () => {
    // 1. Verify endpoint reports outstanding balance for customer
    const oRes = await request(app)
      .get(`/api/bills/customer-outstanding?customer_id=${testCustomerId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.strictEqual(parseFloat(oRes.body.outstanding_balance), 194.94);

    // 2. Post new bill
    const res = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_name: 'John Test Customer',
        customer_id: testCustomerId,
        gst_percent: 0,
        previous_balance: 194.94,
        items: [
          {
            product_id: testProductId,
            product_name: 'Test Incense Stick',
            type: 'Box',
            quantity: 2,
            price: 50.00
          }
        ]
      })
      .expect(201);

    // Items total = 2 * 50.00 = 100.00
    // Previous balance = 194.94
    assert.strictEqual(parseFloat(res.body.previous_balance), 194.94);
    assert.strictEqual(parseFloat(res.body.total), 100.00); // Excludes previous balance
    assert.strictEqual(parseFloat(res.body.balance_amount), 100.00); // Excludes previous balance
    assert.strictEqual(res.body.payment_status, 'unpaid');

    // 3. Verify old bill is untouched at creation time (no blanket zeroing)
    const oldBillRes = await pool.query('SELECT balance_amount, payment_status FROM bills WHERE id = $1', [testBillId]);
    assert.strictEqual(parseFloat(oldBillRes.rows[0].balance_amount), 194.94);
    assert.strictEqual(oldBillRes.rows[0].payment_status, 'partial');

    // 4. Pay the new bill with the full combined outstanding amount (294.94)
    await request(app)
      .put(`/api/bills/${res.body.id}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount_paid: 294.94,
        balance_amount: 0,
        note: 'Full settlement of all outstanding'
      })
      .expect(200);

    // 5. Verify old bill is now cleared/paid via oldest-first distribution
    const oldBillAfterRes = await pool.query('SELECT payment_status, balance_amount FROM bills WHERE id = $1', [testBillId]);
    assert.strictEqual(oldBillAfterRes.rows[0].payment_status, 'paid');
    assert.strictEqual(parseFloat(oldBillAfterRes.rows[0].balance_amount), 0);

    // 6. Verify new bill is paid
    const newBillRes = await pool.query('SELECT payment_status, balance_amount FROM bills WHERE id = $1', [res.body.id]);
    assert.strictEqual(newBillRes.rows[0].payment_status, 'paid');
    assert.strictEqual(parseFloat(newBillRes.rows[0].balance_amount), 0);

    // Clean up second bill too
    await pool.query('DELETE FROM bill_items WHERE bill_id = $1', [res.body.id]);
    await pool.query('DELETE FROM bills WHERE id = $1', [res.body.id]);
  });

});

