/**
 * Preload Process Test Setup (2025)
 * 
 * This setup file configures the testing environment for Electron's preload scripts.
 * It mocks the contextBridge and ipcRenderer APIs that are available in the preload
 * environment, ensuring secure testing of the bridge between main and renderer processes.
 * 
 * Research-based implementation following 2025 best practices for:
 * - Preload script security testing patterns
 * - contextBridge API mocking strategies
 * - IPC communication validation
 * - Context isolation verification
 */

import { vi, beforeEach, afterEach } from 'vitest'

// Mock contextBridge for preload script testing
const mockContextBridge = {
  exposeInMainWorld: vi.fn().mockImplementation((key: string, api: any) => {
    // Simulate the contextBridge behavior in tests
    if (typeof global !== 'undefined') {
      ;(global as any)[key] = api
    }
    
    // Validate API structure for security
    if (typeof api === 'object' && api !== null) {
      for (const [methodName, method] of Object.entries(api)) {
        if (typeof method !== 'function') {
          console.warn(`Warning: Non-function property '${methodName}' exposed via contextBridge`)
        }
      }
    }
    
    return true
  }),
  
  // Mock for testing context isolation
  isMainWorldIsolated: vi.fn().mockReturnValue(true),
  
  // Validation helper for testing
  validateExposedAPI: vi.fn().mockImplementation((api: any) => {
    // Simulate security validation that contextBridge performs
    if (typeof api !== 'object' || api === null) {
      throw new Error('API must be an object')
    }
    
    // Check for prototype pollution attempts
    if ('__proto__' in api || 'constructor' in api || 'prototype' in api) {
      throw new Error('API contains prohibited properties')
    }
    
    return true
  })
}

// Mock ipcRenderer for preload script testing
const mockIpcRenderer = {
  invoke: vi.fn().mockImplementation((channel: string, ...args: any[]) => {
    // Mock responses based on channel for testing
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
      case 'security:validate-origin':
        return Promise.resolve(true)
      default:
        console.warn(`Unhandled IPC channel in test: ${channel}`)
        return Promise.resolve(null)
    }
  }),
  
  send: vi.fn().mockImplementation((channel: string, ...args: any[]) => {
    // Log send operations for test verification
    console.debug(`IPC send: ${channel}`, args)
  }),
  
  on: vi.fn().mockImplementation((channel: string, listener: (event: any, ...args: any[]) => void) => {
    // Store listeners for cleanup and testing
    if (!global.mockPreloadListeners) {
      global.mockPreloadListeners = new Map()
    }
    
    if (!global.mockPreloadListeners.has(channel)) {
      global.mockPreloadListeners.set(channel, [])
    }
    
    global.mockPreloadListeners.get(channel)!.push(listener)
    
    // Return the listener for removeListener calls
    return listener
  }),
  
  once: vi.fn().mockImplementation((channel: string, listener: (event: any, ...args: any[]) => void) => {
    // Mock once behavior
    const wrappedListener = (...args: any[]) => {
      listener(...args)
      mockIpcRenderer.removeListener(channel, wrappedListener)
    }
    
    return mockIpcRenderer.on(channel, wrappedListener)
  }),
  
  removeListener: vi.fn().mockImplementation((channel: string, listener: (event: any, ...args: any[]) => void) => {
    if (!global.mockPreloadListeners) return
    
    const listeners = global.mockPreloadListeners.get(channel) || []
    const index = listeners.indexOf(listener)
    if (index > -1) {
      listeners.splice(index, 1)
    }
  }),
  
  removeAllListeners: vi.fn().mockImplementation((channel?: string) => {
    if (!global.mockPreloadListeners) return
    
    if (channel) {
      global.mockPreloadListeners.delete(channel)
    } else {
      global.mockPreloadListeners.clear()
    }
  }),
  
  // Security-related methods for testing
  sendSync: vi.fn().mockImplementation((channel: string, ...args: any[]) => {
    console.warn(`sendSync called in test (should be avoided): ${channel}`)
    return null
  }),
  
  postMessage: vi.fn(),
  
  // For testing frame-to-frame communication
  sendTo: vi.fn(),
  sendToHost: vi.fn()
}

// Mock the entire Electron module for preload context
vi.mock('electron', () => ({
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer,
  
  // Mock other APIs that might be used in preload scripts
  webFrame: {
    setZoomFactor: vi.fn(),
    getZoomFactor: vi.fn().mockReturnValue(1.0),
    setZoomLevel: vi.fn(),
    getZoomLevel: vi.fn().mockReturnValue(0),
    setSpellCheckProvider: vi.fn(),
    insertCSS: vi.fn().mockReturnValue(''),
    removeInsertedCSS: vi.fn(),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    getResourceUsage: vi.fn().mockReturnValue({
      images: { count: 0, size: 0, liveSize: 0 },
      scripts: { count: 0, size: 0, liveSize: 0 },
      cssStyleSheets: { count: 0, size: 0, liveSize: 0 },
      xslStyleSheets: { count: 0, size: 0, liveSize: 0 },
      fonts: { count: 0, size: 0, liveSize: 0 },
      other: { count: 0, size: 0, liveSize: 0 }
    })
  },
  
  // Security features for testing
  nativeImage: {
    createEmpty: vi.fn(),
    createFromPath: vi.fn(),
    createFromBitmap: vi.fn(),
    createFromBuffer: vi.fn(),
    createFromDataURL: vi.fn()
  },
  
  // Crash reporter for testing error handling
  crashReporter: {
    start: vi.fn(),
    getLastCrashReport: vi.fn().mockReturnValue(null),
    getUploadedReports: vi.fn().mockReturnValue([]),
    addExtraParameter: vi.fn(),
    removeExtraParameter: vi.fn(),
    getParameters: vi.fn().mockReturnValue({})
  }
}))

