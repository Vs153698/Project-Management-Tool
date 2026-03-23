import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  X,
  Lock,
  Check,
  Globe,
  Key,
  Terminal,
  Fingerprint,
  ShieldAlert,
  Delete,
  Grid3x3
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { Credential } from '../../types'
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal'

const PIN_LENGTH = 4

const typeIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  api_key: Key,
  password: Lock,
  url: Globe,
  ssh_key: Terminal,
  other: Lock
}

const typeLabels: Record<string, string> = {
  api_key: 'API Key',
  password: 'Password',
  url: 'URL',
  ssh_key: 'SSH Key',
  other: 'Other'
}

const typeColors: Record<string, string> = {
  api_key: 'text-accent bg-accent/10',
  password: 'text-primary bg-primary/10',
  url: 'text-success bg-success/10',
  ssh_key: 'text-warning bg-warning/10',
  other: 'text-text-muted bg-surface'
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Vault Unlock Overlay ─────────────────────────────────────────────────────
interface UnlockVaultProps {
  onUnlock: () => void
  onCancel: () => void
}

function UnlockVault({ onUnlock, onCancel }: UnlockVaultProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shaking, setShaking] = useState(false)
  const [showKeypad, setShowKeypad] = useState(false)
  const [touchIdAvailable, setTouchIdAvailable] = useState(false)
  const [touchIdLoading, setTouchIdLoading] = useState(false)

  useEffect(() => {
    window.electron.checkTouchId().then((r) => setTouchIdAvailable(r.available))
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    if (pin.length === PIN_LENGTH) handlePinCheck(pin)
  }, [pin])

  const handlePinCheck = async (value: string) => {
    const result = await window.electron.verifyPin(value)
    if (result.success) {
      onUnlock()
    } else {
      setShaking(true)
      setError('Incorrect PIN')
      setTimeout(() => {
        setShaking(false)
        setPin('')
        setError('')
        inputRef.current?.focus()
      }, 700)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)
    setPin(val)
  }

  const handleTouchId = async () => {
    setTouchIdLoading(true)
    const result = await window.electron.touchIdAuth()
    setTouchIdLoading(false)
    if (result.success) { onUnlock() }
    else { setError('Touch ID failed. Enter PIN instead.') }
  }

  const pressKey = (d: string) => setPin((p) => (p + d).slice(0, PIN_LENGTH))
  const deleteKey = () => setPin((p) => p.slice(0, -1))
  const numRows = [['1','2','3'],['4','5','6'],['7','8','9']]

  return (
    <div className="modal-overlay">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl p-6 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldAlert size={15} className="text-primary" />
            </div>
            <h3 className="font-bold text-text">Unlock Vault</h3>
          </div>
          <button onClick={onCancel} className="text-text-muted hover:text-text p-1">
            <X size={16} />
          </button>
        </div>
        <p className="text-text-muted text-xs mb-4">Enter your PIN or use Touch ID to view credentials.</p>

        {/* Hidden real input */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={handleChange}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          tabIndex={-1}
        />

        {/* Dots */}
        <motion.div
          animate={shaking ? { x: [-8, 8, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex gap-3 justify-center mb-2 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ backgroundColor: i < pin.length ? (error ? '#ef4444' : '#3D6EF5') : '#E5E7EB' }}
              className="w-3 h-3 rounded-full border-2"
              style={{ borderColor: i < pin.length ? (error ? '#ef4444' : '#3D6EF5') : '#D1D5DB' }}
            />
          ))}
        </motion.div>

        <div className="flex items-center justify-center gap-3 mb-1">
          <p className="text-text-muted text-xs">Type with keyboard</p>
          <span className="text-border text-xs">·</span>
          <button
            onClick={() => { setShowKeypad((v) => !v); inputRef.current?.focus() }}
            className="text-xs text-text-muted hover:text-text flex items-center gap-1"
          >
            <Grid3x3 size={11} />
            {showKeypad ? 'Hide' : 'Show'} keypad
          </button>
        </div>

        {error && <p className="text-danger text-xs text-center mt-1 mb-1">{error}</p>}

        <AnimatePresence>
          {showKeypad && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-3"
            >
              <div className="space-y-2 mx-auto w-fit">
                {numRows.map((row, ri) => (
                  <div key={ri} className="flex gap-2">
                    {row.map((d) => (
                      <motion.button
                        key={d}
                        whileTap={{ scale: 0.88, backgroundColor: 'rgba(61,110,245,0.12)' }}
                        onClick={() => pressKey(d)}
                        className="w-14 h-11 rounded-xl text-base font-semibold text-text flex items-center justify-center select-none"
                        style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                      >
                        {d}
                      </motion.button>
                    ))}
                  </div>
                ))}
                <div className="flex gap-2">
                  <div className="w-14 h-11" />
                  <motion.button
                    whileTap={{ scale: 0.88, backgroundColor: 'rgba(61,110,245,0.12)' }}
                    onClick={() => pressKey('0')}
                    className="w-14 h-11 rounded-xl text-base font-semibold text-text flex items-center justify-center"
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                  >
                    0
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={deleteKey}
                    disabled={pin.length === 0}
                    className="w-14 h-11 rounded-xl flex items-center justify-center text-text-muted hover:text-text disabled:opacity-20"
                    style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}
                  >
                    <Delete size={15} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Touch ID */}
        {touchIdAvailable && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleTouchId}
            disabled={touchIdLoading}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-text-muted hover:text-accent hover:border-accent/40 transition-all text-sm disabled:opacity-50"
          >
            {touchIdLoading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent" />
            ) : (
              <Fingerprint size={15} />
            )}
            Use Touch ID
          </motion.button>
        )}
      </motion.div>
    </div>
  )
}

