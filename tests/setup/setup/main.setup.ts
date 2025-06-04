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

// Mock Electron modules for main process testing
const mockApp = {
  quit: vi.fn(),
  exit: vi.fn(),
  relaunch: vi.fn(),
  isReady: vi.fn().mockReturnValue(true),
  whenReady: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  getPath: vi.fn((name: string) => `/mock/path/${name}`),
  setPath: vi.fn(),
  getVersion: vi.fn().mockReturnValue('1.0.0'),
  getName: vi.fn().mockReturnValue('TaskMaster'),
  setName: vi.fn(),
  getLocale: vi.fn().mockReturnValue('en-US'),
  getSystemLocale: vi.fn().mockReturnValue('en-US'),
  focus: vi.fn(),
  hide: vi.fn(),
  show: vi.fn(),
  requestSingleInstanceLock: vi.fn().mockReturnValue(true),
  releaseSingleInstanceLock: vi.fn(),
  setAsDefaultProtocolClient: vi.fn(),
  removeAsDefaultProtocolClient: vi.fn(),
  dock: {
    hide: vi.fn(),
    show: vi.fn(),
    setIcon: vi.fn(),
    setBadge: vi.fn(),
    getBadge: vi.fn().mockReturnValue(''),
    bounce: vi.fn().mockReturnValue(1),
    cancelBounce: vi.fn()
  }
}

const mockBrowserWindow = {
  getAllWindows: vi.fn().mockReturnValue([]),
  getFocusedWindow: vi.fn().mockReturnValue(null),
  fromWebContents: vi.fn(),
  fromId: vi.fn(),
  loadURL: vi.fn().mockResolvedValue(undefined),
  loadFile: vi.fn().mockResolvedValue(undefined),
  show: vi.fn(),
  hide: vi.fn(),
  close: vi.fn(),
  destroy: vi.fn(),
  focus: vi.fn(),
  blur: vi.fn(),
  isFocused: vi.fn().mockReturnValue(true),
  isDestroyed: vi.fn().mockReturnValue(false),
  isVisible: vi.fn().mockReturnValue(true),
  isMinimized: vi.fn().mockReturnValue(false),
  isMaximized: vi.fn().mockReturnValue(false),
  isFullScreen: vi.fn().mockReturnValue(false),
  center: vi.fn(),
  setPosition: vi.fn(),
  getPosition: vi.fn().mockReturnValue([100, 100]),
  setSize: vi.fn(),
  getSize: vi.fn().mockReturnValue([800, 600]),
  setBounds: vi.fn(),
  getBounds: vi.fn().mockReturnValue({ x: 100, y: 100, width: 800, height: 600 }),
  setTitle: vi.fn(),
  getTitle: vi.fn().mockReturnValue('TaskMaster'),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  webContents: {
    id: 1,
    send: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn(),
    isDevToolsOpened: vi.fn().mockReturnValue(false),
    setZoomFactor: vi.fn(),
    getZoomFactor: vi.fn().mockReturnValue(1.0),
    setZoomLevel: vi.fn(),
    getZoomLevel: vi.fn().mockReturnValue(0),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    insertCSS: vi.fn().mockResolvedValue(''),
    removeInsertedCSS: vi.fn(),
    session: {
      cookies: {
        get: vi.fn().mockResolvedValue([]),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined)
      },
      clearCache: vi.fn().mockResolvedValue(undefined),
      clearStorageData: vi.fn().mockResolvedValue(undefined)
    }
  }
}

const mockIpcMain = {
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  handle: vi.fn(),
  handleOnce: vi.fn(),
  removeHandler: vi.fn(),
  removeAllListeners: vi.fn()
}

const mockDialog = {
  showOpenDialog: vi.fn().mockResolvedValue({ 
    canceled: false, 
    filePaths: ['/mock/selected/file.json'] 
  }),
  showSaveDialog: vi.fn().mockResolvedValue({ 
    canceled: false, 
    filePath: '/mock/save/file.json' 
  }),
  showMessageBox: vi.fn().mockResolvedValue({ 
    response: 0, 
    checkboxChecked: false 
  }),
  showErrorBox: vi.fn(),
  showCertificateTrustDialog: vi.fn().mockResolvedValue(undefined)
}

const mockMenu = {
  buildFromTemplate: vi.fn().mockReturnValue({}),
  setApplicationMenu: vi.fn(),
  getApplicationMenu: vi.fn().mockReturnValue(null),
  popup: vi.fn(),
  closePopup: vi.fn()
}

const mockShell = {
  openExternal: vi.fn().mockResolvedValue(undefined),
  openPath: vi.fn().mockResolvedValue(''),
  showItemInFolder: vi.fn(),
  moveItemToTrash: vi.fn().mockResolvedValue(true),
  beep: vi.fn(),
  writeShortcutLink: vi.fn().mockReturnValue(true),
  readShortcutLink: vi.fn().mockReturnValue({})
}

// Mock the entire Electron module
vi.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: vi.fn().mockImplementation(() => mockBrowserWindow),
  ipcMain: mockIpcMain,
  dialog: mockDialog,
  Menu: mockMenu,
  shell: mockShell,
  screen: {
    getPrimaryDisplay: vi.fn().mockReturnValue({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1.0
    }),
    getAllDisplays: vi.fn().mockReturnValue([])
  },
  nativeTheme: {
    shouldUseDarkColors: false,
    themeSource: 'system',
    on: vi.fn(),
    off: vi.fn()
  },
  powerMonitor: {
    getSystemIdleState: vi.fn().mockReturnValue('active'),
    getSystemIdleTime: vi.fn().mockReturnValue(0),
    on: vi.fn(),
    off: vi.fn()
  }
}))

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
  // Clear all mocks before each test
  vi.clearAllMocks()
  
  // Record memory usage for leak detection
  memoryUsageBefore = process.memoryUsage()
  
  // Reset mock implementations to default state
  mockApp.isReady.mockReturnValue(true)
  mockApp.whenReady.mockResolvedValue(undefined)
  mockBrowserWindow.isDestroyed.mockReturnValue(false)
  mockBrowserWindow.isVisible.mockReturnValue(true)
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
  
  // Clean up any remaining listeners or timers
  vi.resetAllMocks()
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
  interface Global {
    mockElectron: {
      app: typeof mockApp
      BrowserWindow: typeof mockBrowserWindow
      ipcMain: typeof mockIpcMain
      dialog: typeof mockDialog
      Menu: typeof mockMenu
      shell: typeof mockShell
    }
    testWindowManager: TestWindowManager
  }
}

global.mockElectron = {
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  dialog: mockDialog,
  Menu: mockMenu,
  shell: mockShell
}

global.testWindowManager = windowManager