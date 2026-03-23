import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, FolderKanban, BarChart2, LogOut, ChevronDown } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { AppView } from '../../types'
import AppLogo from '../ui/AppLogo'

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'AED' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
  { code: 'BRL', label: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', label: 'Mexican Peso', symbol: 'MX$' },
  { code: 'KRW', label: 'South Korean Won', symbol: '₩' },
  { code: 'SEK', label: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', label: 'Norwegian Krone', symbol: 'kr' }
]

interface NavItem {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  view: AppView
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
  { icon: FolderKanban, label: 'Projects', view: 'projects' },
  { icon: BarChart2, label: 'Analytics', view: 'analytics' }
]

export default function Sidebar(): JSX.Element {
  const { currentView, setView, user, logout, displayCurrency, setCurrency } = useAppStore()
  const [currencyOpen, setCurrencyOpen] = useState(false)

  const handleNav = (view: AppView) => setView(view)

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'FV'

  const selectedCurrency = CURRENCIES.find((c) => c.code === displayCurrency) || CURRENCIES[0]

  const handleCurrencySelect = async (code: string) => {
    await setCurrency(code)
    setCurrencyOpen(false)
  }

  return (
    <div className="w-[240px] h-full flex flex-col border-r border-border bg-surface shrink-0 relative" style={{ userSelect: 'none' }}>
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-border drag-region">
        <div className="flex items-center gap-2.5 no-drag">
          <AppLogo size={32} />
          <span className="font-bold text-text tracking-tight">FreelanceVault</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider px-3 mb-3">
          Menu
        </p>
        {navItems.map(({ icon: Icon, label, view }) => {
          const isActive = currentView === view || (currentView === 'project-detail' && view === 'projects')
          return (
            <motion.button
              key={view}
              onClick={() => handleNav(view)}
              whileTap={{ scale: 0.97 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text hover:bg-card'
              }`}
            >
              <Icon size={17} className={isActive ? 'text-primary' : ''} />
              {label}
              {isActive && (
                <motion.div layoutId="sidebar-indicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* Currency selector */}
      <div className="px-3 pb-2 relative">
        <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider px-2 mb-2">
          Display Currency
        </p>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setCurrencyOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors text-sm"
        >
          <span className="text-primary font-bold text-base w-6 text-center leading-none">
            {selectedCurrency.symbol}
          </span>
          <div className="flex-1 text-left min-w-0">
            <p className="text-text text-xs font-medium">{selectedCurrency.code}</p>
            <p className="text-text-muted text-[10px] truncate">{selectedCurrency.label}</p>
          </div>
          <motion.div
            animate={{ rotate: currencyOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={13} className="text-text-muted" />
          </motion.div>
        </motion.button>

        {/* Currency dropdown */}
        <AnimatePresence>
          {currencyOpen && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setCurrencyOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-3 right-3 mb-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div className="max-h-60 overflow-y-auto py-1">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => handleCurrencySelect(c.code)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface transition-colors ${
                        c.code === displayCurrency ? 'bg-primary/10' : ''
                      }`}
                    >
                      <span className={`text-sm font-bold w-6 text-center ${c.code === displayCurrency ? 'text-primary' : 'text-text-muted'}`}>
                        {c.symbol}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${c.code === displayCurrency ? 'text-primary' : 'text-text'}`}>
                          {c.code}
                        </p>
                        <p className="text-text-muted text-[10px] truncate">{c.label}</p>
                      </div>
                      {c.code === displayCurrency && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* User section */}
      <div className="px-3 pb-4 border-t border-border pt-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text text-sm font-medium truncate">{user?.name || 'User'}</p>
            <p className="text-text-muted text-xs truncate">Freelancer</p>
          </div>
        </div>
        <motion.button
          onClick={logout}
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-danger hover:bg-danger/10 transition-all duration-200"
        >
          <LogOut size={16} />
          Sign Out
        </motion.button>
      </div>
    </div>
  )
}
