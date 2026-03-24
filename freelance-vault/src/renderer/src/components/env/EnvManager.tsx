import { useState, useMemo } from 'react'
import { Plus, Trash2, Eye, EyeOff, Copy, Edit2, Check, X, Lock, FileCode2, LayoutList, Upload, AlertCircle, Settings2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { EnvVar, EnvProfile } from '../../types'

const DEFAULT_ENVIRONMENTS = ['Development', 'QA', 'Demo', 'Production']

function generateId(): string {
  return `env_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function parseEnvFile(raw: string): { key: string; value: string; group?: string }[] {
  const result: { key: string; value: string; group?: string }[] = []
  let currentGroup: string | undefined = undefined

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#!')) continue

    if (trimmed.startsWith('# [') && trimmed.endsWith(']')) {
      currentGroup = trimmed.slice(3, -1).trim()
      continue
    }
    if (trimmed.startsWith('#')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue

    const key = trimmed.slice(0, eqIdx).trim().toUpperCase()
    let value = trimmed.slice(eqIdx + 1).trim()

    if (!key) continue

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    result.push({ key, value, group: currentGroup })
  }

  return result
}

export default function EnvManager({ projectId }: { projectId: string }): JSX.Element {
  const { db, addEnvVar, updateEnvVar, deleteEnvVar, addEnvProfile, deleteEnvProfile } = useAppStore()

  const vars = useMemo(
    () => (db.envVars || []).filter((e) => e.projectId === projectId),
    [db.envVars, projectId]
  )

  const customProfiles = useMemo(
    () => (db.envProfiles || []).filter((p) => p.projectId === projectId),
    [db.envProfiles, projectId]
  )

  // All available environments: defaults + custom
  const allEnvironments = useMemo(() => {
    const customNames = customProfiles.map((p) => p.name)
    return [...DEFAULT_ENVIRONMENTS, ...customNames]
  }, [customProfiles])

  const [activeEnv, setActiveEnv] = useState('Development')

  const groups = useMemo(() => {
    const set = new Set<string>()
    vars.filter((v) => (v.environment || 'Development') === activeEnv)
      .forEach((v) => set.add(v.group || 'General'))
    return Array.from(set).sort()
  }, [vars, activeEnv])

  const [viewMode, setViewMode] = useState<'list' | 'dev'>('list')

  // List view state
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ key: '', value: '', group: '' })
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ key: string; value: string; group: string } | null>(null)
  const [filterGroup, setFilterGroup] = useState<string>('All')

  // Add custom environment
  const [showAddEnv, setShowAddEnv] = useState(false)
  const [newEnvName, setNewEnvName] = useState('')

  // Dev view state
  const [devPaste, setDevPaste] = useState('')
  const [devParsed, setDevParsed] = useState<{ key: string; value: string; group?: string }[] | null>(null)
  const [devImporting, setDevImporting] = useState(false)
  const [devImported, setDevImported] = useState(false)

  const filteredByEnv = vars.filter((v) => (v.environment || 'Development') === activeEnv)
  const filtered = filterGroup === 'All' ? filteredByEnv : filteredByEnv.filter((v) => (v.group || 'General') === filterGroup)

  const handleAdd = async () => {
    if (!form.key.trim() || !form.value.trim()) return
    const envVar: EnvVar = {
      id: generateId(),
      projectId,
      key: form.key.trim().toUpperCase(),
      value: form.value.trim(),
      group: form.group.trim() || undefined,
      environment: activeEnv,
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
    setCopied('all')
    setTimeout(() => setCopied(null), 1500)
  }

  const handleAddEnv = async () => {
    const name = newEnvName.trim()
    if (!name || allEnvironments.includes(name)) return
    const profile: EnvProfile = {
      id: generateId(),
      projectId,
      name,
      createdAt: new Date().toISOString()
    }
    await addEnvProfile(profile)
    setActiveEnv(name)
    setNewEnvName('')
    setShowAddEnv(false)
  }

  const handleDeleteEnv = async (name: string) => {
    // Delete all vars in this env
    const toDelete = vars.filter((v) => (v.environment || 'Development') === name)
    for (const v of toDelete) await deleteEnvVar(v.id)
    // Delete the profile if custom
    const profile = customProfiles.find((p) => p.name === name)
    if (profile) await deleteEnvProfile(profile.id)
    if (activeEnv === name) setActiveEnv('Development')
  }

  // Dev view handlers
  const handleDevParse = () => {
    const parsed = parseEnvFile(devPaste)
    setDevParsed(parsed)
    setDevImported(false)
  }

  const handleDevImport = async () => {
    if (!devParsed || devParsed.length === 0) return
    setDevImporting(true)
    const existingKeys = new Set(filteredByEnv.map((v) => v.key))
    for (const item of devParsed) {
      if (existingKeys.has(item.key)) {
        const existing = filteredByEnv.find((v) => v.key === item.key)
        if (existing) await updateEnvVar(existing.id, { value: item.value, group: item.group })
      } else {
        await addEnvVar({
          id: generateId(),
          projectId,
          key: item.key,
          value: item.value,
          group: item.group,
          environment: activeEnv,
          createdAt: new Date().toISOString()
        })
      }
    }
    setDevImporting(false)
    setDevImported(true)
    setDevPaste('')
    setDevParsed(null)
    setTimeout(() => {
      setViewMode('list')
      setDevImported(false)
    }, 1200)
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
          {filteredByEnv.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-medium border border-warning/20">
              {filteredByEnv.length} vars
            </span>
          )}
        </div>

        <div className="flex gap-2 items-center">
          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => { setViewMode('list'); setDevParsed(null); setDevPaste('') }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'list' ? 'bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              <LayoutList size={12} />
              Variables
            </button>
            <button
              onClick={() => setViewMode('dev')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'dev' ? 'bg-card text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
            >
              <FileCode2 size={12} />
              Paste .env
            </button>
          </div>

          {viewMode === 'list' && filteredByEnv.length > 0 && (
            <button onClick={copyAll} className="btn-secondary text-sm py-1.5 px-3">
              {copied === 'all' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              Copy .env
            </button>
          )}
          {viewMode === 'list' && (
            <button onClick={() => setShowAdd((v) => !v)} className="btn-primary text-sm py-1.5 px-3">
              <Plus size={14} />
              Add Variable
            </button>
          )}
        </div>
      </div>

      {/* Environment Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {allEnvironments.map((env) => {
          const count = vars.filter((v) => (v.environment || 'Development') === env).length
          const isCustom = !DEFAULT_ENVIRONMENTS.includes(env)
          return (
            <div key={env} className="relative group/tab">
              <button
                onClick={() => { setActiveEnv(env); setFilterGroup('All') }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  activeEnv === env
                    ? 'bg-warning/15 text-warning border-warning/30'
                    : 'bg-surface text-text-muted border-border hover:border-border/60 hover:text-text'
                }`}
              >
                {env}
                {count > 0 && (
                  <span className={`text-[10px] px-1 rounded-full font-bold ${activeEnv === env ? 'bg-warning/20' : 'bg-border'}`}>
                    {count}
                  </span>
                )}
              </button>
              {isCustom && (
                <button
                  onClick={() => handleDeleteEnv(env)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger text-white flex items-center justify-center opacity-0 group-hover/tab:opacity-100 transition-opacity"
                  title={`Delete ${env} environment`}
                >
                  <X size={8} />
                </button>
              )}
            </div>
          )
        })}

        {/* Add custom environment */}
        {showAddEnv ? (
          <div className="flex items-center gap-1">
            <input
              className="input text-xs py-1 px-2 w-32 h-[30px]"
              placeholder="env name"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddEnv(); if (e.key === 'Escape') { setShowAddEnv(false); setNewEnvName('') } }}
              autoFocus
            />
            <button onClick={handleAddEnv} disabled={!newEnvName.trim()} className="btn-primary text-xs py-1 px-2 h-[30px] disabled:opacity-40">
              <Check size={11} />
            </button>
            <button onClick={() => { setShowAddEnv(false); setNewEnvName('') }} className="btn-secondary text-xs py-1 px-2 h-[30px]">
              <X size={11} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddEnv(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-muted border border-dashed border-border hover:border-warning/40 hover:text-warning transition-colors"
          >
            <Plus size={11} />
            Add Env
          </button>
        )}
      </div>

      {/* ── DEVELOPER PASTE VIEW ── */}
      {viewMode === 'dev' && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileCode2 size={14} className="text-warning" />
              <p className="text-text text-sm font-medium">Paste .env file → <span className="text-warning font-semibold">{activeEnv}</span></p>
            </div>
            <p className="text-text-muted text-xs">
              Variables will be imported into the <strong>{activeEnv}</strong> environment.
            </p>
            <textarea
              className="input w-full font-mono text-sm resize-none"
              style={{ minHeight: 200, whiteSpace: 'pre' }}
              placeholder={`DATABASE_URL=postgresql://localhost:5432/mydb\nAPI_KEY=sk-abc123\nNODE_ENV=development`}
              value={devPaste}
              onChange={(e) => { setDevPaste(e.target.value); setDevParsed(null); setDevImported(false) }}
              spellCheck={false}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleDevParse}
                disabled={!devPaste.trim()}
                className="btn-secondary text-sm py-1.5 px-4 disabled:opacity-40"
              >
                Preview
              </button>
            </div>
          </div>

          {devParsed !== null && (
            <div className="space-y-3">
              {devParsed.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20">
                  <AlertCircle size={14} className="text-warning shrink-0" />
                  <p className="text-warning text-sm">No valid KEY=VALUE pairs found.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-text-muted text-xs font-medium uppercase tracking-wider">
                      Preview — {devParsed.length} variable{devParsed.length !== 1 ? 's' : ''} → <span className="text-warning">{activeEnv}</span>
                    </p>
                    {devImported ? (
                      <span className="flex items-center gap-1.5 text-success text-sm font-medium">
                        <Check size={14} />
                        Imported!
                      </span>
                    ) : (
                      <button
                        onClick={handleDevImport}
                        disabled={devImporting}
                        className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
                      >
                        <Upload size={14} />
                        {devImporting ? 'Importing…' : `Import ${devParsed.length} vars`}
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-surface border-b border-border">
                          <th className="text-left px-4 py-2 text-text-muted text-xs font-medium uppercase tracking-wider">Key</th>
                          <th className="text-left px-4 py-2 text-text-muted text-xs font-medium uppercase tracking-wider">Value</th>
                          <th className="text-left px-4 py-2 text-text-muted text-xs font-medium uppercase tracking-wider">Group</th>
                          <th className="text-left px-4 py-2 text-text-muted text-xs font-medium uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {devParsed.map((item, i) => {
                          const isUpdate = filteredByEnv.some((v) => v.key === item.key)
                          return (
                            <tr key={i} className="bg-card hover:bg-surface transition-colors">
                              <td className="px-4 py-2.5 font-mono text-text font-semibold text-xs">{item.key}</td>
                              <td className="px-4 py-2.5 font-mono text-text-muted text-xs max-w-[200px] truncate">
                                {item.value.length > 40 ? `${item.value.slice(0, 40)}…` : item.value}
                              </td>
                              <td className="px-4 py-2.5">
                                {item.group ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 font-medium">
                                    {item.group}
                                  </span>
                                ) : (
                                  <span className="text-text-muted text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  isUpdate
                                    ? 'bg-warning/10 text-warning border border-warning/20'
                                    : 'bg-success/10 text-success border border-success/20'
                                }`}>
                                  {isUpdate ? 'update' : 'new'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <>
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
              <div className="flex items-center gap-2">
                <p className="text-text-muted text-xs font-medium uppercase tracking-wider">New Variable</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">{activeEnv}</span>
              </div>
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
              <Settings2 size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No variables in <strong>{activeEnv}</strong> yet.</p>
              <p className="text-xs mt-1 opacity-60">Store API keys, config values, and secrets here.</p>
              <div className="flex gap-2 justify-center mt-4">
                <button
                  onClick={() => setViewMode('dev')}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  <FileCode2 size={12} />
                  Paste .env file
                </button>
                <button
                  onClick={() => setShowAdd(true)}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  <Plus size={12} />
                  Add manually
                </button>
              </div>
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
        </>
      )}
    </div>
  )
}
