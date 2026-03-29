import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sheet,
  ExternalLink,
  RefreshCw,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Mail,
  Link2,
  Settings,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  LogOut,
  Trash2,
  RotateCcw
} from 'lucide-react'

interface SheetsConfig {
  projectId: string
  spreadsheetId: string
  spreadsheetUrl: string
  sharedEmails: string[]
  lastSynced?: string
  autoSync: boolean
  createdAt: string
}

interface GoogleSheetsManagerProps {
  projectId: string
}

type Step = 'loading' | 'setup-creds' | 'authenticate' | 'create-sheet' | 'manage'

export default function GoogleSheetsManager({ projectId }: GoogleSheetsManagerProps): JSX.Element {
  const [step, setStep] = useState<Step>('loading')
  const [config, setConfig] = useState<SheetsConfig | null>(null)

  // OAuth creds form
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  // Email input
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')

  // Status
  const [busy, setBusy] = useState(false)
  const [confirmDeleteSheet, setConfirmDeleteSheet] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | undefined>(undefined)

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const load = useCallback(async () => {
    setStep('loading')
    setError('')
    try {
      const [credsRes, authRes, configRes] = await Promise.all([
        window.electron.googleGetOAuthCreds(),
        window.electron.googleAuthStatus(),
        window.electron.googleSheetsGetConfig(projectId)
      ])

      if (!credsRes.clientId) {
        setStep('setup-creds')
        return
      }

      setClientId(credsRes.clientId)

      if (!authRes.authenticated) {
        setStep('authenticate')
        return
      }

      if (!configRes.config) {
        setStep('create-sheet')
        return
      }

      setConfig(configRes.config)
      setLastSynced(configRes.config.lastSynced)
      setStep('manage')
    } catch (err) {
      setError(String(err))
      setStep('setup-creds')
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  // ── Step: Save OAuth Credentials ─────────────────────────────────────────
  const handleSaveCreds = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Both Client ID and Client Secret are required')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await window.electron.googleSaveOAuthCreds({ clientId: clientId.trim(), clientSecret: clientSecret.trim() })
      if (!res.success) throw new Error(res.error)
      setStep('authenticate')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  // ── Step: Authenticate ────────────────────────────────────────────────────
  const handleAuth = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await window.electron.googleAuthStart()
      if (!res.success) throw new Error(res.error || 'Authentication failed')
      showSuccess('Connected to Google!')
      setStep('create-sheet')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = async () => {
    await window.electron.googleAuthRevoke()
    setConfig(null)
    setStep('authenticate')
  }

  // ── Step: Create Sheet ────────────────────────────────────────────────────
  const handleCreateSheet = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await window.electron.googleSheetsCreate(projectId)
      if (!res.success) throw new Error(res.error)
      const configRes = await window.electron.googleSheetsGetConfig(projectId)
      setConfig(configRes.config)
      setLastSynced(configRes.config?.lastSynced)
      setStep('manage')
      showSuccess('Google Sheet created and synced!')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  // ── Step: Manage ──────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true)
    setError('')
    try {
      const res = await window.electron.googleSheetsSync(projectId)
      if (!res.success) throw new Error(res.error)
      setLastSynced(res.lastSynced)
      showSuccess('Synced successfully!')
    } catch (err) {
      setError(String(err))
    } finally {
      setSyncing(false)
    }
  }

  const handleAddEmail = async () => {
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setEmailError('Invalid email address')
      return
    }
    if (config?.sharedEmails.includes(email)) {
      setEmailError('Already shared with this email')
      return
    }
    setEmailError('')
    setBusy(true)
    setError('')
    try {
      const res = await window.electron.googleSheetsUpdateEmails({ projectId, emails: [email] })
      if (!res.success) throw new Error(res.error)
      setConfig((prev) => prev ? { ...prev, sharedEmails: res.sharedEmails || prev.sharedEmails } : prev)
      setEmailInput('')
      showSuccess(`Shared with ${email}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveEmail = async (email: string) => {
    setBusy(true)
    setError('')
    try {
      const res = await window.electron.googleSheetsRemoveEmail({ projectId, email })
      if (!res.success) throw new Error(res.error)
      setConfig((prev) => prev ? { ...prev, sharedEmails: res.sharedEmails || prev.sharedEmails } : prev)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteSheet = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await window.electron.googleSheetsDelete(projectId)
      if (!res.success) throw new Error(res.error)
      setConfig(null)
      setConfirmDeleteSheet(false)
      setStep('create-sheet')
      showSuccess('Sheet deleted.')
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleToggleAutoSync = async () => {
    if (!config) return
    const newVal = !config.autoSync
    try {
      await window.electron.googleSheetsUpdateAutosync({ projectId, autoSync: newVal })
      setConfig((prev) => prev ? { ...prev, autoSync: newVal } : prev)
    } catch (err) {
      setError(String(err))
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const formatDate = (iso?: string) => {
    if (!iso) return 'Never'
    try {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
    } catch { return iso }
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center">
          <Sheet size={18} className="text-success" />
        </div>
        <div>
          <h2 className="text-text font-semibold text-base">Share with Client via Google Sheets</h2>
          <p className="text-text-muted text-xs mt-0.5">
            Syncs: Overview · Requirements · Tasks · Credentials · Env Vars · Future Tasks
            &nbsp;·&nbsp;
            <span className="text-danger/70">Not shared: Payments · Bank Details</span>
          </p>
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence mode="popLayout">
        {error && (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2 bg-danger/10 border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm mb-4"
          >
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
        {successMsg && (
          <motion.div
            key="ok"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 bg-success/10 border border-success/20 text-success rounded-lg px-4 py-3 text-sm mb-4"
          >
            <CheckCircle size={15} />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {step === 'loading' && (
        <div className="flex items-center gap-2 text-text-muted py-8">
          <Loader2 size={18} className="animate-spin" />
          <span>Loading…</span>
        </div>
      )}

      {/* Step 1: Setup OAuth Credentials */}
      {step === 'setup-creds' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Settings size={15} className="text-primary" />
            <h3 className="text-text font-medium text-sm">Connect Your Google Account</h3>
          </div>
          <p className="text-text-muted text-xs leading-relaxed">
            You need a Google OAuth2 client (free). Create one at{' '}
            <span className="text-accent font-mono text-xs">console.cloud.google.com</span>:
            enable <strong>Google Sheets API</strong> + <strong>Google Drive API</strong>,
            create an <strong>OAuth 2.0 Client ID</strong> for a <strong>Desktop app</strong>,
            then paste the credentials below.
          </p>

          <div className="space-y-3">
            <div>
              <label className="label">Client ID</label>
              <input
                className="input w-full font-mono text-xs"
                placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Client Secret</label>
              <div className="relative">
                <input
                  className="input w-full font-mono text-xs pr-10"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="GOCSPX-…"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveCreds}
            disabled={busy}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
            Save & Continue
          </button>
        </motion.div>
      )}

      {/* Step 2: Authenticate */}
      {step === 'authenticate' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Link2 size={15} className="text-primary" />
            <h3 className="text-text font-medium text-sm">Authorize Access</h3>
          </div>
          <p className="text-text-muted text-xs leading-relaxed">
            Click below to open Google's authorization page in your browser. Sign in and allow DevVault to create and manage sheets on your behalf.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAuth}
              disabled={busy}
              className="btn-primary flex items-center gap-2 flex-1 justify-center"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
              {busy ? 'Waiting for authorization…' : 'Authorize with Google'}
            </button>
            <button
              onClick={() => { setStep('setup-creds'); setClientSecret('') }}
              className="btn-secondary text-xs px-3"
              title="Change credentials"
            >
              <Settings size={13} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Create Sheet */}
      {step === 'create-sheet' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Sheet size={15} className="text-success" />
            <h3 className="text-text font-medium text-sm">Create Client Sheet</h3>
          </div>
          <p className="text-text-muted text-xs leading-relaxed">
            This will create a Google Sheet with 5 tabs — Overview, Requirements, Tasks, Credentials, and Future Tasks — and populate it with this project's data.
          </p>
          <div className="bg-surface rounded-lg p-3 text-xs text-text-muted space-y-1 border border-border">
            <p className="font-medium text-text mb-1.5">What gets shared:</p>
            <p className="text-success/80">✓ Project overview (name, status, dates, budget)</p>
            <p className="text-success/80">✓ Requirements</p>
            <p className="text-success/80">✓ Tasks & todos</p>
            <p className="text-success/80">✓ Credentials (API keys, URLs, passwords)</p>
            <p className="text-success/80">✓ Future tasks / backlog</p>
            <p className="text-success/80">✓ Environment variables (.env)</p>
            <p className="text-danger/70 mt-1.5">✗ Payments & financial records</p>
            <p className="text-danger/70">✗ Bank details</p>
          </div>
          <button
            onClick={handleCreateSheet}
            disabled={busy}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sheet size={14} />}
            {busy ? 'Creating Sheet…' : 'Create & Sync Sheet'}
          </button>
        </motion.div>
      )}

      {/* Step 4: Manage */}
      {step === 'manage' && config && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Sheet link + sync */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sheet size={14} className="text-success" />
                <span className="text-text text-sm font-medium">Client Sheet</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-xs">
                  Last synced: {formatDate(lastSynced)}
                </span>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5"
                >
                  <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                  Sync Now
                </button>
                <a
                  href={config.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => { e.preventDefault(); window.electron.folderOpen(config.spreadsheetUrl) }}
                  className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5"
                >
                  <ExternalLink size={12} />
                  Open
                </a>
              </div>
            </div>

            {/* Shareable link */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2 font-mono text-xs text-text-muted truncate">
                {config.spreadsheetUrl}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(config.spreadsheetUrl).then(() => showSuccess('Link copied!'))}
                className="btn-secondary text-xs py-2 px-3 shrink-0"
              >
                Copy Link
              </button>
            </div>

            {/* Auto-sync toggle */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-text text-xs font-medium">Auto-sync on project update</p>
                <p className="text-text-muted text-xs">Automatically push changes whenever you update this project</p>
              </div>
              <button
                onClick={handleToggleAutoSync}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  config.autoSync
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-surface border-border text-text-muted hover:text-text'
                }`}
              >
                {config.autoSync ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                {config.autoSync ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          {/* Email sharing */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-0.5">
              <Mail size={14} className="text-accent" />
              <span className="text-text text-sm font-medium">Share with People</span>
            </div>
            <p className="text-text-muted text-xs">
              Recipients get comment access — they can view and comment but not edit.
            </p>

            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="client@example.com"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setEmailError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddEmail() }}
              />
              <button
                onClick={handleAddEmail}
                disabled={busy || !emailInput.trim()}
                className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5 shrink-0"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Add
              </button>
            </div>
            {emailError && (
              <p className="text-danger text-xs">{emailError}</p>
            )}

            {/* Email list */}
            {config.sharedEmails.length > 0 ? (
              <div className="space-y-1.5 mt-1">
                {config.sharedEmails.map((email) => (
                  <div key={email} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 border border-border">
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="text-text-muted" />
                      <span className="text-text text-sm">{email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted text-xs">Commenter</span>
                      <button
                        onClick={() => handleRemoveEmail(email)}
                        disabled={busy}
                        className="text-text-muted hover:text-danger transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-xs italic">No one has been added yet.</p>
            )}
          </div>

          {/* Delete / recreate sheet */}
          <div className="card p-4 border-danger/20 space-y-3">
            <p className="text-text text-sm font-medium flex items-center gap-2">
              <Trash2 size={13} className="text-danger" />
              Delete &amp; Recreate Sheet
            </p>
            <p className="text-text-muted text-xs">
              Permanently deletes the current Google Sheet from your Drive and lets you create a fresh one. Shared emails will be lost.
            </p>
            <AnimatePresence mode="popLayout">
              {!confirmDeleteSheet ? (
                <motion.button
                  key="ask"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setConfirmDeleteSheet(true)}
                  className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Trash2 size={12} />
                  Delete Current Sheet
                </motion.button>
              ) : (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-danger text-xs font-medium">Are you sure? This cannot be undone.</span>
                  <button
                    onClick={handleDeleteSheet}
                    disabled={busy}
                    className="btn-danger text-xs py-1 px-3 flex items-center gap-1.5"
                  >
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteSheet(false)}
                    className="btn-secondary text-xs py-1 px-3"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={handleCreateSheet}
              disabled={busy}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <RotateCcw size={12} />
              Recreate Sheet (keep same link)
            </button>
          </div>

          {/* Account actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => { setStep('setup-creds'); setClientSecret('') }}
              className="text-text-muted hover:text-text text-xs flex items-center gap-1.5 transition-colors"
            >
              <Settings size={12} />
              Change OAuth credentials
            </button>
            <button
              onClick={handleRevoke}
              className="text-text-muted hover:text-danger text-xs flex items-center gap-1.5 transition-colors"
            >
              <LogOut size={12} />
              Disconnect Google Account
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
