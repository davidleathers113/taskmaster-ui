/**
 * Main Process Test Setup (2025)
 * 
 * This setup file configures the testing environment for Electron's main process.
 * It mocks Electron APIs and provides a controlled environment for testing
 * main process functionality including app lifecycle, window management, and IPC.
 * 
 * Research-based implementation following 2025 best practices for:
 * - Electron main process testing patterns
 * - Modern Node.js mocking strategies
 * - Memory leak detection integration
 * - Security validation for main process
 */

import { vi, beforeEach, afterEach, afterAll } from 'vitest'
import { 
  createElectronMock, 
  resetElectronMocks, 
  createMockBrowserWindow,
  mockScenarios 
} from '../mocks/electron'
import { TestWindowManager, ensureAllWindowsClosed } from '../utils/window-manager'
import { globalCleanup, registerDefaultCleanupHandlers } from '../utils/failsafe-cleanup'

// Register default cleanup handlers
registerDefaultCleanupHandlers()

// Initialize test window manager
const windowManager = new TestWindowManager({
  defaultTimeout: 30000, // 30 seconds for test windows
  maxWindows: 10,
  showWindows: false,
  enableLogging: process.env.DEBUG === 'true'
})

// Register window manager cleanup with failsafe
globalCleanup.registerHandler('test-window-manager', async () => {
  await windowManager.destroyAllWindows()
}, { priority: 5, runOnce: false })

// Create Electron mock instance
const electronMock = createElectronMock()

// Mock the entire Electron module
vi.mock('electron', () => electronMock)

// Mock Node.js modules commonly used in main process
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue('{}'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ isDirectory: () => true, isFile: () => false }),
    readdir: vi.fn().mockResolvedValue([])
  },
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn()
}))

vi.mock('path', async () => {
  const actual = await vi.importActual('path')
  return {
    ...actual,
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((...args) => '/' + args.join('/'))
  }
})

vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/mock/home'),
  platform: vi.fn().mockReturnValue('darwin'),
  arch: vi.fn().mockReturnValue('x64'),
  tmpdir: vi.fn().mockReturnValue('/mock/tmp'),
  userInfo: vi.fn().mockReturnValue({ username: 'testuser' })
}))

// Mock electron-log for testing
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    transports: {
      file: { level: 'info' },
      console: { level: 'debug' }
    }
  }
}))

// Mock auto-updater
vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdatesAndNotify: vi.fn().mockResolvedValue(null),
    checkForUpdates: vi.fn().mockResolvedValue(null),
    downloadUpdate: vi.fn().mockResolvedValue([]),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    setFeedURL: vi.fn(),
    getFeedURL: vi.fn().mockReturnValue('')
  }
}))

// Memory leak detection setup for main process tests
let memoryUsageBefore: NodeJS.MemoryUsage

// Global test setup and teardown
beforeEach(() => {
  // Reset all mocks before each test
  resetElectronMocks(electronMock)
  
  // Record memory usage for leak detection
  memoryUsageBefore = process.memoryUsage()
  
  // Clear window manager
  windowManager.destroyAllWindows()
})

afterEach(async () => {
  // Clean up all test windows
  await windowManager.destroyAllWindows()
  
  // Ensure all Electron windows are closed
  await ensureAllWindowsClosed()
  
  // Check for potential memory leaks
  const memoryUsageAfter = process.memoryUsage()
  const heapGrowth = memoryUsageAfter.heapUsed - memoryUsageBefore.heapUsed
  
  // Log significant memory growth (threshold: 10MB)
  if (heapGrowth > 10 * 1024 * 1024) {
    console.warn(`Potential memory leak detected: ${Math.round(heapGrowth / 1024 / 1024)}MB heap growth`)
  }
  
  // Check window manager memory stats
  const memoryStats = windowManager.getMemoryStats()
  if (memoryStats.hasLeak) {
    console.warn('Window manager detected potential memory leak', memoryStats)
  }
  
  // Reset all mocks
  vi.clearAllMocks()
})

// Global cleanup after all tests
afterAll(async () => {
  // Final window cleanup
  await windowManager.destroyAllWindows()
  await ensureAllWindowsClosed()
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc()
  }
})

// Expose utilities for tests
declare global {
  var electronMock: typeof electronMock
  var testWindowManager: TestWindowManager
}

global.electronMock = electronMock
global.testWindowManager = windowManager

// Export for use in tests
export { electronMock, windowManager, mockScenarios }