import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money } from '../retailUtils.js'

export function SalesTrendChart({ data, showLegend = true, locale = 'en-IN', formatCurrency = money, labels = {} }) {
  const number = value => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value) || 0)
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
    <CartesianGrid stroke="var(--line-subtle)" vertical={false} />
    <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={18} />
    <YAxis width={48} tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={value => `₹${number(value)}`} />
    <Tooltip formatter={value => formatCurrency(value)} contentStyle={{ background: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--foreground)', borderRadius: 0 }} />
    {showLegend && <Legend />}
    <Area dataKey="revenue" name={labels.revenue || 'Revenue'} type="monotone" stroke="var(--retail-chart-revenue)" fill="var(--retail-chart-revenue)" fillOpacity={0.13} strokeWidth={2} />
    <Area dataKey="profit" name={labels.profit || 'Net profit'} type="monotone" stroke="var(--retail-chart-profit)" fill="var(--retail-chart-profit)" fillOpacity={0.14} strokeWidth={2} />
  </AreaChart></ResponsiveContainer>
}
