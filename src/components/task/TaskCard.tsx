import React from 'react'
import { motion } from 'framer-motion'
import { 
  Clock, 
  User, 
  Calendar, 
  CheckCircle2, 
  Circle, 
  AlertTriangle,
  Target,
  ChevronRight,
  MoreHorizontal,
  Link2
} from 'lucide-react'
import { Task } from '@/types'
import { useTaskStore } from '@/store/useTaskStore'
import { cn, getPriorityColor, getStatusColor, calculateTaskProgress, formatDate } from '@/lib/utils'

interface TaskCardProps {
  task: Task
  index: number
  density?: 'compact' | 'comfortable' | 'spacious'
}

export function TaskCard({ task, index, density = 'comfortable' }: TaskCardProps) {
  const { setSelectedTask, updateTask } = useTaskStore()
  const progress = calculateTaskProgress(task)

  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    updateTask(task.id, { status: newStatus })
  }

  const handleCardClick = () => {
    setSelectedTask(task)
  }

  const priorityIcon = {
    high: <AlertTriangle className="w-4 h-4" />,
    medium: <Target className="w-4 h-4" />,
    low: <Circle className="w-4 h-4" />
  }

  const statusIcon = task.status === 'done' ? 
    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : 
    <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ 
        y: -2,
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
      }}
      className={cn(
        "group relative bg-card border border-border/50 rounded-xl overflow-hidden",
        "hover:border-border transition-all duration-300 cursor-pointer",
        "glass-morphism hover:bg-card/80",
        density === 'compact' && "p-3",
        density === 'comfortable' && "p-4",
        density === 'spacious' && "p-6"
      )}
      onClick={handleCardClick}
    >
      {/* Priority stripe */}
      <div 
        className={cn(
          "absolute top-0 left-0 w-1 h-full",
          task.priority === 'high' && "bg-red-500",
          task.priority === 'medium' && "bg-orange-500",
          task.priority === 'low' && "bg-green-500"
        )}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          {/* Status toggle */}
          <motion.button
            onClick={handleStatusToggle}
            className="mt-1 flex-shrink-0"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {statusIcon}
          </motion.button>

          {/* Task info */}
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "font-semibold text-foreground line-clamp-2",
              task.status === 'done' && "line-through text-muted-foreground",
              density === 'compact' && "text-sm",
              density === 'comfortable' && "text-base",
              density === 'spacious' && "text-lg"
            )}>
              {task.title}
            </h3>
            
            {density !== 'compact' && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          <motion.button
            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-accent transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-4 h-4" />
          </motion.button>
          
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Progress bar */}
      {task.subtasks.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-4">
          {/* Priority */}
          <div className={cn(
            "flex items-center space-x-1 px-2 py-1 rounded-full border",
            getPriorityColor(task.priority)
          )}>
            {priorityIcon[task.priority]}
            <span className="capitalize">{task.priority}</span>
          </div>

          {/* Status */}
          <div className={cn(
            "flex items-center space-x-1 px-2 py-1 rounded-full border",
            getStatusColor(task.status)
          )}>
            <span className="capitalize">{task.status.replace('-', ' ')}</span>
          </div>

          {/* Dependencies */}
          {task.dependencies.length > 0 && (
            <div className="flex items-center space-x-1 text-amber-600">
              <Link2 className="w-3 h-3" />
              <span>{task.dependencies.length}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {/* Subtasks count */}
          {task.subtasks.length > 0 && (
            <div className="flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>
                {task.subtasks.filter(s => s.status === 'done').length}/{task.subtasks.length}
              </span>
            </div>
          )}

          {/* Due date */}
          {task.dueDate && (
            <div className="flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(task.dueDate)}</span>
            </div>
          )}

          {/* Estimated time */}
          {task.estimatedHours && (
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{task.estimatedHours}h</span>
            </div>
          )}

          {/* Assignee */}
          {task.assignee && (
            <div className="flex items-center space-x-1">
              <User className="w-3 h-3" />
              <span>{task.assignee}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover effects */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        initial={false}
      />
    </motion.div>
  )
}