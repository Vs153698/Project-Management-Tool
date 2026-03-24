import { useState, KeyboardEvent, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Tag, Code2, SkipForward, Github, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { Project } from '../../types'
import CodeGeneratorModal from './CodeGeneratorModal'
import { useEditors } from '../../hooks/useEditors'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'SGD', 'AED', 'CHF']
const STATUSES: { value: Project['status']; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
]

interface Props {
  onClose: () => void
  editProject?: Project
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function extractRepoName(url: string): string {
  try {
    const clean = url.trim().replace(/\.git$/, '')
    const parts = clean.split('/')
    return parts[parts.length - 1] || ''
  } catch {
    return ''
  }
}

type CloneState = 'idle' | 'cloning' | 'done' | 'error'

export default function CreateProjectModal({ onClose, editProject }: Props): JSX.Element {
  const { addProject, updateProject, displayCurrency } = useAppStore()
  const { editors, openInEditor } = useEditors()
  const [isLoading, setIsLoading] = useState(false)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)
  const [showCodeGen, setShowCodeGen] = useState(false)
  const [mode, setMode] = useState<'manual' | 'github'>('manual')
  const [projectType, setProjectType] = useState<'freelance' | 'personal'>(
    editProject?.projectType || 'freelance'
  )

  // GitHub clone state
  const [githubUrl, setGithubUrl] = useState(editProject?.githubUrl || '')
  const [cloneState, setCloneState] = useState<CloneState>('idle')
  const [cloneError, setCloneError] = useState('')
  const [clonedFolderName, setClonedFolderName] = useState('')

  const [clientName, setClientName] = useState(editProject?.clientName || '')
  const [projectName, setProjectName] = useState(editProject?.projectName || '')
  const [middleman, setMiddleman] = useState(editProject?.middleman || '')
  const [projectCost, setProjectCost] = useState(String(editProject?.projectCost || ''))
  const [currency, setCurrency] = useState(editProject?.currency || displayCurrency)
  const [status, setStatus] = useState<Project['status']>(editProject?.status || 'not_started')
  const [description, setDescription] = useState(editProject?.description || '')
  const [startDate, setStartDate] = useState(editProject?.startDate || '')
  const [endDate, setEndDate] = useState(editProject?.endDate || '')
  const [deadline, setDeadline] = useState(editProject?.deadline || '')
  const [tags, setTags] = useState<string[]>(editProject?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isPersonal = projectType === 'personal'

  // Auto-fill project name from GitHub URL
  useEffect(() => {
    if (mode === 'github' && githubUrl) {
      const name = extractRepoName(githubUrl)
      if (name) setProjectName(name)
    }
  }, [githubUrl, mode])

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!isPersonal && !clientName.trim()) e.clientName = 'Client name is required'
    if (!projectName.trim()) e.projectName = 'Project name is required'
    if (mode === 'github' && !githubUrl.trim()) e.githubUrl = 'GitHub URL is required'
    if (!isPersonal && (!projectCost || isNaN(Number(projectCost)) || Number(projectCost) < 0)) {
      e.projectCost = 'Enter a valid project cost'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsLoading(true)
    try {
      if (editProject) {
        await updateProject(editProject.id, {
          projectType,
          clientName: isPersonal ? 'Personal' : clientName.trim(),
          projectName: projectName.trim(),
          middleman: isPersonal ? undefined : (middleman.trim() || undefined),
          projectCost: isPersonal ? 0 : Number(projectCost),
          currency,
          status,
          description: description.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          deadline: deadline || undefined,
          tags,
          githubUrl: githubUrl.trim() || undefined,
        })
        onClose()
      } else {
        const now = new Date().toISOString()
        const id = generateId()
        const project: Project = {
          id,
          projectType,
          clientName: isPersonal ? 'Personal' : clientName.trim(),
          projectName: projectName.trim(),
          middleman: isPersonal ? undefined : (middleman.trim() || undefined),
          projectCost: isPersonal ? 0 : Number(projectCost),
          currency,
          status,
          description: description.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          deadline: deadline || undefined,
          tags,
          githubUrl: mode === 'github' ? githubUrl.trim() : undefined,
          createdAt: now,
          updatedAt: now,
        }
        await addProject(project)
        setCreatedProjectId(id)

        if (mode === 'github') {
          // Start cloning immediately
          const folderName = extractRepoName(githubUrl) || 'repo'
          setClonedFolderName(folderName)
          setCloneState('cloning')
          const result = await window.electron.gitClone({ projectId: id, url: githubUrl.trim(), folderName })
          if (result.success) {
            setCloneState('done')
          } else {
            setCloneError(result.error || 'Clone failed')
            setCloneState('error')
          }
        }
        // For manual mode, createdProjectId being set shows the "Generate Code?" prompt
      }
    } catch (err) {
      setErrors({ root: String(err) })
    }
    setIsLoading(false)
  }

