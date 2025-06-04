/**
 * Integration Tests Setup Configuration (2025)
 * 
 * Global setup for integration tests with enhanced async handling,
 * real service mocking, and comprehensive error tracking.
 */

import { jest } from '@jest/globals'
import * as fs from 'fs/promises'
import * as path from 'path'

// Extended timeout for integration tests
jest.setTimeout(60000)

// Test environment setup
beforeAll(async () => {
  console.log('🔧 Setting up integration test environment...')
  
  // Create test directories
  const testDirs = [
    'test-results/integration',
    'test-results/integration/coverage',
    'test-results/integration/artifacts'
  ]
  
  for (const dir of testDirs) {
    await fs.mkdir(dir, { recursive: true })
  }
  
  // Set environment variables
  process.env.NODE_ENV = 'test'
  process.env.TEST_TYPE = 'integration'
  process.env.LOG_LEVEL = 'error' // Reduce noise in tests
  
  console.log('✅ Integration test environment ready')
})

// Cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...')
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc()
  }
  
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 1000))
})

// Enhanced error tracking for integration tests
const integrationErrors: Array<{
  test: string
  error: Error
  timestamp: number
  context: any
}> = []

beforeEach(() => {
  const currentTest = expect.getState().currentTestName || 'unknown'
  
  // Track unhandled errors
  process.removeAllListeners('unhandledRejection')
  process.removeAllListeners('uncaughtException')
  
  process.on('unhandledRejection', (reason, promise) => {
    integrationErrors.push({
      test: currentTest,
      error: reason instanceof Error ? reason : new Error(String(reason)),
      timestamp: Date.now(),
      context: { type: 'unhandledRejection', promise }
    })
  })
  
  process.on('uncaughtException', (error) => {
    integrationErrors.push({
      test: currentTest,
      error,
      timestamp: Date.now(),
      context: { type: 'uncaughtException' }
    })
  })
})

afterEach(async () => {
  // Report any accumulated errors
  if (integrationErrors.length > 0) {
    console.warn(`⚠️ Integration test errors detected (${integrationErrors.length}):`)
    integrationErrors.forEach(({ test, error, context }) => {
      console.warn(`  - ${test}: ${error.message} (${context.type})`)
    })
    integrationErrors.length = 0 // Clear for next test
  }
  
  // Ensure clean state between tests
  jest.clearAllMocks()
  jest.clearAllTimers()
  
  // Allow time for async cleanup
  await new Promise(resolve => setTimeout(resolve, 100))
})

// Mock complex external dependencies for integration tests
const mockFileSystem = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn(),
  exists: jest.fn()
}

const mockElectronServices = {
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    webContents: {
      send: jest.fn(),
      executeJavaScript: jest.fn(),
      on: jest.fn(),
      once: jest.fn()
    },
    on: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: jest.fn(() => false)
  })),
  app: {
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
    getPath: jest.fn(() => '/mock/path'),
    getVersion: jest.fn(() => '1.0.0')
  }
}

