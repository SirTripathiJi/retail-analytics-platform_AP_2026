const { ObjectId } = require('mongodb');
const ApiError = require('../errors/ApiError');

function toPublic(document) {
  if (!document) return null;
  return { ...document, _id: String(document._id), customerId: document.customerId ? String(document.customerId) : null };
}

/**
 * Invoice/stock/ledger adapter for an injected tenant Db. The tenant selector
 * must supply a replica-set Db; no connection is created here.
 * TODO: tenant integration must inject the selected business Db and provision
 * the indexes described in README.md before enabling these APIs.
 */
function createMongoInvoiceRepository(database) {
  if (!database || typeof database.collection !== 'function') throw new TypeError('A MongoDB database handle is required.');
  const invoices = database.collection('invoices');
  const products = database.collection('products');
  const categories = database.collection('categories');
  const customers = database.collection('customers');
  const ledger = database.collection('customerLedger');
  const payments = database.collection('payments');
  const sequences = database.collection('invoiceSequences');

  function unavailableTransaction(error) {
    return error?.code === 20 || error?.codeName === 'IllegalOperation'
      || error?.codeName === 'TransactionNumbersAreOnlyAllowedOn a ReplicaSetMemberOr mongos';
  }
  async function withTransaction(operation) {
    if (!database.client || typeof database.client.startSession !== 'function') {
      throw new ApiError(503, 'Invoice transactions are not configured.', 'INVOICE_TRANSACTION_UNAVAILABLE');
    }
    const session = database.client.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        result = await operation({
          async findByIdempotencyKey(businessId, key) {
            return toPublic(await invoices.findOne({ businessId, idempotencyKey: key }, { session }));
          },
          async findProducts(ids, businessId) {
            return (await products.find({ _id: { $in: ids.map((id) => new ObjectId(id)) }, businessId }, { session }).toArray())
              .map((product) => ({ ...product, _id: String(product._id) }));
          },
          async findCategories(ids, businessId) {
            return (await categories.find({ _id: { $in: ids.map((id) => new ObjectId(id)) }, businessId }, { session }).toArray())
              .map((category) => ({ ...category, _id: String(category._id) }));
          },
          async findCustomer(customerId, businessId) {
            const lock = await customers.updateOne(
              { _id: new ObjectId(customerId), businessId }, { $inc: { ledgerRevision: 1 } }, { session },
            );
            if (!lock.matchedCount) return null;
            return customers.findOne({ _id: new ObjectId(customerId), businessId }, { session });
          },
          async nextInvoiceNumber(businessId) {
            const sequence = await sequences.findOneAndUpdate(
              { _id: businessId }, { $inc: { value: 1 } },
              { upsert: true, returnDocument: 'after', session },
            );
            const value = sequence?.value?.value ?? sequence?.value;
            if (!Number.isSafeInteger(value)) throw new Error('Invoice sequence did not return a valid value.');
            return `INV-${String(value).padStart(8, '0')}`;
          },
          async deductStock(productId, businessId, quantity, updatedAt) {
            const result = await products.updateOne(
              { _id: new ObjectId(productId), businessId, stockQuantity: { $gte: quantity } },
              { $inc: { stockQuantity: -quantity }, $set: { updatedAt } }, { session },
            );
            return result.modifiedCount === 1;
          },
          async restoreStock(productId, businessId, quantity, updatedAt) {
            const result = await products.updateOne(
              { _id: new ObjectId(productId), businessId },
              { $inc: { stockQuantity: quantity }, $set: { updatedAt } }, { session },
            );
            return result.matchedCount === 1;
          },
          async createInvoice(invoice) {
            const document = { ...invoice, customerId: invoice.customerId ? new ObjectId(invoice.customerId) : null };
            const inserted = await invoices.insertOne(document, { session });
            return toPublic({ ...document, _id: inserted.insertedId });
          },
          async findInvoice(id, businessId) {
            return toPublic(await invoices.findOne({ _id: new ObjectId(id), businessId }, { session }));
          },
          async findPaymentByIdempotencyKey(businessId, key) {
            return toPayment(await payments.findOne({ businessId, idempotencyKey: key }, { session }));
          },
          async listOutstandingInvoices(customerId, businessId) {
            return (await invoices.find({ businessId, customerId: new ObjectId(customerId), paymentType: 'CREDIT',
              status: { $nin: ['CANCELLED', 'PAID'] }, amountDue: { $gt: 0 } }, { session })
              .sort({ createdAt: 1, _id: 1 }).toArray()).map(toPublic);
          },
          async createPayment(payment) {
            const paymentObjectId = new ObjectId();
            const document = { ...payment, _id: paymentObjectId, paymentId: paymentObjectId.toHexString(),
              customerId: new ObjectId(payment.customerId), businessId: payment.businessId };
            await payments.insertOne(document, { session });
            return toPayment(document);
          },
          async updateInvoicePayment(id, businessId, fields) {
            const { increment, ...updates } = fields;
            const result = await invoices.updateOne(
              { _id: new ObjectId(id), businessId, status: { $nin: ['CANCELLED', 'PAID'] }, amountDue: { $gte: increment } },
              { $set: updates }, { session },
            );
            return result.matchedCount === 1;
          },
          async listLedgerEntries(customerId, businessId) {
            return ledger.find({ customerId: new ObjectId(customerId), businessId }, { session })
              .sort({ createdAt: 1, _id: 1 }).toArray();
          },
          async createEntry(entry) {
            const document = { ...entry, customerId: new ObjectId(entry.customerId) };
            const inserted = await ledger.insertOne(document, { session });
            return { ...document, _id: String(inserted.insertedId), customerId: String(document.customerId) };
          },
          async markCancelled(id, businessId, fields) {
            const result = await invoices.findOneAndUpdate(
              { _id: new ObjectId(id), businessId, status: { $ne: 'CANCELLED' } },
              { $set: fields }, { returnDocument: 'after', session },
            );
            const document = result?.value ?? result;
            return toPublic(document);
          },
        });
      });
      return result;
    } catch (error) {
      if (unavailableTransaction(error)) {
        throw new ApiError(503, 'The database does not support required invoice transactions.', 'INVOICE_TRANSACTION_UNAVAILABLE');
      }
      if (error?.code === 11000) throw new ApiError(409, 'A record with this business-scoped identifier already exists.', 'DUPLICATE_RECORD');
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async function list(options) {
    const filter = { businessId: options.businessId };
    if (options.customerId) filter.customerId = new ObjectId(options.customerId);
    if (options.status) filter.status = options.status;
    if (options.from || options.to) filter.createdAt = {
      ...(options.from ? { $gte: options.from } : {}), ...(options.to ? { $lte: options.to } : {}),
    };
    const [items, total] = await Promise.all([
      invoices.find(filter).sort(options.sort || { createdAt: -1 }).skip(options.skip).limit(options.limit).toArray(),
      invoices.countDocuments(filter),
    ]);
    return { items: items.map(toPublic), total, page: options.page, limit: options.limit, totalPages: Math.ceil(total / options.limit) };
  }

  function paymentFilter(options) {
    const filter = { businessId: options.businessId };
    if (options.customerId) filter.customerId = new ObjectId(options.customerId);
    if (options.invoiceId) filter['allocations.invoiceId'] = options.invoiceId;
    if (options.paymentMethod) filter.paymentMethod = options.paymentMethod;
    if (options.from || options.to) filter.createdAt = {
      ...(options.from ? { $gte: options.from } : {}), ...(options.to ? { $lte: options.to } : {}),
    };
    return filter;
  }

  async function listPayments(options) {
    const filter = paymentFilter(options);
    const [items, total] = await Promise.all([
      payments.find(filter).sort({ createdAt: -1, _id: -1 }).skip(options.skip).limit(options.limit).toArray(),
      payments.countDocuments(filter),
    ]);
    return { items: items.map(toPayment), total, page: options.page, limit: options.limit, totalPages: Math.ceil(total / options.limit) };
  }

  async function transactionEvents(options) {
    const timeFilter = options.from || options.to ? { createdAt: {
      ...(options.from ? { $gte: options.from } : {}), ...(options.to ? { $lte: options.to } : {}),
    } } : {};
    const base = { businessId: options.businessId, ...timeFilter };
    const [invoiceDocs, paymentDocs, ledgerDocs] = await Promise.all([
      invoices.find({ businessId: options.businessId, ...(options.customerId ? { customerId: new ObjectId(options.customerId) } : {}),
        ...(options.invoiceId ? { _id: new ObjectId(options.invoiceId) } : {}) }).toArray(),
      payments.find({ ...base, ...(options.customerId ? { customerId: new ObjectId(options.customerId) } : {}),
        ...(options.invoiceId ? { 'allocations.invoiceId': options.invoiceId } : {}),
        ...(options.paymentMethod ? { paymentMethod: options.paymentMethod } : {}) }).toArray(),
      ledger.find({ ...base, ...(options.customerId ? { customerId: new ObjectId(options.customerId) } : {}),
        ...(options.paymentMethod ? { paymentMethod: options.paymentMethod } : {}) }).toArray(),
    ]);
    const events = [];
    for (const invoice of invoiceDocs) {
      const id = String(invoice._id);
      const inCreatedRange = (!options.from || invoice.createdAt >= options.from) && (!options.to || invoice.createdAt <= options.to);
      if (inCreatedRange && (!options.type || options.type === 'INVOICE_CREATED')) events.push({
        id: `invoice:${id}:created`, type: 'INVOICE_CREATED', invoiceId: id,
        invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId ? String(invoice.customerId) : null,
        amount: invoice.totalAmount, createdAt: invoice.createdAt,
      });
      if (invoice.cancellation?.cancelledAt && (!options.from || invoice.cancellation.cancelledAt >= options.from)
        && (!options.to || invoice.cancellation.cancelledAt <= options.to)
        && (!options.type || options.type === 'INVOICE_CANCELLED')) events.push({
        id: `invoice:${id}:cancelled`, type: 'INVOICE_CANCELLED', invoiceId: id,
        invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId ? String(invoice.customerId) : null,
        amount: invoice.totalAmount, createdAt: invoice.cancellation.cancelledAt,
      });
    }
    for (const payment of paymentDocs) if (!options.type || options.type === 'PAYMENT_RECEIVED') events.push({
      id: `payment:${payment._id}`, type: 'PAYMENT_RECEIVED', paymentId: String(payment._id),
      customerId: String(payment.customerId), amount: payment.amount, paymentMethod: payment.paymentMethod,
      allocations: payment.allocations, referenceNumber: payment.referenceNumber ?? null, createdAt: payment.createdAt,
    });
    for (const entry of ledgerDocs) {
      if (String(entry.referenceId || '').startsWith('payment:')) continue;
      const type = entry.type === 'CREDIT' ? 'CREDIT_RECORDED' : 'KHATA_PAYMENT';
      if (options.type && options.type !== type) continue;
      if (options.invoiceId && !String(entry.referenceId || '').includes(options.invoiceId)) continue;
      if (options.paymentMethod && entry.paymentMethod !== options.paymentMethod) continue;
      events.push({ id: `ledger:${entry._id}`, type, customerId: String(entry.customerId),
        amount: Math.round(entry.amount * 100), paymentMethod: entry.paymentMethod ?? null,
        referenceId: entry.referenceId ?? null, note: entry.note ?? '', createdAt: entry.createdAt });
    }
    return events.filter((event) => !options.customerId || event.customerId === options.customerId)
      .filter((event) => !options.paymentMethod || event.paymentMethod === options.paymentMethod)
      .filter((event) => !options.invoiceId || event.invoiceId === options.invoiceId
        || event.allocations?.some((allocation) => allocation.invoiceId === options.invoiceId)
        || String(event.referenceId || '').includes(options.invoiceId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || a.id.localeCompare(b.id));
  }

  return {
    withTransaction,
    list,
    listPayments,
    async findPayment(id, businessId) { return toPayment(await payments.findOne({ _id: new ObjectId(id), businessId })); },
    async listTransactions(options) {
      const events = await transactionEvents(options);
      const items = events.slice(options.skip, options.skip + options.limit);
      return { items, total: events.length, page: options.page, limit: options.limit, totalPages: Math.ceil(events.length / options.limit) };
    },
    async findTransaction(id, businessId) {
      const parts = id.split(':');
      if (parts[0] === 'payment' && parts.length === 2) {
        if (!/^[a-f\d]{24}$/i.test(parts[1])) return null;
        const events = await transactionEvents({ businessId });
        return events.find((event) => event.id === id) ?? null;
      }
      if (parts[0] === 'invoice' && parts.length === 3 && ['created', 'cancelled'].includes(parts[2])) {
        if (!/^[a-f\d]{24}$/i.test(parts[1])) return null;
        const invoice = await invoices.findOne({ _id: new ObjectId(parts[1]), businessId });
        if (!invoice || (parts[2] === 'cancelled' && !invoice.cancellation?.cancelledAt)) return null;
        const events = await transactionEvents({ businessId });
        return events.find((event) => event.id === id) ?? null;
      }
      if (parts[0] === 'ledger' && parts.length === 2) {
        if (!/^[a-f\d]{24}$/i.test(parts[1])) return null;
        const entry = await ledger.findOne({ _id: new ObjectId(parts[1]), businessId });
        if (!entry || String(entry.referenceId || '').startsWith('payment:')) return null;
        const type = entry.type === 'CREDIT' ? 'CREDIT_RECORDED' : 'KHATA_PAYMENT';
        return { id, type, customerId: String(entry.customerId), amount: Math.round(entry.amount * 100),
          paymentMethod: entry.paymentMethod ?? null, referenceId: entry.referenceId ?? null,
          note: entry.note ?? '', createdAt: entry.createdAt };
      }
      return null;
    },
    async paymentSummary({ businessId, from, to }) {
      const paymentDateFilter = from || to ? { createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {};
      const [periodPayments, invoicesForSummary, ledgerEntries] = await Promise.all([
        payments.find({ businessId, ...paymentDateFilter }).toArray(),
        invoices.find({ businessId }).toArray(),
        ledger.find({ businessId }).toArray(),
      ]);
      const totals = { totalPaymentsReceived: 0, cashPayments: 0, upiPayments: 0, cardPayments: 0, bankTransferPayments: 0, otherPayments: 0 };
      const keys = { CASH: 'cashPayments', UPI: 'upiPayments', CARD: 'cardPayments', BANK_TRANSFER: 'bankTransferPayments', OTHER: 'otherPayments' };
      for (const payment of periodPayments) {
        totals.totalPaymentsReceived += payment.amount;
        if (keys[payment.paymentMethod]) totals[keys[payment.paymentMethod]] += payment.amount;
      }
      for (const invoice of invoicesForSummary) {
        if (invoice.paymentType === 'CASH' && invoice.status !== 'CANCELLED'
          && (!from || invoice.createdAt >= from) && (!to || invoice.createdAt <= to)) {
          totals.totalPaymentsReceived += invoice.totalAmount;
          totals.cashPayments += invoice.totalAmount;
        }
      }
      let credit = 0;
      let paid = 0;
      for (const entry of ledgerEntries) {
        if (entry.type === 'CREDIT') credit += Math.round(entry.amount * 100);
        if (entry.type === 'PAYMENT') {
          const amount = Math.round(entry.amount * 100);
          paid += amount;
          const linked = String(entry.referenceId || '').startsWith('payment:')
            || String(entry.referenceId || '').startsWith('invoice-cancel:');
          if (!linked && (!from || entry.createdAt >= from) && (!to || entry.createdAt <= to)) {
            totals.totalPaymentsReceived += amount;
            if (keys[entry.paymentMethod]) totals[keys[entry.paymentMethod]] += amount;
          }
        }
      }
      const invoiceCounts = { unpaidInvoices: 0, partiallyPaidInvoices: 0, paidInvoices: 0 };
      for (const invoice of invoicesForSummary) {
        if (invoice.status === 'CANCELLED') continue;
        if (invoice.amountDue === 0 || invoice.status === 'PAID') invoiceCounts.paidInvoices += 1;
        else if (invoice.amountPaid > 0) invoiceCounts.partiallyPaidInvoices += 1;
        else invoiceCounts.unpaidInvoices += 1;
      }
      return { ...totals, outstandingCustomerDues: Math.max(0, credit - paid), ...invoiceCounts,
        paymentPeriod: { from: from ?? null, to: to ?? null },
        outstandingBalanceAsOf: new Date() };
    },
    async findById(id, businessId) { return toPublic(await invoices.findOne({ _id: new ObjectId(id), businessId })); },
    async findByNumber(invoiceNumber, businessId) { return toPublic(await invoices.findOne({ invoiceNumber, businessId })); },
    listByCustomer(options) { return list({ ...options, sort: { createdAt: -1, _id: -1 } }); },
  };
}

function toPayment(document) {
  if (!document) return null;
  return { ...document, _id: String(document._id), paymentId: String(document.paymentId ?? document._id), customerId: String(document.customerId),
    allocations: (document.allocations || []).map((allocation) => ({ ...allocation, invoiceId: String(allocation.invoiceId) })) };
}

module.exports = { createMongoInvoiceRepository };
