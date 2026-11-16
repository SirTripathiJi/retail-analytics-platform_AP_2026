import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateSales, buildAnalytics, calculateInvoice, expiryStatus, saleBalance, saleStatus } from './retailUtils.js'
import { adjustProductStock, applyCustomerPayment, applySale } from './retailOperations.js'

const base = () => ({ version: 1, products: [{ id: 'p1', name: 'Rice', category: 'Staples', costPrice: 60, sellingPrice: 100, quantity: 5, lowStockThreshold: 1 }], customers: [{ id: 'c1', name: 'Asha' }], sales: [], settlements: [], dashboardOrder: [] })

test('invoice calculates discount before tax and rounds currency to paise', () => {
  const result = calculateInvoice({ items: [{ name: 'Rice', productId: 'p1', quantity: 2, rate: 100, cost: 60 }], discountPercent: 10, taxPercent: 5, paidAmount: 100 })
  assert.deepEqual(result, { subtotal: 200, discountAmount: 20, taxAmount: 9, total: 189, paid: 100, balance: 89, profit: 60 })
})

test('stock adjustments reject negative quantity without changing data', () => {
  const data = base()
  const denied = adjustProductStock(data, 'p1', -6)
  assert.equal(denied.ok, false)
  assert.equal(data.products[0].quantity, 5)
  assert.equal(adjustProductStock(data, 'p1', 2).data.products[0].quantity, 7)
})

test('sale save atomically records the invoice and decrements product stock', () => {
  const data = base()
  const result = applySale(data, { customerId: 'c1', items: [{ productId: 'p1', name: 'Rice', quantity: 2, rate: 100, cost: 60 }], total: 200, paid: 200, profit: 80 }, { now: new Date('2026-10-23T10:00:00Z'), id: 's1', invoiceId: 'AS-00000001' })
  assert.equal(result.ok, true)
  assert.equal(result.data.products[0].quantity, 3)
  assert.equal(result.data.sales[0].invoiceId, 'AS-00000001')
  assert.equal(data.products[0].quantity, 5)
})

test('sale rejects overselling and expired items', () => {
  const data = base()
  const tooMany = applySale(data, { items: [{ productId: 'p1', name: 'Rice', quantity: 6, rate: 100 }], paid: 600 }, { now: new Date('2026-10-23T10:00:00Z'), id: 's2', invoiceId: 'AS-2' })
  assert.equal(tooMany.ok, false)
  data.products[0].expiryDate = '2026-10-22'
  const expired = applySale(data, { items: [{ productId: 'p1', name: 'Rice', quantity: 1, rate: 100 }], total: 100, paid: 100 }, { now: new Date('2026-10-23T10:00:00Z'), id: 's3', invoiceId: 'AS-3' })
  assert.match(expired.error, /expired/i)
})

test('sale rules require a customer for credit and reject malformed totals', () => {
  const data = base()
  const items = [{ productId: 'p1', name: 'Rice', quantity: 1, rate: 100, cost: 60 }]
  assert.match(applySale(data, { items, paid: 50, paymentMethod: 'Cash' }).error, /customer/i)
  assert.match(applySale(data, { items: [{ ...items[0], rate: Number.NaN }], paid: 100 }).error, /rate/i)
})

test('customer settlement applies oldest due first and rejects surplus', () => {
  const data = base()
  data.sales = [
    { id: 'new', customerId: 'c1', createdAt: '2026-10-22T10:00:00Z', total: 50, paid: 0 },
    { id: 'old', customerId: 'c1', createdAt: '2026-10-20T10:00:00Z', total: 80, paid: 20 },
  ]
  const result = applyCustomerPayment(data, { customerId: 'c1', amount: 70, method: 'UPI' }, { now: new Date('2026-10-23T10:00:00Z'), id: 'pay1' })
  assert.equal(result.ok, true)
  assert.equal(result.data.sales.find(sale => sale.id === 'old').paid, 80)
  assert.equal(result.data.sales.find(sale => sale.id === 'new').paid, 10)
  assert.equal(saleBalance(result.data.sales.find(sale => sale.id === 'new')), 40)
  assert.equal(applyCustomerPayment(data, { customerId: 'c1', amount: 111, method: 'Cash' }).ok, false)
})

test('sales summaries, status, expiry, and analytics are derived from saved records', () => {
  const data = base()
  data.sales = [{ id: 's1', invoiceId: 'AS-1', createdAt: new Date().toISOString(), total: 200, paid: 150, profit: 80, items: [{ productId: 'p1', name: 'Rice', quantity: 2, rate: 100, cost: 60 }] }]
  assert.deepEqual(aggregateSales(data.sales), { revenue: 200, profit: 80, collected: 150, outstanding: 50 })
  assert.equal(saleStatus(data.sales[0]), 'Partial')
  assert.equal(expiryStatus({ expiryDate: '2026-10-23' }, new Date('2026-10-23T10:00:00Z')).days, 0)
  const analytics = buildAnalytics(data, 'daily')
  assert.equal(analytics.trend.reduce((sum, row) => sum + row.revenue, 0), 200)
  assert.equal(analytics.products[0].units, 2)
  assert.equal(analytics.categories[0].name, 'Staples')
})
