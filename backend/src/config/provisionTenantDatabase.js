const NUMBER_TYPES = ['double', 'int', 'long', 'decimal'];
const STRING_OR_NULL = ['string', 'null'];
const DATE_OR_NULL = ['date', 'null'];
const OBJECT_ID_OR_NULL = ['objectId', 'null'];

const TENANT_COLLECTIONS = Object.freeze({
  products: {
    required: ['businessId', 'name', 'sku', 'purchasePrice', 'sellingPrice', 'stockQuantity', 'createdAt', 'updatedAt'],
    properties: {
      businessId: { bsonType: 'string' }, name: { bsonType: 'string' }, sku: { bsonType: 'string' },
      description: { bsonType: 'string' }, categoryId: { bsonType: OBJECT_ID_OR_NULL },
      purchasePrice: { bsonType: NUMBER_TYPES, minimum: 0 }, sellingPrice: { bsonType: NUMBER_TYPES, minimum: 0 },
      stockQuantity: { bsonType: NUMBER_TYPES, minimum: 0 }, lowStockThreshold: { bsonType: NUMBER_TYPES, minimum: 0 },
      unit: { bsonType: 'string' }, expiryDate: { bsonType: DATE_OR_NULL }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
    },
    indexes: [
      { key: { businessId: 1, sku: 1 }, name: 'products_business_sku_unique', unique: true },
      { key: { businessId: 1, name: 1, _id: 1 }, name: 'products_business_name' },
      { key: { businessId: 1, categoryId: 1 }, name: 'products_business_category' },
      { key: { businessId: 1, expiryDate: 1 }, name: 'products_business_expiry' },
    ],
  },
  categories: {
    required: ['businessId', 'name', 'normalizedName', 'createdAt', 'updatedAt'],
    properties: {
      businessId: { bsonType: 'string' }, name: { bsonType: 'string' }, normalizedName: { bsonType: 'string' },
      description: { bsonType: 'string' }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
    },
    indexes: [
      { key: { businessId: 1, normalizedName: 1 }, name: 'categories_business_name_unique', unique: true },
      { key: { businessId: 1, name: 1, _id: 1 }, name: 'categories_business_name_sort' },
    ],
  },
  customers: {
    required: ['businessId', 'fullName', 'normalizedName', 'phone', 'createdAt', 'updatedAt'],
    properties: {
      businessId: { bsonType: 'string' }, fullName: { bsonType: 'string' }, normalizedName: { bsonType: 'string' },
      phone: { bsonType: 'string' }, email: { bsonType: STRING_OR_NULL }, address: { bsonType: 'string' },
      notes: { bsonType: 'string' }, ledgerRevision: { bsonType: NUMBER_TYPES },
      createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
    },
    indexes: [
      { key: { businessId: 1, normalizedName: 1, phone: 1 }, name: 'customers_business_name_phone_unique', unique: true },
      { key: { businessId: 1, fullName: 1, _id: 1 }, name: 'customers_business_name' },
      { key: { businessId: 1, phone: 1 }, name: 'customers_business_phone' },
    ],
  },
  customerLedger: {
    required: ['businessId', 'customerId', 'type', 'amount', 'createdAt'],
    properties: {
      businessId: { bsonType: 'string' }, customerId: { bsonType: 'objectId' },
      type: { enum: ['CREDIT', 'PAYMENT'] }, amount: { bsonType: NUMBER_TYPES, minimum: 0 },
      paymentMethod: { bsonType: STRING_OR_NULL }, note: { bsonType: STRING_OR_NULL },
      referenceId: { bsonType: STRING_OR_NULL }, createdAt: { bsonType: 'date' },
    },
    indexes: [
      { key: { businessId: 1, customerId: 1, createdAt: 1, _id: 1 }, name: 'ledger_business_customer_date' },
      { key: { businessId: 1, referenceId: 1 }, name: 'ledger_business_reference' },
    ],
  },
  invoices: {
    required: ['businessId', 'invoiceNumber', 'items', 'subtotal', 'additionalCharges', 'discount', 'totalAmount', 'totalCost', 'totalProfit', 'paymentType', 'amountPaid', 'amountDue', 'status', 'createdAt', 'updatedAt'],
    properties: {
      businessId: { bsonType: 'string' }, invoiceNumber: { bsonType: 'string' }, customerId: { bsonType: OBJECT_ID_OR_NULL },
      items: { bsonType: 'array' }, additionalChargeItems: { bsonType: 'array' },
      subtotal: { bsonType: NUMBER_TYPES }, additionalCharges: { bsonType: NUMBER_TYPES }, discount: { bsonType: NUMBER_TYPES },
      totalAmount: { bsonType: NUMBER_TYPES }, totalCost: { bsonType: NUMBER_TYPES }, totalProfit: { bsonType: NUMBER_TYPES },
      paymentType: { enum: ['CASH', 'CREDIT'] }, amountPaid: { bsonType: NUMBER_TYPES }, amountDue: { bsonType: NUMBER_TYPES },
      status: { enum: ['PAID', 'UNPAID', 'PARTIALLY_PAID', 'CANCELLED'] }, idempotencyKey: { bsonType: STRING_OR_NULL },
      createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' }, createdBy: { bsonType: 'string' },
    },
    indexes: [
      { key: { businessId: 1, invoiceNumber: 1 }, name: 'invoices_business_number_unique', unique: true },
      { key: { businessId: 1, idempotencyKey: 1 }, name: 'invoices_business_idempotency_unique', unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
      { key: { businessId: 1, createdAt: -1, _id: -1 }, name: 'invoices_business_date' },
      { key: { businessId: 1, customerId: 1, createdAt: -1, _id: -1 }, name: 'invoices_business_customer_date' },
      { key: { businessId: 1, status: 1, createdAt: -1 }, name: 'invoices_business_status_date' },
    ],
  },
  payments: {
    required: ['businessId', 'paymentId', 'customerId', 'amount', 'allocations', 'createdAt'],
    properties: {
      businessId: { bsonType: 'string' }, paymentId: { bsonType: 'string' }, customerId: { bsonType: 'objectId' },
      amount: { bsonType: NUMBER_TYPES, minimum: 0 }, allocations: { bsonType: 'array' },
      paymentMethod: { bsonType: STRING_OR_NULL }, note: { bsonType: STRING_OR_NULL },
      referenceNumber: { bsonType: STRING_OR_NULL }, idempotencyKey: { bsonType: STRING_OR_NULL }, createdAt: { bsonType: 'date' },
    },
    indexes: [
      { key: { businessId: 1, idempotencyKey: 1 }, name: 'payments_business_idempotency_unique', unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
      { key: { businessId: 1, createdAt: -1, _id: -1 }, name: 'payments_business_date' },
      { key: { businessId: 1, customerId: 1, createdAt: -1 }, name: 'payments_business_customer_date' },
    ],
  },
  businessProfiles: {
    required: ['businessId', 'createdAt', 'updatedAt'],
    properties: {
      businessId: { bsonType: 'string' }, businessName: { bsonType: 'string' }, businessType: { bsonType: STRING_OR_NULL },
      phone: { bsonType: STRING_OR_NULL }, email: { bsonType: STRING_OR_NULL }, address: { bsonType: STRING_OR_NULL },
      createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
    },
    indexes: [{ key: { businessId: 1 }, name: 'business_profiles_business_unique', unique: true }],
  },
  businessSettings: {
    required: ['businessId', 'createdAt', 'updatedAt'],
    properties: {
      businessId: { bsonType: 'string' }, settings: { bsonType: 'object' },
      createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
    },
    indexes: [{ key: { businessId: 1 }, name: 'business_settings_business_unique', unique: true }],
  },
  businessResetAudits: {
    required: ['resetId', 'businessId', 'actorId', 'resetAt', 'deletedCounts'],
    properties: {
      resetId: { bsonType: 'string' }, businessId: { bsonType: 'string' }, actorId: { bsonType: 'string' },
      resetAt: { bsonType: 'date' }, deletedCounts: { bsonType: 'object' },
    },
    indexes: [
      { key: { resetId: 1 }, name: 'business_reset_audit_id_unique', unique: true },
      { key: { businessId: 1, resetAt: -1 }, name: 'business_reset_audit_business_date' },
    ],
  },
  invoiceSequences: {
    required: ['_id', 'value'],
    properties: { _id: { bsonType: 'string' }, value: { bsonType: NUMBER_TYPES, minimum: 0 } },
    indexes: [],
  },
});

function validatorFor(definition) {
  return {
    $jsonSchema: {
      bsonType: 'object',
      required: definition.required,
      properties: definition.properties,
    },
  };
}

async function ensureCollection(database, name, definition) {
  const validator = validatorFor(definition);
  const exists = await database.listCollections({ name }, { nameOnly: true }).hasNext();
  if (exists) {
    await database.command({ collMod: name, validator, validationLevel: 'moderate', validationAction: 'error' });
  } else {
    try {
      await database.createCollection(name, { validator, validationLevel: 'strict', validationAction: 'error' });
    } catch (error) {
      if (error?.code !== 48 && error?.codeName !== 'NamespaceExists') throw error;
      await database.command({ collMod: name, validator, validationLevel: 'moderate', validationAction: 'error' });
    }
  }
  if (definition.indexes.length) {
    await database.collection(name).createIndexes(definition.indexes);
  }
}

async function provisionTenantDatabase(database) {
  if (!database || typeof database.collection !== 'function') {
    throw new TypeError('A tenant MongoDB database handle is required.');
  }
  for (const [name, definition] of Object.entries(TENANT_COLLECTIONS)) {
    await ensureCollection(database, name, definition);
  }
  return { databaseName: database.databaseName, collections: Object.keys(TENANT_COLLECTIONS) };
}

module.exports = { TENANT_COLLECTIONS, provisionTenantDatabase };
