import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Menu, PanelLeft, Search, X } from 'lucide-react'
import { Button } from '../ui/button.jsx'

export function DashboardHeader({ title, onToggleSidebar, searchOpen, setSearchOpen, search, setSearch }) {
  const inputRef = useRef(null)
  useEffect(() => { if (searchOpen) inputRef.current?.focus() }, [searchOpen])
  useEffect(() => {
    const handleKey = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(value => !value) }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [setSearchOpen])
  return <header className="dash-topbar">
    <Button variant="ghost" className="dash-menu-button" type="button" aria-label="Toggle sidebar" onClick={onToggleSidebar}><Menu size={17} /></Button>
    <Button variant="ghost" className="dash-collapse-button" type="button" aria-label="Toggle sidebar" onClick={onToggleSidebar}><PanelLeft size={16} /></Button>
    <span className="dash-breadcrumb-divider" aria-hidden="true">|</span>
    <nav className="dash-breadcrumb" aria-label="Breadcrumb"><Link to="/dashboard">Workspace</Link><span>/</span><strong>{title}</strong></nav>
    <span className="dash-demo-label">DEMO DATA</span>
    <div className="dash-topbar-actions">{searchOpen ? <div className="dash-search-field"><Search size={15} /><input ref={inputRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search documents…" aria-label="Search documents" /><button type="button" onClick={() => { setSearch(''); setSearchOpen(false) }} aria-label="Close search"><X size={15} /></button></div> : <button type="button" className="dash-topbar-search" onClick={() => setSearchOpen(true)} aria-label="Search"><Search size={16} /><kbd>⌘ K</kbd></button>}</div>
  </header>
}
