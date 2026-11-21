const { randomBytes } = require('node:crypto');

function copy(value) {
  return structuredClone(value);
}

function createInMemoryInvoiceRepositories({ products = [], customers = [], categories = [], failAfterTransactionCallback = false } = {}) {
  const state = { products: copy(products), customers: copy(customers), categories: copy(categories), invoices: [], payments: [], ledgerEntries: [], sequence: 0 };
  const productRepository = {
    async findById(id, businessId) {
      const product = state.products.find((entry) => entry.id === id && entry.businessId === businessId);
      return product ? copy(product) : null;
    },
  };
  const customerRepository = {
    async findById(id, businessId) {
      const customer = state.customers.find((entry) => entry.id === id && entry.businessId === businessId);
      return customer ? copy(customer) : null;
    },
  };
  const invoiceRepository = {
    async withTransaction(operation) {
      const draft = copy(state);
      const tx = {
        async findByIdempotencyKey(businessId, key) {
          return copy(draft.invoices.find((invoice) => invoice.businessId === businessId && invoice.idempotencyKey === key) || null);
        },
        async findProducts(ids, businessId) {
          return copy(draft.products.filter((product) => ids.includes(product.id) && product.businessId === businessId));
        },
        async findCategories(ids, businessId) {
          return copy(draft.categories.filter((category) => ids.includes(category.id) && category.businessId === businessId));
        },
        async findCustomer(id, businessId) {
          return copy(draft.customers.find((customer) => customer.id === id && customer.businessId === businessId) || null);
        },
        async nextInvoiceNumber() {
          draft.sequence += 1;
          return `INV-${String(draft.sequence).padStart(8, '0')}`;
        },
        async deductStock(id, businessId, quantity, updatedAt) {
          const product = draft.products.find((entry) => entry.id === id && entry.businessId === businessId);
          if (!product || product.stockQuantity < quantity) return false;
          product.stockQuantity -= quantity;
          product.updatedAt = updatedAt;
          return true;
        },
        async restoreStock(id, businessId, quantity, updatedAt) {
          const product = draft.products.find((entry) => entry.id === id && entry.businessId === businessId);
          if (!product) return false;
          product.stockQuantity += quantity;
          product.updatedAt = updatedAt;
          return true;
        },
        async createInvoice(invoice) {
          const saved = { ...copy(invoice), _id: randomBytes(12).toString('hex') };
          draft.invoices.push(saved);
          return copy(saved);
        },
        async findInvoice(id, businessId) {
          return copy(draft.invoices.find((invoice) => invoice._id === id && invoice.businessId === businessId) || null);
        },
        async findPaymentByIdempotencyKey(businessId, key) {
          return copy(draft.payments.find((payment) => payment.businessId === businessId && payment.idempotencyKey === key) || null);
        },
        async listOutstandingInvoices(customerId, businessId) {
          return copy(draft.invoices.filter((invoice) => invoice.businessId === businessId && invoice.customerId === customerId
            && invoice.paymentType === 'CREDIT' && invoice.status !== 'CANCELLED' && invoice.amountDue > 0)
            .sort((a, b) => a.createdAt - b.createdAt || a._id.localeCompare(b._id)));
        },
        async createPayment(payment) {
          const id = randomBytes(12).toString('hex');
          const created = { ...copy(payment), _id: id, paymentId: id };
          draft.payments.push(created);
          return copy(created);
        },
        async updateInvoicePayment(id, businessId, fields) {
          const invoice = draft.invoices.find((entry) => entry._id === id && entry.businessId === businessId
            && entry.status !== 'CANCELLED' && entry.status !== 'PAID' && entry.amountDue >= fields.increment);
          if (!invoice) return false;
          const updates = { ...fields };
          delete updates.increment;
          Object.assign(invoice, copy(updates));
          return true;
        },
        async listLedgerEntries(customerId, businessId) {
          return copy(draft.ledgerEntries.filter((entry) => entry.customerId === customerId && entry.businessId === businessId));
        },
        async createEntry(entry) {
          const saved = { ...copy(entry), _id: randomBytes(12).toString('hex') };
          draft.ledgerEntries.push(saved);
          return copy(saved);
        },
        async markCancelled(id, businessId, fields) {
          const invoice = draft.invoices.find((entry) => entry._id === id && entry.businessId === businessId);
          if (!invoice || invoice.status === 'CANCELLED') return null;
          Object.assign(invoice, copy(fields));
          return copy(invoice);
        },
      };
      const result = await operation(tx);
      if (failAfterTransactionCallback) throw new Error('simulated transaction commit failure');
      Object.assign(state, draft);
      return result;
    },
    async list(options) {
      let found = state.invoices.filter((invoice) => invoice.businessId === options.businessId);
      if (options.customerId) found = found.filter((invoice) => invoice.customerId === options.customerId);
      if (options.status) found = found.filter((invoice) => invoice.status === options.status);
      if (options.from) found = found.filter((invoice) => invoice.createdAt >= options.from);
      if (options.to) found = found.filter((invoice) => invoice.createdAt <= options.to);
      found.sort((a, b) => b.createdAt - a.createdAt || b._id.localeCompare(a._id));
      return { items: copy(found.slice(options.skip, options.skip + options.limit)), total: found.length,
        page: options.page, limit: options.limit, totalPages: Math.ceil(found.length / options.limit) };
    },
    async findById(id, businessId) {
      return copy(state.invoices.find((invoice) => invoice._id === id && invoice.businessId === businessId) || null);
    },
    async findByNumber(number, businessId) {
      return copy(state.invoices.find((invoice) => invoice.invoiceNumber === number && invoice.businessId === businessId) || null);
    },
    async listByCustomer(options) { return this.list(options); },
    async listPayments(options) {
      let found = state.payments.filter((payment) => payment.businessId === options.businessId);
      if (options.customerId) found = found.filter((payment) => payment.customerId === options.customerId);
      if (options.paymentMethod) found = found.filter((payment) => payment.paymentMethod === options.paymentMethod);
      if (options.invoiceId) found = found.filter((payment) => payment.allocations.some((allocation) => allocation.invoiceId === options.invoiceId));
      if (options.from) found = found.filter((payment) => payment.createdAt >= options.from);
      if (options.to) found = found.filter((payment) => payment.createdAt <= options.to);
      found.sort((a, b) => b.createdAt - a.createdAt || b._id.localeCompare(a._id));
      return { items: copy(found.slice(options.skip, options.skip + options.limit)), total: found.length,
        page: options.page, limit: options.limit, totalPages: Math.ceil(found.length / options.limit) };
    },
    async findPayment(id, businessId) {
      return copy(state.payments.find((payment) => payment._id === id && payment.businessId === businessId) || null);
    },
    async listTransactions(options) {
      const events = transactionEvents(state, options);
      return { items: copy(events.slice(options.skip, options.skip + options.limit)), total: events.length,
        page: options.page, limit: options.limit, totalPages: Math.ceil(events.length / options.limit) };
    },
    async findTransaction(id, businessId) {
      return copy(transactionEvents(state, { businessId }).find((event) => event.id === id) || null);
    },
    async paymentSummary({ businessId, from, to }) {
      const relevant = state.payments.filter((payment) => payment.businessId === businessId
        && (!from || payment.createdAt >= from) && (!to || payment.createdAt <= to));
      const keys = { CASH: 'cashPayments', UPI: 'upiPayments', CARD: 'cardPayments', BANK_TRANSFER: 'bankTransferPayments', OTHER: 'otherPayments' };
      const summary = { totalPaymentsReceived: 0, cashPayments: 0, upiPayments: 0, cardPayments: 0, bankTransferPayments: 0, otherPayments: 0 };
      for (const payment of relevant) { summary.totalPaymentsReceived += payment.amount; if (keys[payment.paymentMethod]) summary[keys[payment.paymentMethod]] += payment.amount; }
      for (const invoice of state.invoices.filter((entry) => entry.businessId === businessId && entry.paymentType === 'CASH'
        && entry.status !== 'CANCELLED' && (!from || entry.createdAt >= from) && (!to || entry.createdAt <= to))) {
        summary.totalPaymentsReceived += invoice.totalAmount; summary.cashPayments += invoice.totalAmount;
      }
      const ledger = state.ledgerEntries.filter((entry) => entry.businessId === businessId);
      let credits = 0;
      let payments = 0;
      for (const entry of ledger) {
        if (entry.type === 'CREDIT') credits += Math.round(entry.amount * 100);
        if (entry.type === 'PAYMENT') {
          const amount = Math.round(entry.amount * 100);
          payments += amount;
          const linked = String(entry.referenceId || '').startsWith('payment:')
            || String(entry.referenceId || '').startsWith('invoice-cancel:');
          if (!linked && (!from || entry.createdAt >= from) && (!to || entry.createdAt <= to)) {
            summary.totalPaymentsReceived += amount;
            if (keys[entry.paymentMethod]) summary[keys[entry.paymentMethod]] += amount;
          }
        }
      }
      const outstandingCustomerDues = credits - payments;
      const invoiceCounts = { unpaidInvoices: 0, partiallyPaidInvoices: 0, paidInvoices: 0 };
      for (const invoice of state.invoices.filter((entry) => entry.businessId === businessId && entry.status !== 'CANCELLED')) {
        if (invoice.amountDue === 0) invoiceCounts.paidInvoices += 1;
        else if (invoice.amountPaid > 0) invoiceCounts.partiallyPaidInvoices += 1;
        else invoiceCounts.unpaidInvoices += 1;
      }
      return { ...summary, outstandingCustomerDues: Math.max(0, outstandingCustomerDues), ...invoiceCounts,
        paymentPeriod: { from: from ?? null, to: to ?? null }, outstandingBalanceAsOf: new Date() };
    },
  };
  return { state, invoiceRepository, productRepository, customerRepository };
}

