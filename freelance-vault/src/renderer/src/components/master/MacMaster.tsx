import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, RefreshCw, Trash2, FolderOpen, ChevronDown, ChevronRight,
  Loader2, AlertTriangle, X, CheckCircle, Lock, Zap,
  Download, FileText, Film, Music2, Image, Cloud, Mail,
  Database, Package, Terminal, ScrollText, Monitor, Code2,
  LayoutDashboard, HardDrive,
} from 'lucide-react'

interface SubItem { name: string; path: string; size: number; canDelete: boolean }
interface Bucket {
  id: string; name: string; color: string; size: number
  status: string; note: string; mainPath: string; subItems: SubItem[]
}
interface Breakdown { diskTotal: number; diskFree: number; systemSize: number; buckets: Bucket[] }

function formatBytes(b: number): string {
  if (!b) return '0 B'
  const k = 1024, s = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`
}
function pct(part: number, total: number): number {
  return total ? Math.max(0.4, (part / total) * 100) : 0
}

const BUCKET_ICONS: Record<string, JSX.Element> = {
  applications: <Monitor size={18} />,
  downloads:    <Download size={18} />,
  documents:    <FileText size={18} />,
  desktop:      <LayoutDashboard size={18} />,
  movies:       <Film size={18} />,
  music:        <Music2 size={18} />,
  pictures:     <Image size={18} />,
  icloud:       <Cloud size={18} />,
  mail:         <Mail size={18} />,
  'app-support':<Database size={18} />,
  caches:       <Cpu size={18} />,
  developer:    <Code2 size={18} />,
  'pkg-caches': <Package size={18} />,
  logs:         <ScrollText size={18} />,
  trash:        <Trash2 size={18} />,
  system:       <HardDrive size={18} />,
}

const STATUS_CONFIG = {
  cleanable:    { label: 'Safe to clean', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  'user-files': { label: 'Your files',    bg: 'bg-sky-500/10',     text: 'text-sky-400',     border: 'border-sky-500/20',     dot: 'bg-sky-400'     },
  system:       { label: 'Protected',     bg: 'bg-zinc-500/10',    text: 'text-zinc-400',    border: 'border-zinc-500/20',    dot: 'bg-zinc-500'    },
}

function ConfirmModal({ title, message, onConfirm, onCancel, loading }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; loading: boolean
}): JSX.Element {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 8 }}
        transition={{ duration: 0.15 }}
        className="card p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-danger/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <div>
            <h3 className="font-bold text-text text-base">{title}</h3>
            <p className="text-text-muted text-sm mt-1.5 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2.5 justify-end">
          <button onClick={onCancel} className="btn-secondary px-5" disabled={loading}>Cancel</button>
          <button onClick={onConfirm} className="btn-danger flex items-center gap-2 px-5" disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function MacMaster(): JSX.Element {
  const [data, setData] = useState<Breakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [hoveredSeg, setHoveredSeg] = useState<string | null>(null)

  const toast$ = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true); setDeleted(new Set()); setExpanded(new Set())
    const r = await window.electron.masterGetBreakdown()
    setLoading(false)
    if (r.success) setData({ diskTotal: r.diskTotal, diskFree: r.diskFree, systemSize: r.systemSize, buckets: r.buckets as Bucket[] })
    else toast$(r.error || 'Scan failed', false)
  }, [])

  useEffect(() => { load() }, [load])

  const doDelete = (name: string, path: string, size: number, msg?: string) => {
    setConfirm({
      title: `Delete "${name}"?`,
      message: msg || `This will permanently delete ${formatBytes(size)} from "${name}". Caches rebuild automatically.`,
      action: async () => {
        const r = await window.electron.scannerClearCache(path)
        if (r.success) {
          setDeleted(p => new Set(p).add(path))
          const fresh = await window.electron.masterGetBreakdown()
          if (fresh.success) setData({ diskTotal: fresh.diskTotal, diskFree: fresh.diskFree, systemSize: fresh.systemSize, buckets: fresh.buckets as Bucket[] })
          toast$(`Freed ${formatBytes(size)} — "${name}" deleted`)
        } else toast$(r.error || 'Delete failed', false)
      }
    })
  }

  const runConfirm = async () => {
    if (!confirm) return
    setDeleting(true); await confirm.action(); setDeleting(false); setConfirm(null)
  }

  const diskUsed = data ? data.diskTotal - data.diskFree : 0
  const usedPct = data ? Math.round((diskUsed / data.diskTotal) * 100) : 0
  const cleanable = data ? data.buckets.filter(b => b.status === 'cleanable').reduce((s, b) => s + b.size, 0) : 0
  const measured  = data ? data.buckets.reduce((s, b) => s + b.size, 0) : 0

  const barSegs = data ? [
    ...data.buckets.map(b => ({ id: b.id, label: b.name, color: b.color, size: b.size })),
    { id: '_sys',  label: 'System & Other', color: '#374151', size: data.systemSize },
    { id: '_free', label: 'Free',           color: '#0f172a',  size: data.diskFree  },
  ].filter(s => s.size > 0) : []

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#7c3aed22,#06b6d422)' }}>
              <Cpu size={21} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight">Mac Master</h1>
              <p className="text-xs text-text-muted mt-0.5">Complete storage breakdown & cleanup</p>
            </div>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border bg-card text-text-muted hover:text-text transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : ''} />
            {loading ? 'Scanning…' : 'Rescan'}
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#7c3aed15,#06b6d415)' }}>
                <Loader2 size={32} className="animate-spin text-primary" />
              </div>
            </div>
            <p className="text-text font-bold text-lg">Scanning your Mac…</p>
            <p className="text-text-muted text-sm mt-2 max-w-xs">Calculating sizes for all storage categories.<br/>This takes about 30 seconds.</p>
          </div>
        ) : data ? (
          <>
            {/* ── Summary Stats ── */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Storage', value: formatBytes(data.diskTotal), sub: 'Macintosh HD', color: 'text-text', icon: <HardDrive size={16} className="text-text-muted" /> },
                { label: 'Used Space',    value: formatBytes(diskUsed),        sub: `${usedPct}% of disk`, color: usedPct > 85 ? 'text-danger' : usedPct > 65 ? 'text-warning' : 'text-text', icon: <Terminal size={16} className="text-text-muted" /> },
                { label: 'Cleanable',     value: formatBytes(cleanable),       sub: 'Safe to delete now', color: 'text-emerald-400', icon: <Zap size={16} className="text-emerald-400" /> },
              ].map(stat => (
                <div key={stat.label} className="card p-4 flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center flex-shrink-0">
                    {stat.icon}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-lg font-bold leading-tight ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-text-muted mt-0.5">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Storage Bar ── */}
            <div className="card p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-text">Storage Breakdown</p>
                <p className="text-xs text-text-muted">{formatBytes(data.diskFree)} free of {formatBytes(data.diskTotal)}</p>
              </div>

              {/* Stacked bar */}
              <div className="w-full h-7 rounded-xl overflow-hidden flex bg-surface/50 shadow-inner mb-4 relative">
                {barSegs.map(seg => (
                  <motion.div
                    key={seg.id}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct(seg.size, data.diskTotal)}%` }}
                    transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
                    style={{ backgroundColor: seg.color }}
                    onMouseEnter={() => setHoveredSeg(seg.id)}
                    onMouseLeave={() => setHoveredSeg(null)}
                    className="h-full relative transition-all cursor-default"
                    title={`${seg.label}: ${formatBytes(seg.size)}`}
                  >
                    {hoveredSeg === seg.id && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none">
                        <div className="bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-text whitespace-nowrap shadow-lg">
                          {seg.label}: {formatBytes(seg.size)}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Legend chips */}
              <div className="flex flex-wrap gap-2">
                {barSegs.filter(s => s.id !== '_free').map(seg => (
                  <div key={seg.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-text-muted bg-surface"
                    style={{ borderLeft: `2px solid ${seg.color}` }}>
                    <span>{seg.label}</span>
                    <span className="font-medium text-text opacity-70">{formatBytes(seg.size)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Category Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {data.buckets.map((bucket, i) => {
                const sc = STATUS_CONFIG[bucket.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.system
                const isExp = expanded.has(bucket.id)
                const icon = BUCKET_ICONS[bucket.id] || <HardDrive size={18} />
                const allGone = bucket.subItems.length > 0 && bucket.subItems.every(s => deleted.has(s.path))
                const mainDeleted = deleted.has(bucket.mainPath)
                const effectiveSize = mainDeleted || allGone ? 0 : bucket.size
                const bucketPct = pct(effectiveSize, data.diskTotal)

                return (
                  <motion.div
                    key={bucket.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    className="rounded-2xl overflow-hidden border border-border bg-card"
                  >
                    {/* Top colour strip */}
                    <div className="h-1 w-full" style={{ backgroundColor: bucket.color }} />

                    <div className="p-4">
                      {/* Header row */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${bucket.color}18` }}>
                          <span style={{ color: bucket.color }}>{icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text leading-tight">{bucket.name}</p>
                          <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium border ${sc.bg} ${sc.text} ${sc.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-base font-bold leading-tight ${
                            mainDeleted || allGone ? 'text-text-muted line-through' :
                            effectiveSize > 10 * 1024 ** 3 ? 'text-danger' :
                            effectiveSize > 2  * 1024 ** 3 ? 'text-warning' : 'text-text'
                          }`}>
                            {formatBytes(effectiveSize)}
                          </p>
                          <p className="text-xs text-text-muted">{bucketPct.toFixed(1)}%</p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 rounded-full bg-surface mb-3 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, bucketPct)}%` }}
                          transition={{ duration: 0.8, delay: i * 0.03 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: mainDeleted || allGone ? '#374151' : bucket.color }}
                        />
                      </div>

                      {/* Note */}
                      <p className="text-xs text-text-muted leading-relaxed mb-4">{bucket.note}</p>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {(mainDeleted || allGone) ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                            <CheckCircle size={13} /> Cleaned up
                          </div>
                        ) : (
                          <>
                            {bucket.status === 'user-files' && (
                              <button onClick={() => window.electron.folderOpen(bucket.mainPath)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-text-muted hover:text-text hover:border-primary/30 transition-all">
                                <FolderOpen size={11} /> Open in Finder
                              </button>
                            )}
                            {bucket.status === 'cleanable' && bucket.subItems.length === 0 && (
                              <button onClick={() => doDelete(bucket.name, bucket.mainPath, bucket.size)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-all">
                                <Trash2 size={11} /> Delete All
                              </button>
                            )}
                            {bucket.status === 'system' && (
                              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                <Lock size={11} /> Cannot be deleted
                              </div>
                            )}
                            {bucket.subItems.length > 0 && (
                              <button
                                onClick={() => setExpanded(p => { const n = new Set(p); n.has(bucket.id) ? n.delete(bucket.id) : n.add(bucket.id); return n })}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  isExp
                                    ? 'bg-primary/10 border border-primary/20 text-primary'
                                    : 'bg-surface border border-border text-text-muted hover:text-text hover:border-primary/30'
                                }`}>
                                {isExp ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                {isExp ? 'Hide' : 'View Items'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Sub-items */}
                    <AnimatePresence>
                      {isExp && bucket.subItems.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border bg-surface/30">
                            {bucket.subItems.map(sub => {
                              const isDone = deleted.has(sub.path)
                              return (
                                <div key={sub.path}
                                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 transition-opacity ${isDone ? 'opacity-40' : ''}`}>
                                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: bucket.color }} />
                                  <p className={`text-xs flex-1 truncate ${isDone ? 'line-through text-text-muted' : 'text-text'}`}>{sub.name}</p>
                                  <span className="text-xs text-text-muted font-mono w-16 text-right flex-shrink-0">{formatBytes(sub.size)}</span>
                                  {isDone ? (
                                    <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                                  ) : sub.canDelete ? (
                                    <button
                                      onClick={() => doDelete(sub.name, sub.path, sub.size)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-all flex-shrink-0">
                                      <Trash2 size={9} /> Delete
                                    </button>
                                  ) : (
                                    <Lock size={12} className="text-text-muted flex-shrink-0" />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}

              {/* System hidden card */}
              {data.systemSize > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: data.buckets.length * 0.03 }}
                  className="rounded-2xl overflow-hidden border border-border bg-card"
                >
                  <div className="h-1 w-full bg-zinc-600" />
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-500/10 flex items-center justify-center flex-shrink-0">
                        <HardDrive size={18} className="text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text">System & Other</p>
                        <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                          Protected
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-text">{formatBytes(data.systemSize)}</p>
                        <p className="text-xs text-text-muted">{pct(data.systemSize, data.diskTotal).toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface mb-3 overflow-hidden">
                      <div className="h-full rounded-full bg-zinc-600"
                        style={{ width: `${Math.min(100, pct(data.systemSize, data.diskTotal))}%` }} />
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mb-4">
                      macOS system files, hidden caches, virtual memory, and unmeasured data. Cannot be deleted.
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Lock size={11} /> Cannot be deleted
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Unmeasured note */}
            {measured > 0 && (
              <p className="text-center text-xs text-text-muted mt-6 opacity-60">
                Measured {formatBytes(measured)} across {data.buckets.length} categories &nbsp;·&nbsp; Some hidden system files may not appear above
              </p>
            )}
          </>
        ) : null}
      </div>

      <AnimatePresence>
        {confirm && (
          <ConfirmModal title={confirm.title} message={confirm.message}
            onConfirm={runConfirm} onCancel={() => !deleting && setConfirm(null)} loading={deleting} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium z-50 ${
              toast.ok ? 'bg-emerald-500 text-white' : 'bg-danger text-white'
            }`}
          >
            {toast.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            {toast.msg}
            <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
