function createInMemoryAnalyticsRepository(data = {}) {
  const businesses = data;
  function scoped(businessId) { return businesses[businessId] || {}; }
  function inRange(date, from, to) {
    const value = new Date(date).getTime();
    return (!from || value >= from.getTime()) && (!to || value <= to.getTime());
  }
  return {
    async overview({ businessId, range }) {
      const value = scoped(businessId).overview || {};
      return { ...value, sales: { ...(value.sales || {}), range: range ? (value.sales?.range || {}) : null } };
    },
    async sales({ businessId, from, to }) {
      return (scoped(businessId).sales || []).filter((row) => inRange(row.date, from, to));
    },
    async categoryPerformance({ businessId }) { return scoped(businessId).categories || []; },
    async productPerformance({ businessId, sortBy = 'totalRevenue', order = 'desc', skip = 0, limit = 20 }) {
      const items = [...(scoped(businessId).products || [])];
      const direction = order === 'asc' ? 1 : -1;
      items.sort((a, b) => (a[sortBy] - b[sortBy]) * direction || a.productName.localeCompare(b.productName));
      return { items: items.slice(skip, skip + limit), total: items.length };
    },
    async inventory({ businessId }) { return scoped(businessId).inventory || {}; },
  };
}

module.exports = { createInMemoryAnalyticsRepository };
