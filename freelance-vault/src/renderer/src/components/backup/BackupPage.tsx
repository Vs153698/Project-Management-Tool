import { useState } from 'react'
import { Shield, Download, Upload, Lock, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { Database } from '../../types'

type Status = { type: 'success' | 'error'; message: string } | null

export default function BackupPage(): JSX.Element {
  const { loadDb } = useAppStore()

  const [exportPin, setExportPin] = useState('')
  const [importPin, setImportPin] = useState('')
  const [exportStatus, setExportStatus] = useState<Status>(null)
  const [importStatus, setImportStatus] = useState<Status>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleExport = async () => {
    if (exportPin.length < 4) return
    setExporting(true)
    setExportStatus(null)
    const result = await window.electron.backupExport(exportPin)
    setExporting(false)
    if (result.success) {
      setExportStatus({ type: 'success', message: 'Backup saved successfully. Keep your PIN safe — it\'s required to restore.' })
      setExportPin('')
    } else if (result.error !== 'cancelled') {
      setExportStatus({ type: 'error', message: result.error || 'Export failed' })
    }
  }

  const handleImport = async () => {
    if (importPin.length < 4) return
    setImporting(true)
    setImportStatus(null)
    const result = await window.electron.backupImport(importPin)
    setImporting(false)
    if (result.success) {
      // Reload the db into the store
      await loadDb()
      setImportStatus({ type: 'success', message: 'Backup restored successfully! Your data has been replaced.' })
      setImportPin('')
    } else if (result.error !== 'cancelled') {
      setImportStatus({ type: 'error', message: result.error || 'Import failed' })
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center">
          <Shield size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">Backup & Restore</h1>
          <p className="text-text-muted text-sm">Export your data as an encrypted .fvb file and restore it anytime.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Export */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-success/15 flex items-center justify-center">
              <Download size={16} className="text-success" />
            </div>
            <div>
              <h2 className="text-text font-semibold">Export Backup</h2>
              <p className="text-text-muted text-xs">Creates an AES-256-GCM encrypted .fvb file on your computer.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                className="input w-full pl-8"
                placeholder="Encryption PIN (min 4 chars)"
                value={exportPin}
                onChange={(e) => setExportPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExport()}
              />
            </div>
            <button
              onClick={handleExport}
              disabled={exporting || exportPin.length < 4}
              className="btn-primary py-2 px-4 disabled:opacity-40 shrink-0"
            >
              <Download size={15} />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>

          {exportStatus && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
              exportStatus.type === 'success'
                ? 'bg-success/10 text-success border border-success/20'
                : 'bg-danger/10 text-danger border border-danger/20'
            }`}>
              {exportStatus.type === 'success'
                ? <CheckCircle size={15} className="shrink-0 mt-0.5" />
                : <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              }
              {exportStatus.message}
            </div>
          )}
        </div>

        {/* Import */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-warning/15 flex items-center justify-center">
              <Upload size={16} className="text-warning" />
            </div>
            <div>
              <h2 className="text-text font-semibold">Restore Backup</h2>
              <p className="text-text-muted text-xs">Opens a .fvb file and replaces all current data. This cannot be undone.</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-warning/5 border border-warning/20 text-warning text-xs flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>Restoring will <strong>overwrite all current data</strong> including projects, payments, and credentials.</span>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                className="input w-full pl-8"
                placeholder="PIN used when creating the backup"
                value={importPin}
                onChange={(e) => setImportPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              />
            </div>
            <button
              onClick={handleImport}
              disabled={importing || importPin.length < 4}
              className="btn-secondary py-2 px-4 disabled:opacity-40 shrink-0 border-warning/30 text-warning hover:bg-warning/10"
            >
              <Upload size={15} />
              {importing ? 'Restoring...' : 'Restore'}
            </button>
          </div>

          {importStatus && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
              importStatus.type === 'success'
                ? 'bg-success/10 text-success border border-success/20'
                : 'bg-danger/10 text-danger border border-danger/20'
            }`}>
              {importStatus.type === 'success'
                ? <CheckCircle size={15} className="shrink-0 mt-0.5" />
                : <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              }
              {importStatus.message}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="card p-5 space-y-2">
          <h3 className="text-text text-sm font-semibold flex items-center gap-2">
            <Shield size={14} className="text-primary" />
            How it works
          </h3>
          <ul className="text-text-muted text-xs space-y-1.5 pl-4 list-disc">
            <li>Your entire database (projects, payments, credentials, env vars, time entries) is encrypted.</li>
            <li>Encryption uses AES-256-GCM with a key derived from your PIN via scrypt.</li>
            <li>The .fvb file is fully portable — restore on any machine running FreelanceVault.</li>
            <li>Without the correct PIN, the backup cannot be decrypted.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
