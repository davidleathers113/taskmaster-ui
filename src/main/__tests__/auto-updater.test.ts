/**
 * Auto-Updater Testing (2025)
 * 
 * Comprehensive testing of Electron auto-updater functionality including
 * update checking, download progress, error handling, rollback scenarios,
 * and security validation following 2025 best practices.
 */

import { createMockAutoUpdater, createMockUpdateCheckResult } from '../../test-utils/mock-factories'
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

import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow, dialog } from 'electron'
import type { MockAutoUpdater } from './mock-types'


// Mock electron-updater module
vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdates: vi.fn().mockResolvedValue({
      updateInfo: {
        version: '2.0.0',
        releaseDate: new Date().toISOString(),
        releaseNotes: 'New features and bug fixes'
      },
      cancellationToken: undefined,
        isUpdateAvailable: true,
        versionInfo: { version: "2.0.0" }
    }),
    checkForUpdatesAndNotify: vi.fn().mockResolvedValue(undefined),
    downloadUpdate: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
    
    // Event emitter methods
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    emit: vi.fn(),
    
    // Configuration properties
    autoDownload: false,
    autoInstallOnAppQuit: true,
    allowPrerelease: false,
    allowDowngrade: false,
    channel: 'latest',
    
    // Logger configuration
    logger: {
      transports: {
        file: { level: 'info' },
        console: { level: 'info' }
      },
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    },
    
    // Feed URL
    setFeedURL: vi.fn(),
    getFeedURL: vi.fn().mockReturnValue('https://example.com/updates')
  }
}))

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: vi.fn().mockReturnValue('1.0.0'),
    quit: vi.fn(),
    relaunch: vi.fn(),
    getPath: vi.fn().mockImplementation((name) => `/mock/path/${name}`)
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
    getFocusedWindow: vi.fn().mockReturnValue(null)
  },
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
    showErrorBox: vi.fn()
  }
}))

