import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2 } from 'lucide-react'

interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  itemType: string
  itemName: string
  description?: string
  /** If true, user must type itemName exactly before the delete button enables */
  requireTypedConfirm?: boolean
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  itemType,
  itemName,
  description,
  requireTypedConfirm = false,
}: ConfirmDeleteModalProps): JSX.Element {
  const [typed, setTyped] = useState('')
  const [confirming, setConfirming] = useState(false)

  // Reset typed value whenever modal opens/closes
  useEffect(() => {
    if (!isOpen) setTyped('')
  }, [isOpen])

  const canDelete = !requireTypedConfirm || typed === itemName

  const handleConfirm = async () => {
    if (!canDelete || confirming) return
    setConfirming(true)
    await onConfirm()
    setConfirming(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-danger" />
            </div>

            <h3 className="text-lg font-bold text-text text-center mb-2">
              Delete {itemType}?
            </h3>

            {description ? (
              <p className="text-text-muted text-sm text-center mb-4">{description}</p>
            ) : (
              <p className="text-text-muted text-sm text-center mb-4">
                This will permanently delete{' '}
                <span className="font-semibold text-text">&ldquo;{itemName}&rdquo;</span>.
                This action cannot be undone.
              </p>
            )}

            {requireTypedConfirm && (
              <div className="mb-4">
                <p className="text-text-muted text-xs mb-2 text-center">
                  Type{' '}
                  <span className="font-mono font-semibold text-text bg-surface px-1.5 py-0.5 rounded border border-border">
                    {itemName}
                  </span>{' '}
                  to confirm
                </p>
                <input
                  autoFocus
                  className="input w-full text-sm"
                  placeholder={`Type "${itemName}" to confirm`}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={confirming}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!canDelete || confirming}
                className="btn-danger flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirming ? 'Deleting…' : `Delete ${itemType}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
