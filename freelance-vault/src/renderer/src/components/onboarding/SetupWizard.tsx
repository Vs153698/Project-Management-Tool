import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  Shield,
  BarChart2,
  Lock,
  Files,
  Check,
  Delete,
  Grid3x3
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import AppLogo from '../ui/AppLogo'

const PIN_LENGTH = 4

// ── Reusable PIN input (keyboard-first, optional virtual keypad) ──────────────
interface PinFieldProps {
  pin: string
  onChange: (pin: string) => void
  error?: string
  autoFocus?: boolean
}

function PinField({ pin, onChange, error, autoFocus = true }: PinFieldProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showKeypad, setShowKeypad] = useState(false)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)
    onChange(val)
  }

  const pressKey = (d: string) => onChange((pin + d).slice(0, PIN_LENGTH))
  const deleteKey = () => onChange(pin.slice(0, -1))

  const numRows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']]

  return (
    <div className="flex flex-col items-center">
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
      <div
        className="flex gap-4 cursor-text mb-2"
        onClick={() => inputRef.current?.focus()}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              scale: i === pin.length - 1 ? [1.3, 1] : 1,
              backgroundColor: i < pin.length ? (error ? '#ef4444' : '#3D6EF5') : '#E5E7EB'
            }}
            transition={{ duration: 0.15 }}
            className="w-3.5 h-3.5 rounded-full border-2"
            style={{ borderColor: i < pin.length ? (error ? '#ef4444' : '#3D6EF5') : '#D1D5DB' }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 mt-2">
        <p className="text-text-muted text-xs">Type with keyboard</p>
        <span className="text-border text-xs">·</span>
        <button
          type="button"
          onClick={() => { setShowKeypad((v) => !v); inputRef.current?.focus() }}
          className="text-xs text-text-muted hover:text-text flex items-center gap-1 transition-colors"
        >
          <Grid3x3 size={11} />
          {showKeypad ? 'Hide' : 'Show'} keypad
        </button>
      </div>

      <AnimatePresence>
        {showKeypad && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-4"
          >
            <div className="space-y-2">
              {numRows.map((row, ri) => (
                <div key={ri} className="flex gap-2.5">
                  {row.map((d) => (
                    <motion.button
                      key={d}
                      type="button"
                      whileTap={{ scale: 0.88, backgroundColor: 'rgba(61,110,245,0.12)' }}
                      onClick={() => pressKey(d)}
                      className="w-14 h-12 rounded-xl text-lg font-semibold text-text flex items-center justify-center select-none"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                    >
                      {d}
                    </motion.button>
                  ))}
                </div>
              ))}
              <div className="flex gap-2.5">
                <div className="w-14 h-12" />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88, backgroundColor: 'rgba(61,110,245,0.12)' }}
                  onClick={() => pressKey('0')}
                  className="w-14 h-12 rounded-xl text-lg font-semibold text-text flex items-center justify-center select-none"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                >
                  0
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  onClick={deleteKey}
                  disabled={pin.length === 0}
                  className="w-14 h-12 rounded-xl flex items-center justify-center text-text-muted hover:text-text disabled:opacity-20"
                  style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}
                >
                  <Delete size={16} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Setup Wizard ──────────────────────────────────────────────────────────────
