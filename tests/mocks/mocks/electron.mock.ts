/**
 * Comprehensive Electron API Mock (2025)
 * 
 * Centralized mock implementation for all Electron APIs used across
 * different test environments. This provides consistent mocking behavior
 * and can be extended or customized for specific test scenarios.
 */

import { vi } from 'vitest'

// Main process mocks
export const mockApp = {
  // App lifecycle
  quit: vi.fn(),
  exit: vi.fn(),
  relaunch: vi.fn(),
  isReady: vi.fn().mockReturnValue(true),
  whenReady: vi.fn().mockResolvedValue(undefined),
  
  // Event handling
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  
  // App information
  getPath: vi.fn((name: string) => `/mock/path/${name}`),
  setPath: vi.fn(),
  getVersion: vi.fn().mockReturnValue('1.0.0'),
  getName: vi.fn().mockReturnValue('TaskMaster'),
  setName: vi.fn(),
  getLocale: vi.fn().mockReturnValue('en-US'),
  getSystemLocale: vi.fn().mockReturnValue('en-US'),
  
  // Window management
  focus: vi.fn(),
  hide: vi.fn(),
  show: vi.fn(),
  
  // Single instance
  requestSingleInstanceLock: vi.fn().mockReturnValue(true),
  releaseSingleInstanceLock: vi.fn(),
  
  // Protocol handling
  setAsDefaultProtocolClient: vi.fn(),
  removeAsDefaultProtocolClient: vi.fn(),
  
  // macOS specific
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

export const mockWebContents = {
  id: 1,
  send: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  removeAllListeners: vi.fn(),
  
  // Navigation
  loadURL: vi.fn().mockResolvedValue(undefined),
  loadFile: vi.fn().mockResolvedValue(undefined),
  reload: vi.fn(),
  goBack: vi.fn(),
  goForward: vi.fn(),
  
  // Developer tools
  openDevTools: vi.fn(),
  closeDevTools: vi.fn(),
  isDevToolsOpened: vi.fn().mockReturnValue(false),
  
  // Zoom
  setZoomFactor: vi.fn(),
  getZoomFactor: vi.fn().mockReturnValue(1.0),
  setZoomLevel: vi.fn(),
  getZoomLevel: vi.fn().mockReturnValue(0),
  
  // JavaScript execution
  executeJavaScript: vi.fn().mockResolvedValue(undefined),
  insertCSS: vi.fn().mockResolvedValue(''),
  removeInsertedCSS: vi.fn(),
  
  // Session and storage
  session: {
    cookies: {
      get: vi.fn().mockResolvedValue([]),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined)
    },
    clearCache: vi.fn().mockResolvedValue(undefined),
    clearStorageData: vi.fn().mockResolvedValue(undefined),
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn()
  },
  
  // Print
  print: vi.fn().mockResolvedValue(undefined),
  printToPDF: vi.fn().mockResolvedValue(Buffer.from('mock-pdf'))
}

export const mockBrowserWindow = {
  // Static methods
  getAllWindows: vi.fn().mockReturnValue([]),
  getFocusedWindow: vi.fn().mockReturnValue(null),
  fromWebContents: vi.fn(),
  fromId: vi.fn(),
  
  // Instance methods
  loadURL: vi.fn().mockResolvedValue(undefined),
  loadFile: vi.fn().mockResolvedValue(undefined),
  
  // Window state
  show: vi.fn(),
  hide: vi.fn(),
  close: vi.fn(),
  destroy: vi.fn(),
  focus: vi.fn(),
  blur: vi.fn(),
  
  // Window properties
  isFocused: vi.fn().mockReturnValue(true),
  isDestroyed: vi.fn().mockReturnValue(false),
  isVisible: vi.fn().mockReturnValue(true),
  isMinimized: vi.fn().mockReturnValue(false),
  isMaximized: vi.fn().mockReturnValue(false),
  isFullScreen: vi.fn().mockReturnValue(false),
  
  // Window positioning
  center: vi.fn(),
  setPosition: vi.fn(),
  getPosition: vi.fn().mockReturnValue([100, 100]),
  setSize: vi.fn(),
  getSize: vi.fn().mockReturnValue([800, 600]),
  setBounds: vi.fn(),
  getBounds: vi.fn().mockReturnValue({ x: 100, y: 100, width: 800, height: 600 }),
  
  // Window properties
  setTitle: vi.fn(),
  getTitle: vi.fn().mockReturnValue('TaskMaster'),
  setMinimumSize: vi.fn(),
  setMaximumSize: vi.fn(),
  setResizable: vi.fn(),
  
  // Events
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  
  // Web contents
  webContents: mockWebContents
}

