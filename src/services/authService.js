import { createClient } from '@supabase/supabase-js'
import { getLocalSession, localSignIn, localSignOut, localSignUp, subscribeToLocalAuth } from './localAuthAdapter.js'

// Vite exposes only public client configuration. Never place a service-role key here.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim()
const supabaseConfigured = Boolean(supabaseUrl && supabaseKey)
const localClient = supabaseConfigured ? createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, storage: window.localStorage, storageKey: 'acme-auth-local' } }) : null
const sessionClient = supabaseConfigured ? createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, storage: window.sessionStorage, storageKey: 'acme-auth-session' } }) : null

export class AuthNotConfiguredError extends Error {
  constructor(message = 'Authentication is not configured. Add the Supabase URL and publishable key to the local environment before continuing.') {
    super(message)
    this.name = 'AuthNotConfiguredError'
  }
}

export const isAuthConfigured = () => true
export const isDemoAuth = () => !supabaseConfigured
const requireClient = (client = localClient) => {
  if (!client) throw new AuthNotConfiguredError()
  return client
}

export async function signUp({ fullName, storeName, email, password }) {
  if (!supabaseConfigured) return localSignUp({ fullName, storeName, email, password })
  const { data, error } = await requireClient(localClient).auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, store_name: storeName } },
  })
  if (error) throw error
  return data
}

export async function signIn({ email, password, rememberMe = false }) {
  if (!supabaseConfigured) return localSignIn({ email, password, rememberMe })
  const chosenClient = requireClient(rememberMe ? localClient : sessionClient)
  const otherClient = rememberMe ? sessionClient : localClient
  // Keep one active browser session so the remember-me choice has clear behavior.
  await otherClient.auth.signOut({ scope: 'local' })
  const { data, error } = await chosenClient.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function requestPasswordReset({ email }) {
  if (!supabaseConfigured) throw new AuthNotConfiguredError('Password reset email is unavailable in local demo mode. Configure Supabase Auth to enable email recovery.')
  const { data, error } = await requireClient(localClient).auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
  return data
}

export async function updatePassword({ password }) {
  if (!supabaseConfigured) throw new AuthNotConfiguredError('Password recovery is unavailable in local demo mode. Configure Supabase Auth to reset account passwords.')
  const { data, error } = await requireClient(localClient).auth.updateUser({ password })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabaseConfigured) { localSignOut(); return }
  const clients = [localClient, sessionClient].filter(Boolean)
  if (!clients.length) throw new AuthNotConfiguredError()
  const results = await Promise.all(clients.map(client => client.auth.signOut()))
  const failed = results.find(result => result.error)
  if (failed?.error) throw failed.error
}

export async function getAuthSession() {
  if (!supabaseConfigured) return getLocalSession()
  const results = await Promise.all([localClient.auth.getSession(), sessionClient.auth.getSession()])
  const failed = results.find(result => result.error)
  if (failed?.error) throw failed.error
  return results.map(result => result.data.session).find(Boolean) || null
}

export function subscribeToAuthChanges(callback) {
  if (!supabaseConfigured) return subscribeToLocalAuth(callback)
  const subscriptions = [localClient, sessionClient].map(client => client.auth.onAuthStateChange((_event, session) => callback(session)))
  return () => subscriptions.forEach(({ data }) => data.subscription.unsubscribe())
}
