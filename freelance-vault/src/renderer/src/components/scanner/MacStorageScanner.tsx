import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HardDrive,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckSquare,
  Square,
  Folder,
  FileText,
  Loader2,
  X,
  ChevronRight,
  ChevronDown,
  Layers,
  Package,
  Code2,
  FolderOpen,
  Zap,
} from 'lucide-react'

interface ScannedFile {
  name: string
  path: string
  size: number
  modifiedAt: string
}

interface CacheItem {
  name: string
  path: string
  size: number
  description: string
}

interface ProjectInfo {
  name: string
  path: string
  size: number
  language: string
  framework: string
  modifiedAt: string
}

interface ProjectEntry {
  name: string
  path: string
  size: number
  isDir: boolean
  isCleanable: boolean
}

interface StorageInfo {
  total: number
  used: number
  free: number
}

type SizeTab = 'large' | 'medium' | 'small'
type ActiveTab = SizeTab | 'caches' | 'projects'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function shortenPath(fullPath: string): string {
  const home = fullPath.match(/^\/Users\/[^/]+/)
  if (home) return '~' + fullPath.slice(home[0].length)
  return fullPath
}

const LANG_COLORS: Record<string, { bg: string; text: string }> = {
  'TypeScript':   { bg: 'bg-blue-500/15',   text: 'text-blue-400'   },
  'JavaScript':   { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  'Python':       { bg: 'bg-green-500/15',  text: 'text-green-400'  },
  'Rust':         { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  'Go':           { bg: 'bg-cyan-500/15',   text: 'text-cyan-400'   },
  'Dart':         { bg: 'bg-sky-500/15',    text: 'text-sky-400'    },
  'Java':         { bg: 'bg-red-500/15',    text: 'text-red-400'    },
  'Java/Kotlin':  { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  'Ruby':         { bg: 'bg-rose-500/15',   text: 'text-rose-400'   },
  'PHP':          { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },
  'C/C++':        { bg: 'bg-gray-500/15',   text: 'text-gray-400'   },
}
const langColor = (lang: string) => LANG_COLORS[lang] || { bg: 'bg-surface', text: 'text-text-muted' }

function FileIcon({ name }: { name: string }): JSX.Element {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'm4v', 'wmv']
  const archiveExts = ['zip', 'tar', 'gz', 'rar', '7z', 'dmg', 'pkg']
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
  if (videoExts.includes(ext)) return <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center"><FileText size={15} className="text-purple-400" /></div>
  if (archiveExts.includes(ext)) return <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center"><Package size={15} className="text-amber-400" /></div>
  if (docExts.includes(ext)) return <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center"><FileText size={15} className="text-blue-400" /></div>
  return <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center"><FileText size={15} className="text-text-muted" /></div>
}

interface ConfirmModalProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function ConfirmModal({ title, message, onConfirm, onCancel, loading }: ConfirmModalProps): JSX.Element {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="card p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-danger" />
          </div>
          <div>
            <h3 className="font-semibold text-text text-base">{title}</h3>
            <p className="text-text-muted text-sm mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-danger flex items-center gap-2" disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function MacStorageScanner(): JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>('large')
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [storageLoading, setStorageLoading] = useState(true)
  const [files, setFiles] = useState<Record<SizeTab, ScannedFile[]>>({ large: [], medium: [], small: [] })
  const [scanned, setScanned] = useState<Record<SizeTab, boolean>>({ large: false, medium: false, small: false })
  const [scanning, setScanning] = useState<SizeTab | null>(null)
  const [caches, setCaches] = useState<CacheItem[]>([])
  const [cachesLoaded, setCachesLoaded] = useState(false)
  const [cachesLoading, setCachesLoading] = useState(false)
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [projectsLoaded, setProjectsLoaded] = useState(false)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [projectContents, setProjectContents] = useState<Record<string, ProjectEntry[]>>({})
  const [loadingContents, setLoadingContents] = useState<string | null>(null)
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    message: string
    action: () => Promise<void>
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const loadStorage = useCallback(async () => {
    setStorageLoading(true)
    const res = await window.electron.scannerGetStorageInfo()
    setStorageLoading(false)
    if (res.success) setStorageInfo({ total: res.total, used: res.used, free: res.free })
  }, [])

  const scanFiles = useCallback(async (filter: SizeTab) => {
    setScanning(filter)
    setSelectedFiles(new Set())
    const res = await window.electron.scannerScanFiles(filter)
    setScanning(null)
    setScanned(prev => ({ ...prev, [filter]: true }))
    if (res.success) {
      const sorted = [...(res.files as ScannedFile[])].sort((a, b) => b.size - a.size)
      setFiles(prev => ({ ...prev, [filter]: sorted }))
    } else {
      showToast(res.error || 'Scan failed', 'error')
    }
  }, [showToast])

  const loadCaches = useCallback(async () => {
    setCachesLoading(true)
    const res = await window.electron.scannerGetCaches()
    setCachesLoading(false)
    setCachesLoaded(true)
    if (res.success) {
      const sorted = [...(res.caches as CacheItem[])].sort((a, b) => b.size - a.size)
      setCaches(sorted)
    } else {
      showToast(res.error || 'Failed to load caches', 'error')
    }
  }, [showToast])

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true)
    setExpandedProject(null)
    setProjectContents({})
    setSelectedProjects(new Set())
    const res = await window.electron.scannerGetProjects()
    setProjectsLoading(false)
    setProjectsLoaded(true)
    if (res.success) {
      setProjects(res.projects as ProjectInfo[])
    } else {
      showToast(res.error || 'Failed to scan projects', 'error')
    }
  }, [showToast])

  const toggleExpand = useCallback(async (projectPath: string) => {
    if (expandedProject === projectPath) {
      setExpandedProject(null)
      return
    }
    setExpandedProject(projectPath)
    if (projectContents[projectPath]) return // already loaded
    setLoadingContents(projectPath)
    const res = await window.electron.scannerGetProjectContents(projectPath)
    setLoadingContents(null)
    if (res.success) {
      setProjectContents(prev => ({ ...prev, [projectPath]: res.entries as ProjectEntry[] }))
    } else {
      showToast(res.error || 'Failed to read project contents', 'error')
    }
  }, [expandedProject, projectContents, showToast])

  const handleDeleteProjectEntry = useCallback((entry: ProjectEntry, projectPath: string) => {
    setConfirmModal({
      title: `Delete "${entry.name}"?`,
      message: `This will permanently delete ${formatBytes(entry.size)} of ${entry.isDir ? 'folder' : 'file'} data. ${entry.isCleanable ? 'This can be regenerated by reinstalling dependencies or rebuilding.' : 'This cannot be undone.'}`,
      action: async () => {
        const res = await window.electron.scannerClearCache(entry.path)
        if (res.success) {
          setProjectContents(prev => ({
            ...prev,
            [projectPath]: (prev[projectPath] || []).filter(e => e.path !== entry.path)
          }))
          // Update project size
          setProjects(prev => prev.map(p =>
            p.path === projectPath ? { ...p, size: Math.max(0, p.size - entry.size) } : p
          ))
          await loadStorage()
          showToast(`Deleted "${entry.name}" — freed ${formatBytes(entry.size)}`)
        } else {
          showToast(res.error || 'Failed to delete', 'error')
        }
      }
    })
  }, [loadStorage, showToast])

  useEffect(() => {
    loadStorage()
    scanFiles('large')
  }, [])

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab)
    setSelectedFiles(new Set())
    if (tab === 'caches' && !cachesLoaded) {
      loadCaches()
    } else if (tab === 'projects' && !projectsLoaded) {
      loadProjects()
    } else if (tab !== 'caches' && tab !== 'projects' && !scanned[tab as SizeTab]) {
      scanFiles(tab as SizeTab)
    }
  }

  const currentFiles = activeTab !== 'caches' ? files[activeTab as SizeTab] : []

  const toggleFile = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedFiles.size === currentFiles.length && currentFiles.length > 0) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(currentFiles.map(f => f.path)))
    }
  }

  const handleDeleteSelected = () => {
    if (selectedFiles.size === 0) return
    const totalSize = currentFiles.filter(f => selectedFiles.has(f.path)).reduce((s, f) => s + f.size, 0)
    setConfirmModal({
      title: `Delete ${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''}?`,
      message: `You are about to permanently delete ${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''} (${formatBytes(totalSize)}). This cannot be undone.`,
      action: async () => {
        const paths = [...selectedFiles]
        const res = await window.electron.scannerDeleteFiles(paths)
        const succeeded = res.results.filter(r => r.success).map(r => r.path)
        const failed = res.results.filter(r => !r.success).length
        if (succeeded.length > 0) {
          const deletedSet = new Set(succeeded)
          setFiles(prev => ({ ...prev, [activeTab]: prev[activeTab as SizeTab].filter(f => !deletedSet.has(f.path)) }))
          setSelectedFiles(new Set())
          await loadStorage()
        }
        if (failed > 0) {
          showToast(`Deleted ${succeeded.length} file(s). ${failed} failed.`, 'error')
        } else {
          showToast(`Deleted ${succeeded.length} file(s), freed ${formatBytes(totalSize)}`)
        }
      }
    })
  }

  const handleClearCache = (cache: CacheItem) => {
    setConfirmModal({
      title: `Clear ${cache.name}?`,
      message: `This will delete ${formatBytes(cache.size)} of cached data from "${cache.description}". The cache will rebuild automatically when needed.`,
      action: async () => {
        const res = await window.electron.scannerClearCache(cache.path)
        if (res.success) {
          setCaches(prev => prev.filter(c => c.path !== cache.path))
          await loadStorage()
          showToast(`Cleared ${cache.name} — freed ${formatBytes(cache.size)}`)
        } else {
          showToast(res.error || 'Failed to clear cache', 'error')
        }
      }
    })
  }

  const runConfirm = async () => {
    if (!confirmModal) return
    setDeleting(true)
    await confirmModal.action()
    setDeleting(false)
    setConfirmModal(null)
  }

  const usedPct = storageInfo ? Math.round((storageInfo.used / storageInfo.total) * 100) : 0

  const tabs: { id: ActiveTab; label: string; icon: JSX.Element; sublabel: string }[] = [
    { id: 'large',    label: 'Large Files',  icon: <HardDrive size={14} />, sublabel: '> 100 MB'         },
    { id: 'medium',   label: 'Medium Files', icon: <FileText size={14} />,  sublabel: '10 – 100 MB'      },
    { id: 'small',    label: 'Small Files',  icon: <Layers size={14} />,    sublabel: '1 – 10 MB'        },
    { id: 'caches',   label: 'Caches',       icon: <Folder size={14} />,    sublabel: 'Dev & app caches' },
    { id: 'projects', label: 'Projects',     icon: <Code2 size={14} />,     sublabel: 'Code projects'    },
  ]

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-text">Mac Cleaner</h1>
            <p className="text-text-muted text-sm mt-0.5">Scan and remove large files, caches & junk from your Mac</p>
          </div>
          <button
            onClick={() => {
            loadStorage()
            if (activeTab === 'caches') loadCaches()
            else if (activeTab === 'projects') loadProjects()
            else scanFiles(activeTab as SizeTab)
          }}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} />
            Rescan
          </button>
        </div>

        {/* Storage overview */}
        <div className="card p-4 mb-4">
          {storageLoading ? (
            <div className="flex items-center gap-3 text-text-muted text-sm">
              <Loader2 size={16} className="animate-spin" />
              Loading storage info…
            </div>
          ) : storageInfo ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive size={16} className="text-primary" />
                  <span className="text-sm font-semibold text-text">Macintosh HD</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-text-muted">
                    <span className="text-text font-medium">{formatBytes(storageInfo.used)}</span> used
                  </span>
                  <span className="text-text-muted">
                    <span className="text-success font-medium">{formatBytes(storageInfo.free)}</span> free
                  </span>
                  <span className="text-text-muted">
                    {formatBytes(storageInfo.total)} total
                  </span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usedPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${usedPct > 85 ? 'bg-danger' : usedPct > 65 ? 'bg-warning' : 'bg-primary'}`}
                />
              </div>
              <p className="text-text-muted text-xs mt-1.5">{usedPct}% used</p>
            </div>
          ) : (
            <p className="text-text-muted text-sm">Unable to load storage info</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-card text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="text-xs opacity-60 hidden lg:inline">({tab.sublabel})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {activeTab !== 'caches' && activeTab !== 'projects' ? (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* File list toolbar */}
              <div className="px-6 py-2 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  {scanning === activeTab ? (
                    <div className="flex items-center gap-2 text-text-muted text-sm">
                      <Loader2 size={14} className="animate-spin text-primary" />
                      Scanning your Mac…
                    </div>
                  ) : (
                    <span className="text-text-muted text-sm">
                      {currentFiles.length} file{currentFiles.length !== 1 ? 's' : ''} found
                      {currentFiles.length > 0 && (
                        <span className="ml-1">
                          — {formatBytes(currentFiles.reduce((s, f) => s + f.size, 0))} total
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {currentFiles.length > 0 && scanning !== activeTab && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleAll}
                      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
                    >
                      {selectedFiles.size === currentFiles.length ? (
                        <CheckSquare size={13} className="text-primary" />
                      ) : (
                        <Square size={13} />
                      )}
                      {selectedFiles.size === currentFiles.length ? 'Deselect all' : 'Select all'}
                    </button>
                    {selectedFiles.size > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        className="btn-danger flex items-center gap-1.5 text-xs py-1.5 px-3"
                      >
                        <Trash2 size={12} />
                        Delete {selectedFiles.size} selected
                        {' '}({formatBytes(currentFiles.filter(f => selectedFiles.has(f.path)).reduce((s, f) => s + f.size, 0))})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* File list */}
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {scanning === activeTab ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <Loader2 size={24} className="animate-spin text-primary" />
                    </div>
                    <p className="text-text font-medium">Scanning your Mac…</p>
                    <p className="text-text-muted text-sm mt-1">This may take up to 30 seconds</p>
                  </div>
                ) : currentFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
                      <HardDrive size={24} className="text-success" />
                    </div>
                    <p className="text-text font-medium">No files found</p>
                    <p className="text-text-muted text-sm mt-1">
                      {scanned[activeTab as SizeTab]
                        ? 'No files in this size range were found in your home directory.'
                        : 'Click Rescan to search for files.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {currentFiles.map((file) => {
                      const isSelected = selectedFiles.has(file.path)
                      return (
                        <motion.div
                          key={file.path}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-primary/8 border-primary/30'
                              : 'bg-card border-transparent hover:border-border hover:bg-surface'
                          }`}
                          onClick={() => toggleFile(file.path)}
                        >
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare size={16} className="text-primary" />
                            ) : (
                              <Square size={16} className="text-text-muted" />
                            )}
                          </div>
                          <FileIcon name={file.name} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text truncate">{file.name}</p>
                            <p className="text-xs text-text-muted truncate mt-0.5">{shortenPath(file.path)}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-semibold ${
                              file.size > 1024 * 1024 * 1024 ? 'text-danger' :
                              file.size > 500 * 1024 * 1024 ? 'text-warning' : 'text-text'
                            }`}>
                              {formatBytes(file.size)}
                            </p>
                            <p className="text-xs text-text-muted mt-0.5">{formatDate(file.modifiedAt)}</p>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === 'caches' ? (
            <motion.div
              key="caches"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* Caches toolbar */}
              <div className="px-6 py-2 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  {cachesLoading ? (
                    <div className="flex items-center gap-2 text-text-muted text-sm">
                      <Loader2 size={14} className="animate-spin text-primary" />
                      Calculating cache sizes…
                    </div>
                  ) : (
                    <span className="text-text-muted text-sm">
                      {caches.length} cache location{caches.length !== 1 ? 's' : ''} found
                      {caches.length > 0 && (
                        <span className="ml-1">
                          — {formatBytes(caches.reduce((s, c) => s + c.size, 0))} total
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <button
                  onClick={loadCaches}
                  className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
                  disabled={cachesLoading}
                >
                  <RefreshCw size={12} className={cachesLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {/* Cache list */}
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {cachesLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <Loader2 size={24} className="animate-spin text-primary" />
                    </div>
                    <p className="text-text font-medium">Calculating cache sizes…</p>
                    <p className="text-text-muted text-sm mt-1">Checking developer tools, app caches, and more</p>
                  </div>
                ) : caches.length === 0 && cachesLoaded ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
                      <Folder size={24} className="text-success" />
                    </div>
                    <p className="text-text font-medium">No caches found</p>
                    <p className="text-text-muted text-sm mt-1">Your Mac looks clean!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {caches.map((cache) => (
                      <motion.div
                        key={cache.path}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-card border border-border hover:border-primary/20 transition-all"
                      >
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                          <Folder size={18} className="text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text">{cache.name}</p>
                          <p className="text-xs text-text-muted mt-0.5">{cache.description}</p>
                          <p className="text-xs text-text-muted/60 mt-0.5 truncate">{shortenPath(cache.path)}</p>
                        </div>
                        <div className="text-right flex-shrink-0 mr-2">
                          <p className={`text-base font-bold ${
                            cache.size > 5 * 1024 * 1024 * 1024 ? 'text-danger' :
                            cache.size > 1024 * 1024 * 1024 ? 'text-warning' : 'text-text'
                          }`}>
                            {formatBytes(cache.size)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleClearCache(cache)}
                          className="btn-danger flex items-center gap-1.5 text-xs py-1.5 px-3 flex-shrink-0"
                        >
                          <Trash2 size={12} />
                          Clear
                        </button>
                      </motion.div>
                    ))}

                    {caches.length > 0 && (
                      <div className="mt-4 p-4 rounded-xl bg-warning/5 border border-warning/20 flex items-start gap-3">
                        <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-text-muted leading-relaxed">
                          Clearing caches is safe — they rebuild automatically as you use your apps. Xcode Derived Data and iOS Simulators can take a long time to rebuild.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === 'projects' ? (
            <motion.div
              key="projects"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* Projects toolbar */}
              <div className="px-6 py-2 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  {projectsLoading ? (
                    <div className="flex items-center gap-2 text-text-muted text-sm">
                      <Loader2 size={14} className="animate-spin text-primary" />
                      Scanning for code projects…
                    </div>
                  ) : (
                    <span className="text-text-muted text-sm">
                      {projects.length} project{projects.length !== 1 ? 's' : ''} found
                      {projects.length > 0 && (
                        <span className="ml-1">— {formatBytes(projects.reduce((s, p) => s + p.size, 0))} total</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {projects.length > 0 && !projectsLoading && (
                    <>
                      <button
                        onClick={() => {
                          if (selectedProjects.size === projects.length) {
                            setSelectedProjects(new Set())
                          } else {
                            setSelectedProjects(new Set(projects.map(p => p.path)))
                          }
                        }}
                        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
                      >
                        {selectedProjects.size === projects.length ? (
                          <CheckSquare size={13} className="text-primary" />
                        ) : (
                          <Square size={13} />
                        )}
                        {selectedProjects.size === projects.length ? 'Deselect all' : 'Select all'}
                      </button>
                      {selectedProjects.size > 0 && (
                        <button
                          onClick={() => {
                            const selected = projects.filter(p => selectedProjects.has(p.path))
                            const totalSize = selected.reduce((s, p) => s + p.size, 0)
                            setConfirmModal({
                              title: `Delete ${selectedProjects.size} project${selectedProjects.size > 1 ? 's' : ''}?`,
                              message: `This will permanently delete ${selectedProjects.size} project folder${selectedProjects.size > 1 ? 's' : ''} (${formatBytes(totalSize)}). This cannot be undone.`,
                              action: async () => {
                                const paths = [...selectedProjects]
                                for (const path of paths) {
                                  await window.electron.scannerClearCache(path)
                                }
                                setProjects(prev => prev.filter(p => !selectedProjects.has(p.path)))
                                setSelectedProjects(new Set())
                                setExpandedProject(null)
                                await loadStorage()
                                showToast(`Deleted ${paths.length} project${paths.length > 1 ? 's' : ''} — freed ${formatBytes(totalSize)}`)
                              }
                            })
                          }}
                          className="btn-danger flex items-center gap-1.5 text-xs py-1.5 px-3"
                        >
                          <Trash2 size={12} />
                          Delete {selectedProjects.size} selected
                          {' '}({formatBytes(projects.filter(p => selectedProjects.has(p.path)).reduce((s, p) => s + p.size, 0))})
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={loadProjects}
                    className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
                    disabled={projectsLoading}
                  >
                    <RefreshCw size={12} className={projectsLoading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Projects list */}
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {projectsLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <Loader2 size={24} className="animate-spin text-primary" />
                    </div>
                    <p className="text-text font-medium">Scanning for code projects…</p>
                    <p className="text-text-muted text-sm mt-1">Walking your home directory for project folders</p>
                  </div>
                ) : projects.length === 0 && projectsLoaded ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
                      <Code2 size={24} className="text-success" />
                    </div>
                    <p className="text-text font-medium">No projects found</p>
                    <p className="text-text-muted text-sm mt-1">No code projects detected in your home directory.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.map((project) => {
                      const lc = langColor(project.language)
                      const isExpanded = expandedProject === project.path
                      const contents = projectContents[project.path] || []
                      const isLoadingThis = loadingContents === project.path
                      const cleanableSize = contents.filter(e => e.isCleanable).reduce((s, e) => s + e.size, 0)

                      return (
                        <motion.div
                          key={project.path}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`rounded-xl border transition-all ${
                            selectedProjects.has(project.path) ? 'border-primary/40 bg-primary/5' :
                            isExpanded ? 'border-primary/30 bg-card' : 'border-border bg-card hover:border-primary/20'
                          }`}
                        >
                          {/* Project header row */}
                          <div className="flex items-center gap-4 px-4 py-3.5">
                            {/* Checkbox */}
                            <button
                              onClick={() => setSelectedProjects(prev => {
                                const next = new Set(prev)
                                next.has(project.path) ? next.delete(project.path) : next.add(project.path)
                                return next
                              })}
                              className="flex-shrink-0"
                            >
                              {selectedProjects.has(project.path) ? (
                                <CheckSquare size={16} className="text-primary" />
                              ) : (
                                <Square size={16} className="text-text-muted hover:text-text transition-colors" />
                              )}
                            </button>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${lc.bg}`}>
                              <Code2 size={18} className={lc.text} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-text">{project.name}</p>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lc.bg} ${lc.text}`}>
                                  {project.framework}
                                </span>
                                {cleanableSize > 0 && (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                                    {formatBytes(cleanableSize)} cleanable
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text-muted mt-0.5 truncate">{shortenPath(project.path)}</p>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className={`text-sm font-bold ${
                                project.size > 5 * 1024 * 1024 * 1024 ? 'text-danger' :
                                project.size > 1024 * 1024 * 1024 ? 'text-warning' : 'text-text'
                              }`}>{formatBytes(project.size)}</p>
                              <p className={`text-xs mt-0.5 ${lc.text}`}>{project.language}</p>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => window.electron.folderOpen(project.path)}
                                className="btn-secondary flex items-center gap-1 text-xs py-1.5 px-2.5"
                                title="Open in Finder"
                              >
                                <FolderOpen size={12} />
                              </button>
                              <button
                                onClick={() => toggleExpand(project.path)}
                                className={`flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg font-medium transition-colors ${
                                  isExpanded ? 'bg-primary/10 text-primary' : 'btn-secondary'
                                }`}
                              >
                                {isLoadingThis ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : isExpanded ? (
                                  <ChevronDown size={12} />
                                ) : (
                                  <ChevronRight size={12} />
                                )}
                                {isExpanded ? 'Hide' : 'View Files'}
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmModal({
                                    title: `Delete "${project.name}"?`,
                                    message: `This will permanently delete the entire project folder (${formatBytes(project.size)}) at ${shortenPath(project.path)}. This cannot be undone.`,
                                    action: async () => {
                                      const res = await window.electron.scannerClearCache(project.path)
                                      if (res.success) {
                                        setProjects(prev => prev.filter(p => p.path !== project.path))
                                        if (expandedProject === project.path) setExpandedProject(null)
                                        await loadStorage()
                                        showToast(`Deleted "${project.name}" — freed ${formatBytes(project.size)}`)
                                      } else {
                                        showToast(res.error || 'Failed to delete project', 'error')
                                      }
                                    }
                                  })
                                }}
                                className="btn-danger flex items-center gap-1.5 text-xs py-1.5 px-3"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </div>
                          </div>

                          {/* Expanded contents */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-border mx-4 mb-3" />
                                {isLoadingThis ? (
                                  <div className="flex items-center gap-2 px-4 pb-4 text-text-muted text-sm">
                                    <Loader2 size={14} className="animate-spin text-primary" />
                                    Reading project contents…
                                  </div>
                                ) : contents.length === 0 ? (
                                  <p className="px-4 pb-4 text-sm text-text-muted">No entries found.</p>
                                ) : (
                                  <div className="px-4 pb-4 space-y-1">
                                    {contents.map(entry => (
                                      <div
                                        key={entry.path}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                                          entry.isCleanable ? 'bg-warning/5 border border-warning/15' : 'bg-surface'
                                        }`}
                                      >
                                        <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                                          entry.isCleanable ? 'bg-warning/15' : entry.isDir ? 'bg-surface' : 'bg-surface'
                                        }`}>
                                          {entry.isCleanable ? (
                                            <Zap size={11} className="text-warning" />
                                          ) : entry.isDir ? (
                                            <Folder size={11} className="text-text-muted" />
                                          ) : (
                                            <FileText size={11} className="text-text-muted" />
                                          )}
                                        </div>
                                        <span className={`text-xs flex-1 font-mono truncate ${
                                          entry.isCleanable ? 'text-warning' : 'text-text-muted'
                                        }`}>
                                          {entry.name}{entry.isDir ? '/' : ''}
                                        </span>
                                        <span className="text-xs text-text-muted flex-shrink-0 w-20 text-right">
                                          {formatBytes(entry.size)}
                                        </span>
                                        {entry.isDir && (
                                          <button
                                            onClick={() => handleDeleteProjectEntry(entry, project.path)}
                                            className="btn-danger flex items-center gap-1 text-xs py-1 px-2 flex-shrink-0"
                                          >
                                            <Trash2 size={10} />
                                            Delete
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmModal && (
          <ConfirmModal
            title={confirmModal.title}
            message={confirmModal.message}
            onConfirm={runConfirm}
            onCancel={() => !deleting && setConfirmModal(null)}
            loading={deleting}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium z-50 ${
              toast.type === 'error' ? 'bg-danger text-white' : 'bg-success text-white'
            }`}
          >
            {toast.type === 'error' ? <AlertTriangle size={15} /> : <ChevronRight size={15} />}
            {toast.message}
            <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
