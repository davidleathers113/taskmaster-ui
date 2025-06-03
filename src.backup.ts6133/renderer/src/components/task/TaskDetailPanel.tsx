import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Clock, 
  Target, 
  Link2, 
  CheckCircle2, 
  Plus,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
  MessageSquare,
  Flag
} from 'lucide-react'
import { useTaskStore } from '@/store/useTaskStore'
import { cn, getPriorityColor, getStatusColor, calculateTaskProgress, formatDate } from '@/lib/utils'

export function TaskDetailPanel() {
  const { selectedTask, setSelectedTask, updateTask, addSubtask } = useTaskStore()
  const [activeTab, setActiveTab] = useState<'overview' | 'subtasks' | 'comments' | 'history'>('overview')

  if (!selectedTask) return null

  const progress = calculateTaskProgress(selectedTask)

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'subtasks', label: 'Subtasks', icon: CheckCircle2, count: selectedTask.subtasks.length },
    { id: 'comments', label: 'Comments', icon: MessageSquare, count: 0 },
    { id: 'history', label: 'History', icon: Clock }
  ]

  const handleStatusChange = (status: any) => {
    updateTask(selectedTask.id, { status })
  }

  const handlePriorityChange = (priority: any) => {
    updateTask(selectedTask.id, { priority })
  }

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="h-full flex flex-col bg-background/95 backdrop-blur-xl"
    >
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-xl font-bold mb-2 line-clamp-2">{selectedTask.title}</h2>
            <p className="text-muted-foreground text-sm line-clamp-3">{selectedTask.description}</p>
          </div>
          
          <motion.button
            onClick={() => setSelectedTask(null)}
            className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Quick stats */}
        <div className="flex items-center space-x-4 text-sm">
          <div className={cn(
            "flex items-center space-x-1 px-2 py-1 rounded-full border",
            getStatusColor(selectedTask.status)
          )}>
            <span className="capitalize">{selectedTask.status.replace('-', ' ')}</span>
          </div>
          
          <div className={cn(
            "flex items-center space-x-1 px-2 py-1 rounded-full border",
            getPriorityColor(selectedTask.priority)
          )}>
            <Flag className="w-3 h-3" />
            <span className="capitalize">{selectedTask.priority}</span>
          </div>

          {selectedTask.subtasks.length > 0 && (
            <div className="flex items-center space-x-1 text-muted-foreground">
              <CheckCircle2 className="w-3 h-3" />
              <span>
                {selectedTask.subtasks.filter(s => s.status === 'done').length}/{selectedTask.subtasks.length}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {selectedTask.subtasks.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
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
      </div>

      {/* Tabs */}
      <div className="border-b border-border/50">
        <div className="flex space-x-1 p-1">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all relative",
                activeTab === tab.id 
                  ? "text-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-muted/50 text-xs rounded-full">
                  {tab.count}
                </span>
              )}
              
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-accent/50 rounded-lg"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={selectedTask.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="p-2 rounded-lg border border-border/50 bg-background/50"
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                    <option value="deferred">Deferred</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  
                  <select
                    value={selectedTask.priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    className="p-2 rounded-lg border border-border/50 bg-background/50"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                {/* Details */}
                <div>
                  <h4 className="font-semibold mb-2">Details</h4>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {selectedTask.details || 'No details provided.'}
                    </p>
                  </div>
                </div>

                {/* Test Strategy */}
                {selectedTask.testStrategy && (
                  <div>
                    <h4 className="font-semibold mb-2">Test Strategy</h4>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedTask.testStrategy}
                      </p>
                    </div>
                  </div>
                )}

                {/* Dependencies */}
                {selectedTask.dependencies.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Dependencies</h4>
                    <div className="space-y-2">
                      {selectedTask.dependencies.map((depId) => (
                        <div key={depId} className="flex items-center space-x-2 p-2 bg-muted/30 rounded-lg">
                          <Link2 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">Task #{depId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Created</span>
                    <p className="font-medium">
                      {selectedTask.createdAt ? formatDate(selectedTask.createdAt) : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Updated</span>
                    <p className="font-medium">
                      {selectedTask.updatedAt ? formatDate(selectedTask.updatedAt) : 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'subtasks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Subtasks</h4>
                  <motion.button
                    className="flex items-center space-x-1 px-3 py-1 bg-primary text-primary-foreground rounded-lg text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      addSubtask(selectedTask.id, {
                        title: 'New Subtask',
                        description: '',
                        details: '',
                        status: 'pending'
                      })
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Subtask</span>
                  </motion.button>
                </div>

                <div className="space-y-3">
                  {selectedTask.subtasks.map((subtask, index) => (
                    <motion.div
                      key={subtask.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start space-x-3 p-3 bg-muted/20 rounded-lg"
                    >
                      <motion.button
                        className="mt-0.5"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          // const newStatus = subtask.status === 'done' ? 'pending' : 'done'
                          // updateSubtask(selectedTask.id, subtask.id, { status: newStatus })
                        }}
                      >
                        {subtask.status === 'done' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <div className="w-4 h-4 border-2 border-muted-foreground rounded-full" />
                        )}
                      </motion.button>
                      
                      <div className="flex-1">
                        <h5 className={cn(
                          "font-medium",
                          subtask.status === 'done' && "line-through text-muted-foreground"
                        )}>
                          {subtask.title}
                        </h5>
                        {subtask.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {subtask.description}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {selectedTask.subtasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p>No subtasks yet</p>
                    <p className="text-sm">Break this task down into smaller steps</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>Comments coming soon</p>
                <p className="text-sm">Collaborate with your team on tasks</p>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>History coming soon</p>
                <p className="text-sm">Track all changes to this task</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <motion.button
              className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Edit task"
            >
              <Edit3 className="w-4 h-4" />
            </motion.button>
            
            <motion.button
              className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Duplicate task"
            >
              <Copy className="w-4 h-4" />
            </motion.button>
            
            <motion.button
              className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </motion.button>
          </div>
          
          <motion.button
            className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}