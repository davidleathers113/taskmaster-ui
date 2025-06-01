export interface Task {
  id: number;
  title: string;
  description: string;
  details: string;
  testStrategy: string;
  priority: 'low' | 'medium' | 'high';
  dependencies: number[];
  status: 'pending' | 'in-progress' | 'done' | 'review' | 'deferred' | 'cancelled';
  subtasks: Subtask[];
  createdAt?: string;
  updatedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
  assignee?: string;
  dueDate?: string;
}

export interface Subtask {
  id: number;
  taskId: number;
  title: string;
  description: string;
  details: string;
  status: 'pending' | 'in-progress' | 'done' | 'review' | 'deferred' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
}

export interface TaskData {
  tasks: Task[];
}

export interface FilterOptions {
  status?: Task['status'][];
  priority?: Task['priority'][];
  assignee?: string[];
  tags?: string[];
  search?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ViewMode {
  type: 'list' | 'kanban' | 'calendar' | 'timeline' | 'analytics' | 'claude-config';
  density: 'compact' | 'comfortable' | 'spacious';
  groupBy?: 'status' | 'priority' | 'assignee' | 'tags' | 'none';
  sortBy?: 'id' | 'title' | 'priority' | 'status' | 'createdAt' | 'updatedAt' | 'dueDate';
  sortOrder?: 'asc' | 'desc';
}

export interface Analytics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  completionRate: number;
  averageCompletionTime: number;
  tasksByPriority: Record<Task['priority'], number>;
  tasksByStatus: Record<Task['status'], number>;
  velocityMetrics: {
    tasksCompletedLastWeek: number;
    tasksCompletedThisWeek: number;
    trend: 'up' | 'down' | 'stable';
  };
  burndownData: {
    date: string;
    remaining: number;
    completed: number;
  }[];
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  colorScheme: 'blue' | 'purple' | 'green' | 'orange' | 'pink';
  animations: boolean;
  sounds: boolean;
  compactMode: boolean;
  showSubtasks: boolean;
  showDependencies: boolean;
  defaultView: ViewMode['type'];
  sidebarCollapsed: boolean;
}

export interface NotificationSettings {
  dueDateReminders: boolean;
  statusChanges: boolean;
  newAssignments: boolean;
  dependencies: boolean;
  email: boolean;
  push: boolean;
  sound: boolean;
}

export interface UserSettings {
  ui: UIPreferences;
  notifications: NotificationSettings;
  workingHours: {
    start: string;
    end: string;
    timezone: string;
    workingDays: number[];
  };
}

export type DragItem = {
  type: 'task' | 'subtask';
  id: number;
  parentId?: number;
};

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  divider?: boolean;
}

export interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: string;
  shortcut: string;
  action: () => void;
  category: 'task' | 'view' | 'filter' | 'navigation';
}