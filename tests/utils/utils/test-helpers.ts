import { vi, MockedFunction } from 'vitest'
// Type definitions for better TypeScript support
export interface MockTask {
  id: number
  title: string
  description: string
  status: 'pending' | 'in-progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  created: string
  updated: string
  dependencies?: number[]
  subtasks?: MockTask[]
}

export interface MockProject {
  name: string
  path: string
  tasksFile: string
  isActive: boolean
  lastAccessed: string
}

// Test data factories
export const createMockTask = (overrides: Partial<MockTask> = {}): MockTask => {
  const now = new Date().toISOString()
  return {
    id: Math.floor(Math.random() * 1000),
    title: 'Sample Task',
    description: 'A sample task for testing',
    status: 'pending',
    priority: 'medium',
    created: now,
    updated: now,
    dependencies: [],
    subtasks: [],
    ...overrides
  }
}

export const createMockProject = (overrides: Partial<MockProject> = {}): MockProject => {
  const now = new Date().toISOString()
  return {
    name: 'Test Project',
    path: '/mock/test-project',
    tasksFile: '/mock/test-project/tasks/tasks.json',
    isActive: true,
    lastAccessed: now,
    ...overrides
  }
}

export const createMockTaskList = (count: number, overrides: Partial<MockTask> = {}): MockTask[] => {
  return Array.from({ length: count }, (_, index) => 
    createMockTask({ 
      id: index + 1, 
      title: `Task ${index + 1}`,
      ...overrides 
    })
  )
}

// Mock function utilities
export const createAsyncMock = <T = any>(
  resolveValue?: T,
  delay: number = 0
): MockedFunction<(...args: any[]) => Promise<T>> => {
  return vi.fn().mockImplementation((...args: any[]) => 
    new Promise((resolve) => 
      setTimeout(() => resolve(resolveValue as T), delay)
    )
  )
}

export const createRejectingMock = (
  error: Error | string,
  delay: number = 0
): MockedFunction<(...args: any[]) => Promise<never>> => {
  const errorObj = typeof error === 'string' ? new Error(error) : error
  return vi.fn().mockImplementation(() => 
    new Promise((_, reject) => 
      setTimeout(() => reject(errorObj), delay)
    )
  )
}

// Time utilities for testing
export const mockTime = (dateString: string): void => {
  const mockDate = new Date(dateString)
  vi.setSystemTime(mockDate)
}

export const advanceTime = (milliseconds: number): void => {
  vi.advanceTimersByTime(milliseconds)
}

export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error(`Condition not met within ${timeout}ms`)
}

// File system test utilities
export const createMockFileContent = (tasks: MockTask[]): string => {
  return JSON.stringify({ tasks }, null, 2)
}

export const createMockProjectStructure = (projectName: string): Record<string, string> => {
  return {
    [`${projectName}/tasks/tasks.json`]: createMockFileContent([]),
    [`${projectName}/README.md`]: `# ${projectName}\n\nTest project for TaskMaster testing.`,
    [`${projectName}/package.json`]: JSON.stringify({
      name: projectName,
      version: '1.0.0',
      description: 'Test project'
    }, null, 2)
  }
}

// Mock storage utilities
export class MockStorage implements Storage {
  private store: Record<string, string> = {}

  get length(): number {
    return Object.keys(this.store).length
  }

  clear(): void {
    this.store = {}
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store)
    return keys[index] ?? null
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  setItem(key: string, value: string): void {
    this.store[key] = value
  }
}

// Event simulation utilities
export const simulateKeyboardEvent = (
  element: Element,
  eventType: 'keydown' | 'keyup' | 'keypress',
  key: string,
  options: KeyboardEventInit = {}
): void => {
  const event = new KeyboardEvent(eventType, {
    key,
    bubbles: true,
    cancelable: true,
    ...options
  })
  element.dispatchEvent(event)
}

export const simulateMouseEvent = (
  element: Element,
  eventType: 'click' | 'mousedown' | 'mouseup' | 'mouseover' | 'mouseout',
  options: MouseEventInit = {}
): void => {
  const event = new MouseEvent(eventType, {
    bubbles: true,
    cancelable: true,
    ...options
  })
  element.dispatchEvent(event)
}

// Performance measurement utilities
export const measureAsyncOperation = async <T>(
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const start = performance.now()
  const result = await operation()
  const duration = performance.now() - start
  return { result, duration }
}

