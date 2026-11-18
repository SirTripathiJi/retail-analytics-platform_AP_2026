const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const { createApp } = require('../src/app');
const { createInMemoryCustomerRepositories } = require('./helpers/inMemoryCustomerRepositories');
const { withServer } = require('./helpers/http');

const JWT_SECRET = randomBytes(32).toString('hex');
const BUSINESS_A = 'shop-a';
const BUSINESS_B = 'shop-b';
const customerInput = (overrides = {}) => ({
  fullName: '  Asha   Sharma ',
  phone: ' +1 (555) 123-4567 ',
  email: ' ASHA@EXAMPLE.COM ',
  address: '  12 Market Road ',
  notes: ' Regular customer ',
  ...overrides,
});

function tokenFor(businessId) {
  return jwt.sign({ businessId, email: `${businessId}@example.com` }, JWT_SECRET, {
    subject: `${businessId}-user`, expiresIn: '1h',
  });
}

function makeApp(repositories = createInMemoryCustomerRepositories(), invoiceRepository) {
  return {
    app: createApp({
      customerDataRepository: repositories.customerRepository,
      customerLedgerRepository: repositories.ledgerRepository,
      invoiceDataRepository: invoiceRepository,
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

async function addCustomer(url, body = customerInput(), options = {}) {
  return send(url, '/api/customers', { method: 'POST', body, ...options });
}

test('POST /api/customers creates a normalized customer with optional email support', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const response = await addCustomer(url);
    const { customer } = await response.json();
    assert.equal(response.status, 201);
    assert.equal(customer.fullName, 'Asha Sharma');
    assert.equal(customer.phone, '+15551234567');
    assert.equal(customer.email, 'asha@example.com');
    assert.equal(customer.address, '12 Market Road');
    assert.equal(customer.notes, 'Regular customer');
    assert.equal(customer.businessId, undefined);

    const noEmailResponse = await addCustomer(url, { fullName: 'Mohan Das', phone: '987 654 3210' });
    assert.equal(noEmailResponse.status, 201);
    assert.equal((await noEmailResponse.json()).customer.email, null);

    const sharedPhone = await addCustomer(url, { fullName: 'Asha Sharma Junior', phone: '+1 555 123 4567' });
    assert.equal(sharedPhone.status, 201);
  });
});

test('customer duplicate detection is business-local and does not make phone globally unique', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    await addCustomer(url);
    const sameCustomer = await addCustomer(url, {
      fullName: 'Asha Sharma', phone: '+1 555 123 4567',
    });
    const samePhoneDifferentName = await addCustomer(url, {
      fullName: 'Asha Sharma Family', phone: '+1 555 123 4567',
    });
    const sameCustomerOtherBusiness = await addCustomer(url, customerInput(), { businessId: BUSINESS_B });
    assert.equal(sameCustomer.status, 409);
    assert.equal(samePhoneDifferentName.status, 201);
    assert.equal(sameCustomerOtherBusiness.status, 201);
  });
});

test('POST /api/customers rejects missing or invalid customer data', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const missing = await addCustomer(url, { fullName: 'Asha' });
    const invalidPhone = await addCustomer(url, { fullName: 'Asha', phone: 'abc' });
    const invalidEmail = await addCustomer(url, { fullName: 'Asha', phone: '5551234567', email: 'not-an-email' });
    assert.equal(missing.status, 400);
    assert.equal(invalidPhone.status, 400);
    assert.equal(invalidEmail.status, 400);
  });
});

test('GET /api/customers lists and searches by name or normalized phone', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    await addCustomer(url);
    await addCustomer(url, { fullName: 'Mohan Das', phone: '5559990000' });
    const all = await (await send(url, '/api/customers?page=1&limit=1')).json();
    const byName = await (await send(url, '/api/customers?search=mohan')).json();
    const byPhone = await (await send(url, '/api/customers?search=5551234567')).json();
    assert.equal(all.total, 2);
    assert.equal(all.items.length, 1);
    assert.equal(all.totalPages, 2);
    assert.equal(byName.items[0].fullName, 'Mohan Das');
    assert.equal(byPhone.items[0].fullName, 'Asha Sharma');
  });
});

test('PUT /api/customers/:id updates customer details and timestamp', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const created = await (await addCustomer(url)).json();
    const response = await send(url, `/api/customers/${created.customer.id}`, {
      method: 'PUT', body: { fullName: 'Asha K. Sharma', email: 'asha.new@example.com' },
    });
    const { customer } = await response.json();
    assert.equal(response.status, 200);
    assert.equal(customer.fullName, 'Asha K. Sharma');
    assert.equal(customer.email, 'asha.new@example.com');
    assert.ok(new Date(customer.updatedAt) >= new Date(created.customer.updatedAt));
  });
});

