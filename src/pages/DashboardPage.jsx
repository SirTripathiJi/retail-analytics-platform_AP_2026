import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Sidebar } from '../components/dashboard/Sidebar.jsx'
import { DashboardHeader } from '../components/dashboard/DashboardHeader.jsx'
import { MetricCards } from '../components/dashboard/MetricCards.jsx'
import { VisitorsChart } from '../components/dashboard/VisitorsChart.jsx'
import { DocumentsTable } from '../components/dashboard/DocumentsTable.jsx'
import { AnalyticsPanels } from '../components/dashboard/AnalyticsPanels.jsx'
import '../dashboard.css'

const sectionTitles = {
  'quick-create': 'Documents', dashboard: 'Dashboard', lifecycle: 'Lifecycle', analytics: 'Analytics',
  projects: 'Projects', team: 'Team', 'data-library': 'Data Library', reports: 'Reports',
  'word-assistant': 'Word Assistant', more: 'More', settings: 'Settings', 'get-help': 'Get Help',
}

export function DashboardPage() {
  const { section = 'quick-create' } = useParams()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const onSearch = useCallback(() => { setSearchOpen(true); setMobileSidebarOpen(false) }, [])
  const toggleSidebar = () => {
    if (window.matchMedia('(max-width: 900px)').matches) setMobileSidebarOpen(open => !open)
    else setSidebarCollapsed(collapsed => !collapsed)
  }
  const title = sectionTitles[section] || 'Documents'
  const analyticsOnly = section === 'analytics' || section === 'reports'
  const documentsOnly = section === 'data-library' || section === 'word-assistant'

  return <div className={`dash-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <Sidebar active={section} open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} onSearch={onSearch} />
    <div className="dash-main-column">
      <DashboardHeader title={title} onToggleSidebar={toggleSidebar} searchOpen={searchOpen} setSearchOpen={setSearchOpen} search={search} setSearch={setSearch} />
      <main className="dash-content">
        {!documentsOnly && <><MetricCards /><VisitorsChart /></>}
        {!analyticsOnly && <DocumentsTable search={search} />}
        {!documentsOnly && <AnalyticsPanels />}
      </main>
    </div>
  </div>
}

export default DashboardPage
