/**
 * Advanced TypeScript 5.8 patterns demonstrating const contexts for template literals
 * and other cutting-edge type features for 2025
 */

// Template literal types with const contexts
export const createStrictRoute = <T extends string>(route: T) => route;

// Const context for template literals - TypeScript 5.8 enhancement
export type StrictRoutes = '/dashboard' | '/tasks' | '/projects' | '/settings';

// Advanced template literal pattern matching
export type APIEndpoint<T extends string> = `api/${T}`;
export type TaskEndpoint<T extends string> = APIEndpoint<`tasks/${T}`>;
export type ProjectEndpoint<T extends string> = APIEndpoint<`projects/${T}`>;

// Const assertion for API endpoints with template literals
export const API_ENDPOINTS = {
  tasks: {
    list: 'api/tasks' as const,
    create: 'api/tasks/create' as const,
    update: 'api/tasks/update' as const,
    delete: 'api/tasks/delete' as const,
  },
  projects: {
    list: 'api/projects' as const,
    create: 'api/projects/create' as const,
    update: 'api/projects/update' as const,
    delete: 'api/projects/delete' as const,
  }
} as const;

// Extract endpoint types from const assertion
export type APIEndpoints = typeof API_ENDPOINTS;
export type TaskEndpoints = APIEndpoints['tasks'][keyof APIEndpoints['tasks']];
export type ProjectEndpoints = APIEndpoints['projects'][keyof APIEndpoints['projects']];

// Advanced branded types for type safety
declare const __brand: unique symbol;
type Brand<T, U> = T & { [__brand]: U };

export type TaskId = Brand<string, 'TaskId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
export type UserId = Brand<string, 'UserId'>;
export type Timestamp = Brand<number, 'Timestamp'>;

// Template literal utility for creating type-safe CSS classes
export type TailwindColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'pink' | 'gray';
export type TailwindShade = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
export type TailwindColorClass = `text-${TailwindColor}-${TailwindShade}` | `bg-${TailwindColor}-${TailwindShade}`;

// Const context for theme configurations
export const THEME_CONFIG = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      500: '#3b82f6',
      900: '#1e3a8a',
    },
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      500: '#64748b',
      900: '#0f172a',
    }
  },
  spacing: {
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem',
  }
} as const;

// Extract theme types from const assertion
export type ThemeConfig = typeof THEME_CONFIG;
export type ThemeColor = keyof ThemeConfig['colors'];
export type ThemeShade = keyof ThemeConfig['colors']['primary'];
export type ThemeSpacing = keyof ThemeConfig['spacing'];

// Advanced conditional types with template literals
export type EventName<T extends string> = `on${Capitalize<T>}`;
export type TaskEventName = EventName<'create' | 'update' | 'delete' | 'complete'>;

// Const context for event handlers
export const TASK_EVENTS = {
  onCreate: 'onCreate' as const,
  onUpdate: 'onUpdate' as const,
  onDelete: 'onDelete' as const,
  onComplete: 'onComplete' as const,
} as const;

export type TaskEvents = typeof TASK_EVENTS;
export type TaskEventKeys = keyof TaskEvents;
export type TaskEventValues = TaskEvents[TaskEventKeys];

// Template literal types for building type-safe query selectors
export type CSSSelector<T extends string> = `[data-testid="${T}"]` | `#${T}` | `.${T}`;
export type TaskSelector = CSSSelector<`task-${string}`>;
export type ProjectSelector = CSSSelector<`project-${string}`>;

// Advanced utility type for creating type-safe form field names
export type FormFieldName<T extends Record<string, any>, K extends keyof T = keyof T> = 
  K extends string 
    ? T[K] extends Record<string, any>
      ? `${K}.${FormFieldName<T[K]>}`
      : K
    : never;

// Example usage with task form
export interface TaskForm {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  metadata: {
    createdBy: string;
    tags: string[];
  };
}

