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
const D = 'dddddddddddddddddddddddd';
const P = '111111111111111111111111';
const OTHER_P = '222222222222222222222222';
const token = (businessId) => jwt.sign({ businessId }, SECRET, { subject: `${businessId}-user`, expiresIn: '1h' });

function setup({ failAfterTransactionCallback = false } = {}) {
  const repos = createInMemoryInvoiceRepositories({
    failAfterTransactionCallback,
    products: [
      { id: P, businessId: A, name: 'Tea', sku: 'TEA', purchasePrice: 1, sellingPrice: 5, stockQuantity: 100, unit: 'box' },
      { id: OTHER_P, businessId: B, name: 'Other tea', purchasePrice: 1, sellingPrice: 5, stockQuantity: 100, unit: 'box' },
    ],
    customers: [
      { id: C, businessId: A, fullName: 'Asha' },
      { id: D, businessId: A, fullName: 'Mohan' },
    ],
  });
  const app = createApp({ jwtSecret: SECRET, invoiceDataRepository: repos.invoiceRepository,
    inventoryProductRepository: repos.productRepository, customerDataRepository: repos.customerRepository,
    customerLedgerRepository: { withCustomerTransaction: async () => { throw new Error('not used'); } } });
  return { ...repos, app };
}

async function request(url, path, { method = 'GET', businessId = A, body, auth = true, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (auth) requestHeaders.authorization = `Bearer ${token(businessId)}`;
  if (body !== undefined) requestHeaders['content-type'] = 'application/json';
  return fetch(`${url}${path}`, { method, headers: requestHeaders, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

async function makeInvoice(url, customerId = C, options = {}) {
  const response = await request(url, '/api/invoices', { method: 'POST', body: {
    customerId, paymentType: 'CREDIT', items: [{ productId: P, quantity: options.quantity ?? 1 }],
  } });
  assert.equal(response.status, 201);
  return (await response.json()).invoice;
}
const pay = (amount, overrides = {}) => ({ amount, paymentMethod: 'UPI', ...overrides });

test('invoice payments support partial and full settlement and append one Khata PAYMENT', async () => {
  const { app, state } = setup();
  await withServer(app, async (url) => {
    const invoice = await makeInvoice(url);
    const first = await request(url, `/api/invoices/${invoice.id}/payments`, { method: 'POST', body: pay(2) });
    const payment = (await first.json()).payment;
    assert.equal(first.status, 201);
    assert.equal(payment.amount, 200);
    assert.equal(payment.allocations[0].allocatedAmount, 200);
    assert.equal(state.invoices[0].status, 'PARTIALLY_PAID');
    assert.equal(state.invoices[0].amountPaid, 200);
    assert.equal(state.invoices[0].amountDue, 300);
    assert.equal(state.ledgerEntries.filter((entry) => entry.type === 'PAYMENT').length, 1);
    assert.equal(state.ledgerEntries.filter((entry) => entry.type === 'PAYMENT')[0].referenceId, `payment:${payment.id}`);
    const otherTenantList = await request(url, '/api/payments?businessId=aaaaaaaaaaaaaaaaaaaaaaaa', { businessId: B });
    assert.deepEqual((await otherTenantList.json()).items, []);
    assert.equal((await request(url, `/api/payments/${payment.id}`, { businessId: B })).status, 404);
    const otherTenantTransactions = await request(url, '/api/transactions?businessId=aaaaaaaaaaaaaaaaaaaaaaaa', { businessId: B });
    assert.deepEqual((await otherTenantTransactions.json()).items, []);
    const second = await request(url, `/api/invoices/${invoice.id}/payments`, { method: 'POST', body: pay(3) });
    assert.equal(second.status, 201);
    assert.equal(state.invoices[0].status, 'PAID');
    assert.equal(state.invoices[0].amountDue, 0);
    assert.equal(state.ledgerEntries.filter((entry) => entry.type === 'PAYMENT').length, 2);
    const khataPayments = state.ledgerEntries.filter((entry) => entry.type === 'PAYMENT');
    assert.equal(khataPayments.reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0), 500);
  });
});

test('overpayment, zero amounts, fully paid, cash, and cancelled invoices are rejected', async () => {
  const { app } = setup();
  await withServer(app, async (url) => {
    const invoice = await makeInvoice(url);
    assert.equal((await request(url, `/api/invoices/${invoice.id}/payments`, { method: 'POST', body: pay(5.01) })).status, 409);
    assert.equal((await request(url, `/api/invoices/${invoice.id}/payments`, { method: 'POST', body: pay(0) })).status, 400);
    await request(url, `/api/invoices/${invoice.id}/payments`, { method: 'POST', body: pay(5) });
    assert.equal((await request(url, `/api/invoices/${invoice.id}/payments`, { method: 'POST', body: pay(1) })).status, 409);
    const cash = await (await request(url, '/api/invoices', { method: 'POST', body: {
      paymentType: 'CASH', items: [{ productId: P, quantity: 1 }],
    } })).json();
    assert.equal((await request(url, `/api/invoices/${cash.invoice.id}/payments`, { method: 'POST', body: pay(1) })).status, 409);
    const cancelled = await makeInvoice(url);
    await request(url, `/api/invoices/${cancelled.id}/cancel`, { method: 'POST', body: {} });
    assert.equal((await request(url, `/api/invoices/${cancelled.id}/payments`, { method: 'POST', body: pay(1) })).status, 409);
  });
});

test('customer payments explicitly allocate across invoices and reject invalid ownership or excess dues', async () => {
  const { app, state } = setup();
  await withServer(app, async (url) => {
    const first = await makeInvoice(url);
    const second = await makeInvoice(url);
    const response = await request(url, `/api/customers/${C}/payments`, { method: 'POST', body: pay(7, {
      allocations: [
        { invoiceId: first.id, allocatedAmount: 3 },
        { invoiceId: second.id, allocatedAmount: 4 },
      ],
    }) });
    assert.equal(response.status, 201);
    const payment = (await response.json()).payment;
    assert.equal(payment.allocations.length, 2);
    assert.equal(state.invoices.find((invoice) => invoice._id === first.id).amountDue, 200);
    assert.equal(state.invoices.find((invoice) => invoice._id === second.id).amountDue, 100);
    assert.equal(state.ledgerEntries.filter((entry) => entry.type === 'PAYMENT').length, 1);
    const tooMuch = await request(url, `/api/customers/${C}/payments`, { method: 'POST', body: pay(4, {
      allocations: [{ invoiceId: first.id, allocatedAmount: 4 }],
    }) });
    assert.equal(tooMuch.status, 409);
    const otherCustomer = await request(url, `/api/customers/${D}/payments`, { method: 'POST', body: pay(1, {
      allocations: [{ invoiceId: first.id, allocatedAmount: 1 }],
    }) });
    assert.equal(otherCustomer.status, 404);
    const otherBusiness = await request(url, `/api/customers/${C}/payments`, { businessId: B, method: 'POST', body: pay(1, {
      allocations: [{ invoiceId: first.id, allocatedAmount: 1 }],
    }) });
    assert.equal(otherBusiness.status, 404);
    const duplicate = await request(url, `/api/customers/${C}/payments`, { method: 'POST', body: pay(1, {
      allocations: [{ invoiceId: first.id, allocatedAmount: 1 }, { invoiceId: first.id, allocatedAmount: 0 }],
    }) });
    assert.equal(duplicate.status, 400);
  });
});

test('customer payment without allocations applies FIFO and rejects excess total dues', async () => {
  const { app, state } = setup();
  await withServer(app, async (url) => {
    const first = await makeInvoice(url);
    const second = await makeInvoice(url);
    const oldest = state.invoices.filter((invoice) => invoice.customerId === C).sort((a, b) => a.createdAt - b.createdAt || a._id.localeCompare(b._id))[0];
    const response = await request(url, `/api/customers/${C}/payments`, { method: 'POST', body: pay(7) });
    assert.equal(response.status, 201);
    const payment = (await response.json()).payment;
    assert.equal(payment.allocations.length, 2);
    assert.equal(payment.allocations[0].invoiceId, oldest._id);
    assert.equal(payment.allocations[0].allocatedAmount, 500);
    assert.equal(state.invoices.find((invoice) => invoice._id === first.id).status === 'PAID'
      || state.invoices.find((invoice) => invoice._id === second.id).status === 'PAID', true);
    const excess = await request(url, `/api/customers/${C}/payments`, { method: 'POST', body: pay(4) });
    assert.equal(excess.status, 409);
  });
});

test('payment idempotency, filters, transaction history, and summary use stored records', async () => {
  const { app, state } = setup();
  await withServer(app, async (url) => {
    const invoice = await makeInvoice(url);
    const headers = { 'Idempotency-Key': 'payment-0001' };
    const created = await request(url, `/api/invoices/${invoice.id}/payments`, { method: 'POST', body: pay(2), headers });
    const payment = (await created.json()).payment;
    const replay = await request(url, `/api/invoices/${invoice.id}/payments`, { method: 'POST', body: pay(2), headers });
    assert.equal((await replay.json()).payment.id, payment.id);
    const second = await request(url, `/api/invoices/${invoice.id}/payments`, { method: 'POST', body: pay(1, { paymentMethod: 'OTHER' }) });
    assert.equal(second.status, 201);
    assert.equal(state.payments.length, 2);
    assert.equal(state.ledgerEntries.filter((entry) => entry.type === 'PAYMENT').length, 2);
    const filtered = await (await request(url, '/api/payments?paymentMethod=UPI&limit=1')).json();
    assert.equal(filtered.total, 1);
    assert.equal((await request(url, `/api/payments/${payment.id}`)).status, 200);
    const history = await (await request(url, '/api/transactions?type=PAYMENT_RECEIVED&paymentMethod=UPI')).json();
    assert.equal(history.total, 1);
    assert.equal(history.items[0].type, 'PAYMENT_RECEIVED');
    assert.equal((await request(url, `/api/transactions/${history.items[0].id}`)).status, 200);
    const page = await (await request(url, '/api/transactions?limit=1&page=1')).json();
    assert.ok(page.totalPages > 1);
    assert.equal(page.items.length, 1);
    const future = await (await request(url, '/api/transactions?from=2099-01-01')).json();
    assert.equal(future.total, 0);
    const summary = await (await request(url, '/api/payments/summary')).json();
    assert.equal(summary.totalPaymentsReceived, 300);
    assert.equal(summary.upiPayments, 200);
    assert.equal(summary.otherPayments, 100);
    assert.equal(summary.outstandingCustomerDues, 200);
    assert.equal(summary.partiallyPaidInvoices, 1);
    assert.equal(summary.unpaidInvoices, 0);
  });
});

test('transaction failure, unavailable persistence, and unauthenticated access fail safely', async () => {
  const repos = setup({ failAfterTransactionCallback: true });
  const invoice = {
    _id: 'eeeeeeeeeeeeeeeeeeeeeeee', businessId: A, customerId: C, paymentType: 'CREDIT',
    totalAmount: 500, amountPaid: 0, amountDue: 500, status: 'UNPAID', createdAt: new Date(),
  };
  repos.state.invoices.push(invoice);
  repos.state.ledgerEntries.push({ businessId: A, customerId: C, type: 'CREDIT', amount: 5, createdAt: new Date() });
  await withServer(repos.app, async (url) => {
    assert.equal((await request(url, `/api/invoices/${invoice._id}/payments`, { method: 'POST', body: pay(2) })).status, 500);
    assert.equal(repos.state.invoices[0].amountPaid, 0);
    assert.equal(repos.state.payments.length, 0);
    assert.equal(repos.state.ledgerEntries.filter((entry) => entry.type === 'PAYMENT').length, 0);
    assert.equal((await request(url, '/api/payments', { auth: false })).status, 401);
  });
  const unavailable = createApp({ jwtSecret: SECRET });
  await withServer(unavailable, async (url) => {
    assert.equal((await request(url, '/api/payments')).status, 503);
    assert.equal((await request(url, '/api/transactions')).status, 503);
  });
});
