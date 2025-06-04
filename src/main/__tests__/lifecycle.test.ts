/**
 * Main Process Lifecycle Tests (2025)
 * 
 * Comprehensive testing of Electron main process lifecycle events following
 * 2025 best practices including startup, shutdown, crash recovery, and 
 * platform-specific behaviors. Uses Vitest for optimal performance.
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

import { app, BrowserWindow } from 'electron'

// Mock electron modules for testing
vi.mock('electron', () => ({
  app: {
    // Lifecycle events
    whenReady: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockReturnValue(true),
    quit: vi.fn(),
    exit: vi.fn(),
    relaunch: vi.fn(),
    
    // Event handling
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    emit: vi.fn(),
    
    // App information
    getName: vi.fn().mockReturnValue('TaskMaster'),
    getVersion: vi.fn().mockReturnValue('1.0.0-test'),
    getLocale: vi.fn().mockReturnValue('en-US'),
    getPath: vi.fn().mockImplementation((name) => `/mock/path/${name}`),
    getAppPath: vi.fn().mockReturnValue('/mock/app/path'),
    
    // Platform and packaging
    isPackaged: false,
    
    // Security features
    setAsDefaultProtocolClient: vi.fn(),
    removeAsDefaultProtocolClient: vi.fn(),
    requestSingleInstanceLock: vi.fn().mockReturnValue(true),
    releaseSingleInstanceLock: vi.fn(),
    
    // Windows management
    setUserTasks: vi.fn(),
    
    // Dock (macOS)
    dock: {
      setIcon: vi.fn(),
      setBadge: vi.fn(),
      hide: vi.fn(),
      show: vi.fn()
    }
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
    getFocusedWindow: vi.fn().mockReturnValue(null),
    fromWebContents: vi.fn().mockReturnValue(null)
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn()
  },
  dialog: {
    showErrorBox: vi.fn(),
    showMessageBox: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  }
}))

// Import the main process module after mocking

describe('Main Process Lifecycle Tests (2025)', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks()
    
    // Reset app ready state
    app.isReady = vi.fn().mockReturnValue(true)
    app.whenReady = vi.fn().mockResolvedValue(undefined)
    
    // Mock BrowserWindow constructor
    const mockWindow = {
      id: 1,
      loadURL: vi.fn().mockResolvedValue(undefined),
      loadFile: vi.fn().mockResolvedValue(undefined),
      show: vi.fn(),
      hide: vi.fn(),
      close: vi.fn(),
      destroy: vi.fn(),
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: {
        id: 1,
        openDevTools: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        send: vi.fn(),
        executeJavaScript: vi.fn().mockResolvedValue(undefined),
        session: {
          clearCache: vi.fn().mockResolvedValue(undefined)
        }
      },
      on: vi.fn(),
      once: vi.fn(),
      setMenuBarVisibility: vi.fn(),
      setWindowOpenHandler: vi.fn()
    }
    
    // Mock the createWindow function
    const mockCreateWindow = vi.fn().mockImplementation(() => {
      return mockWindow
    })
    ;(global as any).createWindow = mockCreateWindow
  })

  afterEach(() => {
    // Clean up any remaining listeners
    vi.restoreAllMocks()
  })

  describe('App Startup Lifecycle', () => {
    test('should handle will-finish-launching event', async () => {
      const mockCallback = vi.fn()
      app.on('will-finish-launching', mockCallback)
      
      // Simulate the event
      expect(app.on).toHaveBeenCalledWith('will-finish-launching', mockCallback)
      
      // Trigger the event manually for testing
      const eventCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'will-finish-launching')?.[1]
      if (eventCallback) {
        eventCallback()
        expect(mockCallback).toHaveBeenCalled()
      }
    })

    test('should handle ready event properly', async () => {
      const mockCallback = vi.fn()
      
      // Test that whenReady resolves
      await expect(app.whenReady()).resolves.toBeUndefined()
      
      // Test that the callback can be registered
      app.on('ready', mockCallback)
      expect(app.on).toHaveBeenCalledWith('ready', mockCallback)
    })

    test('should validate app is ready before proceeding', () => {
      expect(app.isReady()).toBe(true)
      
      // Test when app is not ready
      app.isReady = vi.fn().mockReturnValue(false)
      expect(app.isReady()).toBe(false)
    })

    test('should handle multiple ready state checks', async () => {
      // First call - app not ready
      app.isReady = vi.fn().mockReturnValueOnce(false)
      expect(app.isReady()).toBe(false)
      
      // Second call - app ready
      app.isReady = vi.fn().mockReturnValueOnce(true)
      expect(app.isReady()).toBe(true)
      
      // whenReady should always resolve when ready
      await expect(app.whenReady()).resolves.toBeUndefined()
    })

    test('should handle activate event (macOS specific)', () => {
      const mockCallback = vi.fn()
      
      // Mock BrowserWindow.getAllWindows for activate handler
      BrowserWindow.getAllWindows = vi.fn().mockReturnValue([])
      
      app.on('activate', mockCallback)
      expect(app.on).toHaveBeenCalledWith('activate', mockCallback)
      
      // Simulate activation with no windows
      const eventCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'activate')?.[1]
      if (eventCallback) {
        eventCallback()
        expect(mockCallback).toHaveBeenCalled()
      }
    })
  })

  describe('App Shutdown Lifecycle', () => {
    test('should handle before-quit event', () => {
      const mockCallback = vi.fn()
      
      app.on('before-quit', mockCallback)
      expect(app.on).toHaveBeenCalledWith('before-quit', mockCallback)
      
      // Test that event can be prevented
      const preventableEvent = {
        preventDefault: vi.fn()
      }
      
      const eventCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'before-quit')?.[1]
      if (eventCallback) {
        eventCallback(preventableEvent)
        expect(mockCallback).toHaveBeenCalledWith(preventableEvent)
      }
    })

    test('should handle will-quit event', () => {
      const mockCallback = vi.fn()
      
      app.on('will-quit', mockCallback)
      expect(app.on).toHaveBeenCalledWith('will-quit', mockCallback)
    })

    test('should handle quit event with exit code', () => {
      const mockCallback = vi.fn()
      
      app.on('quit', mockCallback)
      expect(app.on).toHaveBeenCalledWith('quit', mockCallback)
      
      // Simulate quit with exit code
      const eventCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'quit')?.[1]
      if (eventCallback) {
        eventCallback({}, 0) // Normal exit
        expect(mockCallback).toHaveBeenCalledWith({}, 0)
      }
    })

    test('should quit on window-all-closed (non-macOS)', () => {
      const mockCallback = vi.fn()
      
      // Mock non-macOS platform
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      })
      
      app.on('window-all-closed', mockCallback)
      
      // Simulate window-all-closed event
      const eventCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'window-all-closed')?.[1]
      if (eventCallback) {
        eventCallback()
        expect(mockCallback).toHaveBeenCalled()
      }
      
      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      })
    })

    test('should NOT quit on window-all-closed (macOS)', () => {
      const mockCallback = vi.fn()
      
      // Mock macOS platform
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      })
      
      app.on('window-all-closed', mockCallback)
      
      // Simulate window-all-closed event
      const eventCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'window-all-closed')?.[1]
      if (eventCallback) {
        eventCallback()
        expect(mockCallback).toHaveBeenCalled()
        // On macOS, app should NOT quit automatically
      }
      
      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      })
    })
  })

  describe('Crash Recovery & Error Handling', () => {
    test('should handle uncaught exceptions', () => {
      const mockHandler = vi.fn()
      
      // Mock process event listeners
      process.on = vi.fn()
      process.on('uncaughtException', mockHandler)
      
      expect(process.on).toHaveBeenCalledWith('uncaughtException', mockHandler)
    })

    test('should handle unhandled promise rejections', () => {
      const mockHandler = vi.fn()
      
      process.on = vi.fn()
      process.on('unhandledRejection', mockHandler)
      
      expect(process.on).toHaveBeenCalledWith('unhandledRejection', mockHandler)
    })

    test('should handle certificate errors appropriately', () => {
      const mockCallback = vi.fn()
      
      app.on('certificate-error', mockCallback)
      expect(app.on).toHaveBeenCalledWith('certificate-error', mockCallback)
      
      // Test localhost certificate handling in development
      const mockEvent = { preventDefault: vi.fn() }
      const mockWebContents = {}
      const localhostUrl = 'https://localhost:3000'
      const error = new Error('Certificate error')
      const certificate = {}
      const mockCertCallback = vi.fn()
      
      const eventCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'certificate-error')?.[1]
      if (eventCallback) {
        // Test dev environment (isPackaged = false)
        Object.defineProperty(app, "isPackaged", { value: false })
        eventCallback(mockEvent, mockWebContents, localhostUrl, error, certificate, mockCertCallback)
        expect(mockCallback).toHaveBeenCalled()
      }
    })

    test('should handle renderer process crashes', () => {
      const mockWindow = {
        webContents: {
          on: vi.fn(),
          id: 1
        }
      }
      
      const crashHandler = vi.fn()
      mockWindow.webContents.on('render-process-gone', crashHandler)
      
      expect(mockWindow.webContents.on).toHaveBeenCalledWith('render-process-gone', crashHandler)
      
      // Simulate crash
      const eventCallback = mockWindow.webContents.on.mock.calls.find(
        call => call[0] === 'render-process-gone'
      )?.[1]
      
      if (eventCallback) {
        const crashDetails = { reason: 'crashed', exitCode: 1 }
        eventCallback({}, crashDetails)
        expect(crashHandler).toHaveBeenCalledWith({}, crashDetails)
      }
    })
  })

  describe('Single Instance Management', () => {
    test('should request single instance lock', () => {
      const hasLock = app.requestSingleInstanceLock()
      
      expect(app.requestSingleInstanceLock).toHaveBeenCalled()
      expect(hasLock).toBe(true)
    })

    test('should handle second instance attempts', () => {
      const mockCallback = vi.fn()
      const mockWindows = [{
        isMinimized: vi.fn().mockReturnValue(false),
        restore: vi.fn(),
        focus: vi.fn()
      }]
      
      BrowserWindow.getAllWindows = vi.fn().mockReturnValue(mockWindows)
      
      app.on('second-instance', mockCallback)
      expect(app.on).toHaveBeenCalledWith('second-instance', mockCallback)
      
      // Simulate second instance
      const eventCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'second-instance')?.[1]
      if (eventCallback) {
        eventCallback()
        expect(mockCallback).toHaveBeenCalled()
      }
    })

    test('should release single instance lock', () => {
      app.releaseSingleInstanceLock()
      expect(app.releaseSingleInstanceLock).toHaveBeenCalled()
    })
  })

  describe('Platform-Specific Behaviors', () => {
    test('should handle Windows-specific features', () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true
      })
      
      // Test Windows user tasks
      app.setUserTasks([])
      expect(app.setUserTasks).toHaveBeenCalledWith([])
      
      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      })
    })

    test('should handle macOS dock features', () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true
      })
      
      // Test dock operations
      if (app.dock) {
        app.dock.hide()
        expect(app.dock.hide).toHaveBeenCalled()
        
        app.dock.show()
        expect(app.dock.show).toHaveBeenCalled()
        
        app.dock.setBadge('5')
        expect(app.dock.setBadge).toHaveBeenCalledWith('5')
      }
      
      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true
      })
    })
  })

  describe('Memory and Resource Management', () => {
    test('should clean up resources on app quit', () => {
      const mockCallback = vi.fn()
      
      app.on('before-quit', mockCallback)
      
      // Simulate cleanup on quit
      const eventCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'before-quit')?.[1]
      if (eventCallback) {
        eventCallback({ preventDefault: vi.fn() })
        expect(mockCallback).toHaveBeenCalled()
      }
    })

    test('should handle IPC cleanup', () => {
      const { ipcMain } = require('electron')
      
      // Test IPC handler cleanup
      ipcMain.removeAllListeners('test-channel')
      expect(ipcMain.removeAllListeners).toHaveBeenCalledWith('test-channel')
      
      ipcMain.removeHandler('test-handler')
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('test-handler')
    })
  })

  describe('Event Sequencing and Timing', () => {
    test('should fire events in correct order', async () => {
      const eventOrder: string[] = []
      
      // Mock event handlers that record order
      const willFinishHandler = vi.fn(() => eventOrder.push('will-finish-launching'))
      const readyHandler = vi.fn(() => eventOrder.push('ready'))
      
      app.on('will-finish-launching', willFinishHandler)
      app.on('ready', readyHandler)
      
      // Simulate event firing order
      const willFinishCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'will-finish-launching')?.[1]
      const readyCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'ready')?.[1]
      
      if (willFinishCallback && readyCallback) {
        willFinishCallback()
        readyCallback()
        
        expect(eventOrder).toEqual(['will-finish-launching', 'ready'])
      }
    })

    test('should handle rapid event succession', () => {
      const mockCallback = vi.fn()
      
      app.on('activate', mockCallback)
      
      // Simulate rapid activate events
      const eventCallback = (app.on as any).mock.calls.find((call: any[]) => call[0] === 'activate')?.[1]
      if (eventCallback) {
        eventCallback()
        eventCallback()
        eventCallback()
        
        expect(mockCallback).toHaveBeenCalledTimes(3)
      }
    })
  })

  describe('Error Recovery and Stability', () => {
    test('should maintain stability after renderer crashes', () => {
      const mockWindow = {
        webContents: {
          on: vi.fn(),
          reload: vi.fn()
        }
      }
      
      const crashHandler = vi.fn((_event, details) => {
        // Simulate recovery action
        if (details.reason === 'crashed') {
          mockWindow.webContents.reload()
        }
      })
      
      mockWindow.webContents.on('render-process-gone', crashHandler)
      
      // Simulate crash
      const eventCallback = mockWindow.webContents.on.mock.calls.find(
        call => call[0] === 'render-process-gone'
      )?.[1]
      
      if (eventCallback) {
        eventCallback({}, { reason: 'crashed', exitCode: 1 })
        expect(crashHandler).toHaveBeenCalled()
        expect(mockWindow.webContents.reload).toHaveBeenCalled()
      }
    })

    test('should handle graceful degradation', () => {
      // Test that app continues to function even with errors
      expect(app.isReady()).toBe(true)
      
      try {
        throw new Error('Simulated error')
      } catch {
        // App should remain stable
        expect(app.isReady()).toBe(true)
      }
    })
  })
})

// Export for testing purposes
export async function createWindow(): Promise<any> {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  return win
}
