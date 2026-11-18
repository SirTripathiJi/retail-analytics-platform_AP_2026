const ApiError = require('../errors/ApiError');
const {
  validateBooleanQuery,
  validateCreateProduct,
  validateDays,
  validateObjectId,
  validatePagination,
  validateUpdateProduct,
} = require('../validators/inventoryValidation');

function safeProduct(product) {
  if (!product) return product;
  return {
    id: String(product._id ?? product.id),
    name: product.name,
    description: product.description,
    sku: product.sku,
    categoryId: product.categoryId ?? null,
    purchasePrice: product.purchasePrice,
    sellingPrice: product.sellingPrice,
    stockQuantity: product.stockQuantity,
    lowStockThreshold: product.lowStockThreshold,
    unit: product.unit,
    expiryDate: product.expiryDate ?? null,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function requireBusinessId(businessId) {
  if (!businessId) throw new ApiError(401, 'Authenticated business context is missing.', 'BUSINESS_CONTEXT_REQUIRED');
  return String(businessId);
}

function startOfUtcDay(date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function endOfUtcDay(date) {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function createProductService({ productRepository, categoryRepository, businessSettingsRepository, now = () => new Date() }) {
  async function ensureCategoryExists(categoryId, businessId) {
    if (!categoryId) return;
    const category = await categoryRepository.findById(categoryId, businessId);
    if (!category) throw new ApiError(400, 'categoryId does not identify a category in this business.', 'INVALID_CATEGORY');
  }

  return {
    async create(body, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const input = validateCreateProduct(body);
      if (body.lowStockThreshold === undefined && businessSettingsRepository) {
        const settings = await businessSettingsRepository.getSettings(businessId);
        input.lowStockThreshold = settings.lowStockThreshold;
      }
      await ensureCategoryExists(input.categoryId, businessId);
      const timestamp = now();
      return safeProduct(await productRepository.create({
        ...input,
        businessId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));
    },

    async list(query, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const pagination = validatePagination(query);
      const lowStock = validateBooleanQuery(query.lowStock, 'lowStock');
      const expired = validateBooleanQuery(query.expired, 'expired');
      const expiryDays = query.expiryWithinDays === undefined
        ? undefined : validateDays(query.expiryWithinDays);
      if (expired && expiryDays !== undefined) {
        throw new ApiError(400, 'Use either expired=true or expiryWithinDays, not both.', 'VALIDATION_ERROR');
      }
      const categoryId = query.categoryId === undefined
        ? undefined : validateObjectId(query.categoryId, 'categoryId');
      const search = query.search === undefined ? undefined : String(query.search).trim();
      if (search && search.length > 100) throw new ApiError(400, 'search must be 100 characters or fewer.', 'VALIDATION_ERROR');

      let expiryFrom;
      let expiryTo;
      if (expiryDays !== undefined) {
        expiryFrom = startOfUtcDay(now());
        const lastDay = new Date(expiryFrom);
        lastDay.setUTCDate(lastDay.getUTCDate() + expiryDays);
        expiryTo = endOfUtcDay(lastDay);
      }

      const result = await productRepository.list({
        businessId,
        ...pagination,
        search,
        categoryId,
        lowStock,
        expired,
        expiryFrom,
        expiryTo,
        expiryBefore: expired ? startOfUtcDay(now()) : undefined,
      });
      return {
        items: result.items.map(safeProduct),
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(result.total / pagination.limit),
      };
    },

    async getById(idInput, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const id = validateObjectId(idInput, 'product ID');
      const product = await productRepository.findById(id, businessId);
      if (!product) throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
      return safeProduct(product);
    },

    async update(idInput, body, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const id = validateObjectId(idInput, 'product ID');
      const update = validateUpdateProduct(body);
      const current = await productRepository.findById(id, businessId);
      if (!current) throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
      if (Object.hasOwn(update, 'categoryId')) await ensureCategoryExists(update.categoryId, businessId);

      const product = await productRepository.updateById(id, businessId, {
        ...update,
        updatedAt: now(),
      });
      if (!product) throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
      return safeProduct(product);
    },

    async delete(idInput, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const id = validateObjectId(idInput, 'product ID');
      const deleted = await productRepository.deleteById(id, businessId);
      if (!deleted) throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
      return { message: 'Product deleted successfully.' };
    },

    async lowStock(query, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const pagination = validatePagination(query);
      const result = await productRepository.findLowStock({ businessId, ...pagination });
      return {
        items: result.items.map(safeProduct),
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(result.total / pagination.limit),
      };
    },

    async expiring(query, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const days = validateDays(query.days);
      const pagination = validatePagination(query);
      const from = startOfUtcDay(now());
      const lastDay = new Date(from);
      lastDay.setUTCDate(lastDay.getUTCDate() + days);
      const to = endOfUtcDay(lastDay);
      const result = await productRepository.findExpiring({ businessId, from, to, ...pagination });
      return {
        items: result.items.map(safeProduct),
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(result.total / pagination.limit),
      };
    },

    async expired(query, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const pagination = validatePagination(query);
      const result = await productRepository.findExpired({
        businessId,
        before: startOfUtcDay(now()),
        ...pagination,
      });
      return {
        items: result.items.map(safeProduct),
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(result.total / pagination.limit),
      };
    },
  };
}

module.exports = { createProductService };
