import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Plus, 
  CheckSquare, 
  Calendar, 
  BarChart3, 
  Settings,
  Command,
  ArrowRight,
  Hash,
  Clock,
  Filter
} from 'lucide-react'
import { useTaskStore } from '@/store/useTaskStore'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  action: () => void
  category: 'task' | 'view' | 'filter' | 'navigation'
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { setViewMode, setFilters, addTask } = useTaskStore()

  const commands: CommandItem[] = [
    {
      id: 'new-task',
      label: 'Create New Task',
      description: 'Add a new task to your list',
      icon: Plus,
      shortcut: '⌘N',
      category: 'task',
      action: () => {
        addTask({
          title: 'New Task',
          description: 'Task description',
          details: '',
          testStrategy: '',
          priority: 'medium',
          dependencies: [],
          status: 'pending',
          subtasks: []
        })
        setIsOpen(false)
      }
    },
    {
      id: 'view-list',
      label: 'Switch to List View',
      description: 'View tasks in a detailed list',
      icon: CheckSquare,
      shortcut: '⌘1',
      category: 'view',
      action: () => {
        setViewMode({ type: 'list' })
        setIsOpen(false)
      }
    },
    {
      id: 'view-kanban',
      label: 'Switch to Kanban View',
      description: 'View tasks in kanban boards',
      icon: Hash,
      shortcut: '⌘2',
      category: 'view',
      action: () => {
        setViewMode({ type: 'kanban' })
        setIsOpen(false)
      }
    },
    {
      id: 'view-calendar',
      label: 'Switch to Calendar View',
      description: 'View tasks in calendar format',
      icon: Calendar,
      shortcut: '⌘3',
      category: 'view',
      action: () => {
        setViewMode({ type: 'calendar' })
        setIsOpen(false)
      }
    },
    {
      id: 'view-analytics',
      label: 'Switch to Analytics View',
      description: 'View productivity analytics',
      icon: BarChart3,
      shortcut: '⌘4',
      category: 'view',
      action: () => {
        setViewMode({ type: 'analytics' })
        setIsOpen(false)
      }
    },
    {
      id: 'filter-in-progress',
      label: 'Filter: In Progress Tasks',
      description: 'Show only tasks in progress',
      icon: Clock,
      category: 'filter',
      action: () => {
        setFilters({ status: ['in-progress'] })
        setIsOpen(false)
      }
    },
    {
      id: 'filter-high-priority',
      label: 'Filter: High Priority Tasks',
      description: 'Show only high priority tasks',
      icon: Filter,
      category: 'filter',
      action: () => {
        setFilters({ priority: ['high'] })
        setIsOpen(false)
      }
    },
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Configure TaskMaster preferences',
      icon: Settings,
      shortcut: '⌘,',
      category: 'navigation',
      action: () => {
        // Open settings modal
        setIsOpen(false)
      }
    }
  ]

  const filteredCommands = commands.filter(command =>
    command.label.toLowerCase().includes(query.toLowerCase()) ||
    command.description?.toLowerCase().includes(query.toLowerCase())
  )

  const groupedCommands = filteredCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = []
    }
    acc[command.category]!.push(command)
    return acc
  }, {} as Record<string, CommandItem[]>)

  const categoryLabels = {
    task: 'Tasks',
    view: 'Views',
    filter: 'Filters',
    navigation: 'Navigation'
  }

  const categoryIcons = {
    task: CheckSquare,
    view: BarChart3,
    filter: Filter,
    navigation: Settings
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.metaKey && e.key === 'k') {
      e.preventDefault()
      setIsOpen(true)
      setQuery('')
      setSelectedIndex(0)
    }
    
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
    
    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
      }
      
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      }
      
      if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
        }
      }
    }
  }, [isOpen, filteredCommands, selectedIndex])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start justify-center pt-32"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card border border-border/50 rounded-2xl shadow-2xl glass-morphism overflow-hidden">
              {/* Header */}
              <div className="flex items-center p-4 border-b border-border/50">
                <Search className="w-5 h-5 text-muted-foreground mr-3" />
                <input
                  type="text"
                  placeholder="Type a command or search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-lg placeholder:text-muted-foreground focus:outline-none"
                  autoFocus
                />
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <kbd className="px-2 py-1 bg-muted/30 rounded border">⌘</kbd>
                  <kbd className="px-2 py-1 bg-muted/30 rounded border">K</kbd>
                </div>
              </div>

              {/* Commands */}
              <div className="max-h-96 overflow-y-auto">
                {filteredCommands.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p>No commands found</p>
                    <p className="text-sm mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {Object.entries(groupedCommands).map(([category, commands]) => (
                      <div key={category} className="mb-4 last:mb-0">
                        <div className="flex items-center space-x-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {React.createElement(categoryIcons[category as keyof typeof categoryIcons], {
                            className: "w-3 h-3"
                          })}
                          <span>{categoryLabels[category as keyof typeof categoryLabels]}</span>
                        </div>
                        
                        {commands.map((command) => {
                          const globalIndex = filteredCommands.indexOf(command)
                          const isSelected = globalIndex === selectedIndex
                          
                          return (
                            <motion.div
                              key={command.id}
                              className={cn(
                                "flex items-center justify-between p-3 mx-1 rounded-lg cursor-pointer transition-all",
                                "hover:bg-accent/50",
                                isSelected && "bg-accent text-accent-foreground"
                              )}
                              onClick={command.action}
                              whileHover={{ x: 2 }}
                              onMouseEnter={() => setSelectedIndex(globalIndex)}
                            >
                              <div className="flex items-center space-x-3">
                                <div className={cn(
                                  "p-2 rounded-lg",
                                  isSelected ? "bg-primary/20" : "bg-muted/30"
                                )}>
                                  <command.icon className="w-4 h-4" />
                                </div>
                                
                                <div>
                                  <div className="font-medium">{command.label}</div>
                                  {command.description && (
                                    <div className="text-sm text-muted-foreground">
                                      {command.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                {command.shortcut && (
                                  <div className="text-xs text-muted-foreground">
                                    {command.shortcut}
                                  </div>
                                )}
                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-3 border-t border-border/50 text-xs text-muted-foreground">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <kbd className="px-1.5 py-0.5 bg-muted/30 rounded">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-muted/30 rounded">↓</kbd>
                    <span>navigate</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <kbd className="px-1.5 py-0.5 bg-muted/30 rounded">↵</kbd>
                    <span>select</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <kbd className="px-1.5 py-0.5 bg-muted/30 rounded">esc</kbd>
                    <span>close</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Command className="w-3 h-3" />
                  <span>TaskMaster Command Palette</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}