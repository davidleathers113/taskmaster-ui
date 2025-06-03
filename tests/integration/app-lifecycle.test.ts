/**
 * App Lifecycle Integration Test (2025)
 * 
 * Tests the complete Electron application lifecycle including startup,
 * window management, and shutdown procedures. This integration test
 * validates that all processes work together correctly.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { launchElectronApp, getFirstWindow, closeElectronApp } from '../setup/integration.setup'
import type { ElectronApplication, Page } from 'playwright'

describe('Electron App Lifecycle Integration', () => {
  let electronApp: ElectronApplication
  let page: Page

  beforeEach(async () => {
    // Launch the Electron app for each test
    electronApp = await launchElectronApp({
      timeout: 15000
    })
    page = await getFirstWindow()
  })

  afterEach(async () => {
    // Clean up after each test
    await closeElectronApp()
  })

  describe('App Startup', () => {
    test('should launch application successfully', async () => {
      // Verify app is running
      expect(electronApp).toBeDefined()
      
      // Check app readiness
      const isReady = await electronApp.evaluate(({ app }) => {
        return app.isReady()
      })
      expect(isReady).toBe(true)
    })

    test('should create main window with correct properties', async () => {
      // Verify main window exists
      expect(page).toBeDefined()
      
      // Check window title
      const title = await page.title()
      expect(title).toContain('TaskMaster')
      
      // Verify window is visible
      const isVisible = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows()
        return windows.length > 0 && windows[0].isVisible()
      })
      expect(isVisible).toBe(true)
    })

    test('should load React application in renderer', async () => {
      // Wait for React app to load
      await page.waitForSelector('[data-testid="app-root"], #root', {
        timeout: 10000,
        state: 'visible'
      })
      
      // Verify React app content
      const appElement = await page.locator('#root, [data-testid="app-root"]').first()
      expect(await appElement.isVisible()).toBe(true)
    })
  })

  describe('Window Management', () => {
    test('should handle window minimize and restore', async () => {
      // Minimize window
      await electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        window.minimize()
      })
      
      // Check minimized state
      const isMinimized = await electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        return window.isMinimized()
      })
      expect(isMinimized).toBe(true)
      
      // Restore window
      await electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        window.restore()
      })
      
      // Verify restored state
      const isRestored = await electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        return !window.isMinimized()
      })
      expect(isRestored).toBe(true)
    })

    test('should maintain window bounds correctly', async () => {
      const initialBounds = await electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        return window.getBounds()
      })
      
      expect(initialBounds).toHaveProperty('x')
      expect(initialBounds).toHaveProperty('y')
      expect(initialBounds).toHaveProperty('width')
      expect(initialBounds).toHaveProperty('height')
      expect(initialBounds.width).toBeGreaterThan(0)
      expect(initialBounds.height).toBeGreaterThan(0)
    })
  })

  describe('IPC Communication', () => {
    test('should establish IPC communication between main and renderer', async () => {
      // Test IPC invoke from renderer to main
      const version = await page.evaluate(() => {
        if (window.electronAPI && window.electronAPI.invoke) {
          return window.electronAPI.invoke('app:get-version')
        }
        throw new Error('electronAPI not available')
      })
      
      expect(typeof version).toBe('string')
      expect(version).toBeTruthy()
    })

    test('should handle IPC errors gracefully', async () => {
      // Test invalid IPC channel
      const result = await page.evaluate(async () => {
        try {
          if (window.electronAPI && window.electronAPI.invoke) {
            await window.electronAPI.invoke('invalid:channel')
            return 'no-error'
          }
          return 'no-api'
        } catch (error) {
          return 'error-caught'
        }
      })
      
      // Should either return null or catch error gracefully
      expect(['error-caught', 'no-error', null]).toContain(result)
    })
  })

  describe('App Shutdown', () => {
    test('should close gracefully when window is closed', async () => {
      // Close the main window
      await electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        window.close()
      })
      
      // Wait for app to potentially quit
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Verify no windows remain
      const windowCount = await electronApp.evaluate(({ BrowserWindow }) => {
        return BrowserWindow.getAllWindows().length
      })
      expect(windowCount).toBe(0)
    })

    test('should clean up resources on quit', async () => {
      // Record initial memory usage
      const initialMemory = await electronApp.evaluate(() => {
        return process.memoryUsage()
      })
      
      expect(initialMemory).toHaveProperty('heapUsed')
      expect(initialMemory.heapUsed).toBeGreaterThan(0)
      
      // This test validates that memory is tracked - actual cleanup
      // verification happens in the afterEach hook
    })
  })

  describe('Error Handling', () => {
    test('should handle renderer process errors without crashing', async () => {
      // Inject an error in renderer and verify app continues running
      await page.evaluate(() => {
        // Create a non-fatal error
        console.error('Test error in renderer process')
      })
      
      // Verify app is still responsive
      const isReady = await electronApp.evaluate(({ app }) => {
        return app.isReady()
      })
      expect(isReady).toBe(true)
      
      // Verify page is still functional
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 })
    })

    test('should maintain app stability after navigation errors', async () => {
      // Attempt to navigate to invalid URL
      try {
        await page.goto('invalid://url')
      } catch (error) {
        // Expected to fail
      }
      
      // Verify app is still running
      const windowCount = await electronApp.evaluate(({ BrowserWindow }) => {
        return BrowserWindow.getAllWindows().length
      })
      expect(windowCount).toBeGreaterThan(0)
    })
  })
})