export default function SetupWizard(): JSX.Element {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')

  const [pinPhase, setPinPhase] = useState<'create' | 'confirm'>('create')
  const [pin, setPin] = useState('')
  const [savedPin, setSavedPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinShaking, setPinShaking] = useState(false)

  const [rootFolder, setRootFolder] = useState('~/Documents')
  const [folderError, setFolderError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [setupError, setSetupError] = useState('')
  const { initialize } = useAppStore()

  // When PIN reaches length, auto-advance
  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return
    const t = setTimeout(() => {
      if (pinPhase === 'create') {
        setSavedPin(pin)
        setPinPhase('confirm')
        setPin('')
        setPinError('')
      } else {
        if (pin === savedPin) {
          // Advance to folder step
          setStep(3)
          setPin('')
        } else {
          setPinError('PINs do not match. Try again.')
          setPinShaking(true)
          setTimeout(() => {
            setPinShaking(false)
            setPin('')
            setSavedPin('')
            setPinPhase('create')
            setPinError('')
          }, 750)
        }
      }
    }, 200)
    return () => clearTimeout(t)
  }, [pin, pinPhase, savedPin])

  const resetPin = useCallback(() => {
    setPin('')
    setSavedPin('')
    setPinPhase('create')
    setPinError('')
    setPinShaking(false)
  }, [])

  const selectFolder = async () => {
    const folder = await window.electron.selectFolder()
    if (folder) { setRootFolder(folder); setFolderError('') }
  }

  const handleNext = () => {
    if (step === 0) {
      setStep(1)
    } else if (step === 1) {
      if (!name.trim()) { setNameError('Please enter your name'); return }
      setNameError('')
      setStep(2)
      resetPin()
    }
    // step 2 auto-advances via useEffect
    // step 3 uses handleComplete
  }

  const handleComplete = async () => {
    if (!rootFolder || rootFolder === '~/Documents') {
      const folder = await window.electron.selectFolder()
      if (!folder) { setFolderError('Please select a folder to continue'); return }
      setRootFolder(folder)
      return
    }
    setIsLoading(true)
    setSetupError('')
    try {
      const result = await window.electron.setupComplete({
        rootFolder: rootFolder.startsWith('~')
          ? rootFolder.replace('~', (globalThis as { HOME?: string }).HOME || '/Users/user')
          : rootFolder,
        name: name.trim(),
        pin: savedPin
      })
      if (result.success) {
        await initialize()
      } else {
        setSetupError(result.error || 'Setup failed. Please try again.')
        setIsLoading(false)
      }
    } catch (err) {
      setSetupError(String(err))
      setIsLoading(false)
    }
  }

  const features = [
    { icon: BarChart2, title: 'Project Tracking', desc: 'Clients, deadlines & status at a glance' },
    { icon: Shield, title: 'Payment Timeline', desc: 'Track advances, milestones & final payments' },
    { icon: Lock, title: 'Credential Vault', desc: 'Securely store API keys & passwords' },
    { icon: Files, title: 'File Manager', desc: 'All project files organized in one place' }
  ]

  const steps = ['Welcome', 'Profile', 'PIN', 'Location']

  return (
    <div className="h-screen w-screen bg-background flex items-center justify-center overflow-hidden relative">
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(61,110,245,0.09) 0%, transparent 70%)', top: '-20%', left: '-15%' }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,201,160,0.07) 0%, transparent 70%)', bottom: '-10%', right: '-10%' }}
      />
      <div className="absolute top-0 left-0 right-0 h-10 drag-region" />

      <div className="w-full max-w-md px-6 no-drag">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 transition-all duration-300 ${i < step ? 'text-success' : i === step ? 'text-primary' : 'text-text-muted'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
                  i < step ? 'bg-success border-success text-white' : i === step ? 'border-primary text-primary' : 'border-border text-text-muted'
                }`}>
                  {i < step ? <Check size={11} /> : i + 1}
                </div>
                <span className="text-[11px] font-medium hidden sm:block">{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-6 h-px transition-all duration-300 ${i < step ? 'bg-success' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="text-center mb-7">
                <div className="flex justify-center mb-4">
                  <AppLogo size={64} />
                </div>
                <h1 className="text-2xl font-bold text-gradient mb-1.5">Welcome to DevVault</h1>
                <p className="text-text-muted text-sm">Your developer workspace — projects, code, AI tools & more.</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {features.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="bg-card border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Icon size={14} className="text-primary" />
                    </div>
                    <p className="text-text text-xs font-semibold">{title}</p>
                    <p className="text-text-muted text-[11px] mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Step 1: Name ── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-text mb-1">What should we call you?</h2>
                <p className="text-text-muted text-sm">Stored locally on your device only.</p>
              </div>
              <div>
                <label className="label">Your Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  placeholder="Alex Johnson"
                  className="input text-lg py-3"
                  autoFocus
                />
                {nameError && <p className="text-danger text-xs mt-1.5">{nameError}</p>}
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Create PIN ── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold text-text mb-1">
                  {pinPhase === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
                </h2>
                <p className="text-text-muted text-sm">
                  {pinPhase === 'create' ? 'A 4-digit PIN protects your vault.' : 'Enter the same PIN again.'}
                </p>
              </div>

              <motion.div animate={pinShaking ? { x: [-8, 8, -6, 6, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
                <PinField
                  pin={pin}
                  onChange={setPin}
                  error={pinError || undefined}
                  autoFocus
                />
              </motion.div>

              {pinError && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-danger text-xs text-center mt-3">
                  {pinError}
                </motion.p>
              )}

              <p className="text-text-muted text-xs text-center mt-4">
                {pinPhase === 'create' ? 'Step 1/2 — Enter your PIN' : 'Step 2/2 — Confirm your PIN'}
              </p>
            </motion.div>
          )}

          {/* ── Step 3: Choose Folder ── */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-text mb-1">Choose vault location</h2>
                <p className="text-text-muted text-sm">DevVault will create a folder here for all your data and project files.</p>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <FolderOpen size={16} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-muted text-[11px] mb-0.5">Selected location</p>
                    <p className="text-text text-sm font-mono truncate">{rootFolder}</p>
                  </div>
                  <button onClick={selectFolder} className="btn-secondary text-xs py-1.5 px-3 shrink-0">
                    Browse
                  </button>
                </div>
              </div>

              {folderError && <p className="text-danger text-xs mb-2">{folderError}</p>}

              <div className="bg-surface border border-border rounded-xl p-3.5 text-xs text-text-muted font-mono space-y-1 mb-4">
                <p className="font-sans font-medium text-text text-[11px] uppercase tracking-wider mb-1.5">Will be created:</p>
                <p>📁 {rootFolder}/DevVault/</p>
                <p className="pl-5">📁 data/ &nbsp;&nbsp;&nbsp; ← database</p>
                <p className="pl-5">📁 projects/ ← your project files</p>
              </div>

              {setupError && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 mb-3">
                  <p className="text-danger text-sm">{setupError}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation (hidden on PIN step) */}
        {step !== 2 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => { setStep(Math.max(0, step - 1)); setNameError(''); setFolderError('') }}
              disabled={step === 0}
              className="btn-secondary disabled:opacity-0 text-sm"
            >
              <ChevronLeft size={15} />
              Back
            </button>

            <motion.button
              onClick={step === 3 ? handleComplete : handleNext}
              disabled={isLoading}
              whileTap={{ scale: 0.97 }}
              className="px-5 py-2.5 rounded-xl font-semibold text-white flex items-center gap-2 text-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #3D6EF5 0%, #10C9A0 100%)', boxShadow: '0 4px 20px rgba(61,110,245,0.30)' }}
            >
              {isLoading ? (
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-white" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </div>
              ) : step === 3 ? (
                <><Check size={15} />Launch DevVault</>
              ) : step === 0 ? (
                <>Get Started<ChevronRight size={15} /></>
              ) : (
                <>Continue<ChevronRight size={15} /></>
              )}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  )
}
