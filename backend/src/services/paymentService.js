const ApiError = require('../errors/ApiError');
const { appendLedgerEntry, calculateSummary } = require('./khataService');
const { validateObjectId } = require('../validators/inventoryValidation');
const { validatePaymentBody, validatePaymentQuery, validateTransactionQuery } = require('../validators/paymentValidation');

function scope(value) {
  if (!value) throw new ApiError(401, 'Authenticated business context is missing.', 'BUSINESS_CONTEXT_REQUIRED');
  return String(value);
}
function idOf(record) { return String(record?._id ?? record?.id ?? record?.paymentId); }
function safePayment(payment) {
  if (!payment) return payment;
  const { _id, businessId: _businessId, idempotencyKey: _idempotencyKey, ...safe } = payment;
  const id = String(_id ?? payment.id ?? payment.paymentId);
  return { ...safe, id, paymentId: id };
}
function safeInvoice(invoice) {
  const { _id, ...rest } = invoice;
  return { ...rest, id: String(_id ?? invoice.id) };
}
function statusFor(amountPaid, amountDue) {
  if (amountDue === 0) return 'PAID';
  if (amountPaid === 0) return 'UNPAID';
  return 'PARTIALLY_PAID';
}

function createPaymentService({ invoiceRepository, customerRepository, now = () => new Date() }) {
  async function receivePayment({ customerId, invoiceId, body, idempotencyKey, businessId: businessInput }) {
    const businessId = scope(businessInput);
    const customerLevel = Boolean(customerId);
    const customer = customerLevel ? validateObjectId(customerId, 'customer ID') : null;
    const invoice = invoiceId ? validateObjectId(invoiceId, 'invoice ID') : null;
    const input = validatePaymentBody(body, { customerLevel, idempotencyKey });
    if (customerLevel && !await customerRepository.findById(customer, businessId)) {
      throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
    }
    return invoiceRepository.withTransaction(async (transaction) => {
      if (input.idempotencyKey) {
        const prior = await transaction.findPaymentByIdempotencyKey(businessId, input.idempotencyKey);
        if (prior) return safePayment(prior);
      }
      const selectedCustomer = customer || (invoice ? null : null);
      let targetCustomerId = selectedCustomer;
      if (invoice) {
        const target = await transaction.findInvoice(invoice, businessId);
        if (!target) throw new ApiError(404, 'Invoice not found.', 'INVOICE_NOT_FOUND');
        if (!target.customerId) throw new ApiError(409, 'Walk-in invoices cannot receive account payments.', 'INVOICE_NOT_CREDIT');
        targetCustomerId = String(target.customerId);
      }
      if (!targetCustomerId) throw new ApiError(400, 'A customer or invoice is required for payment allocation.', 'CUSTOMER_REQUIRED');
      const lockedCustomer = await transaction.findCustomer(targetCustomerId, businessId);
      if (!lockedCustomer) throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');

      let allocations;
      if (invoice) {
        const target = await transaction.findInvoice(invoice, businessId);
        allocations = [{ invoiceId: invoice, allocatedAmount: input.amount }];
        applyEligibility(target, targetCustomerId, input.amount);
      } else if (input.allocations) {
        allocations = input.allocations;
        for (const allocation of allocations) {
          const target = await transaction.findInvoice(allocation.invoiceId, businessId);
          applyEligibility(target, targetCustomerId, allocation.allocatedAmount);
        }
      } else {
        const outstanding = await transaction.listOutstandingInvoices(targetCustomerId, businessId);
        let remaining = input.amount;
        allocations = [];
        for (const target of outstanding) {
          const due = Math.max(0, target.amountDue);
          if (!due) continue;
          const allocatedAmount = Math.min(remaining, due);
          allocations.push({ invoiceId: String(target._id ?? target.id), allocatedAmount });
          remaining -= allocatedAmount;
          if (!remaining) break;
        }
        if (remaining > 0) throw new ApiError(409, 'Payment exceeds total eligible invoice dues.', 'PAYMENT_EXCEEDS_INVOICE_DUES');
      }
      const allocatedTotal = allocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0);
      if (allocatedTotal !== input.amount) throw new ApiError(400, 'Allocation totals must equal the payment amount.', 'ALLOCATION_TOTAL_MISMATCH');

      const ledgerEntries = await transaction.listLedgerEntries(targetCustomerId, businessId);
      const currentBalance = Math.round(calculateSummary(ledgerEntries).outstandingBalance * 100);
      if (input.amount > currentBalance) throw new ApiError(409, "Payment cannot exceed the customer's Khata balance.", 'PAYMENT_EXCEEDS_BALANCE');

      const createdAt = now();
      const payment = await transaction.createPayment({
        businessId,
        customerId: targetCustomerId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        allocations,
        note: input.note,
        referenceNumber: input.referenceNumber,
        idempotencyKey: input.idempotencyKey ?? null,
        createdAt,
      });
      for (const allocation of allocations) {
        const target = await transaction.findInvoice(allocation.invoiceId, businessId);
        applyEligibility(target, targetCustomerId, allocation.allocatedAmount);
        const amountPaid = target.amountPaid + allocation.allocatedAmount;
        const amountDue = target.totalAmount - amountPaid;
        if (!await transaction.updateInvoicePayment(allocation.invoiceId, businessId, {
          increment: allocation.allocatedAmount,
          amountPaid, amountDue, status: statusFor(amountPaid, amountDue), updatedAt: createdAt,
        })) throw new ApiError(409, 'Invoice balance changed while applying payment.', 'INVOICE_PAYMENT_CONFLICT');
      }
      await appendLedgerEntry(transaction, {
        businessId,
        customerId: targetCustomerId,
        type: 'PAYMENT',
        amount: input.amount / 100,
        paymentMethod: input.paymentMethod,
        note: input.note || `Payment ${idOf(payment)}`,
        referenceId: `payment:${idOf(payment)}`,
        createdAt,
      });
      return safePayment(payment);
    }).catch(async (error) => {
      if (input.idempotencyKey && error?.code === 'IDEMPOTENCY_KEY_CONFLICT') {
        const prior = await invoiceRepository.findPaymentByIdempotencyKey(businessId, input.idempotencyKey);
        if (prior) return safePayment(prior);
      }
      throw error;
    });
  }

  return {
    payInvoice(invoiceId, body, idempotencyKey, businessId) {
      return receivePayment({ invoiceId, body, idempotencyKey, businessId });
    },
    payCustomer(customerId, body, idempotencyKey, businessId) {
      return receivePayment({ customerId, body, idempotencyKey, businessId });
    },
    async listPayments(query, businessInput) {
      const businessId = scope(businessInput);
      return invoiceRepository.listPayments({ businessId, ...validatePaymentQuery(query) });
    },
    async getPayment(idInput, businessInput) {
      const businessId = scope(businessInput);
      const id = validateObjectId(idInput, 'payment ID');
      const payment = await invoiceRepository.findPayment(id, businessId);
      if (!payment) throw new ApiError(404, 'Payment not found.', 'PAYMENT_NOT_FOUND');
      return safePayment(payment);
    },
    async summary(query, businessInput) {
      const businessId = scope(businessInput);
      const filters = validatePaymentQuery(query);
      return invoiceRepository.paymentSummary({ businessId, from: filters.from, to: filters.to });
    },
    async listTransactions(query, businessInput) {
      const businessId = scope(businessInput);
      return invoiceRepository.listTransactions({ businessId, ...validateTransactionQuery(query) });
    },
    async getTransaction(idInput, businessInput) {
      const businessId = scope(businessInput);
      if (typeof idInput !== 'string' || idInput.length > 200) throw new ApiError(400, 'transaction ID is invalid.', 'VALIDATION_ERROR');
      const transaction = await invoiceRepository.findTransaction(idInput, businessId);
      if (!transaction) throw new ApiError(404, 'Transaction not found.', 'TRANSACTION_NOT_FOUND');
      return transaction;
    },
  };
}

function applyEligibility(invoice, customerId, amount) {
  if (!invoice) throw new ApiError(404, 'Invoice not found.', 'INVOICE_NOT_FOUND');
  if (String(invoice.customerId) !== String(customerId)) throw new ApiError(404, 'Invoice not found for this customer.', 'INVOICE_NOT_FOUND');
  if (invoice.paymentType !== 'CREDIT' || invoice.status === 'CANCELLED' || invoice.amountDue <= 0) {
    throw new ApiError(409, 'Only outstanding CREDIT invoices can receive payments.', 'INVOICE_NOT_PAYABLE');
  }
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > invoice.amountDue) {
    throw new ApiError(409, 'Payment exceeds the invoice outstanding amount.', 'PAYMENT_EXCEEDS_INVOICE_DUE');
  }
}

module.exports = { createPaymentService, safePayment, statusFor };
