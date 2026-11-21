// Test-only fixtures; these are injected only by test/customerKhata.test.js.
function createInMemoryCustomerRepositories() {
  const customers = new Map();
  const entries = [];
  const lockTails = new Map();
  let sequence = 1;
  const nextId = () => String(sequence++).padStart(24, '0');
  const clone = (value) => (value ? { ...value } : null);

  const customerRepository = {
    async create(customer) {
      const duplicate = [...customers.values()].some((existing) => existing.businessId === customer.businessId
        && existing.normalizedName === customer.normalizedName && existing.phone === customer.phone);
      if (duplicate) {
        const error = new Error('Duplicate customer candidate');
        error.code = 11000;
        throw error;
      }
      const created = { ...customer, _id: nextId() };
      customers.set(created._id, created);
      return clone(created);
    },
    async list({ businessId, search, skip, limit }) {
      let rows = [...customers.values()].filter((customer) => customer.businessId === businessId);
      if (search) {
        const term = search.toLowerCase();
        rows = rows.filter((customer) => customer.fullName.toLowerCase().includes(term)
          || customer.phone.includes(term));
      }
      rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
      const total = rows.length;
      return { items: rows.slice(skip, skip + limit).map(clone), total };
    },
    async findForOutstanding({ businessId, search }) {
      let rows = [...customers.values()].filter((customer) => customer.businessId === businessId);
      if (search) {
        const term = search.toLowerCase();
        rows = rows.filter((customer) => customer.fullName.toLowerCase().includes(term)
          || customer.phone.includes(term));
      }
      return rows.map(clone);
    },
    async findById(id, businessId) {
      const customer = customers.get(id);
      return customer?.businessId === businessId ? clone(customer) : null;
    },
    async findPotentialDuplicate({ businessId, normalizedName, phone, excludingId }) {
      const customer = [...customers.values()].find((item) => item.businessId === businessId
        && item.normalizedName === normalizedName && item.phone === phone && item._id !== excludingId);
      return clone(customer);
    },
    async updateById(id, businessId, update) {
      const customer = customers.get(id);
      if (!customer || customer.businessId !== businessId) return null;
      const nextName = update.normalizedName ?? customer.normalizedName;
      const nextPhone = update.phone ?? customer.phone;
      const duplicate = [...customers.values()].some((other) => other._id !== id
        && other.businessId === businessId && other.normalizedName === nextName && other.phone === nextPhone);
      if (duplicate) {
        const error = new Error('Duplicate customer candidate');
        error.code = 11000;
        throw error;
      }
      Object.assign(customer, update);
      return clone(customer);
    },
    async deleteById(id, businessId) {
      const customer = customers.get(id);
      if (!customer || customer.businessId !== businessId) return false;
      customers.delete(id);
      return true;
    },
  };

  const ledgerRepository = {
    async withCustomerTransaction({ customerId, businessId }, operation) {
      const key = `${businessId}:${customerId}`;
      const previous = lockTails.get(key) || Promise.resolve();
      let release;
      const current = new Promise((resolve) => { release = resolve; });
      lockTails.set(key, current);
      await previous;
      try {
        const customer = customers.get(customerId);
        if (!customer || customer.businessId !== businessId) {
          const error = new Error('Customer not found.');
          error.status = 404;
          error.code = 'CUSTOMER_NOT_FOUND';
          throw error;
        }
        const transaction = {
          async listEntries() {
            return entries.filter((entry) => entry.businessId === businessId && entry.customerId === customerId)
              .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a._id.localeCompare(b._id))
              .map(clone);
          },
          async hasEntries() {
            return entries.some((entry) => entry.businessId === businessId && entry.customerId === customerId);
          },
          async createEntry(entry) {
            const created = { ...entry, businessId, customerId, _id: nextId() };
            entries.push(created);
            return clone(created);
          },
          async deleteCustomer() {
            return customerRepository.deleteById(customerId, businessId);
          },
        };
        return await operation(transaction);
      } finally {
        release();
        if (lockTails.get(key) === current) lockTails.delete(key);
      }
    },
    async listEntries({ businessId, customerId, skip, limit }) {
      const found = entries.filter((entry) => entry.businessId === businessId && entry.customerId === customerId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b._id.localeCompare(a._id));
      return { items: found.slice(skip, skip + limit).map(clone), total: found.length };
    },
    async getAllEntries({ businessId, customerId }) {
      return entries.filter((entry) => entry.businessId === businessId && entry.customerId === customerId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || a._id.localeCompare(b._id))
        .map(clone);
    },
    async hasEntries({ businessId, customerId }) {
      return entries.some((entry) => entry.businessId === businessId && entry.customerId === customerId);
    },
    async listEntriesForCustomers({ businessId, customerIds }) {
      const ids = new Set(customerIds);
      return entries.filter((entry) => entry.businessId === businessId && ids.has(entry.customerId)).map(clone);
    },
  };

  return { customerRepository, ledgerRepository };
}

module.exports = { createInMemoryCustomerRepositories };
