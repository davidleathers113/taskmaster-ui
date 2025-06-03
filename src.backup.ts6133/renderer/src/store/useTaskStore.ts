import { create } from 'zustand'
import { Task, Subtask, FilterOptions, ViewMode, UserSettings, Analytics } from '@/types'
import { generateAnalytics, generateId } from '@/lib/utils'

interface TaskStore {
  // State
  tasks: Task[]
  selectedTask: Task | null
  filters: FilterOptions
  viewMode: ViewMode
  userSettings: UserSettings
  analytics: Analytics
  isLoading: boolean
  searchQuery: string
  sidebarCollapsed: boolean
  
  // Actions
  setTasks: (tasks: Task[]) => void
  addTask: (task: Omit<Task, 'id'>) => void
  updateTask: (id: number, updates: Partial<Task>) => void
  deleteTask: (id: number) => void
  duplicateTask: (id: number) => void
  
  addSubtask: (taskId: number, subtask: Omit<Subtask, 'id' | 'taskId'>) => void
  updateSubtask: (taskId: number, subtaskId: number, updates: Partial<Subtask>) => void
  deleteSubtask: (taskId: number, subtaskId: number) => void
  
  setSelectedTask: (task: Task | null) => void
  setFilters: (filters: Partial<FilterOptions>) => void
  clearFilters: () => void
  setViewMode: (viewMode: Partial<ViewMode>) => void
  setUserSettings: (settings: Partial<UserSettings>) => void
  setSearchQuery: (query: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  
  // Computed
  getFilteredTasks: () => Task[]
  getTaskById: (id: number) => Task | undefined
  getTasksByStatus: (status: Task['status']) => Task[]
  getTasksByPriority: (priority: Task['priority']) => Task[]
  getDependentTasks: (taskId: number) => Task[]
  getBlockingTasks: (taskId: number) => Task[]
  
  // Bulk operations
  updateMultipleTasks: (ids: number[], updates: Partial<Task>) => void
  deleteMultipleTasks: (ids: number[]) => void
  
  // Data operations
  loadFromJSON: (data: { tasks: Task[] }) => void
  exportToJSON: () => { tasks: Task[] }
  resetStore: () => void
}

const defaultViewMode: ViewMode = {
  type: 'list',
  density: 'comfortable',
  groupBy: 'status',
  sortBy: 'id',
  sortOrder: 'asc'
}

const defaultUserSettings: UserSettings = {
  ui: {
    theme: 'system',
    colorScheme: 'blue',
    animations: true,
    sounds: false,
    compactMode: false,
    showSubtasks: true,
    showDependencies: true,
    defaultView: 'list',
    sidebarCollapsed: false
  },
  notifications: {
    dueDateReminders: true,
    statusChanges: true,
    newAssignments: true,
    dependencies: true,
    email: false,
    push: true,
    sound: false
  },
  workingHours: {
    start: '09:00',
    end: '17:00',
    timezone: 'UTC',
    workingDays: [1, 2, 3, 4, 5] // Monday to Friday
  }
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  // Initial state
  tasks: [],
  selectedTask: null,
  filters: {},
  viewMode: defaultViewMode,
  userSettings: defaultUserSettings,
  analytics: {
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    completionRate: 0,
    averageCompletionTime: 0,
    tasksByPriority: { low: 0, medium: 0, high: 0 },
    tasksByStatus: { pending: 0, 'in-progress': 0, done: 0, review: 0, deferred: 0, cancelled: 0 },
    velocityMetrics: { tasksCompletedLastWeek: 0, tasksCompletedThisWeek: 0, trend: 'stable' },
    burndownData: []
  },
  isLoading: false,
  searchQuery: '',
  sidebarCollapsed: false,
  
  // Actions
  setTasks: (tasks) => set(() => {
    const analytics = generateAnalytics(tasks)
    return { tasks, analytics }
  }),
  
  addTask: (taskData) => set((state) => {
    const newTask: Task = {
      ...taskData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const tasks = [...state.tasks, newTask]
    const analytics = generateAnalytics(tasks)
    return { tasks, analytics }
  }),
  
  updateTask: (id, updates) => set((state) => {
    const tasks = state.tasks.map(task => 
      task.id === id 
        ? { ...task, ...updates, updatedAt: new Date().toISOString() }
        : task
    )
    const analytics = generateAnalytics(tasks)
    const selectedTask = state.selectedTask?.id === id 
      ? { ...state.selectedTask, ...updates } 
      : state.selectedTask
    return { tasks, analytics, selectedTask }
  }),
  
  deleteTask: (id) => set((state) => {
    const tasks = state.tasks.filter(task => task.id !== id)
    const analytics = generateAnalytics(tasks)
    const selectedTask = state.selectedTask?.id === id ? null : state.selectedTask
    return { tasks, analytics, selectedTask }
  }),
  
  duplicateTask: (id) => set((state) => {
    const taskToDuplicate = state.tasks.find(task => task.id === id)
    if (!taskToDuplicate) return state
    
    const duplicatedTask: Task = {
      ...taskToDuplicate,
      id: generateId(),
      title: `${taskToDuplicate.title} (Copy)`,
      status: 'pending',
      subtasks: taskToDuplicate.subtasks.map(subtask => ({
        ...subtask,
        id: generateId(),
        taskId: generateId(),
        status: 'pending'
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    const tasks = [...state.tasks, duplicatedTask]
    const analytics = generateAnalytics(tasks)
    return { tasks, analytics }
  }),
  
  addSubtask: (taskId, subtaskData) => set((state) => {
    const tasks = state.tasks.map(task => {
      if (task.id === taskId) {
        const newSubtask: Subtask = {
          ...subtaskData,
          id: generateId(),
          taskId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        return {
          ...task,
          subtasks: [...task.subtasks, newSubtask],
          updatedAt: new Date().toISOString()
        }
      }
      return task
    })
    
    const analytics = generateAnalytics(tasks)
    return { tasks, analytics }
  }),
  
  updateSubtask: (taskId, subtaskId, updates) => set((state) => {
    const tasks = state.tasks.map(task => {
      if (task.id === taskId) {
        const subtasks = task.subtasks.map(subtask =>
          subtask.id === subtaskId
            ? { ...subtask, ...updates, updatedAt: new Date().toISOString() }
            : subtask
        )
        return { ...task, subtasks, updatedAt: new Date().toISOString() }
      }
      return task
    })
    
    const analytics = generateAnalytics(tasks)
    return { tasks, analytics }
  }),
  
  deleteSubtask: (taskId, subtaskId) => set((state) => {
    const tasks = state.tasks.map(task => {
      if (task.id === taskId) {
        const subtasks = task.subtasks.filter(subtask => subtask.id !== subtaskId)
        return { ...task, subtasks, updatedAt: new Date().toISOString() }
      }
      return task
    })
    
    const analytics = generateAnalytics(tasks)
    return { tasks, analytics }
  }),
  
  setSelectedTask: (task) => set({ selectedTask: task }),
  
  setFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters }
  })),
  
  clearFilters: () => set({ filters: {} }),
  
  setViewMode: (newViewMode) => set((state) => ({
    viewMode: { ...state.viewMode, ...newViewMode }
  })),
  
  setUserSettings: (settings) => set((state) => ({
    userSettings: {
      ...state.userSettings,
      ui: { ...state.userSettings.ui, ...settings.ui },
      notifications: { ...state.userSettings.notifications, ...settings.notifications },
      workingHours: { ...state.userSettings.workingHours, ...settings.workingHours }
    }
  })),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  // Computed getters
  getFilteredTasks: () => {
    const { tasks, filters, searchQuery } = get()
    return tasks.filter(task => {
      if (filters.status && !filters.status.includes(task.status)) return false
      if (filters.priority && !filters.priority.includes(task.priority)) return false
      if (searchQuery) {
        const search = searchQuery.toLowerCase()
        if (!task.title.toLowerCase().includes(search) && 
            !task.description.toLowerCase().includes(search)) {
          return false
        }
      }
      return true
    })
  },
  
  getTaskById: (id) => {
    return get().tasks.find(task => task.id === id)
  },
  
  getTasksByStatus: (status) => {
    return get().tasks.filter(task => task.status === status)
  },
  
  getTasksByPriority: (priority) => {
    return get().tasks.filter(task => task.priority === priority)
  },
  
  getDependentTasks: (taskId) => {
    return get().tasks.filter(task => task.dependencies.includes(taskId))
  },
  
  getBlockingTasks: (taskId) => {
    const task = get().getTaskById(taskId)
    if (!task) return []
    return task.dependencies.map(depId => get().getTaskById(depId)).filter(Boolean) as Task[]
  },
  
  // Bulk operations
  updateMultipleTasks: (ids, updates) => set((state) => {
    const tasks = state.tasks.map(task =>
      ids.includes(task.id)
        ? { ...task, ...updates, updatedAt: new Date().toISOString() }
        : task
    )
    const analytics = generateAnalytics(tasks)
    return { tasks, analytics }
  }),
  
  deleteMultipleTasks: (ids) => set((state) => {
    const tasks = state.tasks.filter(task => !ids.includes(task.id))
    const analytics = generateAnalytics(tasks)
    const selectedTask = state.selectedTask && ids.includes(state.selectedTask.id) 
      ? null 
      : state.selectedTask
    return { tasks, analytics, selectedTask }
  }),
  
  // Data operations
  loadFromJSON: (data) => set(() => {
    const tasks = data.tasks || []
    const analytics = generateAnalytics(tasks)
    return { tasks, analytics, isLoading: false }
  }),
  
  exportToJSON: () => {
    return { tasks: get().tasks }
  },
  
  resetStore: () => set(() => ({
    tasks: [],
    selectedTask: null,
    filters: {},
    viewMode: defaultViewMode,
    analytics: {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      pendingTasks: 0,
      completionRate: 0,
      averageCompletionTime: 0,
      tasksByPriority: { low: 0, medium: 0, high: 0 },
      tasksByStatus: { pending: 0, 'in-progress': 0, done: 0, review: 0, deferred: 0, cancelled: 0 },
      velocityMetrics: { tasksCompletedLastWeek: 0, tasksCompletedThisWeek: 0, trend: 'stable' },
      burndownData: []
    },
    searchQuery: ''
  }))
}))