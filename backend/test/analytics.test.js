const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { createAnalyticsService } = require('../src/services/analyticsService');
const unavailableAnalyticsRepository = require('../src/repositories/unavailableAnalyticsRepository');
const { createInMemoryAnalyticsRepository } = require('./helpers/inMemoryAnalyticsRepository');
const { createMongoAnalyticsRepository } = require('../src/repositories/mongoAnalyticsRepository');

const secret = 'analytics-test-secret-not-used-in-runtime';
const fixedNow = new Date('2026-11-08T12:00:00.000Z');
const businesses = {
  'biz-a': {
    overview: { sales: { totalSalesToday: 12000, totalProfitToday: 3000, totalSalesThisWeek: 25000,
      totalProfitThisWeek: 6000, totalSalesThisMonth: 60000, totalProfitThisMonth: 15000,
      range: { totalSales: 15000, totalProfit: 3500, totalInvoices: 2 } },
    inventory: { totalProducts: 3, totalStockQuantity: 18, totalInventoryValue: 42000, lowStockProductsCount: 1,
      expiringProductsCount: 2 }, totalCustomers: 4, outstandingKhataBalance: 7500, totalTransactionsToday: 5,
    totalInvoicesToday: 2, invoiceStatuses: { paidInvoicesCount: 3, partiallyPaidInvoicesCount: 1, unpaidInvoicesCount: 2 } },
    sales: [
      { date: '2026-11-07T00:00:00.000Z', totalSales: 10000, totalProfit: 2000, totalInvoices: 1, totalUnitsSold: 2 },
      { date: '2026-11-08T00:00:00.000Z', totalSales: 5000, totalProfit: 1500, totalInvoices: 1, totalUnitsSold: 1 },
    ],
    categories: [{ categoryId: 'cat-a', categoryName: 'Drinks', unitsSold: 3, totalRevenue: 15000,
      totalCost: 11500, totalProfit: 3500, invoiceCount: 2 },
    { categoryId: null, categoryName: 'Uncategorized', unitsSold: 1, totalRevenue: 500,
      totalCost: 300, totalProfit: 200, invoiceCount: 1 }],
    products: [{ productId: 'p1', productName: 'Tea', unitsSold: 8, totalRevenue: 20000, totalCost: 14000, totalProfit: 6000, invoiceCount: 4 },
      { productId: 'p2', productName: 'Sugar', unitsSold: 2, totalRevenue: 3000, totalCost: 2000, totalProfit: 1000, invoiceCount: 1 },
      { productId: 'p3', productName: 'Salt', unitsSold: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, invoiceCount: 0 }],
    inventory: { totalProducts: 3, totalStockQuantity: 18, totalPurchaseValue: 42000, totalSellingValue: 63000,
      lowStockProducts: [{ id: 'p3', name: 'Salt', stockQuantity: 0 }],
      expiringProducts: [{ id: 'p1', name: 'Tea', expiryDate: '2026-11-20T00:00:00.000Z' }],
      expiredProducts: [], categoryWiseStock: [{ categoryId: 'cat-a', categoryName: 'Drinks', totalProducts: 2, totalStockQuantity: 12 }] },
  },
  'biz-b': { overview: { sales: {}, inventory: {}, invoiceStatuses: {} }, sales: [], categories: [], products: [], inventory: {} },
};

function token(businessId = 'biz-a') {
  return jwt.sign({ sub: `user-${businessId}`, businessId }, secret, { expiresIn: '1h' });
}
function start(app) {
  const server = app.listen(0, '127.0.0.1');
  return new Promise((resolve, reject) => {
    server.once('listening', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
    server.once('error', reject);
  });
}
async function get(url, path, authToken = token()) {
  return fetch(`${url}${path}`, { headers: authToken ? { authorization: `Bearer ${authToken}` } : {} });
}

test('dashboard overview returns current metrics and date-filtered sales without changing current balances', async (t) => {
  const app = createApp({ analyticsDataRepository: createInMemoryAnalyticsRepository(businesses), jwtSecret: secret,
    businessTimeZone: 'UTC' });
  const { server, url } = await start(app);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await get(url, '/api/dashboard/overview?from=2026-11-07&to=2026-11-08');
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.overview.totalSalesToday, 12000);
  assert.equal(body.overview.totalProfitThisWeek, 6000);
  assert.equal(body.overview.totalInventoryValue, 42000);
  assert.equal(body.overview.lowStockProductsCount, 1);
  assert.equal(body.overview.expiringProductsCount, 2);
  assert.equal(body.overview.outstandingKhataBalance, 7500);
  assert.equal(body.overview.salesRange.totalSales, 15000);
  assert.equal(body.overview.totalCustomers, 4);
});

test('daily sales fills empty buckets and returns chronological, range-filtered data', async () => {
  const service = createAnalyticsService({ analyticsRepository: createInMemoryAnalyticsRepository(businesses),
    businessTimeZone: 'UTC', now: () => fixedNow });
  const result = await service.sales({ period: 'daily', from: '2026-11-06', to: '2026-11-08' }, 'biz-a');
  assert.deepEqual(result.data.map((row) => row.date), ['2026-11-06', '2026-11-07', '2026-11-08']);
  assert.equal(result.data[0].totalSales, 0);
  assert.equal(result.data[1].totalSales, 10000);
  assert.equal(result.data[2].totalUnitsSold, 1);
});

