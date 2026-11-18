const { ObjectId } = require('mongodb');

function toProduct(document) {
  if (!document) return null;
  return {
    ...document,
    _id: String(document._id),
    categoryId: document.categoryId ? String(document.categoryId) : null,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFilter({ businessId, search, categoryId, lowStock, expired, expiryFrom, expiryTo, expiryBefore }) {
  const filter = { businessId };
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { sku: pattern }];
  }
  if (categoryId) filter.categoryId = new ObjectId(categoryId);
  if (lowStock) filter.$expr = { $lte: ['$stockQuantity', '$lowStockThreshold'] };
  if (expiryFrom && expiryTo) {
    filter.expiryDate = { $type: 'date', $gte: expiryFrom, $lte: expiryTo };
  }
  if (expired && expiryBefore) filter.expiryDate = { $type: 'date', $lt: expiryBefore };
  return filter;
}

/**
 * TODO: Tenant selection must inject the shopkeeper's Db before constructing
 * this repository. This implementation opens no connections and always scopes
 * reads/writes by authenticated businessId as defense in depth.
 * @param {import('mongodb').Db} database
 */
function createMongoProductRepository(database) {
  if (!database || typeof database.collection !== 'function') {
    throw new TypeError('A MongoDB database handle is required.');
  }
  const products = database.collection('products');

  async function findPage(filter, { skip, limit }) {
    const [documents, total] = await Promise.all([
      products.find(filter).sort({ name: 1, _id: 1 }).skip(skip).limit(limit).toArray(),
      products.countDocuments(filter),
    ]);
    return { items: documents.map(toProduct), total };
  }

  return {
    async create(product) {
      const document = {
        ...product,
        categoryId: product.categoryId ? new ObjectId(product.categoryId) : null,
      };
      const result = await products.insertOne(document);
      return toProduct({ ...document, _id: result.insertedId });
    },

    async list(options) {
      return findPage(buildFilter(options), options);
    },

    async findById(id, businessId) {
      return toProduct(await products.findOne({ _id: new ObjectId(id), businessId }));
    },

    async updateById(id, businessId, update) {
      const fields = { ...update };
      if (fields.categoryId) fields.categoryId = new ObjectId(fields.categoryId);
      await products.updateOne(
        { _id: new ObjectId(id), businessId },
        { $set: fields },
      );
      return toProduct(await products.findOne({ _id: new ObjectId(id), businessId }));
    },

    async deleteById(id, businessId) {
      const result = await products.deleteOne({ _id: new ObjectId(id), businessId });
      return result.deletedCount === 1;
    },

    async findLowStock(options) {
      return findPage({
        businessId: options.businessId,
        $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] },
      }, options);
    },

    async findExpiring(options) {
      return findPage({
        businessId: options.businessId,
        expiryDate: { $type: 'date', $gte: options.from, $lte: options.to },
      }, options);
    },

    async findExpired(options) {
      return findPage({
        businessId: options.businessId,
        expiryDate: { $type: 'date', $lt: options.before },
      }, options);
    },

    countByCategory(businessId, categoryId) {
      return products.countDocuments({ businessId, categoryId: new ObjectId(categoryId) });
    },
  };
}

module.exports = { createMongoProductRepository };
