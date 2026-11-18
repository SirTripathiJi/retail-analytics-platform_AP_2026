const ApiError = require('../errors/ApiError');
const { validateObjectId, validatePagination } = require('../validators/inventoryValidation');
const { validateCreateCustomer, validateUpdateCustomer } = require('../validators/customerValidation');
const { publicInvoice } = require('./invoiceService');

function safeCustomer(customer) {
  if (!customer) return customer;
  return {
    id: String(customer._id ?? customer.id),
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email ?? null,
    address: customer.address ?? '',
    notes: customer.notes ?? '',
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

function requireBusinessId(businessId) {
  if (!businessId) throw new ApiError(401, 'Authenticated business context is missing.', 'BUSINESS_CONTEXT_REQUIRED');
  return String(businessId);
}

function normalizedName(fullName) {
  return fullName.toLocaleLowerCase('en');
}

function duplicateError(error) {
  return error?.code === 11000 || error?.code === 'DUPLICATE_CUSTOMER';
}

function createCustomerService({ customerRepository, ledgerRepository, invoiceRepository, now = () => new Date() }) {
  return {
    async create(body, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const input = validateCreateCustomer(body);
      const normalized = normalizedName(input.fullName);
      if (await customerRepository.findPotentialDuplicate({
        businessId,
        normalizedName: normalized,
        phone: input.phone,
      })) {
        throw new ApiError(409, 'A customer with this name and phone already exists.', 'CUSTOMER_ALREADY_EXISTS');
      }
      const timestamp = now();
      try {
        return safeCustomer(await customerRepository.create({
          ...input,
          normalizedName: normalized,
          businessId,
          createdAt: timestamp,
          updatedAt: timestamp,
        }));
      } catch (error) {
        if (duplicateError(error)) {
          throw new ApiError(409, 'A customer with this name and phone already exists.', 'CUSTOMER_ALREADY_EXISTS');
        }
        throw error;
      }
    },

    async list(query, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const { page, limit, skip } = validatePagination(query);
      const search = query.search === undefined ? undefined : String(query.search).trim();
      if (search && search.length > 100) {
        throw new ApiError(400, 'search must be 100 characters or fewer.', 'VALIDATION_ERROR');
      }
      const result = await customerRepository.list({ businessId, search, page, limit, skip });
      return {
        items: result.items.map(safeCustomer),
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      };
    },

    async getById(idInput, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const id = validateObjectId(idInput, 'customer ID');
      const customer = await customerRepository.findById(id, businessId);
      if (!customer) throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
      return safeCustomer(customer);
    },

    async update(idInput, body, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const id = validateObjectId(idInput, 'customer ID');
      const update = validateUpdateCustomer(body);
      const current = await customerRepository.findById(id, businessId);
      if (!current) throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');

      const nextName = update.fullName ?? current.fullName;
      const nextPhone = update.phone ?? current.phone;
      if (nextName !== current.fullName || nextPhone !== current.phone) {
        const duplicate = await customerRepository.findPotentialDuplicate({
          businessId,
          normalizedName: normalizedName(nextName),
          phone: nextPhone,
          excludingId: id,
        });
        if (duplicate) throw new ApiError(409, 'A customer with this name and phone already exists.', 'CUSTOMER_ALREADY_EXISTS');
        update.normalizedName = normalizedName(nextName);
      }

      try {
        const customer = await customerRepository.updateById(id, businessId, {
          ...update,
          updatedAt: now(),
        });
        if (!customer) throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
        return safeCustomer(customer);
      } catch (error) {
        if (duplicateError(error)) {
          throw new ApiError(409, 'A customer with this name and phone already exists.', 'CUSTOMER_ALREADY_EXISTS');
        }
        throw error;
      }
    },

    async delete(idInput, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const customerId = validateObjectId(idInput, 'customer ID');
      return ledgerRepository.withCustomerTransaction(
        { businessId, customerId },
        async (transaction) => {
          if (await transaction.hasEntries()) {
            throw new ApiError(
              409,
              'Customer cannot be deleted because Khata ledger history exists.',
              'CUSTOMER_HAS_LEDGER_HISTORY',
            );
          }
          const deleted = await transaction.deleteCustomer();
          if (!deleted) throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
          return { message: 'Customer deleted successfully.' };
        },
      );
    },

    async purchaseHistory(idInput, query, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const customerId = validateObjectId(idInput, 'customer ID');
      const customer = await customerRepository.findById(customerId, businessId);
      if (!customer) throw new ApiError(404, 'Customer not found.', 'CUSTOMER_NOT_FOUND');
      const { page, limit, skip } = validatePagination(query);
      const result = await invoiceRepository.listByCustomer({
        businessId, customerId, page, limit, skip,
      });
      return {
        items: result.items.map(publicInvoice),
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      };
    },
  };
}

module.exports = { createCustomerService, safeCustomer };
