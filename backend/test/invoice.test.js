const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const { createApp } = require('../src/app');
const { createInMemoryInvoiceRepositories } = require('./helpers/inMemoryInvoiceRepository');
const { withServer } = require('./helpers/http');

const SECRET = randomBytes(32).toString('hex');
const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const C = 'cccccccccccccccccccccccc';
const P1 = '111111111111111111111111';
const P2 = '222222222222222222222222';
const OTHER = '333333333333333333333333';
const CATEGORY = '444444444444444444444444';
const token = (businessId) => jwt.sign({ businessId }, SECRET, { subject: `${businessId}-user`, expiresIn: '1h' });

function setup({ customer = true, unavailable = false, failAfterTransactionCallback = false } = {}) {
  const repos = createInMemoryInvoiceRepositories({
    failAfterTransactionCallback,
    products: [
      { id: P1, businessId: A, name: 'Tea', sku: 'TEA', categoryId: CATEGORY, purchasePrice: 1.25, sellingPrice: 2.5, stockQuantity: 10, unit: 'box' },
      { id: P2, businessId: A, name: 'Rice', sku: 'RICE', purchasePrice: 3, sellingPrice: 5, stockQuantity: 7, unit: 'kg' },
      { id: OTHER, businessId: B, name: 'Other', purchasePrice: 1, sellingPrice: 2, stockQuantity: 10 },
    ],
    customers: customer ? [{ id: C, businessId: A, fullName: 'Asha' }] : [],
    categories: [{ id: CATEGORY, businessId: A, name: 'Beverages' }],
  });
  const app = createApp({
    jwtSecret: SECRET,
    invoiceDataRepository: unavailable ? undefined : repos.invoiceRepository,
    inventoryProductRepository: repos.productRepository,
    customerDataRepository: repos.customerRepository,
    customerLedgerRepository: { withCustomerTransaction: async () => { throw new Error('unused'); } },
  });
  return { ...repos, app };
}

