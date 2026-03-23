import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, AlertCircle, Loader2, FolderOpen, Code2, ChevronRight } from 'lucide-react'
import type { Framework } from '../../types'

interface FrameworkOption {
  id: Framework
  label: string
  description: string
  badge: string
  emoji: string
  gradient: string
  defaultName: string
}

const FRAMEWORKS: FrameworkOption[] = [
  {
    id: 'vite',
    label: 'Vite + React',
    description: 'Lightning-fast React app with TypeScript',
    badge: 'Latest',
    emoji: '⚡',
    gradient: 'from-yellow-500/15 to-orange-500/15 border-yellow-500/25 hover:border-yellow-500/50',
    defaultName: 'frontend',
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    description: 'Full-stack React with App Router & Tailwind',
    badge: 'Latest',
    emoji: '▲',
    gradient: 'from-slate-500/15 to-zinc-500/15 border-slate-500/25 hover:border-slate-400/50',
    defaultName: 'web',
  },
  {
    id: 'node-backend',
    label: 'Node.js Backend',
    description: 'Express + TypeScript REST API boilerplate',
    badge: 'Latest',
    emoji: '🟢',
    gradient: 'from-green-500/15 to-emerald-500/15 border-green-500/25 hover:border-green-500/50',
    defaultName: 'backend',
  },
  {
    id: 'python-backend',
    label: 'Python Backend',
    description: 'FastAPI with async support & CORS',
    badge: 'Latest',
    emoji: '🐍',
    gradient: 'from-blue-500/15 to-cyan-500/15 border-blue-500/25 hover:border-blue-500/50',
    defaultName: 'api',
  },
  {
    id: 'agent-ai',
    label: 'AI Agent',
    description: 'Claude API agent with tool use & streaming',
    badge: 'Claude Opus 4.6',
    emoji: '🤖',
    gradient: 'from-purple-500/15 to-violet-500/15 border-purple-500/25 hover:border-purple-500/50',
    defaultName: 'agent',
  },
  {
    id: 'agent-orchestration',
    label: 'Agent Orchestration',
    description: 'Multi-agent system: Researcher → Writer → Reviewer',
    badge: 'Claude Opus 4.6',
    emoji: '🧠',
    gradient: 'from-pink-500/15 to-rose-500/15 border-pink-500/25 hover:border-pink-500/50',
    defaultName: 'agents',
  },
]

type Step = 'select' | 'configure' | 'generating' | 'done' | 'error'

interface Props {
  projectId: string
  onClose: () => void
  onComplete?: (folderName: string) => void
}

