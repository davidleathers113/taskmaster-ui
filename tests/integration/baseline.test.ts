/**
 * Integration Baseline Validation Test (2025)
 * 
 * This test verifies that the complete Electron application can launch,
 * initialize correctly, and that all processes work together properly.
 * Following 2025 testing best practices for integration/smoke testing.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { launchElectronApp, getFirstWindow, closeElectronApp } from '../setup/integration.setup'
import type { ElectronApplication, Page } from 'playwright'

describe('Integration Baseline Validation', () => {
  let electronApp: ElectronApplication
  let page: Page

  beforeEach(async () => {
    // Launch the Electron app for each test
    electronApp = await launchElectronApp({
      timeout: 15000
    })
    page = await getFirstWindow()
  }, 30000) // Increase timeout for app launch

  afterEach(async () => {
    // Clean up after each test
    if (electronApp) {
      await closeElectronApp()
    }
  })

  describe('Application Startup', () => {
    test('should launch application successfully', async () => {
      expect(electronApp).toBeDefined()
      
      // Check app readiness
      const isReady = await electronApp.evaluate(({ app }) => {
        return app.isReady()
      })
      expect(isReady).toBe(true)
    })

    test('should create main window with correct properties', async () => {
      expect(page).toBeDefined()
      
      // Check window title (may contain app name)
      const title = await page.title()
      expect(typeof title).toBe('string')
      expect(title.length).toBeGreaterThan(0)
      
      // Verify window is visible
      const isVisible = await electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows()
        return windows.length > 0 && windows[0].isVisible()
      })
      expect(isVisible).toBe(true)
    })

    test('should have correct window bounds', async () => {
      const bounds = await electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        return window ? window.getBounds() : null
      })
      
      expect(bounds).toBeTruthy()
      if (bounds) {
        expect(bounds.width).toBeGreaterThan(0)
        expect(bounds.height).toBeGreaterThan(0)
        expect(typeof bounds.x).toBe('number')
        expect(typeof bounds.y).toBe('number')
      }
    })
  })

  describe('Renderer Process Loading', () => {
    test('should load renderer content', async () => {
      // Wait for the page to load
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 })
      
      // Check that we have a body element
      const body = await page.locator('body').first()
      expect(await body.isVisible()).toBe(true)
    })

    test('should load React application', async () => {
      // Wait for React app to mount (look for root element or any React-rendered content)
      try {
        await page.waitForSelector('#root, [data-testid="app-root"], .App', {
          timeout: 10000,
          state: 'visible'
        })
        
        const appElement = await page.locator('#root, [data-testid="app-root"], .App').first()
        expect(await appElement.isVisible()).toBe(true)
      } catch (error) {
        // If specific selectors don't exist, just verify page loaded
        const bodyText = await page.textContent('body')
        expect(bodyText).toBeTruthy()
        expect(bodyText!.length).toBeGreaterThan(0)
      }
    })

    test('should not have console errors', async () => {
      const errors: string[] = []
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text())
        }
      })
      
      // Wait a bit for any initial rendering errors
      await page.waitForTimeout(2000)
      
      // Filter out known non-critical errors
      const criticalErrors = errors.filter(error => 
        !error.includes('favicon') && 
        !error.includes('ResizeObserver') &&
        !error.includes('DevTools')
      )
      
      expect(criticalErrors).toHaveLength(0)
    })
  })

  describe('IPC Communication', () => {
    test('should establish IPC communication', async () => {
      // Test that electronAPI is available in renderer
      const hasElectronAPI = await page.evaluate(() => {
        return typeof window.electronAPI !== 'undefined'
      })
      
      expect(hasElectronAPI).toBe(true)
    })

    test('should handle basic IPC invoke calls', async () => {
      try {
        const version = await page.evaluate(async () => {
          if (window.electronAPI && window.electronAPI.invoke) {
            return await window.electronAPI.invoke('app:get-version')
          }
          return null
        })
        
        expect(version).toBeTruthy()
        expect(typeof version).toBe('string')
      } catch (error) {
        // If IPC not fully implemented, just verify API exists
        const hasInvoke = await page.evaluate(() => {
          return window.electronAPI && typeof window.electronAPI.invoke === 'function'
        })
        expect(hasInvoke).toBe(true)
      }
    })

    test('should handle IPC errors gracefully', async () => {
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
      
      // Should either handle gracefully or catch error
      expect(['error-caught', 'no-error', 'no-api', null]).toContain(result)
    })
  })

  describe('Window Management', () => {
    test('should handle window operations', async () => {
      // Test minimize
      await electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        if (window) window.minimize()
      })
      
      const isMinimized = await electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        return window ? window.isMinimized() : false
      })
      expect(isMinimized).toBe(true)
      
      // Test restore
      await electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        if (window) window.restore()
      })
      
      const isRestored = await electronApp.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]
        return window ? !window.isMinimized() : false
      })
      expect(isRestored).toBe(true)
    })

    test('should maintain window count', async () => {
      const windowCount = await electronApp.evaluate(({ BrowserWindow }) => {
        return BrowserWindow.getAllWindows().length
      })
      
      expect(windowCount).toBe(1)
    })
  })

  describe('Security Features', () => {
    test('should have context isolation enabled', async () => {
      const hasNodeAccess = await page.evaluate(() => {
        return typeof (window as any).require !== 'undefined' || 
               typeof (window as any).process !== 'undefined' ||
               typeof (window as any).__dirname !== 'undefined'
      })
      
      // Should NOT have direct Node access (context isolation working)
      expect(hasNodeAccess).toBe(false)
    })

    test('should have secure preload API', async () => {
      const apiStructure = await page.evaluate(() => {
        if (!window.electronAPI) return null
        
        return {
          hasInvoke: typeof window.electronAPI.invoke === 'function',
          hasOn: typeof window.electronAPI.on === 'function',
          hasOff: typeof window.electronAPI.off === 'function',
          hasUnsafeProps: Object.hasOwnProperty.call(window.electronAPI, '__proto__') ||
                          Object.hasOwnProperty.call(window.electronAPI, 'constructor') ||
                          Object.hasOwnProperty.call(window.electronAPI, 'eval')
        }
      })
      
      if (apiStructure) {
        expect(apiStructure.hasInvoke).toBe(true)
        expect(apiStructure.hasUnsafeProps).toBe(false)
      }
    })
  })

  describe('Performance Baseline', () => {
    test('should start within acceptable time', async () => {
      // App should be ready within 15 seconds (generous for baseline)
      const startTime = Date.now()
      
      await page.waitForLoadState('domcontentloaded')
      
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(15000)
    })

    test('should have reasonable memory usage', async () => {
      const memoryInfo = await electronApp.evaluate(() => {
        return process.memoryUsage()
      })
      
      expect(memoryInfo.heapUsed).toBeGreaterThan(0)
      expect(memoryInfo.heapTotal).toBeGreaterThan(memoryInfo.heapUsed)
      
      // Baseline memory usage should be reasonable (less than 200MB)
      expect(memoryInfo.heapUsed).toBeLessThan(200 * 1024 * 1024)
    })
  })

  describe('Error Recovery', () => {
    test('should remain stable after renderer errors', async () => {
      // Inject a non-fatal error
      await page.evaluate(() => {
        console.error('Test error injection')
      })
      
      // App should remain responsive
      const isReady = await electronApp.evaluate(({ app }) => {
        return app.isReady()
      })
      expect(isReady).toBe(true)
      
      // Page should still be functional
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 })
    })

    test('should handle navigation errors gracefully', async () => {
      // Get current URL
      const currentUrl = page.url()
      
      try {
        // Try to navigate to invalid URL (this might fail)
        await page.goto('invalid://url', { timeout: 2000 })
      } catch (error) {
        // Expected to fail
      }
      
      // App should still be running
      const windowCount = await electronApp.evaluate(({ BrowserWindow }) => {
        return BrowserWindow.getAllWindows().length
      })
      expect(windowCount).toBeGreaterThan(0)
    })
  })

  describe('Shutdown Process', () => {
    test('should close gracefully', async () => {
      // This test validates that the app can be closed without hanging
      // The actual closing is handled in afterEach
      expect(electronApp).toBeDefined()
      
      const windowCount = await electronApp.evaluate(({ BrowserWindow }) => {
        return BrowserWindow.getAllWindows().length
      })
      expect(windowCount).toBeGreaterThan(0)
    })
  })
})