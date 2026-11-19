const ApiError = require('../errors/ApiError');
const PERIODS = new Set(['daily', 'weekly', 'monthly', 'yearly']);
const SORTS = new Set(['unitsSold', 'totalRevenue', 'totalCost', 'totalProfit', 'invoiceCount', 'profitMarginPercentage']);
function invalid(message) { throw new ApiError(400, message, 'VALIDATION_ERROR'); }

function parseDate(value, field, timeZone, endOfDay = false) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be an ISO date or datetime.`);
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [year, month, day] = dateOnly.slice(1).map(Number);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) invalid(`${field} must be a valid calendar date.`);
    const start = localDateToUtc({ year, month, day }, timeZone);
    if (!endOfDay) return start;
    const next = localDateToUtc(addLocalDays({ year, month, day }, 1), timeZone);
    return new Date(next.getTime() - 1);
  }
  if (!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/i.test(value)) invalid(`${field} datetime must include a timezone offset.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid(`${field} must be a valid ISO date or datetime.`);
  return parsed;
}

function getLocalParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day),
    hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second) };
}

function localDateToUtc(parts, timeZone) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = getLocalParts(new Date(guess), timeZone);
    const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const adjustment = target - represented;
    if (!adjustment) break;
    guess += adjustment;
  }
  return new Date(guess);
}

function addLocalDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function floorPeriod(date, period, timeZone) {
  const parts = getLocalParts(date, timeZone);
  if (period === 'daily') return { year: parts.year, month: parts.month, day: parts.day };
  if (period === 'weekly') {
    const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
    return addLocalDays({ year: parts.year, month: parts.month, day: parts.day }, -((weekday + 6) % 7));
  }
  if (period === 'monthly') return { year: parts.year, month: parts.month, day: 1 };
  return { year: parts.year, month: 1, day: 1 };
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

function periodLabel(parts, period) {
  const pad = (n) => String(n).padStart(2, '0');
  if (period === 'yearly') return String(parts.year);
  if (period === 'monthly') return `${parts.year}-${pad(parts.month)}`;
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function makeRange(query, timeZone, now, period = 'daily') {
  const hasFrom = query.from !== undefined;
  const hasTo = query.to !== undefined;
  let from;
  let to;
  if (hasFrom) from = parseDate(query.from, 'from', timeZone);
  if (hasTo) to = parseDate(query.to, 'to', timeZone, /^\d{4}-\d\d-\d\d$/.test(query.to));
  if (!hasFrom || !hasTo) {
    const current = hasTo ? to : now;
    const local = getLocalParts(current, timeZone);
    let defaultStart;
    if (period === 'daily') defaultStart = addLocalDays({ year: local.year, month: local.month, day: local.day }, -29);
    else if (period === 'weekly') defaultStart = addLocalDays(floorPeriod(current, 'weekly', timeZone), -77);
    else if (period === 'monthly') {
      const d = new Date(Date.UTC(local.year, local.month - 1 - 11, 1));
      defaultStart = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: 1 };
    } else defaultStart = { year: local.year - 4, month: 1, day: 1 };
    if (!hasFrom) from = localDateToUtc(defaultStart, timeZone);
    if (!hasTo) to = now;
  }
  if (from > to) invalid('from must be earlier than or equal to to.');
  return { from, to };
}

function validateSalesQuery(query, timeZone, now) {
  const period = query.period === undefined ? 'daily' : String(query.period).toLowerCase();
  if (!PERIODS.has(period)) invalid('period must be daily, weekly, monthly, or yearly.');
  const range = makeRange(query, timeZone, now, period);
  return { period, ...range };
}

function validateOverviewQuery(query, timeZone, now) {
  const range = query.from === undefined && query.to === undefined ? null : makeRange(query, timeZone, now, 'daily');
  return { range };
}

function validateAnalyticsRange(query, timeZone, now) {
  return query.from === undefined && query.to === undefined ? null : makeRange(query, timeZone, now);
}

function validateProductQuery(query, timeZone, now) {
  const range = query.from === undefined && query.to === undefined ? null : makeRange(query, timeZone, now, 'daily');
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) invalid('page must be a positive integer.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) invalid('limit must be from 1 to 100.');
  const sortBy = query.sortBy === undefined ? 'totalRevenue' : query.sortBy;
  if (!SORTS.has(sortBy)) invalid(`sortBy must be one of ${[...SORTS].join(', ')}.`);
  const order = query.order === undefined ? 'desc' : String(query.order).toLowerCase();
  if (!['asc', 'desc'].includes(order)) invalid('order must be asc or desc.');
  return { range, page, limit, skip: (page - 1) * limit, sortBy, order };
}

function validateBusinessId(id) {
  if (!id) throw new ApiError(401, 'Authenticated business context is missing.', 'BUSINESS_CONTEXT_REQUIRED');
  return String(id);
}

module.exports = { addLocalDays, floorPeriod, getLocalParts, localDateToUtc, makeRange, periodLabel,
  validateAnalyticsRange, validateBusinessId, validateOverviewQuery, validateProductQuery, validateSalesQuery };
