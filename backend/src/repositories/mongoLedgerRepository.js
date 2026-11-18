const { ObjectId } = require('mongodb');
const ApiError = require('../errors/ApiError');

function toEntry(document) {
  if (!document) return null;
  return {
    ...document,
    _id: String(document._id),
    customerId: String(document.customerId),
  };
}

/**
 * Ledger repository for an injected business Db. No client is created here.
 * TODO: The tenant integration owner must inject a replica-set Db (whose
 * official-driver Db.client is available) so ledger writes and safe customer
 * deletion can use MongoDB transactions. Every query includes businessId.
 * @param {import('mongodb').Db} database
 */
function createMongoLedgerRepository(database) {
  if (!database || typeof database.collection !== 'function') {
    throw new TypeError('A MongoDB database handle is required.');
  }
  const ledger = database.collection('customerLedger');
  const customers = database.collection('customers');

  async function withCustomerTransaction({ customerId, businessId }, operation) {
    if (!database.client || typeof database.client.startSession !== 'function') {
      throw new ApiError(503, 'Ledger transactions are not configured.', 'LEDGER_TRANSACTION_UNAVAILABLE');
    }
    const id = new ObjectId(customerId);
    const session = database.client.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        // Updating this scoped marker serializes balance-changing transactions
        // for the customer; no balance is stored or trusted.
        const lock = await customers.updateOne(
          { _id: id, businessId },
          { $inc: { ledgerRevision: 1 } },
          { session },
        );
        if (!lock.matchedCount) {
          throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
        }

        const filter = { customerId: id, businessId };
        result = await operation({
          listEntries: async () => (await ledger.find(filter, { session })
            .sort({ createdAt: 1, _id: 1 }).toArray()).map(toEntry),
          hasEntries: async () => Boolean(await ledger.findOne(filter, { session })),
          createEntry: async (entry) => {
            const document = { ...entry, customerId: id, businessId };
            const inserted = await ledger.insertOne(document, { session });
            return toEntry({ ...document, _id: inserted.insertedId });
          },
          deleteCustomer: async () => {
            const deleted = await customers.deleteOne({ _id: id, businessId }, { session });
            return deleted.deletedCount === 1;
          },
        });
      });
      return result;
    } catch (error) {
      if (error?.code === 20 || error?.codeName === 'IllegalOperation') {
        throw new ApiError(503, 'The database does not support required ledger transactions.', 'LEDGER_TRANSACTION_UNAVAILABLE');
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  return {
    withCustomerTransaction,

    async listEntries({ businessId, customerId, skip, limit }) {
      const filter = { businessId, customerId: new ObjectId(customerId) };
      const [documents, total] = await Promise.all([
        ledger.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
        ledger.countDocuments(filter),
      ]);
      return { items: documents.map(toEntry), total };
    },

    async getAllEntries({ businessId, customerId }) {
      const filter = { businessId, customerId: new ObjectId(customerId) };
      return (await ledger.find(filter).sort({ createdAt: 1, _id: 1 }).toArray()).map(toEntry);
    },

    async hasEntries({ businessId, customerId }) {
      return Boolean(await ledger.findOne({ businessId, customerId: new ObjectId(customerId) }));
    },

    async listEntriesForCustomers({ businessId, customerIds }) {
      if (!customerIds.length) return [];
      const ids = customerIds.map((id) => new ObjectId(id));
      return (await ledger.find({ businessId, customerId: { $in: ids } }).toArray()).map(toEntry);
    },
  };
}

module.exports = { createMongoLedgerRepository };