// ── Add Credential Modal ──────────────────────────────────────────────────────
interface AddCredentialModalProps {
  projectId: string
  onClose: () => void
}

function AddCredentialModal({ projectId, onClose }: AddCredentialModalProps): JSX.Element {
  const { addCredential } = useAppStore()
  const [label, setLabel] = useState('')
  const [type, setType] = useState<Credential['type']>('api_key')
  const [value, setValue] = useState('')
  const [username, setUsername] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [showValue, setShowValue] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!label.trim()) e.label = 'Label is required'
    if (!value.trim()) e.value = 'Value is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsLoading(true)
    await addCredential({
      id: generateId(),
      projectId,
      label: label.trim(),
      type,
      value: value.trim(),
      username: username.trim() || undefined,
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString()
    })
    setIsLoading(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-text text-lg">Add Credential</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Label *</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Production API Key" className="input" autoFocus />
            {errors.label && <p className="text-danger text-xs mt-1">{errors.label}</p>}
          </div>

          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-5 gap-1.5">
              {(['api_key', 'password', 'url', 'ssh_key', 'other'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-medium transition-all border ${
                    type === t ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-muted hover:text-text'
                  }`}
                >
                  {typeLabels[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Username / Account (optional)</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user@example.com" className="input" />
          </div>

          <div>
            <label className="label">Value *</label>
            <div className="relative">
              <input
                type={showValue ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="sk-... or password..."
                className="input pr-10 font-mono text-sm"
              />
              <button type="button" onClick={() => setShowValue(!showValue)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                {showValue ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.value && <p className="text-danger text-xs mt-1">{errors.value}</p>}
          </div>

          <div>
            <label className="label">URL (optional)</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="input" />
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} className="input resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1 justify-center">
              {isLoading ? 'Saving...' : 'Add Credential'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Credential Card ───────────────────────────────────────────────────────────
function CredentialCard({
  cred,
  vaultUnlocked,
  onRevealRequest,
  onDelete
}: {
  cred: Credential
  vaultUnlocked: boolean
  onRevealRequest: () => void
  onDelete: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const TypeIcon = typeIcons[cred.type] || Lock

  // Auto-hide when vault locks again
  useEffect(() => {
    if (!vaultUnlocked) setRevealed(false)
  }, [vaultUnlocked])

  const handleCopy = async () => {
    if (!vaultUnlocked) { onRevealRequest(); return }
    await navigator.clipboard.writeText(cred.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReveal = () => {
    if (!vaultUnlocked) { onRevealRequest(); return }
    setRevealed(!revealed)
  }

  const maskedValue = '•'.repeat(Math.min(24, cred.value.length || 16))

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="card group">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeColors[cred.type]}`}>
          <TypeIcon size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-text text-sm">{cred.label}</p>
            <span className={`badge text-xs ${typeColors[cred.type]}`}>{typeLabels[cred.type]}</span>
          </div>
          {cred.username && <p className="text-text-muted text-xs mb-1">{cred.username}</p>}
          {cred.url && <p className="text-accent text-xs truncate mb-1.5">{cred.url}</p>}
          <code className="text-text-secondary text-xs font-mono bg-surface border border-border rounded px-2 py-0.5 block max-w-full truncate">
            {revealed && vaultUnlocked ? cred.value : maskedValue}
          </code>
          {cred.notes && <p className="text-text-muted text-xs mt-1.5">{cred.notes}</p>}
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleReveal}
            title={revealed && vaultUnlocked ? 'Hide' : vaultUnlocked ? 'Reveal' : 'Unlock to reveal'}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-all"
          >
            {!vaultUnlocked ? <Lock size={14} /> : revealed ? <EyeOff size={14} /> : <Eye size={14} />}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleCopy}
            title={vaultUnlocked ? 'Copy to clipboard' : 'Unlock to copy'}
            className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onDelete}
            title="Delete"
            className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
          >
            <Trash2 size={14} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main CredentialVault ──────────────────────────────────────────────────────
