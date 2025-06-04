/**
 * Test Window Manager for Electron Testing (2025)
 * 
 * Centralized window management utility implementing best practices for
 * Electron window lifecycle management during testing. Provides comprehensive
 * tracking, cleanup, and safety features following 2025 security standards.
 */

import { BrowserWindow, app, BrowserWindowConstructorOptions } from 'electron'
import { EventEmitter } from 'events'

// Window tracking types
interface TrackedWindow {
  id: string
  window: BrowserWindow
  createdAt: Date
  timeout?: NodeJS.Timeout
  listeners: Map<string, (...args: any[]) => void>
  metadata?: Record<string, any>
}

interface WindowManagerOptions {
  defaultTimeout?: number // Auto-destroy timeout in ms
  maxWindows?: number // Maximum concurrent windows
  showWindows?: boolean // Whether to show windows during tests
  enableLogging?: boolean // Enable detailed logging
}

interface WindowCreationOptions extends BrowserWindowConstructorOptions {
  id?: string // Custom ID for the window
  timeout?: number // Override default timeout
  metadata?: Record<string, any> // Custom metadata
}

// Memory tracking utilities
export class MemoryMonitor {
  private samples: number[] = []
  private maxSamples: number = 20
  
  public recordSample(): void {
    const usage = process.memoryUsage().heapUsed
    this.samples.push(usage)
    
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }
  }
  
  public getAverageUsage(): number {
    if (this.samples.length === 0) return 0
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length
  }
  
  public detectLeak(threshold: number = 0.1): boolean {
    if (this.samples.length < 10) return false
    
    const firstHalf = this.samples.slice(0, 5).reduce((a, b) => a + b, 0) / 5
    const lastHalf = this.samples.slice(-5).reduce((a, b) => a + b, 0) / 5
    
    const growthRate = (lastHalf - firstHalf) / firstHalf
    return growthRate > threshold
  }
  
  public reset(): void {
    this.samples = []
  }
}

/**
 * Comprehensive Test Window Manager
 * 
 * Features:
 * - Automatic window tracking and cleanup
 * - Timeout protection
 * - Memory leak detection
 * - Event listener management
 * - Concurrent window limits
 * - Detailed logging
 * - Error recovery
 */
export class TestWindowManager extends EventEmitter {
  private windows: Map<string, TrackedWindow> = new Map()
  private cleanupHandlers: Set<() => void | Promise<void>> = new Set()
  private memoryMonitor: MemoryMonitor = new MemoryMonitor()
  private options: Required<WindowManagerOptions>
  private isCleaningUp: boolean = false
  private windowCounter: number = 0
  
  constructor(options: WindowManagerOptions = {}) {
    super()
    
    this.options = {
      defaultTimeout: options.defaultTimeout ?? 300000, // 5 minutes default
      maxWindows: options.maxWindows ?? 10,
      showWindows: options.showWindows ?? false,
      enableLogging: options.enableLogging ?? false
    }
    
    // Set up global cleanup handlers
    this.setupGlobalHandlers()
  }
  
  /**
   * Creates a managed window with automatic tracking and cleanup
   */
  public createWindow(options: WindowCreationOptions = {}): BrowserWindow {
    // Check window limit
    if (this.windows.size >= this.options.maxWindows) {
      throw new Error(`Maximum window limit (${this.options.maxWindows}) reached`)
    }
    
    // Generate unique ID if not provided
    const id = options.id || `window-${Date.now()}-${this.windowCounter++}`
    
    // Check for duplicate ID
    if (this.windows.has(id)) {
      throw new Error(`Window with id "${id}" already exists`)
    }
    
    // Prepare window options
    const windowOptions: BrowserWindowConstructorOptions = {
      show: this.options.showWindows,
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        ...options.webPreferences
      },
      ...options
    }
    
    // Remove custom properties before creating window
    delete (windowOptions as any).id
    delete (windowOptions as any).timeout
    delete (windowOptions as any).metadata
    
    // Create the window
    const window = new BrowserWindow(windowOptions)
    
