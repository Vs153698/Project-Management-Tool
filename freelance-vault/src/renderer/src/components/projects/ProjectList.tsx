import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, FolderOpen, Calendar, Tag, ChevronRight } from 'lucide-react'
import { format, isPast, parseISO } from 'date-fns'
import { useAppStore } from '../../store/useAppStore'
import CreateProjectModal from './CreateProjectModal'
import type { Project } from '../../types'

const statusColors: Record<string, string> = {
  not_started: 'text-text-muted bg-text-muted/10 border-text-muted/20',
  in_progress: 'text-accent bg-accent/10 border-accent/20',
  completed: 'text-success bg-success/10 border-success/20',
  on_hold: 'text-warning bg-warning/10 border-warning/20',
  cancelled: 'text-danger bg-danger/10 border-danger/20'
}

const statusLabels: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
  cancelled: 'Cancelled'
}

function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function ProjectCard({ project, paidAmount, onClick, displayCurrency }: { project: Project; paidAmount: number; onClick: () => void; displayCurrency: string }) {
  const pct = project.projectCost > 0 ? Math.min(100, (paidAmount / project.projectCost) * 100) : 0
  const isOverdue = project.deadline && isPast(parseISO(project.deadline)) && project.status !== 'completed' && project.status !== 'cancelled'

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="card text-left w-full hover:border-primary/30 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-text-muted text-xs mb-0.5 truncate">{project.clientName}</p>
          <h3 className="font-semibold text-text truncate group-hover:text-primary transition-colors">
            {project.projectName}
          </h3>
          {project.middleman && (
            <p className="text-text-muted text-xs mt-0.5">via {project.middleman}</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <span className={`badge border ${statusColors[project.status] || ''}`}>
            {statusLabels[project.status] || project.status}
          </span>
          <ChevronRight size={14} className="text-text-muted group-hover:text-primary transition-colors" />
        </div>
      </div>

      {/* Payment progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-text-muted mb-1.5">
          <span>
            {formatCurrency(paidAmount, displayCurrency)} paid
          </span>
          <span>{formatCurrency(project.projectCost, displayCurrency)}</span>
        </div>
        <div className="w-full bg-border rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Deadline + Tags */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {project.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface text-text-muted text-xs border border-border"
            >
              <Tag size={9} />
              {tag}
            </span>
          ))}
        </div>
        {project.deadline && (
          <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-danger' : 'text-text-muted'}`}>
            <Calendar size={11} />
            {format(parseISO(project.deadline), 'MMM d')}
            {isOverdue && <span className="font-medium">· Overdue</span>}
          </div>
        )}
      </div>
    </motion.button>
  )
}

export default function ProjectList(): JSX.Element {
  const { db, setView, displayCurrency } = useAppStore()
  const { projects, payments } = db
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const paidByProject = useMemo(() => {
    const map: Record<string, number> = {}
    payments.forEach((p) => {
      map[p.projectId] = (map[p.projectId] || 0) + p.amount
    })
    return map
  }, [payments])

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !search ||
        p.projectName.toLowerCase().includes(search.toLowerCase()) ||
        p.clientName.toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      const matchStatus = filterStatus === 'all' || p.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [projects, search, filterStatus])

  const statuses = ['all', 'not_started', 'in_progress', 'completed', 'on_hold', 'cancelled']

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Projects</h1>
          <p className="text-text-muted text-sm mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowCreate(true)}
          className="btn-primary"
        >
          <Plus size={16} />
          New Project
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="input pl-9 py-2"
          />
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                filterStatus === s
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {s === 'all' ? 'All' : statusLabels[s] || s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-text-muted">
          <FolderOpen size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium text-text">
            {search || filterStatus !== 'all' ? 'No projects match your filters' : 'No projects yet'}
          </p>
          <p className="text-sm mt-1 mb-4">
            {search || filterStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first project to get started'}
          </p>
          {!search && filterStatus === 'all' && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus size={16} />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                paidAmount={paidByProject[project.id] || 0}
                onClick={() => setView('project-detail', project.id)}
                displayCurrency={displayCurrency}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  )
}
