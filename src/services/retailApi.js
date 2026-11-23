import { apiRequest } from '../lib/api.js'

const queryString = values => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values || {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

async function getAllPages(path, params = {}) {
  const limit = 100
  const first = await apiRequest(`${path}${queryString({ ...params, page: 1, limit })}`)
  const items = [...(first.items || [])]
  for (let page = 2; page <= (first.totalPages || 0); page += 1) {
    const result = await apiRequest(`${path}${queryString({ ...params, page, limit })}`)
    items.push(...(result.items || []))
  }
  return items
}

export const retailApi = Object.freeze({
  health: () => apiRequest('/api/health'),

  categories: () => getAllPages('/api/categories'),
  createCategory: body => apiRequest('/api/categories', { method: 'POST', body }),
  updateCategory: (id, body) => apiRequest(`/api/categories/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  deleteCategory: id => apiRequest(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  products: params => getAllPages('/api/products', params),
  product: id => apiRequest(`/api/products/${encodeURIComponent(id)}`),
  createProduct: body => apiRequest('/api/products', { method: 'POST', body }),
  updateProduct: (id, body) => apiRequest(`/api/products/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  deleteProduct: id => apiRequest(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  lowStock: params => apiRequest(`/api/products/low-stock${queryString(params)}`),
  expiring: params => apiRequest(`/api/products/expiring${queryString(params)}`),
  expired: params => apiRequest(`/api/products/expired${queryString(params)}`),

  customers: params => getAllPages('/api/customers', params),
  customer: id => apiRequest(`/api/customers/${encodeURIComponent(id)}`),
  createCustomer: body => apiRequest('/api/customers', { method: 'POST', body }),
  updateCustomer: (id, body) => apiRequest(`/api/customers/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  deleteCustomer: id => apiRequest(`/api/customers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  customerPurchases: (id, params) => apiRequest(`/api/customers/${encodeURIComponent(id)}/purchases${queryString(params)}`),
  customerKhata: (id, params) => apiRequest(`/api/customers/${encodeURIComponent(id)}/khata${queryString(params)}`),
  customerKhataSummary: id => apiRequest(`/api/customers/${encodeURIComponent(id)}/khata/summary`),
  customerCredit: (id, body) => apiRequest(`/api/customers/${encodeURIComponent(id)}/khata/credit`, { method: 'POST', body }),
  customerKhataPayment: (id, body) => apiRequest(`/api/customers/${encodeURIComponent(id)}/khata/payments`, { method: 'POST', body }),
  outstandingKhata: params => getAllPages('/api/khata/outstanding', params),

  invoices: params => getAllPages('/api/invoices', params),
  invoice: id => apiRequest(`/api/invoices/${encodeURIComponent(id)}`),
  createInvoice: (body, idempotencyKey) => apiRequest('/api/invoices', { method: 'POST', body, idempotencyKey }),
  cancelInvoice: (id, body) => apiRequest(`/api/invoices/${encodeURIComponent(id)}/cancel`, { method: 'POST', body }),
  invoicePayment: (id, body, idempotencyKey) => apiRequest(`/api/invoices/${encodeURIComponent(id)}/payments`, { method: 'POST', body, idempotencyKey }),

  payments: params => getAllPages('/api/payments', params),
  payment: id => apiRequest(`/api/payments/${encodeURIComponent(id)}`),
  paymentsSummary: params => apiRequest(`/api/payments/summary${queryString(params)}`),
  customerPayment: (id, body, idempotencyKey) => apiRequest(`/api/customers/${encodeURIComponent(id)}/payments`, { method: 'POST', body, idempotencyKey }),
  transactions: params => getAllPages('/api/transactions', params),
  transaction: id => apiRequest(`/api/transactions/${encodeURIComponent(id)}`),

  dashboard: () => apiRequest('/api/dashboard/overview'),
  analytics: (path, params) => apiRequest(`/api/analytics/${path}${queryString(params)}`),
  businessProfile: () => apiRequest('/api/business/profile'),
  updateBusinessProfile: body => apiRequest('/api/business/profile', { method: 'PUT', body }),
  businessSettings: () => apiRequest('/api/business/settings'),
  updateBusinessSettings: body => apiRequest('/api/business/settings', { method: 'PUT', body }),
  resetPreview: () => apiRequest('/api/business/reset/preview'),
  resetBusinessData: body => apiRequest('/api/business/reset', { method: 'POST', body }),
})
