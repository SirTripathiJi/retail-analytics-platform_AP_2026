import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight } from 'lucide-react'
import { Card } from '../ui/card.jsx'

const sourceData = [
  { name: 'Direct', value: 281, color: '#ff3f45' },
  { name: 'Search', value: 252, color: '#d900cc' },
  { name: 'Social', value: 184, color: '#14c82b' },
  { name: 'Referral', value: 210, color: '#1475f5' },
  { name: 'Email', value: 198, color: '#f5ef00' },
]
const browserData = [
  { name: 'Chrome', value: 100, color: '#ff3034' },
  { name: 'Safari', value: 73, color: '#fff000' },
  { name: 'Firefox', value: 68, color: '#086dff' },
  { name: 'Edge', value: 63, color: '#00c80d' },
  { name: 'Other', value: 33, color: '#d300cd' },
]

export function AnalyticsPanels() {
  return <section className="dash-analytics" aria-label="Example visitor breakdowns">
    <Card className="dash-panel dash-analytics-panel"><div className="dash-panel-heading"><div><h2>Pie Chart – Donut with Text</h2><p>January – June 2024</p></div></div><div className="dash-donut-area"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sourceData} dataKey="value" nameKey="name" innerRadius="57%" outerRadius="78%" paddingAngle={0} stroke="var(--card)">{sourceData.map(source => <Cell key={source.name} fill={source.color} />)}</Pie><Tooltip contentStyle={{ background: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--popover-foreground)', fontSize: 11 }} /></PieChart></ResponsiveContainer><div className="dash-donut-center"><strong>1,125</strong><span>Visitors</span></div></div><div className="dash-analytics-foot"><span>Trending up by 5.2% this month <ArrowUpRight size={13} /></span><small>Showing total visitors for the last 6 months · Demo data</small></div></Card>
    <Card className="dash-panel dash-analytics-panel"><div className="dash-panel-heading"><div><h2>Bar Chart – Mixed</h2><p>January – June 2024</p></div></div><div className="dash-browser-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={browserData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%"><CartesianGrid horizontal={false} stroke="var(--dash-grid)" /><XAxis type="number" hide domain={[0, 105]} /><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} width={44} /><Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--popover-foreground)', fontSize: 11 }} /><Bar dataKey="value" radius={[2, 2, 2, 2]}>{browserData.map(browser => <Cell key={browser.name} fill={browser.color} />)}</Bar></BarChart></ResponsiveContainer></div><div className="dash-analytics-foot"><span>Trending up by 5.2% this month <ArrowUpRight size={13} /></span><small>Showing total visitors for the last 6 months · Demo data</small></div></Card>
  </section>
}