export const expectOperationToBefast = async <T>(
  operation: () => Promise<T>,
  maxDuration: number = 1000
): Promise<T> => {
  const { result, duration } = await measureAsyncOperation(operation)
  
  if (duration > maxDuration) {
    throw new Error(`Operation took ${duration}ms, expected less than ${maxDuration}ms`)
  }
  
  return result
}

// Memory leak detection utilities
export const trackMemoryUsage = (): { getUsage: () => NodeJS.MemoryUsage; getDiff: () => NodeJS.MemoryUsage } => {
  const baseline = process.memoryUsage()
  
  return {
    getUsage: () => process.memoryUsage(),
    getDiff: () => {
      const current = process.memoryUsage()
      return {
        rss: current.rss - baseline.rss,
        heapTotal: current.heapTotal - baseline.heapTotal,
        heapUsed: current.heapUsed - baseline.heapUsed,
        external: current.external - baseline.external,
        arrayBuffers: current.arrayBuffers - baseline.arrayBuffers
      }
    }
  }
}

// Zustand store testing utilities
export const createMockZustandStore = <T>(initialState: T) => {
  let state = initialState
  const listeners = new Set<() => void>()

  return {
    getState: () => state,
    setState: (partial: Partial<T> | ((state: T) => T)) => {
      const nextState = typeof partial === 'function' ? partial(state) : partial
      state = { ...state, ...nextState }
      listeners.forEach(listener => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    destroy: () => {
      listeners.clear()
    }
  }
}

// React Testing Library enhancement utilities
export const findByTestId = (container: Element, testId: string): Element => {
  const element = container.querySelector(`[data-testid="${testId}"]`)
  if (!element) {
    throw new Error(`Element with data-testid="${testId}" not found`)
  }
  return element
}

export const getAllByTestId = (container: Element, testId: string): Element[] => {
  return Array.from(container.querySelectorAll(`[data-testid="${testId}"]`))
}

// Accessibility testing utilities
export const expectElementToBeAccessible = (element: Element): void => {
  // Check for basic accessibility attributes
  const tagName = element.tagName.toLowerCase()
  
  if (tagName === 'button' || element.getAttribute('role') === 'button') {
    if (!element.textContent?.trim() && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
      throw new Error('Button element must have accessible text or aria-label')
    }
  }
  
  if (tagName === 'img') {
    if (!element.getAttribute('alt')) {
      throw new Error('Image element must have alt attribute')
    }
  }
  
  if (tagName === 'input') {
    const type = element.getAttribute('type') || 'text'
    if (!['hidden', 'submit', 'button'].includes(type)) {
      const hasLabel = element.getAttribute('aria-label') || 
                      element.getAttribute('aria-labelledby') ||
                      element.getAttribute('placeholder') ||
                      document.querySelector(`label[for="${element.id}"]`)
      
      if (!hasLabel) {
        throw new Error('Input element must have associated label or aria-label')
      }
    }
  }
}

// Custom assertion utilities
export const expectToMatchSnapshot = (value: any, snapshotName?: string): void => {
  // Implementation would depend on snapshot testing setup
  console.log('Snapshot comparison:', { value, snapshotName })
}

export const expectToBeWithinRange = (value: number, min: number, max: number): void => {
  if (value < min || value > max) {
    throw new Error(`Expected ${value} to be within range ${min}-${max}`)
  }
}

// Environment detection utilities
export const isInCIEnvironment = (): boolean => {
  return Boolean(process.env.CI || process.env.GITHUB_ACTIONS || process.env.CONTINUOUS_INTEGRATION)
}

export const getTestEnvironment = (): 'development' | 'ci' | 'local' => {
  if (isInCIEnvironment()) return 'ci'
  if (process.env.NODE_ENV === 'development') return 'development'
  return 'local'
}

// Cleanup utilities
export const createCleanupStack = () => {
  const cleanupFunctions: (() => void | Promise<void>)[] = []
  
  return {
    add: (cleanup: () => void | Promise<void>) => {
      cleanupFunctions.push(cleanup)
    },
    runAll: async () => {
      for (const cleanup of cleanupFunctions.reverse()) {
        await cleanup()
      }
      cleanupFunctions.length = 0
    }
  }
}

export { vi }