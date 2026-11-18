const { randomUUID } = require('node:crypto');
const { createHash } = require('node:crypto');
const { BSON } = require('mongodb');
const ApiError = require('../errors/ApiError');
const { DEFAULT_SETTINGS, RESET_COUNT_KEYS } = require('../validators/businessValidation');

const OPERATIONAL_COLLECTIONS = Object.freeze({
  products: 'products',
  categories: 'categories',
  customers: 'customers',
  khataLedgerEntries: 'customerLedger',
  invoices: 'invoices',
  payments: 'payments',
});

function toSafeProfile(document) {
  if (!document) return null;
  return {
    businessName: document.businessName,
    businessType: document.businessType ?? '',
    phone: document.phone ?? null,
    email: document.email ?? null,
    address: document.address ?? '',
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function isTransactionUnavailable(error) {
  return error?.code === 20 || error?.code === 251 || error?.codeName === 'IllegalOperation'
    || /transaction numbers are only allowed|transactions are not supported|replica set|mongos/i.test(error?.message || '');
}

function createMongoBusinessRepository(database, { now = () => new Date() } = {}) {
  if (!database || typeof database.collection !== 'function') throw new TypeError('A MongoDB database handle is required.');
  const profiles = database.collection('businessProfiles');
  const settings = database.collection('businessSettings');
  const audit = database.collection('businessResetAudits');
  const collections = Object.fromEntries(Object.entries(OPERATIONAL_COLLECTIONS)
    .map(([key, name]) => [key, database.collection(name)]));
  const sequences = database.collection('invoiceSequences');
  const invoices = collections.invoices;
  const payments = collections.payments;
  const ledger = collections.khataLedgerEntries;

  async function countResetData(businessId, session) {
    const options = session ? { session } : {};
    const counts = {};
    for (const key of Object.keys(OPERATIONAL_COLLECTIONS)) {
      counts[key] = await collections[key].countDocuments({ businessId }, options);
    }
    counts.invoiceSequences = await sequences.countDocuments({ _id: businessId }, options);
    const cancellationEvents = await invoices.countDocuments({ businessId, 'cancellation.cancelledAt': { $exists: true } }, options);
    const linkedPaymentLedgerEntries = await ledger.countDocuments({ businessId, referenceId: /^payment:/ }, options);
    counts.transactions = counts.invoices + cancellationEvents + counts.payments + counts.khataLedgerEntries - linkedPaymentLedgerEntries;
    return counts;
  }

  // Hash complete BSON documents in deterministic collection/_id order. This
  // catches same-count edits/replacements, not only inserts and deletes.
  async function fingerprintResetData(businessId, session) {
    const hash = createHash('sha256');
    const options = session ? { session } : {};
    for (const [key, collection] of [...Object.entries(collections), ['invoiceSequences', sequences]]) {
      hash.update(`${key}\0`);
      const filter = key === 'invoiceSequences' ? { _id: businessId } : { businessId };
      const cursor = collection.find(filter, options).sort({ _id: 1 });
      for await (const document of cursor) {
        hash.update(BSON.serialize(document));
        hash.update('\0');
      }
    }
    return hash.digest('hex');
  }

  async function getSettings(businessId) {
    const document = await settings.findOne({ businessId });
    const stored = document?.settings || {};
    return {
      currency: stored.currency ?? DEFAULT_SETTINGS.currency,
      timezone: stored.timezone ?? DEFAULT_SETTINGS.timezone,
      lowStockThreshold: stored.lowStockThreshold ?? DEFAULT_SETTINGS.lowStockThreshold,
    };
  }

  return {
    async getProfile(businessId) {
      return toSafeProfile(await profiles.findOne({ businessId }));
    },
    async updateProfile(businessId, fields) {
      const timestamp = now();
      const result = await profiles.findOneAndUpdate(
        { businessId },
        { $set: { ...fields, updatedAt: timestamp }, $setOnInsert: { businessId, createdAt: timestamp } },
        { upsert: true, returnDocument: 'after' },
      );
      return toSafeProfile(result?.value ?? result);
    },
    getSettings,
    async updateSettings(businessId, fields) {
      const timestamp = now();
      await settings.updateOne({ businessId },
        { $set: { ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [`settings.${key}`, value])), updatedAt: timestamp },
          $setOnInsert: { businessId, createdAt: timestamp } },
        { upsert: true });
      return getSettings(businessId);
    },
    async previewReset(businessId) {
      const [counts, snapshotFingerprint] = await Promise.all([
        countResetData(businessId), fingerprintResetData(businessId),
      ]);
      return { counts, snapshotFingerprint };
    },
    async resetBusinessData({ businessId, expectedCounts, expectedFingerprint, actorId }) {
      if (!database.client || typeof database.client.startSession !== 'function') {
        throw new ApiError(503, 'Business reset requires MongoDB transaction support.', 'BUSINESS_RESET_TRANSACTION_UNAVAILABLE');
      }
      let session;
      try {
        session = database.client.startSession();
        if (!session || typeof session.withTransaction !== 'function') {
          throw new ApiError(503, 'Business reset requires MongoDB transaction support.', 'BUSINESS_RESET_TRANSACTION_UNAVAILABLE');
        }
        let result;
        await session.withTransaction(async () => {
          const currentCounts = await countResetData(businessId, session);
          const currentFingerprint = await fingerprintResetData(businessId, session);
          const expectedKeys = [...RESET_COUNT_KEYS].sort();
          const keysMatch = Object.keys(expectedCounts).sort().join('|') === expectedKeys.join('|');
          const valuesMatch = keysMatch && expectedKeys.every((key) => expectedCounts[key] === currentCounts[key]);
          if (!valuesMatch || currentFingerprint !== expectedFingerprint) throw new ApiError(409, 'Business data changed after the reset preview. Generate a new preview before confirming.', 'RESET_PREVIEW_STALE');

          const deletedCounts = {};
          for (const [key, collectionName] of Object.entries(OPERATIONAL_COLLECTIONS)) {
            const deletion = await database.collection(collectionName).deleteMany({ businessId }, { session });
            deletedCounts[key] = deletion.deletedCount;
            if (deletion.deletedCount !== currentCounts[key]) {
              throw new ApiError(409, 'Business data changed during reset; no reset was committed.', 'RESET_CONFLICT');
            }
          }
          const sequenceDeletion = await sequences.deleteMany({ _id: businessId }, { session });
          deletedCounts.invoiceSequences = sequenceDeletion.deletedCount;
          if (sequenceDeletion.deletedCount !== currentCounts.invoiceSequences) {
            throw new ApiError(409, 'Invoice sequence changed during reset; no reset was committed.', 'RESET_CONFLICT');
          }
          deletedCounts.transactions = currentCounts.transactions;
          const resetAt = now();
          await audit.insertOne({ resetId: randomUUID(), businessId, actorId: String(actorId), resetAt,
            deletedCounts: { ...deletedCounts } }, { session });
          result = { resetAt, deletedCounts };
        });
        return result;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (isTransactionUnavailable(error)) {
          throw new ApiError(503, 'Business reset requires a replica set or sharded cluster with transaction support.', 'BUSINESS_RESET_TRANSACTION_UNAVAILABLE');
        }
        throw error;
      } finally {
        if (session && typeof session.endSession === 'function') await session.endSession();
      }
    },
  };
}

module.exports = { OPERATIONAL_COLLECTIONS, createMongoBusinessRepository };