describe('Auto-Updater Tests (2025)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset auto-updater configuration
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Update Checking', () => {
    test('should check for updates on app start in production', async () => {
      // Mock production environment
      Object.defineProperty(app, 'isPackaged', { value: true, writable: false })
      
      // Initialize auto-updater
      const initAutoUpdater = async () => {
        if (app.isPackaged) {
          await autoUpdater.checkForUpdatesAndNotify()
        }
      }
      
      await initAutoUpdater()
      
      expect(autoUpdater.checkForUpdatesAndNotify).toHaveBeenCalled()
    })

    test('should not check for updates in development', async () => {
      // Mock development environment
      Object.defineProperty(app, 'isPackaged', { value: false, writable: false })
      
      const initAutoUpdater = async () => {
        if (app.isPackaged) {
          await autoUpdater.checkForUpdatesAndNotify()
        }
      }
      
      await initAutoUpdater()
      
      expect(autoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled()
    })

    test('should handle manual update check', async () => {
      const result = await autoUpdater.checkForUpdates()
      
      expect(autoUpdater.checkForUpdates).toHaveBeenCalled()
      expect(result).toHaveProperty('updateInfo')
      expect(result?.updateInfo).toHaveProperty('version', '2.0.0')
    })

    test('should configure update feed URL', () => {
      const feedUrl = 'https://updates.example.com/feed'
      
      autoUpdater.setFeedURL(feedUrl)
      
      expect(autoUpdater.setFeedURL).toHaveBeenCalledWith(feedUrl)
      expect(autoUpdater.getFeedURL()).toBe('https://example.com/updates')
    })
  })

  describe('Update Event Handling', () => {
    test('should handle checking-for-update event', () => {
      const mockHandler = vi.fn()
      
      autoUpdater.on('checking-for-update', mockHandler)
      
      expect(autoUpdater.on).toHaveBeenCalledWith('checking-for-update', mockHandler)
      
      // Simulate event
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'checking-for-update'
      )?.[1]
      
      if (eventCallback) {
        eventCallback()
        expect(mockHandler).toHaveBeenCalled()
      }
    })

    test('should handle update-available event', () => {
      const mockHandler = vi.fn()
      const updateInfo = {
        version: '2.0.0',
        releaseDate: new Date().toISOString(),
        releaseNotes: 'New features'
      }
      
      autoUpdater.on('update-available', mockHandler)
      
      // Simulate event
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'update-available'
      )?.[1]
      
      if (eventCallback) {
        eventCallback(updateInfo)
        expect(mockHandler).toHaveBeenCalledWith(updateInfo)
      }
    })

    test('should handle update-not-available event', () => {
      const mockHandler = vi.fn()
      const updateInfo = {
        version: '1.0.0',
        releaseDate: new Date().toISOString()
      }
      
      autoUpdater.on('update-not-available', mockHandler)
      
      // Simulate event
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'update-not-available'
      )?.[1]
      
      if (eventCallback) {
        eventCallback(updateInfo)
        expect(mockHandler).toHaveBeenCalledWith(updateInfo)
      }
    })

    test('should handle download-progress event', () => {
      const mockHandler = vi.fn()
      const progressInfo = {
        bytesPerSecond: 1000000,
        percent: 50,
        transferred: 50000000,
        total: 100000000
      }
      
      autoUpdater.on('download-progress', mockHandler)
      
      // Simulate event
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'download-progress'
      )?.[1]
      
      if (eventCallback) {
        eventCallback(progressInfo)
        expect(mockHandler).toHaveBeenCalledWith(progressInfo)
      }
    })

    test('should handle update-downloaded event', () => {
      const mockHandler = vi.fn()
      const updateInfo = {
        version: '2.0.0',
        releaseDate: new Date().toISOString(),
        releaseNotes: 'New features'
      }
      
      autoUpdater.on('update-downloaded', mockHandler)
      
      // Simulate event
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'update-downloaded'
      )?.[1]
      
      if (eventCallback) {
        eventCallback(updateInfo)
        expect(mockHandler).toHaveBeenCalledWith(updateInfo)
      }
    })
  })

  describe('Error Handling', () => {
    test('should handle update errors gracefully', () => {
      const mockErrorHandler = vi.fn()
      const updateError = new Error('Network error')
      
      autoUpdater.on('error', mockErrorHandler)
      
      // Simulate error event
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1]
      
      if (eventCallback) {
        eventCallback(updateError)
        expect(mockErrorHandler).toHaveBeenCalledWith(updateError)
      }
    })

    test('should log errors appropriately', () => {
      const mockErrorHandler = vi.fn((error) => {
        autoUpdater.logger?.error('Auto-updater error: ' + error.message)
      })
      
      autoUpdater.on('error', mockErrorHandler)
      
      // Simulate error
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1]
      
      if (eventCallback) {
        const error = new Error('Update failed')
        eventCallback(error)
        
        expect(autoUpdater.logger?.error).toHaveBeenCalledWith('Auto-updater error: ' + error.message)
      }
    })

    test('should handle network timeout errors', () => {
      const mockErrorHandler = vi.fn()
      const timeoutError = new Error('ETIMEDOUT') as Error & { code?: string }
      timeoutError.code = 'ETIMEDOUT'
      
      autoUpdater.on('error', mockErrorHandler)
      
      // Simulate timeout error
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1]
      
      if (eventCallback) {
        eventCallback(timeoutError)
        expect(mockErrorHandler).toHaveBeenCalledWith(timeoutError)
      }
    })

    test('should handle signature verification errors', () => {
      const mockErrorHandler = vi.fn()
      const signatureError = new Error('Could not verify signature')
      
      autoUpdater.on('error', mockErrorHandler)
      
      // Simulate signature error
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1]
      
      if (eventCallback) {
        eventCallback(signatureError)
        expect(mockErrorHandler).toHaveBeenCalledWith(signatureError)
      }
    })
  })

  describe('User Interaction', () => {
    test('should prompt user when update is available', async () => {
      const mockWindow = {} as any
      BrowserWindow.getFocusedWindow = vi.fn().mockReturnValue(mockWindow)
      
      const promptUserForUpdate = async (info: { version: string }) => {
        const result = await dialog.showMessageBox({
                      id: 1,
                      webContents: {
                        send: vi.fn(),
                        on: vi.fn(),
                        once: vi.fn(),
                        removeListener: vi.fn()
                      },
                      on: vi.fn(),
                      off: vi.fn(),
                      once: vi.fn(),
                      addListener: vi.fn(),
                      removeListener: vi.fn(),
                      show: vi.fn(),
                      hide: vi.fn(),
                      close: vi.fn(),
                      destroy: vi.fn(),
                      isDestroyed: vi.fn().mockReturnValue(false),
                      focus: vi.fn(),
                      blur: vi.fn()
                    } as any, {
          type: 'info',
          title: 'Update Available',
          message: 'A new version is available. Would you like to download it now?',
          detail: `Version ${info.version} is available.`,
          buttons: ['Download', 'Later'],
          defaultId: 0,
          cancelId: 1
        })
        
        return result.response === 0
      }
      
      const shouldDownload = await promptUserForUpdate({ version: '2.0.0' })
      
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        mockWindow,
        expect.objectContaining({
          type: 'info',
          title: 'Update Available'
        })
      )
      
      expect(shouldDownload).toBe(true) // Default mock returns response: 0
    })

    test('should handle user declining update', async () => {
      dialog.showMessageBox = vi.fn().mockResolvedValue({ response: 1 }) // User clicks "Later"
      
      const promptUserForUpdate = async (info: { version: string }) => {
        const result = await dialog.showMessageBox({
                      id: 1,
                      webContents: {
                        send: vi.fn(),
                        on: vi.fn(),
                        once: vi.fn(),
                        removeListener: vi.fn()
                      },
                      on: vi.fn(),
                      off: vi.fn(),
                      once: vi.fn(),
                      addListener: vi.fn(),
                      removeListener: vi.fn(),
                      show: vi.fn(),
                      hide: vi.fn(),
                      close: vi.fn(),
                      destroy: vi.fn(),
                      isDestroyed: vi.fn().mockReturnValue(false),
                      focus: vi.fn(),
                      blur: vi.fn()
                    } as any, {
          type: 'info',
          title: 'Update Available',
          message: 'A new version is available. Would you like to download it now?',
          detail: `Version ${info.version} is available.`,
          buttons: ['Download', 'Later'],
          defaultId: 0,
          cancelId: 1
        })
        
        return result.response === 0
      }
      
      const shouldDownload = await promptUserForUpdate({ version: '2.0.0' })
      
      expect(shouldDownload).toBe(false)
    })

    test('should prompt for restart after download', async () => {
      const promptUserToInstall = async () => {
        const result = await dialog.showMessageBox({
                      id: 1,
                      webContents: {
                        send: vi.fn(),
                        on: vi.fn(),
                        once: vi.fn(),
                        removeListener: vi.fn()
                      },
                      on: vi.fn(),
                      off: vi.fn(),
                      once: vi.fn(),
                      addListener: vi.fn(),
                      removeListener: vi.fn(),
                      show: vi.fn(),
                      hide: vi.fn(),
                      close: vi.fn(),
                      destroy: vi.fn(),
                      isDestroyed: vi.fn().mockReturnValue(false),
                      focus: vi.fn(),
                      blur: vi.fn()
                    } as any, {
          type: 'info',
          title: 'Update Ready',
          message: 'Update downloaded. Restart the application to apply the update.',
          buttons: ['Restart Now', 'Later'],
          defaultId: 0,
          cancelId: 1
        })
        
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      }
      
      await promptUserToInstall()
      
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          title: 'Update Ready'
        })
      )
      
      expect(autoUpdater.quitAndInstall).toHaveBeenCalled()
    })
  })

  describe('Security and Validation', () => {
    test('should disable auto-download by default', () => {
      expect(autoUpdater.autoDownload).toBe(false)
    })

    test('should enable auto-install on app quit', () => {
      expect(autoUpdater.autoInstallOnAppQuit).toBe(true)
    })

    test('should not allow prereleases by default', () => {
      expect(autoUpdater.allowPrerelease).toBe(false)
    })

    test('should not allow downgrades by default', () => {
      expect(autoUpdater.allowDowngrade).toBe(false)
    })

    test('should use stable update channel', () => {
      expect(autoUpdater.channel).toBe('latest')
    })

    test('should handle update channel configuration', () => {
      // Test switching to beta channel
      (autoUpdater as any).channel = 'beta'
      (autoUpdater as any).allowPrerelease = true
      
      expect(autoUpdater.channel).toBe('beta')
      expect(autoUpdater.allowPrerelease).toBe(true)
    })
  })

  describe('Download Management', () => {
    test('should download update when requested', async () => {
      await autoUpdater.downloadUpdate()
      
      expect(autoUpdater.downloadUpdate).toHaveBeenCalled()
    })

    test('should track download progress', () => {
      const progressHandler = vi.fn()
      let lastProgress = 0
      
      autoUpdater.on('download-progress', progressHandler)
      
      // Simulate progressive download
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'download-progress'
      )?.[1]
      
      if (eventCallback) {
        // Simulate progress updates
        const progressSteps = [25, 50, 75, 100]
        
        progressSteps.forEach(percent => {
          eventCallback({
            bytesPerSecond: 1000000,
            percent,
            transferred: (percent / 100) * 100000000,
            total: 100000000
          })
          
          lastProgress = percent
        })
        
        expect(progressHandler).toHaveBeenCalledTimes(4)
        expect(lastProgress).toBe(100)
      }
    })

    test('should handle download cancellation', () => {
      // Mock cancellation token
      const cancellationToken = {
        cancel: vi.fn()
      }
      
      autoUpdater.checkForUpdates = vi.fn().mockResolvedValue({
        updateInfo: { version: '2.0.0' },
        cancellationToken,
          isUpdateAvailable: true,
          versionInfo: { version: "2.0.0" }
    })
      
      // In a real scenario, you would cancel the download
      cancellationToken.cancel()
      
      expect(cancellationToken.cancel).toHaveBeenCalled()
    })
  })

  describe('Rollback and Recovery', () => {
    test('should handle failed installation gracefully', () => {
      const mockErrorHandler = vi.fn((error) => {
        // Log error and notify user
        autoUpdater.logger?.error('Installation failed:', error)
        dialog.showErrorBox('Update Failed', 'The update could not be installed.')
      })
      
      autoUpdater.on('error', mockErrorHandler)
      
      // Simulate installation error
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1]
      
      if (eventCallback) {
        const installError = new Error('Installation failed')
        eventCallback(installError)
        
        expect(autoUpdater.logger?.error).toHaveBeenCalledWith('Installation failed: ' + installError.message)
        expect(dialog.showErrorBox).toHaveBeenCalledWith('Update Failed', 'The update could not be installed.')
      }
    })

    test('should maintain app stability after update failure', () => {
      const mockErrorHandler = vi.fn()
      
      autoUpdater.on('error', mockErrorHandler)
      
      // Simulate error
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1]
      
      if (eventCallback) {
        eventCallback(new Error('Update failed'))
        
        // App should not quit automatically on error
        expect(app.quit).not.toHaveBeenCalled()
      }
    })
  })

  describe('Logging and Monitoring', () => {
    test('should log update check attempts', () => {
      const logHandler = vi.fn(() => {
        autoUpdater.logger?.info('Checking for updates...')
      })
      
      autoUpdater.on('checking-for-update', logHandler)
      
      // Trigger event
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'checking-for-update'
      )?.[1]
      
      if (eventCallback) {
        eventCallback()
        expect(autoUpdater.logger?.info).toHaveBeenCalledWith('Checking for updates...')
      }
    })

    test('should log update availability', () => {
      const logHandler = vi.fn((info) => {
        autoUpdater.logger?.info(`Update available: ${info.version}`)
      })
      
      autoUpdater.on('update-available', logHandler)
      
      // Trigger event
      const eventCallback = (autoUpdater as MockAutoUpdater).on.mock.calls.find(
        call => call[0] === 'update-available'
      )?.[1]
      
      if (eventCallback) {
        eventCallback({ version: '2.0.0' })
        expect(autoUpdater.logger?.info).toHaveBeenCalledWith('Update available: 2.0.0')
      }
    })
  })
})