const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const appModule = require('../src/app');
const { createRequireAuthentication } = require('../src/middleware/requireAuthentication');
const { createInMemoryUserRepository } = require('./helpers/inMemoryUserRepository');

const JWT_SECRET = randomBytes(32).toString('hex');

async function withTestServer(userRepository, callback) {
  const app = appModule.createApp({ userRepository, jwtSecret: JWT_SECRET, jwtExpiresIn: '1h' });
  const testServer = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    testServer.once('listening', resolve);
    testServer.once('error', reject);
  });

  try {
    await callback(`http://127.0.0.1:${testServer.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      testServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('POST /api/auth/register creates a user with a normalized email and safe response', async () => {
  const repository = createInMemoryUserRepository();
  await withTestServer(repository, async (url) => {
    const response = await fetch(`${url}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: '  Asha Sharma ',
        email: '  ASHA@example.com ',
        password: 'secure1234',
        businessName: '  Asha Stores ',
      }),
    });
    const body = await response.json();
    const stored = await repository.findByEmail('asha@example.com');

    assert.equal(response.status, 201);
    assert.equal(body.user.fullName, 'Asha Sharma');
    assert.equal(body.user.email, 'asha@example.com');
    assert.equal(body.user.businessName, 'Asha Stores');
    assert.equal(Object.hasOwn(body.user, 'passwordHash'), false);
    assert.equal(Object.hasOwn(body.user, 'password'), false);
    assert.match(stored.passwordHash, /^\$2[aby]\$/);
    assert.notEqual(stored.passwordHash, 'secure1234');
  });
});

test('POST /api/auth/register rejects missing required fields', async () => {
  await withTestServer(createInMemoryUserRepository(), async (url) => {
    const response = await fetch(`${url}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fullName: 'Asha' }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });
});

test('POST /api/auth/register rejects an invalid email', async () => {
  await withTestServer(createInMemoryUserRepository(), async (url) => {
    const response = await fetch(`${url}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Asha Sharma', email: 'not-an-email', password: 'secure1234', businessName: 'Asha Stores',
      }),
    });

    assert.equal(response.status, 400);
  });
});

test('POST /api/auth/register maps duplicate repository emails to 409', async () => {
  const repository = createInMemoryUserRepository([{
    _id: 'existing-user', email: 'asha@example.com', passwordHash: 'existing-hash',
  }]);
  await withTestServer(repository, async (url) => {
    const response = await fetch(`${url}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Asha Sharma', email: 'ASHA@example.com', password: 'secure1234', businessName: 'Asha Stores',
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.code, 'EMAIL_ALREADY_EXISTS');
  });
});

test('production auth routes return 503 until a persistent repository is injected', async () => {
  await withTestServer(undefined, async (url) => {
    const response = await fetch(`${url}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Asha Sharma', email: 'asha@example.com', password: 'secure1234', businessName: 'Asha Stores',
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.code, 'PERSISTENCE_UNAVAILABLE');
  });
});

test('POST /api/auth/login returns a signed token and safe user after valid credentials', async () => {
  const passwordHash = await bcrypt.hash('secure1234', 4);
  const repository = createInMemoryUserRepository([{
    _id: 'user-123', fullName: 'Asha Sharma', email: 'asha@example.com',
    passwordHash, businessName: 'Asha Stores', createdAt: new Date().toISOString(),
  }]);

  await withTestServer(repository, async (url) => {
    const response = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ' ASHA@example.com ', password: 'secure1234' }),
    });
    const body = await response.json();
    const tokenPayload = jwt.verify(body.token, JWT_SECRET);

    assert.equal(response.status, 200);
    assert.equal(body.user.id, 'user-123');
    assert.equal(body.user.email, 'asha@example.com');
    assert.equal(Object.hasOwn(body.user, 'passwordHash'), false);
    assert.equal(tokenPayload.sub, 'user-123');
  });
});

test('POST /api/auth/login rejects an incorrect password', async () => {
  const repository = createInMemoryUserRepository([{
    _id: 'user-123', email: 'asha@example.com', passwordHash: await bcrypt.hash('secure1234', 4),
  }]);
  await withTestServer(repository, async (url) => {
    const response = await fetch(`${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'asha@example.com', password: 'wrong1234' }),
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.code, 'INVALID_CREDENTIALS');
  });
});

test('authentication middleware rejects a missing Bearer token with 401', async () => {
  const middleware = createRequireAuthentication({ jwtSecret: JWT_SECRET });
  const request = { get: () => undefined };
  let forwardedError;

  middleware(request, {}, (error) => { forwardedError = error; });

  assert.equal(forwardedError.status, 401);
  assert.equal(forwardedError.code, 'AUTHENTICATION_REQUIRED');
});

test('authentication middleware rejects an invalid Bearer token with 401', async () => {
  const middleware = createRequireAuthentication({ jwtSecret: JWT_SECRET });
  const request = { get: () => 'Bearer invalid-token' };
  let forwardedError;

  middleware(request, {}, (error) => { forwardedError = error; });

  assert.equal(forwardedError.status, 401);
  assert.equal(forwardedError.code, 'INVALID_TOKEN');
});

test('authentication middleware rejects expired JWTs', async () => {
  const middleware = createRequireAuthentication({ jwtSecret: JWT_SECRET });
  const expiredToken = jwt.sign({}, JWT_SECRET, { subject: 'user-123', expiresIn: -1 });
  const request = { get: () => `Bearer ${expiredToken}` };
  let forwardedError;
  middleware(request, {}, (error) => { forwardedError = error; });
  assert.equal(forwardedError.status, 401);
  assert.equal(forwardedError.code, 'INVALID_TOKEN');
});

test('app adds security headers, limits JSON bodies, and rate limits authentication routes', async () => {
  await withTestServer(createInMemoryUserRepository(), async (url) => {
    const health = await fetch(`${url}/api/health`);
    assert.ok(health.headers.get('x-content-type-options'));
    assert.equal(health.headers.get('x-powered-by'), null);

    const oversized = await fetch(`${url}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'x'.repeat(1024 * 1024 + 20) }),
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).code, 'PAYLOAD_TOO_LARGE');

    const malformed = await fetch(`${url}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).code, 'INVALID_JSON');

    let last;
    for (let index = 0; index < 11; index += 1) {
      last = await fetch(`${url}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@example.com', password: 'incorrect1' }),
      });
      if (index < 10) await last.arrayBuffer();
    }
    assert.equal(last.status, 429);
    assert.equal((await last.json()).code, 'RATE_LIMITED');
  });
});
