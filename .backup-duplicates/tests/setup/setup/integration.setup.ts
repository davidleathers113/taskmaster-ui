/**
 * Integration Test Setup (2025)
 * 
 * This setup file configures the testing environment for Electron integration tests.
 * It provides utilities for testing the interaction between main, renderer, and preload
 * processes, including real IPC communication and app lifecycle testing.
 * 
 * Research-based implementation following 2025 best practices for:
 * - Full Electron application integration testing
 * - Real IPC communication testing patterns
 * - App lifecycle and window management testing
 * - Performance monitoring during integration tests
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { type ElectronApplication, type Page, _electron as electron } from 'playwright'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'

// Integration test configuration (2025 best practices - extended timeouts for CI)
const TEST_TIMEOUT = 60000 // 60 seconds for integration tests (increased for CI)
const APP_STARTUP_TIMEOUT = 45000 // 45 seconds for app startup (Electron can be slow)
const IPC_RESPONSE_TIMEOUT = 10000 // 10 seconds for IPC responses

interface IntegrationTestContext {
  electronApp?: ElectronApplication
  page?: Page
  serverProcess?: ChildProcess
  appPath: string
  isAppReady: boolean
  testStartTime: number
}

const integrationContext: IntegrationTestContext = {
  appPath: join(__dirname, '../../dist/main/index.js'),
  isAppReady: false,
  testStartTime: 0
}

// Utility functions for integration testing
export const launchElectronApp = async (options: {
  args?: string[]
  executablePath?: string
  timeout?: number
} = {}): Promise<ElectronApplication> => {
  const {
    args = [],
    executablePath,
    timeout = APP_STARTUP_TIMEOUT
  } = options

  console.log('Launching Electron app for integration test...')
  
  // Ensure app is built before launching
  const appExists = require('fs').existsSync(integrationContext.appPath)
  if (!appExists) {
    console.warn(`App not found at ${integrationContext.appPath}, building first...`)
    throw new Error(`Electron app not found at ${integrationContext.appPath}. Run 'npm run build' first.`)
  }
  
  const launchOptions: any = {
    args: [integrationContext.appPath, ...args],
    timeout
  }

  if (executablePath) {
    launchOptions.executablePath = executablePath
  }

  try {
    const electronApp = await electron.launch(launchOptions)
    
    // Wait for app to be ready
    await electronApp.evaluate(async ({ app }) => {
      await app.whenReady()
    })
    
    integrationContext.electronApp = electronApp
    integrationContext.isAppReady = true
    
    console.log('Electron app launched successfully')
    return electronApp
  } catch (error) {
    console.error('Failed to launch Electron app:', error)
    throw error
  }
}

export const getFirstWindow = async (): Promise<Page> => {
  if (!integrationContext.electronApp) {
    throw new Error('Electron app not launched. Call launchElectronApp() first.')
  }

  const page = await integrationContext.electronApp.firstWindow()
  integrationContext.page = page
  
  // Wait for page to be fully loaded
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 })
  
  // Set up error handling for the page
  page.on('pageerror', (error) => {
    console.error('Page error during integration test:', error)
  })
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('Console error:', msg.text())
    }
  })
  
  return page
}

export const closeElectronApp = async (): Promise<void> => {
  if (integrationContext.electronApp) {
    console.log('Closing Electron app...')
    
    try {
      // Close all windows first
      const windows = integrationContext.electronApp.windows()
      await Promise.all(windows.map(window => window.close().catch(() => {})))
      
      // Close the app
      await integrationContext.electronApp.close()
      
      console.log('Electron app closed successfully')
    } catch (error) {
      console.error('Error closing Electron app:', error)
    } finally {
      integrationContext.electronApp = undefined
      integrationContext.page = undefined
      integrationContext.isAppReady = false
    }
  }
}

export const startFileWatcherServer = async (): Promise<ChildProcess> => {
  return new Promise((resolve, reject) => {
    console.log('Starting file watcher server...')
    
    const serverPath = join(__dirname, '../../server/file-watcher.js')
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '3001'
      }
    })
    
    let serverStarted = false
    
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      console.log('Server stdout:', output)
      
      if (output.includes('Server listening') && !serverStarted) {
        serverStarted = true
        integrationContext.serverProcess = serverProcess
        resolve(serverProcess)
      }
    })
    
    serverProcess.stderr?.on('data', (data) => {
      console.error('Server stderr:', data.toString())
    })
    
    serverProcess.on('error', (error) => {
      console.error('Server process error:', error)
      reject(error)
    })
    
    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`)
    })
    
    // Timeout for server startup
    setTimeout(() => {
      if (!serverStarted) {
        serverProcess.kill()
        reject(new Error('File watcher server failed to start within timeout'))
      }
    }, 10000)
  })
}

export const stopFileWatcherServer = async (): Promise<void> => {
  if (integrationContext.serverProcess) {
    console.log('Stopping file watcher server...')
    
    return new Promise((resolve) => {
      const server = integrationContext.serverProcess!
      
      server.on('exit', () => {
        console.log('File watcher server stopped')
        integrationContext.serverProcess = undefined
        resolve()
      })
      
      // Try graceful shutdown first
      server.kill('SIGTERM')
      
      // Force kill after timeout
      setTimeout(() => {
        if (!server.killed) {
          server.kill('SIGKILL')
        }
      }, 5000)
    })
  }
}

export const waitForIPC = async (
  electronApp: ElectronApplication,
  channel: string,
  timeout: number = IPC_RESPONSE_TIMEOUT
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`IPC response for ${channel} not received within ${timeout}ms`))
    }, timeout)
    
    // Set up IPC listener in main process
    electronApp.evaluate(({ ipcMain }, { channel }) => {
      return new Promise((resolve) => {
        ipcMain.once(channel, (event, ...args) => {
          resolve(args)
        })
      })
    }, { channel }).then((result) => {
      clearTimeout(timer)
      resolve(result)
    }).catch((error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

export const sendIPCToRenderer = async (
  electronApp: ElectronApplication,
  channel: string,
  ...args: any[]
): Promise<void> => {
  await electronApp.evaluate(({ BrowserWindow }, { channel, args }) => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      windows[0].webContents.send(channel, ...args)
    }
  }, { channel, args })
}

export const invokeIPCFromRenderer = async (
  page: Page,
  channel: string,
  ...args: any[]
): Promise<any> => {
  return await page.evaluate(({ channel, args }) => {
    if (window.electronAPI && window.electronAPI.invoke) {
      return window.electronAPI.invoke(channel, ...args)
    }
    throw new Error('electronAPI not available')
  }, { channel, args })
}

export const simulateFileChange = async (filePath: string, content: string): Promise<void> => {
  const fs = await import('fs/promises')
  await fs.writeFile(filePath, content, 'utf-8')
  
  // Give the file watcher time to detect the change
  await new Promise(resolve => setTimeout(resolve, 1000))
}

export const measurePerformance = async (
  electronApp: ElectronApplication
): Promise<{
  memory: NodeJS.MemoryUsage
  cpu: number
  windowCount: number
}> => {
  const memory = await electronApp.evaluate(async () => {
    return process.memoryUsage()
  })
  
  const windowCount = await electronApp.evaluate(({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows().length
  })
  
  // Simple CPU measurement (not perfectly accurate but useful for testing)
  const cpuUsageStart = process.cpuUsage()
  await new Promise(resolve => setTimeout(resolve, 100))
  const cpuUsageEnd = process.cpuUsage(cpuUsageStart)
  const cpu = (cpuUsageEnd.user + cpuUsageEnd.system) / 100000 // Convert to percentage
  
  return { memory, cpu, windowCount }
}

export const waitForElementWithTimeout = async (
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<void> => {
  try {
    await page.waitForSelector(selector, { timeout })
  } catch (error) {
    throw new Error(`Element ${selector} not found within ${timeout}ms`)
  }
}

export const takeScreenshot = async (
  page: Page,
  name: string
): Promise<Buffer> => {
  const screenshot = await page.screenshot({
    path: join(__dirname, `../screenshots/${name}.png`),
    fullPage: true
  })
  
  return screenshot
}

// Memory leak detection for integration tests
let memoryBaseline: NodeJS.MemoryUsage

// Global integration test setup
beforeAll(async () => {
  console.log('Setting up integration test environment...')
  
  // Create screenshots directory
  const fs = await import('fs/promises')
  const screenshotsDir = join(__dirname, '../screenshots')
  try {
    await fs.mkdir(screenshotsDir, { recursive: true })
  } catch (error) {
    // Directory might already exist
  }
  
  // Record initial memory usage
  memoryBaseline = process.memoryUsage()
}, 60000)

beforeEach(() => {
  integrationContext.testStartTime = Date.now()
  
  // Set longer timeout for integration tests
  vi.setConfig({ testTimeout: TEST_TIMEOUT })
})

afterEach(async () => {
  const testDuration = Date.now() - integrationContext.testStartTime
  
  // Log slow tests
  if (testDuration > TEST_TIMEOUT * 0.8) {
    console.warn(`Slow integration test: ${testDuration}ms`)
  }
  
  // Clean up any remaining app instances
  await closeElectronApp()
  
  // Clean up server if running
  await stopFileWatcherServer()
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc()
  }
})

afterAll(async () => {
  console.log('Cleaning up integration test environment...')
  
  // Final cleanup
  await closeElectronApp()
  await stopFileWatcherServer()
  
  // Check for memory leaks
  const finalMemory = process.memoryUsage()
  const memoryGrowth = finalMemory.heapUsed - memoryBaseline.heapUsed
  
  if (memoryGrowth > 50 * 1024 * 1024) { // 50MB threshold
    console.warn(`Potential memory leak in integration tests: ${Math.round(memoryGrowth / 1024 / 1024)}MB growth`)
  }
  
  console.log('Integration test cleanup complete')
}, 30000)

// Error handling for integration tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in integration test:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in integration test:', error)
})

// Export the integration context for advanced test scenarios
export { integrationContext }

// Type declarations
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>
      on: (channel: string, callback: Function) => () => void
      off: (channel: string, callback?: Function) => void
      send: (channel: string, ...args: any[]) => void
    }
  }
}