export default function CodeGeneratorModal({ projectId, onClose, onComplete }: Props): JSX.Element {
  const [step, setStep] = useState<Step>('select')
  const [selected, setSelected] = useState<FrameworkOption | null>(null)
  const [folderName, setFolderName] = useState('')
  const [initShadcn, setInitShadcn] = useState(false)
  const [error, setError] = useState('')
  const [generatedPath, setGeneratedPath] = useState('')

  const handleSelect = (fw: FrameworkOption) => {
    setSelected(fw)
    setFolderName(fw.defaultName)
    setStep('configure')
  }

  const handleGenerate = async () => {
    if (!selected || !folderName.trim()) return
    setStep('generating')
    setError('')

    const result = await window.electron.codeGenerate({
      projectId,
      folderName: folderName.trim(),
      framework: selected.id,
      initShadcn,
    })

    if (result.success) {
      setGeneratedPath(result.path ?? '')
      setStep('done')
      onComplete?.(folderName.trim())
    } else {
      setError(result.error ?? 'Generation failed')
      setStep('error')
    }
  }

  const openInFinder = () => {
    if (generatedPath) window.electron.folderOpen(generatedPath)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="modal-content max-w-2xl w-full"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Code2 size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Generate Code Folder</h2>
              <p className="text-text-muted text-xs">Scaffold a project with the latest setup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text p-1.5 rounded-lg hover:bg-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {/* Step: Select Framework */}
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="p-6"
            >
              <p className="text-text-muted text-sm mb-4">Choose a framework to scaffold inside your project folder:</p>
              <div className="grid grid-cols-2 gap-3">
                {FRAMEWORKS.map((fw) => (
                  <motion.button
                    key={fw.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(fw)}
                    className={`bg-gradient-to-br ${fw.gradient} border rounded-xl p-4 text-left transition-all group`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{fw.emoji}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-text-muted font-medium">
                        {fw.badge}
                      </span>
                    </div>
                    <p className="text-text font-semibold text-sm">{fw.label}</p>
                    <p className="text-text-muted text-xs mt-0.5 leading-relaxed">{fw.description}</p>
                    <div className="flex items-center gap-1 mt-3 text-text-muted group-hover:text-text transition-colors">
                      <span className="text-xs">Select</span>
                      <ChevronRight size={12} />
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step: Configure */}
          {step === 'configure' && selected && (
            <motion.div
              key="configure"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="p-6 space-y-5"
            >
              {/* Selected framework badge */}
              <div className={`bg-gradient-to-br ${selected.gradient} border rounded-xl p-4 flex items-center gap-3`}>
                <span className="text-2xl">{selected.emoji}</span>
                <div>
                  <p className="text-text font-semibold">{selected.label}</p>
                  <p className="text-text-muted text-xs">{selected.description}</p>
                </div>
                <button
                  onClick={() => setStep('select')}
                  className="ml-auto text-text-muted hover:text-text text-xs underline"
                >
                  Change
                </button>
              </div>

              {/* Folder name */}
              <div>
                <label className="label">Folder Name</label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-'))}
                  placeholder="e.g. frontend, backend, web"
                  className="input"
                  autoFocus
                />
                <p className="text-text-muted text-xs mt-1">
                  Will be created at <span className="text-accent font-mono">projects/{projectId}/{folderName || '...'}</span>
                </p>
              </div>

              {/* Shadcn option (only for Vite & Next.js) */}
              {(selected.id === 'vite' || selected.id === 'nextjs') && (
                <div
                  onClick={() => setInitShadcn((v) => !v)}
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    initShadcn
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border bg-surface hover:border-border/80'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      initShadcn ? 'border-primary bg-primary' : 'border-border'
                    }`}
                  >
                    {initShadcn && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <div>
                    <p className="text-text text-sm font-medium">Initialize shadcn/ui</p>
                    <p className="text-text-muted text-xs">Add beautiful, accessible components to your project</p>
                  </div>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-text-muted">Optional</span>
                </div>
              )}

              {/* Info for non-npm frameworks */}
              {(selected.id === 'node-backend' || selected.id === 'python-backend' || selected.id === 'agent-ai' || selected.id === 'agent-orchestration') && (
                <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 text-xs text-accent">
                  {selected.id === 'python-backend'
                    ? 'Run pip install -r requirements.txt after generation.'
                    : 'Run npm install inside the folder after generation.'}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setStep('select')} className="btn-secondary flex-1 justify-center">
                  Back
                </button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGenerate}
                  disabled={!folderName.trim()}
                  className="btn-primary flex-1 justify-center"
                >
                  Generate
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step: Generating */}
          {step === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-12 flex flex-col items-center justify-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 size={28} className="text-primary" />
                </motion.div>
              </div>
              <div className="text-center">
                <p className="text-text font-semibold">Scaffolding {selected?.label}…</p>
                <p className="text-text-muted text-sm mt-1">
                  Installing latest packages. This may take a minute.
                </p>
              </div>
              <div className="flex gap-1.5 mt-2">
                {[0, 0.2, 0.4].map((delay) => (
                  <motion.div
                    key={delay}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay }}
                    className="w-2 h-2 rounded-full bg-primary"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-10 flex flex-col items-center justify-center gap-4 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center"
              >
                <CheckCircle2 size={32} className="text-success" />
              </motion.div>
              <div>
                <p className="text-text font-bold text-lg">
                  {selected?.label} ready!
                </p>
                <p className="text-text-muted text-sm mt-1">
                  <span className="font-mono text-accent">{folderName}</span> has been scaffolded with a FreelanceVault branded home page.
                </p>
              </div>
              <div className="flex gap-3 mt-2 w-full max-w-xs">
                <button onClick={openInFinder} className="btn-secondary flex-1 justify-center text-sm py-2">
                  <FolderOpen size={14} />
                  Open Folder
                </button>
                <button onClick={onClose} className="btn-primary flex-1 justify-center text-sm py-2">
                  Done
                </button>
              </div>
            </motion.div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8 flex flex-col items-center gap-4 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center">
                <AlertCircle size={28} className="text-danger" />
              </div>
              <div>
                <p className="text-text font-semibold">Generation failed</p>
                <p className="text-text-muted text-xs mt-2 max-w-sm font-mono bg-surface rounded-lg p-3 text-left border border-border">
                  {error}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary">Close</button>
                <button onClick={() => setStep('configure')} className="btn-primary">Try Again</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