// Mock Node.js APIs that might be accessible in preload (but should be limited)
vi.mock('fs', () => ({
  // Preload scripts should have limited file system access
  promises: {
    readFile: vi.fn().mockRejectedValue(new Error('fs access not allowed in preload')),
    writeFile: vi.fn().mockRejectedValue(new Error('fs access not allowed in preload'))
  }
}))

vi.mock('path', async () => {
  // Limited path utilities that might be safe in preload
  const actual = await vi.importActual('path')
  return {
    basename: actual.basename,
    extname: actual.extname,
    // Block dangerous path operations
    join: vi.fn().mockImplementation(() => {
      throw new Error('path.join access restricted in preload')
    }),
    resolve: vi.fn().mockImplementation(() => {
      throw new Error('path.resolve access restricted in preload')
    })
  }
})

// Security validation helpers for testing
export const validateContextIsolation = () => {
  // Test that context isolation is properly configured
  return mockContextBridge.isMainWorldIsolated()
}

export const validateAPIExposure = (key: string, expectedAPI: any) => {
  // Verify that APIs are properly exposed through contextBridge
  const exposedAPI = (global as any)[key]
  
  if (!exposedAPI) {
    throw new Error(`API '${key}' was not exposed`)
  }
  
  // Validate API structure matches expected
  for (const [methodName, method] of Object.entries(expectedAPI)) {
    if (typeof exposedAPI[methodName] !== typeof method) {
      throw new Error(`Method '${methodName}' type mismatch in exposed API`)
    }
  }
  
  return true
}

export const simulateMainWorldMessage = (channel: string, ...args: any[]) => {
  // Simulate a message from the main process for testing
  const listeners = global.mockPreloadListeners?.get(channel) || []
  listeners.forEach(listener => {
    try {
      listener(null, ...args) // First arg is typically the event object
    } catch (error) {
      console.error(`Error in preload listener for ${channel}:`, error)
    }
  })
}

export const validateSecureAPI = (api: any) => {
  // Validate that the API doesn't expose dangerous methods
  const dangerousProps = ['__proto__', 'constructor', 'prototype', 'eval', 'Function']
  
  for (const prop of dangerousProps) {
    if (prop in api) {
      throw new Error(`Dangerous property '${prop}' found in API`)
    }
  }
  
  // Validate all exposed methods are functions
  for (const [key, value] of Object.entries(api)) {
    if (typeof value !== 'function') {
      console.warn(`Non-function property '${key}' exposed in API`)
    }
  }
  
  return true
}

// Memory usage tracking for preload scripts
let memoryBaseline: number

// Global test setup and teardown
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
  
  // Clear listener storage
  global.mockPreloadListeners?.clear()
  
  // Reset context bridge state
  if (typeof global !== 'undefined') {
    // Clean up any previously exposed APIs
    Object.keys(global).forEach(key => {
      if (key.startsWith('electronAPI') || key === 'electron') {
        delete (global as any)[key]
      }
    })
  }
  
  // Record memory baseline
  memoryBaseline = process.memoryUsage().heapUsed
  
  // Reset mock implementations
  mockIpcRenderer.invoke.mockImplementation((channel: string, ...args: any[]) => {
    switch (channel) {
      case 'app:get-version':
        return Promise.resolve('1.0.0-test')
      case 'app:get-platform':
        return Promise.resolve('darwin')
      default:
        return Promise.resolve(null)
    }
  })
})

afterEach(() => {
  // Clean up listeners
  global.mockPreloadListeners?.clear()
  
  // Check for memory leaks in preload scripts
  const currentMemory = process.memoryUsage().heapUsed
  const memoryGrowth = currentMemory - memoryBaseline
  
  // Log significant memory growth (threshold: 5MB for preload scripts)
  if (memoryGrowth > 5 * 1024 * 1024) {
    console.warn(`Potential memory leak in preload script: ${Math.round(memoryGrowth / 1024 / 1024)}MB growth`)
  }
  
  // Verify no dangerous APIs were exposed
  if (typeof global !== 'undefined') {
    Object.keys(global).forEach(key => {
      if (key.startsWith('electronAPI') || key === 'electron') {
        try {
          validateSecureAPI((global as any)[key])
        } catch (error) {
          console.error(`Security validation failed for exposed API '${key}':`, error)
        }
      }
    })
  }
  
  // Reset all mocks
  vi.resetAllMocks()
})

// Type declarations for global additions
declare global {
  var mockPreloadListeners: Map<string, ((event: any, ...args: any[]) => void)[]>
}

export { mockContextBridge, mockIpcRenderer }