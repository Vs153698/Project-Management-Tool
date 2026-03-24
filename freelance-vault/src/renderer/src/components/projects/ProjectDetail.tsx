import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  Edit2,
  Trash2,
  FolderOpen,
  Calendar,
  Tag,
  User,
  DollarSign,
  Clock,
  AlertTriangle,
  Code2,
  Github
} from 'lucide-react'
import { useEditors } from '../../hooks/useEditors'
import { format, isPast, parseISO } from 'date-fns'
import { useAppStore } from '../../store/useAppStore'
import CreateProjectModal from './CreateProjectModal'
import PaymentTimeline from '../payments/PaymentTimeline'
import CredentialVault from '../credentials/CredentialVault'
import FileManager from '../files/FileManager'
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal'
import TimeTracker from '../time/TimeTracker'
import EnvManager from '../env/EnvManager'
import ScriptRunner from '../scripts/ScriptRunner'
import InvoiceGenerator from '../invoice/InvoiceGenerator'
import LinkedInGenerator from '../ai/LinkedInGenerator'

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

interface InfoItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string | undefined
  valueClass?: string
}

function InfoItem({ icon: Icon, label, value, valueClass }: InfoItemProps) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center mt-0.5 shrink-0">
        <Icon size={14} className="text-text-muted" />
      </div>
      <div>
        <p className="text-text-muted text-xs">{label}</p>
        <p className={`text-text text-sm font-medium mt-0.5 ${valueClass || ''}`}>{value}</p>
      </div>
    </div>
  )
}

