export const DATA_VERSION = 1
export const DATA_PREFIX = 'arthsaathi-retail:v1:'

export function emptyRetailData() {
  return { version: DATA_VERSION, products: [], customers: [], sales: [], settlements: [], dashboardOrder: ['sales', 'profit', 'products', 'transactions'] }
}

export function money(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(value) || 0)
}

export function roundMoney(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100 }
export function localDay(date = new Date()) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export function saleBalance(sale) { return roundMoney(Math.max(0, Number(sale.total) - Number(sale.paid || 0))) }
export function saleStatus(sale) { const due = saleBalance(sale); return due <= 0 ? 'Paid' : Number(sale.paid || 0) > 0 ? 'Partial' : 'Due' }
export function saleProfit(sale) { return roundMoney((sale.items || []).reduce((sum, item) => sum + (item.productId ? (Number(item.rate) - Number(item.cost || 0)) * Number(item.quantity) : item.custom ? Number(item.rate) * Number(item.quantity) : 0), 0) - Number(sale.discountAmount || 0)) }

export function calculateInvoice({ items, discountPercent = 0, taxPercent = 0, paidAmount = 0 }) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + Number(item.rate) * Number(item.quantity), 0))
  const discountAmount = roundMoney(subtotal * Number(discountPercent || 0) / 100)
  const taxable = roundMoney(subtotal - discountAmount)
  const taxAmount = roundMoney(taxable * Number(taxPercent || 0) / 100)
  const total = roundMoney(taxable + taxAmount)
  const paid = roundMoney(Math.min(Math.max(0, Number(paidAmount || 0)), total))
  return { subtotal, discountAmount, taxAmount, total, paid, balance: roundMoney(total - paid), profit: saleProfit({ items, discountAmount }) }
}

export function expiryStatus(product, now = new Date()) {
  if (!product.expiryDate) return null
  const expiry = new Date(`${product.expiryDate}T00:00:00`)
  const days = Math.round((expiry.getTime() - new Date(`${localDay(now)}T00:00:00`).getTime()) / 86400000)
  if (days < 0) return { label: 'Expired', tone: 'danger', days }
  if (days <= 7) return { label: days === 0 ? 'Expires today' : `Expires in ${days}d`, tone: 'warning', days }
  return null
}

export function stockStatus(product) {
  if (Number(product.quantity) <= 0) return { label: 'Out of stock', tone: 'danger' }
  if (Number(product.quantity) <= Number(product.lowStockThreshold || 0)) return { label: 'Low stock', tone: 'warning' }
  return { label: 'In stock', tone: 'success' }
}

export function aggregateSales(sales) {
  return sales.reduce((acc, sale) => {
    acc.revenue = roundMoney(acc.revenue + Number(sale.total || 0))
    acc.profit = roundMoney(acc.profit + Number(sale.profit || 0))
    acc.collected = roundMoney(acc.collected + Number(sale.paid || 0))
    acc.outstanding = roundMoney(acc.outstanding + saleBalance(sale))
    return acc
  }, { revenue: 0, profit: 0, collected: 0, outstanding: 0 })
}

export function buildAnalytics(data, range = 'daily') {
  const now = new Date()
  const periodCount = range === 'daily' ? 14 : range === 'weekly' ? 12 : 12
  const bucketKey = date => {
    const d = new Date(date)
    if (range === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (range === 'weekly') { const week = new Date(d); week.setDate(week.getDate() - week.getDay()); return localDay(week) }
    return localDay(d)
  }
  const keys = Array.from({ length: periodCount }, (_, i) => {
    const d = new Date(now)
    if (range === 'monthly') d.setMonth(d.getMonth() - (periodCount - 1 - i), 1)
    else d.setDate(d.getDate() - (periodCount - 1 - i) * (range === 'weekly' ? 7 : 1))
    return bucketKey(d)
  })
  const grouped = new Map(keys.map(key => [key, { key, revenue: 0, profit: 0, cost: 0 }]))
  data.sales.forEach(sale => {
    const row = grouped.get(bucketKey(sale.createdAt))
    if (!row) return
    row.revenue = roundMoney(row.revenue + Number(sale.total || 0))
    row.profit = roundMoney(row.profit + Number(sale.profit || 0))
    row.cost = roundMoney(row.cost + (sale.items || []).reduce((sum, item) => sum + (item.productId ? Number(item.quantity) * Number(item.cost || 0) : 0), 0))
  })
  const products = new Map(data.products.map(product => [product.id, { id: product.id, name: product.name, units: 0, revenue: 0, profit: 0 }]))
  const categories = new Map()
  data.sales.forEach(sale => {
    const saleItems = sale.items || []
    const subtotal = saleItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.rate), 0)
    saleItems.forEach(item => {
      if (!item.productId) return
      const product = products.get(item.productId) || { id: item.productId, name: item.name, units: 0, revenue: 0, profit: 0 }
      const grossLine = Number(item.quantity) * Number(item.rate)
      const discountShare = subtotal ? Number(sale.discountAmount || 0) * grossLine / subtotal : 0
      const netLine = roundMoney(grossLine - discountShare)
      product.units += Number(item.quantity)
      product.revenue = roundMoney(product.revenue + netLine)
      product.profit = roundMoney(product.profit + Number(item.quantity) * (Number(item.rate) - Number(item.cost || 0)) - discountShare)
      products.set(item.productId, product)
      const category = item.category || data.products.find(p => p.id === item.productId)?.category || 'Uncategorized'
      categories.set(category, roundMoney((categories.get(category) || 0) + netLine))
    })
  })
  const productRows = [...products.values()].map(p => ({ ...p, margin: p.revenue ? roundMoney(p.profit / p.revenue * 100) : 0 })).sort((a, b) => b.revenue - a.revenue)
  return { trend: [...grouped.values()].map(row => ({ ...row, label: range === 'monthly' ? row.key.slice(0, 7) : range === 'weekly' ? row.key.slice(5) : row.key.slice(5) })), products: productRows, categories: [...categories].map(([name, value]) => ({ name, value })) }
}
