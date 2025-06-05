/**
 * Renderer Process Test Setup (2025)
 * 
 * This setup file configures the testing environment for Electron's renderer process.
 * It provides React Testing Library configuration, mocks Electron APIs exposed
 * through contextBridge, and sets up proper testing environment for React components.
 * 
 * Research-based implementation following 2025 best practices for:
 * - React Testing Library with Electron integration
 * - Modern jsdom/happy-dom environment setup
 * - Electron contextBridge API mocking
 * - Performance monitoring and memory tracking
 */

import { vi, beforeEach, afterEach, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import { configure } from '@testing-library/react'
import '@testing-library/jest-dom'
import { createMockIpcRenderer } from '../mocks/electron'

// Import Zustand mock and resetAllStores directly
import { resetAllStores } from '../../__mocks__/zustand'

// Configure React Testing Library for optimal performance and debugging
configure({
  testIdAttribute: 'data-testid',
  // Increase async timeout for slower CI environments
  asyncUtilTimeout: 10000,
  // Better error messages for failed queries
  getElementError: (message, container) => {
    const error = new Error(message)
    error.name = 'TestingLibraryElementError'
    error.stack = null
    return error
  }
})

// Create IPC renderer mock
const ipcRendererMock = createMockIpcRenderer()

// Mock window.electron API
const mockElectronAPI = {
  // IPC Communication
  invoke: vi.fn().mockImplementation((channel: string, ...args: any[]) => {
    // Mock common IPC responses based on channel
    switch (channel) {
      case 'app:get-version':
        return Promise.resolve('1.0.0-test')
      case 'app:get-platform':
        return Promise.resolve('darwin')
      case 'dialog:show-open':
        return Promise.resolve({ 
          canceled: false, 
          filePaths: ['/mock/test.json'] 
        })
      case 'tasks:get-all':
        return Promise.resolve([])
      case 'tasks:save':
        return Promise.resolve(true)
      case 'window:minimize':
        return Promise.resolve()
      case 'window:close':
        return Promise.resolve()
      default:
        return Promise.resolve(null)
    }
  }),
  
  on: vi.fn().mockImplementation((channel: string, callback: (event: any, ...args: any[]) => void) => {
    // Store listeners for potential cleanup
    if (!global.mockIPCListeners) {
      global.mockIPCListeners = new Map()
    }
    
    if (!global.mockIPCListeners.has(channel)) {
      global.mockIPCListeners.set(channel, [])
    }
    
    global.mockIPCListeners.get(channel)!.push(callback)
    
    // Return cleanup function
    return () => {
      const listeners = global.mockIPCListeners.get(channel) || []
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }),
  
  off: vi.fn().mockImplementation((channel: string, callback?: (event: any, ...args: any[]) => void) => {
    if (!global.mockIPCListeners) return
    
    if (callback) {
      const listeners = global.mockIPCListeners.get(channel) || []
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    } else {
      global.mockIPCListeners.delete(channel)
    }
  }),
  
  send: vi.fn(),
  
  // File system operations
  showOpenDialog: vi.fn().mockResolvedValue({
    canceled: false,
    filePaths: ['/mock/selected/file.json']
  }),
  
  showSaveDialog: vi.fn().mockResolvedValue({
    canceled: false,
    filePath: '/mock/save/location.json'
  }),
  
  readFile: vi.fn().mockResolvedValue('{"tasks": []}'),
  writeFile: vi.fn().mockResolvedValue(true),
  
  // Window operations
  minimize: vi.fn().mockResolvedValue(undefined),
  maximize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  
  // App information
  getVersion: vi.fn().mockResolvedValue('1.0.0-test'),
  getPlatform: vi.fn().mockResolvedValue('darwin'),
  
  // Development tools
  openDevTools: vi.fn().mockResolvedValue(undefined),
  
  // Security validation
  validateOrigin: vi.fn().mockReturnValue(true),
  
  // Theme management
  getTheme: vi.fn().mockResolvedValue('light'),
  setTheme: vi.fn().mockResolvedValue(undefined),
  
  // Notifications
  showNotification: vi.fn().mockResolvedValue(undefined),
  
  // Analytics and telemetry (for testing)
  trackEvent: vi.fn().mockResolvedValue(undefined),
  
  // Performance monitoring
  getPerformanceMetrics: vi.fn().mockResolvedValue({
    memory: { used: 1024 * 1024 * 50, total: 1024 * 1024 * 100 },
    cpu: { usage: 15.5 }
  })
}

// Expose Electron API to renderer process (simulating contextBridge)
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: mockElectronAPI
})