test('DELETE /api/customers/:id allows deletion when there is no ledger history', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const created = await (await addCustomer(url)).json();
    const response = await send(url, `/api/customers/${created.customer.id}`, { method: 'DELETE' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'Customer deleted successfully.');
    assert.equal((await send(url, `/api/customers/${created.customer.id}`)).status, 404);
  });
});

test('customer deletion is blocked once any ledger history exists', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const created = await (await addCustomer(url)).json();
    await send(url, `/api/customers/${created.customer.id}/khata/credit`, {
      method: 'POST', body: { amount: 25 },
    });
    const response = await send(url, `/api/customers/${created.customer.id}`, { method: 'DELETE' });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'CUSTOMER_HAS_LEDGER_HISTORY');
  });
});

test('POST khata credit records an immutable CREDIT entry and updates calculated summary', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const created = await (await addCustomer(url)).json();
    const response = await send(url, `/api/customers/${created.customer.id}/khata/credit`, {
      method: 'POST', body: { amount: 125.5, note: 'Groceries', referenceId: 'sale-17' },
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.entry.type, 'CREDIT');
    assert.equal(body.entry.amount, 125.5);
    assert.equal(body.entry.note, 'Groceries');
    assert.equal(body.entry.referenceId, 'sale-17');
    assert.equal(body.summary.totalCredit, 125.5);
    assert.equal(body.summary.totalPayments, 0);
    assert.equal(body.summary.outstandingBalance, 125.5);
    assert.equal(body.entry.businessId, undefined);
  });
});

test('POST khata payments records a PAYMENT and correct outstanding balance', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const created = await (await addCustomer(url)).json();
    const id = created.customer.id;
    await send(url, `/api/customers/${id}/khata/credit`, { method: 'POST', body: { amount: 100 } });
    const payment = await send(url, `/api/customers/${id}/khata/payments`, {
      method: 'POST', body: { amount: 35.25, paymentMethod: 'upi', note: 'Part payment' },
    });
    const paymentBody = await payment.json();
    const summary = await (await send(url, `/api/customers/${id}/khata/summary`)).json();
    assert.equal(payment.status, 201);
    assert.equal(paymentBody.entry.type, 'PAYMENT');
    assert.equal(paymentBody.entry.paymentMethod, 'UPI');
    assert.equal(summary.totalCredit, 100);
    assert.equal(summary.totalPayments, 35.25);
    assert.equal(summary.outstandingBalance, 64.75);
  });
});

test('Khata rejects zero, negative, and greater-than-balance amounts', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const created = await (await addCustomer(url)).json();
    const id = created.customer.id;
    const zero = await send(url, `/api/customers/${id}/khata/credit`, { method: 'POST', body: { amount: 0 } });
    const negative = await send(url, `/api/customers/${id}/khata/credit`, { method: 'POST', body: { amount: -1 } });
    await send(url, `/api/customers/${id}/khata/credit`, { method: 'POST', body: { amount: 10 } });
    const overpay = await send(url, `/api/customers/${id}/khata/payments`, {
      method: 'POST', body: { amount: 10.01 },
    });
    assert.equal(zero.status, 400);
    assert.equal(negative.status, 400);
    assert.equal(overpay.status, 409);
    assert.equal((await overpay.json()).code, 'PAYMENT_EXCEEDS_BALANCE');
  });
});

test('concurrent payments cannot collectively exceed the outstanding balance', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const created = await (await addCustomer(url)).json();
    const id = created.customer.id;
    await send(url, `/api/customers/${id}/khata/credit`, { method: 'POST', body: { amount: 10 } });
    const payments = await Promise.all([
      send(url, `/api/customers/${id}/khata/payments`, { method: 'POST', body: { amount: 7 } }),
      send(url, `/api/customers/${id}/khata/payments`, { method: 'POST', body: { amount: 7 } }),
    ]);
    const statuses = payments.map((response) => response.status).sort();
    const summary = await (await send(url, `/api/customers/${id}/khata/summary`)).json();
    assert.deepEqual(statuses, [201, 409]);
    assert.equal(summary.outstandingBalance, 3);
  });
});

test('Khata ledger is ordered newest first, paginated, and summary covers all entries', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const created = await (await addCustomer(url)).json();
    const id = created.customer.id;
    await send(url, `/api/customers/${id}/khata/credit`, { method: 'POST', body: { amount: 10, note: 'first' } });
    await send(url, `/api/customers/${id}/khata/credit`, { method: 'POST', body: { amount: 20, note: 'second' } });
    await send(url, `/api/customers/${id}/khata/payments`, { method: 'POST', body: { amount: 5, note: 'third' } });
    const page = await (await send(url, `/api/customers/${id}/khata?page=1&limit=2`)).json();
    assert.equal(page.total, 3);
    assert.equal(page.entries.length, 2);
    assert.deepEqual(page.entries.map((entry) => entry.note), ['third', 'second']);
    assert.equal(page.summary.totalCredit, 30);
    assert.equal(page.summary.totalPayments, 5);
    assert.equal(page.summary.outstandingBalance, 25);
  });
});

