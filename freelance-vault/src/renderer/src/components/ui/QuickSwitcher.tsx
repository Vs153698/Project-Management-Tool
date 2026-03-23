import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, FolderKanban, LayoutDashboard, BarChart2, Banknote, Shield, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { AppView } from '../../types'

interface SwitcherItem {
  id: string
  label: string
  sublabel?: string
  icon: React.ReactNode
  action: () => void
}

export default function QuickSwitcher(): JSX.Element | null {
  const { quickSwitcherOpen, setQuickSwitcherOpen, db, setView } = useAppStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setQuickSwitcherOpen(!quickSwitcherOpen)
      }
      if (e.key === 'Escape' && quickSwitcherOpen) {
        setQuickSwitcherOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [quickSwitcherOpen, setQuickSwitcherOpen])

  useEffect(() => {
    if (quickSwitcherOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [quickSwitcherOpen])

  const staticItems: SwitcherItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} />, action: () => navigate('dashboard') },
    { id: 'projects', label: 'All Projects', icon: <FolderKanban size={15} />, action: () => navigate('projects') },
    { id: 'analytics', label: 'Analytics', icon: <BarChart2 size={15} />, action: () => navigate('analytics') },
    { id: 'bank-details', label: 'Bank Details', icon: <Banknote size={15} />, action: () => navigate('bank-details') },
    { id: 'backup', label: 'Backup & Restore', icon: <Shield size={15} />, action: () => navigate('backup') },
  ]

  const navigate = (view: AppView, projectId?: string) => {
    setView(view, projectId)
    setQuickSwitcherOpen(false)
  }

  const projectItems: SwitcherItem[] = useMemo(
    () =>
      db.projects.map((p) => ({
        id: p.id,
        label: p.projectName,
        sublabel: p.projectType === 'personal' ? 'Personal' : p.clientName,
        icon: <FolderKanban size={15} className="text-accent" />,
        action: () => navigate('project-detail', p.id)
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.projects]
  )

  const allItems = [...staticItems, ...projectItems]

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems
    const q = query.toLowerCase()
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.sublabel?.toLowerCase().includes(q) ?? false)
    )
  }, [query, allItems])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      filtered[selectedIndex]?.action()
    }
  }

  if (!quickSwitcherOpen) return null

  return (
    <AnimatePresence>
      {quickSwitcherOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setQuickSwitcherOpen(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed left-0 right-0 top-[20%] mx-auto z-50 w-[560px] max-w-[90vw] bg-card border border-border rounded-2xl shadow-float overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search size={16} className="text-text-muted shrink-0" />
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-text placeholder-text-muted outline-none text-sm"
                placeholder="Search projects, views..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={() => setQuickSwitcherOpen(false)}
                className="text-text-muted hover:text-text transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto py-1.5">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-text-muted text-sm">No results</div>
              ) : (
                filtered.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      idx === selectedIndex ? 'bg-primary/10 text-text' : 'text-text-secondary hover:bg-surface'
                    }`}
                  >
                    <span className={idx === selectedIndex ? 'text-primary' : 'text-text-muted'}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-text-muted shrink-0">{item.sublabel}</span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[11px] text-text-muted">
              <span><kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">↵</kbd> open</span>
              <span><kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">Esc</kbd> close</span>
              <span className="ml-auto"><kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">⌘K</kbd> toggle</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
