const { MongoClient, ObjectId } = require('mongodb');
const { AsyncLocalStorage } = require('node:async_hooks');
const { createMongoProductRepository } = require('../repositories/mongoProductRepository');
const { createMongoCategoryRepository } = require('../repositories/mongoCategoryRepository');
const { createMongoCustomerRepository } = require('../repositories/mongoCustomerRepository');
const { createMongoLedgerRepository } = require('../repositories/mongoLedgerRepository');
const { createMongoInvoiceRepository } = require('../repositories/mongoInvoiceRepository');
const { createMongoAnalyticsRepository } = require('../repositories/mongoAnalyticsRepository');
const { createMongoBusinessRepository } = require('../repositories/mongoBusinessRepository');
const ApiError = require('../errors/ApiError');

const tenantRequestContext = new AsyncLocalStorage();
const REPOSITORY_FACTORIES = {
  product: createMongoProductRepository,
  category: createMongoCategoryRepository,
  customer: createMongoCustomerRepository,
  ledger: createMongoLedgerRepository,
  invoice: createMongoInvoiceRepository,
  analytics: createMongoAnalyticsRepository,
  business: createMongoBusinessRepository,
};

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Resolves tenant storage only from an active central membership and a
 * server-side secret reference. Client input never selects a URI or database.
 */
function createTenantRepositoryProvider({
  centralDatabase,
  centralUri = process.env.CENTRAL_MONGODB_URI,
  maxCachedTenants = positiveInteger(process.env.TENANT_DB_CACHE_LIMIT, 50),
  idleTimeoutMs = positiveInteger(process.env.TENANT_DB_IDLE_TIMEOUT_MS, 10 * 60 * 1000),
} = {}) {
  if (!centralDatabase || typeof centralDatabase.collection !== 'function') {
    throw new TypeError('A connected central MongoDB database is required.');
  }

  const memberships = centralDatabase.collection('businessMemberships');
  const mappings = centralDatabase.collection('tenantConnections');
  const cache = new Map();
  const pending = new Map();

  function getUri(secretRef) {
    if (secretRef === 'CENTRAL') return centralUri;
    const match = typeof secretRef === 'string' && secretRef.match(/^ENV:([A-Z][A-Z0-9_]*)$/);
    if (match) return process.env[match[1]];
    return undefined;
  }

  async function closeEntry(entry) {
    if (entry.client) await entry.client.close().catch(() => {});
  }

  async function evictIdle(now = Date.now()) {
    for (const [businessId, entry] of cache) {
      if (now - entry.lastUsedAt >= idleTimeoutMs) {
        cache.delete(businessId);
        await closeEntry(entry);
      }
    }
  }

  async function reserveCacheSlot() {
    if (cache.size < maxCachedTenants) return;
    const oldest = [...cache.entries()].sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt)[0];
    if (!oldest) return;
    cache.delete(oldest[0]);
    await closeEntry(oldest[1]);
  }

  async function tenantEntry(mapping) {
    const businessId = String(mapping.businessId);
    await evictIdle();
    const current = cache.get(businessId);
    if (current && current.mappingKey === `${mapping.secretRef}:${mapping.databaseName}`) {
      current.lastUsedAt = Date.now();
      cache.delete(businessId);
      cache.set(businessId, current);
      return current;
    }
    if (current) {
      cache.delete(businessId);
      await closeEntry(current);
    }
    if (pending.has(businessId)) return pending.get(businessId);

    const open = (async () => {
      if (typeof mapping.databaseName !== 'string'
        || !mapping.databaseName
        || mapping.databaseName.length > 63
        || /[./\\"$*<>:|?\s]/.test(mapping.databaseName)) {
        throw new ApiError(503, 'The business database mapping is invalid.', 'TENANT_CONFIGURATION_INVALID');
      }
      const uri = getUri(mapping.secretRef);
      if (!uri) throw new ApiError(503, 'The business database reference is not configured.', 'TENANT_CONFIGURATION_UNAVAILABLE');

      let client;
      let database;
      if (mapping.secretRef === 'CENTRAL') {
        client = centralDatabase.client;
        database = client.db(mapping.databaseName);
      } else {
        client = new MongoClient(uri, {
          appName: 'arth-saathi-tenant-api',
          serverSelectionTimeoutMS: positiveInteger(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 5000),
          retryWrites: true,
        });
        try {
          await client.connect();
          database = client.db(mapping.databaseName);
          await database.command({ ping: 1 });
        } catch {
          await client.close().catch(() => {});
          throw new ApiError(503, 'The business database is unavailable.', 'TENANT_DATABASE_UNAVAILABLE');
        }
      }

      const entry = {
        client: mapping.secretRef === 'CENTRAL' ? null : client,
        database,
        lastUsedAt: Date.now(),
        mappingKey: `${mapping.secretRef}:${mapping.databaseName}`,
      };
      await reserveCacheSlot();
      cache.set(businessId, entry);
      return entry;
    })();
    pending.set(businessId, open);
    try {
      return await open;
    } finally {
      pending.delete(businessId);
    }
  }

  async function resolveRequestContext({ userId, businessId }) {
    if (!ObjectId.isValid(userId) || typeof businessId !== 'string' || !businessId) {
      throw new ApiError(401, 'Authenticated business context is invalid.', 'BUSINESS_CONTEXT_REQUIRED');
    }
    const userObjectId = new ObjectId(userId);
    const membership = await memberships.findOne({
      userId: userObjectId,
      businessId,
      status: 'active',
    });
    if (!membership) {
      throw new ApiError(403, 'The account does not have active access to this business.', 'BUSINESS_MEMBERSHIP_REQUIRED');
    }
    const mapping = await mappings.findOne({ businessId });
    if (!mapping) {
      throw new ApiError(503, 'The business database has not been configured.', 'TENANT_CONFIGURATION_UNAVAILABLE');
    }
    const entry = await tenantEntry(mapping);
    const repositories = Object.fromEntries(
      Object.entries(REPOSITORY_FACTORIES).map(([name, factory]) => [name, factory(entry.database)]),
    );
    return { businessId, database: entry.database, repositories };
  }

  const evictionTimer = setInterval(() => { void evictIdle(); }, Math.min(idleTimeoutMs, 60_000));
  evictionTimer.unref?.();

  return {
    resolveRequestContext,
    async close() {
      clearInterval(evictionTimer);
      await Promise.all([...cache.values()].map(closeEntry));
      cache.clear();
    },
  };
}

function createTenantRepositoryProxy(repositoryName) {
  if (!Object.hasOwn(REPOSITORY_FACTORIES, repositoryName)) {
    throw new TypeError(`Unknown tenant repository: ${repositoryName}`);
  }
  return new Proxy({}, {
    get(_target, method) {
      if (typeof method !== 'string') return undefined;
      return (...args) => {
        const context = tenantRequestContext.getStore();
        const repository = context?.repositories?.[repositoryName];
        if (!repository || typeof repository[method] !== 'function') {
          throw new ApiError(503, 'Tenant database context is not available.', 'TENANT_CONTEXT_UNAVAILABLE');
        }
        return repository[method](...args);
      };
    },
  });
}

module.exports = { createTenantRepositoryProvider, createTenantRepositoryProxy, tenantRequestContext };
