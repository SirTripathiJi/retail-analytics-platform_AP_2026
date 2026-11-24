const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim()
const API_BASE = (configuredApiBase || (import.meta.env.DEV ? 'http://localhost:3001/api' : '')).replace(/\/$/, '')
const TOKEN_KEY = 'arthsaathi-api-token'
const USER_KEY = 'arthsaathi-api-user'

export function getApiToken() { return window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY) }
export function saveApiSession(session, rememberMe = false) {
  clearApiSession()
  const storage = rememberMe ? window.localStorage : window.sessionStorage
  storage.setItem(TOKEN_KEY, session.token); storage.setItem(USER_KEY, JSON.stringify(session.user))
  window.dispatchEvent(new Event('arthsaathi-auth-change'))
}
export function clearApiSession() {
  window.localStorage.removeItem(TOKEN_KEY); window.localStorage.removeItem(USER_KEY)
  window.sessionStorage.removeItem(TOKEN_KEY); window.sessionStorage.removeItem(USER_KEY)
  window.dispatchEvent(new Event('arthsaathi-auth-change'))
}
export function readApiSession() {
  const storage = window.localStorage.getItem(TOKEN_KEY) ? window.localStorage : window.sessionStorage
  const token = storage.getItem(TOKEN_KEY)
  if (!token) return null
  try { return { token, user: JSON.parse(storage.getItem(USER_KEY) || 'null') } }
  catch { clearApiSession(); return null }
}
export async function apiRequest(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  if (!API_BASE) throw new Error('The hosted app has no backend URL. Set VITE_API_BASE_URL in the frontend host and redeploy it.')
  if (!API_BASE.endsWith('/api')) throw new Error('VITE_API_BASE_URL must be the backend address ending in /api.')
  const requestHeaders = { Accept: 'application/json', ...headers }
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'
  if (auth) { const token = getApiToken(); if (token) requestHeaders.Authorization = `Bearer ${token}` }
  let response
  try { response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, { method, headers: requestHeaders, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }) }
  catch { throw new Error(`Cannot reach the backend at ${API_BASE}. Start the backend and check VITE_API_BASE_URL.`) }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) { if (response.status === 401) clearApiSession(); throw new Error(result.error || result.message || `Request failed (${response.status}).`) }
  return result
}
export async function apiList(path) {
  const separator = path.includes('?') ? '&' : '?'
  const first = await apiRequest(`${path}${separator}page=1&limit=100`)
  const items = [...(first.items || [])]
  for (let page = 2; page <= (first.totalPages || 1); page += 1) items.push(...((await apiRequest(`${path}${separator}page=${page}&limit=100`)).items || []))
  return items
}
