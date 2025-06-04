/**
 * Electron Test Helper (2025)
 * 
 * Comprehensive test helper implementing all window management best practices
 * for Electron testing. Provides a complete solution for test setup, execution,
 * and cleanup following 2025 standards.
 */

import { BrowserWindow } from 'electron'
import { TestWindowManager } from './window-manager'
import { FailsafeCleanupManager, registerDefaultCleanupHandlers } from './failsafe-cleanup'

interface TestHelperOptions {
  windowTimeout?: number
  maxWindows?: number
  enableDebug?: boolean
  autoCleanup?: boolean
  memoryThreshold?: number
}

interface TestWindowOptions {
  id?: string
  show?: boolean
  width?: number
  height?: number
  timeout?: number
  webPreferences?: Electron.WebPreferences
}

interface TestContext {
  windowManager: TestWindowManager
  cleanupManager: FailsafeCleanupManager
  windows: Map<string, BrowserWindow>
  startTime: number
  memoryBaseline: NodeJS.MemoryUsage
}

/**
 * Comprehensive Electron Test Helper
 * 
 * Features:
 * - Automatic window lifecycle management
 * - Memory leak detection and prevention
 * - Failsafe cleanup on all exit conditions
 * - Performance monitoring
 * - Debug logging
 * - Test isolation
 */
export class ElectronTestHelper {
  private options: Required<TestHelperOptions>
  private context: TestContext
  private isInitialized: boolean = false
  private cleanupStack: (() => void | Promise<void>)[] = []
  
  constructor(options: TestHelperOptions = {}) {
    this.options = {
      windowTimeout: options.windowTimeout ?? 30000,
      maxWindows: options.maxWindows ?? 10,
      enableDebug: options.enableDebug ?? (process.env.DEBUG === 'true'),
      autoCleanup: options.autoCleanup ?? true,
      memoryThreshold: options.memoryThreshold ?? 50 * 1024 * 1024 // 50MB
    }
    
    // Initialize context
    this.context = {
      windowManager: new TestWindowManager({
        defaultTimeout: this.options.windowTimeout,
        maxWindows: this.options.maxWindows,
        showWindows: false,
        enableLogging: this.options.enableDebug
      }),
      cleanupManager: new FailsafeCleanupManager({
        enableLogging: this.options.enableDebug,
        gracefulShutdownTimeout: 5000,
        forceCleanupOnError: true
      }),
      windows: new Map(),
      startTime: Date.now(),
      memoryBaseline: process.memoryUsage()
    }
  }
  
  /**
   * Initializes the test helper
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return
    
    this.log('Initializing Electron test helper')
    
    // Register default cleanup handlers
    registerDefaultCleanupHandlers()
    
    // Register test-specific cleanup
    this.context.cleanupManager.registerHandler('test-windows', async () => {
      await this.cleanupAllWindows()
    }, { priority: 1 })
    
    // Set up process handlers
    this.setupProcessHandlers()
    
    // Record initial state
    this.context.memoryBaseline = process.memoryUsage()
    this.context.startTime = Date.now()
    
    this.isInitialized = true
    this.log('Electron test helper initialized')
  }
  
  /**
   * Creates a managed test window
   */
  public createWindow(options: TestWindowOptions = {}): BrowserWindow {
    const windowOptions = {
      id: options.id || `test-window-${Date.now()}`,
      show: options.show ?? false,
      width: options.width ?? 800,
      height: options.height ?? 600,
      timeout: options.timeout ?? this.options.windowTimeout,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        ...options.webPreferences
      }
    }
    
    const window = this.context.windowManager.createWindow(windowOptions)
    this.context.windows.set(windowOptions.id, window)
    
    // Add to cleanup stack
    this.addCleanup(() => {
      if (!window.isDestroyed()) {
        window.destroy()
      }
    })
    
    this.log(`Created test window: ${windowOptions.id}`)
    