test('weekly, monthly, and yearly sales use validated period labels', async () => {
  const service = createAnalyticsService({ analyticsRepository: createInMemoryAnalyticsRepository(businesses),
    businessTimeZone: 'UTC', now: () => fixedNow });
  const weekly = await service.sales({ period: 'weekly', from: '2026-11-02', to: '2026-11-08' }, 'biz-a');
  assert.deepEqual(weekly.data.map((row) => row.date), ['2026-11-02']);
  const monthly = await service.sales({ period: 'monthly', from: '2026-11-01', to: '2026-11-30' }, 'biz-a');
  assert.deepEqual(monthly.data.map((row) => row.date), ['2026-11']);
  const yearly = await service.sales({ period: 'yearly', from: '2026-01-01', to: '2026-12-31' }, 'biz-a');
  assert.deepEqual(yearly.data.map((row) => row.date), ['2026']);
});

test('analytics rejects invalid and reversed ranges', async () => {
  const service = createAnalyticsService({ analyticsRepository: createInMemoryAnalyticsRepository(businesses),
    businessTimeZone: 'UTC', now: () => fixedNow });
  await assert.rejects(service.sales({ from: '2026-02-30', to: '2026-03-01' }, 'biz-a'), { status: 400 });
  await assert.rejects(service.overview({ from: '2026-11-09', to: '2026-11-08' }, 'biz-a'), { status: 400 });
});

test('category and product analytics use snapshot totals, guard zero margins, and include zero-sales products', async () => {
  const service = createAnalyticsService({ analyticsRepository: createInMemoryAnalyticsRepository(businesses),
    businessTimeZone: 'UTC', now: () => fixedNow });
  const categories = await service.categories({}, 'biz-a');
  assert.equal(categories.items[0].profitMarginPercentage, 23.33);
  assert.equal(categories.items[1].profitMarginPercentage, 40);
  const best = await service.products({ sortBy: 'unitsSold', order: 'desc', limit: 1 }, 'biz-a');
  assert.equal(best.items[0].productId, 'p1');
  const least = await service.products({ sortBy: 'unitsSold', order: 'asc', limit: 3 }, 'biz-a');
  assert.equal(least.items[0].productId, 'p3');
  assert.equal(least.items[0].profitMarginPercentage, 0);
});

test('inventory analytics returns valuation, low stock, expiry, and category stock', async () => {
  const service = createAnalyticsService({ analyticsRepository: createInMemoryAnalyticsRepository(businesses),
    businessTimeZone: 'UTC', now: () => fixedNow });
  const result = await service.inventory({}, 'biz-a');
  assert.equal(result.totalPurchaseValue, 42000);
  assert.equal(result.totalSellingValue, 63000);
  assert.equal(result.lowStockProducts.length, 1);
  assert.equal(result.expiringProducts.length, 1);
  assert.equal(result.expiredProducts.length, 0);
});

test('analytics routes are authenticated, tenant scoped, empty-safe, and 503 without repository integration', async (t) => {
  const app = createApp({ analyticsDataRepository: createInMemoryAnalyticsRepository(businesses), jwtSecret: secret,
    businessTimeZone: 'UTC' });
  const { server, url } = await start(app);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  assert.equal((await get(url, '/api/analytics/sales', null)).status, 401);
  const otherTenant = await get(url, '/api/analytics/categories?businessId=biz-a', token('biz-b'));
  assert.deepEqual((await otherTenant.json()).items, []);
  const empty = await get(url, '/api/analytics/sales?from=2026-11-06&to=2026-11-08', token('biz-b'));
  const emptyBody = await empty.json();
  assert.equal(emptyBody.data.length, 3);
  assert.equal(emptyBody.data.every((row) => row.totalSales === 0), true);
  const unavailable = createApp({ jwtSecret: secret });
  const second = await start(unavailable);
  t.after(() => new Promise((resolve) => second.server.close(resolve)));
  const response = await get(second.url, '/api/analytics/inventory');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'PERSISTENCE_UNAVAILABLE');
});

test('unavailable repository rejects every analytics operation with 503', async () => {
  for (const operation of ['overview', 'sales', 'categoryPerformance', 'productPerformance', 'inventory']) {
    assert.throws(() => unavailableAnalyticsRepository[operation](), { status: 503 });
  }
});

test('Mongo analytics pipelines scope every query, exclude cancelled invoices, and do not use payment receipts as sales', async () => {
  const captured = {};
  const database = { collection(name) {
    return {
      aggregate(pipeline) { captured[name] = pipeline; return { toArray: async () => [] }; },
      countDocuments: async () => 0,
      find() { return { toArray: async () => [], sort() { return this; } }; },
    };
  } };
  const repository = createMongoAnalyticsRepository(database);
  const from = new Date('2026-11-01T00:00:00.000Z');
  const to = new Date('2026-11-30T23:59:59.999Z');
  await repository.sales({ businessId: 'biz-a', from, to, period: 'daily', timeZone: 'UTC' });
  const firstMatch = captured.invoices.find((stage) => stage.$match)?.$match;
  assert.equal(firstMatch.businessId, 'biz-a');
  assert.equal(firstMatch.status.$ne, 'CANCELLED');
  assert.deepEqual(firstMatch.createdAt, { $gte: from, $lte: to });
  assert.equal(captured.payments, undefined);
  await repository.categoryPerformance({ businessId: 'biz-a' });
  const categoryMatch = captured.invoices.find((stage) => stage.$match)?.$match;
  assert.equal(categoryMatch.businessId, 'biz-a');
  assert.equal(categoryMatch.status.$ne, 'CANCELLED');
  assert.equal(JSON.stringify(captured.invoices).includes('analyticsRevenue'), true);
});
