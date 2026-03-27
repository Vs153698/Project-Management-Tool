import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HardDrive, Cpu } from 'lucide-react'
import MacStorageScanner from '../scanner/MacStorageScanner'
import MacMaster from '../master/MacMaster'

type MacTab = 'cleaner' | 'master'

export default function MacTools(): JSX.Element {
  const [activeTab, setActiveTab] = useState<MacTab>('cleaner')

  const tabs: { key: MacTab; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      key: 'cleaner',
      label: 'Mac Cleaner',
      icon: <HardDrive size={16} />,
      desc: 'Scan large files, caches & project directories'
    },
    {
      key: 'master',
      label: 'Mac Master',
      icon: <Cpu size={16} />,
      desc: 'Full storage breakdown & smart cleanup'
    }
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 pt-6 pb-0 border-b border-border">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-text">Mac Tools</h1>
          <p className="text-text-muted text-sm mt-0.5">Storage management and cleanup utilities</p>
        </div>

        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tab-btn ${activeTab === tab.key ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            >
              <span className="flex items-center gap-1.5">
                {tab.icon}
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'cleaner' && <MacStorageScanner />}
            {activeTab === 'master' && <MacMaster />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
