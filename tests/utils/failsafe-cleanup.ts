/**
 * Failsafe Cleanup Utilities for Electron Testing (2025)
 * 
 * Implements multiple layers of cleanup protection to ensure no test windows
 * or resources are left behind, even in case of crashes or unexpected exits.
 * Following 2025 best practices for robust test cleanup.
 */

import { BrowserWindow, app } from 'electron'
import { EventEmitter } from 'events'

interface CleanupHandler {
  name: string
  priority: number
  handler: () => void | Promise<void>
  runOnce: boolean
  hasRun?: boolean
}

interface CleanupOptions {
  enableLogging?: boolean
  gracefulShutdownTimeout?: number
  forceCleanupOnError?: boolean
}

/**
 * Failsafe Cleanup Manager
 * 
 * Provides multiple layers of cleanup protection:
 * - Process exit handlers
 * - Signal handlers (SIGINT, SIGTERM)
 * - Uncaught exception handlers
 * - Electron app event handlers
 * - Timeout-based forced cleanup
 */
export class FailsafeCleanupManager extends EventEmitter {
  private handlers: Map<string, CleanupHandler> = new Map()
  private isCleaningUp: boolean = false
  private cleanupPromise: Promise<void> | null = null
  private options: Required<CleanupOptions>
  private setupComplete: boolean = false
  
  constructor(options: CleanupOptions = {}) {
    super()
    
    this.options = {
      enableLogging: options.enableLogging ?? false,
      gracefulShutdownTimeout: options.gracefulShutdownTimeout ?? 5000,
      forceCleanupOnError: options.forceCleanupOnError ?? true
    }
    
    // Automatically setup handlers on construction
    this.setupHandlers()
  }
  
  /**
   * Registers a cleanup handler
   */
  public registerHandler(
    name: string,
    handler: () => void | Promise<void>,
    options: { priority?: number; runOnce?: boolean } = {}
  ): void {
    const { priority = 100, runOnce = false } = options
    
    this.handlers.set(name, {
      name,
      priority,
      handler,
      runOnce,
      hasRun: false
    })
    
    this.log(`Registered cleanup handler: ${name} (priority: ${priority})`)
  }
  
  /**
   * Unregisters a cleanup handler
   */
  public unregisterHandler(name: string): void {
    this.handlers.delete(name)
    this.log(`Unregistered cleanup handler: ${name}`)
  }
  
  /**
   * Runs all cleanup handlers
   */
  public async runCleanup(reason: string = 'manual'): Promise<void> {
    if (this.isCleaningUp) {
      this.log('Cleanup already in progress, waiting...')
      return this.cleanupPromise!
    }
    
    this.isCleaningUp = true
    this.emit('cleanup-start', reason)
    
    this.cleanupPromise = this.performCleanup(reason)
      .finally(() => {
        this.isCleaningUp = false
        this.cleanupPromise = null
      })
    
    return this.cleanupPromise
  }
  
