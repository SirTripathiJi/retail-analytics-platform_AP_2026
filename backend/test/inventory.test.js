const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const { createApp } = require('../src/app');
const { createInMemoryInventoryRepositories } = require('./helpers/inMemoryInventoryRepositories');
const { withServer } = require('./helpers/http');

const JWT_SECRET = randomBytes(32).toString('hex');
const BUSINESS_A = 'business-a';
const BUSINESS_B = 'business-b';
const productInput = (overrides = {}) => ({
  name: 'Green Tea',
  sku: 'GT-001',
  purchasePrice: 4.25,
  sellingPrice: 6.5,
  stockQuantity: 20,
  lowStockThreshold: 5,
  unit: 'box',
  ...overrides,
});

function tokenFor(businessId) {
  return jwt.sign({ businessId, email: `${businessId}@example.com` }, JWT_SECRET, {
    subject: `${businessId}-user`, expiresIn: '1h',
  });
}

function createInventoryApp(repositories = createInMemoryInventoryRepositories()) {
  return {
    app: createApp({
      inventoryProductRepository: repositories.productRepository,
      inventoryCategoryRepository: repositories.categoryRepository,
      jwtSecret: JWT_SECRET,
    }),
    ...repositories,
  };
}

async function send(url, path, { method = 'GET', businessId = BUSINESS_A, body, token = true } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${tokenFor(businessId)}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${url}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('POST /api/products creates a valid product with defaults and safe fields', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const response = await send(url, '/api/products', { method: 'POST', body: productInput() });
    const { product } = await response.json();
    assert.equal(response.status, 201);
    assert.equal(product.name, 'Green Tea');
    assert.equal(product.description, '');
    assert.equal(product.unit, 'box');
    assert.equal(product.categoryId, null);
    assert.equal(product.businessId, undefined);
    assert.equal(product.stockQuantity, 20);
    assert.ok(product.id);
    assert.ok(product.createdAt);
    assert.ok(product.updatedAt);
  });
});

test('POST /api/products rejects missing required fields', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const response = await send(url, '/api/products', { method: 'POST', body: { name: 'Incomplete' } });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });
});

test('POST /api/products rejects negative prices and stock', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const negativePrice = await send(url, '/api/products', {
      method: 'POST', body: productInput({ purchasePrice: -1 }),
    });
    const negativeStock = await send(url, '/api/products', {
      method: 'POST', body: productInput({ stockQuantity: -1 }),
    });
    assert.equal(negativePrice.status, 400);
    assert.equal(negativeStock.status, 400);
  });
});

test('product prices reject sub-paise precision and unsafe monetary values', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    for (const value of [1.001, Number.MAX_SAFE_INTEGER]) {
      const response = await send(url, '/api/products', { method: 'POST', body: {
        name: 'Price guard', sku: `BAD-${String(value).replace(/\W/g, '')}`,
        purchasePrice: value, sellingPrice: 2, stockQuantity: 1,
      } });
      assert.equal(response.status, 400);
    }
  });
});

test('GET /api/products lists products with pagination', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    await send(url, '/api/products', { method: 'POST', body: productInput() });
    await send(url, '/api/products', { method: 'POST', body: productInput({ name: 'Black Tea', sku: 'BT-002' }) });
    const response = await send(url, '/api/products?page=1&limit=1');
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.items.length, 1);
    assert.equal(body.total, 2);
    assert.equal(body.page, 1);
    assert.equal(body.totalPages, 2);
  });
});

test('GET /api/products searches by product name or SKU', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    await send(url, '/api/products', { method: 'POST', body: productInput() });
    await send(url, '/api/products', { method: 'POST', body: productInput({ name: 'Black Tea', sku: 'BT-002' }) });
    const byName = await (await send(url, '/api/products?search=green')).json();
    const bySku = await (await send(url, '/api/products?search=BT-002')).json();
    assert.equal(byName.total, 1);
    assert.equal(byName.items[0].name, 'Green Tea');
    assert.equal(bySku.total, 1);
    assert.equal(bySku.items[0].sku, 'BT-002');
  });
});

test('GET /api/products/:id rejects malformed IDs and returns 404 for missing products', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const malformed = await send(url, '/api/products/not-an-id');
    const missing = await send(url, '/api/products/aaaaaaaaaaaaaaaaaaaaaaaa');
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).code, 'INVALID_ID');
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).code, 'PRODUCT_NOT_FOUND');
  });
});

test('PUT /api/products/:id updates allowed fields and updatedAt', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const created = await (await send(url, '/api/products', { method: 'POST', body: productInput() })).json();
    const response = await send(url, `/api/products/${created.product.id}`, {
      method: 'PUT', body: { sellingPrice: 7, stockQuantity: 12 },
    });
    const { product } = await response.json();
    assert.equal(response.status, 200);
    assert.equal(product.sellingPrice, 7);
    assert.equal(product.stockQuantity, 12);
    assert.ok(new Date(product.updatedAt) >= new Date(created.product.updatedAt));
  });
});

test('DELETE /api/products/:id removes a product', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const created = await (await send(url, '/api/products', { method: 'POST', body: productInput() })).json();
    const response = await send(url, `/api/products/${created.product.id}`, { method: 'DELETE' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'Product deleted successfully.');
    assert.equal((await send(url, `/api/products/${created.product.id}`)).status, 404);
  });
});