async function request(url, path, { method = 'GET', biz = A, body, auth = true, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (auth) requestHeaders.authorization = `Bearer ${token(biz)}`;
  if (body !== undefined) requestHeaders['content-type'] = 'application/json';
  return fetch(`${url}${path}`, { method, headers: requestHeaders, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

const cashBody = (overrides = {}) => ({ items: [{ productId: P1, quantity: 2 }], paymentType: 'CASH', ...overrides });
const creditBody = (overrides = {}) => ({ customerId: C, items: [{ productId: P1, quantity: 2 }], paymentType: 'CREDIT', ...overrides });

test('cash billing snapshots real prices, deducts stock, and calculates cost and profit', async () => {
  const { app, state } = setup();
  await withServer(app, async (url) => {
    const response = await request(url, '/api/invoices', { method: 'POST', body: cashBody({
      additionalCharges: [{ name: 'Delivery', quantity: 1, unitPrice: 1 }], discount: 0.5,
      items: [{ productId: P1, quantity: 2 }, { productId: P2, quantity: 1 }],
    }) });
    const { invoice } = await response.json();
    assert.equal(response.status, 201);
    assert.equal(invoice.subtotal, 1000);
    assert.equal(invoice.additionalCharges, 100);
    assert.equal(invoice.totalAmount, 1050);
    assert.equal(invoice.totalCost, 550);
    assert.equal(invoice.totalProfit, 500);
    assert.equal(invoice.paymentType, 'CASH');
    assert.equal(invoice.amountPaid, 1050);
    assert.equal(invoice.items[0].sellingPrice, 250);
    assert.equal(state.products.find((product) => product.id === P1).stockQuantity, 8);
    assert.equal(state.products.find((product) => product.id === P2).stockQuantity, 6);
    assert.equal(state.ledgerEntries.length, 0);
  });
});

test('invoice item snapshots preserve category identity and discount-adjusted analytics values', async () => {
  const { app } = setup();
  await withServer(app, async (url) => {
    const response = await request(url, '/api/invoices', { method: 'POST', body: cashBody({
      items: [{ productId: P1, quantity: 2 }, { productId: P2, quantity: 1 }], discount: 0.5,
    }) });
    const { invoice } = await response.json();
    assert.equal(response.status, 201);
    assert.equal(invoice.items[0].categoryId, CATEGORY);
    assert.equal(invoice.items[0].categoryName, 'Beverages');
    assert.equal(invoice.items[0].analyticsRevenue, 475);
    assert.equal(invoice.items[0].analyticsProfit, 225);
    assert.equal(invoice.items[1].analyticsRevenue, 475);
    assert.equal(invoice.items[1].analyticsProfit, 175);
  });
});

test('credit invoices require and validate customer, then append a linked Khata credit', async () => {
  const { app, state } = setup();
  await withServer(app, async (url) => {
    const missing = await request(url, '/api/invoices', { method: 'POST', body: { ...creditBody(), customerId: undefined } });
    assert.equal(missing.status, 400);
    const response = await request(url, '/api/invoices', { method: 'POST', body: creditBody() });
    const { invoice } = await response.json();
    assert.equal(response.status, 201);
    assert.equal(invoice.amountDue, 500);
    assert.equal(invoice.status, 'UNPAID');
    assert.equal(state.ledgerEntries[0].type, 'CREDIT');
    assert.equal(state.ledgerEntries[0].amount, 5);
    assert.equal(state.ledgerEntries[0].referenceId, `invoice:${invoice.id}`);
  });
});

test('invoice validation rejects invalid IDs, quantities, discount, and client-supplied prices', async () => {
  const { app, state } = setup();
  await withServer(app, async (url) => {
    for (const body of [
      cashBody({ items: [{ productId: 'bad', quantity: 1 }] }),
      cashBody({ items: [{ productId: P1, quantity: 0 }] }),
      cashBody({ items: [{ productId: P1, quantity: -1 }] }),
      cashBody({ items: [{ productId: P1, quantity: 1, sellingPrice: 0.01 }] }),
      cashBody({ discount: 999 }),
    ]) assert.equal((await request(url, '/api/invoices', { method: 'POST', body })).status, 400);
    assert.equal(state.invoices.length, 0);
    assert.equal(state.products[0].stockQuantity, 10);
  });
});

test('rejects unavailable products, customers, and insufficient stock without writes', async () => {
  const { app, state } = setup();
  await withServer(app, async (url) => {
    assert.equal((await request(url, '/api/invoices', { method: 'POST', body: cashBody({ items: [{ productId: OTHER, quantity: 1 }] }) })).status, 404);
    assert.equal((await request(url, '/api/invoices', { method: 'POST', body: creditBody({ customerId: B }) })).status, 404);
    assert.equal((await request(url, '/api/invoices', { method: 'POST', body: cashBody({ items: [{ productId: P1, quantity: 20 }] }) })).status, 409);
    assert.equal(state.invoices.length, 0);
    assert.equal(state.products[0].stockQuantity, 10);
  });
});

test('supports idempotency and invoice listing, retrieval, and customer purchase history', async () => {
  const { app, state } = setup();
  await withServer(app, async (url) => {
    const headers = { 'Idempotency-Key': 'sale-0000001' };
    const first = await request(url, '/api/invoices', { method: 'POST', body: creditBody(), headers });
    const invoice = (await first.json()).invoice;
    const replay = await request(url, '/api/invoices', { method: 'POST', body: creditBody(), headers });
    assert.equal((await replay.json()).invoice.id, invoice.id);
    assert.equal(state.invoices.length, 1);
    assert.equal(state.ledgerEntries.length, 1);
    assert.equal((await request(url, '/api/invoices?page=1&limit=1&status=DUE')).status, 200);
    assert.equal((await (await request(url, `/api/invoices/${invoice.id}`)).json()).invoice.invoiceNumber, invoice.invoiceNumber);
    assert.equal((await (await request(url, `/api/invoices/number/${invoice.invoiceNumber}`)).json()).invoice.id, invoice.id);
    const purchases = await (await request(url, `/api/customers/${C}/purchases`)).json();
    assert.equal(purchases.total, 1);
    assert.equal(purchases.items[0].id, invoice.id);
  });
});

test('cancels unpaid credit invoices once, restores stock, and reverses Khata safely', async () => {
  const { app, state } = setup();
  await withServer(app, async (url) => {
    const created = await (await request(url, '/api/invoices', { method: 'POST', body: creditBody() })).json();
    const id = created.invoice.id;
    const cancelled = await request(url, `/api/invoices/${id}/cancel`, { method: 'POST', body: { reason: 'mistake' } });
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).invoice.status, 'CANCELLED');
    assert.equal(state.products[0].stockQuantity, 10);
    assert.equal(state.ledgerEntries[1].type, 'PAYMENT');
    assert.equal(state.ledgerEntries[1].referenceId, `invoice-cancel:${id}`);
    assert.equal((await request(url, `/api/invoices/${id}/cancel`, { method: 'POST', body: {} })).status, 409);
  });
});

test('cancellation is refused after Khata has been reduced and paid cash invoices are ineligible', async () => {
  const { app, state } = setup();
  await withServer(app, async (url) => {
    const credit = await (await request(url, '/api/invoices', { method: 'POST', body: creditBody() })).json();
    state.ledgerEntries.push({ businessId: A, customerId: C, type: 'PAYMENT', amount: 1, createdAt: new Date() });
    const partial = await request(url, `/api/invoices/${credit.invoice.id}/cancel`, { method: 'POST', body: {} });
    assert.equal(partial.status, 409);
    assert.equal((await partial.json()).code, 'INVOICE_CREDIT_PARTIALLY_SETTLED');
    assert.equal(credit.invoice.status, 'UNPAID');
    const cash = await (await request(url, '/api/invoices', { method: 'POST', body: cashBody() })).json();
    const response = await request(url, `/api/invoices/${cash.invoice.id}/cancel`, { method: 'POST', body: {} });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'INVOICE_HAS_PAYMENTS');
  });
});

test('invoice routes enforce authentication, tenant isolation, and unavailable persistence', async () => {
  const { app } = setup();
  await withServer(app, async (url) => {
    assert.equal((await request(url, '/api/invoices', { auth: false })).status, 401);
    const created = await (await request(url, '/api/invoices', { method: 'POST', body: cashBody() })).json();
    assert.equal((await request(url, `/api/invoices/${created.invoice.id}`, { biz: B })).status, 404);
    assert.equal((await request(url, '/api/invoices')).status, 200);
  });
  const { app: unavailableApp } = setup({ unavailable: true });
  await withServer(unavailableApp, async (url) => {
    const response = await request(url, '/api/invoices', { method: 'POST', body: cashBody() });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'PERSISTENCE_UNAVAILABLE');
  });
});

test('transaction failures do not commit stock, invoice, or ledger changes', async () => {
  const { app, state } = setup({ failAfterTransactionCallback: true });
  await withServer(app, async (url) => {
    assert.equal((await request(url, '/api/invoices', { method: 'POST', body: creditBody() })).status, 500);
    assert.equal(state.products[0].stockQuantity, 10);
    assert.equal(state.invoices.length, 0);
    assert.equal(state.ledgerEntries.length, 0);
  });
});