export type TaskFormFieldName = FormFieldName<TaskForm>;
// Results in: "title" | "description" | "priority" | "metadata.createdBy" | "metadata.tags"

// Const context for status configurations with template literals
export const STATUS_CONFIG = {
  task: {
    pending: { 
      label: 'Pending',
      color: 'text-yellow-500' as TailwindColorClass,
      icon: '⏳'
    },
    inProgress: { 
      label: 'In Progress',
      color: 'text-blue-500' as TailwindColorClass,
      icon: '🔄'
    },
    completed: { 
      label: 'Completed',
      color: 'text-green-500' as TailwindColorClass,
      icon: '✅'
    },
  },
  project: {
    active: { 
      label: 'Active',
      color: 'text-green-600' as TailwindColorClass,
      icon: '🚀'
    },
    paused: { 
      label: 'Paused',
      color: 'text-gray-500' as TailwindColorClass,
      icon: '⏸️'
    },
    archived: { 
      label: 'Archived',
      color: 'text-gray-400' as TailwindColorClass,
      icon: '📁'
    },
  }
} as const;

export type StatusConfig = typeof STATUS_CONFIG;
export type TaskStatus = keyof StatusConfig['task'];
export type ProjectStatus = keyof StatusConfig['project'];

// Advanced pattern: Creating type-safe builders with template literals
export class TypeSafeQueryBuilder<T extends string = ''> {
  constructor(private query: T = '' as T) {}

  select<U extends string>(field: U): TypeSafeQueryBuilder<`${T}SELECT ${U} `> {
    return new TypeSafeQueryBuilder(`${this.query}SELECT ${field} ` as `${T}SELECT ${U} `);
  }

  from<U extends string>(table: U): TypeSafeQueryBuilder<`${T}FROM ${U} `> {
    return new TypeSafeQueryBuilder(`${this.query}FROM ${table} ` as `${T}FROM ${U} `);
  }

  where<U extends string>(condition: U): TypeSafeQueryBuilder<`${T}WHERE ${U} `> {
    return new TypeSafeQueryBuilder(`${this.query}WHERE ${condition} ` as `${T}WHERE ${U} `);
  }

  build(): T {
    return this.query;
  }
}

// Usage example with type safety
export const createTaskQuery = () =>
  new TypeSafeQueryBuilder()
    .select('*')
    .from('tasks')
    .where('status = "pending"')
    .build();

// Type-safe configuration pattern with const contexts
export const createConfig = <T extends Record<string, any>>(config: T) => config;

export const APP_CONFIG = createConfig({
  api: {
    baseUrl: 'http://localhost:3001',
    timeout: 5000,
    retries: 3,
  },
  ui: {
    animations: {
      duration: 300,
      easing: 'ease-in-out',
    },
    breakpoints: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
  },
  features: {
    darkMode: true,
    notifications: true,
    analytics: false,
  }
});

export type AppConfig = typeof APP_CONFIG;
export type APIConfig = AppConfig['api'];
export type UIConfig = AppConfig['ui'];
export type FeatureFlags = AppConfig['features'];

// Utility functions for working with branded types
export const createTaskId = (id: string): TaskId => id as TaskId;
export const createProjectId = (id: string): ProjectId => id as ProjectId;
export const createUserId = (id: string): UserId => id as UserId;
export const createTimestamp = (timestamp: number): Timestamp => timestamp as Timestamp;

// Type guard utilities
export const isTaskId = (value: string): value is TaskId => 
  typeof value === 'string' && value.length > 0;

export const isProjectId = (value: string): value is ProjectId => 
  typeof value === 'string' && value.length > 0;

// Advanced const assertion pattern for creating immutable data structures
export const createImmutableTaskData = <T extends Record<string, any>>(data: T) => {
  return Object.freeze(data) as Readonly<T>;
};

// Example usage
export const DEFAULT_TASK = createImmutableTaskData({
  title: '',
  description: '',
  priority: 'medium' as const,
  status: 'pending' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export type DefaultTask = typeof DEFAULT_TASK;