export default function CredentialVault({ projectId }: { projectId: string }): JSX.Element {
  const { db, deleteCredential } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [vaultUnlocked, setVaultUnlocked] = useState(false)
  const [showUnlock, setShowUnlock] = useState(false)
  const [lockTimer, setLockTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Credential | null>(null)

  const credentials = useMemo(
    () => db.credentials.filter((c) => c.projectId === projectId),
    [db.credentials, projectId]
  )

  // Auto-lock after 2 minutes of unlock
  const unlock = () => {
    setVaultUnlocked(true)
    setShowUnlock(false)
    if (lockTimer) clearTimeout(lockTimer)
    const t = setTimeout(() => setVaultUnlocked(false), 2 * 60 * 1000)
    setLockTimer(t)
  }

  const lock = () => {
    setVaultUnlocked(false)
    if (lockTimer) clearTimeout(lockTimer)
  }

  return (
    <div className="max-w-2xl">
      {/* Lock banner */}
      <div className={`flex items-center gap-3 rounded-xl p-3.5 mb-5 border transition-colors ${
        vaultUnlocked
          ? 'bg-success/5 border-success/20'
          : 'bg-primary/5 border-primary/20'
      }`}>
        {vaultUnlocked ? (
          <>
            <Check size={15} className="text-success shrink-0" />
            <div className="flex-1">
              <p className="text-success text-sm font-medium">Vault Unlocked</p>
              <p className="text-text-muted text-xs">Auto-locks in 2 minutes. Credentials are visible.</p>
            </div>
            <button onClick={lock} className="text-text-muted hover:text-text text-xs border border-border rounded-lg px-2.5 py-1.5 transition-colors">
              Lock now
            </button>
          </>
        ) : (
          <>
            <Lock size={15} className="text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-primary text-sm font-medium">Vault Locked</p>
              <p className="text-text-muted text-xs">Unlock with your PIN or Touch ID to view credential values.</p>
            </div>
            <button
              onClick={() => setShowUnlock(true)}
              className="text-white text-xs bg-primary hover:bg-primary-hover rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1.5"
            >
              <Fingerprint size={13} />
              Unlock
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-text">Credentials</h3>
          <p className="text-text-muted text-xs mt-0.5">{credentials.length} stored</p>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAdd(true)} className="btn-primary text-sm">
          <Plus size={15} />
          Add Credential
        </motion.button>
      </div>

      {credentials.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-text-muted">
          <Lock size={36} className="mb-3 opacity-20" />
          <p className="text-sm">No credentials stored yet</p>
          <button onClick={() => setShowAdd(true)} className="text-primary text-xs mt-2 hover:underline">
            Add your first credential
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {credentials.map((cred) => (
              <CredentialCard
                key={cred.id}
                cred={cred}
                vaultUnlocked={vaultUnlocked}
                onRevealRequest={() => setShowUnlock(true)}
                onDelete={() => setPendingDelete(cred)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showAdd && <AddCredentialModal projectId={projectId} onClose={() => setShowAdd(false)} />}
        {showUnlock && <UnlockVault onUnlock={unlock} onCancel={() => setShowUnlock(false)} />}
      </AnimatePresence>

      <ConfirmDeleteModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => { if (pendingDelete) await deleteCredential(pendingDelete.id) }}
        itemType="credential"
        itemName={pendingDelete?.label ?? ''}
        requireTypedConfirm
      />
    </div>
  )
}
