import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { APP_LANGUAGE_KEY, DASHBOARD_LANGUAGE_KEY, dashboardDirection, dashboardLanguages, dashboardLocale, dashboardTranslations, restoreDashboardLanguage, translateDashboard } from './dashboardTranslations.js'

const LanguageContext = createContext(null)

function readLanguage() {
  try {
    const stored = window.localStorage.getItem(APP_LANGUAGE_KEY) || restoreDashboardLanguage(window.localStorage)
    return dashboardLanguages.some(item => item.code === stored) ? stored : 'en'
  } catch { return 'en' }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readLanguage)
  const setLanguage = useCallback(code => {
    const next = dashboardLanguages.some(item => item.code === code) ? code : 'en'
    setLanguageState(next)
    try {
      window.localStorage.setItem(APP_LANGUAGE_KEY, next)
    } catch { /* The current selection remains active for this visit. */ }
  }, [])
  const locale = dashboardLocale(language)
  const value = useMemo(() => ({
    language,
    locale,
    direction: dashboardDirection(language),
    languages: dashboardLanguages,
    setLanguage,
    t: (key, values) => translateDashboard(language, key, values),
    formatNumber: value => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value) || 0),
    formatCurrency: value => new Intl.NumberFormat(locale, { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0),
    formatDate: (date, options = { dateStyle: 'medium' }) => new Intl.DateTimeFormat(locale, options).format(new Date(date)),
    formatDateTime: (date, options = { dateStyle: 'medium', timeStyle: 'short' }) => new Intl.DateTimeFormat(locale, options).format(new Date(date)),
  }), [language, locale, setLanguage])

  useEffect(() => {
    const previousLang = document.documentElement.lang
    document.documentElement.lang = language
    const fontLinkId = 'arthsaathi-script-fonts'
    document.getElementById(fontLinkId)?.remove()
    if (language === 'en') return () => { document.documentElement.lang = previousLang }
    const link = document.createElement('link')
    link.id = fontLinkId
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans+Gujarati:wght@400;500;600;700&family=Noto+Sans+Kannada:wght@400;500;600;700&family=Noto+Sans+Malayalam:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&family=Noto+Sans+Telugu:wght@400;500;600;700&display=swap'
    document.head.append(link)
    return () => { link.remove(); document.documentElement.lang = previousLang }
  }, [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used within LanguageProvider')
  return value
}

export { APP_LANGUAGE_KEY, DASHBOARD_LANGUAGE_KEY, dashboardLanguages, dashboardTranslations }
