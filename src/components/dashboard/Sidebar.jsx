import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, BarChart3, BookOpen, ChevronDown, CircleHelp, FileText, FolderKanban, LayoutDashboard, LogOut, MoreHorizontal, Plus, Search, Settings, Users, Workflow } from 'lucide-react'
import { ThemeToggle } from '../ThemeToggle.jsx'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { ArthSaathiMark } from '../illustrations/ArthSaathiIllustration.jsx'

const navigation = [
  { label: 'Quick Create', id: 'quick-create', icon: Plus, primary: true },
  { label: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
  { label: 'Lifecycle', id: 'lifecycle', icon: Activity },
  { label: 'Analytics', id: 'analytics', icon: BarChart3 },
  { label: 'Projects', id: 'projects', icon: FolderKanban },
  { label: 'Team', id: 'team', icon: Users },
]
const documents = [
  { label: 'Data Library', id: 'data-library', icon: BookOpen },
  { label: 'Reports', id: 'reports', icon: FileText },
  { label: 'Word Assistant', id: 'word-assistant', icon: Workflow },
  { label: 'More', id: 'more', icon: MoreHorizontal },
]
const utility = [
  { label: 'Settings', id: 'settings', icon: Settings },
  { label: 'Get Help', id: 'get-help', icon: CircleHelp },
]

export function Sidebar({ active, open, onClose, onSearch }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const profileName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'ArthSaathi member'
  const initials = profileName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
  const go = id => { navigate(`/dashboard/${id}`); onClose?.() }
  const navGroup = items => items.map(({ label, id, icon: Icon, primary }) => <button key={id} className={`dash-nav-link ${primary ? 'dash-nav-primary' : ''} ${active === id ? 'active' : ''}`} onClick={() => go(id)} aria-current={active === id ? 'page' : undefined}><Icon size={15} strokeWidth={1.8} /><span>{label}</span></button>)
  const handleLogout = async () => {
    setLoggingOut(true)
    try { await logout(); navigate('/', { replace: true }) }
    catch { setLoggingOut(false) }
  }

  return <>
    {open && <button className="dash-sidebar-scrim" type="button" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`dash-sidebar ${open ? 'is-open' : ''}`} aria-label="Workspace navigation">
      <a href="/" className="dash-brand"><ArthSaathiMark decorative className="dash-brand-mark" /><span>ArthSaathi</span></a>
      <nav className="dash-nav">{navGroup(navigation)}</nav>
      <div className="dash-nav-caption">Documents</div>
      <nav className="dash-nav">{navGroup(documents)}</nav>
      <div className="dash-nav-spacer" />
      <nav className="dash-nav">{navGroup(utility)}<button className="dash-nav-link" onClick={onSearch}><Search size={15} /><span>Search</span><kbd>⌘ K</kbd></button></nav>
      <div className="dash-sidebar-bottom">
        <ThemeToggle className="dash-theme-toggle" />
        <details className="dash-account-menu">
          <summary aria-label="Open account menu"><span className="dash-avatar">{initials || 'AM'}</span><span className="dash-account-copy"><strong>{profileName}</strong><small>{user?.email || 'Signed in'}</small></span><ChevronDown size={14} /></summary>
          <div className="dash-account-popover"><div className="dash-account-popover-id"><strong>{profileName}</strong><small>{user?.email}</small></div><button type="button" onClick={handleLogout} disabled={loggingOut}><LogOut size={14} />{loggingOut ? 'Signing out…' : 'Log out'}</button></div>
        </details>
      </div>
    </aside>
  </>
}
