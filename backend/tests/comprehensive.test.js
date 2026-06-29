/**
 * GRB Billing — Comprehensive Test Suite
 * ───────────────────────────────────────────────
 * Covers: Reports, Profile, PDF, Email validation,
 * Customer update uniqueness, Products CRUD, Bills edge cases,
 * Security (tokens, input validation), and 404 handling.
 * 
 * Run: node --test tests/comprehensive.test.js
 */

process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../server');
const pool = require('../db');

// ── Shared state ──────────────────────────────────
let token = '';
let testUserId = '';
let testCustomerId = '';
let testCustomerId2 = '';
let testProductId = '';
let testProductId2 = '';
let testBillId = '';
let testBillId2 = '';

const testUsername = `comp_test_${Date.now()}`;
const testPin = '1234';
const testPhone = `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`;
const testPhone2 = `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`;

// ═══════════════════════════════════════════════════
//  TEST SUITE
// ═══════════════════════════════════════════════════
test.describe('GRB Billing — Comprehensive Test Suite', () => {

  test.before(async () => {
    console.log('🧹 Setting up test data...');
  });

  test.after(async () => {
    console.log('🧹 Cleaning up all test records...');
    try {
      if (testBillId2) {
        await pool.query('DELETE FROM balance_history WHERE bill_id = $1', [testBillId2]);
        await pool.query('DELETE FROM bill_items WHERE bill_id = $1', [testBillId2]);
        await pool.query('DELETE FROM bills WHERE id = $1', [testBillId2]);
      }
      if (testBillId) {
        await pool.query('DELETE FROM balance_history WHERE bill_id = $1', [testBillId]);
        await pool.query('DELETE FROM bill_items WHERE bill_id = $1', [testBillId]);
        await pool.query('DELETE FROM bills WHERE id = $1', [testBillId]);
      }
      if (testProductId) await pool.query('DELETE FROM products WHERE id = $1', [testProductId]);
      if (testProductId2) await pool.query('DELETE FROM products WHERE id = $1', [testProductId2]);
      if (testCustomerId) await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
      if (testCustomerId2) await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId2]);
      if (testUserId) await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
      console.log('✅ Cleanup complete.');
    } catch (err) {
      console.error('❌ Cleanup error:', err.message);
    } finally {
      await pool.end();
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SECTION 1: HEALTH & INFRASTRUCTURE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test('GET /api/health — should return health details with db status', async () => {
    const res = await request(app).get('/api/health').expect(200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.app, 'GRB Billing');
    assert.ok(res.body.database);
    assert.strictEqual(res.body.database.status, 'healthy');
    assert.ok(res.body.database.latency);
    assert.ok(res.body.system);
    assert.ok(res.body.system.memory);
    assert.ok(res.body.system.nodeVersion);
    assert.ok(res.body.uptime);
    assert.ok(res.body.timestamp);
  });

  test('GET /api/nonexistent — should return 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/nonexistent').expect(404);
    assert.ok(res.body.error);
    assert.ok(res.body.error.includes('not found'));
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SECTION 2: AUTHENTICATION & SECURITY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test('POST /api/auth/signup — should reject missing fields', async () => {
    await request(app).post('/api/auth/signup').send({}).expect(400);
    await request(app).post('/api/auth/signup').send({ username: 'abc' }).expect(400);
    await request(app).post('/api/auth/signup').send({ name: 'x', username: 'abc' }).expect(400);
  });

  test('POST /api/auth/signup — should reject invalid PIN format', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ name: 'Test', username: 'testuser', pin: '123' })
      .expect(400);
    assert.ok(res.body.error.includes('PIN must be exactly 4 or 6 digits'));
  });

  test('POST /api/auth/signup — should reject invalid username format', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ name: 'Test', username: 'not a user', pin: '1234' })
      .expect(400);
    assert.ok(res.body.error.includes('Username can only contain'));
  });

  test('POST /api/auth/signup — should create user with role=user (never admin)', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ name: 'Comp Tester', username: testUsername, pin: testPin, role: 'admin' })
      .expect(201);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, 'user'); // role must always be 'user'
    token = res.body.token;
    testUserId = res.body.user.id;
  });

  test('POST /api/auth/signup — should reject duplicate username', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ name: 'Dup', username: testUsername, pin: testPin })
      .expect(409);
    assert.ok(res.body.error.includes('already exists'));
  });

  test('POST /api/auth/login — should reject missing fields', async () => {
    await request(app).post('/api/auth/login').send({}).expect(400);
    await request(app).post('/api/auth/login').send({ username: testUsername }).expect(400);
  });

  test('POST /api/auth/login — should reject wrong PIN', async () => {
    await request(app).post('/api/auth/login')
      .send({ username: testUsername, pin: '9999' }).expect(401);
  });

  test('POST /api/auth/login — should reject nonexistent username', async () => {
    await request(app).post('/api/auth/login')
      .send({ username: 'nobody', pin: testPin }).expect(401);
  });

  test('POST /api/auth/login — should authenticate with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ username: testUsername, pin: testPin }).expect(200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.username, testUsername.toLowerCase());
    token = res.body.token;
  });

  test('Security — should reject requests with no token', async () => {
    await request(app).get('/api/products').expect(401);
    await request(app).get('/api/customers').expect(401);
    await request(app).get('/api/bills').expect(401);
    await request(app).get('/api/reports/summary').expect(401);
    await request(app).get('/api/profile').expect(401);
  });

  test('Security — should reject requests with invalid token', async () => {
    const res = await request(app).get('/api/products')
      .set('Authorization', 'Bearer invalid.token.here').expect(401);
    assert.ok(res.body.error);
  });

  test('Security — should reject requests with malformed Authorization header', async () => {
    await request(app).get('/api/products')
      .set('Authorization', 'NotBearer token').expect(401);
  });

  test('GET /api/auth/me — should return authenticated user info', async () => {
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(res.body.user);
    assert.strictEqual(res.body.user.username, testUsername.toLowerCase());
  });

  test('POST /api/auth/logout — should return success message', async () => {
    const res = await request(app).post('/api/auth/logout').expect(200);
    assert.ok(res.body.message.includes('Logged out'));
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SECTION 3: PRODUCTS CRUD
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test('POST /api/products — should reject missing fields', async () => {
    await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Only Name' }).expect(400);
  });

  test('POST /api/products — should reject invalid type', async () => {
    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad Type', type: 'Bucket', price: 10 }).expect(400);
    assert.ok(res.body.error.includes('Piece, Box, or Pack'));
  });

  test('POST /api/products — should reject negative price', async () => {
    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Neg Price', type: 'Piece', price: -5 }).expect(400);
    assert.ok(res.body.error.includes('positive'));
  });

  test('POST /api/products — should create a valid product', async () => {
    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_name: 'Camphor Pack', type: 'Pack', price: 85.50 })
      .expect(201);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.product_name, 'Camphor Pack');
    assert.strictEqual(res.body.type, 'Pack');
    assert.strictEqual(parseFloat(res.body.price), 85.50);
    testProductId = res.body.id;
  });

  test('POST /api/products — should create a second product', async () => {
    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Kumkum Box', type: 'Box', price: 25.00 })
      .expect(201);
    testProductId2 = res.body.id;
  });

  test('GET /api/products — should list all products', async () => {
    const res = await request(app).get('/api/products')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 2);
  });

  test('GET /api/products?search= — should filter by name', async () => {
    const res = await request(app).get('/api/products?search=Camphor')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(res.body.length >= 1);
    assert.ok(res.body.some(p => p.product_name === 'Camphor Pack'));
  });

  test('GET /api/products/:id — should return single product', async () => {
    const res = await request(app).get(`/api/products/${testProductId}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.strictEqual(res.body.id, testProductId);
    assert.strictEqual(res.body.product_name, 'Camphor Pack');
  });

  test('GET /api/products/:id — should 404 for nonexistent product', async () => {
    await request(app).get('/api/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`).expect(404);
  });

  test('PUT /api/products/:id — should update product', async () => {
    const res = await request(app).put(`/api/products/${testProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ product_name: 'Camphor Premium', type: 'Pack', price: 99.00 })
      .expect(200);
    assert.strictEqual(res.body.product_name, 'Camphor Premium');
    assert.strictEqual(parseFloat(res.body.price), 99.00);
  });

  test('PUT /api/products/:id — should reject invalid type on update', async () => {
    await request(app).put(`/api/products/${testProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Camphor', type: 'Jar', price: 99 }).expect(400);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SECTION 4: CUSTOMERS CRUD + PHONE UNIQUENESS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test('POST /api/customers — should reject missing name or phone', async () => {
    await request(app).post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'No Phone' }).expect(400);
    await request(app).post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '1234567890' }).expect(400);
  });

  test('POST /api/customers — should create customer', async () => {
    const res = await request(app).post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ravi Kumar', phone: testPhone, email: 'ravi@test.com', address: '456 Temple St', notes: 'Regular customer' })
      .expect(201);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.name, 'Ravi Kumar');
    testCustomerId = res.body.id;
  });

  test('POST /api/customers — should create second customer', async () => {
    const res = await request(app).post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Priya Sharma', phone: testPhone2 })
      .expect(201);
    testCustomerId2 = res.body.id;
  });

  test('POST /api/customers — should reject duplicate phone on create', async () => {
    await request(app).post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Duplicate', phone: testPhone }).expect(409);
  });

  test('GET /api/customers — should list all customers', async () => {
    const res = await request(app).get('/api/customers')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 2);
  });

  test('GET /api/customers?search= — should search by name', async () => {
    const res = await request(app).get('/api/customers?search=Ravi')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(res.body.some(c => c.name === 'Ravi Kumar'));
  });

  test('GET /api/customers/:id — should return single customer', async () => {
    const res = await request(app).get(`/api/customers/${testCustomerId}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.strictEqual(res.body.name, 'Ravi Kumar');
  });

  test('PUT /api/customers/:id — should update customer details', async () => {
    const res = await request(app).put(`/api/customers/${testCustomerId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ravi Kumar Updated', phone: testPhone, email: 'ravi.new@test.com', address: '789 New St' })
      .expect(200);
    assert.strictEqual(res.body.name, 'Ravi Kumar Updated');
    assert.strictEqual(res.body.email, 'ravi.new@test.com');
  });

  test('PUT /api/customers/:id — should allow keeping own phone number', async () => {
    const res = await request(app).put(`/api/customers/${testCustomerId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ravi Kumar', phone: testPhone })
      .expect(200);
    assert.strictEqual(res.body.phone, testPhone);
  });

  test('PUT /api/customers/:id — should reject duplicate phone on update', async () => {
    const res = await request(app).put(`/api/customers/${testCustomerId2}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Priya', phone: testPhone }) // phone belongs to customer 1
      .expect(409);
    assert.ok(res.body.error.includes('phone number already exists'));
  });

  test('GET /api/customers/:id — should 404 for nonexistent customer', async () => {
    await request(app).get('/api/customers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`).expect(404);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SECTION 5: BILLING — CREATION, ITEMS, EDGE CASES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test('POST /api/bills — should reject missing customer name', async () => {
    await request(app).post('/api/bills')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product_name: 'X', type: 'Piece', quantity: 1, price: 10 }] })
      .expect(400);
  });

  test('POST /api/bills — should reject empty items array', async () => {
    await request(app).post('/api/bills')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_name: 'Nobody', items: [] })
      .expect(400);
  });

  test('POST /api/bills — should reject missing items field', async () => {
    await request(app).post('/api/bills')
      .set('Authorization', `Bearer ${token}`)
      .send({ customer_name: 'Nobody' })
      .expect(400);
  });

  test('POST /api/bills — should create bill with GST and multiple items', async () => {
    const res = await request(app).post('/api/bills')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_name: 'Ravi Kumar',
        customer_id: testCustomerId,
        gst_percent: 5,
        show_balance: true,
        previous_balance: 0,
        items: [
          { product_id: testProductId, product_name: 'Camphor Premium', type: 'Pack', quantity: 3, price: 99.00 },
          { product_id: testProductId2, product_name: 'Kumkum Box', type: 'Box', quantity: 2, price: 25.00 }
        ]
      }).expect(201);

    // Subtotal: (3*99) + (2*25) = 297 + 50 = 347
    // GST: 347 * 0.05 = 17.35
    // Total: 347 + 17.35 = 364.35
    assert.ok(res.body.id);
    assert.strictEqual(res.body.customer_name, 'Ravi Kumar');
    assert.strictEqual(parseFloat(res.body.subtotal), 347.00);
    assert.strictEqual(parseFloat(res.body.gst_amount), 17.35);
    assert.strictEqual(parseFloat(res.body.total), 364.35);
    assert.strictEqual(res.body.payment_status, 'unpaid');
    assert.strictEqual(parseFloat(res.body.balance_amount), 364.35);
    assert.strictEqual(parseFloat(res.body.amount_paid), 0);
    assert.ok(res.body.items && res.body.items.length === 2);
    testBillId = res.body.id;
  });

  test('POST /api/bills — should create bill without GST', async () => {
    const res = await request(app).post('/api/bills')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer_name: 'Priya Sharma',
        customer_id: testCustomerId2,
        gst_percent: 0,
        items: [
          { product_name: 'Kumkum Box', type: 'Box', quantity: 1, price: 25.00 }
        ]
      }).expect(201);

    assert.strictEqual(parseFloat(res.body.gst_amount), 0);
    assert.strictEqual(parseFloat(res.body.total), 25.00);
    testBillId2 = res.body.id;
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SECTION 6: BILLS — READ, DETAIL, FILTER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test('GET /api/bills — should list all bills', async () => {
    const res = await request(app).get('/api/bills')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 2);
  });

  test('GET /api/bills?customer= — should filter by customer name', async () => {
    const res = await request(app).get('/api/bills?customer=Ravi')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(res.body.every(b => b.customer_name.includes('Ravi')));
  });

  test('GET /api/bills/:id — should return bill with items', async () => {
    const res = await request(app).get(`/api/bills/${testBillId}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.strictEqual(res.body.id, testBillId);
    assert.ok(res.body.items);
    assert.strictEqual(res.body.items.length, 2);
  });

  test('GET /api/bills/:id — should 404 for nonexistent bill', async () => {
    await request(app).get('/api/bills/99999')
      .set('Authorization', `Bearer ${token}`).expect(404);
  });

  test('GET /api/bills/:id/full — should return full report data', async () => {
    const res = await request(app).get(`/api/bills/${testBillId}/full`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(res.body.bill);
    assert.ok(res.body.items);
    assert.ok(res.body.report_metadata);
    assert.strictEqual(res.body.report_metadata.total_items, 2);
  });

  test('GET /api/bills/customer-outstanding — should return outstanding balance', async () => {
    const res = await request(app)
      .get(`/api/bills/customer-outstanding?customer_id=${testCustomerId}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.strictEqual(parseFloat(res.body.outstanding_balance), 364.35);
  });

  test('GET /api/bills/customer-outstanding — should support customer_name param', async () => {
    const res = await request(app)
      .get(`/api/bills/customer-outstanding?customer_name=Ravi Kumar`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(parseFloat(res.body.outstanding_balance) >= 364.35);
  });

  test('GET /api/bills/customer-outstanding — should reject missing params', async () => {
    await request(app).get('/api/bills/customer-outstanding')
      .set('Authorization', `Bearer ${token}`).expect(400);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SECTION 7: BALANCE & PAYMENT TRACKING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test('PUT /api/bills/:id/balance — should accept partial payment', async () => {
    const res = await request(app).put(`/api/bills/${testBillId}/balance`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount_paid: 150, balance_amount: 214.35, note: 'Cash partial' })
      .expect(200);
    assert.strictEqual(res.body.payment_status, 'partial');
  });

  test('GET /api/bills/:id/balance-history — should have audit trail', async () => {
    const res = await request(app).get(`/api/bills/${testBillId}/balance-history`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
    const latest = res.body[0];
    assert.ok(latest.changed_at);
    assert.ok(latest.note);
  });

  test('PUT /api/bills/:id/balance — should 404 for nonexistent bill', async () => {
    await request(app).put('/api/bills/99999/balance')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount_paid: 10, balance_amount: 0 })
      .expect(404);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SECTION 8: REPORTS API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test('GET /api/reports/summary — should return today and allTime stats', async () => {
    const res = await request(app).get('/api/reports/summary')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(res.body.today);
    assert.ok(res.body.allTime);
    assert.ok(res.body.today.bills_today !== undefined);
    assert.ok(res.body.today.sales_today !== undefined);
    assert.ok(res.body.today.gst_today !== undefined);
    assert.ok(res.body.allTime.total_bills !== undefined);
    assert.ok(res.body.allTime.total_revenue !== undefined);
    assert.ok(res.body.allTime.total_outstanding !== undefined);
  });

  test('GET /api/reports/outstanding — should list outstanding bills', async () => {
    const res = await request(app).get('/api/reports/outstanding')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(res.body.bills);
    assert.ok(Array.isArray(res.body.bills));
    assert.ok(res.body.total_outstanding !== undefined);
    assert.ok(parseFloat(res.body.total_outstanding) > 0);
  });

  test('GET /api/reports/outstanding?customer= — should filter by customer', async () => {
    const res = await request(app).get('/api/reports/outstanding?customer=Ravi')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(res.body.bills.every(b => b.customer_name.toLowerCase().includes('ravi')));
  });

  test('GET /api/reports/daily — should return daily breakdown', async () => {
    const res = await request(app).get('/api/reports/daily?days=7')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(Array.isArray(res.body));
    if (res.body.length > 0) {
      assert.ok(res.body[0].date);
      assert.ok(res.body[0].bill_count !== undefined);
      assert.ok(res.body[0].revenue !== undefined);
    }
  });

  test('GET /api/reports/daily — should reject invalid days param', async () => {
    await request(app).get('/api/reports/daily?days=0')
      .set('Authorization', `Bearer ${token}`).expect(400);
    await request(app).get('/api/reports/daily?days=999')
      .set('Authorization', `Bearer ${token}`).expect(400);
  });

  test('GET /api/reports/top-products — should return top products by revenue', async () => {
    const res = await request(app).get('/api/reports/top-products?limit=3')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(Array.isArray(res.body));
    if (res.body.length > 0) {
      assert.ok(res.body[0].product_name);
      assert.ok(res.body[0].total_qty !== undefined);
      assert.ok(res.body[0].total_revenue !== undefined);
    }
  });

  test('GET /api/reports/recent-bills — should return recent bills from today', async () => {
    const res = await request(app).get('/api/reports/recent-bills?limit=5')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(Array.isArray(res.body));
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SECTION 9: PROFILE MANAGEMENT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test('GET /api/profile — should return user profile', async () => {
    const res = await request(app).get('/api/profile')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(res.body.id);
    assert.strictEqual(res.body.username, testUsername.toLowerCase());
    assert.strictEqual(res.body.name, 'Comp Tester');
    assert.ok(!res.body.password); // password must never be returned
  });

  test('PUT /api/profile — should update name and phone', async () => {
    const res = await request(app).put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Tester', phone: '9876543210' })
      .expect(200);
    assert.strictEqual(res.body.name, 'Updated Tester');
    assert.strictEqual(res.body.phone, '9876543210');
  });

  test('PUT /api/profile — should reject missing name', async () => {
    await request(app).put('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '123' }).expect(400);
  });

  test('PUT /api/profile/password — should reject missing fields', async () => {
    await request(app).put('/api/profile/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: testPin }).expect(400);
  });

  test('PUT /api/profile/password — should reject invalid new PIN', async () => {
    const res = await request(app).put('/api/profile/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: testPin, newPin: '12' }).expect(400);
    assert.ok(res.body.error.includes('must be exactly 4 or 6 digits'));
  });

  test('PUT /api/profile/password — should reject wrong current PIN', async () => {
    await request(app).put('/api/profile/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '9999', newPin: '5678' }).expect(401);
  });

  test('PUT /api/profile/password — should change PIN successfully', async () => {
    const res = await request(app).put('/api/profile/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: testPin, newPin: '5678' })
      .expect(200);
    assert.ok(res.body.message.includes('successfully'));

    // Verify login with new PIN works
    const loginRes = await request(app).post('/api/auth/login')
      .send({ username: testUsername, pin: '5678' }).expect(200);
    assert.ok(loginRes.body.token);
    token = loginRes.body.token; // refresh token
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SECTION 10: PDF GENERATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test('GET /api/bills/:id/pdf — should return a valid PDF buffer', async () => {
    const res = await request(app).get(`/api/bills/${testBillId}/pdf`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.strictEqual(res.headers['content-type'], 'application/pdf');
    assert.ok(res.headers['content-length']);
    assert.ok(parseInt(res.headers['content-length']) > 100); // PDF must have content
    // PDF files start with %PDF
    assert.ok(res.body.toString().startsWith('%PDF'));
  });

  test('GET /api/bills/:id/pdf — should 404 for nonexistent bill', async () => {
    await request(app).get('/api/bills/99999/pdf')
      .set('Authorization', `Bearer ${token}`).expect(404);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  SECTION 12: DELETION & CLEANUP ROUTES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test('DELETE /api/products/:id — should 404 for nonexistent product', async () => {
    await request(app).delete('/api/products/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`).expect(404);
  });

  test('DELETE /api/customers/:id — should 404 for nonexistent customer', async () => {
    await request(app).delete('/api/customers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`).expect(404);
  });

  test('DELETE /api/bills/:id — should 404 for nonexistent bill', async () => {
    await request(app).delete('/api/bills/99999')
      .set('Authorization', `Bearer ${token}`).expect(404);
  });

  test('DELETE /api/bills/:id — should delete bill and cascade to items', async () => {
    // Delete bill 2
    const res = await request(app).delete(`/api/bills/${testBillId2}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(res.body.message.includes('deleted'));

    // Verify bill items were also deleted (cascade)
    const items = await pool.query('SELECT * FROM bill_items WHERE bill_id = $1', [testBillId2]);
    assert.strictEqual(items.rows.length, 0);

    testBillId2 = ''; // prevent double cleanup
  });

  test('DELETE /api/products/:id — should delete product', async () => {
    const res = await request(app).delete(`/api/products/${testProductId2}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.ok(res.body.message.includes('deleted'));
    testProductId2 = ''; // prevent double cleanup
  });

});
