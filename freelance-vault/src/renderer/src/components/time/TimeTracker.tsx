import { useState, useMemo } from 'react'
import { Plus, Trash2, Clock, Calendar, Edit2, Check, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAppStore } from '../../store/useAppStore'
import type { TimeEntry } from '../../types'

function generateId(): string {
  return `te_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

interface EditState {
  description: string
  hours: string
  minutes: string
  date: string
}

export default function TimeTracker({ projectId }: { projectId: string }): JSX.Element {
  const { db, addTimeEntry, updateTimeEntry, deleteTimeEntry } = useAppStore()

  const entries = useMemo(
    () =>
      (db.timeEntries || [])
        .filter((e) => e.projectId === projectId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db.timeEntries, projectId]
  )

  const totalMinutes = useMemo(() => entries.reduce((s, e) => s + e.durationMinutes, 0), [entries])

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<EditState>({
    description: '',
    hours: '0',
    minutes: '30',
    date: new Date().toISOString().slice(0, 10)
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditState | null>(null)

  const totalMins = (h: string, m: string) =>
    (parseInt(h) || 0) * 60 + (parseInt(m) || 0)

  const handleAdd = async () => {
    const duration = totalMins(form.hours, form.minutes)
    if (!form.description.trim() || duration <= 0) return
    const entry: TimeEntry = {
      id: generateId(),
      projectId,
      description: form.description.trim(),
      durationMinutes: duration,
      date: form.date,
      createdAt: new Date().toISOString()
    }
    await addTimeEntry(entry)
    setForm({ description: '', hours: '0', minutes: '30', date: new Date().toISOString().slice(0, 10) })
    setShowAdd(false)
  }

  const startEdit = (entry: TimeEntry) => {
    setEditId(entry.id)
    setEditForm({
      description: entry.description,
      hours: String(Math.floor(entry.durationMinutes / 60)),
      minutes: String(entry.durationMinutes % 60),
      date: entry.date
    })
  }

  const saveEdit = async () => {
    if (!editId || !editForm) return
    const duration = totalMins(editForm.hours, editForm.minutes)
    if (!editForm.description.trim() || duration <= 0) return
    await updateTimeEntry(editId, {
      description: editForm.description.trim(),
      durationMinutes: duration,
      date: editForm.date
    })
    setEditId(null)
    setEditForm(null)
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-accent" />
            <span className="text-text font-semibold">Time Tracking</span>
          </div>
          {entries.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium border border-accent/20">
              {formatDuration(totalMinutes)} total
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="btn-primary text-sm py-1.5 px-3"
        >
          <Plus size={14} />
          Log Time
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <p className="text-text-muted text-xs font-medium uppercase tracking-wider">New Entry</p>
          <input
            className="input w-full"
            placeholder="What did you work on?"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <div className="flex gap-3">
            <div className="flex items-center gap-2 flex-1">
              <label className="label text-xs shrink-0">Duration</label>
              <input
                type="number"
                min="0"
                className="input w-16 text-center"
                value={form.hours}
                onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                placeholder="0"
              />
              <span className="text-text-muted text-sm">h</span>
              <input
                type="number"
                min="0"
                max="59"
                className="input w-16 text-center"
                value={form.minutes}
                onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))}
                placeholder="30"
              />
              <span className="text-text-muted text-sm">m</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-text-muted" />
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-sm py-1.5 px-3">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={!form.description.trim() || totalMins(form.hours, form.minutes) <= 0}
              className="btn-primary text-sm py-1.5 px-3 disabled:opacity-40"
            >
              Save Entry
            </button>
          </div>
        </div>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Clock size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No time logged yet.</p>
          <p className="text-xs mt-1 opacity-60">Click "Log Time" to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) =>
            editId === entry.id && editForm ? (
              <div key={entry.id} className="bg-surface border border-primary/30 rounded-xl p-3 space-y-2">
                <input
                  className="input w-full text-sm"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => f ? { ...f, description: e.target.value } : f)}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    className="input w-14 text-center text-sm"
                    value={editForm.hours}
                    onChange={(e) => setEditForm((f) => f ? { ...f, hours: e.target.value } : f)}
                  />
                  <span className="text-text-muted text-xs">h</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    className="input w-14 text-center text-sm"
                    value={editForm.minutes}
                    onChange={(e) => setEditForm((f) => f ? { ...f, minutes: e.target.value } : f)}
                  />
                  <span className="text-text-muted text-xs">m</span>
                  <input
                    type="date"
                    className="input text-sm"
                    value={editForm.date}
                    onChange={(e) => setEditForm((f) => f ? { ...f, date: e.target.value } : f)}
                  />
                  <button onClick={saveEdit} className="btn-primary py-1 px-2"><Check size={13} /></button>
                  <button onClick={() => { setEditId(null); setEditForm(null) }} className="btn-secondary py-1 px-2"><X size={13} /></button>
                </div>
              </div>
            ) : (
              <div
                key={entry.id}
                className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 group hover:border-border/80"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-text text-sm font-medium truncate">{entry.description}</p>
                  <p className="text-text-muted text-xs mt-0.5">
                    {format(parseISO(entry.date), 'MMM d, yyyy')}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-xs font-semibold border border-accent/20 shrink-0">
                  {formatDuration(entry.durationMinutes)}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => startEdit(entry)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-border transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => deleteTimeEntry(entry.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
