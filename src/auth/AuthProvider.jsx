import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getAuthSession, isAuthConfigured, isDemoAuth, signOut as providerSignOut, subscribeToAuthChanges } from '../services/authService.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const unsubscribe = subscribeToAuthChanges(nextSession => {
      if (mounted) {
        setSession(nextSession)
        setError('')
      }
    })
    getAuthSession()
      .then(nextSession => { if (mounted) setSession(nextSession) })
      .catch(() => { if (mounted) { setSession(null); setError('We could not check your sign-in session.') } })
      .finally(() => { if (mounted) setLoading(false) })
    if (!isAuthConfigured()) setLoading(false)
    return () => { mounted = false; unsubscribe() }
  }, [])

  const logout = async () => {
    setError('')
    try { await providerSignOut(); setSession(null) }
    catch (failure) { setError(failure?.message || 'Could not sign out. Please try again.'); throw failure }
  }
  const refreshSession = async () => {
    const nextSession = await getAuthSession()
    setSession(nextSession)
    return nextSession
  }
  const value = useMemo(() => ({ session, user: session?.user || null, loading, configured: isAuthConfigured(), demoAuth: isDemoAuth(), error, logout, refreshSession }), [session, loading, error])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