  /**
   * Performs the actual cleanup
   */
  private async performCleanup(reason: string): Promise<void> {
    this.log(`Starting cleanup (reason: ${reason})`)
    
    // Sort handlers by priority (lower number = higher priority)
    const sortedHandlers = Array.from(this.handlers.values())
      .sort((a, b) => a.priority - b.priority)
    
    const errors: Error[] = []
    
    // Run each handler
    for (const handler of sortedHandlers) {
      if (handler.runOnce && handler.hasRun) {
        this.log(`Skipping handler ${handler.name} (already run)`)
        continue
      }
      
      try {
        this.log(`Running cleanup handler: ${handler.name}`)
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Cleanup timeout')), this.options.gracefulShutdownTimeout)
        })
        
        await Promise.race([
          handler.handler(),
          timeoutPromise
        ])
        
        handler.hasRun = true
        this.log(`Completed cleanup handler: ${handler.name}`)
        
      } catch (error) {
        const errorMessage = `Cleanup handler ${handler.name} failed: ${error}`
        this.log(errorMessage, 'error')
        errors.push(new Error(errorMessage))
        
        if (this.options.forceCleanupOnError) {
          // Continue with other handlers
          continue
        } else {
          // Stop on first error
          break
        }
      }
    }
    
    // Force cleanup of any remaining windows
    await this.forceWindowCleanup()
    
    this.emit('cleanup-complete', reason, errors)
    
    if (errors.length > 0) {
      console.error(`Cleanup completed with ${errors.length} errors`)
    } else {
      this.log('Cleanup completed successfully')
    }
  }
  
  /**
   * Forces cleanup of all Electron windows
   */
  private async forceWindowCleanup(): Promise<void> {
    try {
      const windows = BrowserWindow.getAllWindows()
      this.log(`Force cleaning ${windows.length} windows`)
      
      for (const window of windows) {
        try {
          if (!window.isDestroyed()) {
            window.destroy()
          }
        } catch (error) {
          this.log(`Failed to destroy window: ${error}`, 'error')
        }
      }
    } catch (error) {
      this.log(`Force window cleanup failed: ${error}`, 'error')
    }
  }
  
  /**
   * Sets up all failsafe handlers
   */
  private setupHandlers(): void {
    if (this.setupComplete) return
    
    // Process exit handler
    process.on('exit', (code) => {
      this.log(`Process exiting with code ${code}`)
      // Synchronous cleanup only
      this.performSyncCleanup()
    })
    
    // SIGINT handler (Ctrl+C)
    process.on('SIGINT', async () => {
      this.log('Received SIGINT')
      await this.runCleanup('SIGINT')
      process.exit(0)
    })
    
    // SIGTERM handler
    process.on('SIGTERM', async () => {
      this.log('Received SIGTERM')
      await this.runCleanup('SIGTERM')
      process.exit(0)
    })
    
    // Uncaught exception handler
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error)
      await this.runCleanup('uncaughtException')
      process.exit(1)
    })
    
    // Unhandled rejection handler
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason)
      await this.runCleanup('unhandledRejection')
      process.exit(1)
    })
    
    // Electron app events
    if (app) {
      app.on('before-quit', async (event) => {
        event.preventDefault()
        this.log('App before-quit event')
        await this.runCleanup('before-quit')
        app.quit()
      })
      
      app.on('window-all-closed', () => {
        this.log('All windows closed')
        if (process.platform !== 'darwin') {
          app.quit()
        }
      })
    }
    
    // Windows-specific cleanup
    if (process.platform === 'win32') {
      process.on('message', async (msg) => {
        if (msg === 'graceful-exit') {
          await this.runCleanup('graceful-exit')
          process.exit(0)
        }
      })
    }
    
    this.setupComplete = true
    this.log('Failsafe handlers setup complete')
  }
  
  /**
   * Performs synchronous cleanup (for exit handler)
   */
  private performSyncCleanup(): void {
    try {
      // Force destroy all windows synchronously
      const windows = BrowserWindow.getAllWindows()
      for (const window of windows) {
        if (!window.isDestroyed()) {
          window.destroy()
        }
      }
      
      // Run sync handlers only
      for (const handler of this.handlers.values()) {
        if (handler.runOnce && handler.hasRun) continue
        
        try {
          const result = handler.handler()
          if (result instanceof Promise) {
            // Can't wait for promises in sync context
            this.log(`Warning: Async handler ${handler.name} skipped in sync cleanup`)
          }
        } catch (_error) {
          // Ignore errors in sync cleanup
        }
      }
    } catch (_error) {
      // Ignore all errors in sync cleanup
    }
  }
  
  /**
   * Logs a message if logging is enabled
   */
  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (!this.options.enableLogging) return
    
    const timestamp = new Date().toISOString()
    const prefix = `[FailsafeCleanup ${timestamp}]`
    
    if (level === 'error') {
      console.error(`${prefix} ${message}`)
    } else {
      console.log(`${prefix} ${message}`)
    }
  }
}

/**
 * Global failsafe cleanup instance
 */
export const globalCleanup = new FailsafeCleanupManager({
  enableLogging: process.env.DEBUG === 'true',
  gracefulShutdownTimeout: 5000,
  forceCleanupOnError: true
})

/**
 * Registers default cleanup handlers
 */
export function registerDefaultCleanupHandlers(): void {
  // Window cleanup
  globalCleanup.registerHandler('window-cleanup', async () => {
    const windows = BrowserWindow.getAllWindows()
    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.destroy()
      }
    }
  }, { priority: 10 })
  
  // IPC cleanup
  globalCleanup.registerHandler('ipc-cleanup', () => {
    const { ipcMain } = require('electron')
    ipcMain.removeAllListeners()
  }, { priority: 20 })
  
  // Clear intervals and timeouts
  globalCleanup.registerHandler('timer-cleanup', () => {
    // Clear any active timers
    const maxTimerId = setTimeout(() => {}, 0)
    for (let i = 0; i < maxTimerId; i++) {
      clearTimeout(i)
      clearInterval(i)
    }
  }, { priority: 30 })
  
  // Memory cleanup
  globalCleanup.registerHandler('memory-cleanup', () => {
    if (global.gc) {
      global.gc()
    }
  }, { priority: 100 })
}

/**
 * Test helper to ensure cleanup happens
 */
export async function withFailsafeCleanup<T>(
  testFn: () => T | Promise<T>
): Promise<T> {
  try {
    return await testFn()
  } finally {
    await globalCleanup.runCleanup('test-complete')
  }
}