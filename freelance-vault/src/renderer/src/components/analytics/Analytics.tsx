import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'
import { TrendingUp, DollarSign, FolderOpen, CheckCircle, Target } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

function formatCurrencyShort(amount: number, currency = 'USD'): string {
  try {
    const sym = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency
    if (amount >= 1000000) return `${sym}${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${sym}${(amount / 1000).toFixed(1)}K`
    return `${sym}${amount.toLocaleString()}`
  } catch {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
    return amount.toLocaleString()
  }
}

function formatFull(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `$${amount.toLocaleString()}`
  }
}

const STATUS_COLORS: Record<string, string> = {
  not_started: '#64748b',
  in_progress: '#10C9A0',
  completed: '#10b981',
  on_hold: '#f59e0b',
  cancelled: '#ef4444'
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled'
}

const PAYMENT_TYPE_COLORS: Record<string, string> = {
  advance: '#10C9A0',
  milestone: '#3D6EF5',
  final: '#10b981',
  other: '#64748b'
}

export default function Analytics(): JSX.Element {
  const { db, displayCurrency } = useAppStore()
  const { payments } = db
  const projects = db.projects.filter((p) => (p.projectType || 'freelance') === 'freelance')

  // Monthly revenue — last 12 months
  const monthlyRevenue = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const date = subMonths(new Date(), 11 - i)
      const start = startOfMonth(date)
      const end = endOfMonth(date)
      const revenue = payments
        .filter((p) => {
          try { return isWithinInterval(parseISO(p.date), { start, end }) }
          catch { return false }
        })
        .reduce((sum, p) => sum + p.amount, 0)
      return { month: format(date, 'MMM yy'), revenue }
    })
  }, [payments])

  // Project status breakdown
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    projects.forEach((p) => {
      counts[p.status] = (counts[p.status] || 0) + 1
    })
    return Object.entries(counts).map(([status, value]) => ({
      name: STATUS_LABELS[status] || status,
      value,
      color: STATUS_COLORS[status] || '#64748b'
    }))
  }, [projects])

  // Payment type breakdown
  const paymentTypeData = useMemo(() => {
    const amounts: Record<string, number> = {}
    payments.forEach((p) => {
      amounts[p.type] = (amounts[p.type] || 0) + p.amount
    })
    return Object.entries(amounts).map(([type, amount]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      amount,
      color: PAYMENT_TYPE_COLORS[type] || '#64748b'
    }))
  }, [payments])

  // Top clients by revenue
  const topClients = useMemo(() => {
    const clientRevenue: Record<string, { name: string; revenue: number; projects: number }> = {}
    const paidByProject: Record<string, number> = {}
    payments.forEach((p) => {
      paidByProject[p.projectId] = (paidByProject[p.projectId] || 0) + p.amount
    })
    projects.forEach((p) => {
      const key = p.clientName
      if (!clientRevenue[key]) {
        clientRevenue[key] = { name: p.clientName, revenue: 0, projects: 0 }
      }
      clientRevenue[key].revenue += paidByProject[p.id] || 0
      clientRevenue[key].projects += 1
    })
    return Object.values(clientRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [projects, payments])

  // Summary stats
  const stats = useMemo(() => {
    const totalEarned = payments.reduce((sum, p) => sum + p.amount, 0)
    const totalValue = projects.reduce((sum, p) => sum + p.projectCost, 0)
    const completedCount = projects.filter((p) => p.status === 'completed').length
    const completionRate = projects.length > 0 ? (completedCount / projects.length) * 100 : 0
    const avgProjectValue = projects.length > 0 ? totalValue / projects.length : 0
    return { totalEarned, totalValue, completionRate, avgProjectValue }
  }, [projects, payments])

  const tooltipStyle = {
    contentStyle: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#111827', fontSize: 12 }
  }

  return (
    <div className="p-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold text-text">Analytics</h1>
        <p className="text-text-muted text-sm mt-0.5">Your freelance business at a glance</p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Earned', value: formatFull(stats.totalEarned, displayCurrency), icon: DollarSign, color: 'text-success bg-success/10', delay: 0.05 },
          { label: 'Total Contracted', value: formatFull(stats.totalValue, displayCurrency), icon: Target, color: 'text-primary bg-primary/10', delay: 0.1 },
          { label: 'Avg Project Value', value: formatFull(stats.avgProjectValue, displayCurrency), icon: TrendingUp, color: 'text-accent bg-accent/10', delay: 0.15 },
          { label: 'Completion Rate', value: `${Math.round(stats.completionRate)}%`, icon: CheckCircle, color: 'text-warning bg-warning/10', delay: 0.2 }
        ].map(({ label, value, icon: Icon, color, delay }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.3 }}
            className="card"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xl font-bold text-text">{value}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={16} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Revenue chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="card mb-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={16} className="text-primary" />
          <h2 className="font-semibold text-text">Monthly Revenue (Last 12 Months)</h2>
        </div>
        {payments.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-text-muted text-sm">
            <div className="text-center">
              <DollarSign size={32} className="mx-auto mb-2 opacity-20" />
              <p>No payment data yet</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyRevenue} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrencyShort(v, displayCurrency)} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [formatFull(v, displayCurrency), 'Revenue']} />
              <defs>
                <linearGradient id="revBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3D6EF5" />
                  <stop offset="100%" stopColor="#10C9A0" />
                </linearGradient>
              </defs>
              <Bar dataKey="revenue" fill="url(#revBar)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Project status pie */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen size={15} className="text-accent" />
            <h2 className="font-semibold text-text text-sm">Project Status</h2>
          </div>
          {statusData.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-text-muted text-xs">No projects yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {statusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-text-muted">{item.name}</span>
                    </div>
                    <span className="text-text font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

        {/* Payment types */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={15} className="text-success" />
            <h2 className="font-semibold text-text text-sm">Payment Types</h2>
          </div>
          {paymentTypeData.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-text-muted text-xs">No payments yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={paymentTypeData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="amount">
                    {paymentTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [formatFull(v, displayCurrency), 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {paymentTypeData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-text-muted">{item.name}</span>
                    </div>
                    <span className="text-text font-medium">{formatCurrencyShort(item.amount, displayCurrency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

        {/* Top clients */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={15} className="text-warning" />
            <h2 className="font-semibold text-text text-sm">Top Clients</h2>
          </div>
          {topClients.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-text-muted text-xs">No clients yet</div>
          ) : (
            <div className="space-y-3">
              {topClients.map((client, i) => {
                const maxRevenue = topClients[0].revenue || 1
                const pct = (client.revenue / maxRevenue) * 100
                return (
                  <div key={client.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted">{i + 1}.</span>
                        <span className="text-text font-medium truncate max-w-[100px]">{client.name}</span>
                      </div>
                      <span className="text-text-muted">{formatCurrencyShort(client.revenue, displayCurrency)}</span>
                    </div>
                    <div className="w-full bg-border rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: `hsl(${260 - i * 20}, 70%, 65%)`
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Revenue trend line chart */}
      {payments.length > 3 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="card mt-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-accent" />
            <h2 className="font-semibold text-text">Revenue Trend</h2>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={monthlyRevenue} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrencyShort(v, displayCurrency)} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [formatFull(v), 'Revenue']} />
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3D6EF5" />
                  <stop offset="100%" stopColor="#10C9A0" />
                </linearGradient>
              </defs>
              <Line type="monotone" dataKey="revenue" stroke="url(#lineGrad)" strokeWidth={2.5} dot={{ fill: '#3D6EF5', r: 3 }} activeDot={{ r: 5, fill: '#10C9A0' }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  )
}
