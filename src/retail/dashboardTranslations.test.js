import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { APP_LANGUAGE_KEY, DASHBOARD_LANGUAGE_KEY, dashboardDirection, dashboardLanguages, dashboardLocale, dashboardTranslations, missingDashboardTranslations, persistDashboardLanguage, restoreDashboardLanguage, translateDashboard } from './dashboardTranslations.js'
import { pageTranslations } from './pageTranslations.js'

test('Dashboard has complete non-empty translations for all ten supported languages', () => {
  const keys = Object.keys(dashboardTranslations.en)
  assert.equal(dashboardLanguages.length, 10)
  for (const { code } of dashboardLanguages) {
    const translation = dashboardTranslations[code]
    assert.ok(translation, `Missing language ${code}`)
    assert.deepEqual(Object.keys(translation).sort(), [...keys].sort(), `Translation keys differ for ${code}`)
    for (const key of keys) assert.ok(translation[key].trim(), `Empty translation for ${code}.${key}`)
  }
})

test('Internal app catalog has complete non-empty translations for all ten languages', () => {
  assert.deepEqual(missingDashboardTranslations(), [])
  for (const [key, translations] of Object.entries(pageTranslations)) {
    assert.deepEqual(Object.keys(translations).sort(), dashboardLanguages.map(({ code }) => code).sort(), `Locale coverage differs for ${key}`)
    for (const { code } of dashboardLanguages) assert.ok(translations[code]?.trim(), `Empty page translation ${code}.${key}`)
  }
})

test('Every static key referenced by internal React surfaces resolves in every supported locale', () => {
  const files = ['src/retail/RetailPages.jsx', 'src/retail/ContrastCheckerPage.jsx', 'src/components/layout/RetailShell.jsx']
  const keys = new Set()
  for (const file of files) {
    const source = fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
    for (const match of source.matchAll(/(?:\bt|shellT)\('([^']+)'/g)) keys.add(match[1])
  }
  for (const { code } of dashboardLanguages) {
    for (const key of keys) assert.ok(!translateDashboard(code, key).startsWith('⟦'), `Missing ${code}.${key}`)
  }
})

test('Dashboard translations interpolate dynamic values and use an isolated preference key', () => {
  assert.equal(translateDashboard('hi', 'invoice', { id: 'AS-100' }), 'बिल AS-100')
  assert.equal(translateDashboard('ml', 'expiresInDays', { days: '೩' }), '೩ ദിവസത്തിനകം കാലാവധി കഴിയും')
  assert.equal(DASHBOARD_LANGUAGE_KEY, 'arthsaathi-dashboard-language:v1')
})

test('Dashboard language restores across reloads without changing the other app language preference', () => {
  const values = new Map([['arthsaathi-language:v1', 'bn']])
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.equal(persistDashboardLanguage('ml', storage), 'ml')
  assert.equal(restoreDashboardLanguage(storage), 'ml')
  assert.equal(values.get('arthsaathi-language:v1'), 'bn')
  assert.equal(persistDashboardLanguage('invalid', storage), 'en')
  assert.equal(restoreDashboardLanguage(storage), 'en')
  assert.equal(APP_LANGUAGE_KEY, 'arthsaathi-language:v1')
})

test('Dashboard locale metadata covers each language and Urdu uses RTL direction', () => {
  for (const { code } of dashboardLanguages) assert.ok(dashboardLocale(code).endsWith('-IN'))
  assert.equal(dashboardDirection('ur'), 'rtl')
  assert.equal(dashboardDirection('ml'), 'ltr')
})
