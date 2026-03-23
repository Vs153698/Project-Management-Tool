import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, FolderKanban, BarChart2, LogOut, ChevronDown, Banknote } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { AppView } from '../../types'
import AppLogo from '../ui/AppLogo'

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar',         symbol: '$'   },
  { code: 'EUR', label: 'Euro',              symbol: '€'   },
  { code: 'GBP', label: 'British Pound',     symbol: '£'   },
  { code: 'INR', label: 'Indian Rupee',      symbol: '₹'   },
  { code: 'CAD', label: 'Canadian Dollar',   symbol: 'CA$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$'  },
  { code: 'SGD', label: 'Singapore Dollar',  symbol: 'S$'  },
  { code: 'AED', label: 'UAE Dirham',        symbol: 'AED' },
  { code: 'JPY', label: 'Japanese Yen',      symbol: '¥'   },
  { code: 'CNY', label: 'Chinese Yuan',      symbol: '¥'   },
  { code: 'CHF', label: 'Swiss Franc',       symbol: 'CHF' },
  { code: 'BRL', label: 'Brazilian Real',    symbol: 'R$'  },
  { code: 'MXN', label: 'Mexican Peso',      symbol: 'MX$' },
  { code: 'KRW', label: 'South Korean Won',  symbol: '₩'   },
  { code: 'SEK', label: 'Swedish Krona',     symbol: 'kr'  },
  { code: 'NOK', label: 'Norwegian Krone',   symbol: 'kr'  },
]

interface NavItem {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  view: AppView
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',    view: 'dashboard'    },
  { icon: FolderKanban,    label: 'Projects',     view: 'projects'     },
  { icon: BarChart2,       label: 'Analytics',    view: 'analytics'    },
  { icon: Banknote,        label: 'Bank Details', view: 'bank-details' },
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
    <div
      className="w-[230px] h-full flex flex-col shrink-0 relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #3D6EF5 0%, #2B5CE5 100%)',
        userSelect: 'none',
      }}
    >
      {/* Subtle top-right glow blob */}
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      />

      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b drag-region" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-2.5 no-drag">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <AppLogo size={20} />
          </div>
          <span className="font-bold text-white tracking-tight text-sm">FreelanceVault</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="sidebar-section-label mt-1">Menu</p>

        {navItems.map(({ icon: Icon, label, view }) => {
          const isActive =
            currentView === view ||
            (currentView === 'project-detail' && view === 'projects')

          return (
            <motion.button
              key={view}
              onClick={() => handleNav(view)}
              whileTap={{ scale: 0.97 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-white text-sidebar font-semibold shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/15'
              }`}
            >
              <Icon
                size={17}
                className={isActive ? 'text-sidebar' : 'text-white/70'}
              />
              {label}
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar"
                />
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* Currency selector */}
      <div className="px-3 pb-2 relative">
        <p className="sidebar-section-label">Currency</p>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setCurrencyOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors text-sm"
          style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <span className="text-white font-bold text-base w-6 text-center leading-none">
            {selectedCurrency.symbol}
          </span>
          <div className="flex-1 text-left min-w-0">
            <p className="text-white text-xs font-semibold">{selectedCurrency.code}</p>
            <p className="text-white/50 text-[10px] truncate">{selectedCurrency.label}</p>
          </div>
          <motion.div animate={{ rotate: currencyOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={13} className="text-white/60" />
          </motion.div>
        </motion.button>

        {/* Currency dropdown — renders outside the sidebar (portal-like via z-index) */}
        <AnimatePresence>
          {currencyOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setCurrencyOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-border rounded-2xl shadow-float z-50 overflow-hidden"
              >
                <div className="max-h-60 overflow-y-auto py-1.5">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => handleCurrencySelect(c.code)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                        c.code === displayCurrency ? 'bg-primary/5' : ''
                      }`}
                    >
                      <span
                        className={`text-sm font-bold w-6 text-center ${c.code === displayCurrency ? 'text-primary' : 'text-text-muted'}`}
                      >
                        {c.symbol}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${c.code === displayCurrency ? 'text-primary' : 'text-text'}`}>
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

      {/* User + logout */}
      <div
        className="px-3 pb-4 pt-3"
        style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}
      >
        <div className="flex items-center gap-3 px-2 py-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-sidebar flex-shrink-0 bg-white"
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user?.name || 'User'}</p>
            <p className="text-white/50 text-xs truncate">Freelancer</p>
          </div>
        </div>

        <motion.button
          onClick={logout}
          whileTap={{ scale: 0.97 }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 text-white/70 hover:text-white hover:bg-white/15"
        >
          <LogOut size={16} />
          Sign Out
        </motion.button>
      </div>
    </div>
  )
}
