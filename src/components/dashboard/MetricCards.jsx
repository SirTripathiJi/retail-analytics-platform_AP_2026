import { ArrowDownRight, ArrowUpRight, Activity, CircleDollarSign, UserRoundPlus, UsersRound } from 'lucide-react'
import { Card } from '../ui/card.jsx'

const metrics = [
  { label: 'Total Revenue', value: '$1,250.00', change: '+12.5%', caption: 'Trending up this month', note: 'Visitors for the last 6 months', Icon: CircleDollarSign, up: true },
  { label: 'New Customers', value: '1,234', change: '−20%', caption: 'Down 20% this period', note: 'Acquisition needs attention', Icon: UserRoundPlus, up: false },
  { label: 'Active Accounts', value: '45,678', change: '+12.5%', caption: 'Strong user retention', note: 'Engagement exceeds targets', Icon: UsersRound, up: true },
  { label: 'Growth Rate', value: '4.5%', change: '+4.5%', caption: 'Steady performance', note: 'Meets growth projections', Icon: Activity, up: true },
]

export function MetricCards() {
  return <section className="dash-kpis" aria-label="Example business metrics">
    {metrics.map(({ label, value, change, caption, note, Icon, up }) => <Card className="dash-kpi" key={label}>
      <div className="dash-kpi-top"><span>{label}</span><span className="dash-kpi-change">{up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{change}</span></div>
      <strong className="dash-kpi-value">{value}</strong>
      <div className="dash-kpi-caption"><span>{caption}</span><Icon size={12} /></div>
      <span className="dash-kpi-note">{note}</span>
    </Card>)}
  </section>
}
