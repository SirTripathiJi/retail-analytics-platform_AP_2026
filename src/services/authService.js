import { apiRequest, clearApiSession, readApiSession, saveApiSession } from './apiClient.js'

export class AuthNotConfiguredError extends Error { constructor(message = 'The backend is not reachable. Start the API server and configure VITE_API_BASE_URL.') { super(message); this.name = 'AuthNotConfiguredError' } }
export const isAuthConfigured = () => true
export const isDemoAuth = () => false

export async function signUp({ fullName, storeName, email, password }) {
  await apiRequest('/auth/register', { method: 'POST', auth: false, body: { fullName, businessName: storeName, email, password } })
  let result
  try { result = await apiRequest('/auth/login', { method: 'POST', auth: false, body: { email, password } }) }
  catch (error) { throw new Error(`Your account was created, but automatic sign-in failed: ${error.message}. Please go to Log in.`) }
  saveApiSession(result, true)
  return { session: result }
}
export async function signIn({ email, password, rememberMe = false }) {
  const result = await apiRequest('/auth/login', { method: 'POST', auth: false, body: { email, password } })
  saveApiSession(result, rememberMe)
  return result
}
export async function requestPasswordReset() { throw new AuthNotConfiguredError('Password reset is not implemented by the backend yet. Contact the business administrator to reset an account.') }
export async function updatePassword() { throw new AuthNotConfiguredError('Password changes are not implemented by the backend yet. Contact the business administrator to update an account.') }
export async function signOut() { clearApiSession() }
export async function getAuthSession() { return readApiSession() }
export function subscribeToAuthChanges(callback) {
  const handler = () => callback(readApiSession())
  window.addEventListener('arthsaathi-auth-change', handler)
  window.addEventListener('storage', handler)
  return () => { window.removeEventListener('arthsaathi-auth-change', handler); window.removeEventListener('storage', handler) }
}
