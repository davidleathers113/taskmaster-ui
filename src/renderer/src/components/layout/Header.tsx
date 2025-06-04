import { motion } from 'framer-motion'
import { 
  Search, 
  Filter, 
  SortAsc, 
 
  MoreHorizontal,
  Bell,
  User,
  Command,
  Download,
  Upload,
  Grid3X3,
  List,
  Calendar,
  BarChart3,
  Clock
} from 'lucide-react'
import { useTaskStore } from '@/store/useTaskStore'
import { cn } from '@/lib/utils'

const _ViewTypeButton = ({ 
  icon: Icon, 
  label, 
  isActive, 
  onClick 
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  isActive: boolean
  onClick: () => void
}) => (
  <motion.button
    onClick={onClick}
    className={cn(
      "flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200",
      "hover:bg-accent/50 relative overflow-hidden",
      isActive && "bg-accent text-accent-foreground shadow-sm"
    )}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    <Icon className="w-4 h-4" />
    <span className="text-sm font-medium">{label}</span>
    {isActive && (
      <motion.div
        layoutId="activeViewIndicator"
        className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg"
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />
    )}
  </motion.button>
)

export function Header() {
  const { 
    viewMode, 
    setViewMode, 
    analytics,
    searchQuery,
    setSearchQuery,
    exportToJSON,
    loadFromJSON
  } = useTaskStore()

  const viewTypes = [
    { type: 'list', icon: List, label: 'List' },
    { type: 'kanban', icon: Grid3X3, label: 'Kanban' },
    { type: 'calendar', icon: Calendar, label: 'Calendar' },
    { type: 'timeline', icon: Clock, label: 'Timeline' },
    { type: 'analytics', icon: BarChart3, label: 'Analytics' }
  ]

  const handleExport = () => {
    const data = exportToJSON()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `taskmaster-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string)
            loadFromJSON(data)
          } catch (error) {
            console.error('Failed to import tasks:', error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  return (
    <motion.header 
      className="border-b border-border/50 bg-background/95 backdrop-blur-xl"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between p-4">
        {/* Left section - View switcher */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 p-1 bg-muted/30 rounded-lg">
            {viewTypes.map((view) => (
              <_ViewTypeButton
                key={view.type}
                icon={view.icon}
                label={view.label}
                isActive={viewMode.type === view.type}
                onClick={() => setViewMode({ type: view.type as any })}
              />
            ))}
          </div>

          {/* Quick stats */}
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-soft"></div>
              <span>{analytics.completedTasks} completed</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse-soft"></div>
              <span>{analytics.inProgressTasks} in progress</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span>{analytics.pendingTasks} pending</span>
            </div>
          </div>
        </div>

        {/* Center section - Search */}
        <div className="flex-1 max-w-md mx-8">
          <motion.div 
            className="relative"
            whileFocus={{ scale: 1.02 }}
          >
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Command className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks or press ⌘K for commands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-10 pr-10 py-3 rounded-xl border border-border/50",
                "bg-background/50 backdrop-blur-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
                "transition-all duration-200",
                "placeholder:text-muted-foreground"
              )}
            />
          </motion.div>
        </div>

        {/* Right section - Actions */}
        <div className="flex items-center space-x-3">
          {/* View options */}
          <div className="flex items-center space-x-2">
            <motion.button
              className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Sort ascending"
            >
              <SortAsc className="w-4 h-4" />
            </motion.button>
            
            <motion.button
              className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Filter tasks"
            >
              <Filter className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-border/50"></div>

          {/* Import/Export */}
          <div className="flex items-center space-x-2">
            <motion.button
              onClick={handleImport}
              className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Import tasks"
            >
              <Upload className="w-4 h-4" />
            </motion.button>
            
            <motion.button
              onClick={handleExport}
              className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Export tasks"
            >
              <Download className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-border/50"></div>

          {/* Notifications */}
          <motion.button
            className="relative p-2 rounded-lg hover:bg-accent/50 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Bell className="w-4 h-4" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-bounce-subtle">
              <div className="w-full h-full bg-red-500 rounded-full animate-ping"></div>
            </div>
          </motion.button>

          {/* Profile */}
          <motion.button
            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-accent/50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </motion.button>

          {/* More options */}
          <motion.button
            className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Progress bar */}
      <motion.div 
        className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: analytics.completionRate / 100 }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{ transformOrigin: "left" }}
      />
    </motion.header>
  )
}