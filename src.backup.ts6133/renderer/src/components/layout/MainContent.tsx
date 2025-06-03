import { motion, AnimatePresence } from 'framer-motion'
import { useTaskStore } from '@/store/useTaskStore'
import { TaskListView } from '@/components/views/TaskListView'
import { KanbanView } from '@/components/views/KanbanView'
import { CalendarView } from '@/components/views/CalendarView'
import { TimelineView } from '@/components/views/TimelineView'
import { AnalyticsView } from '@/components/views/AnalyticsView'
import { } from '@/components/views/PerformanceDashboard'
import { ClaudeConfigPage } from '@/components/claude/ClaudeConfigPage'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { 
  TaskListErrorFallback,
  KanbanErrorFallback,
  AnalyticsErrorFallback,
  CalendarErrorFallback,
  TimelineErrorFallback,
  GenericViewErrorFallback
} from '@/components/error/ViewErrorFallbacks'
import { createViewErrorHandler } from '@/utils/errorLogging'

// Enhanced view configuration with error boundary settings
const viewConfigs = {
  list: {
    component: TaskListView,
    errorFallback: TaskListErrorFallback,
    displayName: 'Task List',
    enableStatePreservation: true
  },
  kanban: {
    component: KanbanView,
    errorFallback: KanbanErrorFallback,
    displayName: 'Kanban Board',
    enableStatePreservation: true
  },
  calendar: {
    component: CalendarView,
    errorFallback: CalendarErrorFallback,
    displayName: 'Calendar View',
    enableStatePreservation: true
  },
  timeline: {
    component: TimelineView,
    errorFallback: TimelineErrorFallback,
    displayName: 'Timeline View',
    enableStatePreservation: true
  },
  analytics: {
    component: AnalyticsView,
    errorFallback: AnalyticsErrorFallback,
    displayName: 'Analytics View',
    enableStatePreservation: false // Analytics can be regenerated
  },
  'claude-config': {
    component: ClaudeConfigPage,
    errorFallback: (props: any) => <GenericViewErrorFallback {...props} viewType="Claude Config" />,
    displayName: 'Claude Configuration',
    enableStatePreservation: false
  }
} as const

export function MainContent() {
  const { viewMode, getFilteredTasks, setViewMode } = useTaskStore()
  const tasks = getFilteredTasks()
  
  // Get view configuration with fallback for unknown view types
  const viewConfig = viewConfigs[viewMode.type as keyof typeof viewConfigs] || {
    component: () => <div>Unknown view type: {viewMode.type}</div>,
    errorFallback: (props: any) => <GenericViewErrorFallback {...props} viewType={viewMode.type} />,
    displayName: viewMode.type,
    enableStatePreservation: false
  }

  const { component: ViewComponent, errorFallback: ErrorFallback, displayName, enableStatePreservation } = viewConfig

  // Create view-specific error handler
  const handleViewError = createViewErrorHandler(viewMode.type)

  // Enhanced error recovery actions
  const errorRecoveryActions = {
    onRetry: () => {
      // Force re-render by updating view mode timestamp or similar
      console.info(`Retrying ${displayName} view`)
    },
    onGoHome: () => {
      setViewMode({ type: 'list' })
    },
    onReload: () => {
      window.location.reload()
    }
  }

  // Create reset key for automatic error recovery when data changes
  const resetKey = `${viewMode.type}_${tasks.length}_${JSON.stringify(viewMode)}`

  return (
    <motion.main 
      className="h-full overflow-hidden bg-background/30"
      layout
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode.type}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
          className="h-full"
        >
          {/* Wrap view component with error boundary */}
          <ErrorBoundary
            level="component"
            viewType={viewMode.type}
            resetKey={resetKey}
            enableStatePreservation={enableStatePreservation}
            onError={handleViewError}
            fallback={<ErrorFallback {...errorRecoveryActions} />}
          >
            {tasks.length === 0 && viewMode.type !== 'analytics' && viewMode.type !== 'claude-config' ? (
              <ErrorBoundary
                level="component"
                viewType="empty-state"
                resetKey={`empty_${resetKey}`}
                fallback={
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>Unable to display empty state</p>
                  </div>
                }
              >
                <EmptyState />
              </ErrorBoundary>
            ) : (
              <ViewComponent />
            )}
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </motion.main>
  )
}