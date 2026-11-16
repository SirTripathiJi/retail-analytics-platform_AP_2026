import { Moon, Sun } from 'lucide-react'
import { Button } from './ui/button.jsx'
import { useTheme } from '../theme/ThemeProvider.jsx'

export function ThemeToggle({ className = '', labels }) {
  const { theme, toggleTheme, transitioning } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const label = nextTheme === 'light' ? labels?.light : labels?.dark
  return <Button
    type="button"
    variant="ghost"
    className={`theme-toggle ${className}`}
    onClick={event => toggleTheme(event.currentTarget)}
    disabled={transitioning}
    aria-busy={transitioning}
    aria-label={label || `Switch to ${nextTheme} mode`}
    aria-pressed={theme === 'dark'}
    title={label || `Switch to ${nextTheme} mode`}
  >{theme === 'dark' ? <Sun className="theme-icon" size={17} aria-hidden="true" key="sun" /> : <Moon className="theme-icon" size={17} aria-hidden="true" key="moon" />}</Button>
}
