import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Activity, BarChart3, Boxes, Check, ChevronDown, ContactRound, Contrast, Globe2, LayoutDashboard, LogOut, Menu, Search, Settings, ShoppingCart, ReceiptText, X } from 'lucide-react'
import { Button } from '../ui/button.jsx'
import { Select } from '../ui/select.jsx'
import { ThemeToggle } from '../ThemeToggle.jsx'
import { ArthSaathiMark } from '../illustrations/ArthSaathiIllustration.jsx'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { RetailDataProvider, useRetailData } from '../../retail/RetailDataProvider.jsx'
import { LanguageProvider, useLanguage } from '../../retail/LanguageProvider.jsx'
import '../../retail/retail.css'

const items = [
  { to: '/dashboard', label: 'Overview', key: 'dashboard', icon: LayoutDashboard, end: true },
  { to: '/inventory', label: 'Inventory', key: 'inventory', icon: Boxes },
  { to: '/sales', label: 'Billing & Sales', key: 'sales', icon: ShoppingCart },
  { to: '/customers', label: 'Customers', key: 'customers', icon: ContactRound },
  { to: '/transactions', label: 'Transactions', key: 'transactions', icon: ReceiptText },
  { to: '/analytics', label: 'Analytics', key: 'analytics', icon: BarChart3 },
]
function ShellContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { storageError } = useRetailData()
  const { language, setLanguage, t, direction, languages } = useLanguage()
  const shellT = t
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const searchRef = useRef(null)
  const currentItem = items.find(item => item.to === location.pathname)
  const title = currentItem ? shellT(currentItem.key) : shellT(location.pathname === '/contrast-checker' ? 'contrastChecker' : location.pathname === '/settings' ? 'settings' : 'overview')
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || shellT('shopOwner')
  const closeMenu = () => setMobileOpen(false)
  const signOut = async () => { setSigningOut(true); setLogoutError(''); try { await logout(); navigate('/', { replace: true }) } catch { setSigningOut(false); setLogoutError(shellT('signOutError')) } }
  useEffect(() => { if (searchOpen) searchRef.current?.focus() }, [searchOpen])
  useEffect(() => {
    const onKey = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(open => !open) }
      if (event.key === 'Escape' && mobileOpen) setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])
  return <div className="retail-app" lang={language} dir={direction}>
    {mobileOpen && <button className="retail-scrim" onClick={closeMenu} aria-label={shellT('closeNavigation')} />}
    <aside className={`retail-sidebar ${mobileOpen ? 'open' : ''}`}>
      <Link className="retail-brand" to="/dashboard" onClick={closeMenu}><ArthSaathiMark decorative /><span>ArthSaathi</span></Link>
      <Link className="retail-quick-create" to="/sales" onClick={closeMenu}><ShoppingCart size={16} /> {shellT('quickCreate')}</Link>
      <div className="retail-nav-caption">{shellT('shop')}</div>
      <nav className="retail-nav" aria-label={shellT('mainNavigation')}>{items.map(({ to, label, key, icon: Icon, end }) => <NavLink to={to} end={end} key={to} onClick={closeMenu} className={({ isActive }) => `retail-nav-link ${isActive ? 'active' : ''}`}><Icon size={16} /><span>{shellT(key)}</span></NavLink>)}</nav>
      <div className="retail-sidebar-spacer" />
      <div className="retail-nav-caption">{shellT('preferences')}</div>
      <NavLink to="/settings" className={({ isActive }) => `retail-nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}><Settings size={16} /><span>{shellT('settings')}</span></NavLink>
      <NavLink to="/contrast-checker" className={({ isActive }) => `retail-nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}><Contrast size={16} /><span>{shellT('contrastChecker')}</span></NavLink>
      <Link className="retail-nav-link" to="/#contact" onClick={closeMenu}><span className="retail-help-icon" aria-hidden="true">?</span><span>{shellT('help')}</span></Link>
      <div className="retail-profile">
        <div className="retail-avatar">{name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</div>
        <div className="retail-profile-copy"><strong>{name}</strong><small>{user?.email}</small></div>
        <details className="retail-profile-menu"><summary aria-label={shellT('openAccountMenu')}><ChevronDown size={15} /></summary><div><strong>{name}</strong><small>{user?.email || shellT('signedIn')}</small>{logoutError && <small role="alert" className="retail-logout-error">{logoutError}</small>}<button type="button" onClick={signOut} disabled={signingOut}><LogOut size={14} />{signingOut ? shellT('signingOut') : shellT('signOut')}</button></div></details>
      </div>
    </aside>
    <div className="retail-main">
      <header className="retail-topbar">
        <Button variant="ghost" className="retail-mobile-menu" onClick={() => setMobileOpen(true)} aria-label={shellT('openNavigation')}><Menu size={18} /></Button>
        <div className="retail-page-title"><span>ArthSaathi</span><span aria-hidden="true">/</span><strong>{title}</strong></div>
        <div className="retail-top-actions">
          <label className={`retail-global-search ${searchOpen ? 'visible' : ''}`}>
            <Search size={15} />
            <input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder={shellT('search')} aria-label={shellT('search')} onKeyDown={event => { if (event.key === 'Escape') { setSearch(''); setSearchOpen(false) } }} />
            {search && <button type="button" onClick={() => setSearch('')} aria-label={shellT('clearSearch')}><X size={14} /></button>}
          </label>
          <button type="button" className="retail-search-toggle" onClick={() => setSearchOpen(open => !open)} aria-label={shellT('toggleSearch')} aria-expanded={searchOpen}><Search size={16} /></button>
          <ThemeToggle labels={{ light: shellT('themeLight'), dark: shellT('themeDark') }} />
          <label className="retail-language-control"><Globe2 size={14} aria-hidden="true" /><span className="sr-only">{shellT('language')}</span><Select aria-label={shellT('language')} value={language} onChange={event => setLanguage(event.target.value)} className="retail-language">{languages.map(option => <option value={option.code} key={option.code} lang={option.code} dir={option.direction}>{option.label}</option>)}</Select><Check size={13} aria-hidden="true" /></label>
        </div>
      </header>
      <main className="retail-content">{storageError ? <div className="retail-storage-error" role="alert"><Activity size={13} />{shellT('storageError')}</div> : <div className="retail-device-note"><Activity size={13} /> {shellT('savedOnDevice')}</div>}<Outlet context={{ search }} /></main>
    </div>
  </div>
}

export function RetailShell() { return <LanguageProvider><RetailDataProvider><ShellContent /></RetailDataProvider></LanguageProvider> }
