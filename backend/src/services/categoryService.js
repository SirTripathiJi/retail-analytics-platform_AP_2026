const ApiError = require('../errors/ApiError');
const { validateCategory, validateObjectId, validatePagination } = require('../validators/inventoryValidation');

function safeCategory(category) {
  if (!category) return category;
  return {
    id: String(category._id ?? category.id),
    name: category.name,
    description: category.description,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function requireBusinessId(businessId) {
  if (!businessId) throw new ApiError(401, 'Authenticated business context is missing.', 'BUSINESS_CONTEXT_REQUIRED');
  return String(businessId);
}

function isDuplicateName(error) {
  return error?.code === 11000 || error?.code === 'DUPLICATE_CATEGORY_NAME';
}

function createCategoryService({ categoryRepository, productRepository, now = () => new Date() }) {
  return {
    async create(body, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const input = validateCategory(body);
      const normalizedName = input.name.toLocaleLowerCase('en');
      if (await categoryRepository.findByName(normalizedName, businessId)) {
        throw new ApiError(409, 'A category with this name already exists.', 'CATEGORY_ALREADY_EXISTS');
      }
      const timestamp = now();
      try {
        return safeCategory(await categoryRepository.create({
          ...input,
          normalizedName,
          businessId,
          createdAt: timestamp,
          updatedAt: timestamp,
        }));
      } catch (error) {
        if (isDuplicateName(error)) {
          throw new ApiError(409, 'A category with this name already exists.', 'CATEGORY_ALREADY_EXISTS');
        }
        throw error;
      }
    },

    async list(query, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const pagination = validatePagination(query);
      const result = await categoryRepository.list({ businessId, ...pagination });
      return {
        items: result.items.map(safeCategory),
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(result.total / pagination.limit),
      };
    },

    async update(idInput, body, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const id = validateObjectId(idInput, 'category ID');
      const update = validateCategory(body, { partial: true });
      const current = await categoryRepository.findById(id, businessId);
      if (!current) throw new ApiError(404, 'Category not found.', 'CATEGORY_NOT_FOUND');

      if (update.name !== undefined) {
        const normalizedName = update.name.toLocaleLowerCase('en');
        const duplicate = await categoryRepository.findByName(normalizedName, businessId, id);
        if (duplicate) throw new ApiError(409, 'A category with this name already exists.', 'CATEGORY_ALREADY_EXISTS');
        update.normalizedName = normalizedName;
      }

      try {
        const category = await categoryRepository.updateById(id, businessId, {
          ...update,
          updatedAt: now(),
        });
        if (!category) throw new ApiError(404, 'Category not found.', 'CATEGORY_NOT_FOUND');
        return safeCategory(category);
      } catch (error) {
        if (isDuplicateName(error)) {
          throw new ApiError(409, 'A category with this name already exists.', 'CATEGORY_ALREADY_EXISTS');
        }
        throw error;
      }
    },

    async delete(idInput, businessIdInput) {
      const businessId = requireBusinessId(businessIdInput);
      const id = validateObjectId(idInput, 'category ID');
      const category = await categoryRepository.findById(id, businessId);
      if (!category) throw new ApiError(404, 'Category not found.', 'CATEGORY_NOT_FOUND');
      if (await productRepository.countByCategory(businessId, id)) {
        throw new ApiError(409, 'Category cannot be deleted while products reference it.', 'CATEGORY_IN_USE');
      }
      const deleted = await categoryRepository.deleteById(id, businessId);
      if (!deleted) throw new ApiError(404, 'Category not found.', 'CATEGORY_NOT_FOUND');
      return { message: 'Category deleted successfully.' };
    },
  };
}

module.exports = { createCategoryService };