// Global test utilities for integration tests
global.integrationUtils = {
  // Async operation helpers
  waitForAsync: async <T>(
    operation: () => Promise<T>,
    timeout = 30000,
    interval = 100
  ): Promise<T> => {
    const start = Date.now()
    let lastError: Error
    
    while (Date.now() - start < timeout) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        await new Promise(resolve => setTimeout(resolve, interval))
      }
    }
    
    throw lastError || new Error(`Operation timed out after ${timeout}ms`)
  },
  
  // Service mocking helpers
  mockService: <T extends object>(service: T, overrides: Partial<T> = {}): T => {
    const mockImplementation = {} as T
    
    for (const key in service) {
      if (typeof service[key] === 'function') {
        mockImplementation[key] = jest.fn() as any
      } else {
        mockImplementation[key] = service[key]
      }
    }
    
    return { ...mockImplementation, ...overrides }
  },
  
  // File system test helpers
  createTestFile: async (filePath: string, content: string) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content)
  },
  
  cleanupTestFiles: async (basePath: string) => {
    try {
      await fs.rm(basePath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  },
  
  // Memory monitoring
  getMemorySnapshot: () => {
    const usage = process.memoryUsage()
    return {
      heapUsed: usage.heapUsed / 1024 / 1024, // MB
      heapTotal: usage.heapTotal / 1024 / 1024, // MB
      external: usage.external / 1024 / 1024, // MB
      rss: usage.rss / 1024 / 1024 // MB
    }
  },
  
  // Network request simulation
  simulateNetworkDelay: (ms: number = 100) => 
    new Promise(resolve => setTimeout(resolve, ms)),
  
  // Event simulation
  simulateEvent: <T>(emitter: { emit: (event: string, ...args: any[]) => any }, event: string, data: T) => {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        emitter.emit(event, data)
        resolve()
      }, 0)
    })
  },
  
  // Database simulation helpers
  createMockDatabase: () => {
    const data = new Map()
    return {
      get: jest.fn((key: string) => Promise.resolve(data.get(key))),
      set: jest.fn((key: string, value: any) => {
        data.set(key, value)
        return Promise.resolve()
      }),
      delete: jest.fn((key: string) => {
        data.delete(key)
        return Promise.resolve()
      }),
      clear: jest.fn(() => {
        data.clear()
        return Promise.resolve()
      }),
      size: () => data.size
    }
  }
}

// Enhanced expect matchers for integration tests
expect.extend({
  toEventuallyBe(received: () => any, expected: any) {
    return global.integrationUtils.waitForAsync(async () => {
      const actual = await received()
      if (actual === expected) {
        return { pass: true, message: () => 'Values match' }
      }
      throw new Error(`Expected ${actual} to be ${expected}`)
    }, 5000).then(
      () => ({ pass: true, message: () => 'Condition eventually met' }),
      (error) => ({ pass: false, message: () => error.message })
    )
  },
  
  toHaveBeenCalledEventually(mockFn: jest.MockedFunction<any>, timeout = 5000) {
    return global.integrationUtils.waitForAsync(async () => {
      if (mockFn.mock.calls.length > 0) {
        return { pass: true, message: () => 'Function was called' }
      }
      throw new Error('Function not called')
    }, timeout).then(
      () => ({ pass: true, message: () => 'Function was eventually called' }),
      () => ({ pass: false, message: () => 'Function was never called within timeout' })
    )
  }
})

// Global mocks for integration testing
global.mockElectron = mockElectronServices
global.mockFS = mockFileSystem

// Type declarations
declare global {
  let integrationUtils: {
    waitForAsync: <T>(operation: () => Promise<T>, timeout?: number, interval?: number) => Promise<T>
    mockService: <T extends object>(service: T, overrides?: Partial<T>) => T
    createTestFile: (filePath: string, content: string) => Promise<void>
    cleanupTestFiles: (basePath: string) => Promise<void>
    getMemorySnapshot: () => { heapUsed: number; heapTotal: number; external: number; rss: number }
    simulateNetworkDelay: (ms?: number) => Promise<void>
    simulateEvent: <T>(emitter: { emit: (event: string, ...args: any[]) => any }, event: string, data: T) => Promise<void>
    createMockDatabase: () => {
      get: jest.MockedFunction<(key: string) => Promise<any>>
      set: jest.MockedFunction<(key: string, value: any) => Promise<void>>
      delete: jest.MockedFunction<(key: string) => Promise<void>>
      clear: jest.MockedFunction<() => Promise<void>>
      size: () => number
    }
  }
  
  let mockElectron: typeof mockElectronServices
  let mockFS: typeof mockFileSystem
  
  namespace jest {
    interface Matchers<R> {
      toEventuallyBe(expected: any): Promise<R>
      toHaveBeenCalledEventually(timeout?: number): Promise<R>
    }
  }
}