    return window
  }
  
  /**
   * Gets a window by ID
   */
  public getWindow(id: string): BrowserWindow | undefined {
    return this.context.windows.get(id)
  }
  
  /**
   * Destroys a specific window
   */
  public async destroyWindow(id: string): Promise<void> {
    const window = this.context.windows.get(id)
    if (window) {
      this.context.windowManager.destroyWindow(id)
      this.context.windows.delete(id)
      this.log(`Destroyed test window: ${id}`)
    }
  }
  
  /**
   * Cleans up all windows
   */
  public async cleanupAllWindows(): Promise<void> {
    this.log(`Cleaning up ${this.context.windows.size} test windows`)
    
    await this.context.windowManager.destroyAllWindows()
    this.context.windows.clear()
    
    // Also clean up any stray windows
    const allWindows = BrowserWindow.getAllWindows()
    for (const window of allWindows) {
      if (!window.isDestroyed()) {
        window.destroy()
      }
    }
  }
  
  /**
   * Runs a test with automatic cleanup
   */
  public async runTest<T>(
    testName: string,
    testFn: (helper: ElectronTestHelper) => T | Promise<T>
  ): Promise<T> {
    this.log(`Running test: ${testName}`)
    
    try {
      // Initialize if needed
      await this.initialize()
      
      // Run the test
      const result = await testFn(this)
      
      // Check for memory leaks
      this.checkMemoryUsage(testName)
      
      return result
      
    } catch (error) {
      this.log(`Test failed: ${testName}`, 'error')
      throw error
      
    } finally {
      // Always cleanup
      if (this.options.autoCleanup) {
        await this.cleanup(testName)
      }
    }
  }
  
  /**
   * Adds a cleanup function
   */
  public addCleanup(cleanupFn: () => void | Promise<void>): void {
    this.cleanupStack.push(cleanupFn)
  }
  
  /**
   * Performs cleanup
   */
  public async cleanup(reason: string = 'manual'): Promise<void> {
    this.log(`Starting cleanup (reason: ${reason})`)
    
    // Run cleanup stack in reverse order
    while (this.cleanupStack.length > 0) {
      const cleanupFn = this.cleanupStack.pop()!
      try {
        await cleanupFn()
      } catch (error) {
        this.log(`Cleanup function failed: ${error}`, 'error')
      }
    }
    
    // Clean up windows
    await this.cleanupAllWindows()
    
    // Run failsafe cleanup
    await this.context.cleanupManager.runCleanup(reason)
    
    // Log final stats
    this.logFinalStats()
  }
  
  /**
   * Waits for a condition with timeout
   */
  public async waitFor(
    condition: () => boolean | Promise<boolean>,
    options: { timeout?: number; interval?: number; message?: string } = {}
  ): Promise<void> {
    const { timeout = 5000, interval = 100, message = 'Condition' } = options
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    
    throw new Error(`${message} not met within ${timeout}ms`)
  }
  
  /**
   * Simulates user input
   */
  public async simulateInput(
    window: BrowserWindow,
    input: { type: 'key' | 'mouse'; event: any }
  ): Promise<void> {
    if (window.isDestroyed()) {
      throw new Error('Cannot simulate input on destroyed window')
    }
    
    switch (input.type) {
      case 'key':
        window.webContents.sendInputEvent(input.event)
        break
      case 'mouse':
        window.webContents.sendInputEvent(input.event)
        break
    }
    
    // Small delay to let the event process
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  /**
   * Takes a screenshot
   */
  public async takeScreenshot(
    window: BrowserWindow,
    filename?: string
  ): Promise<Buffer> {
    if (window.isDestroyed()) {
      throw new Error('Cannot take screenshot of destroyed window')
    }
    
    const image = await window.webContents.capturePage()
    const buffer = image.toPNG()
    
    if (filename && process.env.SAVE_SCREENSHOTS === 'true') {
      const fs = await import('fs')
      const path = await import('path')
      const screenshotDir = path.join(process.cwd(), 'test-screenshots')
      
      await fs.promises.mkdir(screenshotDir, { recursive: true })
      await fs.promises.writeFile(
        path.join(screenshotDir, filename),
        buffer
      )
    }
    
    return buffer
  }
  
  /**
   * Gets memory statistics
   */
  public getMemoryStats(): {
    current: NodeJS.MemoryUsage
    baseline: NodeJS.MemoryUsage
    growth: NodeJS.MemoryUsage
    hasLeak: boolean
  } {
    const current = process.memoryUsage()
    const baseline = this.context.memoryBaseline
    
    const growth = {
      rss: current.rss - baseline.rss,
      heapTotal: current.heapTotal - baseline.heapTotal,
      heapUsed: current.heapUsed - baseline.heapUsed,
      external: current.external - baseline.external,
      arrayBuffers: current.arrayBuffers - baseline.arrayBuffers
    }
    
    const hasLeak = growth.heapUsed > this.options.memoryThreshold
    
    return { current, baseline, growth, hasLeak }
  }
  
  /**
   * Checks memory usage
   */
  private checkMemoryUsage(context: string): void {
    const stats = this.getMemoryStats()
    
    if (stats.hasLeak) {
      console.warn(`Potential memory leak in ${context}:`, {
        heapGrowth: `${Math.round(stats.growth.heapUsed / 1024 / 1024)}MB`,
        totalHeap: `${Math.round(stats.current.heapUsed / 1024 / 1024)}MB`
      })
    }
  }
  
  /**
   * Sets up process handlers
   */
  private setupProcessHandlers(): void {
    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
      this.log(`Uncaught exception: ${error}`, 'error')
      await this.cleanup('uncaughtException')
    })
    
    process.on('unhandledRejection', async (reason) => {
      this.log(`Unhandled rejection: ${reason}`, 'error')
      await this.cleanup('unhandledRejection')
    })
    
    // Handle test timeout
    if (this.options.windowTimeout > 0) {
      const globalTimeout = setTimeout(() => {
        this.log('Global test timeout reached', 'error')
        this.cleanup('timeout').then(() => {
          process.exit(1)
        })
      }, this.options.windowTimeout * 2) // 2x window timeout for global
      
      globalTimeout.unref() // Don't keep process alive
    }
  }
  
  /**
   * Logs final statistics
   */
  private logFinalStats(): void {
    const duration = Date.now() - this.context.startTime
    const memStats = this.getMemoryStats()
    
    this.log('Test helper final statistics:')
    this.log(`- Duration: ${duration}ms`)
    this.log(`- Windows created: ${this.context.windowManager.getWindowCount()}`)
    this.log(`- Memory growth: ${Math.round(memStats.growth.heapUsed / 1024 / 1024)}MB`)
    this.log(`- Potential leak: ${memStats.hasLeak}`)
  }
  
  /**
   * Logs a message
   */
  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (!this.options.enableDebug) return
    
    const timestamp = new Date().toISOString()
    const prefix = `[ElectronTestHelper ${timestamp}]`
    
    if (level === 'error') {
      console.error(`${prefix} ${message}`)
    } else {
      console.log(`${prefix} ${message}`)
    }
  }
}

/**
 * Global test helper instance
 */
export const testHelper = new ElectronTestHelper({
  windowTimeout: 30000,
  maxWindows: 10,
  enableDebug: process.env.DEBUG === 'true',
  autoCleanup: true,
  memoryThreshold: 50 * 1024 * 1024
})

/**
 * Test decorator for automatic setup and cleanup
 */
export function withElectronTest<T>(
  testName: string,
  testFn: (helper: ElectronTestHelper) => T | Promise<T>
): () => Promise<T> {
  return async () => {
    return testHelper.runTest(testName, testFn)
  }
}

/**
 * Creates a test window with defaults
 */
export function createManagedWindow(
  options: TestWindowOptions = {}
): BrowserWindow {
  return testHelper.createWindow(options)
}

/**
 * Waits for a window to be ready
 */
export async function waitForWindow(
  window: BrowserWindow,
  timeout: number = 5000
): Promise<void> {
  await testHelper.waitFor(
    () => !window.isDestroyed() && window.isVisible(),
    { timeout, message: 'Window ready' }
  )
}