import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  File,
  FileText,
  Image,
  FileCode,
  FileArchive,
  ExternalLink,
  Trash2,
  FolderOpen,
  RefreshCw
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { FileInfo } from '../../types'

function getFileIcon(name: string): React.ComponentType<{ size?: number; className?: string }> {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return Image
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'html', 'json', 'yaml', 'yml', 'toml', 'sh'].includes(ext)) return FileCode
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return FileText
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return FileArchive
  return File
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface FileRowProps {
  file: FileInfo
  onOpen: () => void
  onDelete: () => void
}

function FileRow({ file, onOpen, onDelete }: FileRowProps): JSX.Element {
  const Icon = getFileIcon(file.name)
  const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE'

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
        <div className="flex items-center gap-2 mt-0.5">
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

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    const result = await window.electron.filesList({ projectId, category })
    if (result.success) setFiles(result.files)
    setIsLoading(false)
  }, [projectId, category])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleUpload = async () => {
    setIsUploading(true)
    const result = await window.electron.filesUpload({ projectId, category })
    setIsUploading(false)
    if (result.success && result.files.length > 0) {
      await loadFiles()
    }
  }

  const handleOpen = (file: FileInfo) => {
    window.electron.filesOpen(file.path)
  }

  const handleDelete = async (file: FileInfo) => {
    await window.electron.filesDelete({ projectId, category, fileName: file.name })
    setFiles((prev) => prev.filter((f) => f.name !== file.name))
  }

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
            disabled={isLoading}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-all"
            title="Refresh"
          >
            <motion.div animate={isLoading ? { rotate: 360 } : { rotate: 0 }} transition={isLoading ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}>
              <RefreshCw size={14} />
            </motion.div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleUpload}
            disabled={isUploading}
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
            Upload
          </motion.button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {files.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-10 text-text-muted cursor-pointer hover:bg-surface/50 transition-colors"
            onClick={handleUpload}
          >
            <div className="w-12 h-12 rounded-xl bg-surface border border-dashed border-border flex items-center justify-center mb-3">
              <Upload size={20} className="opacity-40" />
            </div>
            <p className="text-sm">Drop files here or click to upload</p>
            <p className="text-xs mt-1 opacity-60">Files are saved to your project folder</p>
          </div>
        ) : (
          <div className="p-2">
            <AnimatePresence>
              {files.map((file) => (
                <FileRow
                  key={file.name}
                  file={file}
                  onOpen={() => handleOpen(file)}
                  onDelete={() => handleDelete(file)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      <p className="text-text-muted text-xs mt-2">
        {files.length} {files.length === 1 ? 'file' : 'files'} · Stored in your FreelanceVault folder
      </p>
    </div>
  )
}

export default function FileManager({ projectId }: { projectId: string }): JSX.Element {
  const openFolder = async () => {
    const folderPath = await window.electron.projectGetFolder(projectId)
    window.electron.folderOpen(folderPath)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div />
        <button onClick={openFolder} className="btn-secondary text-sm py-1.5 px-3">
          <FolderOpen size={14} />
          Open in Finder
        </button>
      </div>

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
