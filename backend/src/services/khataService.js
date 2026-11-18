const ApiError = require('../errors/ApiError');
const { validateObjectId, validatePagination } = require('../validators/inventoryValidation');
const { validateCredit, validatePayment } = require('../validators/khataValidation');

function requireBusinessId(businessId) {
  if (!businessId) throw new ApiError(401, 'Authenticated business context is missing.', 'BUSINESS_CONTEXT_REQUIRED');
  return String(businessId);
}

function calculateSummary(entries) {
  let creditMinor = 0;
  let paymentMinor = 0;
  for (const entry of entries) {
    const amountMinor = Math.round(entry.amount * 100);
    if (entry.type === 'CREDIT') creditMinor += amountMinor;
    if (entry.type === 'PAYMENT') paymentMinor += amountMinor;
  }
  return {
    totalCredit: creditMinor / 100,
    totalPayments: paymentMinor / 100,
    outstandingBalance: (creditMinor - paymentMinor) / 100,
    entryCount: entries.length,
  };
}

function safeEntry(entry) {
  return {
    id: String(entry._id ?? entry.id),
    customerId: String(entry.customerId),
    type: entry.type,
    amount: entry.amount,
    paymentMethod: entry.type === 'PAYMENT' ? entry.paymentMethod ?? null : null,
    note: entry.note ?? '',
    referenceId: entry.referenceId ?? null,
    createdAt: entry.createdAt,
  };
}

// Shared append boundary for normal Khata operations and transactional invoices.
function appendLedgerEntry(transaction, entry) {
  return transaction.createEntry(entry);
}

function createKhataService({ customerRepository, ledgerRepository, now = () => new Date() }) {
  async function requireCustomer(customerId, businessId) {
    const customer = await customerRepository.findById(customerId, businessId);
    if (!customer) throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
    return customer;
  }

  async function record(body, customerIdInput, businessIdInput, type) {
    const businessId = requireBusinessId(businessIdInput);
    const customerId = validateObjectId(customerIdInput, 'customer ID');
    await requireCustomer(customerId, businessId);
    const input = type === 'CREDIT' ? validateCredit(body) : validatePayment(body);

    return ledgerRepository.withCustomerTransaction(
      { businessId, customerId },
      async (transaction) => {
        const currentEntries = await transaction.listEntries();
        const currentSummary = calculateSummary(currentEntries);
        if (type === 'PAYMENT' && Math.round(input.amount * 100) > Math.round(currentSummary.outstandingBalance * 100)) {
          throw new ApiError(409, 'Payment cannot exceed the outstanding balance.', 'PAYMENT_EXCEEDS_BALANCE');
        }
        const entry = await appendLedgerEntry(transaction, {
          type,
          amount: input.amount,
          paymentMethod: type === 'PAYMENT' ? input.paymentMethod : null,
          note: input.note,
          referenceId: input.referenceId,
          createdAt: now(),
        });
        return {
          entry: safeEntry(entry),
          summary: calculateSummary([...currentEntries, entry]),
        };
      },
    );
  }

  return {
    recordCredit(body, customerId, businessId) {
      return record(body, customerId, businessId, 'CREDIT');
    },

    recordPayment(body, customerId, businessId) {
      return record(body, customerId, businessId, 'PAYMENT');
    },

    async getLedger(customerIdInput, query, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const customerId = validateObjectId(customerIdInput, 'customer ID');
      await requireCustomer(customerId, businessId);
      const pagination = validatePagination(query);
      const [pageResult, allEntries] = await Promise.all([
        ledgerRepository.listEntries({ businessId, customerId, ...pagination }),
        ledgerRepository.getAllEntries({ businessId, customerId }),
      ]);
      return {
        customerId,
        entries: pageResult.items.map(safeEntry),
        total: pageResult.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(pageResult.total / pagination.limit),
        summary: calculateSummary(allEntries),
      };
    },

    async getSummary(customerIdInput, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const customerId = validateObjectId(customerIdInput, 'customer ID');
      await requireCustomer(customerId, businessId);
      return {
        customerId,
        ...calculateSummary(await ledgerRepository.getAllEntries({ businessId, customerId })),
      };
    },

    async listOutstanding(query, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const pagination = validatePagination(query);
      const search = query.search === undefined ? undefined : String(query.search).trim();
      if (search && search.length > 100) {
        throw new ApiError(400, 'search must be 100 characters or fewer.', 'VALIDATION_ERROR');
      }
      const customers = await customerRepository.findForOutstanding({ businessId, search });
      const entries = await ledgerRepository.listEntriesForCustomers({
        businessId,
        customerIds: customers.map((customer) => String(customer._id ?? customer.id)),
      });
      const balances = new Map();
      for (const entry of entries) {
        const key = String(entry.customerId);
        const current = balances.get(key) || { credits: 0, payments: 0 };
        if (entry.type === 'CREDIT') current.credits += Math.round(entry.amount * 100);
        if (entry.type === 'PAYMENT') current.payments += Math.round(entry.amount * 100);
        balances.set(key, current);
      }

      const outstanding = customers.map((customer) => {
        const totals = balances.get(String(customer._id ?? customer.id)) || { credits: 0, payments: 0 };
        return {
          customer: {
            id: String(customer._id ?? customer.id),
            fullName: customer.fullName,
            phone: customer.phone,
            email: customer.email ?? null,
          },
          outstandingBalance: (totals.credits - totals.payments) / 100,
        };
      }).filter((record) => record.outstandingBalance > 0)
        .sort((a, b) => a.customer.fullName.localeCompare(b.customer.fullName));
      const items = outstanding.slice(pagination.skip, pagination.skip + pagination.limit);
      return {
        items,
        total: outstanding.length,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(outstanding.length / pagination.limit),
      };
    },
  };
}

module.exports = { appendLedgerEntry, calculateSummary, createKhataService };