function transactionEvents(state, options) {
  const events = [];
  for (const invoice of state.invoices.filter((item) => item.businessId === options.businessId
    && (!options.customerId || item.customerId === options.customerId)
    && (!options.invoiceId || item._id === options.invoiceId))) {
    if ((!options.from || invoice.createdAt >= options.from) && (!options.to || invoice.createdAt <= options.to)
      && (!options.type || options.type === 'INVOICE_CREATED') && !options.paymentMethod) {
      events.push({ id: `invoice:${invoice._id}:created`, type: 'INVOICE_CREATED', invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId, amount: invoice.totalAmount, createdAt: invoice.createdAt });
    }
    const cancelledAt = invoice.cancellation?.cancelledAt;
    if (cancelledAt && (!options.from || cancelledAt >= options.from) && (!options.to || cancelledAt <= options.to)
      && (!options.type || options.type === 'INVOICE_CANCELLED') && !options.paymentMethod) {
      events.push({ id: `invoice:${invoice._id}:cancelled`, type: 'INVOICE_CANCELLED', invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId, amount: invoice.totalAmount, createdAt: cancelledAt });
    }
  }
  for (const payment of state.payments.filter((item) => item.businessId === options.businessId
    && (!options.customerId || item.customerId === options.customerId)
    && (!options.invoiceId || item.allocations.some((allocation) => allocation.invoiceId === options.invoiceId))
    && (!options.paymentMethod || item.paymentMethod === options.paymentMethod)
    && (!options.from || item.createdAt >= options.from) && (!options.to || item.createdAt <= options.to)
    && (!options.type || options.type === 'PAYMENT_RECEIVED'))) {
    events.push({ id: `payment:${payment._id}`, type: 'PAYMENT_RECEIVED', paymentId: payment._id, customerId: payment.customerId,
      amount: payment.amount, paymentMethod: payment.paymentMethod, allocations: payment.allocations, createdAt: payment.createdAt });
  }
  for (const entry of state.ledgerEntries.filter((item) => item.businessId === options.businessId
    && (!options.customerId || item.customerId === options.customerId)
    && (!options.from || item.createdAt >= options.from) && (!options.to || item.createdAt <= options.to)
    && (!String(item.referenceId || '').startsWith('payment:')))) {
    const type = entry.type === 'CREDIT' ? 'CREDIT_RECORDED' : 'KHATA_PAYMENT';
    if (options.type && options.type !== type) continue;
    if (options.paymentMethod && options.paymentMethod !== entry.paymentMethod) continue;
    if (options.invoiceId && !String(entry.referenceId || '').includes(options.invoiceId)) continue;
    events.push({ id: `ledger:${entry._id}`, type, customerId: entry.customerId, amount: Math.round(entry.amount * 100),
      paymentMethod: entry.paymentMethod ?? null, referenceId: entry.referenceId ?? null, note: entry.note || '', createdAt: entry.createdAt });
  }
  return events.filter((event) => !options.invoiceId || event.invoiceId === options.invoiceId
    || event.allocations?.some((allocation) => allocation.invoiceId === options.invoiceId)
    || String(event.referenceId || '').includes(options.invoiceId))
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

module.exports = { createInMemoryInvoiceRepositories };
