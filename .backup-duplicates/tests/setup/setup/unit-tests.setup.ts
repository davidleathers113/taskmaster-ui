/**
 * Unit Tests Setup Configuration (2025)
 * 
 * Global setup for unit tests following 2025 best practices:
 * - Enhanced error handling and debugging
 * - Mock configuration for Electron APIs
 * - Performance monitoring setup
 * - Memory leak detection configuration
 */

import { jest } from '@jest/globals'

// Global test timeout
jest.setTimeout(30000)

// Mock Electron APIs for unit testing
const mockElectronAPI = {
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    send: jest.fn(),
    removeAllListeners: jest.fn()
  },
  app: {
    getVersion: jest.fn(() => '1.0.0'),
    getName: jest.fn(() => 'TaskMaster'),
    getPath: jest.fn(() => '/mock/path'),
    quit: jest.fn()
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn()
  },
  shell: {
    openExternal: jest.fn(),
    showItemInFolder: jest.fn()
  }
}

// Global mocks
global.electronAPI = mockElectronAPI

// Mock localStorage for renderer tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}))

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16))
global.cancelAnimationFrame = jest.fn()

// Console override for cleaner test output
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeAll(() => {
  // Suppress expected warnings in tests
  console.error = (...args: any[]) => {
    if (
      args[0]?.includes?.('Warning: ReactDOM.render is no longer supported') ||
      args[0]?.includes?.('Warning: componentWillReceiveProps')
    ) {
      return
    }
    originalConsoleError(...args)
  }
  
  console.warn = (...args: any[]) => {
    if (args[0]?.includes?.('Warning:')) {
      return
    }
    originalConsoleWarn(...args)
  }
})

afterAll(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

// Global test utilities
global.testUtils = {
  // Wait for next tick
  waitForNextTick: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  // Wait for condition
  waitFor: async (condition: () => boolean, timeout = 5000) => {
    const start = Date.now()
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`)
    }
  },
  
  // Mock timer helpers
  advanceTimers: (ms: number) => {
    jest.advanceTimersByTime(ms)
  },
  
  // Memory usage helpers
  getMemoryUsage: () => process.memoryUsage(),
  
  // Performance measurement
  measurePerformance: <T>(fn: () => T | Promise<T>) => {
    const start = performance.now()
    const result = fn()
    if (result instanceof Promise) {
      return result.then(value => ({
        result: value,
        duration: performance.now() - start
      }))
    }
    return {
      result,
      duration: performance.now() - start
    }
  }
}

// Performance monitoring for tests
let testStartTime: number
let testMemoryStart: NodeJS.MemoryUsage

beforeEach(() => {
  testStartTime = performance.now()
  testMemoryStart = process.memoryUsage()
  
  // Reset all mocks
  jest.clearAllMocks()
})

afterEach(() => {
  const testDuration = performance.now() - testStartTime
  const testMemoryEnd = process.memoryUsage()
  const memoryDelta = testMemoryEnd.heapUsed - testMemoryStart.heapUsed
  
  // Log performance metrics for slow tests
  if (testDuration > 1000) {
    console.warn(`⚠️ Slow test detected: ${testDuration.toFixed(2)}ms`)
  }
  
  // Log memory usage for memory-intensive tests
  if (memoryDelta > 10 * 1024 * 1024) { // 10MB
    console.warn(`⚠️ High memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`)
  }
})

// Error boundary for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

// Enhanced expect matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      }
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      }
    }
  },
  
  toHaveBeenCalledWithAsync(received: jest.MockedFunction<any>, ...expectedArgs: any[]) {
    return {
      message: () => `expected function to have been called with ${JSON.stringify(expectedArgs)}`,
      pass: received.mock.calls.some(call => 
        call.length === expectedArgs.length &&
        call.every((arg, index) => JSON.stringify(arg) === JSON.stringify(expectedArgs[index]))
      )
    }
  }
})

// Type declarations for global utilities
declare global {
  var electronAPI: typeof mockElectronAPI
  var testUtils: {
    waitForNextTick: () => Promise<void>
    waitFor: (condition: () => boolean, timeout?: number) => Promise<void>
    advanceTimers: (ms: number) => void
    getMemoryUsage: () => NodeJS.MemoryUsage
    measurePerformance: <T>(fn: () => T | Promise<T>) => T extends Promise<infer U> 
      ? Promise<{ result: U; duration: number }> 
      : { result: T; duration: number }
  }
  
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R
      toHaveBeenCalledWithAsync(...args: any[]): R
    }
  }
}