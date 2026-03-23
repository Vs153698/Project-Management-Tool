import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, FolderOpen, Clock, CheckCircle, Plus, TrendingUp } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'
import { useAppStore } from '../../store/useAppStore'
import type { Project } from '../../types'

const statusColors: Record<string, string> = {
  not_started: 'text-text-muted bg-text-muted/10',
  in_progress: 'text-accent bg-accent/10',
  completed: 'text-success bg-success/10',
  on_hold: 'text-warning bg-warning/10',
  cancelled: 'text-danger bg-danger/10'
}

const statusLabels: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled'
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  delay
}: {
  title: string
  value: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
  subtitle?: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="card hover:border-border/80 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-text">{value}</p>
          {subtitle && <p className="text-text-muted text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </motion.div>
  )
}

function getHourGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export default function Dashboard(): JSX.Element {
  const { db, user, setView, displayCurrency } = useAppStore()
  const { projects, payments } = db

  const stats = useMemo(() => {
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0)
    const activeProjects = projects.filter((p) => p.status === 'in_progress').length
    const completedProjects = projects.filter((p) => p.status === 'completed').length

    const paidByProject: Record<string, number> = {}
    payments.forEach((p) => {
      paidByProject[p.projectId] = (paidByProject[p.projectId] || 0) + p.amount
    })
    const pendingPayments = projects
      .filter((p) => p.status !== 'cancelled')
      .reduce((sum, p) => {
        const paid = paidByProject[p.id] || 0
        return sum + Math.max(0, p.projectCost - paid)
      }, 0)

    return { totalRevenue, activeProjects, completedProjects, pendingPayments }
  }, [projects, payments])

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i)
      const start = startOfMonth(date)
      const end = endOfMonth(date)
      const revenue = payments
        .filter((p) => {
          try {
            return isWithinInterval(parseISO(p.date), { start, end })
          } catch {
            return false
          }
        })
        .reduce((sum, p) => sum + p.amount, 0)
      return { month: format(date, 'MMM'), revenue }
    })
    return months
  }, [payments])

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [projects]
  )

  const paidByProject = useMemo(() => {
    const map: Record<string, number> = {}
    payments.forEach((p) => {
      map[p.projectId] = (map[p.projectId] || 0) + p.amount
    })
    return map
  }, [payments])

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-text-muted text-sm mb-0.5"
          >
            {getHourGreeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-text"
          >
            Dashboard
          </motion.h1>
        </div>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setView('projects')}
          className="btn-primary"
        >
          <Plus size={16} />
          New Project
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue, displayCurrency)}
          icon={DollarSign}
          color="bg-success/10 text-success"
          subtitle="All time earnings"
          delay={0.05}
        />
        <StatCard
          title="Active Projects"
          value={String(stats.activeProjects)}
          icon={FolderOpen}
          color="bg-accent/10 text-accent"
          subtitle={`${projects.length} total`}
          delay={0.1}
        />
        <StatCard
          title="Pending Payments"
          value={formatCurrency(stats.pendingPayments, displayCurrency)}
          icon={Clock}
          color="bg-warning/10 text-warning"
          subtitle="Outstanding balance"
          delay={0.15}
        />
        <StatCard
          title="Completed"
          value={String(stats.completedProjects)}
          icon={CheckCircle}
          color="bg-primary/10 text-primary"
          subtitle="Projects delivered"
          delay={0.2}
        />
      </div>

      {/* Charts + Recent */}
      <div className="grid grid-cols-5 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="col-span-3 card"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-primary" />
            <h2 className="font-semibold text-text">Revenue (Last 6 Months)</h2>
          </div>
          {payments.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-text-muted text-sm">
              No payment data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252538" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a27',
                    border: '1px solid #252538',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                  formatter={(value: number) => [formatCurrency(value, displayCurrency), 'Revenue']}
                />
                <Bar
                  dataKey="revenue"
                  fill="url(#barGradient)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Recent Projects */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="col-span-2 card"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text">Recent Projects</h2>
            <button
              onClick={() => setView('projects')}
              className="text-primary text-xs hover:underline"
            >
              View all
            </button>
          </div>
          {recentProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-text-muted text-sm">
              <FolderOpen size={32} className="mb-2 opacity-30" />
              <p>No projects yet</p>
              <button
                onClick={() => setView('projects')}
                className="text-primary text-xs mt-2 hover:underline"
              >
                Create your first project
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentProjects.map((project: Project) => {
                const paid = paidByProject[project.id] || 0
                const pct = project.projectCost > 0 ? (paid / project.projectCost) * 100 : 0
                return (
                  <motion.button
                    key={project.id}
                    onClick={() => setView('project-detail', project.id)}
                    whileHover={{ x: 2 }}
                    className="w-full text-left hover:bg-surface rounded-lg p-2 transition-colors -mx-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-text text-sm font-medium truncate flex-1">
                        {project.projectName}
                      </p>
                      <span
                        className={`badge ml-2 shrink-0 ${statusColors[project.status] || 'text-text-muted bg-border'}`}
                      >
                        {statusLabels[project.status] || project.status}
                      </span>
                    </div>
                    <p className="text-text-muted text-xs mb-1.5">{project.clientName}</p>
                    <div className="w-full bg-border rounded-full h-1">
                      <div
                        className="h-1 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
