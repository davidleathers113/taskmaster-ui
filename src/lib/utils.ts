import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Task, Analytics } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function getRelativeTime(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}

export function getPriorityColor(priority: Task['priority']): string {
  switch (priority) {
    case 'high':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'medium':
      return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'low':
      return 'text-green-600 bg-green-50 border-green-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

export function getStatusColor(status: Task['status']): string {
  switch (status) {
    case 'done':
      return 'text-emerald-700 bg-emerald-100 border-emerald-300'
    case 'in-progress':
      return 'text-blue-700 bg-blue-100 border-blue-300'
    case 'review':
      return 'text-purple-700 bg-purple-100 border-purple-300'
    case 'pending':
      return 'text-gray-700 bg-gray-100 border-gray-300'
    case 'deferred':
      return 'text-yellow-700 bg-yellow-100 border-yellow-300'
    case 'cancelled':
      return 'text-red-700 bg-red-100 border-red-300'
    default:
      return 'text-gray-700 bg-gray-100 border-gray-300'
  }
}

export function calculateTaskProgress(task: Task): number {
  if (task.status === 'done') return 100
  if (task.status === 'cancelled') return 0
  
  if (task.subtasks.length === 0) {
    switch (task.status) {
      case 'in-progress':
        return 50
      case 'review':
        return 90
      default:
        return 0
    }
  }
  
  const completedSubtasks = task.subtasks.filter(s => s.status === 'done').length
  return Math.round((completedSubtasks / task.subtasks.length) * 100)
}

export function generateAnalytics(tasks: Task[]): Analytics {
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'done').length
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length
  const pendingTasks = tasks.filter(t => t.status === 'pending').length
  
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  
  const tasksByPriority = tasks.reduce((acc, task) => {
    acc[task.priority] = (acc[task.priority] || 0) + 1
    return acc
  }, {} as Record<Task['priority'], number>)
  
  const tasksByStatus = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1
    return acc
  }, {} as Record<Task['status'], number>)
  
  // Mock velocity metrics for now
  const velocityMetrics = {
    tasksCompletedLastWeek: Math.floor(completedTasks * 0.3),
    tasksCompletedThisWeek: Math.floor(completedTasks * 0.4),
    trend: 'up' as const
  }
  
  // Generate burndown data
  const burndownData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    remaining: Math.max(0, totalTasks - Math.floor((i / 29) * completedTasks)),
    completed: Math.floor((i / 29) * completedTasks)
  }))
  
  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    pendingTasks,
    completionRate,
    averageCompletionTime: 3.5, // Mock average in days
    tasksByPriority,
    tasksByStatus,
    velocityMetrics,
    burndownData
  }
}

export function filterTasks(tasks: Task[], filters: any): Task[] {
  return tasks.filter(task => {
    if (filters.status && !filters.status.includes(task.status)) return false
    if (filters.priority && !filters.priority.includes(task.priority)) return false
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      if (!task.title.toLowerCase().includes(searchLower) && 
          !task.description.toLowerCase().includes(searchLower)) {
        return false
      }
    }
    return true
  })
}

export function sortTasks(tasks: Task[], sortBy: string, sortOrder: 'asc' | 'desc'): Task[] {
  return [...tasks].sort((a, b) => {
    let aValue: any = a[sortBy as keyof Task]
    let bValue: any = b[sortBy as keyof Task]
    
    if (sortBy === 'priority') {
      const priorityOrder = { low: 1, medium: 2, high: 3 }
      aValue = priorityOrder[a.priority]
      bValue = priorityOrder[b.priority]
    }
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }
    
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
    return 0
  })
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export function generateId(): number {
  return Math.floor(Math.random() * 1000000) + Date.now()
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function downloadJSON(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}