const { ObjectId } = require('mongodb');
const ApiError = require('../errors/ApiError');

function toCategory(document) {
  if (!document) return null;
  return { ...document, _id: String(document._id) };
}

/**
 * TODO: Tenant selection must inject the shopkeeper's Db before constructing
 * this repository. Provision a unique compound index on { businessId,
 * normalizedName } to make duplicate prevention safe under concurrent writes.
 * @param {import('mongodb').Db} database
 */
function createMongoCategoryRepository(database) {
  if (!database || typeof database.collection !== 'function') {
    throw new TypeError('A MongoDB database handle is required.');
  }
  const categories = database.collection('categories');
  const products = database.collection('products');

  async function withTransaction(operation) {
    if (!database.client || typeof database.client.startSession !== 'function') {
      throw new ApiError(503, 'Safe category deletion requires MongoDB transactions.', 'INVENTORY_TRANSACTION_UNAVAILABLE');
    }
    const session = database.client.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch (error) {
      if (error?.code === 20 || error?.codeName === 'IllegalOperation'
        || /transaction numbers are only allowed|transactions are not supported|replica set|mongos/i.test(error?.message || '')) {
        throw new ApiError(503, 'Safe category deletion requires a replica set or sharded cluster.', 'INVENTORY_TRANSACTION_UNAVAILABLE');
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  return {
    async create(category) {
      const result = await categories.insertOne(category);
      return toCategory({ ...category, _id: result.insertedId });
    },

    async list({ businessId, skip, limit }) {
      const filter = { businessId };
      const [documents, total] = await Promise.all([
        categories.find(filter).sort({ name: 1, _id: 1 }).skip(skip).limit(limit).toArray(),
        categories.countDocuments(filter),
      ]);
      return { items: documents.map(toCategory), total };
    },

    async findById(id, businessId) {
      return toCategory(await categories.findOne({ _id: new ObjectId(id), businessId }));
    },

    async findByName(normalizedName, businessId, excludingId) {
      const filter = { normalizedName, businessId };
      if (excludingId) filter._id = { $ne: new ObjectId(excludingId) };
      return toCategory(await categories.findOne(filter));
    },

    async updateById(id, businessId, update) {
      await categories.updateOne(
        { _id: new ObjectId(id), businessId },
        { $set: update },
      );
      return toCategory(await categories.findOne({ _id: new ObjectId(id), businessId }));
    },

    async deleteById(id, businessId) {
      return withTransaction(async (session) => {
        const categoryId = new ObjectId(id);
        // Product creation and reassignment update the same category marker.
        // This write makes concurrent reference checks conflict and retry.
        const locked = await categories.updateOne(
          { _id: categoryId, businessId },
          { $inc: { referenceRevision: 1 } },
          { session },
        );
        if (!locked.matchedCount) return false;

        const references = await products.countDocuments({ categoryId, businessId }, { session });
        if (references) {
          throw new ApiError(409, 'Category cannot be deleted while products reference it.', 'CATEGORY_IN_USE');
        }
        const result = await categories.deleteOne({ _id: categoryId, businessId }, { session });
        return result.deletedCount === 1;
      });
    },
  };
}

module.exports = { createMongoCategoryRepository };
