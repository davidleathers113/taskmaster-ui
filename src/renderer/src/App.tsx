import { useEffect, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTaskStore } from '@/store/useTaskStore'
import { useErrorHandledTaskStore } from '@/store/storeErrorWrapper'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MainContent } from '@/components/layout/MainContent'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { StoreErrorBoundary } from '@/components/error/StoreErrorBoundary'
import { SuspenseWrapper } from '@/components/ui/SuspenseWrapper'
import { DebugPanel } from '@/components/DebugPanel'
import { cn } from '@/lib/utils'

// Lazy load components for better performance and to demonstrate Suspense
const TaskDetailPanel = lazy(() => 
  import('@/components/task/TaskDetailPanel').then(module => ({ 
    default: module.TaskDetailPanel 
  }))
)

const CommandPalette = lazy(() => 
  import('@/components/ui/CommandPalette').then(module => ({ 
    default: module.CommandPalette 
  }))
)

const ProjectManager = lazy(() => 
  import('@/components/project/ProjectManager').then(module => ({ 
    default: module.ProjectManager 
  }))
)

function App() {
  // Use regular store for reactive state
  const { 
    userSettings, 
    sidebarCollapsed, 
    selectedTask
  } = useTaskStore()
  
  // Use error-handled store for operations
  const errorHandledStore = useErrorHandledTaskStore()

  useEffect(() => {
    // Load tasks from the sample JSON file (Vite asset handling)
    const loadTasks = async () => {
      try {
        // Vite handles assets in public directory via absolute paths
        const response = await fetch('/sample-tasks.json')
        const data = await response.json()
        await errorHandledStore.loadFromJSON(data)
      } catch (error) {
        console.error('Failed to load tasks:', error)
        // Load minimal sample data as fallback
        await errorHandledStore.loadFromJSON({ 
          tasks: [
            {
              id: 1,
              title: "Welcome to TaskMaster!",
              description: "This is a sample task to get you started with the most beautiful task management UI ever created.",
              details: "Explore the interface, try different views, and experience the buttery smooth animations that make this UI a work of art.",
              testStrategy: "Click around and enjoy the pixel-perfect design!",
              priority: "high" as const,
              dependencies: [],
              status: "pending" as const,
              subtasks: []
            }
          ]
        })
      }
    }
    
    loadTasks()
  }, [errorHandledStore.loadFromJSON])

  const isDark = userSettings.ui.theme === 'dark' || 
    (userSettings.ui.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <StoreErrorBoundary 
      enableAutoRecovery={true}
      maxAutoRecoveryAttempts={3}
      showDeveloperInfo={process.env.NODE_ENV === 'development'}
    >
      <div className={cn(
        "min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50",
        "dark:from-slate-950 dark:via-slate-900 dark:to-slate-950",
        "transition-all duration-500 ease-out",
        isDark && "dark"
      )}>
      {/* Debug Panel - Shows critical debug info */}
      <DebugPanel />
      
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/2 -right-1/2 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -bottom-1/2 -left-1/2 w-96 h-96 bg-gradient-to-tr from-emerald-400/20 to-cyan-600/20 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Main layout */}
      <div className="relative flex h-screen">
        {/* Sidebar */}
        <motion.div
          initial={false}
          animate={{
            width: sidebarCollapsed ? 80 : 280,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
          className="flex-shrink-0 border-r border-border/50 bg-background/80 backdrop-blur-xl"
        >
          <Sidebar />
        </motion.div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          
          <div className="flex-1 flex overflow-hidden">
            {/* Main content */}
            <motion.div
              className="flex-1 overflow-hidden"
              layout
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
            >
              <MainContent />
            </motion.div>

            {/* Task detail panel */}
            <AnimatePresence mode="wait">
              {selectedTask && (
                <motion.div
                  initial={{ x: "100%", opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: "100%", opacity: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                  className="w-96 border-l border-border/50 bg-background/80 backdrop-blur-xl"
                >
                  <ErrorBoundary level="component">
                    <SuspenseWrapper level="component" name="Task Detail Panel">
                      <TaskDetailPanel />
                    </SuspenseWrapper>
                  </ErrorBoundary>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Command Palette */}
      <ErrorBoundary level="component">
        <SuspenseWrapper level="component" name="Command Palette">
          <CommandPalette />
        </SuspenseWrapper>
      </ErrorBoundary>

      {/* Project Manager */}
      <ErrorBoundary level="component">
        <SuspenseWrapper level="component" name="Project Manager">
          <ProjectManager />
        </SuspenseWrapper>
      </ErrorBoundary>

      {/* Global loading overlay */}
      <AnimatePresence>
        {useTaskStore.getState().isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              }}
              className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
            />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </StoreErrorBoundary>
  )
}

export default App