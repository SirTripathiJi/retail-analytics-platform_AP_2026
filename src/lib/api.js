const TOKEN_KEYS = ['arth-saathi:session:local:v1', 'arth-saathi:session:tab:v1']

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', body = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

export function getStoredSession() {
  if (typeof window === 'undefined') return null
  for (const [index, storage] of [window.localStorage, window.sessionStorage].entries()) {
    try {
      const raw = storage.getItem(TOKEN_KEYS[index])
      if (raw) return JSON.parse(raw)
    } catch { storage.removeItem(TOKEN_KEYS[index]) }
  }
  return null
}

export function saveSession(session, rememberMe = false) {
  window.localStorage.removeItem(TOKEN_KEYS[0])
  window.sessionStorage.removeItem(TOKEN_KEYS[1])
  const storage = rememberMe ? window.localStorage : window.sessionStorage
  storage.setItem(TOKEN_KEYS[rememberMe ? 0 : 1], JSON.stringify(session))
  window.dispatchEvent(new CustomEvent('arth-saathi:auth-change', { detail: session }))
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEYS[0])
  window.sessionStorage.removeItem(TOKEN_KEYS[1])
  window.dispatchEvent(new CustomEvent('arth-saathi:auth-change', { detail: null }))
}

export async function apiRequest(path, { method = 'GET', body, headers = {}, idempotencyKey, signal } = {}) {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
  if (!baseUrl) throw new ApiError('The API server URL is not configured. Set VITE_API_BASE_URL and restart the frontend.', { code: 'API_NOT_CONFIGURED' })

  const session = getStoredSession()
  const requestHeaders = new Headers(headers)
  requestHeaders.set('Accept', 'application/json')
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json')
  if (session?.token) requestHeaders.set('Authorization', `Bearer ${session.token}`)
  if (idempotencyKey) requestHeaders.set('Idempotency-Key', idempotencyKey)

  let response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    throw new ApiError('Could not reach the API server. Check your connection and try again.', { code: 'NETWORK_ERROR', body: cause })
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null
  if (!response.ok) {
    if (response.status === 401 && session?.token) clearSession()
    const defaults = {
      401: 'Your session has expired. Log in again.',
      403: 'You do not have access to this business.',
      404: 'The requested record could not be found.',
      409: 'This change conflicts with current data. Refresh and try again.',
      422: 'Some of the submitted information is invalid.',
      429: 'Too many requests. Wait a moment and try again.',
      500: 'The server could not complete this request.',
      503: 'This service is temporarily unavailable.',
    }
    throw new ApiError(payload?.error || defaults[response.status] || `Request failed (${response.status}).`, {
      status: response.status,
      code: payload?.code || `HTTP_${response.status}`,
      body: payload,
    })
  }
  return payload
}
