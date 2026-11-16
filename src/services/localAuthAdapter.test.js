import test from 'node:test'
import assert from 'node:assert/strict'
import { getLocalSession, localSignIn, localSignOut, localSignUp } from './localAuthAdapter.js'

class MemoryStorage {
  #items = new Map()
  getItem(key) { return this.#items.get(key) ?? null }
  setItem(key, value) { this.#items.set(key, String(value)) }
  removeItem(key) { this.#items.delete(key) }
}

test('local demo auth hashes credentials and persists sessions without plaintext passwords', async () => {
  const target = new EventTarget()
  globalThis.window = Object.assign(target, { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() })
  const created = await localSignUp({ fullName: 'Shop Owner', storeName: 'Corner Shop', email: 'owner@example.in', password: 'a-secure-demo-password' })
  const serialized = window.localStorage.getItem('arthsaathi:local-demo-users:v1')
  assert.equal(serialized.includes('a-secure-demo-password'), false)
  assert.ok(JSON.parse(serialized)[0].hash)
  assert.equal(created.session.user.user_metadata.store_name, 'Corner Shop')
  assert.equal(getLocalSession().user.email, 'owner@example.in')
  await assert.rejects(() => localSignUp({ fullName: 'Other', storeName: 'Shop', email: 'OWNER@example.in', password: 'a-secure-demo-password' }), /already exists/)
  await assert.rejects(() => localSignIn({ email: 'owner@example.in', password: 'wrong-password' }), /incorrect/)
  await localSignIn({ email: 'owner@example.in', password: 'a-secure-demo-password', rememberMe: false })
  assert.equal(window.localStorage.getItem('arthsaathi:local-demo-session:v1'), null)
  assert.ok(window.sessionStorage.getItem('arthsaathi:local-demo-tab-session:v1'))
  localSignOut()
  assert.equal(getLocalSession(), null)
  delete globalThis.window
})
