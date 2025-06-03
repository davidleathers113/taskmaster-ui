import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useTaskStore } from '@/store/useTaskStore'
import { TaskCard } from '@/components/task/TaskCard'
import { cn } from '@/lib/utils'
import { useViewStatePreservation } from '@/hooks/useViewStatePreservation'

export function TaskListView() {
  const { getFilteredTasks, viewMode } = useTaskStore()
  const tasks = getFilteredTasks()

  // State preservation for TaskListView
  const [viewState, setViewState] = useState(() => ({
    scrollPosition: 0,
    expandedTasks: [] as string[],
    lastSelectedTask: null as string | null,
    loadMoreThreshold: 50
  }))

  const { loadSavedState } = useViewStatePreservation(
    'taskList',
    viewState,
    [viewState] // Auto-save when viewState changes
  )

  // Load saved state on mount
  useEffect(() => {
    const savedState = loadSavedState()
    if (savedState) {
      setViewState(prev => ({ ...prev, ...savedState }))
    }
  }, [loadSavedState])

  // Restore scroll position after render
  useEffect(() => {
    if (viewState.scrollPosition > 0) {
      requestAnimationFrame(() => {
        const container = document.querySelector('.task-list-container')
        if (container) {
          container.scrollTop = viewState.scrollPosition
        }
      })
    }
  }, [tasks.length, viewState.scrollPosition])

  // Handle scroll position tracking
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop
    setViewState(prev => ({ ...prev, scrollPosition: scrollTop }))
  }

  // Future handler for task selection/expansion support
  // const handleTaskSelect = (taskId: string) => {
  //   setViewState(prev => ({
  //     ...prev,
  //     lastSelectedTask: taskId
  //   }))
  // }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25,
      },
    },
  }

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold mb-2">No tasks found</h3>
          <p className="text-muted-foreground">Create your first task to get started</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="h-full overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div 
        className="h-full p-6 task-list-container overflow-y-auto"
        onScroll={handleScroll}
      >
        {/* Header */}
        <motion.div 
          className="mb-6"
          variants={itemVariants}
        >
          <h2 className="text-2xl font-bold mb-2">All Tasks</h2>
          <p className="text-muted-foreground">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} found
          </p>
        </motion.div>

        {/* Task list */}
        <motion.div
          className={cn(
            "space-y-3",
            viewMode.density === 'compact' && "space-y-2",
            viewMode.density === 'spacious' && "space-y-4"
          )}
          variants={containerVariants}
        >
          {tasks.map((task, index) => (
            <motion.div
              key={task.id}
              variants={itemVariants}
              whileHover={{ 
                scale: 1.01,
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.99 }}
            >
              <TaskCard 
                task={task} 
                index={index}
                density={viewMode.density}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Load more placeholder */}
        {tasks.length > 50 && (
          <motion.div
            className="mt-8 text-center"
            variants={itemVariants}
          >
            <button className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Load more tasks...
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}