  // ── GitHub clone progress screen ─────────────────────────────────────────────
  if (createdProjectId && mode === 'github' && cloneState !== 'idle') {
    return (
      <div className="modal-overlay">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="modal-content"
          style={{ maxWidth: 460 }}
        >
          <div className="p-8 text-center">
            <AnimatePresence mode="wait">
              {cloneState === 'cloning' && (
                <motion.div key="cloning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5"
                  >
                    <Github size={30} className="text-primary" />
                  </motion.div>
                  <h2 className="text-xl font-bold text-text mb-2">Cloning Repository</h2>
                  <p className="text-text-muted text-sm mb-1">
                    <span className="font-mono text-xs bg-surface border border-border rounded px-2 py-0.5 break-all">
                      {githubUrl}
                    </span>
                  </p>
                  <p className="text-text-muted text-xs mt-3">This may take a moment for large repos...</p>
                </motion.div>
              )}

              {cloneState === 'done' && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                  <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-5">
                    <CheckCircle2 size={30} className="text-success" />
                  </div>
                  <h2 className="text-xl font-bold text-text mb-1">Repository Cloned!</h2>
                  <p className="text-text-muted text-sm mb-1">
                    Saved to <span className="font-mono text-xs bg-surface border border-border rounded px-1.5 py-0.5">{clonedFolderName}/</span>
                  </p>
                  <p className="text-text-muted text-xs mb-7">Project created and code is ready.</p>

                  <div className="space-y-2.5">
                    {editors.map((ed) => (
                      <motion.button
                        key={ed.appName}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          if (createdProjectId) {
                            const path = await window.electron.codeGetProjectFolderPath(createdProjectId)
                            await openInEditor(path, ed)
                          }
                          onClose()
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                      >
                        <ExternalLink size={15} />
                        Open in {ed.name}
                      </motion.button>
                    ))}
                    <button
                      onClick={onClose}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-text-muted hover:text-text hover:bg-surface transition-colors text-sm"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              )}

              {cloneState === 'error' && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-5">
                    <AlertCircle size={30} className="text-danger" />
                  </div>
                  <h2 className="text-xl font-bold text-text mb-2">Clone Failed</h2>
                  <p className="text-text-muted text-sm mb-3">Project was created but the repository could not be cloned.</p>
                  <div className="bg-danger/5 border border-danger/20 rounded-xl p-3 mb-6 text-left">
                    <p className="text-danger text-xs font-mono break-all">{cloneError}</p>
                  </div>
                  <div className="space-y-2.5">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        setCloneState('cloning')
                        setCloneError('')
                        const result = await window.electron.gitClone({ projectId: createdProjectId, url: githubUrl.trim(), folderName: clonedFolderName })
                        if (result.success) setCloneState('done')
                        else { setCloneError(result.error || 'Clone failed'); setCloneState('error') }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                      <Github size={15} />
                      Retry Clone
                    </motion.button>
                    <button onClick={onClose} className="w-full py-2.5 rounded-xl text-text-muted hover:text-text hover:bg-surface transition-colors text-sm">
                      Close
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Code generator offer (manual mode only) ───────────────────────────────────
  if (showCodeGen && createdProjectId) {
    return (
      <CodeGeneratorModal
        projectId={createdProjectId}
        onClose={onClose}
        onComplete={onClose}
      />
    )
  }

  if (createdProjectId && mode === 'manual' && !showCodeGen) {
    return (
      <div className="modal-overlay">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="modal-content"
          style={{ maxWidth: 460 }}
        >
          <div className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.05 }}
              className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-5"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>

            <h2 className="text-xl font-bold text-text mb-1">Project Created!</h2>
            <p className="text-text-muted text-sm mb-8">
              Would you like to generate a code folder for this project?
              <br />
              <span className="text-xs opacity-70">Vite, Next.js, Node backend, Python, AI agents and more.</span>
            </p>

            <div className="space-y-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCodeGen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                <Code2 size={16} />
                Generate Code Folder
              </motion.button>

              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-text-muted hover:text-text hover:bg-surface transition-colors text-sm"
              >
                <SkipForward size={14} />
                Skip for now
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="modal-content flex flex-col"
        style={{ maxHeight: 'calc(100vh - 48px)' }}
      >
        {/* ── Fixed header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-text">
            {editProject ? 'Edit Project' : 'New Project'}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text p-1 rounded-lg hover:bg-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Project type + mode toggles */}
        <div className="px-6 pt-4 pb-0 shrink-0 flex items-center gap-3 flex-wrap">
          {/* Freelance / Personal */}
          <div className="flex gap-1 p-1 bg-surface rounded-xl border border-border">
            {(['freelance', 'personal'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setProjectType(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  projectType === t
                    ? 'bg-white text-text shadow-sm border border-border'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {t === 'freelance' ? 'Freelance' : 'Personal'}
              </button>
            ))}
          </div>

          {/* Manual / GitHub — only for new projects */}
          {!editProject && (
            <div className="flex gap-1 p-1 bg-surface rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  mode === 'manual'
                    ? 'bg-white text-text shadow-sm border border-border'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setMode('github')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  mode === 'github'
                    ? 'bg-white text-text shadow-sm border border-border'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <Github size={13} />
                GitHub
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

          {/* GitHub URL field — shown only in github mode */}
          {mode === 'github' && (
            <div>
              <label className="label">GitHub Repository URL *</label>
              <div className="relative">
                <Github size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="input pl-9"
                  autoFocus
                />
              </div>
              {errors.githubUrl && <p className="text-danger text-xs mt-1">{errors.githubUrl}</p>}
            </div>
          )}

          <div className={isPersonal ? '' : 'grid grid-cols-2 gap-4'}>
            {!isPersonal && (
              <div>
                <label className="label">Client Name *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Acme Corp"
                  className="input"
                />
                {errors.clientName && <p className="text-danger text-xs mt-1">{errors.clientName}</p>}
              </div>
            )}
            <div>
              <label className="label">Project Name *</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={mode === 'github' ? 'Auto-filled from URL' : isPersonal ? 'My Side Project' : 'Website Redesign'}
                className="input"
              />
              {errors.projectName && (
                <p className="text-danger text-xs mt-1">{errors.projectName}</p>
              )}
            </div>
          </div>

          {!isPersonal && (
            <div>
              <label className="label">Middleman / Agency (Optional)</label>
              <input
                type="text"
                value={middleman}
                onChange={(e) => setMiddleman(e.target.value)}
                placeholder="Upwork, Toptal, etc."
                className="input"
              />
            </div>
          )}

          {!isPersonal && (
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="label">Project Cost *</label>
                <input
                  type="number"
                  value={projectCost}
                  onChange={(e) => setProjectCost(e.target.value)}
                  placeholder="5000"
                  min="0"
                  step="0.01"
                  className="input"
                />
                {errors.projectCost && (
                  <p className="text-danger text-xs mt-1">{errors.projectCost}</p>
                )}
              </div>
              <div>
                <label className="label">Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input">
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="label">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Project['status'])}
              className="input"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief project description..."
              rows={3}
              className="input resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="label">Tags</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tag and press Enter"
                className="input flex-1"
              />
              <button type="button" onClick={addTag} className="btn-secondary px-3 py-2 shrink-0">
                <Plus size={16} />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                  >
                    <Tag size={10} />
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="hover:text-danger ml-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {errors.root && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              <p className="text-danger text-sm">{errors.root}</p>
            </div>
          )}
        </div>

        {/* ── Fixed footer ── */}
        <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0 bg-white rounded-b-2xl">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button type="submit" disabled={isLoading} className="btn-primary flex-1 justify-center">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {mode === 'github' ? 'Creating...' : 'Saving...'}
              </span>
            ) : editProject ? 'Save Changes' : mode === 'github' ? 'Create & Clone' : 'Create Project'}
          </button>
        </div>
        </form>
      </motion.div>
    </div>
  )
}
