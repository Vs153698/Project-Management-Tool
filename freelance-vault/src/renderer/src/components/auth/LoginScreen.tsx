import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Fingerprint, Grid3x3, Delete } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import AppLogo from '../ui/AppLogo'

const PIN_LENGTH = 4

// Reusable PIN input that works with keyboard and optional virtual keypad
interface PinInputProps {
  onComplete: (pin: string) => Promise<void>
  error: string
  onErrorClear: () => void
  label?: string
}

export function PinInput({ onComplete, error, onErrorClear, label }: PinInputProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pin, setPin] = useState('')
  const [shaking, setShaking] = useState(false)
  const [showKeypad, setShowKeypad] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Focus hidden input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Shake + reset on error
  useEffect(() => {
    if (error) {
      setShaking(true)
      const t = setTimeout(() => {
        setShaking(false)
        setPin('')
        onErrorClear()
        inputRef.current?.focus()
      }, 650)
      return () => clearTimeout(t)
    }
  }, [error, onErrorClear])

  const submit = useCallback(
    async (value: string) => {
      if (submitting) return
      setSubmitting(true)
      await onComplete(value)
      setSubmitting(false)
    },
    [onComplete, submitting]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)
    setPin(val)
    if (val.length === PIN_LENGTH) submit(val)
  }

  const pressKeypad = (digit: string) => {
    setPin((p) => {
      const next = (p + digit).slice(0, PIN_LENGTH)
      if (next.length === PIN_LENGTH) submit(next)
      return next
    })
  }

  const deleteKeypad = () => setPin((p) => p.slice(0, -1))

  const numRows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']]

  return (
    <div className="flex flex-col items-center">
      {label && <p className="text-text-muted text-sm mb-5">{label}</p>}

      {/* Hidden input — always captures real keyboard */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        value={pin}
        onChange={handleChange}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        tabIndex={-1}
      />

      {/* Dots — click to re-focus hidden input */}
      <motion.div
        animate={shaking ? { x: [-10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex gap-4 cursor-text mb-2"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              scale: i === pin.length - 1 ? [1.35, 1] : 1,
              backgroundColor:
                i < pin.length
                  ? error
                    ? '#ef4444'
                    : submitting
                      ? '#10B981'
                      : '#3D6EF5'
                  : '#E5E7EB'
            }}
            transition={{ duration: 0.15 }}
            className="w-3.5 h-3.5 rounded-full border-2"
            style={{
              borderColor:
                i < pin.length
                  ? error
                    ? '#ef4444'
                    : submitting
                      ? '#10B981'
                      : '#3D6EF5'
                  : '#D1D5DB'
            }}
          />
        ))}
      </motion.div>

      {/* Keyboard hint + keypad toggle */}
      <div className="flex items-center gap-3 mt-3 mb-1">
        <p className="text-text-muted text-xs">Type with keyboard</p>
        <span className="text-border text-xs">·</span>
        <button
          onClick={() => { setShowKeypad((v) => !v); inputRef.current?.focus() }}
          className="text-xs text-text-muted hover:text-text flex items-center gap-1 transition-colors"
        >
          <Grid3x3 size={11} />
          {showKeypad ? 'Hide' : 'Show'} keypad
        </button>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-danger text-xs mt-1"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Virtual keypad */}
      <AnimatePresence>
        {showKeypad && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-4"
          >
            <div className="space-y-2.5">
              {numRows.map((row, ri) => (
                <div key={ri} className="flex gap-3">
                  {row.map((d) => (
                    <motion.button
                      key={d}
                      whileTap={{ scale: 0.88, backgroundColor: 'rgba(61,110,245,0.12)' }}
                      onClick={() => pressKeypad(d)}
                      className="w-16 h-14 rounded-2xl text-xl font-semibold text-text flex items-center justify-center select-none transition-colors"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                    >
                      {d}
                    </motion.button>
                  ))}
                </div>
              ))}
              <div className="flex gap-3">
                <div className="w-16 h-14" />
                <motion.button
                  whileTap={{ scale: 0.88, backgroundColor: 'rgba(61,110,245,0.12)' }}
                  onClick={() => pressKeypad('0')}
                  className="w-16 h-14 rounded-2xl text-xl font-semibold text-text flex items-center justify-center select-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                >
                  0
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={deleteKeypad}
                  disabled={pin.length === 0}
                  className="w-16 h-14 rounded-2xl flex items-center justify-center text-text-muted hover:text-text disabled:opacity-20 transition-all"
                  style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}
                >
                  <Delete size={18} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main LoginScreen ──────────────────────────────────────────────────────────
export default function LoginScreen(): JSX.Element {
  const [error, setError] = useState('')
  const [touchIdAvailable, setTouchIdAvailable] = useState(false)
  const [touchIdLoading, setTouchIdLoading] = useState(false)
  const { loginWithPin, loginWithTouchId, userName } = useAppStore()

  useEffect(() => {
    window.electron.checkTouchId().then((r) => setTouchIdAvailable(r.available))
  }, [])

  const handlePinComplete = async (pin: string): Promise<void> => {
    const success = await loginWithPin(pin)
    if (!success) setError('Incorrect PIN. Try again.')
  }

  const handleTouchId = async () => {
    setTouchIdLoading(true)
    setError('')
    const success = await loginWithTouchId()
    setTouchIdLoading(false)
    if (!success) setError('Touch ID failed. Use your PIN instead.')
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const displayName = userName || 'there'

  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center overflow-hidden relative">
      {/* Ambient blobs */}
      <motion.div
        className="absolute w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(61,110,245,0.10) 0%, transparent 70%)', top: '-20%', left: '-10%' }}
        animate={{ scale: [1, 1.05, 1], x: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,201,160,0.08) 0%, transparent 70%)', bottom: '-10%', right: '-5%' }}
        animate={{ scale: [1, 1.08, 1], x: [0, -15, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute top-0 left-0 right-0 h-10 drag-region" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center no-drag select-none"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 220 }}
          className="mb-5 drop-shadow-2xl"
        >
          <AppLogo size={72} />
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gradient mb-1">FreelanceVault</h1>
          <p className="text-text-muted text-sm">
            {greeting}, <span className="text-text font-medium">{displayName}</span>
          </p>
        </motion.div>

        {/* PIN input */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <PinInput
            onComplete={handlePinComplete}
            error={error}
            onErrorClear={() => setError('')}
          />
        </motion.div>

        {/* Touch ID */}
        {touchIdAvailable && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-6">
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={handleTouchId}
              disabled={touchIdLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-text-muted hover:text-accent hover:border-accent/40 transition-all text-sm disabled:opacity-50"
            >
              {touchIdLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent"
                />
              ) : (
                <Fingerprint size={16} />
              )}
              Sign in with Touch ID
            </motion.button>
          </motion.div>
        )}

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-text-muted text-xs mt-8">
          All data stored locally on your device
        </motion.p>
      </motion.div>
    </div>
  )
}
