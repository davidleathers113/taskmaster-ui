import { motion, AnimatePresence } from 'framer-motion'
import { useTaskStore } from '@/store/useTaskStore'
import { TaskListView } from '@/components/views/TaskListView'
import { KanbanView } from '@/components/views/KanbanView'
import { CalendarView } from '@/components/views/CalendarView'
import { TimelineView } from '@/components/views/TimelineView'
import { AnalyticsView } from '@/components/views/AnalyticsView'
import { PerformanceDashboard } from '@/components/views/PerformanceDashboard'
import { ClaudeConfigPage } from '@/components/claude/ClaudeConfigPage'
import { EmptyState } from '@/components/ui/EmptyState'

const viewComponents = {
  list: TaskListView,
  kanban: KanbanView,
  calendar: CalendarView,
  timeline: TimelineView,
  analytics: AnalyticsView,
  performance: PerformanceDashboard,
  'claude-config': ClaudeConfigPage
}

export function MainContent() {
  const { viewMode, getFilteredTasks } = useTaskStore()
  const tasks = getFilteredTasks()
  const ViewComponent = viewComponents[viewMode.type]

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
          {tasks.length === 0 && viewMode.type !== 'analytics' && viewMode.type !== 'claude-config' && viewMode.type !== 'performance' ? (
            <EmptyState />
          ) : (
            <ViewComponent />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.main>
  )
}