test('ledger entries have no ordinary update or delete API', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const created = await (await addCustomer(url)).json();
    const id = created.customer.id;
    const credit = await (await send(url, `/api/customers/${id}/khata/credit`, {
      method: 'POST', body: { amount: 10 },
    })).json();
    const update = await send(url, `/api/customers/${id}/khata/${credit.entry.id}`, {
      method: 'PUT', body: { amount: 1 },
    });
    const deletion = await send(url, `/api/customers/${id}/khata/${credit.entry.id}`, { method: 'DELETE' });
    const summary = await (await send(url, `/api/customers/${id}/khata/summary`)).json();
    assert.equal(update.status, 404);
    assert.equal(deletion.status, 404);
    assert.equal(summary.outstandingBalance, 10);
  });
});

test('GET /api/khata/outstanding returns only customers with positive balances and supports search', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const owing = await (await addCustomer(url)).json();
    const settled = await (await addCustomer(url, { fullName: 'Mohan Das', phone: '5559990000' })).json();
    await send(url, `/api/customers/${owing.customer.id}/khata/credit`, { method: 'POST', body: { amount: 30 } });
    await send(url, `/api/customers/${settled.customer.id}/khata/credit`, { method: 'POST', body: { amount: 12 } });
    await send(url, `/api/customers/${settled.customer.id}/khata/payments`, { method: 'POST', body: { amount: 12 } });
    const response = await send(url, '/api/khata/outstanding?search=asha');
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.items[0].customer.fullName, 'Asha Sharma');
    assert.equal(body.items[0].outstandingBalance, 30);
  });
});

test('customer and Khata routes reject unauthenticated requests', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const customers = await send(url, '/api/customers', { token: false });
    const outstanding = await send(url, '/api/khata/outstanding', { token: false });
    assert.equal(customers.status, 401);
    assert.equal(outstanding.status, 401);
  });
});

test('customer and Khata routes return 503 with the production persistence boundary', async () => {
  const app = createApp({ jwtSecret: JWT_SECRET });
  await withServer(app, async (url) => {
    const response = await send(url, '/api/customers');
    const khata = await send(url, '/api/customers/aaaaaaaaaaaaaaaaaaaaaaaa/khata');
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'PERSISTENCE_UNAVAILABLE');
    assert.equal(khata.status, 503);
  });
});

test('customer request data cannot override business scope or read another business', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const override = await addCustomer(url, { ...customerInput(), businessId: BUSINESS_B });
    assert.equal(override.status, 400);

    const created = await (await addCustomer(url)).json();
    const otherList = await (await send(url, '/api/customers', { businessId: BUSINESS_B })).json();
    const otherRead = await send(url, `/api/customers/${created.customer.id}`, { businessId: BUSINESS_B });
    assert.equal(otherList.total, 0);
    assert.equal(otherRead.status, 404);
  });
});

test('Khata data is isolated by business and request bodies cannot override the tenant', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const created = await (await addCustomer(url)).json();
    const id = created.customer.id;
    await send(url, `/api/customers/${id}/khata/credit`, { method: 'POST', body: { amount: 40 } });
    const otherLedger = await send(url, `/api/customers/${id}/khata`, { businessId: BUSINESS_B });
    const otherPayment = await send(url, `/api/customers/${id}/khata/payments`, {
      method: 'POST', businessId: BUSINESS_B, body: { amount: 10 },
    });
    const injectedBusinessId = await send(url, `/api/customers/${id}/khata/credit`, {
      method: 'POST', body: { amount: 10, businessId: BUSINESS_B },
    });
    const originalSummary = await (await send(url, `/api/customers/${id}/khata/summary`)).json();
    assert.equal(otherLedger.status, 404);
    assert.equal(otherPayment.status, 404);
    assert.equal(injectedBusinessId.status, 400);
    assert.equal(originalSummary.outstandingBalance, 40);
  });
});

test('customer purchase history returns 503 while invoice persistence is not configured', async () => {
  const { app } = makeApp();
  await withServer(app, async (url) => {
    const created = await (await addCustomer(url)).json();
    const response = await send(url, `/api/customers/${created.customer.id}/purchases`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'PERSISTENCE_UNAVAILABLE');
  });
});
