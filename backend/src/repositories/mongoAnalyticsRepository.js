const { calculateSummary } = require('../services/khataService');
const ApiError = require('../errors/ApiError');

function assertBusinessId(businessId) {
  if (typeof businessId !== 'string' || !businessId.trim()) {
    throw new ApiError(401, 'Authenticated business context is missing.', 'BUSINESS_CONTEXT_REQUIRED');
  }
}

function paiseProductValue(field) {
  return { $round: [{ $multiply: [{ $ifNull: [`$${field}`, 0] }, { $ifNull: ['$stockQuantity', 0] }, 100] }, 0] };
}
function invoiceMatch(businessId, from, to) {
  return { businessId, status: { $ne: 'CANCELLED' }, createdAt: { $gte: from, $lte: to } };
}
function publicProduct(product) {
  return { id: String(product._id), name: product.name, sku: product.sku ?? null, stockQuantity: product.stockQuantity,
    lowStockThreshold: product.lowStockThreshold ?? 0, unit: product.unit ?? 'unit', categoryId: product.categoryId ? String(product.categoryId) : null,
    expiryDate: product.expiryDate ?? null };
}

/** Injected tenant Db adapter. All pipelines scope by the authenticated businessId. */
function createMongoAnalyticsRepository(database) {
  if (!database || typeof database.collection !== 'function') throw new TypeError('A MongoDB database handle is required.');
  const invoices = database.collection('invoices');
  const products = database.collection('products');
  const categories = database.collection('categories');
  const customers = database.collection('customers');
  const ledger = database.collection('customerLedger');

  return {
    async overview({ businessId, now, today, week, month, range, expiringFrom, expiringTo }) {
      assertBusinessId(businessId);
      const starts = [today.from, week.from, month.from, range?.from].filter(Boolean);
      const from = new Date(Math.min(...starts.map((date) => date.getTime())));
      const ends = [now, range?.to].filter(Boolean);
      const to = new Date(Math.max(...ends.map((date) => date.getTime())));
      const invoicePipeline = [
        { $match: invoiceMatch(businessId, from, to) },
        { $group: { _id: null,
          totalSalesToday: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', today.from] }, { $lte: ['$createdAt', today.to] }] }, '$totalAmount', 0] } },
          totalProfitToday: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', today.from] }, { $lte: ['$createdAt', today.to] }] }, '$totalProfit', 0] } },
          totalSalesThisWeek: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', week.from] }, { $lte: ['$createdAt', week.to] }] }, '$totalAmount', 0] } },
          totalProfitThisWeek: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', week.from] }, { $lte: ['$createdAt', week.to] }] }, '$totalProfit', 0] } },
          totalSalesThisMonth: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', month.from] }, { $lte: ['$createdAt', month.to] }] }, '$totalAmount', 0] } },
          totalProfitThisMonth: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', month.from] }, { $lte: ['$createdAt', month.to] }] }, '$totalProfit', 0] } },
          totalInvoicesToday: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', today.from] }, { $lte: ['$createdAt', today.to] }] }, 1, 0] } },
          rangeSales: { $sum: range ? { $cond: [{ $and: [{ $gte: ['$createdAt', range.from] }, { $lte: ['$createdAt', range.to] }] }, '$totalAmount', 0] } : 0 },
          rangeProfit: { $sum: range ? { $cond: [{ $and: [{ $gte: ['$createdAt', range.from] }, { $lte: ['$createdAt', range.to] }] }, '$totalProfit', 0] } : 0 },
          rangeInvoices: { $sum: range ? { $cond: [{ $and: [{ $gte: ['$createdAt', range.from] }, { $lte: ['$createdAt', range.to] }] }, 1, 0] } : 0 },
        } },
      ];
      const productPipeline = [
        { $match: { businessId } },
        { $group: { _id: null, totalProducts: { $sum: 1 }, totalStockQuantity: { $sum: { $ifNull: ['$stockQuantity', 0] } },
          totalInventoryValue: { $sum: paiseProductValue('purchasePrice') },
          totalPurchaseValue: { $sum: paiseProductValue('purchasePrice') },
          totalSellingValue: { $sum: paiseProductValue('sellingPrice') },
          lowStockProductsCount: { $sum: { $cond: [{ $lte: ['$stockQuantity', { $ifNull: ['$lowStockThreshold', 0] }] }, 1, 0] } },
          expiringProductsCount: { $sum: { $cond: [{ $and: [{ $gte: ['$expiryDate', expiringFrom] }, { $lte: ['$expiryDate', expiringTo] }] }, 1, 0] } },
        } },
      ];
      const cancellationQuery = { businessId, 'cancellation.cancelledAt': { $gte: today.from, $lte: today.to } };
      const ledgerTodayQuery = { businessId, createdAt: { $gte: today.from, $lte: today.to }, referenceId: { $not: /^(payment:|invoice-cancel:)/ } };
      const [invoiceRows, productRows, statusRows, ledgerRows, totalCustomers, invoiceEvents,
        cancellationEvents, paymentEvents, ledgerEvents] = await Promise.all([
        invoices.aggregate(invoicePipeline).toArray(),
        products.aggregate(productPipeline).toArray(),
        invoices.aggregate([
          { $match: { businessId, status: { $ne: 'CANCELLED' } } },
          { $group: { _id: null,
            paidInvoicesCount: { $sum: { $cond: [{ $or: [{ $eq: ['$amountDue', 0] }, { $eq: ['$status', 'PAID'] }] }, 1, 0] } },
            partiallyPaidInvoicesCount: { $sum: { $cond: [{ $and: [{ $gt: ['$amountPaid', 0] }, { $gt: ['$amountDue', 0] }] }, 1, 0] } },
            unpaidInvoicesCount: { $sum: { $cond: [{ $and: [{ $eq: [{ $ifNull: ['$amountPaid', 0] }, 0] }, { $gt: ['$amountDue', 0] }, { $ne: ['$status', 'PAID'] }] }, 1, 0] } },
          } },
        ]).toArray(),
        ledger.aggregate([{ $match: { businessId } }, { $group: { _id: null,
          credit: { $sum: { $cond: [{ $eq: ['$type', 'CREDIT'] }, { $round: [{ $multiply: ['$amount', 100] }, 0] }, 0] } },
          payment: { $sum: { $cond: [{ $eq: ['$type', 'PAYMENT'] }, { $round: [{ $multiply: ['$amount', 100] }, 0] }, 0] } },
        } }]).toArray(),
        customers.countDocuments({ businessId }),
        invoices.countDocuments({ businessId, createdAt: { $gte: today.from, $lte: today.to } }),
        invoices.countDocuments(cancellationQuery),
        database.collection('payments').countDocuments({ businessId, createdAt: { $gte: today.from, $lte: today.to } }),
        ledger.countDocuments(ledgerTodayQuery),
      ]);
      const sales = invoiceRows[0] || {};
      const stock = productRows[0] || {};
      const statuses = statusRows[0] || {};
      const balances = ledgerRows[0] || {};
      const outstanding = calculateSummary([
        { type: 'CREDIT', amount: (balances.credit || 0) / 100 },
        { type: 'PAYMENT', amount: (balances.payment || 0) / 100 },
      ]).outstandingBalance;
      return {
        sales: { totalSalesToday: sales.totalSalesToday || 0, totalProfitToday: sales.totalProfitToday || 0,
          totalSalesThisWeek: sales.totalSalesThisWeek || 0, totalProfitThisWeek: sales.totalProfitThisWeek || 0,
          totalSalesThisMonth: sales.totalSalesThisMonth || 0, totalProfitThisMonth: sales.totalProfitThisMonth || 0,
          range: range ? { totalSales: sales.rangeSales || 0, totalProfit: sales.rangeProfit || 0, totalInvoices: sales.rangeInvoices || 0 } : null },
        inventory: { totalProducts: stock.totalProducts || 0, totalStockQuantity: stock.totalStockQuantity || 0,
          totalInventoryValue: stock.totalInventoryValue || 0, lowStockProductsCount: stock.lowStockProductsCount || 0,
          expiringProductsCount: stock.expiringProductsCount || 0 },
        totalCustomers,
        outstandingKhataBalance: Math.max(0, Math.round(outstanding * 100)),
        totalTransactionsToday: invoiceEvents + cancellationEvents + paymentEvents + ledgerEvents,
        totalInvoicesToday: invoiceEvents,
        invoiceStatuses: { paidInvoicesCount: statuses.paidInvoicesCount || 0,
          partiallyPaidInvoicesCount: statuses.partiallyPaidInvoicesCount || 0, unpaidInvoicesCount: statuses.unpaidInvoicesCount || 0 },
      };
    },

    async sales({ businessId, from, to, period, timeZone }) {
      assertBusinessId(businessId);
      const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[period];
      const dateTrunc = { $dateTrunc: { date: '$createdAt', unit, timezone: timeZone, ...(period === 'weekly' ? { startOfWeek: 'monday' } : {}) } };
      return invoices.aggregate([
        { $match: invoiceMatch(businessId, from, to) },
        { $addFields: { periodStart: dateTrunc,
          unitsSold: { $sum: { $map: { input: { $ifNull: ['$items', []] }, as: 'item', in: { $ifNull: ['$$item.quantity', 0] } } } },
        } },
        { $group: { _id: '$periodStart', totalSales: { $sum: '$totalAmount' }, totalProfit: { $sum: '$totalProfit' },
          totalInvoices: { $sum: 1 }, totalUnitsSold: { $sum: '$unitsSold' } } },
        { $project: { _id: 0, date: '$_id', totalSales: 1, totalProfit: 1, totalInvoices: 1, totalUnitsSold: 1 } },
        { $sort: { date: 1 } },
      ]).toArray();
    },

    async categoryPerformance({ businessId, from, to }) {
      assertBusinessId(businessId);
      const range = from || to ? { createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {};
      return invoices.aggregate([
        { $match: { businessId, status: { $ne: 'CANCELLED' }, ...range } },
        { $unwind: '$items' },
        { $group: { _id: { categoryId: { $ifNull: ['$items.categoryId', null] },
          categoryName: { $ifNull: ['$items.categoryName', { $cond: [{ $ifNull: ['$items.categoryId', false] }, 'Category snapshot unavailable', 'Uncategorized'] }] },
          invoiceId: '$_id' }, unitsSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $ifNull: ['$items.analyticsRevenue', '$items.lineTotal'] } },
          totalCost: { $sum: '$items.lineCost' }, totalProfit: { $sum: { $ifNull: ['$items.analyticsProfit', '$items.lineProfit'] } } } },
        { $group: { _id: { categoryId: '$_id.categoryId', categoryName: '$_id.categoryName' },
          unitsSold: { $sum: '$unitsSold' }, totalRevenue: { $sum: '$totalRevenue' }, totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$totalProfit' }, invoiceCount: { $sum: 1 } } },
        { $project: { _id: 0, categoryId: { $cond: [{ $ifNull: ['$_id.categoryId', false] }, { $toString: '$_id.categoryId' }, null] }, categoryName: '$_id.categoryName', unitsSold: 1,
          totalRevenue: 1, totalCost: 1, totalProfit: 1, invoiceCount: 1 } },
        { $sort: { totalRevenue: -1, categoryName: 1 } },
      ]).toArray();
    },

    async productPerformance({ businessId, from, to, sortBy = 'totalRevenue', order = 'desc', skip = 0, limit = 20 }) {
      assertBusinessId(businessId);
      const dateExpressions = [];
      if (from) dateExpressions.push({ $gte: ['$createdAt', from] });
      if (to) dateExpressions.push({ $lte: ['$createdAt', to] });
      const direction = order === 'asc' ? 1 : -1;
      const metrics = { unitsSold: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, invoiceCount: 0 };
      const rows = await products.aggregate([
        { $match: { businessId } },
        { $lookup: { from: 'invoices', let: { productId: { $toString: '$_id' } }, pipeline: [
          { $match: { $expr: { $and: [ { $eq: ['$businessId', businessId] }, { $ne: ['$status', 'CANCELLED'] }, ...dateExpressions ] } } },
          { $unwind: '$items' }, { $match: { $expr: { $eq: ['$items.productId', '$$productId'] } } }, { $limit: 1 },
        ], as: 'matchingSale' } },
        { $match: { matchingSale: { $eq: [] } } },
        { $project: { _id: 0, productId: { $toString: '$_id' }, productName: '$name', ...metrics } },
        { $unionWith: { coll: 'invoices', pipeline: [
          { $match: { businessId, status: { $ne: 'CANCELLED' }, ...(from || to ? { createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {}) } },
          { $unwind: '$items' },
          { $group: { _id: { productId: '$items.productId', invoiceId: '$_id' }, productName: { $first: '$items.productName' },
            unitsSold: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $ifNull: ['$items.analyticsRevenue', '$items.lineTotal'] } },
            totalCost: { $sum: '$items.lineCost' }, totalProfit: { $sum: { $ifNull: ['$items.analyticsProfit', '$items.lineProfit'] } } } },
          { $group: { _id: '$_id.productId', productName: { $first: '$productName' }, unitsSold: { $sum: '$unitsSold' },
            totalRevenue: { $sum: '$totalRevenue' }, totalCost: { $sum: '$totalCost' }, totalProfit: { $sum: '$totalProfit' },
            invoiceCount: { $sum: 1 } } },
          { $project: { _id: 0, productId: { $toString: '$_id' }, productName: 1, unitsSold: 1, totalRevenue: 1,
            totalCost: 1, totalProfit: 1, invoiceCount: 1 } },
        ] } },
        { $addFields: { profitMarginPercentage: { $cond: [{ $gt: ['$totalRevenue', 0] },
          { $round: [{ $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] }, 2] }, 0] } } },
        { $facet: { items: [{ $sort: { [sortBy]: direction, productName: 1 } }, { $skip: skip }, { $limit: limit }],
          count: [{ $count: 'total' }] } },
      ]).toArray();
      return { items: rows[0]?.items || [], total: rows[0]?.count?.[0]?.total || 0 };
    },

    async inventory({ businessId, expiredBefore, expiringFrom, expiringTo }) {
      assertBusinessId(businessId);
      const summary = await products.aggregate([
        { $match: { businessId } },
        { $group: { _id: null, totalProducts: { $sum: 1 }, totalStockQuantity: { $sum: { $ifNull: ['$stockQuantity', 0] } },
          totalPurchaseValue: { $sum: paiseProductValue('purchasePrice') }, totalSellingValue: { $sum: paiseProductValue('sellingPrice') } } },
      ]).toArray();
      const lowStockQuery = { businessId, $expr: { $lte: ['$stockQuantity', { $ifNull: ['$lowStockThreshold', 0] }] } };
      const expiringQuery = { businessId, expiryDate: { $type: 'date', $gte: expiringFrom, $lte: expiringTo } };
      const expiredQuery = { businessId, expiryDate: { $type: 'date', $lt: expiredBefore } };
      const [lowStockProducts, expiringProducts, expiredProducts, categoryWiseStock] = await Promise.all([
        products.find(lowStockQuery, { projection: { name: 1, sku: 1, stockQuantity: 1, lowStockThreshold: 1, unit: 1 } }).sort({ stockQuantity: 1, name: 1 }).toArray(),
        products.find(expiringQuery, { projection: { name: 1, sku: 1, stockQuantity: 1, unit: 1, expiryDate: 1 } }).sort({ expiryDate: 1 }).toArray(),
        products.find(expiredQuery, { projection: { name: 1, sku: 1, stockQuantity: 1, unit: 1, expiryDate: 1 } }).sort({ expiryDate: 1 }).toArray(),
        products.aggregate([
          { $match: { businessId } },
          { $lookup: { from: 'categories', let: { productCategoryId: '$categoryId' }, pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$_id', '$$productCategoryId'] }, { $eq: ['$businessId', businessId] } ] } } },
          ], as: 'category' } },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          { $group: { _id: { categoryId: { $ifNull: ['$categoryId', null] },
            categoryName: { $ifNull: ['$category.name', { $cond: [{ $ifNull: ['$categoryId', false] }, 'Deleted category', 'Uncategorized'] }] } },
            totalProducts: { $sum: 1 }, totalStockQuantity: { $sum: { $ifNull: ['$stockQuantity', 0] } },
            totalPurchaseValue: { $sum: paiseProductValue('purchasePrice') }, totalSellingValue: { $sum: paiseProductValue('sellingPrice') } } },
          { $project: { _id: 0, categoryId: { $cond: [{ $ifNull: ['$_id.categoryId', false] }, { $toString: '$_id.categoryId' }, null] }, categoryName: '$_id.categoryName', totalProducts: 1,
            totalStockQuantity: 1, totalPurchaseValue: 1, totalSellingValue: 1 } }, { $sort: { categoryName: 1 } },
        ]).toArray(),
      ]);
      const values = summary[0] || {};
      return { totalProducts: values.totalProducts || 0, totalStockQuantity: values.totalStockQuantity || 0,
        totalPurchaseValue: values.totalPurchaseValue || 0, totalSellingValue: values.totalSellingValue || 0,
        lowStockProducts: lowStockProducts.map(publicProduct), expiringProducts: expiringProducts.map(publicProduct),
        expiredProducts: expiredProducts.map(publicProduct), categoryWiseStock };
    },
  };
}

module.exports = { createMongoAnalyticsRepository };
