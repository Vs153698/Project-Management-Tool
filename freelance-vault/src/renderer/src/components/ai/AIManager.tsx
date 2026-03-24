import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Key, Check, Eye, EyeOff, ExternalLink, ChevronRight, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { AIProvider, AIConfig } from '../../types'

interface ProviderInfo {
  id: AIProvider
  name: string
  description: string
  model: string
  keyPlaceholder: string
  keyField: keyof Pick<AIConfig, 'openaiKey' | 'geminiKey' | 'deepseekKey'>
  docsUrl: string
  color: string
  gradient: string
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o — most capable, best for code analysis',
    model: 'gpt-4o',
    keyPlaceholder: 'sk-...',
    keyField: 'openaiKey',
    docsUrl: 'https://platform.openai.com/api-keys',
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-500/40',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 1.5 Flash — fast and free tier available',
    model: 'gemini-1.5-flash',
    keyPlaceholder: 'AIza...',
    keyField: 'geminiKey',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    color: 'text-blue-400',
    gradient: 'from-blue-500/10 to-indigo-500/10 border-blue-500/20 hover:border-blue-500/40',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek Chat — very affordable, great reasoning',
    model: 'deepseek-chat',
    keyPlaceholder: 'sk-...',
    keyField: 'deepseekKey',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    color: 'text-violet-400',
    gradient: 'from-violet-500/10 to-purple-500/10 border-violet-500/20 hover:border-violet-500/40',
  },
]

const DEFAULT_CONFIG: AIConfig = {
  selectedProvider: 'openai',
  openaiKey: '',
  geminiKey: '',
  deepseekKey: '',
}

export default function AIManager(): JSX.Element {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<AIProvider, boolean>>({
    openai: false,
    gemini: false,
    deepseek: false,
  })

  useEffect(() => {
    window.electron.aiGetConfig().then((cfg) => {
      setConfig({
        selectedProvider: (cfg.selectedProvider as AIProvider) || 'openai',
        openaiKey: cfg.openaiKey || '',
        geminiKey: cfg.geminiKey || '',
        deepseekKey: cfg.deepseekKey || '',
      })
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await window.electron.aiSaveConfig(config)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const toggleShowKey = (provider: AIProvider) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }))
  }

  const selectedProvider = PROVIDERS.find((p) => p.id === config.selectedProvider)!
  const hasActiveKey = config[selectedProvider.keyField].trim().length > 0

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text">AI Manager</h1>
            <p className="text-text-muted text-sm">Configure your LLM provider to use AI features across DevVault</p>
          </div>
        </div>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${
        hasActiveKey
          ? 'bg-success/10 border-success/20'
          : 'bg-warning/10 border-warning/20'
      }`}>
        {hasActiveKey
          ? <CheckCircle2 size={16} className="text-success shrink-0" />
          : <AlertCircle size={16} className="text-warning shrink-0" />}
        <p className={`text-sm font-medium ${hasActiveKey ? 'text-success' : 'text-warning'}`}>
          {hasActiveKey
            ? `AI active — using ${selectedProvider.name} (${selectedProvider.model})`
            : `No API key set for ${selectedProvider.name}. Add your key below to enable AI features.`}
        </p>
      </div>

      {/* Provider selection */}
      <div>
        <p className="label mb-3">Select Provider</p>
        <div className="grid grid-cols-3 gap-3">
          {PROVIDERS.map((p) => {
            const isSelected = config.selectedProvider === p.id
            const hasKey = config[p.keyField].trim().length > 0
            return (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => setConfig((c) => ({ ...c, selectedProvider: p.id }))}
                className={`relative bg-gradient-to-br ${p.gradient} border rounded-xl p-4 text-left transition-all ${
                  isSelected ? 'ring-2 ring-primary/40 ring-offset-1 ring-offset-background' : ''
                }`}
              >
                {hasKey && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-success" title="Key configured" />
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </div>
                  </div>
                )}
                <p className={`font-bold text-sm mb-0.5 ${p.color}`}>{p.name}</p>
                <p className="text-text-muted text-xs leading-relaxed">{p.description}</p>
                <p className="text-text-muted/60 text-[10px] mt-2 font-mono">{p.model}</p>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* API Keys */}
      <div className="space-y-3">
        <p className="label">API Keys</p>
        {PROVIDERS.map((p) => (
          <div key={p.id} className={`bg-surface border rounded-xl p-4 space-y-2 transition-all ${
            config.selectedProvider === p.id ? 'border-primary/30' : 'border-border'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key size={13} className={p.color} />
                <span className="text-text text-sm font-medium">{p.name} API Key</span>
                {config.selectedProvider === p.id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                    Active
                  </span>
                )}
              </div>
              <a
                href={p.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-text-muted text-xs hover:text-primary transition-colors"
              >
                Get key
                <ExternalLink size={10} />
              </a>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKeys[p.id] ? 'text' : 'password'}
                  className="input w-full font-mono text-sm pr-10"
                  placeholder={p.keyPlaceholder}
                  value={config[p.keyField]}
                  onChange={(e) => setConfig((c) => ({ ...c, [p.keyField]: e.target.value }))}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey(p.id)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                >
                  {showKeys[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {config[p.keyField] && (
                <button
                  onClick={() => setConfig((c) => ({ ...c, [p.keyField]: '' }))}
                  className="btn-secondary text-sm py-1.5 px-3 text-danger border-danger/20 hover:bg-danger/10"
                >
                  Clear
                </button>
              )}
            </div>
            {config[p.keyField] && (
              <p className="text-success text-xs flex items-center gap-1">
                <Check size={11} />
                Key saved locally — never sent anywhere except the {p.name} API
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary py-2 px-6 disabled:opacity-50"
        >
          {saved ? (
            <>
              <CheckCircle2 size={15} className="text-white" />
              Saved!
            </>
          ) : saving ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check size={15} />
              Save Configuration
            </>
          )}
        </button>
        <p className="text-text-muted text-xs">Keys are stored locally on your device only.</p>
      </div>

      {/* AI Features overview */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-surface border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-primary" />
            <p className="text-text text-sm font-semibold">AI Features in DevVault</p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {[
            { label: 'LinkedIn Post Generator', desc: 'Reads your project code and generates a professional LinkedIn post, tech stack, and interview Q&A', where: 'Project → LinkedIn tab' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-3 px-4 py-3">
              <ChevronRight size={14} className="text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-text text-sm font-medium">{f.label}</p>
                <p className="text-text-muted text-xs">{f.desc}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-text-muted font-mono whitespace-nowrap">
                {f.where}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
