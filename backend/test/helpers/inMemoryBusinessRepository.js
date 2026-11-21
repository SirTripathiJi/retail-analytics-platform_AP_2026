const { createHash } = require('node:crypto');
const { DEFAULT_SETTINGS, RESET_COUNT_KEYS } = require('../../src/validators/businessValidation');
const ApiError = require('../../src/errors/ApiError');

function clone(value) { return structuredClone(value); }

function createInMemoryBusinessRepository({
  profiles = {}, settings = {}, operationalData = {}, centralAccounts = [], connectionMetadata = [],
  supportsTransactions = true, failReset = false, now = () => new Date(),
} = {}) {
  const state = {
    profiles: clone(profiles), settings: clone(settings),
    centralAccounts: clone(centralAccounts), connectionMetadata: clone(connectionMetadata), resetAudits: [],
    operationalData: Object.fromEntries(RESET_COUNT_KEYS.map((key) => [key, clone(operationalData[key] || [])])),
  };

  function currentCounts(businessId) {
    const counts = {};
    for (const key of ['products', 'categories', 'customers', 'khataLedgerEntries', 'invoices', 'payments', 'invoiceSequences']) {
      counts[key] = state.operationalData[key].filter((item) => item.businessId === businessId).length;
    }
    const invoices = state.operationalData.invoices.filter((item) => item.businessId === businessId);
    const cancellationEvents = invoices.filter((item) => item.cancellation?.cancelledAt).length;
    const linkedPayments = state.operationalData.khataLedgerEntries.filter((item) => item.businessId === businessId
      && String(item.referenceId || '').startsWith('payment:')).length;
    counts.transactions = counts.invoices + cancellationEvents + counts.payments + counts.khataLedgerEntries - linkedPayments;
    return counts;
  }

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }
  function currentFingerprint(businessId) {
    const hash = createHash('sha256');
    for (const key of ['products', 'categories', 'customers', 'khataLedgerEntries', 'invoices', 'payments', 'invoiceSequences']) {
      const tenantDocuments = state.operationalData[key].filter((item) => item.businessId === businessId)
        .map((item) => stable(item)).sort();
      hash.update(`${key}\0${tenantDocuments.join('\0')}\0`);
    }
    return hash.digest('hex');
  }

  const repository = {
    async getProfile(businessId) { return clone(state.profiles[businessId] || null); },
    async updateProfile(businessId, fields) {
      const current = state.profiles[businessId];
      state.profiles[businessId] = { ...(current || { businessName: fields.businessName, createdAt: now() }), ...clone(fields), updatedAt: now() };
      return clone(state.profiles[businessId]);
    },
    async getSettings(businessId) { return { ...DEFAULT_SETTINGS, ...(state.settings[businessId] || {}) }; },
    async updateSettings(businessId, fields) {
      state.settings[businessId] = { ...await repository.getSettings(businessId), ...clone(fields) };
      return clone(state.settings[businessId]);
    },
    async previewReset(businessId) { return { counts: currentCounts(businessId), snapshotFingerprint: currentFingerprint(businessId) }; },
    async resetBusinessData({ businessId, expectedCounts, expectedFingerprint, actorId }) {
      if (!supportsTransactions) throw new ApiError(503, 'Business reset requires MongoDB transaction support.', 'BUSINESS_RESET_TRANSACTION_UNAVAILABLE');
      const before = currentCounts(businessId);
      if (RESET_COUNT_KEYS.some((key) => before[key] !== expectedCounts[key]) || currentFingerprint(businessId) !== expectedFingerprint) {
        throw new ApiError(409, 'Business data changed after the reset preview.', 'RESET_PREVIEW_STALE');
      }
      const draft = clone(state);
      const deletedCounts = {};
      for (const key of ['products', 'categories', 'customers', 'khataLedgerEntries', 'invoices', 'payments', 'invoiceSequences']) {
        const retained = draft.operationalData[key].filter((item) => item.businessId !== businessId);
        deletedCounts[key] = draft.operationalData[key].length - retained.length;
        draft.operationalData[key] = retained;
      }
      deletedCounts.transactions = before.transactions;
      if (failReset) throw new Error('Simulated transaction abort.');
      const resetAt = now();
      draft.resetAudits.push({ businessId, actorId: String(actorId), resetAt, deletedCounts: clone(deletedCounts) });
      Object.assign(state, draft);
      return { resetAt, deletedCounts };
    },
  };
  return { repository, state };
}

module.exports = { createInMemoryBusinessRepository };
