import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'acme-theme'

function initialTheme() {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)
  const [transitioning, setTransitioning] = useState(false)
  const transitionLock = useRef(false)
  const fallbackTimer = useRef(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#050505' : '#ffffff')
    try { window.localStorage.setItem(STORAGE_KEY, theme) } catch { /* storage can be disabled */ }
  }, [theme])

  useEffect(() => {
    const syncFromStorage = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      setTheme(event.newValue === 'dark' ? 'dark' : 'light')
    }
    window.addEventListener('storage', syncFromStorage)
    return () => window.removeEventListener('storage', syncFromStorage)
  }, [])

  useEffect(() => () => window.clearTimeout(fallbackTimer.current), [])

  const toggleTheme = useCallback(async (button) => {
    if (transitionLock.current) return
    transitionLock.current = true
    setTransitioning(true)
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const applyTheme = () => flushSync(() => setTheme(nextTheme))

    try {
      if (!reduceMotion && typeof document.startViewTransition === 'function') {
        const rect = button?.getBoundingClientRect()
        const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
        const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
        const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
        root.style.setProperty('--theme-reveal-x', `${x}px`)
        root.style.setProperty('--theme-reveal-y', `${y}px`)
        root.style.setProperty('--theme-reveal-radius', `${radius}px`)
        const transition = document.startViewTransition(applyTheme)
        await transition.finished
      } else if (!reduceMotion) {
        root.dataset.themeTransition = 'fallback'
        applyTheme()
        await new Promise(resolve => {
          fallbackTimer.current = window.setTimeout(resolve, 300)
        })
      } else {
        applyTheme()
      }
    } catch {
      // A failed or interrupted View Transition should never prevent the theme change.
      if (theme !== nextTheme) setTheme(nextTheme)
    } finally {
      delete root.dataset.themeTransition
      root.style.removeProperty('--theme-reveal-x')
      root.style.removeProperty('--theme-reveal-y')
      root.style.removeProperty('--theme-reveal-radius')
      transitionLock.current = false
      setTransitioning(false)
    }
  }, [theme])

  const value = useMemo(() => ({ theme, toggleTheme, transitioning }), [theme, toggleTheme, transitioning])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