    // Set up tracking
    const tracked: TrackedWindow = {
      id,
      window,
      createdAt: new Date(),
      listeners: new Map(),
      metadata: options.metadata
    }
    
    // Set up timeout if specified
    const timeout = options.timeout ?? this.options.defaultTimeout
    if (timeout > 0) {
      tracked.timeout = setTimeout(() => {
        this.log(`Window ${id} auto-destroyed after ${timeout}ms timeout`)
        this.destroyWindow(id)
      }, timeout)
    }
    
    // Track the window
    this.windows.set(id, tracked)
    
    // Set up event handlers
    this.setupWindowHandlers(tracked)
    
    // Record memory sample
    this.memoryMonitor.recordSample()
    
    // Emit event
    this.emit('window-created', { id, window })
    
    this.log(`Created window ${id}`)
    
    return window
  }
  
  /**
   * Gets a window by ID
   */
  public getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id)?.window
  }
  
  /**
   * Gets all active windows
   */
  public getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values())
      .map(tracked => tracked.window)
      .filter(window => !window.isDestroyed())
  }
  
  /**
   * Gets window count
   */
  public getWindowCount(): number {
    return this.windows.size
  }
  
  /**
   * Destroys a specific window
   */
  public destroyWindow(id: string): void {
    const tracked = this.windows.get(id)
    if (!tracked) {
      this.log(`Window ${id} not found for destruction`)
      return
    }
    
    // Clear timeout if exists
    if (tracked.timeout) {
      clearTimeout(tracked.timeout)
    }
    
    // Remove all listeners
    this.removeWindowListeners(tracked)
    
    // Destroy window if not already destroyed
    if (!tracked.window.isDestroyed()) {
      tracked.window.destroy()
    }
    
    // Remove from tracking
    this.windows.delete(id)
    
    // Record memory sample
    this.memoryMonitor.recordSample()
    
    // Emit event
    this.emit('window-destroyed', { id })
    
    this.log(`Destroyed window ${id}`)
  }
  
  /**
   * Destroys all windows
   */
  public async destroyAllWindows(): Promise<void> {
    if (this.isCleaningUp) {
      this.log('Already cleaning up, skipping duplicate call')
      return
    }
    
    this.isCleaningUp = true
    
    try {
      const windowIds = Array.from(this.windows.keys())
      
      this.log(`Destroying ${windowIds.length} windows`)
      
      // Destroy all windows
      for (const id of windowIds) {
        this.destroyWindow(id)
      }
      
      // Run additional cleanup handlers
      for (const handler of this.cleanupHandlers) {
        try {
          await handler()
        } catch (error) {
          console.error('Cleanup handler failed:', error)
        }
      }
      
      this.cleanupHandlers.clear()
      
      // Check for memory leaks
      if (this.memoryMonitor.detectLeak()) {
        console.warn('Potential memory leak detected during window cleanup')
      }
      
      this.emit('all-windows-destroyed')
      
    } finally {
      this.isCleaningUp = false
    }
  }
  
  /**
   * Registers a cleanup handler
   */
  public registerCleanupHandler(handler: () => void | Promise<void>): void {
    this.cleanupHandlers.add(handler)
  }
  
  /**
   * Unregisters a cleanup handler
   */
  public unregisterCleanupHandler(handler: () => void | Promise<void>): void {
    this.cleanupHandlers.delete(handler)
  }
  
  /**
   * Gets memory statistics
   */
  public getMemoryStats(): {
    averageUsage: number
    hasLeak: boolean
    windowCount: number
  } {
    return {
      averageUsage: this.memoryMonitor.getAverageUsage(),
      hasLeak: this.memoryMonitor.detectLeak(),
      windowCount: this.windows.size
    }
  }
  
  /**
   * Resets memory monitoring
   */
  public resetMemoryMonitor(): void {
    this.memoryMonitor.reset()
  }
  
  /**
   * Adds a tracked event listener to a window
   */
  public addWindowListener(
    id: string, 
    event: string, 
    listener: (...args: any[]) => void
  ): void {
    const tracked = this.windows.get(id)
    if (!tracked) {
      throw new Error(`Window ${id} not found`)
    }
    
    // Remove previous listener if exists
    if (tracked.listeners.has(event)) {
      const oldListener = tracked.listeners.get(event)!
      tracked.window.removeListener(event as any, oldListener as any)
    }
    
    // Add new listener
    tracked.window.on(event as any, listener as any)
    tracked.listeners.set(event, listener)
  }
  
  /**
   * Removes a tracked event listener from a window
   */
  public removeWindowListener(id: string, event: string): void {
    const tracked = this.windows.get(id)
    if (!tracked) return
    
    const listener = tracked.listeners.get(event)
    if (listener) {
      tracked.window.removeListener(event as any, listener as any)
      tracked.listeners.delete(event)
    }
  }
  
  /**
   * Sets up event handlers for a window
   */
  private setupWindowHandlers(tracked: TrackedWindow): void {
    const { window, id } = tracked
    
    // Handle close event
    const closeHandler = () => {
      this.log(`Window ${id} closed`)
      this.destroyWindow(id)
    }
    window.on('closed', closeHandler)
    tracked.listeners.set('closed', closeHandler)
    
    // Handle unresponsive
    const unresponsiveHandler = () => {
      console.warn(`Window ${id} became unresponsive`)
      this.emit('window-unresponsive', { id, window })
    }
    window.on('unresponsive', unresponsiveHandler)
    tracked.listeners.set('unresponsive', unresponsiveHandler)
    
    // Handle responsive
    const responsiveHandler = () => {
      this.log(`Window ${id} became responsive`)
      this.emit('window-responsive', { id, window })
    }
    window.on('responsive', responsiveHandler)
    tracked.listeners.set('responsive', responsiveHandler)
  }
  
  /**
   * Removes all event listeners from a window
   */
  private removeWindowListeners(tracked: TrackedWindow): void {
    for (const [event, listener] of tracked.listeners) {
      if (!tracked.window.isDestroyed()) {
        tracked.window.removeListener(event as any, listener as any)
      }
    }
    tracked.listeners.clear()
  }
  
  /**
   * Sets up global cleanup handlers
   */
  private setupGlobalHandlers(): void {
    // Handle app quit
    const quitHandler = async () => {
      this.log('App quitting, cleaning up windows')
      await this.destroyAllWindows()
    }
    app.on('before-quit', quitHandler)
    
    // Handle process exit
    const exitHandler = () => {
      this.log('Process exiting, forcing window cleanup')
      // Force synchronous cleanup
      for (const [id] of this.windows) {
        this.destroyWindow(id)
      }
    }
    process.on('exit', exitHandler)
    
    // Handle uncaught errors
    const errorHandler = (error: Error) => {
      console.error('Uncaught error, cleaning up windows:', error)
      this.destroyAllWindows().catch(console.error)
    }
    process.on('uncaughtException', errorHandler)
    process.on('unhandledRejection', errorHandler)
  }
  
  /**
   * Logs a message if logging is enabled
   */
  private log(message: string): void {
    if (this.options.enableLogging) {
      console.log(`[TestWindowManager] ${message}`)
    }
  }
}

/**
 * Global window manager instance for test suites
 */
export const globalWindowManager = new TestWindowManager({
  defaultTimeout: 60000, // 1 minute for tests
  maxWindows: 20,
  showWindows: false,
  enableLogging: process.env.DEBUG === 'true'
})

/**
 * Helper function to ensure all windows are closed
 */
export async function ensureAllWindowsClosed(): Promise<void> {
  const allWindows = BrowserWindow.getAllWindows()
  for (const window of allWindows) {
    if (!window.isDestroyed()) {
      window.destroy()
    }
  }
}

/**
 * Helper to create a window with automatic cleanup in tests
 */
export function createTestWindow(
  options: WindowCreationOptions = {}
): BrowserWindow {
  return globalWindowManager.createWindow(options)
}

/**
 * Helper to destroy all test windows
 */
export async function cleanupTestWindows(): Promise<void> {
  await globalWindowManager.destroyAllWindows()
}