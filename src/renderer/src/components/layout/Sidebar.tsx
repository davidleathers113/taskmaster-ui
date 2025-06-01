import { motion, AnimatePresence } from 'framer-motion'
import { 
  Home, 
  CheckSquare, 
  Calendar, 
  Settings, 
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Zap,
  Target,
  Clock,
} from 'lucide-react'
import { useTaskStore } from '@/store/useTaskStore'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
  shortcut?: string
  action?: () => void
}

export function Sidebar() {
  const { 
    sidebarCollapsed, 
    setSidebarCollapsed, 
    viewMode, 
    setViewMode,
    analytics,
    setFilters
  } = useTaskStore()

  const navigationItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: Home,
      shortcut: '⌘1',
      action: () => setViewMode({ type: 'analytics' })
    },
    {
      id: 'tasks',
      label: 'All Tasks',
      icon: CheckSquare,
      count: analytics.totalTasks,
      shortcut: '⌘2',
      action: () => setViewMode({ type: 'list' })
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      shortcut: '⌘3',
      action: () => setViewMode({ type: 'calendar' })
    },
    {
      id: 'kanban',
      label: 'Kanban',
      icon: Target,
      shortcut: '⌘4',
      action: () => setViewMode({ type: 'kanban' })
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: Clock,
      shortcut: '⌘5',
      action: () => setViewMode({ type: 'timeline' })
    },
    {
      id: 'claude-config',
      label: 'Claude Config',
      icon: Settings,
      shortcut: '⌘6',
      action: () => setViewMode({ type: 'claude-config' })
    }
  ]

  const quickFilters: NavItem[] = [
    {
      id: 'in-progress',
      label: 'In Progress',
      icon: Zap,
      count: analytics.inProgressTasks,
      action: () => setFilters({ status: ['in-progress'] })
    },
    {
      id: 'pending',
      label: 'Pending',
      icon: Clock,
      count: analytics.pendingTasks,
      action: () => setFilters({ status: ['pending'] })
    },
    {
      id: 'high-priority',
      label: 'High Priority',
      icon: Target,
      count: analytics.tasksByPriority.high || 0,
      action: () => setFilters({ priority: ['high'] })
    }
  ]

  return (
    <motion.aside 
      className="h-full flex flex-col bg-background/95 backdrop-blur-xl border-r border-border/50"
      layout
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <AnimatePresence mode="wait">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex items-center space-x-3"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <CheckSquare className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg gradient-text">TaskMaster</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </motion.button>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-border/50">
        <motion.button
          className={cn(
            "w-full flex items-center justify-center space-x-2 p-3 rounded-xl",
            "bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium",
            "hover:from-blue-600 hover:to-purple-700 transition-all duration-200",
            "shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30"
          )}
          whileHover={{ 
            scale: 1.02,
            boxShadow: "0 20px 25px -5px rgba(59, 130, 246, 0.3)"
          }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-4 h-4" />
          {!sidebarCollapsed && <span>New Task</span>}
        </motion.button>

        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-3 relative"
          >
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks..."
              className={cn(
                "w-full pl-10 pr-3 py-2 rounded-lg border border-border/50",
                "bg-background/50 backdrop-blur-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
                "transition-all duration-200"
              )}
              onChange={(e) => useTaskStore.getState().setSearchQuery(e.target.value)}
            />
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <nav className="p-4 space-y-2">
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3"
              >
                Navigation
              </motion.h3>
            )}
          </AnimatePresence>

          {navigationItems.map((item, index) => (
            <motion.button
              key={item.id}
              onClick={item.action}
              className={cn(
                "w-full flex items-center space-x-3 p-3 rounded-lg",
                "hover:bg-accent/50 transition-all duration-200",
                "group relative overflow-hidden",
                viewMode.type === item.id.replace('tasks', 'list') && "bg-accent text-accent-foreground"
              )}
              whileHover={{ x: 2 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              
              <AnimatePresence mode="wait">
                {!sidebarCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 flex items-center justify-between"
                  >
                    <span className="font-medium">{item.label}</span>
                    <div className="flex items-center space-x-2">
                      {item.count !== undefined && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                          {item.count}
                        </span>
                      )}
                      {item.shortcut && (
                        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </nav>

        {/* Quick Filters */}
        <div className="p-4 border-t border-border/50">
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3"
              >
                Quick Filters
              </motion.h3>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            {quickFilters.map((filter, index) => (
              <motion.button
                key={filter.id}
                onClick={filter.action}
                className={cn(
                  "w-full flex items-center space-x-3 p-2 rounded-lg",
                  "hover:bg-accent/30 transition-all duration-200",
                  "group"
                )}
                whileHover={{ x: 2 }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <filter.icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                
                <AnimatePresence mode="wait">
                  {!sidebarCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex-1 flex items-center justify-between"
                    >
                      <span className="text-sm text-muted-foreground">{filter.label}</span>
                      <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-1 rounded-full">
                        {filter.count}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 border-t border-border/50">
        <motion.button
          className={cn(
            "w-full flex items-center space-x-3 p-3 rounded-lg",
            "hover:bg-accent/50 transition-all duration-200"
          )}
          whileHover={{ x: 2 }}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence mode="wait">
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-medium"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.aside>
  )
}