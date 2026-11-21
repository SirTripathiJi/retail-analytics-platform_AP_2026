const assert = require('node:assert/strict');
const { test } = require('node:test');
const { RESET_COUNT_KEYS } = require('../src/validators/businessValidation');
const { createMongoBusinessRepository } = require('../src/repositories/mongoBusinessRepository');

const counts = { products: 1, categories: 2, customers: 3, khataLedgerEntries: 4, invoices: 5,
  payments: 6, invoiceSequences: 1, transactions: 16 };

function fakeDatabase({ transaction = true, failInsideTransaction = false } = {}) {
  const calls = [];
  let committed = false;
  const rawCounts = { products: 1, categories: 2, customers: 3, customerLedger: 4, invoices: 5,
    payments: 6, invoiceSequences: 1, cancellationEvents: 2, linkedPaymentLedgerEntries: 1 };
  const database = {
    collection(name) {
      return {
        find() { return { sort() { return { async *[Symbol.asyncIterator]() {} }; } }; },
        async countDocuments(filter, options) {
          calls.push({ operation: 'count', name, filter, options });
          if (name === 'invoices' && filter['cancellation.cancelledAt']) return rawCounts.cancellationEvents;
          if (name === 'customerLedger' && filter.referenceId) return rawCounts.linkedPaymentLedgerEntries;
          if (name === 'invoiceSequences') return rawCounts.invoiceSequences;
          return rawCounts[name] || 0;
        },
        async deleteMany(filter, options) {
          calls.push({ operation: 'delete', name, filter, options });
          if (failInsideTransaction && name === 'invoices') throw new Error('simulated delete failure');
          return { deletedCount: rawCounts[name] || 0 };
        },
        async insertOne(document, options) { calls.push({ operation: 'audit', name, document, options }); return { insertedId: 'audit-id' }; },
        async findOne(filter) { calls.push({ operation: 'findOne', name, filter }); return null; },
        async updateOne(filter, update, options) { calls.push({ operation: 'update', name, filter, update, options }); return { matchedCount: 1 }; },
        async findOneAndUpdate(filter, update, options) { calls.push({ operation: 'findOneAndUpdate', name, filter, update, options }); return { value: { ...update.$set, businessId: filter.businessId, createdAt: update.$setOnInsert.createdAt } }; },
      };
    },
  };
  if (transaction) database.client = { startSession() { return {
    async withTransaction(callback) { await callback(); committed = true; },
    async endSession() { calls.push({ operation: 'endSession' }); },
  }; } };
  return { database, calls, wasCommitted: () => committed };
}

test('Mongo business reset checks snapshot and counts, deletes only fixed tenant-scoped collections in one transaction, and audits', async () => {
  const fake = fakeDatabase();
  const repository = createMongoBusinessRepository(fake.database, { now: () => new Date('2026-11-08T12:00:00Z') });
  const preview = await repository.previewReset('biz-a');
  assert.deepEqual(preview.counts, counts);
  assert.match(preview.snapshotFingerprint, /^[a-f0-9]{64}$/);
  const result = await repository.resetBusinessData({ businessId: 'biz-a', expectedCounts: preview.counts,
    expectedFingerprint: preview.snapshotFingerprint, actorId: 'user-a' });
  assert.deepEqual(result.deletedCounts, counts);
  assert.equal(fake.wasCommitted(), true);
  const deletions = fake.calls.filter((call) => call.operation === 'delete');
  assert.deepEqual(deletions.map((call) => call.name), [
    'products', 'categories', 'customers', 'customerLedger', 'invoices', 'payments', 'invoiceSequences',
  ]);
  for (const call of deletions.slice(0, -1)) assert.deepEqual(call.filter, { businessId: 'biz-a' });
  assert.deepEqual(deletions.at(-1).filter, { _id: 'biz-a' });
  assert.ok(deletions.every((call) => call.options.session));
  const audit = fake.calls.find((call) => call.operation === 'audit');
  assert.equal(audit.name, 'businessResetAudits');
  assert.equal(audit.document.businessId, 'biz-a');
  assert.equal(fake.calls.some((call) => call.name === 'users' || call.name === 'businessProfiles' || call.name === 'businessSettings'), false);
  assert.ok(RESET_COUNT_KEYS.every((key) => Number.isInteger(preview.counts[key])));
});

test('Mongo reset aborts on stale counts or any deletion failure and preserves 503 without transaction support', async () => {
  const stale = fakeDatabase();
  const repository = createMongoBusinessRepository(stale.database);
  const changed = { ...counts, products: counts.products + 1 };
  const preview = await repository.previewReset('biz-a');
  await assert.rejects(repository.resetBusinessData({ businessId: 'biz-a', expectedCounts: changed, expectedFingerprint: preview.snapshotFingerprint, actorId: 'user-a' }),
    { status: 409, code: 'RESET_PREVIEW_STALE' });
  assert.equal(stale.calls.some((call) => call.operation === 'delete'), false);

  const failed = fakeDatabase({ failInsideTransaction: true });
  const failedRepository = createMongoBusinessRepository(failed.database);
  const failedPreview = await failedRepository.previewReset('biz-a');
  await assert.rejects(failedRepository.resetBusinessData({ businessId: 'biz-a', expectedCounts: failedPreview.counts,
    expectedFingerprint: failedPreview.snapshotFingerprint, actorId: 'user-a' }), /simulated delete failure/);
  assert.equal(failed.calls.some((call) => call.operation === 'audit'), false);
  assert.equal(failed.wasCommitted(), false);

  const noTransaction = fakeDatabase({ transaction: false });
  const noTransactionRepository = createMongoBusinessRepository(noTransaction.database);
  await assert.rejects(noTransactionRepository.resetBusinessData({ businessId: 'biz-a', expectedCounts: counts,
    expectedFingerprint: '0'.repeat(64), actorId: 'user-a' }),
    { status: 503, code: 'BUSINESS_RESET_TRANSACTION_UNAVAILABLE' });
  assert.equal(noTransaction.calls.some((call) => call.operation === 'delete'), false);
});

test('Mongo business settings use tenant keys and preserve defaults without a stored settings record', async () => {
  const fake = fakeDatabase({ transaction: false });
  const repository = createMongoBusinessRepository(fake.database);
  assert.deepEqual(await repository.getSettings('biz-a'), { currency: 'INR', timezone: 'UTC', lowStockThreshold: 5 });
  await repository.updateSettings('biz-a', { timezone: 'Asia/Kolkata' });
  const update = fake.calls.find((call) => call.operation === 'update');
  assert.deepEqual(update.filter, { businessId: 'biz-a' });
  assert.equal(update.update.$set['settings.timezone'], 'Asia/Kolkata');
  assert.equal(update.update.$setOnInsert.businessId, 'biz-a');
  assert.equal(update.update.$set['settings.currency'], undefined);
});