export const mockIpcMain = {
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  handle: vi.fn(),
  handleOnce: vi.fn(),
  removeHandler: vi.fn(),
  removeAllListeners: vi.fn()
}

export const mockIpcRenderer = {
  invoke: vi.fn(),
  send: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  sendSync: vi.fn(),
  postMessage: vi.fn(),
  sendTo: vi.fn(),
  sendToHost: vi.fn()
}

export const mockDialog = {
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

export const mockMenu = {
  buildFromTemplate: vi.fn().mockReturnValue({}),
  setApplicationMenu: vi.fn(),
  getApplicationMenu: vi.fn().mockReturnValue(null),
  popup: vi.fn(),
  closePopup: vi.fn()
}

export const mockMenuItem = {
  click: vi.fn(),
  enabled: true,
  visible: true,
  checked: false,
  label: 'Mock Menu Item',
  sublabel: '',
  toolTip: '',
  role: undefined,
  type: 'normal',
  submenu: undefined
}

export const mockShell = {
  openExternal: vi.fn().mockResolvedValue(undefined),
  openPath: vi.fn().mockResolvedValue(''),
  showItemInFolder: vi.fn(),
  moveItemToTrash: vi.fn().mockResolvedValue(true),
  beep: vi.fn(),
  writeShortcutLink: vi.fn().mockReturnValue(true),
  readShortcutLink: vi.fn().mockReturnValue({})
}

export const mockScreen = {
  getPrimaryDisplay: vi.fn().mockReturnValue({
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1.0,
    rotation: 0,
    internal: false
  }),
  getAllDisplays: vi.fn().mockReturnValue([]),
  getDisplayNearestPoint: vi.fn(),
  getDisplayMatching: vi.fn(),
  getCursorScreenPoint: vi.fn().mockReturnValue({ x: 0, y: 0 })
}

export const mockNativeTheme = {
  shouldUseDarkColors: false,
  themeSource: 'system' as const,
  shouldUseHighContrastColors: false,
  shouldUseInvertedColorScheme: false,
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  emit: vi.fn()
}

export const mockPowerMonitor = {
  getSystemIdleState: vi.fn().mockReturnValue('active'),
  getSystemIdleTime: vi.fn().mockReturnValue(0),
  getCurrentThermalState: vi.fn().mockReturnValue('nominal'),
  isOnBatteryPower: vi.fn().mockReturnValue(false),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  emit: vi.fn()
}

export const mockContextBridge = {
  exposeInMainWorld: vi.fn(),
  exposeInIsolatedWorld: vi.fn()
}

export const mockWebFrame = {
  setZoomFactor: vi.fn(),
  getZoomFactor: vi.fn().mockReturnValue(1.0),
  setZoomLevel: vi.fn(),
  getZoomLevel: vi.fn().mockReturnValue(0),
  setSpellCheckProvider: vi.fn(),
  insertCSS: vi.fn().mockReturnValue(''),
  removeInsertedCSS: vi.fn(),
  executeJavaScript: vi.fn().mockResolvedValue(undefined),
  getResourceUsage: vi.fn().mockReturnValue({
    images: { count: 0, size: 0, liveSize: 0 },
    scripts: { count: 0, size: 0, liveSize: 0 },
    cssStyleSheets: { count: 0, size: 0, liveSize: 0 },
    xslStyleSheets: { count: 0, size: 0, liveSize: 0 },
    fonts: { count: 0, size: 0, liveSize: 0 },
    other: { count: 0, size: 0, liveSize: 0 }
  }),
  clearCache: vi.fn()
}

export const mockNativeImage = {
  createEmpty: vi.fn(),
  createFromPath: vi.fn(),
  createFromBitmap: vi.fn(),
  createFromBuffer: vi.fn(),
  createFromDataURL: vi.fn(),
  createFromNamedImage: vi.fn()
}

export const mockCrashReporter = {
  start: vi.fn(),
  getLastCrashReport: vi.fn().mockReturnValue(null),
  getUploadedReports: vi.fn().mockReturnValue([]),
  addExtraParameter: vi.fn(),
  removeExtraParameter: vi.fn(),
  getParameters: vi.fn().mockReturnValue({})
}

export const mockClipboard = {
  readText: vi.fn().mockReturnValue(''),
  writeText: vi.fn(),
  readHTML: vi.fn().mockReturnValue(''),
  writeHTML: vi.fn(),
  readImage: vi.fn(),
  writeImage: vi.fn(),
  readRTF: vi.fn().mockReturnValue(''),
  writeRTF: vi.fn(),
  readBookmark: vi.fn().mockReturnValue({ title: '', url: '' }),
  writeBookmark: vi.fn(),
  readFindText: vi.fn().mockReturnValue(''),
  writeFindText: vi.fn(),
  clear: vi.fn(),
  availableFormats: vi.fn().mockReturnValue([]),
  has: vi.fn().mockReturnValue(false),
  read: vi.fn().mockReturnValue(''),
  write: vi.fn()
}

// Complete Electron mock object
export const mockElectron = {
  app: mockApp,
  BrowserWindow: vi.fn().mockImplementation(() => mockBrowserWindow),
  webContents: mockWebContents,
  ipcMain: mockIpcMain,
  ipcRenderer: mockIpcRenderer,
  dialog: mockDialog,
  Menu: mockMenu,
  MenuItem: vi.fn().mockImplementation(() => mockMenuItem),
  shell: mockShell,
  screen: mockScreen,
  nativeTheme: mockNativeTheme,
  powerMonitor: mockPowerMonitor,
  contextBridge: mockContextBridge,
  webFrame: mockWebFrame,
  nativeImage: mockNativeImage,
  crashReporter: mockCrashReporter,
  clipboard: mockClipboard
}

// Factory function for creating fresh mock instances
export const createElectronMock = () => {
  // Create new mock instances to avoid state pollution between tests
  return {
    ...mockElectron,
    app: { ...mockApp },
    BrowserWindow: vi.fn().mockImplementation(() => ({ ...mockBrowserWindow })),
    ipcMain: { ...mockIpcMain },
    ipcRenderer: { ...mockIpcRenderer },
    dialog: { ...mockDialog },
    shell: { ...mockShell }
  }
}

// Utility functions for test scenarios
export const resetAllElectronMocks = () => {
  Object.values(mockElectron).forEach(mock => {
    if (mock && typeof mock === 'object') {
      Object.values(mock).forEach(method => {
        if (vi.isMockFunction(method)) {
          method.mockReset()
        }
      })
    }
  })
}

export const setupElectronMockDefaults = () => {
  // Reset to default implementations
  mockApp.isReady.mockReturnValue(true)
  mockApp.whenReady.mockResolvedValue(undefined)
  mockBrowserWindow.isDestroyed.mockReturnValue(false)
  mockBrowserWindow.isVisible.mockReturnValue(true)
  mockDialog.showOpenDialog.mockResolvedValue({ 
    canceled: false, 
    filePaths: ['/mock/selected/file.json'] 
  })
}