test('low-stock endpoint and query return only products at or below threshold', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    await send(url, '/api/products', { method: 'POST', body: productInput({ stockQuantity: 5 }) });
    await send(url, '/api/products', { method: 'POST', body: productInput({ name: 'High Stock', sku: 'HS-1', stockQuantity: 6 }) });
    const endpoint = await (await send(url, '/api/products/low-stock')).json();
    const query = await (await send(url, '/api/products?lowStock=true')).json();
    assert.equal(endpoint.total, 1);
    assert.equal(endpoint.items[0].stockQuantity, 5);
    assert.equal(query.total, 1);
  });
});

test('expiry endpoints filter dated products and exclude products without expiry dates', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const within = new Date(Date.now() + 5 * 86400000).toISOString();
    const outside = new Date(Date.now() + 60 * 86400000).toISOString();
    const alreadyExpired = new Date(Date.now() - 86400000).toISOString();
    await send(url, '/api/products', { method: 'POST', body: productInput({ expiryDate: within }) });
    await send(url, '/api/products', { method: 'POST', body: productInput({ name: 'Later', sku: 'L-2', expiryDate: outside }) });
    await send(url, '/api/products', { method: 'POST', body: productInput({ name: 'Old', sku: 'O-3', expiryDate: alreadyExpired }) });
    await send(url, '/api/products', { method: 'POST', body: productInput({ name: 'No Date', sku: 'N-4' }) });
    const expiring = await (await send(url, '/api/products/expiring?days=30')).json();
    const expired = await (await send(url, '/api/products/expired')).json();
    assert.equal(expiring.total, 1);
    assert.equal(expiring.items[0].name, 'Green Tea');
    assert.equal(expired.total, 1);
    assert.equal(expired.items[0].name, 'Old');
  });
});

test('category creation and listing are scoped to the authenticated business', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const created = await send(url, '/api/categories', {
      method: 'POST', body: { name: '  Beverages ', description: 'Drink products' },
    });
    const createdBody = await created.json();
    const listed = await (await send(url, '/api/categories')).json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.category.name, 'Beverages');
    assert.equal(listed.total, 1);
    assert.equal(listed.items[0].description, 'Drink products');
    assert.equal(listed.items[0].normalizedName, undefined);
  });
});

test('duplicate category names are rejected within a business', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    await send(url, '/api/categories', { method: 'POST', body: { name: 'Beverages' } });
    const duplicate = await send(url, '/api/categories', { method: 'POST', body: { name: ' beverages ' } });
    const otherBusiness = await send(url, '/api/categories', {
      method: 'POST', businessId: BUSINESS_B, body: { name: 'Beverages' },
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).code, 'CATEGORY_ALREADY_EXISTS');
    assert.equal(otherBusiness.status, 201);
  });
});

test('category deletion is blocked while products reference it', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const category = await (await send(url, '/api/categories', {
      method: 'POST', body: { name: 'Beverages' },
    })).json();
    await send(url, '/api/products', {
      method: 'POST', body: productInput({ categoryId: category.category.id }),
    });
    const response = await send(url, `/api/categories/${category.category.id}`, { method: 'DELETE' });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'CATEGORY_IN_USE');
  });
});

test('PUT /api/categories/:id updates category fields and DELETE removes an unused category', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const created = await (await send(url, '/api/categories', {
      method: 'POST', body: { name: 'Beverages' },
    })).json();
    const id = created.category.id;
    const updated = await send(url, `/api/categories/${id}`, {
      method: 'PUT', body: { description: 'Drink products' },
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).category.description, 'Drink products');
    const deleted = await send(url, `/api/categories/${id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);
  });
});

test('inventory routes reject requests without authentication', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const response = await send(url, '/api/products', { token: false });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'AUTHENTICATION_REQUIRED');
  });
});

test('inventory routes return 503 when database repositories are unavailable', async () => {
  const app = createApp({ jwtSecret: JWT_SECRET });
  await withServer(app, async (url) => {
    const response = await send(url, '/api/products');
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'PERSISTENCE_UNAVAILABLE');
  });
});

test('one business cannot list or retrieve another business products', async () => {
  const { app } = createInventoryApp();
  await withServer(app, async (url) => {
    const created = await (await send(url, '/api/products', { method: 'POST', body: productInput() })).json();
    const otherList = await (await send(url, '/api/products', { businessId: BUSINESS_B })).json();
    const otherGet = await send(url, `/api/products/${created.product.id}`, { businessId: BUSINESS_B });
    const otherUpdate = await send(url, `/api/products/${created.product.id}`, {
      method: 'PUT', businessId: BUSINESS_B, body: { sellingPrice: 1 },
    });
    const otherDelete = await send(url, `/api/products/${created.product.id}`, {
      method: 'DELETE', businessId: BUSINESS_B,
    });
    const ownerGet = await send(url, `/api/products/${created.product.id}`);
    assert.equal(otherList.total, 0);
    assert.equal(otherGet.status, 404);
    assert.equal(otherUpdate.status, 404);
    assert.equal(otherDelete.status, 404);
    assert.equal(ownerGet.status, 200);
  });
});
