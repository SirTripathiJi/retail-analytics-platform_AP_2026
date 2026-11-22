const ApiError = require('../errors/ApiError');
const { appendLedgerEntry, calculateSummary } = require('./khataService');
const { validateObjectId } = require('../validators/inventoryValidation');
const { validateCreateInvoice, validateInvoiceQuery } = require('../validators/invoiceValidation');

function businessScope(value) {
  if (!value) throw new ApiError(401, 'Authenticated business context is missing.', 'BUSINESS_CONTEXT_REQUIRED');
  return String(value);
}
function publicInvoice(invoice) {
  if (!invoice) return invoice;
  const { _id, businessId: _businessId, idempotencyKey: _idempotencyKey, createdBy: _createdBy, ...safe } = invoice;
  return { ...safe, id: String(_id ?? invoice.id) };
}
function storedPaise(amount, field) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0
    || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8) {
    throw new ApiError(500, `Stored product ${field} is invalid.`, 'INVALID_PRODUCT_PRICE');
  }
  const paise = Math.round(amount * 100);
  if (!Number.isSafeInteger(paise)) throw new ApiError(500, `Stored product ${field} is invalid.`, 'INVALID_PRODUCT_PRICE');
  return paise;
}

function createInvoiceService({ invoiceRepository, productRepository, customerRepository, now = () => new Date() }) {
  return {
    async create(body, idempotencyKey, businessValue, userId) {
      const businessId = businessScope(businessValue);
      const input = validateCreateInvoice(body, idempotencyKey);
      if (input.paymentType === 'CREDIT' && !input.customerId) {
        throw new ApiError(400, 'A customer is required for CREDIT invoices.', 'CUSTOMER_REQUIRED_FOR_CREDIT');
      }
      return invoiceRepository.withTransaction(async (transaction) => {
        if (input.idempotencyKey) {
          const existing = await transaction.findByIdempotencyKey(businessId, input.idempotencyKey);
          if (existing) return publicInvoice(existing);
        }
        const products = await transaction.findProducts(input.items.map((item) => item.productId), businessId);
        const byId = new Map(products.map((product) => [String(product._id ?? product.id), product]));
        if (byId.size !== input.items.length) throw new ApiError(404, 'One or more products were not found.', 'PRODUCT_NOT_FOUND');
        const categoryIds = [...new Set(products.map((product) => product.categoryId).filter(Boolean).map(String))];
        const categories = categoryIds.length && transaction.findCategories
          ? await transaction.findCategories(categoryIds, businessId) : [];
        const categoryById = new Map(categories.map((category) => [String(category._id ?? category.id), category]));
        const items = input.items.map(({ productId, quantity }) => {
          const product = byId.get(productId);
          if (!product) throw new ApiError(404, 'One or more products were not found.', 'PRODUCT_NOT_FOUND');
          if (product.stockQuantity < quantity) throw new ApiError(409, `Insufficient stock for ${product.name}.`, 'INSUFFICIENT_STOCK');
          const sellingPrice = storedPaise(product.sellingPrice, 'sellingPrice');
          const purchasePrice = storedPaise(product.purchasePrice, 'purchasePrice');
          const lineTotal = sellingPrice * quantity;
          const lineCost = purchasePrice * quantity;
          if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(lineCost)) {
            throw new ApiError(400, 'Invoice item totals exceed the safe monetary range.', 'INVOICE_AMOUNT_TOO_LARGE');
          }
          return {
            productId: productId,
            productName: product.name,
            categoryId: product.categoryId ? String(product.categoryId) : null,
            categoryName: categoryById.get(String(product.categoryId))?.name ?? null,
            sku: product.sku ?? null,
            quantity,
            unit: product.unit ?? 'unit',
            sellingPrice,
            purchasePrice,
            lineTotal,
            lineCost,
            lineProfit: lineTotal - lineCost,
          };
        });
        if (input.customerId) {
          const customer = await transaction.findCustomer(input.customerId, businessId);
          if (!customer) throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
        }
        const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
        const additionalCharges = input.additionalChargeItems.reduce((sum, charge) => sum + charge.total, 0);
        const gross = subtotal + additionalCharges;
        if (!Number.isSafeInteger(gross) || input.discount > gross) throw new ApiError(400, 'Discount cannot exceed the subtotal and additional charges.', 'INVALID_DISCOUNT');
        const totalAmount = gross - input.discount;
        if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) {
          throw new ApiError(400, 'Invoice total must be a positive safe amount.', 'INVALID_INVOICE_TOTAL');
        }
        const totalCost = items.reduce((sum, item) => sum + item.lineCost, 0);
        // Allocate invoice-level discounts across product snapshots proportionally so
        // historical product/category revenue and profit reflect the paid invoice.
        const productDiscount = gross > 0 ? Math.round((input.discount * subtotal) / gross) : 0;
        let remainingProductDiscount = productDiscount;
        const analyticsItems = items.map((item, index) => {
          const share = index === items.length - 1 ? remainingProductDiscount
            : subtotal > 0 ? Math.floor((productDiscount * item.lineTotal) / subtotal) : 0;
          remainingProductDiscount -= share;
          const analyticsRevenue = item.lineTotal - share;
          return { ...item, analyticsRevenue, analyticsProfit: analyticsRevenue - item.lineCost };
        });
        const timestamp = now();
        const invoice = {
          invoiceNumber: await transaction.nextInvoiceNumber(businessId),
          businessId,
          customerId: input.customerId,
          items: analyticsItems,
          additionalChargeItems: input.additionalChargeItems,
          subtotal,
          additionalCharges,
          discount: input.discount,
          totalAmount,
          totalCost,
          totalProfit: totalAmount - totalCost,
          paymentType: input.paymentType,
          amountPaid: input.paymentType === 'CASH' ? totalAmount : 0,
          amountDue: input.paymentType === 'CREDIT' ? totalAmount : 0,
          status: input.paymentType === 'CASH' ? 'PAID' : 'UNPAID',
          idempotencyKey: input.idempotencyKey ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: String(userId),
        };
        for (const item of input.items) {
          if (!await transaction.deductStock(item.productId, businessId, item.quantity, timestamp)) {
            throw new ApiError(409, 'Stock changed during billing; retry the invoice.', 'INSUFFICIENT_STOCK');
          }
        }
        const saved = await transaction.createInvoice(invoice);
        if (invoice.paymentType === 'CREDIT') {
          await appendLedgerEntry(transaction, {
            businessId,
            customerId: input.customerId,
            type: 'CREDIT',
            amount: totalAmount / 100,
            paymentMethod: null,
            note: `Invoice ${invoice.invoiceNumber}`,
            referenceId: `invoice:${String(saved._id ?? saved.id)}`,
            createdAt: timestamp,
          });
        }
        return publicInvoice(saved);
      }).catch(async (error) => {
        if (input.idempotencyKey && error?.code === 'IDEMPOTENCY_KEY_CONFLICT') {
          const prior = await invoiceRepository.findInvoiceByIdempotencyKey(businessId, input.idempotencyKey);
          if (prior) return publicInvoice(prior);
        }
        throw error;
      });
    },

    async list(query, businessValue) {
      const businessId = businessScope(businessValue);
      return invoiceRepository.list({ businessId, ...validateInvoiceQuery(query), sort: { createdAt: -1, _id: -1 } });
    },

    async getById(idInput, businessValue) {
      const businessId = businessScope(businessValue);
      const id = validateObjectId(idInput, 'invoice ID');
      const invoice = await invoiceRepository.findById(id, businessId);
      if (!invoice) throw new ApiError(404, 'Invoice not found.', 'INVOICE_NOT_FOUND');
      return publicInvoice(invoice);
    },

    async getByNumber(numberInput, businessValue) {
      const businessId = businessScope(businessValue);
      if (typeof numberInput !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(numberInput)) {
        throw new ApiError(400, 'invoiceNumber is invalid.', 'VALIDATION_ERROR');
      }
      const invoice = await invoiceRepository.findByNumber(numberInput, businessId);
      if (!invoice) throw new ApiError(404, 'Invoice not found.', 'INVOICE_NOT_FOUND');
      return publicInvoice(invoice);
    },

    async listByCustomer(query, customerInput, businessValue) {
      const businessId = businessScope(businessValue);
      const customerId = validateObjectId(customerInput, 'customer ID');
      const customer = await customerRepository.findById(customerId, businessId);
      if (!customer) throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
      const pagination = validateInvoiceQuery(query);
      return invoiceRepository.list({ businessId, customerId, ...pagination, sort: { createdAt: -1, _id: -1 } });
    },

    async cancel(idInput, body, businessValue, userId) {
      const businessId = businessScope(businessValue);
      const id = validateObjectId(idInput, 'invoice ID');
      if (body !== undefined && (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some((key) => key !== 'reason')
        || (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 500)))) {
        throw new ApiError(400, 'Cancellation accepts an optional reason up to 500 characters.', 'VALIDATION_ERROR');
      }
      return invoiceRepository.withTransaction(async (transaction) => {
        const invoice = await transaction.findInvoice(id, businessId);
        if (!invoice) throw new ApiError(404, 'Invoice not found.', 'INVOICE_NOT_FOUND');
        if (invoice.status === 'CANCELLED') throw new ApiError(409, 'Invoice is already cancelled.', 'INVOICE_ALREADY_CANCELLED');
        if (invoice.amountPaid > 0) throw new ApiError(409, 'Invoices with recorded payments cannot be cancelled.', 'INVOICE_HAS_PAYMENTS');
        if (invoice.paymentType === 'CREDIT' && invoice.customerId) {
          const customer = await transaction.findCustomer(invoice.customerId, businessId);
          if (!customer) throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
          const entries = await transaction.listLedgerEntries(invoice.customerId, businessId);
          const dueMinor = Math.round(calculateSummary(entries).outstandingBalance * 100);
          if (dueMinor < invoice.totalAmount) throw new ApiError(409, 'Khata payments have already reduced the balance; this invoice cannot be safely cancelled.', 'INVOICE_CREDIT_PARTIALLY_SETTLED');
          await appendLedgerEntry(transaction, {
            businessId,
            customerId: invoice.customerId,
            type: 'PAYMENT',
            amount: invoice.totalAmount / 100,
            paymentMethod: null,
            note: `Cancellation of invoice ${invoice.invoiceNumber}`,
            referenceId: `invoice-cancel:${String(invoice._id ?? invoice.id)}`,
            createdAt: now(),
          });
        }
        for (const item of invoice.items) {
          if (!await transaction.restoreStock(item.productId, businessId, item.quantity, now())) {
            throw new ApiError(409, 'A billed product no longer exists; cancellation was not applied.', 'INVOICE_PRODUCT_MISSING');
          }
        }
        const cancelled = await transaction.markCancelled(id, businessId, {
          status: 'CANCELLED',
          updatedAt: now(),
          cancellation: { cancelledAt: now(), cancelledBy: String(userId), reason: body?.reason?.trim() || null },
        });
        if (!cancelled) throw new ApiError(409, 'Invoice cancellation lost a concurrent update.', 'INVOICE_ALREADY_CANCELLED');
        return publicInvoice(cancelled);
      });
    },
  };
}

module.exports = { createInvoiceService, publicInvoice };
