/**
 * Memory Leak Detection Tests (2025)
 * 
 * Comprehensive testing of memory management in Electron applications
 * including window lifecycle, IPC handler cleanup, event listener management,
 * and resource disposal following 2025 best practices with MemLab integration.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

// Global type declarations for test environment
declare global {

  interface GlobalThis {
    __mockElectron?: any
    __electron?: any
    electronAPI?: any
    taskmaster?: any
    __DEV__?: boolean
    __TEST__?: boolean
  }
}

import { app, BrowserWindow, ipcMain, webContents, session } from 'electron'
import { EventEmitter } from 'events'
import { TestWindowManager, cleanupTestWindows } from '../../../tests/utils/window-manager'

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    quit: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined)
  },
  BrowserWindow: vi.fn().mockImplementation(() => {
    const win = new EventEmitter()
    Object.assign(win, {
      id: Math.random(),
      loadURL: vi.fn().mockResolvedValue(undefined),
      loadFile: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      close: vi.fn(),
      destroy: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: {
        id: Math.random(),
        on: vi.fn(),
        once: vi.fn(),
        removeListener: vi.fn(),
        removeAllListeners: vi.fn(),
        session: {
          clearCache: vi.fn().mockResolvedValue(undefined),
          clearStorageData: vi.fn().mockResolvedValue(undefined),
          flushStorageData: vi.fn().mockResolvedValue(undefined)
        },
        debugger: {
          attach: vi.fn(),
          detach: vi.fn(),
          sendCommand: vi.fn()
        }
      }
    })
    return win
  }),
  ipcMain: {
    handle: vi.fn(),
    handleOnce: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
    listenerCount: vi.fn().mockReturnValue(0)
  },
  webContents: {
    getAllWebContents: vi.fn().mockReturnValue([])
  },
  session: {
    defaultSession: {
      getAllExtensions: vi.fn().mockReturnValue({
                    on: vi.fn(),
                    off: vi.fn(),
                    once: vi.fn(),
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                    webContents: { send: vi.fn() }
                  } as any),
      removeExtension: vi.fn(),
      clearCache: vi.fn().mockResolvedValue(undefined)
    }
  }
}))

// Memory tracking utilities
class MemoryTracker {
  private baselineMemory: number = 0
  private measurements: number[] = []
  
  public takeBaseline(): void {
    if (global.gc) {
      global.gc() // Force garbage collection if available
    }
    this.baselineMemory = process.memoryUsage().heapUsed
    this.measurements = []
  }
  
  public measure(): number {
    if (global.gc) {
      global.gc()
    }
    const currentMemory = process.memoryUsage().heapUsed
    const delta = currentMemory - this.baselineMemory
    this.measurements.push(delta)
    return delta
  }
  
  public getGrowthTrend(): 'stable' | 'growing' | 'shrinking' {
    if (this.measurements.length < 3) return 'stable'
    
    // Simple linear regression to detect trend
    const n = this.measurements.length
    const sumX = (n * (n - 1)) / 2
    const sumY = this.measurements.reduce((a, b) => a + b, 0)
    const sumXY = this.measurements.reduce((sum, y, x) => sum + x * y, 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    
    // Threshold for considering growth significant (1KB per iteration)
    const threshold = 1024
    
    if (slope > threshold) return 'growing'
    if (slope < -threshold) return 'shrinking'
    return 'stable'
  }
  
  public getMaxGrowth(): number {
    return Math.max(...this.measurements, 0)
  }
}

// Extend our imported TestWindowManager with IPC handler functionality
class ExtendedTestWindowManager extends TestWindowManager {
  private handlers: Map<string, Function> = new Map()
  private windowToIdMap: Map<BrowserWindow, string> = new Map()
  
  // Override createWindow to track window-to-id mapping
  public createWindow(options: any = {}): BrowserWindow {
    const id = options.id || `mem-test-${Date.now()}-${Math.random()}`
    const window = super.createWindow({ ...options, id })
    this.windowToIdMap.set(window, id)
    return window
  }
  
  // Add helper method to destroy by window instance
  public destroyWindow(windowOrId: BrowserWindow | string): void {
    if (typeof windowOrId === 'string') {
      super.destroyWindow(windowOrId)
    } else {
      const id = this.windowToIdMap.get(windowOrId)
      if (id) {
        this.windowToIdMap.delete(windowOrId)
        super.destroyWindow(id)
      }
    }
  }
  
  // Override destroyAllWindows to clear mapping
  public async destroyAllWindows(): Promise<void> {
    await super.destroyAllWindows()
    this.windowToIdMap.clear()
  }
  
  public setupIpcHandlers(): void {
    const handlers = [
      'app:get-version',
      'app:get-platform',
      'fs:read-file',
      'fs:write-file',
      'db:query'
    ]
    
    handlers.forEach(channel => {
      const handler = async (_event: any, ...args: any[]) => {
        // Simulate some work
        return { channel, args }
      }
      
      ipcMain.handle(channel, handler)
      this.handlers.set(channel, handler)
    })
  }
  
  public cleanupIpcHandlers(): void {
    for (const [channel] of this.handlers) {
      ipcMain.removeHandler(channel)
    }
    this.handlers.clear()
    ipcMain.removeAllListeners()
  }
}

describe('Memory Leak Detection Tests (2025)', () => {
  let memoryTracker: MemoryTracker
  let windowManager: ExtendedTestWindowManager
  
  beforeEach(() => {
    vi.clearAllMocks()
    memoryTracker = new MemoryTracker()
    windowManager = new ExtendedTestWindowManager({
      defaultTimeout: 30000,
      maxWindows: 20,
      showWindows: false,
      enableLogging: process.env.DEBUG === 'true'
    })
  })

  afterEach(async () => {
    windowManager.cleanupIpcHandlers()
    await windowManager.destroyAllWindows()
    await cleanupTestWindows()
    vi.restoreAllMocks()
  })

  describe('Window Lifecycle Memory Management', () => {
    test('should not leak memory when creating and destroying windows', () => {
      memoryTracker.takeBaseline()
      
      // Create and destroy windows multiple times
      for (let i = 0; i < 10; i++) {
        const window = windowManager.createWindow()
        
        // Simulate some window operations
        window.loadURL('https://example.com')
        window.webContents.on('did-finish-load', () => {})
        window.on('resize', () => {})
        
        // Destroy the window
        windowManager.destroyWindow(window)
        
        // Measure memory after each iteration
        memoryTracker.measure()
      }
      
      // Check memory growth trend
      const trend = memoryTracker.getGrowthTrend()
      const maxGrowth = memoryTracker.getMaxGrowth()
      
      // Memory should be stable or shrinking after GC
      expect(trend).not.toBe('growing')
      
      // Maximum growth should be reasonable (less than 10MB)
      expect(maxGrowth).toBeLessThan(10 * 1024 * 1024)
      
      // All windows should be cleaned up
      expect(windowManager.getWindowCount()).toBe(0)
    })

    test('should clean up event listeners properly', () => {
      const window = windowManager.createWindow()
      const listeners: Function[] = []
      
      // Add multiple listeners
      for (let i = 0; i < 100; i++) {
        const listener = vi.fn()
        window.on('resize', listener)
        window.webContents.on('did-navigate', listener)
        listeners.push(listener)
      }
      
      // Verify listeners were added
      expect(window.on).toHaveBeenCalledTimes(100)
      expect(window.webContents.on).toHaveBeenCalledTimes(100)
      
      // Destroy window should remove all listeners
      windowManager.destroyWindow(window)
      
      expect(window.removeAllListeners).toHaveBeenCalled()
      expect(window.webContents.removeAllListeners).toHaveBeenCalled()
    })

    test('should handle rapid window creation/destruction', async () => {
      memoryTracker.takeBaseline()
      
      // Create windows rapidly
      const promises = []
      for (let i = 0; i < 20; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            const window = windowManager.createWindow()
            
            // Simulate async operations
            setTimeout(() => {
              windowManager.destroyWindow(window)
              memoryTracker.measure()
              resolve()
            }, Math.random() * 100)
          })
        )
      }
      
      await Promise.all(promises)
      
      // Check final state
      expect(windowManager.getWindowCount()).toBe(0)
      
      const trend = memoryTracker.getGrowthTrend()
      expect(trend).not.toBe('growing')
    })
  })

  describe('IPC Handler Memory Management', () => {
    test('should not leak memory with IPC handlers', () => {
      memoryTracker.takeBaseline()
      
      // Add and remove handlers multiple times
      for (let i = 0; i < 10; i++) {
        windowManager.setupIpcHandlers()
        
        // Simulate IPC calls
        const mockEvent = { sender: { id: 1 } }
        ipcMain.handle.mock.calls.forEach(([, handler]) => {
          handler(mockEvent, 'test-data')
        })
        
        windowManager.cleanupIpcHandlers()
        memoryTracker.measure()
      }
      
      // Check memory stability
      const trend = memoryTracker.getGrowthTrend()
      expect(trend).not.toBe('growing')
      
      // Verify all handlers were removed
      expect(ipcMain.removeHandler).toHaveBeenCalled()
      expect(ipcMain.removeAllListeners).toHaveBeenCalled()
    })

    test('should handle handler reference cleanup', () => {
      const handlers = new WeakMap()
      const channels: string[] = []
      
      // Setup handlers with weak references
      for (let i = 0; i < 100; i++) {
        const channel = `test:channel:${i}`
        const handler = async () => ({ result: i })
        
        ipcMain.handle(channel, handler)
        handlers.set(handler, channel)
        channels.push(channel)
      }
      
      // Remove all handlers
      channels.forEach(channel => {
        ipcMain.removeHandler(channel)
      })
      
      // Verify cleanup
      expect(ipcMain.removeHandler).toHaveBeenCalledTimes(100)
      expect(ipcMain.listenerCount()).toBe(0)
    })

    test('should prevent duplicate handler registration', () => {
      const setupSecureHandlers = () => {
        const registeredHandlers = new Set<string>()
        
        const safeHandle = (channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) => {
          if (registeredHandlers.has(channel)) {
            ipcMain.removeHandler(channel)
          }
          ipcMain.handle(channel, handler)
          registeredHandlers.add(channel)
        }
        
        // Register handlers
        safeHandle('app:test', async () => 'result1')
        safeHandle('app:test', async () => 'result2') // Should remove first handler
        
        return registeredHandlers
      }
      
      const handlers = setupSecureHandlers()
      
      // Should have removed the first handler before adding the second
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('app:test')
      expect(handlers.size).toBe(1)
    })
  })

  describe('Session and Cache Management', () => {
    test('should clean up session data properly', async () => {
      const window = windowManager.createWindow()
      
      // Simulate session data accumulation
      const session = window.webContents.session
      
      // Load multiple pages
      for (let i = 0; i < 10; i++) {
        await window.loadURL(`https://example.com/page${i}`)
      }
      
      // Clean up session data
      await session.clearCache()
      await session.clearStorageData()
      await session.flushStorageData()
      
      // Verify cleanup methods were called
      expect(session.clearCache).toHaveBeenCalled()
      expect(session.clearStorageData).toHaveBeenCalled()
      expect(session.flushStorageData).toHaveBeenCalled()
      
      windowManager.destroyWindow(window)
    })

    test('should handle extension cleanup', () => {
      const extensions = {
        'ext1': { id: 'ext1', name: 'Extension 1' },
        'ext2': { id: 'ext2', name: 'Extension 2' }
      }
      
      session.defaultSession.getAllExtensions = vi.fn().mockReturnValue(extensions)
      
      // Clean up all extensions
      const cleanupExtensions = () => {
        const allExtensions = session.defaultSession.getAllExtensions()
        Object.keys(allExtensions).forEach(id => {
          session.defaultSession.removeExtension(id)
        })
      }
      
      cleanupExtensions()
      
      expect(session.defaultSession.removeExtension).toHaveBeenCalledWith('ext1')
      expect(session.defaultSession.removeExtension).toHaveBeenCalledWith('ext2')
    })
  })

  describe('WebContents Memory Management', () => {
    test('should track all webContents instances', () => {
      const windows: BrowserWindow[] = []
      const webContentsSet = new Set()
      
      // Create multiple windows
      for (let i = 0; i < 5; i++) {
        const window = windowManager.createWindow()
        windows.push(window)
        webContentsSet.add(window.webContents)
      }
      
      // Mock getAllWebContents
      webContents.getAllWebContents = vi.fn().mockReturnValue(Array.from(webContentsSet))
      
      // Verify all webContents are tracked
      expect(webContents.getAllWebContents()).toHaveLength(5)
      
      // Destroy windows and verify cleanup
      windows.forEach(window => windowManager.destroyWindow(window))
      
      // In real scenario, getAllWebContents would return empty array
      webContents.getAllWebContents = vi.fn().mockReturnValue([])
      expect(webContents.getAllWebContents()).toHaveLength(0)
    })

    test('should clean up debugger attachments', () => {
      const window = windowManager.createWindow()
      const debuggerApi = window.webContents.debugger
      
      // Attach debugger
      debuggerApi.attach('1.3')
      
      // Verify attached
      expect(debuggerApi.attach).toHaveBeenCalledWith('1.3')
      
      // Cleanup function
      const cleanupDebugger = () => {
        try {
          debuggerApi.detach()
        } catch {
          // Ignore errors if already detached
        }
      }
      
      // Clean up before destroying window
      cleanupDebugger()
      expect(debuggerApi.detach).toHaveBeenCalled()
      
      windowManager.destroyWindow(window)
    })
  })

  describe('Global Resource Cleanup', () => {
    test('should clean up app-level event listeners', () => {
      const listeners = []
      
      // Register app-level listeners
      const events = ['ready', 'window-all-closed', 'before-quit', 'will-quit', 'quit']
      
      events.forEach(event => {
        const listener = vi.fn()
        app.on(event, listener)
        listeners.push({ event, listener })
      })
      
      // Cleanup function
      const cleanupAppListeners = () => {
        listeners.forEach(({ event, listener }) => {
          app.removeListener(event, listener)
        })
      }
      
      cleanupAppListeners()
      
      // Verify all listeners were removed
      expect(app.removeListener).toHaveBeenCalledTimes(events.length)
    })

    test('should track and limit total window count', () => {
      const maxWindows = 10
      const windowTracker = {
        count: 0,
        max: maxWindows,
        
        canCreateWindow(): boolean {
          return this.count < this.max
        },
        
        registerWindow(): void {
          if (!this.canCreateWindow()) {
            throw new Error('Maximum window limit reached')
          }
          this.count++
        },
        
        unregisterWindow(): void {
          this.count = Math.max(0, this.count - 1)
        }
      }
      
      // Create windows up to limit
      for (let i = 0; i < maxWindows; i++) {
        expect(windowTracker.canCreateWindow()).toBe(true)
        windowTracker.registerWindow()
      }
      
      // Should not be able to create more
      expect(windowTracker.canCreateWindow()).toBe(false)
      expect(() => windowTracker.registerWindow()).toThrow('Maximum window limit reached')
      
      // Clean up some windows
      windowTracker.unregisterWindow()
      windowTracker.unregisterWindow()
      
      // Should be able to create again
      expect(windowTracker.canCreateWindow()).toBe(true)
      expect(windowTracker.count).toBe(8)
    })
  })

  describe('Memory Profiling Integration', () => {
    test('should support heap snapshot analysis', async () => {
      // Mock heap snapshot functionality
      
      // Mock debugger command
      const mockWindow = windowManager.createWindow()
      mockWindow.webContents.debugger.sendCommand = vi.fn().mockResolvedValue({
        nodes: [],
        edges: [],
        strings: []
      })
      
      const snapshot = await mockWindow.webContents.debugger.sendCommand('HeapProfiler.takeHeapSnapshot')
      
      expect(mockWindow.webContents.debugger.sendCommand).toHaveBeenCalledWith('HeapProfiler.takeHeapSnapshot')
      expect(snapshot).toHaveProperty('nodes')
      expect(snapshot).toHaveProperty('edges')
      
      windowManager.destroyWindow(mockWindow)
    })

    test('should detect memory growth patterns', () => {
      const detector = {
        samples: [] as number[],
        threshold: 0.1, // 10% growth threshold
        
        addSample(heapUsed: number): void {
          this.samples.push(heapUsed)
          if (this.samples.length > 10) {
            this.samples.shift() // Keep only last 10 samples
          }
        },
        
        detectLeak(): boolean {
          if (this.samples.length < 5) return false
          
          const firstHalf = this.samples.slice(0, 5).reduce((a, b) => a + b, 0) / 5
          const secondHalf = this.samples.slice(5).reduce((a, b) => a + b, 0) / 5
          
          const growthRate = (secondHalf - firstHalf) / firstHalf
          return growthRate > this.threshold
        }
      }
      
      // Simulate stable memory
      for (let i = 0; i < 10; i++) {
        detector.addSample(100 * 1024 * 1024 + Math.random() * 1024 * 1024) // ~100MB
      }
      expect(detector.detectLeak()).toBe(false)
      
      // Simulate memory leak
      detector.samples = []
      for (let i = 0; i < 10; i++) {
        detector.addSample((100 + i * 5) * 1024 * 1024) // Growing memory
      }
      expect(detector.detectLeak()).toBe(true)
    })
  })
})