export default function ProjectDetail({ projectId }: { projectId: string }): JSX.Element {
  const { db, setView, deleteProject, displayCurrency } = useAppStore()
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'credentials' | 'files' | 'time' | 'env' | 'scripts' | 'invoice' | 'linkedin'>('overview')
  const [showEdit, setShowEdit] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const project = useMemo(() => db.projects.find((p) => p.id === projectId), [db.projects, projectId])
  const projectPayments = useMemo(
    () => db.payments.filter((p) => p.projectId === projectId),
    [db.payments, projectId]
  )

  const totalPaid = useMemo(
    () => projectPayments.reduce((sum, p) => sum + p.amount, 0),
    [projectPayments]
  )

  if (!project) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-text-muted">
        <FolderOpen size={48} className="mb-3 opacity-20" />
        <p>Project not found</p>
        <button onClick={() => setView('projects')} className="btn-primary mt-4">
          Back to Projects
        </button>
      </div>
    )
  }

  const isOverdue =
    project.deadline &&
    isPast(parseISO(project.deadline)) &&
    project.status !== 'completed' &&
    project.status !== 'cancelled'

  const handleDelete = async () => {
    await deleteProject(project.id)
    setView('projects')
  }

  const openFolder = async () => {
    const folderPath = await window.electron.projectGetFolder(project.id)
    window.electron.folderOpen(folderPath)
  }

  const { editors, openInEditor } = useEditors()
  const [projectFolderPath, setProjectFolderPath] = useState('')
  useEffect(() => {
    window.electron.codeGetProjectFolderPath(project.id).then(setProjectFolderPath).catch(() => {})
  }, [project.id])

  const pct =
    project.projectCost > 0 ? Math.min(100, (totalPaid / project.projectCost) * 100) : 0

  const isPersonal = project.projectType === 'personal'

  type TabKey = 'overview' | 'payments' | 'credentials' | 'files' | 'time' | 'env' | 'scripts' | 'invoice' | 'linkedin'
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    ...(!isPersonal ? [{ key: 'payments' as TabKey, label: 'Payments' }] : []),
    { key: 'credentials', label: 'Credentials' },
    { key: 'files', label: 'Files' },
    { key: 'time', label: 'Time' },
    { key: 'env', label: '.env' },
    { key: 'scripts', label: 'Scripts' },
    ...(!isPersonal ? [{ key: 'invoice' as TabKey, label: 'Invoice' }] : []),
    { key: 'linkedin', label: 'LinkedIn' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="px-8 pt-6 pb-0 border-b border-border">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setView('projects')}
            className="flex items-center gap-1.5 text-text-muted hover:text-text text-sm transition-colors"
          >
            <ChevronLeft size={16} />
            Projects
          </button>
          <span className="text-border">/</span>
          <span className="text-text text-sm font-medium truncate">{project.projectName}</span>
        </div>

        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-xl font-bold text-text">{project.projectName}</h1>
              {isPersonal && (
                <span className="badge bg-accent/10 text-accent border border-accent/20">Personal</span>
              )}
              <span className={`badge border ${statusColors[project.status] || ''}`}>
                {statusLabels[project.status] || project.status}
              </span>
              {isOverdue && (
                <span className="badge bg-danger/10 text-danger border border-danger/20">
                  <AlertTriangle size={10} className="mr-1" />
                  Overdue
                </span>
              )}
            </div>
            <p className="text-text-muted text-sm">{project.clientName}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button
              onClick={openFolder}
              className="btn-secondary text-sm py-1.5 px-3"
            >
              <FolderOpen size={14} />
              Open Folder
            </button>
            {editors.map((ed) => (
              <button
                key={ed.appName}
                onClick={() => projectFolderPath && openInEditor(projectFolderPath, ed)}
                title={`Open in ${ed.name}`}
                className="btn-secondary text-sm py-1.5 px-3"
              >
                <Code2 size={14} />
                {ed.name}
              </button>
            ))}
            <button
              onClick={() => setShowEdit(true)}
              className="btn-secondary text-sm py-1.5 px-3"
            >
              <Edit2 size={14} />
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-danger text-sm py-1.5 px-3"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Payment summary bar — freelance only */}
        {!isPersonal && <div className="flex items-center gap-6 mb-5 p-3 bg-surface rounded-xl border border-border">
          <div>
            <p className="text-text-muted text-xs">Total Value</p>
            <p className="text-text font-bold">{formatCurrency(project.projectCost, displayCurrency)}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs">Received</p>
            <p className="text-success font-bold">{formatCurrency(totalPaid, displayCurrency)}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs">Remaining</p>
            <p className="text-warning font-bold">
              {formatCurrency(Math.max(0, project.projectCost - totalPaid), displayCurrency)}
            </p>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>Payment Progress</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="w-full bg-border rounded-full h-2">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>}

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tab-btn ${activeTab === tab.key ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'overview' && (
              <div className="p-8 space-y-6 max-w-3xl">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem icon={User} label="Client" value={project.clientName} />
                  <InfoItem icon={User} label="Middleman / Agency" value={project.middleman} />
                  <InfoItem
                    icon={DollarSign}
                    label="Project Value"
                    value={formatCurrency(project.projectCost, displayCurrency)}
                  />
                  <InfoItem
                    icon={Calendar}
                    label="Start Date"
                    value={project.startDate ? format(parseISO(project.startDate), 'MMM d, yyyy') : undefined}
                  />
                  <InfoItem
                    icon={Calendar}
                    label="End Date"
                    value={project.endDate ? format(parseISO(project.endDate), 'MMM d, yyyy') : undefined}
                  />
                  <InfoItem
                    icon={Clock}
                    label="Deadline"
                    value={project.deadline ? format(parseISO(project.deadline), 'MMM d, yyyy') : undefined}
                    valueClass={isOverdue ? 'text-danger' : undefined}
                  />
                </div>

                {project.githubUrl && (
                  <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                      <Github size={14} className="text-text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-muted text-xs">GitHub Repository</p>
                      <a
                        href={project.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary text-sm font-medium truncate block hover:underline"
                      >
                        {project.githubUrl.replace('https://github.com/', '')}
                      </a>
                    </div>
                  </div>
                )}

                {project.description && (
                  <div>
                    <p className="label">Description</p>
                    <div className="bg-surface border border-border rounded-xl p-4 text-text-secondary text-sm leading-relaxed">
                      {project.description}
                    </div>
                  </div>
                )}

                {project.tags.length > 0 && (
                  <div>
                    <p className="label">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm border border-primary/20"
                        >
                          <Tag size={12} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-text-muted text-xs">
                  Created {format(parseISO(project.createdAt), 'MMM d, yyyy')} ·{' '}
                  Updated {format(parseISO(project.updatedAt), 'MMM d, yyyy')}
                </div>
              </div>
            )}

            {activeTab === 'payments' && !isPersonal && (
              <div className="p-6">
                <PaymentTimeline project={project} />
              </div>
            )}

            {activeTab === 'credentials' && (
              <div className="p-6">
                <CredentialVault projectId={project.id} />
              </div>
            )}

            {activeTab === 'files' && (
              <div className="p-6">
                <FileManager projectId={project.id} />
              </div>
            )}

            {activeTab === 'time' && (
              <div className="p-6">
                <TimeTracker projectId={project.id} />
              </div>
            )}

            {activeTab === 'env' && (
              <div className="p-6">
                <EnvManager projectId={project.id} />
              </div>
            )}

            {activeTab === 'scripts' && (
              <div className="p-6">
                <ScriptRunner projectId={project.id} />
              </div>
            )}

            {activeTab === 'invoice' && !isPersonal && (
              <div className="p-6">
                <InvoiceGenerator project={project} />
              </div>
            )}

            {activeTab === 'linkedin' && (
              <div className="p-6">
                <LinkedInGenerator projectId={project.id} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {showEdit && (
          <CreateProjectModal editProject={project} onClose={() => setShowEdit(false)} />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <ConfirmDeleteModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        itemType="project"
        itemName={project.projectName}
        description={`This will permanently delete "${project.projectName}" and all its payments and credentials. This action cannot be undone.`}
        requireTypedConfirm
      />
    </div>
  )
}
