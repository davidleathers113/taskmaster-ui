import { motion } from 'framer-motion'
import { Grid3X3, Plus } from 'lucide-react'
import { useTaskStore } from '@/store/useTaskStore'
import { TaskCard } from '@/components/task/TaskCard'
import { cn } from '@/lib/utils'

const statusColumns = [
  { id: 'pending', title: 'Pending', color: 'bg-gray-100 dark:bg-gray-800' },
  { id: 'in-progress', title: 'In Progress', color: 'bg-blue-100 dark:bg-blue-900/20' },
  { id: 'review', title: 'Review', color: 'bg-purple-100 dark:bg-purple-900/20' },
  { id: 'done', title: 'Done', color: 'bg-emerald-100 dark:bg-emerald-900/20' }
]

export function KanbanView() {
  const { getFilteredTasks } = useTaskStore()
  const tasks = getFilteredTasks()

  const tasksByStatus = statusColumns.map(column => ({
    ...column,
    tasks: tasks.filter(task => task.status === column.id)
  }))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full p-6 overflow-hidden"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Grid3X3 className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Kanban Board</h2>
        </div>
        <p className="text-muted-foreground">
          Visualize your workflow across different task stages
        </p>
      </div>

      {/* Kanban columns */}
      <div className="flex space-x-6 h-full overflow-x-auto">
        {tasksByStatus.map((column, columnIndex) => (
          <motion.div
            key={column.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: columnIndex * 0.1 }}
            className="flex-shrink-0 w-80"
          >
            {/* Column header */}
            <div className={cn(
              "p-4 rounded-t-xl border border-b-0 border-border/50",
              column.color
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{column.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {column.tasks.length} tasks
                  </p>
                </div>
                <motion.button
                  className="p-1 rounded hover:bg-background/50 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Plus className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Column content */}
            <div className="bg-card border border-t-0 border-border/50 rounded-b-xl p-4 h-full overflow-y-auto">
              <div className="space-y-3">
                {column.tasks.map((task, taskIndex) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (columnIndex * 0.1) + (taskIndex * 0.05) }}
                    whileHover={{ scale: 1.02 }}
                    className="transform transition-transform"
                  >
                    <TaskCard 
                      task={task} 
                      index={taskIndex}
                      density="compact"
                    />
                  </motion.div>
                ))}
                
                {column.tasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="text-4xl mb-2">📋</div>
                    <p className="text-sm">No tasks in {column.title.toLowerCase()}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}