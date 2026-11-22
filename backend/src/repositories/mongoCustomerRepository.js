const { ObjectId } = require('mongodb');

function toCustomer(document) {
  if (!document) return null;
  return { ...document, _id: String(document._id) };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Create a repository from the authenticated request's tenant-scoped Db. */
function createMongoCustomerRepository(database) {
  if (!database || typeof database.collection !== 'function') {
    throw new TypeError('A MongoDB database handle is required.');
  }
  const customers = database.collection('customers');

  return {
    async create(customer) {
      const result = await customers.insertOne(customer);
      return toCustomer({ ...customer, _id: result.insertedId });
    },

    async list({ businessId, search, skip, limit }) {
      const filter = { businessId };
      if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ fullName: pattern }, { phone: pattern }];
      }
      const [documents, total] = await Promise.all([
        customers.find(filter).sort({ fullName: 1, _id: 1 }).skip(skip).limit(limit).toArray(),
        customers.countDocuments(filter),
      ]);
      return { items: documents.map(toCustomer), total };
    },

    async findForOutstanding({ businessId, search }) {
      const filter = { businessId };
      if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        filter.$or = [{ fullName: pattern }, { phone: pattern }];
      }
      return (await customers.find(filter).sort({ fullName: 1, _id: 1 }).toArray()).map(toCustomer);
    },

    async findById(id, businessId) {
      return toCustomer(await customers.findOne({ _id: new ObjectId(id), businessId }));
    },

    async findPotentialDuplicate({ businessId, normalizedName, phone, excludingId }) {
      const filter = { businessId, normalizedName, phone };
      if (excludingId) filter._id = { $ne: new ObjectId(excludingId) };
      return toCustomer(await customers.findOne(filter));
    },

    async updateById(id, businessId, update) {
      await customers.updateOne(
        { _id: new ObjectId(id), businessId },
        { $set: update },
      );
      return toCustomer(await customers.findOne({ _id: new ObjectId(id), businessId }));
    },

    async deleteById(id, businessId, { session } = {}) {
      const result = await customers.deleteOne(
        { _id: new ObjectId(id), businessId },
        session ? { session } : undefined,
      );
      return result.deletedCount === 1;
    },
  };
}

module.exports = { createMongoCustomerRepository };
