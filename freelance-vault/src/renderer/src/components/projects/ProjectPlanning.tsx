import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, CheckSquare, Square, ChevronDown, ChevronUp,
  Sparkles, Loader2, FileText, Calendar, AlertCircle,
  TrendingUp, Rocket, X, Paperclip, Edit2, Check, Clock
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAppStore } from '../../store/useAppStore'
import type { Requirement, ProjectTodo, Improvement, FutureTask } from '../../types'

type PlanningTab = 'requirements' | 'todos' | 'improvements' | 'future'

const PRIORITY_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  low:    { label: 'Low',    bg: 'bg-zinc-500/10',    text: 'text-zinc-400',    border: 'border-zinc-500/20' },
  medium: { label: 'Medium', bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
  high:   { label: 'High',   bg: 'bg-orange-500/10',  text: 'text-orange-400',  border: 'border-orange-500/20' },
  urgent: { label: 'Urgent', bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20' },
}

const TODO_CATEGORY_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  feature:     { label: 'Feature',     bg: 'bg-violet-500/10', text: 'text-violet-400' },
  bug:         { label: 'Bug',         bg: 'bg-red-500/10',    text: 'text-red-400' },
  improvement: { label: 'Improvement', bg: 'bg-cyan-500/10',   text: 'text-cyan-400' },
  task:        { label: 'Task',        bg: 'bg-zinc-500/10',   text: 'text-zinc-400' },
  research:    { label: 'Research',    bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
}

const IMP_TYPE_LABELS: Record<string, string> = {
  performance: 'Performance', ux: 'UX/Design', security: 'Security',
  feature: 'Feature', code_quality: 'Code Quality', documentation: 'Documentation', other: 'Other'
}

const IMP_STATUS_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  proposed:   { label: 'Proposed',    bg: 'bg-zinc-500/10',   text: 'text-zinc-400',   border: 'border-zinc-500/20' },
  accepted:   { label: 'Accepted',    bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20' },
  rejected:   { label: 'Rejected',    bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/20' },
  in_progress:{ label: 'In Progress', bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/20' },
  done:       { label: 'Done',        bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-emerald-500/20' },
}

const EFFORT_LABELS: Record<string, string> = { small: 'Small (< 1 day)', medium: 'Medium (1–3 days)', large: 'Large (3–7 days)', xl: 'XL (1+ week)' }

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

/* ───────────────────────────── Requirements Section ─────────────────────── */
function RequirementsSection({ projectId }: { projectId: string }) {
  const { db, addRequirement, updateRequirement, deleteRequirement } = useAppStore()
  const reqs = useMemo(
    () => (db.requirements || []).filter((r) => r.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date)),
    [db.requirements, projectId]
  )

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [rawContent, setRawContent] = useState('')
  const [source, setSource] = useState<'client' | 'internal' | 'meeting'>('client')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [formattingId, setFormattingId] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!title.trim() || !rawContent.trim()) return
    const now = new Date().toISOString()
    await addRequirement({ id: genId(), projectId, date, title: title.trim(), rawContent: rawContent.trim(), source, createdAt: now, updatedAt: now })
    setTitle(''); setDate(new Date().toISOString().split('T')[0]); setRawContent(''); setSource('client'); setShowForm(false)
  }

  const handleFormat = async (req: Requirement) => {
    setFormattingId(req.id); setAiError(null)
    try {
      const result = await window.electron.aiFormatRequirement({ text: req.rawContent, title: req.title })
      if (result.success && result.data) {
        await updateRequirement(req.id, { formattedContent: result.data })
      } else {
        setAiError(result.error || 'AI formatting failed')
      }
    } catch (err) {
      setAiError(String(err))
    }
    setFormattingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-text font-semibold">Client Requirements</h3>
          <p className="text-text-muted text-xs mt-0.5">Date-wise requirements from client or internal planning</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm py-1.5 px-3">
          <Plus size={14} /> Add Requirement
        </button>
      </div>

      {aiError && (
        <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm">
          <AlertCircle size={14} />
          {aiError}
          <button className="ml-auto" onClick={() => setAiError(null)}><X size={14} /></button>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="card p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Title *</label>
                  <input className="input" placeholder="e.g. User Authentication Flow" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <label className="label">Date *</label>
                  <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Source</label>
                <select className="input" value={source} onChange={(e) => setSource(e.target.value as 'client' | 'internal' | 'meeting')}>
                  <option value="client">Client</option>
                  <option value="meeting">Meeting</option>
                  <option value="internal">Internal</option>
                </select>
              </div>
              <div>
                <label className="label">Requirement Details *</label>
                <textarea className="input resize-none" rows={4} placeholder="Describe the requirement in your own words. AI can format it into a structured document." value={rawContent} onChange={(e) => setRawContent(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={handleAdd} className="btn-primary text-sm" disabled={!title.trim() || !rawContent.trim()}>Save Requirement</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {reqs.length === 0 && !showForm && (
        <div className="text-center py-12 text-text-muted">
          <FileText size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No requirements yet. Add the first one.</p>
        </div>
      )}

      <div className="space-y-3">
        {reqs.map((req) => {
          const isExpanded = expandedId === req.id
          const isFormatting = formattingId === req.id
          return (
            <div key={req.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-text font-medium text-sm">{req.title}</span>
                    <span className={`badge text-[10px] ${req.source === 'client' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : req.source === 'meeting' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'} border`}>
                      {req.source || 'client'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-text-muted text-xs">
                    <Calendar size={11} />
                    {format(parseISO(req.date), 'MMM d, yyyy')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleFormat(req)}
                    disabled={isFormatting}
                    className="btn-secondary text-xs py-1 px-2.5"
                    title="Format with AI"
                  >
                    {isFormatting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {isFormatting ? 'Formatting…' : 'AI Format'}
                  </button>
                  <button onClick={() => setExpandedId(isExpanded ? null : req.id)} className="btn-secondary text-xs py-1 px-2">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button onClick={() => deleteRequirement(req.id)} className="btn-danger text-xs py-1 px-2">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-3"
                  >
                    {req.formattedContent ? (
                      <div className="bg-surface border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles size={13} className="text-primary" />
                          <span className="text-primary text-xs font-medium">AI Formatted</span>
                        </div>
                        <div className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">{req.formattedContent}</div>
                      </div>
                    ) : (
                      <div className="bg-surface border border-border rounded-xl p-4">
                        <p className="text-text-muted text-xs mb-1">Raw Content</p>
                        <p className="text-text-secondary text-sm leading-relaxed">{req.rawContent}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ───────────────────────────── Todos Section ─────────────────────────────── */
function TodosSection({ projectId }: { projectId: string }) {
  const { db, addProjectTodo, updateProjectTodo, deleteProjectTodo } = useAppStore()
  const todos = useMemo(
    () => (db.projectTodos || []).filter((t) => t.projectId === projectId)
      .sort((a, b) => {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 }
        return (order[a.priority] ?? 2) - (order[b.priority] ?? 2)
      }),
    [db.projectTodos, projectId]
  )

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [category, setCategory] = useState<'feature' | 'bug' | 'improvement' | 'task' | 'research'>('task')
  const [dueDate, setDueDate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const handleAdd = async () => {
    if (!title.trim()) return
    const now = new Date().toISOString()
    await addProjectTodo({ id: genId(), projectId, title: title.trim(), description: description.trim() || undefined, completed: false, priority, category, dueDate: dueDate || undefined, createdAt: now, updatedAt: now })
    setTitle(''); setDescription(''); setPriority('medium'); setCategory('task'); setDueDate(''); setShowForm(false)
  }

  const toggleComplete = (todo: ProjectTodo) => updateProjectTodo(todo.id, { completed: !todo.completed })

  const startEdit = (todo: ProjectTodo) => { setEditingId(todo.id); setEditTitle(todo.title) }
  const saveEdit = async (id: string) => {
    if (editTitle.trim()) await updateProjectTodo(id, { title: editTitle.trim() })
    setEditingId(null)
  }

  const done = todos.filter((t) => t.completed)
  const pending = todos.filter((t) => !t.completed)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-text font-semibold">Todos</h3>
          <p className="text-text-muted text-xs mt-0.5">{pending.length} pending · {done.length} done</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm py-1.5 px-3">
          <Plus size={14} /> Add Todo
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card p-4 space-y-3">
              <input className="input" placeholder="Todo title *" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="input resize-none" rows={2} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                    {Object.entries(PRIORITY_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                    {Object.entries(TODO_CATEGORY_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={handleAdd} className="btn-primary text-sm" disabled={!title.trim()}>Add Todo</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {todos.length === 0 && !showForm && (
        <div className="text-center py-12 text-text-muted">
          <CheckSquare size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No todos yet. Break down your work into tasks.</p>
        </div>
      )}

      <div className="space-y-2">
        {pending.map((todo) => (
          <TodoItem key={todo.id} todo={todo} editingId={editingId} editTitle={editTitle} setEditTitle={setEditTitle} onToggle={toggleComplete} onStartEdit={startEdit} onSaveEdit={saveEdit} onCancel={() => setEditingId(null)} onDelete={(id) => deleteProjectTodo(id)} />
        ))}
      </div>

      {done.length > 0 && (
        <div>
          <p className="text-text-muted text-xs font-medium mb-2">Completed ({done.length})</p>
          <div className="space-y-2 opacity-60">
            {done.map((todo) => (
              <TodoItem key={todo.id} todo={todo} editingId={editingId} editTitle={editTitle} setEditTitle={setEditTitle} onToggle={toggleComplete} onStartEdit={startEdit} onSaveEdit={saveEdit} onCancel={() => setEditingId(null)} onDelete={(id) => deleteProjectTodo(id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TodoItem({ todo, editingId, editTitle, setEditTitle, onToggle, onStartEdit, onSaveEdit, onCancel, onDelete }: {
  todo: ProjectTodo
  editingId: string | null
  editTitle: string
  setEditTitle: (v: string) => void
  onToggle: (t: ProjectTodo) => void
  onStartEdit: (t: ProjectTodo) => void
  onSaveEdit: (id: string) => void
  onCancel: () => void
  onDelete: (id: string) => void
}) {
  const p = PRIORITY_STYLES[todo.priority]
  const c = todo.category ? TODO_CATEGORY_STYLES[todo.category] : null
  const isEditing = editingId === todo.id

  return (
    <div className="card p-3 flex items-start gap-3">
      <button onClick={() => onToggle(todo)} className="mt-0.5 shrink-0">
        {todo.completed
          ? <CheckSquare size={17} className="text-primary" />
          : <Square size={17} className="text-text-muted" />
        }
      </button>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            className="input py-1 text-sm w-full"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(todo.id); if (e.key === 'Escape') onCancel() }}
            autoFocus
          />
        ) : (
          <p className={`text-sm font-medium ${todo.completed ? 'line-through text-text-muted' : 'text-text'}`}>{todo.title}</p>
        )}
        {todo.description && !isEditing && <p className="text-text-muted text-xs mt-0.5">{todo.description}</p>}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className={`badge text-[10px] border ${p.bg} ${p.text} ${p.border}`}>{p.label}</span>
          {c && <span className={`badge text-[10px] ${c.bg} ${c.text}`}>{c.label}</span>}
          {todo.dueDate && (
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <Clock size={9} />
              {format(parseISO(todo.dueDate), 'MMM d')}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isEditing ? (
          <>
            <button onClick={() => onSaveEdit(todo.id)} className="p-1.5 rounded-lg hover:bg-surface text-success"><Check size={13} /></button>
            <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface text-text-muted"><X size={13} /></button>
          </>
        ) : (
          <button onClick={() => onStartEdit(todo)} className="p-1.5 rounded-lg hover:bg-surface text-text-muted"><Edit2 size={13} /></button>
        )}
        <button onClick={() => onDelete(todo.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

/* ───────────────────────────── Improvements Section ─────────────────────── */
function ImprovementsSection({ projectId }: { projectId: string }) {
  const { db, addImprovement, updateImprovement, deleteImprovement } = useAppStore()
  const items = useMemo(
    () => (db.improvements || []).filter((i) => i.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.improvements, projectId]
  )

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<Improvement['type']>('feature')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')

  const handleAdd = async () => {
    if (!title.trim()) return
    const now = new Date().toISOString()
    await addImprovement({ id: genId(), projectId, title: title.trim(), description: description.trim(), type, priority, status: 'proposed', createdAt: now, updatedAt: now })
    setTitle(''); setDescription(''); setType('feature'); setPriority('medium'); setShowForm(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-text font-semibold">Improvements</h3>
          <p className="text-text-muted text-xs mt-0.5">Suggested enhancements, optimizations, and ideas</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm py-1.5 px-3">
          <Plus size={14} /> Add Improvement
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card p-4 space-y-3">
              <input className="input" placeholder="Improvement title *" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="input resize-none" rows={3} placeholder="Describe the improvement in detail…" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                    {Object.entries(IMP_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                    {(['low', 'medium', 'high'] as const).map((p) => <option key={p} value={p}>{PRIORITY_STYLES[p].label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={handleAdd} className="btn-primary text-sm" disabled={!title.trim()}>Add Improvement</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {items.length === 0 && !showForm && (
        <div className="text-center py-12 text-text-muted">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No improvements yet. Track ideas for making the project better.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {items.map((imp) => {
          const s = IMP_STATUS_STYLES[imp.status]
          const p = PRIORITY_STYLES[imp.priority]
          return (
            <div key={imp.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-text font-medium text-sm">{imp.title}</p>
                  {imp.description && <p className="text-text-muted text-xs mt-1 leading-relaxed">{imp.description}</p>}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="badge text-[10px] bg-surface border border-border text-text-muted">{IMP_TYPE_LABELS[imp.type]}</span>
                    <span className={`badge text-[10px] border ${p.bg} ${p.text} ${p.border}`}>{p.label}</span>
                    <span className={`badge text-[10px] border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    className="text-xs bg-surface border border-border text-text-muted rounded-lg px-2 py-1 cursor-pointer"
                    value={imp.status}
                    onChange={(e) => updateImprovement(imp.id, { status: e.target.value as Improvement['status'] })}
                  >
                    {Object.entries(IMP_STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <button onClick={() => deleteImprovement(imp.id)} className="btn-danger text-xs py-1 px-2"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ───────────────────────────── Future Tasks Section ─────────────────────── */
function FutureTasksSection({ projectId }: { projectId: string }) {
  const { db, addFutureTask, updateFutureTask, deleteFutureTask } = useAppStore()
  const tasks = useMemo(
    () => (db.futureTasks || []).filter((t) => t.projectId === projectId).sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return (order[a.priority] ?? 1) - (order[b.priority] ?? 1)
    }),
    [db.futureTasks, projectId]
  )

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [effort, setEffort] = useState<'small' | 'medium' | 'large' | 'xl'>('medium')
  const [phase, setPhase] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')

  const handleAdd = async () => {
    if (!title.trim()) return
    const now = new Date().toISOString()
    await addFutureTask({ id: genId(), projectId, title: title.trim(), description: description.trim() || undefined, estimatedEffort: effort, phase: phase.trim() || undefined, priority, createdAt: now, updatedAt: now })
    setTitle(''); setDescription(''); setEffort('medium'); setPhase(''); setPriority('medium'); setShowForm(false)
  }

  const groupedByPhase = useMemo(() => {
    const groups: Record<string, FutureTask[]> = {}
    tasks.forEach((t) => {
      const key = t.phase || 'Unassigned'
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    return groups
  }, [tasks])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-text font-semibold">Future Tasks</h3>
          <p className="text-text-muted text-xs mt-0.5">Planned work for future phases or sprints</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary text-sm py-1.5 px-3">
          <Plus size={14} /> Add Future Task
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card p-4 space-y-3">
              <input className="input" placeholder="Task title *" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="input resize-none" rows={2} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                    {(['low', 'medium', 'high'] as const).map((p) => <option key={p} value={p}>{PRIORITY_STYLES[p].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Estimated Effort</label>
                  <select className="input" value={effort} onChange={(e) => setEffort(e.target.value as typeof effort)}>
                    {Object.entries(EFFORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Phase / Sprint</label>
                  <input className="input" placeholder="e.g. v2.0, Phase 2" value={phase} onChange={(e) => setPhase(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={handleAdd} className="btn-primary text-sm" disabled={!title.trim()}>Add Task</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tasks.length === 0 && !showForm && (
        <div className="text-center py-12 text-text-muted">
          <Rocket size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No future tasks yet. Plan ahead for upcoming work.</p>
        </div>
      )}

      {Object.entries(groupedByPhase).map(([phase, phaseTasks]) => (
        <div key={phase}>
          <p className="text-text-muted text-xs font-medium uppercase tracking-wider mb-2">{phase}</p>
          <div className="space-y-2">
            {phaseTasks.map((task) => {
              const p = PRIORITY_STYLES[task.priority]
              return (
                <div key={task.id} className="card p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-text text-sm font-medium">{task.title}</p>
                    {task.description && <p className="text-text-muted text-xs mt-0.5">{task.description}</p>}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`badge text-[10px] border ${p.bg} ${p.text} ${p.border}`}>{p.label}</span>
                      {task.estimatedEffort && (
                        <span className="badge text-[10px] bg-surface border border-border text-text-muted">{EFFORT_LABELS[task.estimatedEffort]}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteFutureTask(task.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger shrink-0"><Trash2 size={13} /></button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────────── Main Component ────────────────────────────── */
export default function ProjectPlanning({ projectId }: { projectId: string }): JSX.Element {
  const [activeTab, setActiveTab] = useState<PlanningTab>('requirements')
  const { db } = useAppStore()

  const counts = useMemo(() => ({
    requirements: (db.requirements || []).filter((r) => r.projectId === projectId).length,
    todos: (db.projectTodos || []).filter((t) => t.projectId === projectId && !t.completed).length,
    improvements: (db.improvements || []).filter((i) => i.projectId === projectId).length,
    future: (db.futureTasks || []).filter((t) => t.projectId === projectId).length,
  }), [db, projectId])

  const tabs: { key: PlanningTab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'requirements', label: 'Requirements', icon: <FileText size={14} />, count: counts.requirements },
    { key: 'todos',        label: 'Todos',         icon: <CheckSquare size={14} />, count: counts.todos },
    { key: 'improvements', label: 'Improvements',  icon: <TrendingUp size={14} />, count: counts.improvements },
    { key: 'future',       label: 'Future Tasks',  icon: <Rocket size={14} />, count: counts.future },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              activeTab === tab.key
                ? 'bg-card text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key ? 'bg-primary/20 text-primary' : 'bg-border text-text-muted'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Attachments hint */}
      <div className="flex items-center gap-2 p-3 bg-surface border border-border rounded-xl text-text-muted text-xs">
        <Paperclip size={13} className="shrink-0" />
        <span>To attach documents, use the <strong className="text-text">Files</strong> tab and upload to the <strong className="text-text">docs</strong> folder. Reference them by name in requirement details.</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
        >
          {activeTab === 'requirements' && <RequirementsSection projectId={projectId} />}
          {activeTab === 'todos'        && <TodosSection projectId={projectId} />}
          {activeTab === 'improvements' && <ImprovementsSection projectId={projectId} />}
          {activeTab === 'future'       && <FutureTasksSection projectId={projectId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
