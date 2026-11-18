const ApiError = require('../errors/ApiError');

// TODO: Replace with injected tenant-scoped MongoDB repositories after BYOD
// database selection is supplied. The running application stores nothing here.
const unavailable = async () => {
  throw new ApiError(503, 'Customer and Khata persistence is not configured.', 'PERSISTENCE_UNAVAILABLE');
};

const customerRepository = {
  create: unavailable,
  list: unavailable,
  findForOutstanding: unavailable,
  findById: unavailable,
  findPotentialDuplicate: unavailable,
  updateById: unavailable,
  deleteById: unavailable,
};

const ledgerRepository = {
  withCustomerTransaction: unavailable,
  listEntries: unavailable,
  getAllEntries: unavailable,
  hasEntries: unavailable,
  listEntriesForCustomers: unavailable,
};

const invoiceRepository = {
  // TODO: Inject a tenant-scoped Mongo invoice repository after BYOD selection.
  async withTransaction() {
    throw new ApiError(503, 'Invoice persistence and transactions are not configured.', 'PERSISTENCE_UNAVAILABLE');
  },
  async list() {
    throw new ApiError(503, 'Invoice persistence is not configured.', 'PERSISTENCE_UNAVAILABLE');
  },
  async findById() {
    throw new ApiError(503, 'Invoice persistence is not configured.', 'PERSISTENCE_UNAVAILABLE');
  },
  async findByNumber() {
    throw new ApiError(503, 'Invoice persistence is not configured.', 'PERSISTENCE_UNAVAILABLE');
  },
  async listByCustomer() {
    throw new ApiError(503, 'Invoice persistence is not configured.', 'PERSISTENCE_UNAVAILABLE');
  },
  async listPayments() { throw new ApiError(503, 'Payment persistence is not configured.', 'PERSISTENCE_UNAVAILABLE'); },
  async findPayment() { throw new ApiError(503, 'Payment persistence is not configured.', 'PERSISTENCE_UNAVAILABLE'); },
  async paymentSummary() { throw new ApiError(503, 'Payment persistence is not configured.', 'PERSISTENCE_UNAVAILABLE'); },
  async listTransactions() { throw new ApiError(503, 'Transaction history is not configured.', 'PERSISTENCE_UNAVAILABLE'); },
  async findTransaction() { throw new ApiError(503, 'Transaction history is not configured.', 'PERSISTENCE_UNAVAILABLE'); },
};

module.exports = { customerRepository, invoiceRepository, ledgerRepository };
