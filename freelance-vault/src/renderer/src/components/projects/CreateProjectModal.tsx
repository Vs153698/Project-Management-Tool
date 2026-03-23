import { useState, KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, Tag } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { Project } from '../../types'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'SGD', 'AED', 'CHF']
const STATUSES: { value: Project['status']; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' }
]

interface Props {
  onClose: () => void
  editProject?: Project
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function CreateProjectModal({ onClose, editProject }: Props): JSX.Element {
  const { addProject, updateProject, displayCurrency } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)

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
    if (!clientName.trim()) e.clientName = 'Client name is required'
    if (!projectName.trim()) e.projectName = 'Project name is required'
    if (!projectCost || isNaN(Number(projectCost)) || Number(projectCost) < 0) {
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
          clientName: clientName.trim(),
          projectName: projectName.trim(),
          middleman: middleman.trim() || undefined,
          projectCost: Number(projectCost),
          currency,
          status,
          description: description.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          deadline: deadline || undefined,
          tags
        })
      } else {
        const now = new Date().toISOString()
        const project: Project = {
          id: generateId(),
          clientName: clientName.trim(),
          projectName: projectName.trim(),
          middleman: middleman.trim() || undefined,
          projectCost: Number(projectCost),
          currency,
          status,
          description: description.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          deadline: deadline || undefined,
          tags,
          createdAt: now,
          updatedAt: now
        }
        await addProject(project)
      }
      onClose()
    } catch (err) {
      setErrors({ root: String(err) })
    }
    setIsLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="modal-content"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="label">Project Name *</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Website Redesign"
                className="input"
              />
              {errors.projectName && (
                <p className="text-danger text-xs mt-1">{errors.projectName}</p>
              )}
            </div>
          </div>

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
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Project['status'])}
              className="input"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
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
              <button
                type="button"
                onClick={addTag}
                className="btn-secondary px-3 py-2 shrink-0"
              >
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

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1 justify-center">
              {isLoading
                ? 'Saving...'
                : editProject
                  ? 'Save Changes'
                  : 'Create Project'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
