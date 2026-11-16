import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../ui/card.jsx'

const ranges = [
  { id: '3m', label: 'Last 3 months', count: 30, days: ['Jun'], phase: 0 },
  { id: '30d', label: 'Last 30 days', count: 30, days: ['Jun'], phase: 1.15 },
  { id: '7d', label: 'Last 7 days', count: 7, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], phase: 2.05 },
]

function buildVisitors(range) {
  return Array.from({ length: range.count }, (_, index) => {
    const wave = Math.sin((index / 3) * Math.PI + range.phase) * .5 + .5
    const longWave = Math.sin((index / 8) * Math.PI + .7 + range.phase) * .5 + .5
    const visitors = Math.round(20 + wave * 66 + longWave * 13)
    const returning = Math.round(12 + wave * 24 + longWave * 11)
    return { label: range.count === 7 ? range.days[index] : `${range.days[0]} ${index + 1}`, visitors, returning }
  })
}

function VisitorTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="dash-chart-tooltip"><strong>{label}</strong>{payload.map(item => <span key={item.dataKey}><i style={{ background: item.color }} />{item.name}: {item.value}</span>)}</div>
}

export function VisitorsChart() {
  const [rangeId, setRangeId] = useState('3m')
  const range = ranges.find(item => item.id === rangeId)
  const data = useMemo(() => buildVisitors(range), [range])
  return <Card className="dash-panel visitors-panel">
    <div className="dash-panel-heading"><div><h2>Total Visitors</h2><p>Total for the last {range.id === '3m' ? '3 months' : range.id === '30d' ? '30 days' : '7 days'}</p></div><div className="dash-range-controls" role="group" aria-label="Visitor chart range">{ranges.map(item => <button key={item.id} type="button" aria-pressed={rangeId === item.id} className={rangeId === item.id ? 'selected' : ''} onClick={() => setRangeId(item.id)}>{item.label}</button>)}</div></div>
    <div className="dash-visitors-chart" role="img" aria-label={`Example visitors chart for the ${range.label.toLowerCase()}`}>
      <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 2 }}>
        <defs><linearGradient id="visitor-coral-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-coral)" stopOpacity={.54} /><stop offset="100%" stopColor="var(--chart-coral)" stopOpacity={.08} /></linearGradient><linearGradient id="visitor-yellow-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-yellow)" stopOpacity={.65} /><stop offset="100%" stopColor="var(--chart-yellow)" stopOpacity={.12} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="var(--dash-grid)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} interval={range.count === 7 ? 0 : 0} minTickGap={3} />
        <YAxis hide domain={[0, 100]} />
        <Tooltip content={<VisitorTooltip />} />
        <Area type="monotone" dataKey="visitors" name="New visitors" stroke="var(--chart-coral)" fill="url(#visitor-coral-fill)" strokeWidth={1.6} activeDot={{ r: 3 }} />
        <Area type="monotone" dataKey="returning" name="Returning visitors" stroke="var(--chart-yellow)" fill="url(#visitor-yellow-fill)" strokeWidth={1.5} activeDot={{ r: 3 }} />
      </AreaChart></ResponsiveContainer>
    </div>
    <div className="dash-visitors-legend"><span><i className="legend-coral" />New visitors</span><span><i className="legend-yellow" />Returning visitors</span><small>Demonstration data</small></div>
  </Card>
}
