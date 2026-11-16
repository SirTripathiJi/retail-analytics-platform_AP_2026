import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Boxes, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CirclePlus, CreditCard, Download, Edit2, Eye, FileText, PackagePlus, Plus, Printer, ReceiptText, Search, Settings2, ShoppingCart, Trash2, TrendingUp, Users, X } from 'lucide-react'
import { Button } from '../components/ui/button.jsx'
import { Card } from '../components/ui/card.jsx'
import { Badge } from '../components/ui/badge.jsx'
import { Input } from '../components/ui/input.jsx'
import { Label } from '../components/ui/label.jsx'
import { Checkbox } from '../components/ui/checkbox.jsx'
import { Select } from '../components/ui/select.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.jsx'
import { Dialog } from '../components/ui/dialog.jsx'
import { useRetailData } from './RetailDataProvider.jsx'
import { useLanguage } from './LanguageProvider.jsx'
import { useTheme } from '../theme/ThemeProvider.jsx'
import { SalesTrendChart } from './components/SalesTrendChart.jsx'
import { useDashboardLanguage } from './DashboardLanguageProvider.jsx'
import { aggregateSales, buildAnalytics, calculateInvoice, expiryStatus, localDay, money, saleBalance, saleStatus, stockStatus } from './retailUtils.js'

const INR = value => new Intl.NumberFormat(`${document.documentElement.lang || 'en'}-IN`, { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)
const today = () => localDay()
const ERROR_KEYS = {
  'Enter a product name and category.': 'enterProductAndCategory',
  'Prices must be valid and quantities cannot be negative.': 'validPricesQuantities',
  'A product with this name already exists.': 'productDuplicate',
  'This product appears in completed sales and cannot be deleted.': 'productUsedInSales',
  'Stock cannot be negative.': 'stockCannotNegative',
  'Product was not found.': 'productNotFound',
  'Enter the customer name.': 'enterCustomerName',
  'Enter a valid phone number.': 'validPhone',
  'A customer with this phone number already exists.': 'customerDuplicatePhone',
  'This customer has sales history and cannot be deleted.': 'customerHasSales',
  'Could not save this product.': 'CouldNotSaveProduct',
  'Could not save customer.': 'couldNotSaveCustomer',
  'Add valid items with a description, positive whole quantity, and rate.': 'addValidBillItems',
  'Add at least one item to the bill.': 'addOneBillItem',
  'Discount and tax must be between 0 and 100 percent.': 'discountTaxError',
  'Sale totals or paid amount are invalid.': 'paidAmountInvalid',
  'A saved customer is required for credit or outstanding sales.': 'validCustomerRequired',
  'An Udhaar sale needs an outstanding balance.': 'udhaarBalanceRequired',
  'This sale could not be saved. Your cart is still here.': 'saleError',
  'Could not record settlement.': 'couldNotRecordPayment',
  'Every item needs a name, a positive rate, and a whole quantity.': 'itemNeedsNameRateQuantity',
  'Discount must be between 0 and 100 percent.': 'discountRange',
  'Tax must be between 0 and 100 percent.': 'taxRange',
  'Amount paid must be between zero and the bill total.': 'amountPaidMustRange',
  'Select a customer for a credit sale or outstanding balance.': 'customerRequiredForCredit',
  'For Udhaar, the paid amount must be less than the bill total.': 'udhaarPaidLess',
  'Customer deleted.': 'customerDeletedNotice',
  'Product deleted.': 'productDeletedNotice',
  'Unable to delete product.': 'unableDeleteProduct',
  'Unable to delete customer.': 'unableDeleteCustomer',
}
function translatedError(error, t) {
  if (!error) return ''
  if (ERROR_KEYS[error]) return t(ERROR_KEYS[error])
  const stock = error.match(/^Not enough stock for (.+)\.$/)
  if (stock) return t('notEnoughStockFor', { name: stock[1] })
  const expired = error.match(/^(.+) is expired and cannot be sold\.$/)
  if (expired) return t('expiredProduct', { name: expired[1] })
  const due = error.match(/^Enter a positive amount up to (.+)\.$/)
  if (due) return t('enterPositiveUpTo', { amount: due[1] })
  const dueMax = error.match(/^Enter a positive amount no greater than (.+)\.$/)
  if (dueMax) return t('enterPositiveUpTo', { amount: dueMax[1] })
  return t('operationFailed')
}
function PageHeading({ eyebrow = 'ArthSaathi', title, description, action }) { return <div className="retail-heading"><div><span className="retail-eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div> }
function EmptyState({ icon: Icon = Boxes, title, description, action }) { return <div className="retail-empty"><span><Icon size={21} /></span><h3>{title}</h3><p>{description}</p>{action}</div> }
function Notice({ message, onClose }) { const { t } = useLanguage(); return message ? <div className="retail-notice" role="status"><span>{ERROR_KEYS[message] || /^Not enough stock for /.test(message) || /is expired and cannot be sold\.$/.test(message) ? translatedError(message, t) : message}</span>{onClose && <button onClick={onClose} aria-label={t('dismiss')}><X size={15} /></button>}</div> : null }
function Modal({ open, onClose, title, children, wide = false }) { const { t } = useLanguage(); return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }} title={title} closeLabel={t('close')} className={wide ? 'wide' : ''}>{children}</Dialog> }
function Field({ label, id, error, children, ...props }) { return <div className="retail-field"><Label htmlFor={id}>{label}</Label>{children || <Input id={id} {...props} aria-invalid={Boolean(error)} />}{error && <small className="retail-field-error">{translatedError(error, t)}</small>}</div> }
function Status({ tone, children }) { return <Badge className={`retail-status ${tone || ''}`}>{children}</Badge> }
function SearchInput({ value, onChange, placeholder }) { const { t } = useLanguage(); const copy = placeholder || t('searchHint'); return <label className="retail-search"><Search size={15} /><input value={value} onChange={event => onChange(event.target.value)} placeholder={copy} aria-label={copy} />{value && <button onClick={() => onChange('')} aria-label={t('clearSearch')}><X size={14} /></button>}</label> }

const kpiNames = { sales: 'totalSales', profit: 'netProfit', products: 'productsInStock', transactions: 'transactionsToday' }
const kpiIcons = { sales: TrendingUp, profit: CreditCard, products: Boxes, transactions: ReceiptText }

