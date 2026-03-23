import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import Sidebar from './Sidebar'
import Dashboard from '../dashboard/Dashboard'
import ProjectList from '../projects/ProjectList'
import ProjectDetail from '../projects/ProjectDetail'
import Analytics from '../analytics/Analytics'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 }
}

export default function AppLayout(): JSX.Element {
  const { currentView, selectedProjectId } = useAppStore()

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />
      case 'projects':
        return <ProjectList />
      case 'project-detail':
        return selectedProjectId ? <ProjectDetail projectId={selectedProjectId} /> : <ProjectList />
      case 'analytics':
        return <Analytics />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView + (selectedProjectId || '')}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="h-full overflow-y-auto"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
