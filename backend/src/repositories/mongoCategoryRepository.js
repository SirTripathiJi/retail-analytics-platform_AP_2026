const { ObjectId } = require('mongodb');

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
      // TODO: Use a transaction or equivalent tenant-store constraint to close
      // the race between the service's reference count and this delete.
      const result = await categories.deleteOne({ _id: new ObjectId(id), businessId });
      return result.deletedCount === 1;
    },
  };
}

module.exports = { createMongoCategoryRepository };