function DashboardInsights({ data, t, locale, formatNumber, formatCurrency, formatDateTime }) {
  const [range, setRange] = useState('daily')
  const analytics = useMemo(() => buildAnalytics(data, range), [data, range])
  const salesSummary = useMemo(() => aggregateSales(data.sales), [data.sales])
  const hasRangeSales = analytics.trend.some(row => row.revenue > 0 || row.profit !== 0)
  const activities = useMemo(() => [
    ...data.sales.map(sale => ({ id: `sale-${sale.id}`, at: sale.createdAt, kind: 'sale', title: t('invoice', { id: sale.invoiceId }), detail: sale.customerName || t('walkInCustomer'), value: formatCurrency(sale.total), status: t(saleStatus(sale).toLowerCase()), statusTone: saleStatus(sale).toLowerCase(), to: '/transactions' })),
    ...data.products.filter(product => product.createdAt).map(product => ({ id: `product-${product.id}`, at: product.createdAt, kind: 'product', title: t('productAdded'), detail: product.name, value: `${formatNumber(product.quantity)} ${t('inStock')}`, to: '/inventory' })),
    ...data.customers.filter(customer => customer.createdAt).map(customer => ({ id: `customer-${customer.id}`, at: customer.createdAt, kind: 'customer', title: t('customerAdded'), detail: customer.name, value: customer.phone || t('customerRecord'), to: '/customers' })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6), [data.sales, data.products, data.customers, t, formatCurrency, formatNumber])
  const activityIcon = { sale: ReceiptText, product: PackagePlus, customer: Users }
  const chartData = analytics.trend.map(row => ({ ...row, label: new Intl.DateTimeFormat(locale, range === 'monthly' ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' }).format(new Date(`${row.key}${range === 'monthly' ? '-01' : ''}T00:00:00`)) }))

  return <div className="retail-dashboard-insights">
    <Card className="retail-panel retail-trend-panel">
      <div className="retail-panel-head retail-trend-head"><div><span className="retail-eyebrow">{t('businessPerformance')}</span><h2>{t('salesProfitTrend')}</h2><p className="retail-panel-subtitle">{t('fromSavedBills')} · {t(range === 'daily' ? 'last14Days' : range === 'weekly' ? 'last12Weeks' : 'last12Months')}</p></div><div className="trend-summary"><span>{t('revenue')} <strong>{formatCurrency(salesSummary.revenue)}</strong></span><span>{t('profit')} <strong>{formatCurrency(salesSummary.profit)}</strong></span></div></div>
      <div className="dashboard-chart-controls"><Tabs value={range} onValueChange={setRange} className="retail-segment small"><TabsList aria-label={t('salesProfitTrend')}>{[['daily', 'daily'], ['weekly', 'weekly'], ['monthly', 'monthly']].map(([value, label]) => <TabsTrigger key={value} value={value} currentValue={range} onValueChange={setRange}>{t(label)}</TabsTrigger>)}</TabsList></Tabs></div>
      {hasRangeSales ? <div className="retail-chart dashboard-trend-chart" role="img" aria-label={`${t('salesProfitTrend')} · ${t(range)} · ${t('fromSavedBills')}`}><SalesTrendChart data={chartData} locale={locale} formatCurrency={formatCurrency} labels={{ revenue: t('revenue'), profit: t('netProfitLegend') }} /></div> : <EmptyState icon={TrendingUp} title={t(data.sales.length ? 'noSalesInRange' : 'noSalesRecorded')} description={t(data.sales.length ? 'chooseAnotherRange' : 'completeBillForTrend')} action={!data.sales.length && <Link className="retail-link" to="/sales">{t('createBill')} <ChevronRight size={14} /></Link>} />}
    </Card>
    <Card className="retail-panel retail-activity-panel">
      <div className="retail-panel-head"><div><span className="retail-eyebrow">{t('recentActivity')}</span><h2>{t('storeTimeline')}</h2></div><Activity size={16} aria-hidden="true" /></div>
      {activities.length ? <ol className="retail-activity-list">{activities.map(event => { const Icon = activityIcon[event.kind]; return <li key={event.id}><span className={`retail-activity-icon ${event.kind}`}><Icon size={14} aria-hidden="true" /></span><Link to={event.to} className="retail-activity-copy"><strong>{event.title}</strong><span>{event.detail}</span><small><time dateTime={event.at}>{formatDateTime(event.at)}</time></small></Link><div className="retail-activity-value"><strong>{event.value}</strong>{event.status && <Status tone={event.statusTone}>{event.status}</Status>}</div></li> })}</ol> : <EmptyState icon={Activity} title={t('noActivity')} description={t('activityWillAppear')} />}
    </Card>
  </div>
}

export function RetailDashboard() {
  const { data, reorderDashboard } = useRetailData()
  const { t, locale, formatNumber, formatCurrency, formatDate, formatDateTime } = useDashboardLanguage()
  const { search = '' } = useOutletContext() || {}
  const navigate = useNavigate()
  const total = aggregateSales(data.sales)
  const todaySales = data.sales.filter(sale => localDay(sale.createdAt) === today()).length
  const metrics = { sales: formatCurrency(total.revenue), profit: formatCurrency(total.profit), products: formatNumber(data.products.length), transactions: formatNumber(todaySales) }
  const [alertsExpanded, setAlertsExpanded] = useState(true)
  const [notice, setNotice] = useState('')
  const alerts = useMemo(() => {
    const rows = []
    data.products.forEach(product => {
      const expiry = expiryStatus(product)
      if (expiry?.tone === 'danger') rows.push({ product, statusKey: 'expired', tone: 'danger', rank: 0 })
      else if (expiry) rows.push({ product, statusKey: expiry.days === 0 ? 'expiresToday' : 'expiresInDays', days: expiry.days, tone: 'warning', rank: 1 })
      else if (Number(product.quantity) === 0) rows.push({ product, statusKey: 'outOfStock', tone: 'danger', rank: 3 })
      else if (Number(product.quantity) <= Number(product.lowStockThreshold || 0)) rows.push({ product, statusKey: 'lowStock', tone: 'warning', rank: 2 })
    })
    return rows.sort((a, b) => a.rank - b.rank)
  }, [data.products])
  const move = (index, delta) => { const order = [...data.dashboardOrder]; const next = index + delta; if (next < 0 || next >= order.length) return; [order[index], order[next]] = [order[next], order[index]]; reorderDashboard(order) }
  const dropCard = (event, target) => { event.preventDefault(); const source = event.dataTransfer.getData('text/plain'); const order = [...data.dashboardOrder]; const from = order.indexOf(source); const to = order.indexOf(target); if (from < 0 || to < 0 || from === to) return; order.splice(to, 0, order.splice(from, 1)[0]); reorderDashboard(order) }
  return <>
    <PageHeading title={t('overview')} description={t('overviewDescription')} action={<Button onClick={() => navigate('/sales')}><Plus size={15} />{t('newBill')}</Button>} />
    <Notice message={notice} onClose={() => setNotice('')} />
    <div className="retail-kpis">{data.dashboardOrder.map((key, index) => { const Icon = kpiIcons[key]; const name = t(kpiNames[key]); return <Card className="retail-kpi" key={key} draggable onDragStart={event => event.dataTransfer.setData('text/plain', key)} onDragOver={event => event.preventDefault()} onDrop={event => dropCard(event, key)}><div className="retail-kpi-head"><span>{name}</span><Icon size={16} /></div><strong>{metrics[key]}</strong><small>{t(key === 'sales' ? 'recordedSaleTotals' : key === 'profit' ? 'recordedSaleProfit' : key === 'products' ? 'productRecords' : 'localCalendarDay')}</small><div className="retail-order-controls"><button title={t('moveEarlier', { name })} aria-label={t('moveEarlier', { name })} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={12} /></button><button title={t('moveLater', { name })} aria-label={t('moveLater', { name })} disabled={index === 3} onClick={() => move(index, 1)}><ArrowDown size={12} /></button></div></Card> })}</div>
    <Card className="retail-panel retail-alert-panel"><div className="retail-panel-head"><div><span className="retail-eyebrow">{t('stockHealth')}</span><h2>{t('inventoryAlerts')} <span className="retail-count">{formatNumber(alerts.length)}</span></h2></div><button className="retail-text-button" onClick={() => setAlertsExpanded(value => !value)} aria-expanded={alertsExpanded}>{t(alertsExpanded ? 'hide' : 'show')} <ChevronDown size={14} /></button></div>
      {alertsExpanded && (alerts.length ? <div className="retail-alert-list">{alerts.map(({ product, statusKey, days, tone }) => <div className="retail-alert-row" key={product.id}><AlertTriangle size={16} /><strong>{product.name}</strong><span>{formatNumber(product.quantity)} {t('inStock')}</span><Status tone={tone}>{t(statusKey, { days: formatNumber(days) })}</Status></div>)}</div> : <div className="retail-all-clear"><Check size={17} /><span>{t('noInventoryAlerts')}</span></div>)}
    </Card>
    <DashboardInsights data={data} t={t} locale={locale} formatNumber={formatNumber} formatCurrency={formatCurrency} formatDateTime={formatDateTime} />
    <div className="retail-dashboard-bottom"><Card className="retail-panel"><div className="retail-panel-head"><div><span className="retail-eyebrow">{t('recentActivity')}</span><h2>{t('latestSales')}</h2></div><Link className="retail-link" to="/transactions">{t('allTransactions')} <ChevronRight size={14} /></Link></div>{data.sales.length ? <div className="retail-table-wrap"><Table><TableHeader><TableRow><TableHead>{t('invoice', { id: '' }).trim()}</TableHead><TableHead>{t('customer')}</TableHead><TableHead>{t('date')}</TableHead><TableHead className="numeric">{t('amount')}</TableHead><TableHead>{t('status')}</TableHead></TableRow></TableHeader><TableBody>{data.sales.filter(sale => `${sale.invoiceId} ${sale.customerName || ''}`.toLowerCase().includes(search.toLowerCase())).slice(0, 5).map(sale => <TableRow key={sale.id}><TableCell><strong>{sale.invoiceId}</strong></TableCell><TableCell>{sale.customerName || t('walkInCustomer')}</TableCell><TableCell>{formatDate(sale.createdAt)}</TableCell><TableCell className="numeric">{formatCurrency(sale.total)}</TableCell><TableCell><Status tone={saleStatus(sale).toLowerCase()}>{t(saleStatus(sale).toLowerCase())}</Status></TableCell></TableRow>)}</TableBody></Table></div> : <EmptyState icon={ReceiptText} title={t('noSalesHere')} description={t('completedBillsAppear')} action={<Link className="retail-link" to="/sales">{t('createFirstBill')} <ChevronRight size={14} /></Link>} />}</Card>
      <Card className="retail-panel retail-setup-panel"><span className="retail-eyebrow">{t('getStarted')}</span><h2>{t('setupShopRecords')}</h2><p>{t('setupDescription')}</p><Link className="retail-outline-link" to="/inventory"><Boxes size={16} />{t('addProducts')}</Link><Link className="retail-outline-link" to="/customers"><Users size={16} />{t('addCustomer')}</Link></Card></div>
  </>
}

const blankProduct = { name: '', category: '', costPrice: '', sellingPrice: '', quantity: '', lowStockThreshold: '5', expiryDate: '' }
function ProductForm({ product, onSave, onCancel }) {
  const { t, formatCurrency, locale } = useLanguage()
  const [values, setValues] = useState(product || blankProduct)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const margin = values.sellingPrice && Number(values.sellingPrice) > 0 ? ((Number(values.sellingPrice) - Number(values.costPrice || 0)) / Number(values.sellingPrice) * 100) : 0
  const submit = async event => { event.preventDefault(); if (!values.name.trim() || !values.category.trim()) return setError('Enter a product name and category.'); if (Number(values.costPrice) < 0 || Number(values.sellingPrice) <= 0 || Number(values.quantity) < 0 || Number(values.lowStockThreshold) < 0) return setError('Prices must be valid and quantities cannot be negative.'); setSaving(true); const result = onSave({ ...values, name: values.name.trim(), category: values.category.trim(), costPrice: Number(values.costPrice), sellingPrice: Number(values.sellingPrice), quantity: Number(values.quantity), lowStockThreshold: Number(values.lowStockThreshold) }); if (!result.ok) setError(result.error || 'Could not save this product.'); else onCancel(); setSaving(false) }
  return <form className="retail-form" onSubmit={submit}><div className="retail-form-grid"><Field label={t('productName')} id="product-name" value={values.name} onChange={e => setValues({ ...values, name: e.target.value })} required autoFocus placeholder={t('exampleAtta')} /><Field label={t('category')} id="product-category" value={values.category} onChange={e => setValues({ ...values, category: e.target.value })} required placeholder={t('exampleStaples')} /><Field label={t('costPrice')} id="product-cost" type="number" min="0" step="0.01" value={values.costPrice} onChange={e => setValues({ ...values, costPrice: e.target.value })} required /><Field label={t('sellingPrice')} id="product-sell" type="number" min="0.01" step="0.01" value={values.sellingPrice} onChange={e => setValues({ ...values, sellingPrice: e.target.value })} required /><Field label={t('quantity')} id="product-quantity" type="number" min="0" step="1" value={values.quantity} onChange={e => setValues({ ...values, quantity: e.target.value })} required /><Field label={t('lowThreshold')} id="product-threshold" type="number" min="0" step="1" value={values.lowStockThreshold} onChange={e => setValues({ ...values, lowStockThreshold: e.target.value })} required /><Field label={t('expiryOptional')} id="product-expiry" type="date" value={values.expiryDate || ''} onChange={e => setValues({ ...values, expiryDate: e.target.value })} /></div><div className="retail-preview-line"><span>{t('estimatedStockValue')} <strong>{formatCurrency(Number(values.costPrice || 0) * Number(values.quantity || 0))}</strong></span><span>{t('grossMargin')} <strong>{Number.isFinite(margin) ? `${new Intl.NumberFormat(locale,{minimumFractionDigits:1,maximumFractionDigits:1}).format(margin)}%` : '—'}</strong></span></div>{error && <p className="retail-form-error" role="alert">{translatedError(error, t)}</p>}<div className="retail-form-actions"><Button type="button" variant="outline" onClick={onCancel}>{t('cancel')}</Button><Button type="submit" disabled={saving}>{saving ? t('saving') : product ? t('saveChanges') : t('addProduct')}</Button></div></form>
}

export function InventoryPage() {
  const { t, formatNumber, formatDate, locale } = useLanguage()
  const { data, addProduct, updateProduct, deleteProduct, adjustStock } = useRetailData()
  const { search = '' } = useOutletContext() || {}
  const [query, setQuery] = useState(search)
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState(null)
  useEffect(() => { setQuery(search) }, [search])
  const categories = [...new Set(data.products.map(product => product.category))].sort()
  const rows = data.products.filter(product => `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase()) && (category === 'all' || product.category === category)).sort((a, b) => { const av = a[sort.key] ?? ''; const bv = b[sort.key] ?? ''; return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * (sort.dir === 'asc' ? 1 : -1) })
  const lowCount = data.products.filter(p => Number(p.quantity) <= Number(p.lowStockThreshold || 0)).length
  const expiredCount = data.products.filter(p => expiryStatus(p)?.tone === 'danger').length
  const onSave = product => modal?.product ? updateProduct(modal.product.id, product) : addProduct(product)
  const deleteCurrent = () => { const result = deleteProduct(confirm.id); setNotice(result.error || (result.ok ? 'Product deleted.' : 'Unable to delete product.')); setConfirm(null) }
  return <><PageHeading title={t('inventory')} description={t('inventoryDescription')} action={<Button onClick={() => setModal({})}><Plus size={15} />{t('addProduct')}</Button>} />
    <div className="retail-summary-strip"><span><strong>{formatNumber(data.products.length)}</strong> {t('products')}</span><span><strong>{formatNumber(categories.length)}</strong> {t('categories')}</span><span><strong>{formatNumber(lowCount)}</strong> {t('lowOutStock')}</span><span><strong>{formatNumber(expiredCount)}</strong> {t('expired')}</span></div><Notice message={notice} onClose={() => setNotice('')} />
    <Card className="retail-panel"><div className="retail-toolbar"><SearchInput value={query} onChange={setQuery} placeholder={t('searchProductsCategories')} /><Select value={category} onChange={e => setCategory(e.target.value)} aria-label={t('filterCategory')}><option value="all">{t('allCategories')}</option>{categories.map(name => <option key={name}>{name}</option>)}</Select></div>
      {rows.length ? <div className="retail-table-wrap"><Table><TableHeader><TableRow>{[['name','product'],['category','category'],['costPrice','cost'],['sellingPrice','price'],['quantity','quantity'],['expiryDate','expiry']].map(([key,label]) => <TableHead key={key}><button className="retail-sort" onClick={() => setSort(current => ({ key, dir: current.key === key && current.dir === 'asc' ? 'desc' : 'asc' }))}>{t(label)}<ArrowUpDown size={12} /></button></TableHead>)}<TableHead>{t('status')}</TableHead><TableHead className="numeric">{t('actions')}</TableHead></TableRow></TableHeader><TableBody>{rows.map(product => { const stock = stockStatus(product); const expiry = expiryStatus(product); const status = expiry || stock; const statusKey = expiry ? expiry.days < 0 ? 'expired' : expiry.days === 0 ? 'expiresToday' : 'expiresInDays' : stock.label === 'Out of stock' ? 'outOfStock' : stock.label === 'Low stock' ? 'lowStock' : 'inStock'; const margin = product.sellingPrice ? (product.sellingPrice - product.costPrice) / product.sellingPrice * 100 : null; return <TableRow key={product.id}><TableCell><strong>{product.name}</strong><small className="table-subline">{t('margin')} {margin === null ? '—' : `${new Intl.NumberFormat(locale,{minimumFractionDigits:1,maximumFractionDigits:1}).format(margin)}%`}</small></TableCell><TableCell>{product.category}</TableCell><TableCell>{INR(product.costPrice)}</TableCell><TableCell>{INR(product.sellingPrice)}</TableCell><TableCell><div className="stock-adjust"><button aria-label={`${t('decrease')} ${product.name} ${t('stock')}`} onClick={() => { const r = adjustStock(product.id, -1); setNotice(r.error || '') }}>−</button><strong>{formatNumber(product.quantity)}</strong><button aria-label={`${t('increase')} ${product.name} ${t('stock')}`} onClick={() => { const r = adjustStock(product.id, 1); setNotice(r.error || '') }}>+</button></div></TableCell><TableCell>{product.expiryDate ? formatDate(`${product.expiryDate}T00:00:00`, { dateStyle: 'medium' }) : '—'}</TableCell><TableCell><Status tone={status.tone}>{t(statusKey, expiry && expiry.days > 0 ? { days: formatNumber(expiry.days) } : {})}</Status></TableCell><TableCell className="numeric"><div className="table-actions"><button title={t('editProduct')} aria-label={`${t('editProduct')} ${product.name}`} onClick={() => setModal({ product })}><Edit2 size={14} /></button><button title={t('deleteProduct')} aria-label={`${t('deleteProduct')} ${product.name}`} onClick={() => setConfirm(product)}><Trash2 size={14} /></button></div></TableCell></TableRow> })}</TableBody></Table></div> : <EmptyState title={t(data.products.length ? 'noMatchingProducts' : 'inventoryEmpty')} description={t(data.products.length ? 'tryOtherSearchCategory' : 'trackStockExpiry')} action={!data.products.length && <Button onClick={() => setModal({})}><Plus size={14} />{t('addFirstProductButton')}</Button>} />}
    </Card>
    <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal?.product ? t('editProduct') : t('addAProduct')}><ProductForm key={modal?.product?.id || 'new'} product={modal?.product} onSave={onSave} onCancel={() => setModal(null)} /></Modal>
    <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title={t('deleteProductQuestion')}><p className="retail-modal-copy">{confirm?.name} {t('productRemovedNotice')}</p><div className="retail-form-actions"><Button variant="outline" onClick={() => setConfirm(null)}>{t('cancel')}</Button><Button className="danger-button" onClick={deleteCurrent}>{t('deleteProduct')}</Button></div></Modal>
  </>
}

function Invoice({ sale, onClose }) { const { t, formatDateTime, formatNumber } = useLanguage(); if (!sale) return null; return <Modal open onClose={onClose} title={`${t('invoiceLabel')} ${sale.invoiceId}`} wide><div className="invoice-preview" id="invoice-print"><div className="invoice-brand"><strong>ArthSaathi</strong><span>{t('shopInvoice')}</span></div><div className="invoice-meta"><span>{t('invoiceLabel')} <strong>{sale.invoiceId}</strong></span><span>{t('date')} <strong>{formatDateTime(sale.createdAt)}</strong></span><span>{t('customer')} <strong>{sale.customerName || t('walkInCustomer')}</strong></span></div><div className="retail-table-wrap"><Table><TableHeader><TableRow><TableHead>{t('item')}</TableHead><TableHead>{t('qty')}</TableHead><TableHead>{t('rate')}</TableHead><TableHead className="numeric">{t('amount')}</TableHead></TableRow></TableHeader><TableBody>{sale.items.map((item,index)=><TableRow key={`${item.name}-${index}`}><TableCell>{item.name}{item.custom && <small className="table-subline">{t('customCharge')}</small>}</TableCell><TableCell>{formatNumber(item.quantity)}</TableCell><TableCell>{INR(item.rate)}</TableCell><TableCell className="numeric">{INR(item.quantity * item.rate)}</TableCell></TableRow>)}</TableBody></Table></div><div className="invoice-totals"><span>{t('subtotal')} <strong>{INR(sale.subtotal)}</strong></span><span>{t('discount')} <strong>−{INR(sale.discountAmount)}</strong></span><span>{t('tax')} <strong>{INR(sale.taxAmount)}</strong></span><span className="invoice-total">{t('total')} <strong>{INR(sale.total)}</strong></span><span>{t('paid')} <strong>{INR(sale.paid)}</strong></span><span>{t('balance')} <strong>{INR(saleBalance(sale))}</strong></span></div>{sale.notes && <p className="invoice-note">{t('note')}: {sale.notes}</p>}</div><div className="retail-form-actions no-print"><Button variant="outline" onClick={onClose}>{t('close')}</Button><Button onClick={() => window.print()}><Printer size={14} />{t('printInvoice')}</Button></div></Modal> }

export function SalesPage() {
  const { t, formatNumber } = useLanguage()
  const { data, createSale } = useRetailData()
  const { search: globalSearch = '' } = useOutletContext() || {}
  const navigate = useNavigate()
  const [cart, setCart] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState('0')
  const [tax, setTax] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [paid, setPaid] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [invoice, setInvoice] = useState(null)
  const productInputRef = useRef(null)
  const usable = data.products.filter(product => product.quantity > 0 && !(product.expiryDate && product.expiryDate < today()))
  const pickerQuery = productSearch || globalSearch
  const matches = usable.filter(product => product.name.toLowerCase().includes(pickerQuery.toLowerCase())).slice(0, 8)
  const estimate = calculateInvoice({ items: cart, discountPercent: discount, taxPercent: tax, paidAmount: 0 })
  const paidValue = paid === '' && paymentMethod !== 'Udhaar' ? estimate.total : Number(paid || 0)
  const totals = calculateInvoice({ items: cart, discountPercent: discount, taxPercent: tax, paidAmount: paidValue })
  const addItem = product => { setCart(current => { const existing = current.find(item => item.productId === product.id); if (existing) { if (existing.quantity >= product.quantity) return current; return current.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item) } return [...current, { productId: product.id, name: product.name, category: product.category, quantity: 1, rate: Number(product.sellingPrice), cost: Number(product.costPrice), available: Number(product.quantity) }] }); setProductSearch('') }
  const changeItem = (index, key, value) => setCart(current => current.map((item,i) => i !== index ? item : { ...item, [key]: key === 'quantity' ? Math.max(1, Math.min(Number(value) || 1, item.available ?? 999999)) : Math.max(0, Number(value) || 0) }))
  const addCustom = () => setCart(current => [...current, { name: '', custom: true, quantity: 1, rate: 0, cost: 0 }])
  const submit = event => { event.preventDefault(); if (!cart.length) return setError('Add at least one item to the bill.'); if (cart.some(item => !item.name.trim() || item.rate <= 0 || !Number.isInteger(Number(item.quantity)))) return setError('Every item needs a name, a positive rate, and a whole quantity.'); if (!Number.isFinite(Number(discount)) || Number(discount) < 0 || Number(discount) > 100) return setError('Discount must be between 0 and 100 percent.'); if (!Number.isFinite(Number(tax)) || Number(tax) < 0 || Number(tax) > 100) return setError('Tax must be between 0 and 100 percent.'); const effectivePaid = paid === '' ? estimate.total : Number(paid); if (!Number.isFinite(effectivePaid) || effectivePaid < 0 || effectivePaid > estimate.total) return setError('Amount paid must be between zero and the bill total.'); const remaining = totals.balance; if ((paymentMethod === 'Udhaar' || remaining > 0) && !customerId) return setError('Select a customer for a credit sale or outstanding balance.'); if (paymentMethod === 'Udhaar' && totals.paid >= totals.total) return setError('For Udhaar, the paid amount must be less than the bill total.'); setSaving(true); const customer = data.customers.find(item => item.id === customerId); const sale = { customerId: customer?.id || null, customerName: customer?.name || '', notes: notes.trim(), items: cart, paid: totals.paid, discountPercent: Number(discount), taxPercent: Number(tax), paymentMethod }; const result = createSale(sale); if (!result.ok) setError(result.error || 'This sale could not be saved. Your cart is still here.'); else { setInvoice(result.data.sales[0]); setCart([]); setNotes(''); setDiscount('0'); setTax('0'); setPaid(''); setCustomerId(''); setError('') } setSaving(false) }
  return <><PageHeading title={t('billingSales')} description={t('billingDescription')} action={<Link className="retail-outline-link compact" to="/transactions"><ReceiptText size={15} />{t('transactionHistory')}</Link>} />
    <form className="sales-layout" noValidate onSubmit={submit}><div className="retail-panel sales-builder"><div className="retail-panel-head"><div><span className="retail-eyebrow">{t('newTransaction')}</span><h2>{t('addItems')}</h2></div><span className="retail-count">{formatNumber(cart.length)} {t('lines')}</span></div>
      <div className="product-picker"><Search size={16} /><input ref={productInputRef} role="combobox" aria-autocomplete="list" aria-expanded={Boolean(pickerQuery && matches.length)} aria-controls="sale-product-options" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder={t('findProduct')} aria-label={t('searchProducts')} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (matches[0]) addItem(matches[0]) } if (e.key === 'ArrowDown') { e.preventDefault(); document.querySelector('#sale-product-options button')?.focus() } if (e.key === 'Escape') setProductSearch('') }} /><span>{t('enterToAdd')}</span>{pickerQuery && <div className="product-suggestions" id="sale-product-options" role="listbox">{matches.length ? matches.map((product,index) => <button type="button" role="option" aria-selected="false" key={product.id} onClick={() => { addItem(product); productInputRef.current?.focus() }} onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const options = [...e.currentTarget.parentElement.querySelectorAll('button')]; const step = e.key === 'ArrowDown' ? 1 : -1; options[(index + step + options.length) % options.length]?.focus() } if (e.key === 'Escape') productInputRef.current?.focus() }}><span><strong>{product.name}</strong><small>{formatNumber(product.quantity)} {t('available')} · {INR(product.sellingPrice)}</small></span><Plus size={15} /></button>) : <p>{t('noProductsMatch')}</p>}</div>}</div>
      {cart.length ? <div className="sales-cart">{cart.map((item,index)=><div className="sales-cart-row" key={`${item.productId || 'custom'}-${index}`}><div className="cart-item-name">{item.custom ? <Input aria-label={t('customChargeDescription')} placeholder={t('chargeDescription')} value={item.name} onChange={e => changeItem(index,'name',e.target.value)} required /> : <><strong>{item.name}</strong><small>{formatNumber(item.available)} {t('available')}</small></>}</div><label>{t('qty')}<Input type="number" min="1" max={item.available || 999999} aria-label={`${t('quantity')} ${item.name || t('customCharge')}`} value={item.quantity} onChange={e => changeItem(index,'quantity',e.target.value)} /></label><label>{t('rate')}<Input type="number" min="0.01" step="0.01" aria-label={`${t('rate')} ${item.name || t('customCharge')}`} value={item.rate} onChange={e => changeItem(index,'rate',e.target.value)} /></label><strong className="cart-line-total">{INR(item.quantity * item.rate)}</strong><button type="button" className="retail-icon-button" aria-label={`${t('remove')} ${item.name || t('customCharge')}`} onClick={() => setCart(current => current.filter((_,i)=>i!==index))}><Trash2 size={15} /></button></div>)}</div> : <EmptyState icon={ShoppingCartIcon} title={t('yourBillEmpty')} description={t('searchAddProducts')} />}
      <Button type="button" variant="outline" className="custom-charge-button" onClick={addCustom}><CirclePlus size={14} />{t('addCustomCharge')}</Button>
      <div className="sales-form-grid"><div className="retail-field"><Label htmlFor="sale-customer">{t('customer')}</Label><Select id="sale-customer" value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">{t('walkInCustomer')}</option>{data.customers.map(customer => <option value={customer.id} key={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}</Select></div><Field label={t('notesOptional')} id="sale-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('shortInvoiceNote')} /></div>
    </div><Card className="retail-panel sales-summary"><div className="retail-panel-head"><div><span className="retail-eyebrow">{t('orderSummary')}</span><h2>{t('reviewBill')}</h2></div><FileText size={17} /></div><div className="sales-summary-fields"><Field label={t('discountPercent')} id="sale-discount" type="number" min="0" max="100" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /><Field label={t('taxPercent')} id="sale-tax" type="number" min="0" max="100" step="0.01" value={tax} onChange={e => setTax(e.target.value)} /><div className="retail-field"><Label htmlFor="sale-method">{t('paymentMethod')}</Label><Select id="sale-method" value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value); if (e.target.value === 'Udhaar') { setPaid('0') } else { setPaid(String(totals.total)) } }}><option value="Cash">{t('cash')}</option><option value="UPI">{t('upi')}</option><option value="Card">{t('card')}</option><option value="Udhaar">{t('udhaar')}</option></Select></div><Field label={t('amountPaid')} id="sale-paid" type="number" min="0" max={totals.total} step="0.01" value={paid === '' ? totals.total : paid} onChange={e => setPaid(e.target.value)} /></div>
      <div className="sales-total-list"><span>{t('subtotal')} <strong>{INR(totals.subtotal)}</strong></span><span>{t('discount')} <strong>−{INR(totals.discountAmount)}</strong></span><span>{t('taxAfterDiscount')} <strong>{INR(totals.taxAmount)}</strong></span><span className="sales-total-main">{t('totalDue')} <strong>{INR(totals.total)}</strong></span><span>{t('paid')} <strong>{INR(paidValue)}</strong></span><span className="sales-balance">{t('outstanding')} <strong>{INR(totals.balance)}</strong></span><small>{t('estimatedProfit')} {INR(totals.profit)}</small></div>
      {error && <p className="retail-form-error" role="alert">{translatedError(error, t)}</p>}<Button type="submit" className="complete-sale-button" disabled={saving}>{saving ? t('savingBill') : t('completeSale')}<ChevronRight size={15} /></Button><p className="sales-local-note">{t('stockSavedNote')}</p>
    </Card></form><Invoice sale={invoice} onClose={() => setInvoice(null)} />
  </>
}
function ShoppingCartIcon(props) { return <ShoppingCart {...props} /> }

function CustomerForm({ customer, onSave, onCancel }) {
  const { t } = useLanguage()
  const [values, setValues] = useState(customer || { name: '', phone: '', address: '', notes: '' })
  const [error, setError] = useState('')
  const submit = event => { event.preventDefault(); if (!values.name.trim()) return setError('Enter the customer name.'); if (values.phone && !/^[+\d][\d\s()-]{5,19}$/.test(values.phone)) return setError('Enter a valid phone number.'); const result = onSave({ ...values, name: values.name.trim(), phone: values.phone.trim() }); if (!result.ok) setError(result.error || 'Could not save customer.'); else onCancel() }
  return <form className="retail-form" onSubmit={submit}><Field label={t('customerName')} id="customer-name" autoFocus required value={values.name} onChange={e => setValues({ ...values, name: e.target.value })} /><Field label={t('phone')} id="customer-phone" type="tel" autoComplete="tel" value={values.phone} onChange={e => setValues({ ...values, phone: e.target.value })} /><Field label={t('addressOptional')} id="customer-address" value={values.address} onChange={e => setValues({ ...values, address: e.target.value })} /><Field label={t('notesOptional')} id="customer-notes" value={values.notes} onChange={e => setValues({ ...values, notes: e.target.value })} />{error && <p className="retail-form-error" role="alert">{translatedError(error, t)}</p>}<div className="retail-form-actions"><Button type="button" variant="outline" onClick={onCancel}>{t('cancel')}</Button><Button type="submit">{customer ? t('saveChanges') : t('addCustomer')}</Button></div></form>
}

function SettlementForm({ customer, due, onSave, onCancel }) {
  const { t } = useLanguage()
  const [amount, setAmount] = useState(String(due.toFixed(2)))
  const [method, setMethod] = useState('Cash')
  const [error, setError] = useState('')
  const submit = event => { event.preventDefault(); const value = Number(amount); if (!Number.isFinite(value) || value <= 0 || value > due) return setError(`Enter a positive amount no greater than ${INR(due)}.`); const result = onSave({ customerId: customer.id, amount: value, method }); if (!result.ok) setError(result.error || 'Could not record settlement.'); else onCancel() }
  return <form className="retail-form" onSubmit={submit}><p className="retail-modal-copy">{t('outstandingBalanceFor')} {customer.name}: <strong>{INR(due)}</strong></p><Field label={t('paymentAmount')} id="settlement-amount" type="number" min="0.01" max={due} step="0.01" autoFocus value={amount} onChange={e => setAmount(e.target.value)} required /><div className="retail-field"><Label htmlFor="settlement-method">{t('paymentMethod')}</Label><Select id="settlement-method" value={method} onChange={e => setMethod(e.target.value)}><option value="Cash">{t('cash')}</option><option value="UPI">{t('upi')}</option><option value="Card">{t('card')}</option></Select></div>{error && <p className="retail-form-error" role="alert">{translatedError(error, t)}</p>}<div className="retail-form-actions"><Button type="button" variant="outline" onClick={onCancel}>{t('cancel')}</Button><Button type="submit">{t('recordPaymentButton')}</Button></div></form>
}

export function CustomersPage() {
  const { t, formatNumber } = useLanguage()
  const { data, addCustomer, updateCustomer, deleteCustomer, settleCustomer } = useRetailData()
  const { search = '' } = useOutletContext() || {}
  const [query, setQuery] = useState(search)
  const [modal, setModal] = useState(null)
  const [expanded, setExpanded] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState(null)
  useEffect(() => { setQuery(search) }, [search])
  const rows = data.customers.filter(c => `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase())).map(customer => { const sales = data.sales.filter(sale => sale.customerId === customer.id); const settlements = data.settlements.filter(payment => payment.customerId === customer.id); const summary = aggregateSales(sales); return { ...customer, sales, settlements, ...summary, lastVisit: sales[0]?.createdAt || null } })
  const onSave = customer => modal?.customer ? updateCustomer(modal.customer.id, customer) : addCustomer(customer)
  const remove = () => { const result = deleteCustomer(confirm.id); setNotice(result.error || (result.ok ? 'Customer deleted.' : 'Unable to delete customer.')); setConfirm(null) }
  return <><PageHeading title={t('customers')} description={t('customerDetailsDescription')} action={<Button onClick={() => setModal({})}><Plus size={15} />{t('addCustomer')}</Button>} /><Notice message={notice} onClose={() => setNotice('')} /><Card className="retail-panel"><div className="retail-toolbar"><SearchInput value={query} onChange={setQuery} placeholder={t('searchCustomerPhone')} /><span className="retail-result-count">{formatNumber(rows.length)} {t('customers')}</span></div>{rows.length ? <div className="retail-table-wrap"><Table><TableHeader><TableRow><TableHead>{t('customer')}</TableHead><TableHead>{t('phone')}</TableHead><TableHead>{t('purchases')}</TableHead><TableHead>{t('outstanding')}</TableHead><TableHead>{t('transactions')}</TableHead><TableHead>{t('lastVisit')}</TableHead><TableHead className="numeric">{t('actions')}</TableHead></TableRow></TableHeader><TableBody>{rows.map(customer=><CustomerRows key={customer.id} customer={customer} expanded={expanded === customer.id} onExpand={() => setExpanded(expanded === customer.id ? '' : customer.id)} onEdit={() => setModal({ customer })} onDelete={() => setConfirm(customer)} onSettle={() => setModal({ settle: customer })} />)}</TableBody></Table></div>:<EmptyState icon={Users} title={t(data.customers.length ? 'noMatchingCustomers' : 'noCustomersYet')} description={t(data.customers.length ? 'tryNamePhone' : 'customerRecordsHelp')} action={!data.customers.length && <Button onClick={() => setModal({})}><Plus size={14} />{t('addFirstCustomer')}</Button>} />}</Card>
    <Modal open={Boolean(modal?.customer || modal && !modal.settle)} onClose={() => setModal(null)} title={modal?.customer ? t('editCustomerTitle') : t('addCustomerTitle')}><CustomerForm key={modal?.customer?.id || 'new-customer'} customer={modal?.customer} onSave={onSave} onCancel={() => setModal(null)} /></Modal><Modal open={Boolean(modal?.settle)} onClose={() => setModal(null)} title={t('recordPayment')}><SettlementForm customer={modal?.settle} due={modal?.settle?.outstanding || 0} onSave={settleCustomer} onCancel={() => setModal(null)} /></Modal><Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title={t('deleteCustomerQuestion')}><p className="retail-modal-copy">{confirm?.name} {t('customerDeleteWarning')}</p><div className="retail-form-actions"><Button variant="outline" onClick={() => setConfirm(null)}>{t('cancel')}</Button><Button className="danger-button" onClick={remove}>{t('deleteCustomer')}</Button></div></Modal>
  </>
}
function CustomerRows({ customer, expanded, onExpand, onEdit, onDelete, onSettle }) { const { t, formatDate, formatNumber } = useLanguage(); return <><TableRow><TableCell><button className="retail-expand-button" onClick={onExpand} aria-expanded={expanded}><ChevronDown size={13} className={expanded ? 'rotated' : ''} /><strong>{customer.name}</strong></button></TableCell><TableCell>{customer.phone ? <a href={`tel:${customer.phone.replace(/[^+\d]/g,'')}`}>{customer.phone}</a> : '—'}</TableCell><TableCell>{INR(customer.revenue)}</TableCell><TableCell><strong className={customer.outstanding ? 'due-text' : ''}>{INR(customer.outstanding)}</strong></TableCell><TableCell>{formatNumber(customer.sales.length)}</TableCell><TableCell>{customer.lastVisit ? formatDate(customer.lastVisit) : '—'}</TableCell><TableCell className="numeric"><div className="table-actions">{customer.outstanding > 0 ? <button title={t('recordDuePayment')} aria-label={`${t('recordPayment')} ${customer.name}`} onClick={onSettle}><CreditCard size={14} /></button> : <span className="cleared-indicator" title={t('noOutstanding')}><Check size={14} /></span>}<button title={t('editCustomer')} aria-label={`${t('editCustomer')} ${customer.name}`} onClick={onEdit}><Edit2 size={14} /></button><button title={t('deleteCustomer')} aria-label={`${t('deleteCustomer')} ${customer.name}`} onClick={onDelete}><Trash2 size={14} /></button></div></TableCell></TableRow>{expanded && <TableRow className="customer-history-row"><TableCell colSpan={7}><div className="customer-history"><strong>{t('transactionHistory')}</strong>{customer.sales.length ? customer.sales.map(sale=><div key={sale.id}><span>{sale.invoiceId} · {formatDate(sale.createdAt)}</span><span>{INR(sale.total)} · {saleBalance(sale) ? `${t('due')} ${INR(saleBalance(sale))}` : t('cleared')}</span></div>) : <small>{t('noTransactionsRecorded')}</small>}{customer.settlements.map(payment=><div key={payment.id}><span>{t('payment')} · {formatDate(payment.createdAt)} · {t(String(payment.method).toLowerCase())}</span><span>{INR(payment.amount)} {t('received')}</span></div>)}{customer.address && <small>{t('address')}: {customer.address}</small>}{customer.notes && <small>{t('notes')}: {customer.notes}</small>}</div></TableCell></TableRow>}</> }

export function TransactionsPage() {
  const { data } = useRetailData()
  const { t, formatNumber, formatDate } = useLanguage()
  const { search = '' } = useOutletContext() || {}
  const [query, setQuery] = useState(search)
  const [status, setStatus] = useState('All')
  const [period, setPeriod] = useState('All time')
  const [page, setPage] = useState(0)
  const [invoice, setInvoice] = useState(null)
  useEffect(() => { setQuery(search); setPage(0) }, [search])
  const allSummary = aggregateSales(data.sales)
  const statusCounts = { All: data.sales.length, Paid: 0, Due: 0, Partial: 0 }
  data.sales.forEach(sale => { statusCounts[saleStatus(sale)] += 1 })
  const filtered = data.sales.filter(sale => { const matchesQuery = `${sale.invoiceId} ${sale.customerName || ''}`.toLowerCase().includes(query.toLowerCase()); const matchesStatus = status === 'All' || saleStatus(sale) === status; const d = new Date(sale.createdAt); const matchesDate = period === 'All time' || (period === 'This month' ? d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear() : localDay(d) === today()); return matchesQuery && matchesStatus && matchesDate }).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20)); const visible = filtered.slice(page * 20, (page + 1) * 20)
  const statusCopy = { All: 'all', Paid: 'paid', Partial: 'partial', Due: 'due' }
  const periodCopy = { 'All time': 'allTime', 'This month': 'thisMonth', Today: 'today' }
  return <><PageHeading title={t('transactions')} description={t('transactionsDescription')} /><div className="retail-stat-line"><span><strong>{formatNumber(data.sales.length)}</strong> {t('transactions')}</span><span><strong>{INR(allSummary.revenue)}</strong> {t('revenue')}</span><span><strong>{INR(allSummary.collected)}</strong> {t('collected')}</span><span><strong>{INR(allSummary.outstanding)}</strong> {t('outstanding')}</span></div><Card className="retail-panel"><div className="retail-toolbar transaction-filters"><SearchInput value={query} onChange={value => { setQuery(value); setPage(0) }} placeholder={t('searchInvoiceCustomer')} /><div className="transaction-status-tabs"><Tabs value={status} onValueChange={value => { setStatus(value); setPage(0) }} className="retail-segment small"><TabsList aria-label={t('filterPaymentStatus')}>{['All','Paid','Partial','Due'].map(value => <TabsTrigger key={value} value={value} currentValue={status} onValueChange={next => { setStatus(next); setPage(0) }}>{t(statusCopy[value])} <span className="transaction-tab-count">{formatNumber(statusCounts[value])}</span></TabsTrigger>)}</TabsList></Tabs></div><Select value={period} onChange={e => { setPeriod(e.target.value); setPage(0) }} aria-label={t('filterByDate')}>{Object.entries(periodCopy).map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</Select></div>{visible.length ? <div className="retail-table-wrap"><Table><TableHeader><TableRow><TableHead>{t('invoiceLabel')}</TableHead><TableHead>{t('customer')}</TableHead><TableHead>{t('date')}</TableHead><TableHead>{t('payment')}</TableHead><TableHead>{t('total')}</TableHead><TableHead>{t('paid')}</TableHead><TableHead>{t('status')}</TableHead><TableHead className="numeric">{t('invoiceLabel')}</TableHead></TableRow></TableHeader><TableBody>{visible.map(sale=><TableRow key={sale.id}><TableCell><strong>{sale.invoiceId}</strong></TableCell><TableCell>{sale.customerName || t('walkInCustomer')}</TableCell><TableCell>{formatDate(sale.createdAt)}</TableCell><TableCell>{t(String(sale.paymentMethod).toLowerCase())}</TableCell><TableCell>{INR(sale.total)}</TableCell><TableCell>{INR(sale.paid)}</TableCell><TableCell><Status tone={saleStatus(sale).toLowerCase()}>{t(saleStatus(sale).toLowerCase())}</Status></TableCell><TableCell className="numeric"><button className="retail-icon-button" onClick={() => setInvoice(sale)} aria-label={`${t('previewInvoice')} ${sale.invoiceId}`}><Eye size={15} /></button></TableCell></TableRow>)}</TableBody></Table></div>:<EmptyState icon={ReceiptText} title={t('noTransactions')} description={t('transactionsEmptyHelp')} />}{filtered.length > 0 && <div className="retail-pagination"><span>{formatNumber(page * 20 + 1)}–{formatNumber(Math.min((page + 1) * 20, filtered.length))} {t('of')} {formatNumber(filtered.length)}</span><div><button aria-label={t('previousPage')} disabled={page === 0} onClick={() => setPage(value => Math.max(0,value-1))}><ChevronLeft size={16} /></button><span>{t('pageOf', { page: formatNumber(page + 1), pages: formatNumber(pageCount) })}</span><button aria-label={t('nextPage')} disabled={page >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1,value+1))}><ChevronRight size={16} /></button></div></div>}</Card><Invoice sale={invoice} onClose={() => setInvoice(null)} /></>
}

const colors = ['var(--retail-chart-revenue)','var(--retail-chart-profit)','var(--retail-chart-3)','var(--retail-chart-4)','var(--retail-chart-5)','var(--retail-chart-6)','var(--retail-chart-7)']
export function AnalyticsPage() {
  const { data } = useRetailData()
  const { t, locale, formatCurrency } = useLanguage()
  const { search = '' } = useOutletContext() || {}
  const [range, setRange] = useState('daily')
  const [categoryMode, setCategoryMode] = useState('Revenue')
  const [sort, setSort] = useState({ key:'revenue', dir:'desc' })
  const analytics = useMemo(() => buildAnalytics(data, range), [data, range])
  const productRows = [...analytics.products].filter(product => product.name.toLowerCase().includes(search.toLowerCase())).sort((a,b) => { const val = typeof a[sort.key] === 'number' ? a[sort.key] - b[sort.key] : String(a[sort.key]).localeCompare(String(b[sort.key])); return val * (sort.dir === 'asc' ? 1 : -1) }).slice(0,10)
  const chartCategories = analytics.categories.map((item,index) => ({ ...item, value: categoryMode === 'Revenue' ? item.value : data.sales.flatMap(s=>s.items).filter(row => (data.products.find(p=>p.id===row.productId)?.category || 'Uncategorized') === item.name).reduce((sum,row)=>sum+Number(row.quantity),0), fill: colors[index % colors.length] }))
  const rangeLabel = { daily: 'daily', weekly: 'weekly', monthly: 'monthly' }
  return <><PageHeading title={t('analytics')} description={t('analyticsDescription')} /><div className="analytics-range-row"><Tabs value={range} onValueChange={setRange} className="retail-segment"><TabsList aria-label={t('trendRange')}>{['daily','weekly','monthly'].map(item=><TabsTrigger key={item} value={item} currentValue={range} onValueChange={setRange}>{t(rangeLabel[item])}</TabsTrigger>)}</TabsList></Tabs><span>{t('fromSavedSales')}</span></div>
    <div className="analytics-grid"><Card className="retail-panel analytics-wide"><div className="retail-panel-head"><div><span className="retail-eyebrow">{t('salesPerformance')}</span><h2>{t('revenueProfit')}</h2></div></div>{data.sales.length ? <div className="retail-chart large-chart"><SalesTrendChart data={analytics.trend.map(row=>({...row,label:new Intl.DateTimeFormat(locale,range==='monthly'?{month:'short',year:'2-digit'}:{month:'short',day:'numeric'}).format(new Date(`${row.key}${range==='monthly'?'-01':''}T00:00:00`))}))} locale={locale} formatCurrency={formatCurrency} labels={{ revenue:t('revenue'), profit:t('netProfitLegend') }} /></div>:<EmptyState icon={TrendingUp} title={t('notEnoughSales')} description={t('completeBillsTrend')} />}</Card>
      <Card className="retail-panel"><div className="retail-panel-head"><div><span className="retail-eyebrow">{t('categoryMix')}</span><h2>{t('categoryShare')}</h2></div><Tabs value={categoryMode} onValueChange={setCategoryMode} className="retail-segment small"><TabsList aria-label={t('categoryChartMetric')}>{['Revenue','Quantity'].map(mode=><TabsTrigger className={categoryMode===mode?'selected':''} value={mode} currentValue={categoryMode} key={mode} onValueChange={setCategoryMode}>{t(mode==='Revenue'?'revenue':'quantity')}</TabsTrigger>)}</TabsList></Tabs></div>{chartCategories.length ? <div className="retail-chart donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartCategories} dataKey="value" nameKey="name" innerRadius="57%" outerRadius="78%">{chartCategories.map(item=><Cell key={item.name} fill={item.fill}/>)}</Pie><Tooltip formatter={value=>categoryMode==='Revenue'?formatCurrency(value):new Intl.NumberFormat(locale).format(value)}/><Legend/></PieChart></ResponsiveContainer></div>:<EmptyState icon={Boxes} title={t('noCategoryData')} description={t('productSalesBuildChart')} />}</Card>
      <Card className="retail-panel analytics-wide"><div className="retail-panel-head"><div><span className="retail-eyebrow">{t('costProfit')}</span><h2>{t('profitVersusCost')}</h2></div></div>{data.sales.length ? <div className="retail-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.trend}><CartesianGrid stroke="var(--line-subtle)" vertical={false}/><XAxis dataKey="label" tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'var(--muted-foreground)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={value=>`₹${new Intl.NumberFormat(locale).format(value)}`}/><Tooltip formatter={value=>formatCurrency(value)} contentStyle={{background:'var(--popover)',borderColor:'var(--border)',color:'var(--foreground)'}}/><Legend/><Bar dataKey="cost" name={t('estimatedCost')} stackId="a" fill="var(--retail-chart-cost)"/><Bar dataKey="profit" name={t('profit')} stackId="a" fill="var(--retail-chart-revenue)"/></BarChart></ResponsiveContainer></div>:<EmptyState icon={TrendingUp} title={t('noCostProfitData')} description={t('completeBillsCost')} />}</Card>
      <Card className="retail-panel analytics-products"><div className="retail-panel-head"><div><span className="retail-eyebrow">{t('topProducts')}</span><h2>{t('productPerformance')}</h2></div><small>{t('upTo10Products')}</small></div>{productRows.length ? <div className="retail-table-wrap"><Table><TableHeader><TableRow>{[['name','product'],['units','unitsSold'],['revenue','revenue'],['profit','profit'],['margin','margin']].map(([key,label])=><TableHead key={key}><button className="retail-sort" onClick={()=>setSort(current=>({key,dir:current.key===key&&current.dir==='desc'?'asc':'desc'}))}>{t(label)}<ArrowUpDown size={12}/></button></TableHead>)}</TableRow></TableHeader><TableBody>{productRows.map(row=><TableRow key={row.id}><TableCell>{row.name}</TableCell><TableCell>{new Intl.NumberFormat(locale).format(row.units)}</TableCell><TableCell>{formatCurrency(row.revenue)}</TableCell><TableCell>{formatCurrency(row.profit)}</TableCell><TableCell>{new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(row.margin)}%</TableCell></TableRow>)}</TableBody></Table></div>:<EmptyState icon={Boxes} title={t('noPerformanceYet')} description={t('productSalesAppear')} />}</Card></div></>
}

export function SettingsPage() {
  const { resetData, data } = useRetailData()
  const { search = '' } = useOutletContext() || {}
  const { language, setLanguage, t, languages, formatNumber, locale } = useLanguage()
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const reset = () => { const result = resetData(); setNotice(result.ok ? t('dataDeletedNotice') : t('couldNotRemoveData')); setConfirm(false) }
  const query = search.toLocaleLowerCase(locale)
  const searchable = keys => keys.map(key => t(key)).join(' ').toLocaleLowerCase(locale)
  const showAppearance = !query || searchable(['appearance','theme','light','dark','chooseTheme']).includes(query)
  const showLanguage = !query || [t('language'), t('interfaceLanguage'), t('languageHelp'), ...languages.map(({ label }) => label)].join(' ').toLocaleLowerCase(locale).includes(query)
  const showData = !query || searchable(['dataManagement','deleteOnDeviceData','deleteAllShopData','deleteDataExplainer']).includes(query)
  return <><PageHeading title={t('settings')} description={t('settingsDescription')} /><Notice message={notice} onClose={() => setNotice('')} /><div className="settings-grid">{showAppearance && <Card className="retail-panel settings-card"><span className="retail-eyebrow">{t('appearance')}</span><h2>{t('theme')}</h2><p>{t('chooseTheme')}</p><div className="settings-inline"><span>{t('currentTheme')} <strong>{t(theme)}</strong></span><Button variant="outline" onClick={event => toggleTheme(event.currentTarget)}>{theme === 'dark' ? t('switchToLight') : t('switchToDark')}</Button></div></Card>}{showLanguage && <Card className="retail-panel settings-card"><span className="retail-eyebrow">{t('language')}</span><h2>{t('interfaceLanguage')}</h2><p>{t('languageHelp')}</p><div className="retail-field"><Label htmlFor="settings-language">{t('language')}</Label><Select id="settings-language" value={language} onChange={event => setLanguage(event.target.value)}>{languages.map(item=><option value={item.code} key={item.code} lang={item.code} dir={item.direction}>{item.label}</option>)}</Select></div></Card>}{showData && <Card className="retail-panel settings-card danger-zone"><span className="retail-eyebrow">{t('dataManagement')}</span><h2>{t('deleteOnDeviceData')}</h2><p>{t('deleteDataExplainer')}</p><div className="settings-inline"><span>{formatNumber(data.products.length)} {t('products')} · {formatNumber(data.customers.length)} {t('customers')} · {formatNumber(data.sales.length)} {t('salesRecords')}</span><Button className="danger-button" onClick={() => setConfirm(true)}><Trash2 size={14} />{t('deleteAllShopData')}</Button></div></Card>}{!showAppearance && !showLanguage && !showData && <EmptyState title={t('noSettingsMatch')} description={t('tryThemeLanguageData')} />}</div><Modal open={confirm} onClose={() => setConfirm(false)} title={t('deleteAllShopDataQuestion')}><p className="retail-modal-copy">{t('deleteDataConfirm')}</p><div className="retail-form-actions"><Button variant="outline" onClick={() => setConfirm(false)}>{t('keepMyData')}</Button><Button className="danger-button" onClick={reset}>{t('deleteAllData')}</Button></div></Modal></>
}

export default function RetailPage({ page }) {
  const pages = { dashboard: RetailDashboard, inventory: InventoryPage, sales: SalesPage, customers: CustomersPage, transactions: TransactionsPage, analytics: AnalyticsPage, settings: SettingsPage }
  const Page = pages[page] || RetailDashboard
  return <Page />
}
