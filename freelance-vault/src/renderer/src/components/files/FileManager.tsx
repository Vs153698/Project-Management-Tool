import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FolderInput,
  File,
  FileText,
  Image,
  FileCode,
  FileArchive,
  ExternalLink,
  Trash2,
  FolderOpen,
  RefreshCw,
  Code2,
  Zap,
  Folder,
  Github,
  X,
  Check,
  AlertCircle,
  GitPullRequest
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { FileInfo } from '../../types'
import CodeGeneratorModal from '../projects/CodeGeneratorModal'
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal'

function getFileIcon(name: string): React.ComponentType<{ size?: number; className?: string }> {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return Image
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'html', 'json', 'yaml', 'yml', 'toml', 'sh'].includes(ext)) return FileCode
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return FileText
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return FileArchive
  return File
}

function formatSize(bytes: number | undefined): string {
  if (bytes == null || isNaN(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function extractRepoName(url: string): string {
  return url.trim().replace(/\.git$/, '').split('/').pop() || ''
}

interface FileRowProps {
  file: FileInfo
  onOpen: () => void
  onDelete: () => void
}

function FileRow({ file, onOpen, onDelete }: FileRowProps): JSX.Element {
  const Icon = getFileIcon(file.name)
  const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE'
  const isNested = file.relativePath.includes('/')
  const folder = isNested ? file.relativePath.split('/').slice(0, -1).join('/') : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors group border border-transparent hover:border-border"
    >
      <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
        <Icon size={16} className="text-text-muted" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-text text-sm font-medium truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {folder && (
            <span className="text-text-muted text-[10px] font-mono bg-surface px-1.5 py-0.5 rounded border border-border">
              {folder}/
            </span>
          )}
          <span className="text-text-muted text-xs">{formatSize(file.size)}</span>
          <span className="text-border">·</span>
          <span className="text-text-muted text-xs">
            {format(parseISO(file.modifiedAt), 'MMM d, yyyy')}
          </span>
          <span className="badge text-[10px] bg-surface text-text-muted">{ext}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onOpen}
          title="Open file"
          className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
        >
          <ExternalLink size={14} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onDelete}
          title="Delete file"
          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
        >
          <Trash2 size={14} />
        </motion.button>
      </div>
    </motion.div>
  )
}

interface FileSectionProps {
  title: string
  category: 'files' | 'docs'
  projectId: string
  description: string
}

