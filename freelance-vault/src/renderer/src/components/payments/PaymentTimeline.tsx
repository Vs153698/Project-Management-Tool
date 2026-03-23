import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, X, DollarSign } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAppStore } from '../../store/useAppStore'
import type { Project, Payment } from '../../types'
import ConfirmDeleteModal from '../ui/ConfirmDeleteModal'

const typeColors: Record<string, string> = {
  advance: 'bg-accent text-white',
  milestone: 'bg-primary text-white',
  final: 'bg-success text-white',
  other: 'bg-text-muted text-white'
}

const typeDotColors: Record<string, string> = {
  advance: 'bg-accent shadow-accent/40',
  milestone: 'bg-primary shadow-primary/40',
  final: 'bg-success shadow-success/40',
  other: 'bg-text-muted'
}

const typeLabels: Record<string, string> = {
  advance: 'Advance',
  milestone: 'Milestone',
  final: 'Final',
  other: 'Other'
}

function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

interface AddPaymentModalProps {
  projectId: string
  currency: string
  onClose: () => void
}

function AddPaymentModal({ projectId, currency, onClose }: AddPaymentModalProps): JSX.Element {
  const { addPayment } = useAppStore()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [type, setType] = useState<Payment['type']>('advance')
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Enter a valid amount')
      return
    }
    setIsLoading(true)
    const now = new Date().toISOString()
    await addPayment({
      id: generateId(),
      projectId,
      amount: Number(amount),
      date,
      type,
      note: note.trim() || undefined,
      createdAt: now
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
          <h3 className="font-bold text-text text-lg">Add Payment</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Amount ({currency}) *</label>
            <div className="relative">
              <DollarSign
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="input pl-9"
                autoFocus
              />
            </div>
            {error && <p className="text-danger text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="label">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label">Payment Type</label>
            <div className="grid grid-cols-4 gap-2">
              {(['advance', 'milestone', 'final', 'other'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                    type === t
                      ? typeColors[t] + ' border-transparent'
                      : 'bg-surface border-border text-text-muted hover:text-text'
                  }`}
                >
                  {typeLabels[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Phase 1 completion"
              className="input"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1 justify-center">
              {isLoading ? 'Saving...' : 'Add Payment'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function PaymentTimeline({ project }: { project: Project }): JSX.Element {
  const { db, deletePayment, displayCurrency } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Payment | null>(null)

  const payments = useMemo(
    () =>
      db.payments
        .filter((p) => p.projectId === project.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [db.payments, project.id]
  )

  const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments])
  const remaining = Math.max(0, project.projectCost - totalPaid)
  const pct = project.projectCost > 0 ? Math.min(100, (totalPaid / project.projectCost) * 100) : 0

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeletingId(pendingDelete.id)
    await deletePayment(pendingDelete.id)
    setDeletingId(null)
  }

  return (
    <div className="max-w-2xl">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-text-muted text-xs mb-1">Total Value</p>
          <p className="text-text font-bold text-lg">
            {formatCurrency(project.projectCost, displayCurrency)}
          </p>
        </div>
        <div className="card">
          <p className="text-text-muted text-xs mb-1">Received</p>
          <p className="text-success font-bold text-lg">
            {formatCurrency(totalPaid, displayCurrency)}
          </p>
        </div>
        <div className="card">
          <p className="text-text-muted text-xs mb-1">Remaining</p>
          <p className="text-warning font-bold text-lg">
            {formatCurrency(remaining, displayCurrency)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-text-muted mb-2">
          <span>Payment Progress</span>
          <span className="font-medium text-text">{Math.round(pct)}% collected</span>
        </div>
        <div className="w-full bg-border rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-3 rounded-full"
            style={{ background: 'linear-gradient(90deg, #3D6EF5 0%, #10C9A0 100%)' }}
          />
        </div>
        <div className="flex justify-between text-xs text-text-muted mt-1.5">
          <span>{payments.length} payment{payments.length !== 1 ? 's' : ''} recorded</span>
          {remaining > 0 && (
            <span className="text-warning">
              {formatCurrency(remaining, displayCurrency)} pending
            </span>
          )}
        </div>
      </div>

      {/* Add button */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-text">Payment History</h3>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowAdd(true)}
          className="btn-primary"
        >
          <Plus size={15} />
          Add Payment
        </motion.button>
      </div>

      {/* Timeline */}
      {payments.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-text-muted">
          <DollarSign size={36} className="mb-3 opacity-20" />
          <p className="text-sm">No payments recorded yet</p>
          <button onClick={() => setShowAdd(true)} className="text-primary text-xs mt-2 hover:underline">
            Add your first payment
          </button>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[17px] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            <AnimatePresence>
              {payments.map((payment) => (
                <motion.div
                  key={payment.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex gap-4 relative"
                >
                  {/* Dot */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center z-10 shrink-0 shadow-lg ${typeDotColors[payment.type]}`}
                  >
                    <DollarSign size={13} className="text-white" />
                  </div>

                  {/* Card */}
                  <div className="flex-1 card mb-0 group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-text font-bold">
                            {formatCurrency(payment.amount, displayCurrency)}
                          </span>
                          <span className={`badge ${typeColors[payment.type]}`}>
                            {typeLabels[payment.type]}
                          </span>
                        </div>
                        <p className="text-text-muted text-xs">
                          {format(parseISO(payment.date), 'MMMM d, yyyy')}
                        </p>
                        {payment.note && (
                          <p className="text-text-secondary text-sm mt-1.5">{payment.note}</p>
                        )}
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setPendingDelete(payment)}
                        disabled={deletingId === payment.id}
                        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all p-1 rounded-lg hover:bg-danger/10 shrink-0"
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <AddPaymentModal
            projectId={project.id}
            currency={displayCurrency}
            onClose={() => setShowAdd(false)}
          />
        )}
      </AnimatePresence>

      <ConfirmDeleteModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        itemType="payment"
        itemName={pendingDelete ? `${typeLabels[pendingDelete.type]} — ${formatCurrency(pendingDelete.amount, displayCurrency)}` : ''}
        description={pendingDelete ? `Delete the ${typeLabels[pendingDelete.type].toLowerCase()} payment of ${formatCurrency(pendingDelete.amount, displayCurrency)} on ${format(parseISO(pendingDelete.date), 'MMM d, yyyy')}? This cannot be undone.` : undefined}
      />
    </div>
  )
}
