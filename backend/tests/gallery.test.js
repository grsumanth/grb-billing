process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../server');
const pool = require('../db');

let token = '';
let testUserId = '';
let testGalleryId = '';

const testUsername = `gallery_tester_${Date.now()}`;
const testPin = '1234';

test.describe('GRB Gallery API Integration Tests', () => {

  test.before(async () => {
    // Register a test user and login to get auth token
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Gallery Tester',
        username: testUsername,
        pin: testPin
      });
    token = res.token || res.body.token;
    testUserId = res.user ? res.user.id : (res.body.user ? res.body.user.id : '');
  });

  test.after(async () => {
    try {
      if (testGalleryId) {
        await pool.query('DELETE FROM gallery WHERE id = $1', [testGalleryId]);
      }
      if (testUserId) {
        await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
      }
    } catch (err) {
      console.error('Error during gallery test cleanup:', err.message);
    } finally {
      await pool.end();
    }
  });

  test('GET /api/gallery should reject request without auth token', async () => {
    await request(app)
      .get('/api/gallery')
      .expect(401);
  });

  test('POST /api/gallery should create a new gallery category', async () => {
    const res = await request(app)
      .post('/api/gallery')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Agarbatti',
        price: 150.50,
        images: ['data:image/png;base64,iVBORw0KGgoAAAANSzk...']
      })
      .expect(201);

    assert.ok(res.body.id);
    assert.strictEqual(res.body.name, 'Test Agarbatti');
    assert.strictEqual(parseFloat(res.body.price), 150.50);
    assert.ok(Array.isArray(res.body.images));
    assert.strictEqual(res.body.images.length, 1);

    testGalleryId = res.body.id;
  });

  test('GET /api/gallery should list all categories containing our new category', async () => {
    const res = await request(app)
      .get('/api/gallery')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    assert.ok(Array.isArray(res.body));
    const found = res.body.find(g => g.id === testGalleryId);
    assert.ok(found);
    assert.strictEqual(found.name, 'Test Agarbatti');
    assert.strictEqual(parseFloat(found.price), 150.50);
    assert.strictEqual(found.images.length, 1);
  });

  test('PUT /api/gallery/:id should update category and images', async () => {
    const res = await request(app)
      .put(`/api/gallery/${testGalleryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Agarbatti',
        price: 180.00,
        images: [
          'data:image/png;base64,iVBORw0KGgoAAAANSzk...',
          'data:image/png;base64,anotherimage...'
        ]
      })
      .expect(200);

    assert.strictEqual(res.body.name, 'Updated Agarbatti');
    assert.strictEqual(parseFloat(res.body.price), 180.00);
    assert.strictEqual(res.body.images.length, 2);
  });

  test('DELETE /api/gallery/:id should delete the category', async () => {
    await request(app)
      .delete(`/api/gallery/${testGalleryId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Verify it is deleted
    await request(app)
      .get(`/api/gallery/${testGalleryId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    testGalleryId = ''; // Prevent double delete in cleanup
  });

});
