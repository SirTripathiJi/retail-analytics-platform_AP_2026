const ApiError = require('../errors/ApiError');
const {
  addLocalDays, floorPeriod, getLocalParts, localDateToUtc, periodLabel,
  validateAnalyticsRange, validateBusinessId, validateOverviewQuery, validateProductQuery, validateSalesQuery,
} = require('../validators/analyticsValidation');

function dayWindow(now, timeZone) {
  const local = getLocalParts(now, timeZone);
  return { from: localDateToUtc({ year: local.year, month: local.month, day: local.day }, timeZone), to: now };
}
function weekWindow(now, timeZone) {
  return { from: localDateToUtc(floorPeriod(now, 'weekly', timeZone), timeZone), to: now };
}
function monthWindow(now, timeZone) {
  const local = getLocalParts(now, timeZone);
  return { from: localDateToUtc({ year: local.year, month: local.month, day: 1 }, timeZone), to: now };
}
function percent(profit, revenue) {
  return revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0;
}

function createAnalyticsService({ analyticsRepository, businessTimeZone = process.env.BUSINESS_TIME_ZONE || 'UTC',
  timeZoneResolver, now = () => new Date() }) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: businessTimeZone }).format(new Date()); }
  catch (_error) { throw new TypeError('BUSINESS_TIME_ZONE must be a valid IANA time zone.'); }

  function rangeFields(range) {
    return range ? { from: range.from, to: range.to } : {};
  }

  async function timeZoneFor(businessId) {
    const resolved = timeZoneResolver ? await timeZoneResolver(businessId) : null;
    const timeZone = resolved || businessTimeZone;
    try { new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date()); }
    catch (_error) { throw new ApiError(500, 'Business timezone configuration is invalid.', 'INVALID_BUSINESS_TIMEZONE'); }
    return timeZone;
  }

  return {
    async overview(query, businessValue) {
      const businessId = validateBusinessId(businessValue);
      const timeZone = await timeZoneFor(businessId);
      const current = now();
      const { range } = validateOverviewQuery(query, timeZone, current);
      const localToday = getLocalParts(current, timeZone);
      const expiryStart = localDateToUtc({ year: localToday.year, month: localToday.month, day: localToday.day }, timeZone);
      const expiryEnd = new Date(localDateToUtc(addLocalDays(localToday, 31), timeZone).getTime() - 1);
      const data = await analyticsRepository.overview({
        businessId, now: current, today: dayWindow(current, timeZone),
        week: weekWindow(current, timeZone), month: monthWindow(current, timeZone),
        range, expiringFrom: expiryStart, expiringTo: expiryEnd,
      });
      return {
        ...data.sales,
        ...(range ? { salesRange: { from: range.from, to: range.to, totalSales: data.sales.range.totalSales,
          totalProfit: data.sales.range.totalProfit, totalInvoices: data.sales.range.totalInvoices } } : {}),
        ...data.inventory,
        totalCustomers: data.totalCustomers,
        outstandingKhataBalance: data.outstandingKhataBalance,
        totalTransactionsToday: data.totalTransactionsToday,
        totalInvoicesToday: data.totalInvoicesToday,
        ...data.invoiceStatuses,
        timezone: timeZone,
      };
    },

    async sales(query, businessValue) {
      const businessId = validateBusinessId(businessValue);
      const timeZone = await timeZoneFor(businessId);
      const filters = validateSalesQuery(query, timeZone, now());
      const span = filters.to.getTime() - filters.from.getTime();
      const maxSpan = { daily: 731, weekly: 3650, monthly: 36525, yearly: 365250 }[filters.period] * 86400000;
      if (span > maxSpan) throw new ApiError(400, 'Date range is too large for the selected period.', 'DATE_RANGE_TOO_LARGE');
      const records = await analyticsRepository.sales({ businessId, ...filters, timeZone });
      const buckets = new Map(records.map((record) => [new Date(record.date).getTime(), record]));
      const data = [];
      let cursor = floorPeriod(filters.from, filters.period, timeZone);
      const last = floorPeriod(filters.to, filters.period, timeZone);
      for (let count = 0; count < 1000; count += 1) {
        const start = localDateToUtc(cursor, timeZone);
        const entry = buckets.get(start.getTime());
        data.push({ date: periodLabel(cursor, filters.period), totalSales: entry?.totalSales ?? 0,
          totalProfit: entry?.totalProfit ?? 0, totalInvoices: entry?.totalInvoices ?? 0,
          totalUnitsSold: entry?.totalUnitsSold ?? 0 });
        if (cursor.year === last.year && cursor.month === last.month && cursor.day === last.day) break;
        cursor = addPeriod(cursor, filters.period);
      }
      return { period: filters.period, from: filters.from, to: filters.to, timezone: timeZone, data };
    },

    async categories(query, businessValue) {
      const businessId = validateBusinessId(businessValue);
      const timeZone = await timeZoneFor(businessId);
      const range = validateAnalyticsRange(query, timeZone, now());
      const items = await analyticsRepository.categoryPerformance({ businessId, ...rangeFields(range) });
      return { from: range?.from ?? null, to: range?.to ?? null,
        items: items.map((item) => ({ ...item, profitMarginPercentage: percent(item.totalProfit, item.totalRevenue) })) };
    },

    async products(query, businessValue) {
      const businessId = validateBusinessId(businessValue);
      const timeZone = await timeZoneFor(businessId);
      const filters = validateProductQuery(query, timeZone, now());
      const records = await analyticsRepository.productPerformance({ businessId, ...rangeFields(filters.range),
        sortBy: filters.sortBy, order: filters.order, skip: filters.skip, limit: filters.limit });
      const allItems = Array.isArray(records) ? records : records.items;
      const items = allItems.map((item) => ({ ...item,
        profitMarginPercentage: percent(item.totalProfit, item.totalRevenue) }));
      return { from: filters.range?.from ?? null, to: filters.range?.to ?? null,
        sortBy: filters.sortBy, order: filters.order,
        items: Array.isArray(records) ? items.slice(filters.skip, filters.skip + filters.limit) : items,
        total: Array.isArray(records) ? records.length : records.total,
        page: filters.page, limit: filters.limit,
        totalPages: Math.ceil((Array.isArray(records) ? records.length : records.total) / filters.limit) };
    },

    async inventory(_query, businessValue) {
      const businessId = validateBusinessId(businessValue);
      const timeZone = await timeZoneFor(businessId);
      const current = now();
      const localToday = getLocalParts(current, timeZone);
      const start = localDateToUtc({ year: localToday.year, month: localToday.month, day: localToday.day }, timeZone);
      const end = new Date(localDateToUtc(addLocalDays(localToday, 31), timeZone).getTime() - 1);
      return analyticsRepository.inventory({ businessId, now: current, expiredBefore: start,
        expiringFrom: start, expiringTo: end });
    },
  };
}

function addPeriod(parts, period) {
  if (period === 'daily') return addLocalDays(parts, 1);
  if (period === 'weekly') return addLocalDays(parts, 7);
  if (period === 'monthly') {
    const date = new Date(Date.UTC(parts.year, parts.month, 1));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: 1 };
  }
  return { year: parts.year + 1, month: 1, day: 1 };
}

module.exports = { createAnalyticsService, percent };