// Also expose under legacy 'electron' namespace for backward compatibility
Object.defineProperty(window, 'electron', {
  writable: true,
  value: mockElectronAPI
})

// Mock common web APIs that might not be available in test environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver for virtual scrolling components
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
})

Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  value: window.IntersectionObserver,
})

// Mock ResizeObserver for responsive components
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
})

// Mock requestAnimationFrame for animations
Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: vi.fn().mockImplementation((callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 16)
  }),
})

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  value: vi.fn().mockImplementation((id: number) => {
    clearTimeout(id)
  }),
})

// Mock fetch for network requests
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  })
)

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn().mockReturnValue('mock-object-url'),
})

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: vi.fn(),
})

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  configurable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue('mock clipboard text'),
  },
})

// Enhanced error boundary testing support
window.addEventListener('error', (event) => {
  console.error('Uncaught error in test:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in test:', event.reason)
})

// Performance tracking for renderer tests
let renderStartTime: number

// Global test setup and teardown
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
  
  // Reset IPC renderer mock
  ipcRendererMock.removeAllListeners()
  
  // Reset mock implementations
  ipcRendererMock.invoke = vi.fn().mockImplementation((channel: string) => {
    switch (channel) {
      case 'app:get-version':
        return Promise.resolve('1.0.0-test')
      case 'app:get-platform':
        return Promise.resolve('darwin')
      case 'tasks:get-all':
        return Promise.resolve([])
      default:
        return Promise.resolve(null)
    }
  })
  
  // Reset Zustand stores for test isolation
  try {
    resetAllStores()
  } catch (error) {
    // Fail silently if Zustand mock not available
    console.warn('Zustand mock not available for store reset:', error.message)
  }
  
  // Track render performance
  renderStartTime = performance.now()
  
  // Clear localStorage and sessionStorage
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  // Clean up React Testing Library
  cleanup()
  
  // Clean up IPC mock
  ipcRendererMock.removeAllListeners()
  
  // Log slow tests (threshold: 1000ms)
  const renderTime = performance.now() - renderStartTime
  if (renderTime > 1000) {
    console.warn(`Slow test detected: ${Math.round(renderTime)}ms render time`)
  }
  
  // Reset timers
  vi.useRealTimers()
  
  // Clean up any remaining DOM event listeners
  document.body.innerHTML = ''
})

// Utility functions for tests
export const mockIPCResponse = (channel: string, response: any) => {
  ipcRendererMock.invoke = vi.fn().mockImplementation((ch: string) => {
    if (ch === channel) {
      return Promise.resolve(response)
    }
    return Promise.resolve(null)
  })
}

export const triggerIPCEvent = (channel: string, ...args: any[]) => {
  const event = new Event('ipc-message')
  ;(ipcRendererMock as any)._triggerListener(channel, event, ...args)
}

export const waitForIPCCall = (channel: string, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`IPC call to ${channel} not received within ${timeout}ms`))
    }, timeout)
    
    const originalInvoke = ipcRendererMock.invoke as any
    ipcRendererMock.invoke = vi.fn().mockImplementation((ch: string, ...args: any[]) => {
      if (ch === channel) {
        clearTimeout(timer)
        resolve(args)
      }
      return originalInvoke(ch, ...args)
    })
  })
}

// Extend expect with custom matchers for Electron testing
expect.extend({
  toHaveBeenCalledWithIPC(received, channel, ...args) {
    const pass = received.mock.calls.some(call => 
      call[0] === channel && 
      args.every((arg, index) => call[index + 1] === arg)
    )
    
    if (pass) {
      return {
        message: () => `Expected ${received.getMockName()} not to have been called with IPC channel "${channel}"`,
        pass: true,
      }
    } else {
      return {
        message: () => `Expected ${received.getMockName()} to have been called with IPC channel "${channel}"`,
        pass: false,
      }
    }
  },
})

// Type declarations for global additions
declare global {
  interface Window {
    electronAPI: typeof mockElectronAPI
    electron: typeof mockElectronAPI
  }
  
<<<<<<< HEAD
=======
  var mockIPCListeners: Map<string, ((event: any, ...args: any[]) => void)[]>
  
>>>>>>> fix/ts-module-errors
  namespace Vi {
    interface JestAssertion<T = any> {
      toHaveBeenCalledWithIPC(channel: string, ...args: any[]): T
    }
  }
}

export { mockElectronAPI, ipcRendererMock }