function FileSection({ title, category, projectId, description }: FileSectionProps): JSX.Element {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadingFolder, setUploadingFolder] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<FileInfo | null>(null)

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    const result = await window.electron.filesList({ projectId, category })
    if (result.success) setFiles(result.files)
    setIsLoading(false)
  }, [projectId, category])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleUploadFiles = async () => {
    setIsUploading(true)
    const result = await window.electron.filesUpload({ projectId, category })
    setIsUploading(false)
    if (result.success && result.files.length > 0) await loadFiles()
  }

  const handleUploadFolder = async () => {
    setUploadingFolder(true)
    const result = await window.electron.filesUploadFolder({ projectId, category })
    setUploadingFolder(false)
    if (result.success && result.files.length > 0) await loadFiles()
  }

  const handleOpen = (file: FileInfo) => {
    window.electron.filesOpen(file.path)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    await window.electron.filesDelete({ projectId, category, relativePath: pendingDelete.relativePath })
    setFiles((prev) => prev.filter((f) => f.relativePath !== pendingDelete.relativePath))
  }

  const isSpinning = isLoading || isUploading || uploadingFolder

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-text">{title}</h3>
          <p className="text-text-muted text-xs mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={loadFiles}
            disabled={isSpinning}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-all"
            title="Refresh"
          >
            <motion.div
              animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
              transition={isLoading ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
            >
              <RefreshCw size={14} />
            </motion.div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleUploadFolder}
            disabled={isSpinning}
            title="Upload folder"
            className="btn-secondary text-sm py-1.5 px-3"
          >
            {uploadingFolder ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 rounded-full border-2 border-text-muted border-t-transparent"
              />
            ) : (
              <FolderInput size={14} />
            )}
            Folder
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleUploadFiles}
            disabled={isSpinning}
            className="btn-primary text-sm py-1.5"
          >
            {isUploading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 rounded-full border-2 border-white border-t-transparent"
              />
            ) : (
              <Upload size={14} />
            )}
            Files
          </motion.button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-text-muted">
            <div className="w-12 h-12 rounded-xl bg-surface border border-dashed border-border flex items-center justify-center mb-3">
              <Upload size={20} className="opacity-40" />
            </div>
            <p className="text-sm">No files yet</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleUploadFiles}
                className="text-xs text-text-muted hover:text-accent underline transition-colors"
              >
                Upload files
              </button>
              <span className="text-border">·</span>
              <button
                onClick={handleUploadFolder}
                className="text-xs text-text-muted hover:text-accent underline transition-colors"
              >
                Upload folder
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2">
            <AnimatePresence>
              {files.map((file) => (
                <FileRow
                  key={file.relativePath}
                  file={file}
                  onOpen={() => handleOpen(file)}
                  onDelete={() => setPendingDelete(file)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <p className="text-text-muted text-xs mt-2">
        {files.length} {files.length === 1 ? 'file' : 'files'}
        {files.length > 0 && ` · ${formatSize(files.reduce((s, f) => s + f.size, 0))} total`}
        {' · Stored in your FreelanceVault folder'}
      </p>

      <ConfirmDeleteModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        itemType="file"
        itemName={pendingDelete?.name ?? ''}
      />
    </div>
  )
}

interface DepDir {
  name: string
  size: number
}

interface CodeFolder {
  name: string
  path: string
  size?: number
  isGitRepo?: boolean
  depDirs?: DepDir[]
  createdAt: string
  modifiedAt: string
}

interface CodeFoldersSectionProps {
  projectId: string
  onGenerate: () => void
}

type CloneStatus = 'idle' | 'cloning' | 'done' | 'error'

function CodeFoldersSection({ projectId, onGenerate }: CodeFoldersSectionProps): JSX.Element {
  const [folders, setFolders] = useState<CodeFolder[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [pulling, setPulling] = useState<string | null>(null)
  const [pullResult, setPullResult] = useState<{ folder: string; ok: boolean; msg: string } | null>(null)
  // dep dir cleanup: key = `${folderName}/${depDirName}`
  const [confirmDep, setConfirmDep] = useState<{ folder: string; dep: DepDir } | null>(null)
  const [deletingDep, setDeletingDep] = useState<string | null>(null)

  // Clone repo state
  const [showClone, setShowClone] = useState(false)
  const [cloneUrl, setCloneUrl] = useState('')
  const [cloneFolderName, setCloneFolderName] = useState('')
  const [cloneStatus, setCloneStatus] = useState<CloneStatus>('idle')
  const [cloneError, setCloneError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electron.codeListFolders(projectId)
      if (result.success) setFolders(result.folders)
    } catch {
      // IPC not available yet — silently ignore
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!pendingDelete) return
    await window.electron.codeDeleteFolder({ projectId, folderName: pendingDelete })
    setFolders((prev) => prev.filter((f) => f.name !== pendingDelete))
  }

  const handleDeleteDep = async () => {
    if (!confirmDep) return
    const key = `${confirmDep.folder}/${confirmDep.dep.name}`
    setDeletingDep(key)
    setConfirmDep(null)
    await window.electron.codeDeleteDepDir({ projectId, folderName: confirmDep.folder, depDirName: confirmDep.dep.name })
    setDeletingDep(null)
    // Remove the dep dir from local state so UI updates instantly
    setFolders((prev) => prev.map((f) =>
      f.name === confirmDep.folder
        ? { ...f, depDirs: f.depDirs?.filter((d) => d.name !== confirmDep.dep.name) }
        : f
    ))
  }

  const handlePull = async (folderName: string) => {
    setPulling(folderName)
    setPullResult(null)
    const result = await window.electron.gitPull({ projectId, folderName })
    setPulling(null)
    const msg = result.success
      ? (result.output || 'Already up to date.')
      : (result.error?.split('\n')[0] || 'Pull failed')
    setPullResult({ folder: folderName, ok: result.success, msg })
    // auto-clear after 4s
    setTimeout(() => setPullResult((r) => r?.folder === folderName ? null : r), 4000)
  }

  const handleCloneUrlChange = (url: string) => {
    setCloneUrl(url)
    const name = extractRepoName(url)
    if (name) setCloneFolderName(name)
  }

  const handleClone = async () => {
    if (!cloneUrl.trim() || !cloneFolderName.trim()) return
    setCloneStatus('cloning')
    setCloneError('')
    try {
      const result = await window.electron.gitClone({
        projectId,
        folderName: cloneFolderName.trim(),
        url: cloneUrl.trim(),
      })
      if (result.success) {
        setCloneStatus('done')
        await load()
      } else {
        setCloneStatus('error')
        setCloneError(result.error || 'Clone failed')
      }
    } catch (e) {
      setCloneStatus('error')
      setCloneError(String(e))
    }
  }

  const resetClone = () => {
    setShowClone(false)
    setCloneUrl('')
    setCloneFolderName('')
    setCloneStatus('idle')
    setCloneError('')
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-text">Code Folders</h3>
          <p className="text-text-muted text-xs mt-0.5">Generated scaffolds and cloned repositories</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-all"
            title="Refresh"
          >
            <motion.div
              animate={loading ? { rotate: 360 } : { rotate: 0 }}
              transition={loading ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
            >
              <RefreshCw size={14} />
            </motion.div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { setShowClone((v) => !v); setCloneStatus('idle'); setCloneError('') }}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            <Github size={14} />
            Clone Repo
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onGenerate}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            <Code2 size={14} />
            Generate
          </motion.button>
        </div>
      </div>

      {/* Clone repo inline panel */}
      <AnimatePresence>
        {showClone && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Github size={14} className="text-text-muted" />
                  <p className="text-sm font-semibold text-text">Clone Repository</p>
                </div>
                <button
                  onClick={resetClone}
                  className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-border/50 transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              {cloneStatus === 'done' ? (
                <div className="flex flex-col items-center gap-2 py-3">
                  <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center">
                    <Check size={18} className="text-success" />
                  </div>
                  <p className="text-sm font-medium text-text">Cloned successfully!</p>
                  <p className="text-text-muted text-xs">{cloneFolderName}</p>
                  <button onClick={resetClone} className="btn-secondary text-xs py-1 px-3 mt-1">
                    Clone another
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="label text-xs">GitHub URL</label>
                    <input
                      className="input w-full text-sm mt-1"
                      placeholder="https://github.com/user/repo"
                      value={cloneUrl}
                      onChange={(e) => handleCloneUrlChange(e.target.value)}
                      disabled={cloneStatus === 'cloning'}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Folder name</label>
                    <input
                      className="input w-full text-sm mt-1"
                      placeholder="repo-name"
                      value={cloneFolderName}
                      onChange={(e) => setCloneFolderName(e.target.value)}
                      disabled={cloneStatus === 'cloning'}
                    />
                  </div>

                  {cloneStatus === 'error' && (
                    <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-lg">
                      <AlertCircle size={14} className="text-danger shrink-0 mt-0.5" />
                      <p className="text-danger text-xs">{cloneError}</p>
                    </div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleClone}
                    disabled={!cloneUrl.trim() || !cloneFolderName.trim() || cloneStatus === 'cloning'}
                    className="btn-primary text-sm py-1.5 w-full justify-center disabled:opacity-50"
                  >
                    {cloneStatus === 'cloning' ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 rounded-full border-2 border-white border-t-transparent"
                        />
                        Cloning…
                      </>
                    ) : (
                      <>
                        <Github size={14} />
                        Clone
                      </>
                    )}
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-text-muted">
            <div className="w-12 h-12 rounded-xl bg-surface border border-dashed border-border flex items-center justify-center mb-3">
              <Code2 size={20} className="opacity-40" />
            </div>
            <p className="text-sm">No code folders yet</p>
            <div className="flex gap-3 mt-3">
              <button
                onClick={onGenerate}
                className="text-xs text-text-muted hover:text-accent underline transition-colors"
              >
                Generate a scaffold
              </button>
              <span className="text-border">·</span>
              <button
                onClick={() => setShowClone(true)}
                className="text-xs text-text-muted hover:text-accent underline transition-colors"
              >
                Clone a repo
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2">
            <AnimatePresence>
              {folders.map((folder) => (
                <motion.div
                  key={folder.name}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors group border border-transparent hover:border-border"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Folder size={16} className="text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-text text-sm font-medium truncate">{folder.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-text-muted text-xs">{formatSize(folder.size)}</span>
                      <span className="text-border">·</span>
                      <span className="text-text-muted text-xs">{format(parseISO(folder.modifiedAt), 'MMM d, yyyy')}</span>
                    </div>
                    {/* Dep dir cleanup chips */}
                    {folder.depDirs && folder.depDirs.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {folder.depDirs.map((dep) => {
                          const key = `${folder.name}/${dep.name}`
                          const isDeleting = deletingDep === key
                          return (
                            <motion.button
                              key={dep.name}
                              whileTap={{ scale: 0.97 }}
                              disabled={isDeleting}
                              onClick={() => setConfirmDep({ folder: folder.name, dep })}
                              title={`Delete ${dep.name} to free ${formatSize(dep.size)}`}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 border border-warning/25 text-warning text-[10px] font-medium hover:bg-warning/20 transition-colors disabled:opacity-50"
                            >
                              {isDeleting ? (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                  className="w-2.5 h-2.5 rounded-full border border-warning border-t-transparent"
                                />
                              ) : (
                                <Trash2 size={9} />
                              )}
                              {dep.name}
                              <span className="opacity-70">· {formatSize(dep.size)}</span>
                            </motion.button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {folder.isGitRepo && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handlePull(folder.name)}
                        disabled={pulling === folder.name}
                        title="Pull latest from remote"
                        className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
                      >
                        {pulling === folder.name ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent"
                          />
                        ) : (
                          <GitPullRequest size={14} />
                        )}
                      </motion.button>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => window.electron.folderOpen(folder.path)}
                      title="Open in Finder"
                      className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-all"
                    >
                      <FolderOpen size={14} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => window.electron.openInVscode(projectId)}
                      title="Open in VS Code"
                      className="p-1.5 rounded-lg text-text-muted hover:text-[#007ACC] hover:bg-[#007ACC]/10 transition-all"
                    >
                      <Code2 size={14} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => window.electron.openInAntigravity(projectId)}
                      title="Open in Antigravity"
                      className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
                    >
                      <Zap size={14} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setPendingDelete(folder.name)}
                      title="Delete folder"
                      className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                    >
                      <Trash2 size={14} />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <AnimatePresence>
        {pullResult && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`mt-2 flex items-start gap-2 px-3 py-2 rounded-xl border text-xs ${
              pullResult.ok
                ? 'bg-success/5 border-success/20 text-success'
                : 'bg-danger/5 border-danger/20 text-danger'
            }`}
          >
            {pullResult.ok ? <Check size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
            <span className="font-mono break-all">{pullResult.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-text-muted text-xs mt-2">
        {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
        {folders.length > 0 && ` · ${formatSize(folders.reduce((s, f) => s + (f.size ?? 0), 0))} total`}
        {' · Stored in your project directory'}
      </p>

      {/* Dep dir delete confirmation */}
      <AnimatePresence>
        {confirmDep && (
          <div className="modal-overlay" onClick={() => setConfirmDep(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={20} className="text-warning" />
              </div>
              <h3 className="text-lg font-bold text-text text-center mb-1">
                Delete <span className="font-mono">{confirmDep.dep.name}</span>?
              </h3>
              <p className="text-text-muted text-sm text-center mb-2">
                in <span className="font-medium text-text">{confirmDep.folder}</span>
              </p>
              <div className="flex items-center justify-center gap-2 mb-5 px-4 py-2.5 bg-success/5 border border-success/20 rounded-xl">
                <Check size={14} className="text-success shrink-0" />
                <p className="text-success text-sm font-semibold">
                  Frees {formatSize(confirmDep.dep.size)}
                </p>
              </div>
              <p className="text-text-muted text-xs text-center mb-5">
                Deleted permanently — not sent to Trash. You can reinstall later.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDep(null)} className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button onClick={handleDeleteDep} className="flex-1 justify-center flex items-center gap-2 px-4 py-2 rounded-xl bg-warning text-white text-sm font-semibold hover:opacity-90 transition-opacity">
                  <Trash2 size={14} />
                  Delete & Free {formatSize(confirmDep.dep.size)}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDeleteModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        itemType="folder"
        itemName={pendingDelete ?? ''}
        requireTypedConfirm
      />
    </div>
  )
}

export default function FileManager({ projectId }: { projectId: string }): JSX.Element {
  const [showCodeGen, setShowCodeGen] = useState(false)
  const [codeFoldersKey, setCodeFoldersKey] = useState(0)

  const openFolder = async () => {
    const folderPath = await window.electron.projectGetFolder(projectId)
    window.electron.folderOpen(folderPath)
  }

  const handleCodeGenComplete = () => {
    setShowCodeGen(false)
    setCodeFoldersKey((k) => k + 1)
  }

  return (
    <div className="max-w-2xl">
      {showCodeGen && (
        <CodeGeneratorModal
          projectId={projectId}
          onClose={handleCodeGenComplete}
          onComplete={handleCodeGenComplete}
        />
      )}

      <div className="flex justify-end mb-6">
        <button onClick={openFolder} className="btn-secondary text-sm py-1.5 px-3">
          <FolderOpen size={14} />
          Open in Finder
        </button>
      </div>

      <CodeFoldersSection
        key={codeFoldersKey}
        projectId={projectId}
        onGenerate={() => setShowCodeGen(true)}
      />

      <FileSection
        title="Project Files"
        category="files"
        projectId={projectId}
        description="Source code, assets, exports, and deliverables"
      />

      <FileSection
        title="Documents"
        category="docs"
        projectId={projectId}
        description="Contracts, proposals, invoices, and reference documents"
      />
    </div>
  )
}
