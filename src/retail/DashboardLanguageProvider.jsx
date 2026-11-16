// Compatibility hook for existing dashboard components. All internal routes
// now share the same app-scoped localization provider.
export { useLanguage as useDashboardLanguage } from './LanguageProvider.jsx'
