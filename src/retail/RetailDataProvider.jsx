import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DATA_PREFIX, emptyRetailData } from './retailUtils.js'
import { adjustProductStock, applyCustomerPayment, applySale } from './retailOperations.js'
import { useAuth } from '../auth/AuthProvider.jsx'

const RetailDataContext = createContext(null)

function readData(key) {
  try {
    const value = window.localStorage.getItem(key)
    if (!value) return emptyRetailData()
    const parsed = JSON.parse(value)
    if (parsed?.version !== 1 || !Array.isArray(parsed.products) || !Array.isArray(parsed.sales) || !Array.isArray(parsed.customers)) return emptyRetailData()
    const order = ['sales', 'profit', 'products', 'transactions']
    const savedOrder = Array.isArray(parsed.dashboardOrder) ? parsed.dashboardOrder.filter(key => order.includes(key)) : []
    return { ...emptyRetailData(), ...parsed, settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [], dashboardOrder: [...new Set([...savedOrder, ...order])] }
  } catch { return emptyRetailData() }
}

export function RetailDataProvider({ children }) {
  const { user } = useAuth()
  const key = `${DATA_PREFIX}${user?.id || 'local'}`
  const [stored, setStored] = useState(() => ({ key, data: readData(key) }))
  const data = stored.key === key ? stored.data : readData(key)
  const [storageError, setStorageError] = useState('')

  useEffect(() => { setStored({ key, data: readData(key) }); setStorageError('') }, [key])
  useEffect(() => {
    const sync = event => { if (event.key === key) setStored({ key, data: readData(key) }) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key])

  const commit = useCallback(updater => {
    const next = typeof updater === 'function' ? updater(data) : updater
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
      setStored({ key, data: next })
      setStorageError('')
      return { ok: true, data: next }
    } catch {
      setStorageError('Your browser could not save this change. Check available storage and try again.')
      return { ok: false }
    }
  }, [data, key])

  const addProduct = product => {
    if (data.products.some(item => item.name.trim().toLowerCase() === product.name.trim().toLowerCase())) return { ok: false, error: 'A product with this name already exists.' }
    const id = crypto.randomUUID()
    return commit(current => ({ ...current, products: [{ ...product, id, createdAt: new Date().toISOString() }, ...current.products] }))
  }
  const updateProduct = (id, changes) => {
    if (data.products.some(item => item.id !== id && item.name.trim().toLowerCase() === changes.name.trim().toLowerCase())) return { ok: false, error: 'A product with this name already exists.' }
    return commit(current => ({ ...current, products: current.products.map(item => item.id === id ? { ...item, ...changes } : item) }))
  }
  const deleteProduct = id => {
    if (data.sales.some(sale => sale.items.some(item => item.productId === id))) return { ok: false, error: 'This product appears in completed sales and cannot be deleted.' }
    return commit(current => ({ ...current, products: current.products.filter(item => item.id !== id) }))
  }
  const adjustStock = (id, delta) => {
    const result = adjustProductStock(data, id, delta)
    return result.ok ? commit(result.data) : result
  }
  const addCustomer = customer => {
    if (customer.phone && data.customers.some(item => item.phone === customer.phone)) return { ok: false, error: 'A customer with this phone number already exists.' }
    return commit(current => ({ ...current, customers: [{ ...customer, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...current.customers] }))
  }
  const updateCustomer = (id, changes) => {
    if (changes.phone && data.customers.some(item => item.id !== id && item.phone === changes.phone)) return { ok: false, error: 'A customer with this phone number already exists.' }
    return commit(current => ({ ...current, customers: current.customers.map(item => item.id === id ? { ...item, ...changes } : item) }))
  }
  const deleteCustomer = id => {
    if (data.sales.some(sale => sale.customerId === id && Number(sale.total) > 0)) return { ok: false, error: 'This customer has sales history and cannot be deleted.' }
    return commit(current => ({ ...current, customers: current.customers.filter(item => item.id !== id) }))
  }
  const createSale = sale => {
    const result = applySale(data, sale)
    if (!result.ok) return result
    return commit(result.data)
  }
  const settleCustomer = ({ customerId, amount, method }) => {
    const result = applyCustomerPayment(data, { customerId, amount, method })
    return result.ok ? commit(result.data) : result
  }
  const reorderDashboard = order => commit(current => ({ ...current, dashboardOrder: order }))
  const resetData = () => {
    try { window.localStorage.removeItem(key); setStored({ key, data: emptyRetailData() }); setStorageError(''); return { ok: true } }
    catch { setStorageError('Your browser could not remove this data.'); return { ok: false } }
  }

  const value = useMemo(() => ({ data, storageError, addProduct, updateProduct, deleteProduct, adjustStock, addCustomer, updateCustomer, deleteCustomer, createSale, settleCustomer, reorderDashboard, resetData }), [data, storageError, commit])
  return <RetailDataContext.Provider value={value}>{children}</RetailDataContext.Provider>
}

export function useRetailData() {
  const context = useContext(RetailDataContext)
  if (!context) throw new Error('useRetailData must be used inside RetailDataProvider')
  return context
}
