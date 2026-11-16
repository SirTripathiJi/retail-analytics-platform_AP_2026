const USERS_KEY = 'arthsaathi:local-demo-users:v1'
const LOCAL_SESSION_KEY = 'arthsaathi:local-demo-session:v1'
const TAB_SESSION_KEY = 'arthsaathi:local-demo-tab-session:v1'
const EVENT_NAME = 'arthsaathi:local-auth-change'
const ITERATIONS = 120000

const bytesToHex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('')
const readUsers = () => {
  try { const parsed = JSON.parse(window.localStorage.getItem(USERS_KEY) || '[]'); return Array.isArray(parsed) ? parsed : [] }
  catch { return [] }
}
const publicUser = account => ({ id: account.id, email: account.email, user_metadata: { full_name: account.fullName, store_name: account.storeName } })
const sessionFrom = account => ({ user: publicUser(account), localDemo: true })
const notify = session => window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: session }))

async function passwordHash(password, saltHex) {
  if (!globalThis.crypto?.subtle) throw new Error('This browser does not support secure local password hashing. Use HTTPS or localhost.')
  const salt = saltHex ? Uint8Array.from(saltHex.match(/.{2}/g), byte => parseInt(byte, 16)) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256)
  return { hash: bytesToHex(bits), salt: bytesToHex(salt) }
}

function saveSession(session, rememberMe = false) {
  window.localStorage.removeItem(LOCAL_SESSION_KEY)
  window.sessionStorage.removeItem(TAB_SESSION_KEY)
  const target = rememberMe ? window.localStorage : window.sessionStorage
  target.setItem(rememberMe ? LOCAL_SESSION_KEY : TAB_SESSION_KEY, JSON.stringify(session))
  notify(session)
}

export async function localSignUp({ fullName, storeName, email, password }) {
  const normalizedEmail = email.trim().toLowerCase()
  const users = readUsers()
  if (users.some(user => user.email === normalizedEmail)) throw new Error('An account already exists for this email. Log in instead.')
  const credentials = await passwordHash(password)
  const account = { id: `local-${crypto.randomUUID()}`, email: normalizedEmail, fullName: fullName.trim(), storeName: storeName.trim(), ...credentials, createdAt: new Date().toISOString() }
  window.localStorage.setItem(USERS_KEY, JSON.stringify([...users, account]))
  const session = sessionFrom(account)
  saveSession(session, true)
  return { user: session.user, session }
}

export async function localSignIn({ email, password, rememberMe = false }) {
  const account = readUsers().find(user => user.email === email.trim().toLowerCase())
  if (!account) throw new Error('The email or password is incorrect.')
  const candidate = await passwordHash(password, account.salt)
  if (candidate.hash !== account.hash) throw new Error('The email or password is incorrect.')
  const session = sessionFrom(account)
  saveSession(session, rememberMe)
  return { user: session.user, session }
}

export function getLocalSession() {
  try {
    const serialized = window.localStorage.getItem(LOCAL_SESSION_KEY) || window.sessionStorage.getItem(TAB_SESSION_KEY)
    const session = serialized ? JSON.parse(serialized) : null
    return session?.user?.id ? session : null
  } catch { return null }
}

export function subscribeToLocalAuth(callback) {
  const onAuth = event => callback(event.detail ?? null)
  const onStorage = event => { if ([LOCAL_SESSION_KEY, TAB_SESSION_KEY].includes(event.key)) callback(getLocalSession()) }
  window.addEventListener(EVENT_NAME, onAuth)
  window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(EVENT_NAME, onAuth); window.removeEventListener('storage', onStorage) }
}

export function localSignOut() {
  window.localStorage.removeItem(LOCAL_SESSION_KEY)
  window.sessionStorage.removeItem(TAB_SESSION_KEY)
  notify(null)
}
