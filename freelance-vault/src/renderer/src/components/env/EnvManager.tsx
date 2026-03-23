import { useState, useMemo } from 'react'
import { Plus, Trash2, Eye, EyeOff, Copy, Edit2, Check, X, Lock } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { EnvVar } from '../../types'

function generateId(): string {
  return `env_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export default function EnvManager({ projectId }: { projectId: string }): JSX.Element {
  const { db, addEnvVar, updateEnvVar, deleteEnvVar } = useAppStore()

  const vars = useMemo(
    () => (db.envVars || []).filter((e) => e.projectId === projectId),
    [db.envVars, projectId]
  )

  const groups = useMemo(() => {
    const set = new Set<string>()
    vars.forEach((v) => set.add(v.group || 'General'))
    return Array.from(set).sort()
  }, [vars])

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ key: '', value: '', group: '' })
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ key: string; value: string; group: string } | null>(null)
  const [filterGroup, setFilterGroup] = useState<string>('All')

  const filtered = filterGroup === 'All' ? vars : vars.filter((v) => (v.group || 'General') === filterGroup)

  const handleAdd = async () => {
    if (!form.key.trim() || !form.value.trim()) return
    const envVar: EnvVar = {
      id: generateId(),
      projectId,
      key: form.key.trim().toUpperCase(),
      value: form.value.trim(),
      group: form.group.trim() || undefined,
      createdAt: new Date().toISOString()
    }
    await addEnvVar(envVar)
    setForm({ key: '', value: '', group: '' })
    setShowAdd(false)
  }

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyValue = (id: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const startEdit = (v: EnvVar) => {
    setEditId(v.id)
    setEditForm({ key: v.key, value: v.value, group: v.group || '' })
  }

  const saveEdit = async () => {
    if (!editId || !editForm) return
    if (!editForm.key.trim() || !editForm.value.trim()) return
    await updateEnvVar(editId, {
      key: editForm.key.trim().toUpperCase(),
      value: editForm.value.trim(),
      group: editForm.group.trim() || undefined
    })
    setEditId(null)
    setEditForm(null)
  }

  const copyAll = () => {
    const text = filtered.map((v) => `${v.key}=${v.value}`).join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-warning" />
            <span className="text-text font-semibold">Environment Variables</span>
          </div>
          {vars.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-medium border border-warning/20">
              {vars.length} vars
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {vars.length > 0 && (
            <button onClick={copyAll} className="btn-secondary text-sm py-1.5 px-3">
              <Copy size={14} />
              Copy .env
            </button>
          )}
          <button onClick={() => setShowAdd((v) => !v)} className="btn-primary text-sm py-1.5 px-3">
            <Plus size={14} />
            Add Variable
          </button>
        </div>
      </div>

      {/* Group filter */}
      {groups.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {['All', ...groups].map((g) => (
            <button
              key={g}
              onClick={() => setFilterGroup(g)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterGroup === g
                  ? 'bg-warning/20 text-warning border border-warning/30'
                  : 'bg-surface text-text-muted border border-border hover:border-border/60'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <p className="text-text-muted text-xs font-medium uppercase tracking-wider">New Variable</p>
          <div className="flex gap-3">
            <input
              className="input flex-1 font-mono text-sm"
              placeholder="KEY_NAME"
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toUpperCase() }))}
              autoFocus
            />
            <input
              className="input flex-[2] font-mono text-sm"
              placeholder="value"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <input
              className="input w-32 text-sm"
              placeholder="Group (opt)"
              value={form.group}
              onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-sm py-1.5 px-3">Cancel</button>
            <button
              onClick={handleAdd}
              disabled={!form.key.trim() || !form.value.trim()}
              className="btn-primary text-sm py-1.5 px-3 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Variables list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Lock size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No environment variables yet.</p>
          <p className="text-xs mt-1 opacity-60">Store API keys, config values, and secrets here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) =>
            editId === v.id && editForm ? (
              <div key={v.id} className="bg-surface border border-primary/30 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    className="input flex-1 font-mono text-sm"
                    value={editForm.key}
                    onChange={(e) => setEditForm((f) => f ? { ...f, key: e.target.value.toUpperCase() } : f)}
                  />
                  <input
                    className="input flex-[2] font-mono text-sm"
                    value={editForm.value}
                    onChange={(e) => setEditForm((f) => f ? { ...f, value: e.target.value } : f)}
                  />
                  <input
                    className="input w-28 text-sm"
                    placeholder="Group"
                    value={editForm.group}
                    onChange={(e) => setEditForm((f) => f ? { ...f, group: e.target.value } : f)}
                  />
                  <button onClick={saveEdit} className="btn-primary py-1 px-2"><Check size={13} /></button>
                  <button onClick={() => { setEditId(null); setEditForm(null) }} className="btn-secondary py-1 px-2"><X size={13} /></button>
                </div>
              </div>
            ) : (
              <div
                key={v.id}
                className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 group hover:border-border/80"
              >
                {v.group && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 font-medium shrink-0">
                    {v.group}
                  </span>
                )}
                <span className="font-mono text-text text-sm font-semibold min-w-[140px] shrink-0">{v.key}</span>
                <span className="font-mono text-text-muted text-sm flex-1 truncate">
                  {revealed.has(v.id) ? v.value : '••••••••'}
                </span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleReveal(v.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-border transition-colors"
                    title={revealed.has(v.id) ? 'Hide' : 'Show'}
                  >
                    {revealed.has(v.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    onClick={() => copyValue(v.id, v.value)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-border transition-colors"
                    title="Copy value"
                  >
                    {copied === v.id ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  </button>
                  <button
                    onClick={() => startEdit(v)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-border transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => deleteEnvVar(v.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
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
