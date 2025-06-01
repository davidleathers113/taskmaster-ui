import React from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Filter, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ComponentType<{ className?: string }>
  }
  className?: string
}

export function EmptyState({ 
  title = "No tasks found",
  description = "Create your first task to get started with TaskMaster",
  action,
  className 
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn(
        "h-full flex flex-col items-center justify-center p-8 text-center",
        className
      )}
    >
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-400/20 rounded-full"
            style={{
              left: `${20 + i * 15}%`,
              top: `${30 + (i % 2) * 20}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      {/* Main illustration */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8, type: "spring" }}
        className="relative mb-8"
      >
        <div className="relative">
          {/* Background glow */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"
          />
          
          {/* Main icon */}
          <div className="relative w-32 h-32 mx-auto bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-3xl flex items-center justify-center border border-border/50">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
            >
              <div className="text-6xl opacity-60">📋</div>
            </motion.div>
            
            {/* Floating sparkles */}
            <motion.div
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute inset-0"
            >
              <Sparkles className="absolute top-2 right-2 w-4 h-4 text-blue-400" />
              <Sparkles className="absolute bottom-2 left-2 w-3 h-3 text-purple-400" />
              <Sparkles className="absolute top-1/2 left-0 w-2 h-2 text-pink-400" />
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="max-w-md"
      >
        <h3 className="text-2xl font-bold mb-3 gradient-text">{title}</h3>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          {description}
        </p>

        {/* Action button */}
        {action && (
          <motion.button
            onClick={action.onClick}
            className={cn(
              "inline-flex items-center space-x-2 px-6 py-3 rounded-xl",
              "bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium",
              "hover:from-blue-600 hover:to-purple-700 transition-all duration-200",
              "shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30"
            )}
            whileHover={{ 
              scale: 1.05,
              boxShadow: "0 20px 25px -5px rgba(59, 130, 246, 0.3)"
            }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            {action.icon && <action.icon className="w-5 h-5" />}
            <span>{action.label}</span>
          </motion.button>
        )}
      </motion.div>

      {/* Quick tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl"
      >
        {[
          {
            icon: Plus,
            title: "Create Tasks",
            description: "Add new tasks with priorities and deadlines"
          },
          {
            icon: Search,
            title: "Search & Filter",
            description: "Find tasks quickly with powerful search"
          },
          {
            icon: Filter,
            title: "Organize",
            description: "Sort by status, priority, or custom views"
          }
        ].map((tip, index) => (
          <motion.div
            key={tip.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 + index * 0.1, duration: 0.5 }}
            className="text-center p-4 rounded-lg bg-muted/20 border border-border/30"
          >
            <div className="w-10 h-10 mx-auto mb-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
              <tip.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-medium mb-1">{tip.title}</h4>
            <p className="text-xs text-muted-foreground">{tip.description}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )
}