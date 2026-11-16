import { calculateInvoice, roundMoney } from './retailUtils.js'

export function adjustProductStock(data, id, delta) {
  const product = data.products.find(item => item.id === id)
  if (!product) return { ok: false, error: 'Product was not found.' }
  const quantity = Number(product.quantity) + Number(delta)
  if (!Number.isFinite(quantity) || quantity < 0) return { ok: false, error: 'Stock cannot be negative.' }
  return { ok: true, data: { ...data, products: data.products.map(item => item.id === id ? { ...item, quantity } : item) } }
}

export function applySale(data, sale, { now = new Date(), id = crypto.randomUUID(), invoiceId = `AS-${Date.now().toString().slice(-8)}` } = {}) {
  if (!Array.isArray(sale.items) || sale.items.length === 0 || sale.items.some(item => !item.name?.trim() || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0 || !Number.isFinite(Number(item.rate)) || Number(item.rate) <= 0)) return { ok: false, error: 'Add valid items with a description, positive whole quantity, and rate.' }
  const discountPercent = Number(sale.discountPercent ?? 0)
  const taxPercent = Number(sale.taxPercent ?? 0)
  const paidAmount = Number(sale.paid ?? 0)
  if (!Number.isFinite(discountPercent) || !Number.isFinite(taxPercent) || discountPercent < 0 || discountPercent > 100 || taxPercent < 0 || taxPercent > 100) return { ok: false, error: 'Discount and tax must be between 0 and 100 percent.' }
  if (!Number.isFinite(paidAmount) || paidAmount < 0) return { ok: false, error: 'Sale totals or paid amount are invalid.' }
  const totals = calculateInvoice({ items: sale.items, discountPercent, taxPercent, paidAmount })
  if (!Number.isFinite(totals.total) || totals.total <= 0 || paidAmount > totals.total) return { ok: false, error: 'Sale totals or paid amount are invalid.' }
  if ((totals.balance > 0 || sale.paymentMethod === 'Udhaar') && !data.customers.some(customer => customer.id === sale.customerId)) return { ok: false, error: 'A saved customer is required for credit or outstanding sales.' }
  if (sale.paymentMethod === 'Udhaar' && totals.balance <= 0) return { ok: false, error: 'An Udhaar sale needs an outstanding balance.' }
  const stock = new Map(data.products.map(item => [item.id, Number(item.quantity)]))
  for (const item of sale.items) {
    if (!item.productId) continue
    const product = data.products.find(row => row.id === item.productId)
    if (!product || Number(item.quantity) > stock.get(item.productId)) return { ok: false, error: `Not enough stock for ${item.name}.` }
    if (product.expiryDate && product.expiryDate < now.toISOString().slice(0, 10)) return { ok: false, error: `${item.name} is expired and cannot be sold.` }
    stock.set(item.productId, stock.get(item.productId) - Number(item.quantity))
  }
  const record = { ...sale, ...totals, status: totals.balance <= 0 ? 'Paid' : totals.paid > 0 ? 'Partial' : 'Due', id, invoiceId, createdAt: now.toISOString() }
  return { ok: true, sale: record, data: { ...data, products: data.products.map(product => stock.has(product.id) ? { ...product, quantity: stock.get(product.id) } : product), sales: [record, ...data.sales] } }
}

export function applyCustomerPayment(data, { customerId, amount, method }, { now = new Date(), id = crypto.randomUUID() } = {}) {
  const due = data.sales.filter(sale => sale.customerId === customerId).reduce((sum, sale) => sum + Math.max(0, Number(sale.total) - Number(sale.paid || 0)), 0)
  const payment = roundMoney(amount)
  if (!Number.isFinite(payment) || payment <= 0 || payment > due) return { ok: false, error: `Enter a positive amount up to ${roundMoney(due).toFixed(2)}.` }
  let remaining = payment
  const applied = new Map()
  const oldestFirst = [...data.sales].filter(sale => sale.customerId === customerId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  oldestFirst.forEach(sale => {
    if (remaining <= 0) return
    const balance = Math.max(0, Number(sale.total) - Number(sale.paid || 0))
    const amountForSale = roundMoney(Math.min(balance, remaining))
    if (amountForSale) { applied.set(sale.id, amountForSale); remaining = roundMoney(remaining - amountForSale) }
  })
  const sales = data.sales.map(sale => {
    if (!applied.has(sale.id)) return sale
    const paid = roundMoney(Number(sale.paid || 0) + applied.get(sale.id))
    const balance = roundMoney(Math.max(0, Number(sale.total) - paid))
    return { ...sale, paid, status: balance <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Due' }
  })
  const settlement = { id, customerId, amount: payment, method, createdAt: now.toISOString() }
  return { ok: true, settlement, data: { ...data, sales, settlements: [settlement, ...data.settlements] } }
}
