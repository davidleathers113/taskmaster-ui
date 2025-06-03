import React from 'react'
import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  BarChart3,
  PieChart,
  Calendar,
  Zap
} from 'lucide-react'
import { useTaskStore } from '@/store/useTaskStore'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  icon: React.ComponentType<{ className?: string }>
  color?: string
  index: number
}

function MetricCard({ title, value, change, trend, icon: Icon, color = 'blue', index }: MetricCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ 
        scale: 1.02,
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
      }}
      className="relative overflow-hidden rounded-xl bg-card border border-border/50 p-6 glass-morphism"
    >
      {/* Background gradient */}
      <div className={cn(
        "absolute top-0 right-0 w-20 h-20 opacity-10 rounded-bl-3xl",
        `bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]}`
      )} />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            "p-3 rounded-lg bg-gradient-to-br",
            colorClasses[color as keyof typeof colorClasses]
          )}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          
          {change && (
            <div className={cn(
              "flex items-center space-x-1 text-sm",
              trend === 'up' && "text-emerald-600",
              trend === 'down' && "text-red-600",
              trend === 'neutral' && "text-muted-foreground"
            )}>
              {trend === 'up' && <TrendingUp className="w-4 h-4" />}
              {trend === 'down' && <TrendingDown className="w-4 h-4" />}
              <span>{change}</span>
            </div>
          )}
        </div>
        
        <div>
          <h3 className="text-2xl font-bold mb-1">{value}</h3>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </div>
    </motion.div>
  )
}

export function AnalyticsView() {
  const { analytics } = useTaskStore()

  const metrics = [
    {
      title: 'Total Tasks',
      value: analytics.totalTasks,
      icon: Target,
      color: 'blue'
    },
    {
      title: 'Completed',
      value: analytics.completedTasks,
      change: `${Math.round(analytics.completionRate)}%`,
      trend: 'up' as const,
      icon: CheckCircle2,
      color: 'emerald'
    },
    {
      title: 'In Progress',
      value: analytics.inProgressTasks,
      icon: Clock,
      color: 'orange'
    },
    {
      title: 'High Priority',
      value: analytics.tasksByPriority.high || 0,
      icon: AlertTriangle,
      color: 'red'
    },
    {
      title: 'This Week',
      value: analytics.velocityMetrics.tasksCompletedThisWeek,
      change: '+12%',
      trend: analytics.velocityMetrics.trend as any,
      icon: Zap,
      color: 'purple'
    },
    {
      title: 'Avg. Completion',
      value: `${analytics.averageCompletionTime}d`,
      icon: Calendar,
      color: 'blue'
    }
  ]

  return (
    <motion.div 
      className="h-full overflow-auto p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div 
        className="mb-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl font-bold gradient-text mb-2">Analytics Dashboard</h2>
        <p className="text-muted-foreground">
          Track your productivity and task completion metrics
        </p>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {metrics.map((metric, index) => (
          <MetricCard key={metric.title} {...metric} index={index} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Completion Rate Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-card border border-border/50 rounded-xl p-6 glass-morphism"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Completion Rate</h3>
            <PieChart className="w-5 h-5 text-muted-foreground" />
          </div>
          
          <div className="relative w-48 h-48 mx-auto">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted/20"
              />
              {/* Progress circle */}
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                animate={{ 
                  strokeDashoffset: 2 * Math.PI * 40 * (1 - analytics.completionRate / 100)
                }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold">{Math.round(analytics.completionRate)}%</div>
                <div className="text-xs text-muted-foreground">Complete</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Burndown Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-card border border-border/50 rounded-xl p-6 glass-morphism"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Task Burndown</h3>
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </div>
          
          <div className="h-48 flex items-end justify-between space-x-1">
            {analytics.burndownData.slice(-7).map((point, index) => (
              <motion.div
                key={point.date}
                className="flex flex-col items-center flex-1"
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                transition={{ delay: 0.9 + index * 0.1 }}
              >
                <motion.div
                  className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-sm mb-2"
                  initial={{ height: 0 }}
                  animate={{ height: `${(point.completed / analytics.totalTasks) * 140}px` }}
                  transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
                />
                <span className="text-xs text-muted-foreground">
                  {new Date(point.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Status Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="bg-card border border-border/50 rounded-xl p-6 glass-morphism"
      >
        <h3 className="text-lg font-semibold mb-6">Task Status Breakdown</h3>
        
        <div className="space-y-4">
          {Object.entries(analytics.tasksByStatus).map(([status, count], index) => {
            const percentage = analytics.totalTasks > 0 ? (count / analytics.totalTasks) * 100 : 0
            const colors = {
              done: 'bg-emerald-500',
              'in-progress': 'bg-blue-500',
              pending: 'bg-gray-400',
              review: 'bg-purple-500',
              deferred: 'bg-yellow-500',
              cancelled: 'bg-red-500'
            }
            
            return (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={cn("w-3 h-3 rounded-full", colors[status as keyof typeof colors])} />
                  <span className="capitalize text-sm">{status.replace('-', ' ')}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-muted/30 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", colors[status as keyof typeof colors])}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.8, delay: 1 + index * 0.1 }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8">{count}</span>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}