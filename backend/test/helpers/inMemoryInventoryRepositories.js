// Test-only fixtures. The running application never imports these repositories.
function createInMemoryInventoryRepositories() {
  const products = new Map();
  const categories = new Map();
  let sequence = 1;
  const nextId = () => String(sequence++).padStart(24, '0');
  const clone = (value) => (value ? { ...value } : null);

  const productRepository = {
    async create(product) {
      const created = { ...product, _id: nextId() };
      products.set(created._id, created);
      return clone(created);
    },
    async list(options) {
      let rows = [...products.values()].filter((product) => product.businessId === options.businessId);
      if (options.search) {
        const search = options.search.toLowerCase();
        rows = rows.filter((product) => product.name.toLowerCase().includes(search)
          || product.sku.toLowerCase().includes(search));
      }
      if (options.categoryId) rows = rows.filter((product) => product.categoryId === options.categoryId);
      if (options.lowStock) rows = rows.filter((product) => product.stockQuantity <= product.lowStockThreshold);
      if (options.expiryFrom && options.expiryTo) {
        rows = rows.filter((product) => product.expiryDate
          && product.expiryDate >= options.expiryFrom && product.expiryDate <= options.expiryTo);
      }
      if (options.expired && options.expiryBefore) {
        rows = rows.filter((product) => product.expiryDate && product.expiryDate < options.expiryBefore);
      }
      const total = rows.length;
      const items = rows.sort((a, b) => a.name.localeCompare(b.name))
        .slice(options.skip, options.skip + options.limit).map(clone);
      return { items, total };
    },
    async findById(id, businessId) {
      const product = products.get(id);
      return product?.businessId === businessId ? clone(product) : null;
    },
    async updateById(id, businessId, update) {
      const product = products.get(id);
      if (!product || product.businessId !== businessId) return null;
      Object.assign(product, update);
      return clone(product);
    },
    async deleteById(id, businessId) {
      const product = products.get(id);
      if (!product || product.businessId !== businessId) return false;
      products.delete(id);
      return true;
    },
    async findLowStock(options) {
      return this.list({ ...options, lowStock: true });
    },
    async findExpiring(options) {
      return this.list({ ...options, expiryFrom: options.from, expiryTo: options.to });
    },
    async findExpired(options) {
      return this.list({ ...options, expired: true, expiryBefore: options.before });
    },
    async countByCategory(businessId, categoryId) {
      return [...products.values()].filter((product) => product.businessId === businessId
        && product.categoryId === categoryId).length;
    },
  };

  const categoryRepository = {
    async create(category) {
      const created = { ...category, _id: nextId() };
      categories.set(created._id, created);
      return clone(created);
    },
    async list({ businessId, skip, limit }) {
      const rows = [...categories.values()].filter((category) => category.businessId === businessId)
        .sort((a, b) => a.name.localeCompare(b.name));
      return { items: rows.slice(skip, skip + limit).map(clone), total: rows.length };
    },
    async findById(id, businessId) {
      const category = categories.get(id);
      return category?.businessId === businessId ? clone(category) : null;
    },
    async findByName(normalizedName, businessId, excludingId) {
      const category = [...categories.values()].find((item) => item.businessId === businessId
        && item.normalizedName === normalizedName && item._id !== excludingId);
      return clone(category);
    },
    async updateById(id, businessId, update) {
      const category = categories.get(id);
      if (!category || category.businessId !== businessId) return null;
      Object.assign(category, update);
      return clone(category);
    },
    async deleteById(id, businessId) {
      const category = categories.get(id);
      if (!category || category.businessId !== businessId) return false;
      categories.delete(id);
      return true;
    },
  };

  return { categoryRepository, productRepository };
}

module.exports = { createInMemoryInventoryRepositories };
