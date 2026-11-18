const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const { createApp } = require('../src/app');
const { createInMemoryBusinessRepository } = require('./helpers/inMemoryBusinessRepository');
const { withServer } = require('./helpers/http');

const SECRET = randomBytes(32).toString('hex');
const A = 'business-a';
const B = 'business-b';
const authToken = (businessId = A) => jwt.sign({ businessId }, SECRET, { subject: `user-${businessId}`, expiresIn: '1h' });
const expectedCounts = {
  products: 1, categories: 1, customers: 1, khataLedgerEntries: 2, invoices: 1, payments: 1,
  invoiceSequences: 1, transactions: 4,
};

function fixture(options = {}) {
  return createInMemoryBusinessRepository({
    profiles: { [A]: { businessName: 'Shop A', email: 'a@example.com', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') },
      [B]: { businessName: 'Shop B', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') } },
    settings: { [A]: { currency: 'INR', timezone: 'Asia/Kolkata', lowStockThreshold: 8 }, [B]: { timezone: 'America/Los_Angeles' } },
    centralAccounts: [{ id: 'central-user-a', businessId: A }], connectionMetadata: [{ businessId: A, tenantKey: 'kept' }],
    operationalData: {
      products: [{ businessId: A, id: 'p-a' }, { businessId: B, id: 'p-b' }],
      categories: [{ businessId: A, id: 'c-a' }, { businessId: B, id: 'c-b' }],
      customers: [{ businessId: A, id: 'cu-a' }],
      khataLedgerEntries: [{ businessId: A, referenceId: 'invoice:i-a' }, { businessId: A, referenceId: 'payment:pay-a' }],
      invoices: [{ businessId: A, id: 'i-a', cancellation: { cancelledAt: new Date() } }],
      payments: [{ businessId: A, id: 'pay-a' }], invoiceSequences: [{ businessId: A }],
    },
    ...options,
  });
}

async function request(url, path, { method = 'GET', businessId = A, body, authenticated = true } = {}) {
  const headers = {};
  if (authenticated) headers.authorization = `Bearer ${authToken(businessId)}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${url}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test('business profile reads, normalizes updates, rejects protected fields, and remains tenant scoped', async () => {
  const { repository } = fixture();
  await withServer(createApp({ businessDataRepository: repository, jwtSecret: SECRET }), async (url) => {
    const read = await request(url, '/api/business/profile');
    assert.equal(read.status, 200);
    assert.equal((await read.json()).profile.businessName, 'Shop A');
    const ignoredQueryScope = await request(url, '/api/business/profile?businessId=business-b');
    assert.equal((await ignoredQueryScope.json()).profile.businessName, 'Shop A');
    const update = await request(url, '/api/business/profile', { method: 'PUT', body: {
      businessName: '  Shop A New  ', email: '  OWNER@Example.COM ', phone: '+91 98765-43210', address: ' Main Road ',
    } });
    const profile = (await update.json()).profile;
    assert.equal(update.status, 200);
    assert.equal(profile.businessName, 'Shop A New');
    assert.equal(profile.email, 'owner@example.com');
    assert.equal(profile.phone, '+919876543210');
    assert.equal(profile.address, 'Main Road');
    assert.equal((await request(url, '/api/business/profile', { businessId: B })).status, 200);
    assert.equal((await (await request(url, '/api/business/profile', { businessId: B })).json()).profile.businessName, 'Shop B');
    assert.equal((await request(url, '/api/business/profile', { method: 'PUT', body: { businessId: B, businessName: 'Takeover' } })).status, 400);
    assert.equal((await request(url, '/api/business/profile', { method: 'PUT', body: { email: 'bad' } })).status, 400);
  });
});

test('business settings have defaults, validate updates, and use settings for new product stock thresholds', async () => {
  const { repository } = fixture();
  const productRepository = { async create(product) { return { ...product, id: 'new-product' }; } };
  const categoryRepository = { async findById() { return null; } };
  await withServer(createApp({ businessDataRepository: repository, inventoryProductRepository: productRepository,
    inventoryCategoryRepository: categoryRepository, jwtSecret: SECRET }), async (url) => {
    const defaults = await request(url, '/api/business/settings', { businessId: 'new-business' });
    assert.deepEqual((await defaults.json()).settings, { currency: 'INR', timezone: 'UTC', lowStockThreshold: 5 });
    const saved = await request(url, '/api/business/settings', { method: 'PUT', body: {
      currency: ' usd ', timezone: 'America/Los_Angeles', lowStockThreshold: 12,
    } });
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).settings, { currency: 'USD', timezone: 'America/Los_Angeles', lowStockThreshold: 12 });
    const productResponse = await request(url, '/api/products', { method: 'POST', body: {
      name: 'New stock item', sku: 'NEW-1', purchasePrice: 1, sellingPrice: 2, stockQuantity: 10,
    } });
    assert.equal(productResponse.status, 201);
    assert.equal((await productResponse.json()).product.lowStockThreshold, 12);
    for (const body of [{ currency: 'ZZZ' }, { timezone: 'Mars/Olympus' }, { lowStockThreshold: -1 },
      { lowStockThreshold: 1000001 }, { ownerId: 'user-b' }]) {
      assert.equal((await request(url, '/api/business/settings', { method: 'PUT', body })).status, 400);
    }
    assert.equal((await (await request(url, '/api/business/settings', { businessId: B })).json()).settings.timezone, 'America/Los_Angeles');
  });
});

test('analytics uses a tenant settings timezone when the business repository is injected', async () => {
  const { repository } = fixture();
  const analyticsDataRepository = {
    async sales() { return []; }, async overview() { return { sales: {}, inventory: {}, invoiceStatuses: {} }; },
    async categoryPerformance() { return []; }, async productPerformance() { return { items: [], total: 0 }; }, async inventory() { return {}; },
  };
  await withServer(createApp({ businessDataRepository: repository, analyticsDataRepository, jwtSecret: SECRET,
    businessTimeZone: 'UTC' }), async (url) => {
    const response = await request(url, '/api/analytics/sales?from=2026-11-01&to=2026-11-01');
    assert.equal((await response.json()).timezone, 'Asia/Kolkata');
  });
});

test('reset preview counts tenant data, and confirmed reset preserves accounts, settings, profile, and other businesses', async () => {
  const { repository, state } = fixture();
  await withServer(createApp({ businessDataRepository: repository, jwtSecret: SECRET }), async (url) => {
    const previewResponse = await request(url, '/api/business/reset/preview?businessId=business-b');
    const preview = await previewResponse.json();
    assert.equal(previewResponse.status, 200);
    assert.equal(preview.businessId, A);
    assert.deepEqual(preview.counts, expectedCounts);
    assert.match(preview.snapshotFingerprint, /^[a-f0-9]{64}$/);
    const otherPreview = await request(url, '/api/business/reset/preview', { businessId: B });
    assert.equal(otherPreview.status, 200);
    assert.equal((await otherPreview.json()).counts.products, 1);
    assert.equal((await request(url, '/api/business/reset/preview', { authenticated: false })).status, 401);
    assert.equal((await request(url, '/api/business/reset', { method: 'POST', body: { counts: preview.counts } })).status, 400);
    assert.equal((await request(url, '/api/business/reset', { method: 'POST', body: {
      confirmationText: 'RESET ALL', counts: preview.counts,
    } })).status, 400);
    const reset = await request(url, '/api/business/reset', { method: 'POST', body: {
      confirmationText: 'RESET MY BUSINESS DATA', counts: preview.counts, snapshotFingerprint: preview.snapshotFingerprint,
    } });
    const result = await reset.json();
    assert.equal(reset.status, 200);
    assert.equal(result.success, true);
    assert.deepEqual(result.deletedCounts, expectedCounts);
    assert.equal(state.operationalData.products.some((item) => item.businessId === A), false);
    assert.equal(state.operationalData.products.some((item) => item.businessId === B), true);
    assert.equal(state.centralAccounts.length, 1);
    assert.equal(state.connectionMetadata.length, 1);
    assert.equal(state.profiles[A].businessName, 'Shop A');
    assert.equal(state.settings[A].timezone, 'Asia/Kolkata');
    assert.equal(state.resetAudits.length, 1);
  });
});

test('reset rejects stale previews, transaction failures, missing transaction support, and unavailable repositories', async () => {
  const stale = fixture();
  const stalePreview = await stale.repository.previewReset(A);
  stale.state.operationalData.products[0].name = 'changed after preview';
  await assert.rejects(stale.repository.resetBusinessData({ businessId: A, expectedCounts: stalePreview.counts,
    expectedFingerprint: stalePreview.snapshotFingerprint, actorId: 'user-a' }), { code: 'RESET_PREVIEW_STALE' });

  const failed = fixture({ failReset: true });
  const failedPreview = await failed.repository.previewReset(A);
  await assert.rejects(failed.repository.resetBusinessData({ businessId: A, expectedCounts: failedPreview.counts,
    expectedFingerprint: failedPreview.snapshotFingerprint, actorId: 'user-a' }));
  assert.equal(failed.state.operationalData.products.some((item) => item.businessId === A), true);
  await withServer(createApp({ businessDataRepository: failed.repository, jwtSecret: SECRET }), async (url) => {
    const response = await request(url, '/api/business/reset', { method: 'POST', body: {
      confirmationText: 'RESET MY BUSINESS DATA', counts: failedPreview.counts,
      snapshotFingerprint: failedPreview.snapshotFingerprint,
    } });
    assert.equal(response.status, 500);
    assert.equal((await response.json()).success, undefined);
    assert.equal(failed.state.operationalData.products.some((item) => item.businessId === A), true);
  });

  const noTransactions = fixture({ supportsTransactions: false });
  await assert.rejects(noTransactions.repository.resetBusinessData({ businessId: A,
    expectedCounts: (await noTransactions.repository.previewReset(A)).counts,
    expectedFingerprint: (await noTransactions.repository.previewReset(A)).snapshotFingerprint, actorId: 'user-a' }), { status: 503 });

  await withServer(createApp({ jwtSecret: SECRET }), async (url) => {
    assert.equal((await request(url, '/api/business/settings')).status, 503);
    assert.equal((await request(url, '/api/business/reset/preview')).status, 503);
  });
});
