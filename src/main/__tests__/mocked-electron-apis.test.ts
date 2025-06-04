/**
 * Mocked Electron APIs Tests (2025)
 * 
 * Comprehensive testing of Electron API mocking strategies following 2025 best practices.
 * Uses Vitest for superior performance and ES module support.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'

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

import { app, BrowserWindow, dialog, shell, clipboard, nativeImage, Menu, Tray, globalShortcut, screen, powerMonitor, systemPreferences } from 'electron'
import { } from 'url'

// Create comprehensive Electron mocks
vi.mock('electron', () => ({
  app: {
    // Lifecycle methods
    on: vi.fn(),
    once: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn(),
    exit: vi.fn(),
    relaunch: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
    
    // Path methods
    getPath: vi.fn().mockImplementation((name) => {
      const paths = {
        'home': '/Users/testuser',
        'appData': '/Users/testuser/Library/Application Support',
        'userData': '/Users/testuser/Library/Application Support/TaskMaster',
        'temp': '/tmp',
        'desktop': '/Users/testuser/Desktop',
        'documents': '/Users/testuser/Documents',
        'downloads': '/Users/testuser/Downloads',
        'music': '/Users/testuser/Music',
        'pictures': '/Users/testuser/Pictures',
        'videos': '/Users/testuser/Videos',
        'logs': '/Users/testuser/Library/Logs/TaskMaster',
        'pepperFlashSystemPlugin': '/Library/Internet Plug-Ins/PepperFlashPlayer'
      }
      return paths[name] || `/mock/path/${name}`
    }),
    getAppPath: vi.fn().mockReturnValue('/Users/testuser/taskmaster-ui'),
    setPath: vi.fn(),
    
    // App info
    getName: vi.fn().mockReturnValue('TaskMaster'),
    setName: vi.fn(),
    getVersion: vi.fn().mockReturnValue('1.0.0'),
    getLocale: vi.fn().mockReturnValue('en-US'),
    getLocaleCountryCode: vi.fn().mockReturnValue('US'),
    
    // App state
    isReady: vi.fn().mockReturnValue(false),
    isPackaged: false,
    isDefaultProtocolClient: vi.fn().mockReturnValue(false),
    setAsDefaultProtocolClient: vi.fn().mockReturnValue(true),
    removeAsDefaultProtocolClient: vi.fn().mockReturnValue(true),
    
    // Security
    enableSandbox: vi.fn(),
    
    // Badge (macOS)
    setBadgeCount: vi.fn().mockReturnValue(true),
    getBadgeCount: vi.fn().mockReturnValue(0),
    
    // Dock (macOS)
    dock: {
      bounce: vi.fn().mockReturnValue(1),
      cancelBounce: vi.fn(),
      setBadge: vi.fn(),
      getBadge: vi.fn().mockReturnValue(''),
      hide: vi.fn(),
      show: vi.fn().mockResolvedValue(undefined),
      isVisible: vi.fn().mockReturnValue(true),
      setMenu: vi.fn(),
      getMenu: vi.fn().mockReturnValue(null),
      setIcon: vi.fn()
    }
  },
  
  BrowserWindow: vi.fn().mockImplementation((options) => {
    const win = {
      id: Math.floor(Math.random() * 1000),
      webContents: {
        id: Math.floor(Math.random() * 1000),
        send: vi.fn(),
        sendSync: vi.fn(),
        openDevTools: vi.fn(),
        closeDevTools: vi.fn(),
        isDevToolsOpened: vi.fn().mockReturnValue(false),
        loadURL: vi.fn().mockResolvedValue(undefined),
        loadFile: vi.fn().mockResolvedValue(undefined),
        reload: vi.fn(),
        reloadIgnoringCache: vi.fn(),
        getURL: vi.fn().mockReturnValue('app://taskmaster'),
        getTitle: vi.fn().mockReturnValue('TaskMaster'),
        executeJavaScript: vi.fn().mockResolvedValue(undefined),
        insertCSS: vi.fn().mockResolvedValue(''),
        removeInsertedCSS: vi.fn().mockResolvedValue(undefined),
        setWindowOpenHandler: vi.fn(),
        session: {
          clearCache: vi.fn().mockResolvedValue(undefined),
          clearStorageData: vi.fn().mockResolvedValue(undefined),
          setPermissionRequestHandler: vi.fn(),
          setPermissionCheckHandler: vi.fn()
        },
        on: vi.fn(),
        once: vi.fn()
      },
      on: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      
      // Window management
      show: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      isFocused: vi.fn().mockReturnValue(true),
      isDestroyed: vi.fn().mockReturnValue(false),
      isVisible: vi.fn().mockReturnValue(true),
      isModal: vi.fn().mockReturnValue(false),
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      isMinimized: vi.fn().mockReturnValue(false),
      isMaximized: vi.fn().mockReturnValue(false),
      restore: vi.fn(),
      close: vi.fn(),
      destroy: vi.fn(),
      
      // Window properties
      setTitle: vi.fn(),
      getTitle: vi.fn().mockReturnValue('TaskMaster'),
      setSize: vi.fn(),
      getSize: vi.fn().mockReturnValue([1200, 800]),
      setBounds: vi.fn(),
      getBounds: vi.fn().mockReturnValue({ x: 100, y: 100, width: 1200, height: 800 }),
      setContentBounds: vi.fn(),
      getContentBounds: vi.fn().mockReturnValue({ x: 100, y: 100, width: 1200, height: 800 }),
      setPosition: vi.fn(),
      getPosition: vi.fn().mockReturnValue([100, 100]),
      center: vi.fn(),
      
      // Mock the passed options
      options
    }
    
    return win
  }),
  
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({
      canceled: false,
      filePaths: ['/Users/testuser/Documents/test.txt']
    }),
    showOpenDialogSync: vi.fn().mockReturnValue(['/Users/testuser/Documents/test.txt']),
    showSaveDialog: vi.fn().mockResolvedValue({
      canceled: false,
      filePath: '/Users/testuser/Documents/saved.txt'
    }),
    showSaveDialogSync: vi.fn().mockReturnValue('/Users/testuser/Documents/saved.txt'),
    showMessageBox: vi.fn().mockResolvedValue({
      response: 0,
      checkboxChecked: false
    }),
    showMessageBoxSync: vi.fn().mockReturnValue(0),
    showErrorBox: vi.fn(),
    showCertificateTrustDialog: vi.fn().mockResolvedValue(true)
  },
  
  shell: {
    openExternal: vi.fn().mockImplementation((url) => {
      // Validate URL
      try {
        const parsed = new URL(url)
        if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
          return Promise.reject(new Error('Invalid protocol'))
        }
        return Promise.resolve()
      } catch {
        return Promise.reject(new Error('Invalid URL'))
      }
    }),
    openPath: vi.fn().mockResolvedValue(''),
    showItemInFolder: vi.fn(),
    moveItemToTrash: vi.fn().mockResolvedValue(true),
    beep: vi.fn(),
    writeShortcutLink: vi.fn().mockReturnValue(true),
    readShortcutLink: vi.fn().mockReturnValue({
      target: '/Applications/TaskMaster.app',
      args: '',
      appUserModelId: '',
      description: 'TaskMaster',
      icon: '/Applications/TaskMaster.app/Contents/Resources/icon.icns',
      iconIndex: 0,
      workingDirectory: ''
    })
  },
  
  clipboard: {
    readText: vi.fn().mockReturnValue('clipboard text'),
    writeText: vi.fn(),
    readHTML: vi.fn().mockReturnValue('<p>clipboard html</p>'),
    writeHTML: vi.fn(),
    readRTF: vi.fn().mockReturnValue('{\\rtf1}'),
    writeRTF: vi.fn(),
    readBookmark: vi.fn().mockReturnValue({ title: 'Test', url: 'https://example.com' }),
    writeBookmark: vi.fn(),
    readFindText: vi.fn().mockReturnValue('find text'),
    writeFindText: vi.fn(),
    clear: vi.fn(),
    availableFormats: vi.fn().mockReturnValue(['text/plain', 'text/html']),
    has: vi.fn().mockReturnValue(true),
    read: vi.fn().mockReturnValue('data'),
    write: vi.fn(),
    readBuffer: vi.fn().mockReturnValue(Buffer.from('buffer data')),
    writeBuffer: vi.fn()
  },
  
  nativeImage: {
    createEmpty: vi.fn().mockReturnValue({
      isEmpty: vi.fn().mockReturnValue(true),
      getSize: vi.fn().mockReturnValue({ width: 0, height: 0 }),
      getAspectRatio: vi.fn().mockReturnValue(1),
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,'),
      toPNG: vi.fn().mockReturnValue(Buffer.from('')),
      toJPEG: vi.fn().mockReturnValue(Buffer.from('')),
      toBitmap: vi.fn().mockReturnValue(Buffer.from('')),
      resize: vi.fn().mockReturnThis(),
      crop: vi.fn().mockReturnThis()
    }),
    createFromPath: vi.fn().mockImplementation(() => ({
      isEmpty: vi.fn().mockReturnValue(false),
      getSize: vi.fn().mockReturnValue({ width: 100, height: 100 }),
      getAspectRatio: vi.fn().mockReturnValue(1),
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
      toPNG: vi.fn().mockReturnValue(Buffer.from('mock png')),
      toJPEG: vi.fn().mockReturnValue(Buffer.from('mock jpeg')),
      toBitmap: vi.fn().mockReturnValue(Buffer.from('mock bitmap')),
      resize: vi.fn().mockReturnThis(),
      crop: vi.fn().mockReturnThis()
    })),
    createFromBuffer: vi.fn().mockImplementation(() => ({
      isEmpty: vi.fn().mockReturnValue(false),
      getSize: vi.fn().mockReturnValue({ width: 100, height: 100 })
    })),
    createFromDataURL: vi.fn().mockImplementation(() => ({
      isEmpty: vi.fn().mockReturnValue(false),
      getSize: vi.fn().mockReturnValue({ width: 100, height: 100 })
    }))
  },
  
  Menu: vi.fn().mockImplementation(() => ({
    items: [],
    append: vi.fn(),
    insert: vi.fn(),
    popup: vi.fn(),
    closePopup: vi.fn()
  })),
  
  MenuItem: vi.fn().mockImplementation((options) => ({
    ...options,
    enabled: options.enabled !== false,
    visible: options.visible !== false,
    checked: options.checked || false
  })),
  
  Tray: vi.fn().mockImplementation(() => ({
    setImage: vi.fn(),
    setPressedImage: vi.fn(),
    setToolTip: vi.fn(),
    setTitle: vi.fn(),
    getTitle: vi.fn().mockReturnValue(''),
    setContextMenu: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 22, height: 22 }),
    isDestroyed: vi.fn().mockReturnValue(false),
    destroy: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn()
  })),
  
  globalShortcut: {
    register: vi.fn().mockReturnValue(true),
    registerAll: vi.fn(),
    isRegistered: vi.fn().mockReturnValue(false),
    unregister: vi.fn(),
    unregisterAll: vi.fn()
  },
  
  screen: {
    getCursorScreenPoint: vi.fn().mockReturnValue({ x: 500, y: 300 }),
    getPrimaryDisplay: vi.fn().mockReturnValue({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 23, width: 1920, height: 1057 },
      accelerometerSupport: 'unknown',
      monochrome: false,
      colorDepth: 24,
      colorSpace: 'srgb',
      depthPerComponent: 8,
      size: { width: 1920, height: 1080 },
      displayFrequency: 60,
      scaleFactor: 1,
      rotation: 0,
      internal: true,
      touchSupport: 'unknown'
    }),
    getAllDisplays: vi.fn().mockReturnValue([{
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 }
    }]),
    getDisplayMatching: vi.fn().mockReturnValue({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 }
    }),
    getDisplayNearestPoint: vi.fn().mockReturnValue({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 }
    }),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn()
  },
  
  powerMonitor: {
    getSystemIdleState: vi.fn().mockReturnValue('active'),
    getSystemIdleTime: vi.fn().mockReturnValue(0),
    isOnBatteryPower: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn()
  },
  
  systemPreferences: {
    isDarkMode: vi.fn().mockReturnValue(false),
    isSwipeTrackingFromScrollEventsEnabled: vi.fn().mockReturnValue(true),
    getColor: vi.fn().mockReturnValue('#007AFF'),
    getAccentColor: vi.fn().mockReturnValue('007AFF'),
    getSystemColor: vi.fn().mockReturnValue('#007AFF'),
    getEffectiveAppearance: vi.fn().mockReturnValue('light'),
    getAppLevelAppearance: vi.fn().mockReturnValue('light'),
    setAppLevelAppearance: vi.fn(),
    canPromptTouchID: vi.fn().mockReturnValue(true),
    promptTouchID: vi.fn().mockResolvedValue(true),
    isTrustedAccessibilityClient: vi.fn().mockReturnValue(false),
    getMediaAccessStatus: vi.fn().mockReturnValue('granted'),
    askForMediaAccess: vi.fn().mockResolvedValue(true),
    getUserDefault: vi.fn(),
    setUserDefault: vi.fn(),
    removeUserDefault: vi.fn(),
    isAeroGlassEnabled: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn()
  }
}))

describe('Mocked Electron APIs Tests (2025)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('App API Mocking', () => {
    test('should mock app lifecycle methods correctly', async () => {
      expect(app.whenReady).toBeDefined()
      await expect(app.whenReady()).resolves.toBeUndefined()
      
      // Test event registration
      const readyCallback = vi.fn()
      app.on('ready', readyCallback)
      expect(app.on).toHaveBeenCalledWith('ready', readyCallback)
      
      // Test quit behavior
      app.quit()
      expect(app.quit).toHaveBeenCalled()
    })

    test('should mock app path methods with realistic paths', () => {
      expect(app.getPath('home')).toBe('/Users/testuser')
      expect(app.getPath('userData')).toBe('/Users/testuser/Library/Application Support/TaskMaster')
      expect(app.getPath('documents')).toBe('/Users/testuser/Documents')
      expect(app.getPath('temp')).toBe('/tmp')
      
      // Test unknown path
      expect(app.getPath('unknown' as any)).toBe('/mock/path/unknown')
    })

    test('should mock app info methods', () => {
      expect(app.getName()).toBe('TaskMaster')
      expect(app.getVersion()).toBe('1.0.0')
      expect(app.getLocale()).toBe('en-US')
      expect(app.isPackaged).toBe(false)
    })

    test('should mock macOS dock API', async () => {
      const bounceId = app.dock.bounce()
      expect(bounceId).toBe(1)
      
      app.dock.setBadge('5')
      expect(app.dock.setBadge).toHaveBeenCalledWith('5')
      
      await expect(app.dock.show()).resolves.toBeUndefined()
      expect(app.dock.isVisible()).toBe(true)
    })
  })

  describe('BrowserWindow API Mocking', () => {
    test('should create mock BrowserWindow with correct properties', () => {
      const options = {
        width: 1200,
        height: 800,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      }
      
      const window = new BrowserWindow(options)
      
      expect(window).toBeDefined()
      expect(window.id).toBeGreaterThan(0)
      expect(window.webContents).toBeDefined()
      expect(window.webContents.id).toBeGreaterThan(0)
      expect(window.options).toEqual(options)
    })

    test('should mock window lifecycle methods', async () => {
      const window = new BrowserWindow()
      
      await expect(window.webContents.loadURL('https://example.com')).resolves.toBeUndefined()
      expect(window.webContents.loadURL).toHaveBeenCalledWith('https://example.com')
      
      window.show()
      expect(window.show).toHaveBeenCalled()
      expect(window.isVisible()).toBe(true)
      
      window.close()
      expect(window.close).toHaveBeenCalled()
    })

    test('should mock webContents security methods', () => {
      const window = new BrowserWindow()
      const handler = vi.fn()
      
      window.webContents.session.setPermissionRequestHandler(handler)
      expect(window.webContents.session.setPermissionRequestHandler).toHaveBeenCalledWith(handler)
      
      window.webContents.setWindowOpenHandler(handler)
      expect(window.webContents.setWindowOpenHandler).toHaveBeenCalledWith(handler)
    })
  })

  describe('Dialog API Mocking', () => {
    test('should mock file dialog methods', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
      })
      
      expect(result).toEqual({
        canceled: false,
        filePaths: ['/Users/testuser/Documents/test.txt']
      })
      
      const saveResult = await dialog.showSaveDialog({
        defaultPath: '/Users/testuser/Documents/new.txt'
      })
      
      expect(saveResult).toEqual({
        canceled: false,
        filePath: '/Users/testuser/Documents/saved.txt'
      })
    })

    test('should mock message box methods', async () => {
      const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['OK', 'Cancel'],
        message: 'Test message'
      })
      
      expect(result).toEqual({
        response: 0,
        checkboxChecked: false
      })
      
      dialog.showErrorBox('Error Title', 'Error content')
      expect(dialog.showErrorBox).toHaveBeenCalledWith('Error Title', 'Error content')
    })
  })

  describe('Shell API Mocking with Security Validation', () => {
    test('should validate URLs in openExternal', async () => {
      // Valid URLs
      await expect(shell.openExternal('https://example.com')).resolves.toBeUndefined()
      await expect(shell.openExternal('http://example.com')).resolves.toBeUndefined()
      await expect(shell.openExternal('mailto:test@example.com')).resolves.toBeUndefined()
      
      // Invalid URLs
      await expect(shell.openExternal('file:///etc/passwd')).rejects.toThrow('Invalid protocol')
      await expect(shell.openExternal('javascript:alert("xss")')).rejects.toThrow('Invalid protocol')
      await expect(shell.openExternal('invalid-url')).rejects.toThrow('Invalid URL')
    })

    test('should mock file system operations', async () => {
      shell.showItemInFolder('/Users/testuser/Documents/file.txt')
      expect(shell.showItemInFolder).toHaveBeenCalledWith('/Users/testuser/Documents/file.txt')
      
      const trashResult = await shell.moveItemToTrash('/Users/testuser/Documents/old.txt')
      expect(trashResult).toBe(true)
    })
  })

  describe('Clipboard API Mocking', () => {
    test('should mock clipboard read/write operations', () => {
      expect(clipboard.readText()).toBe('clipboard text')
      
      clipboard.writeText('new text')
      expect(clipboard.writeText).toHaveBeenCalledWith('new text')
      
      expect(clipboard.readHTML()).toBe('<p>clipboard html</p>')
      expect(clipboard.availableFormats()).toEqual(['text/plain', 'text/html'])
    })

    test('should mock clipboard buffer operations', () => {
      const buffer = clipboard.readBuffer('custom')
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.toString()).toBe('buffer data')
      
      const newBuffer = Buffer.from('new data')
      clipboard.writeBuffer('custom', newBuffer)
      expect(clipboard.writeBuffer).toHaveBeenCalledWith('custom', newBuffer)
    })
  })

  describe('Native Image API Mocking', () => {
    test('should create mock native images', () => {
      const emptyImage = nativeImage.createEmpty()
      expect(emptyImage.isEmpty()).toBe(true)
      expect(emptyImage.getSize()).toEqual({ width: 0, height: 0 })
      
      const pathImage = nativeImage.createFromPath('/path/to/image.png')
      expect(pathImage.isEmpty()).toBe(false)
      expect(pathImage.getSize()).toEqual({ width: 100, height: 100 })
      expect(pathImage.toDataURL()).toBe('data:image/png;base64,mock')
    })

    test('should mock image manipulation methods', () => {
      const image = nativeImage.createFromPath('/path/to/image.png')
      
      const resized = image.resize({ width: 50, height: 50 })
      expect(resized).toBe(image) // Mock returns same instance
      expect(image.resize).toHaveBeenCalled()
      
      const cropped = image.crop({ x: 0, y: 0, width: 50, height: 50 })
      expect(cropped).toBe(image)
      expect(image.crop).toHaveBeenCalled()
    })
  })

  describe('System Integration API Mocking', () => {
    test('should mock global shortcuts', () => {
      const callback = vi.fn()
      const registered = globalShortcut.register('CommandOrControl+X', callback)
      
      expect(registered).toBe(true)
      expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+X', callback)
      
      expect(globalShortcut.isRegistered('CommandOrControl+X')).toBe(false) // Mock always returns false
      
      globalShortcut.unregisterAll()
      expect(globalShortcut.unregisterAll).toHaveBeenCalled()
    })

    test('should mock screen API', () => {
      const primary = screen.getPrimaryDisplay()
      expect(primary).toMatchObject({
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1
      })
      
      const cursorPoint = screen.getCursorScreenPoint()
      expect(cursorPoint).toEqual({ x: 500, y: 300 })
    })

    test('should mock power monitor', () => {
      expect(powerMonitor.getSystemIdleState(60)).toBe('active')
      expect(powerMonitor.isOnBatteryPower()).toBe(false)
      
      const suspendCallback = vi.fn()
      powerMonitor.on('suspend', suspendCallback)
      expect(powerMonitor.on).toHaveBeenCalledWith('suspend', suspendCallback)
    })

    test('should mock system preferences', async () => {
      expect(systemPreferences.isDarkMode()).toBe(false)
      expect(systemPreferences.getAccentColor()).toBe('007AFF')
      
      const canTouch = systemPreferences.canPromptTouchID()
      expect(canTouch).toBe(true)
      
      await expect(systemPreferences.promptTouchID('Test reason')).resolves.toBe(true)
      expect(systemPreferences.getMediaAccessStatus('microphone')).toBe('granted')
    })
  })

  describe('Advanced Mocking Patterns', () => {
    test('should support mock chaining and state tracking', () => {
      const window = new BrowserWindow()
      
      // Track state changes
      window.minimize()
      window.maximize()
      window.restore()
      
      expect(window.minimize).toHaveBeenCalled()
      expect(window.maximize).toHaveBeenCalled()
      expect(window.restore).toHaveBeenCalled()
      
      // Verify call order
      const callOrder = [
        window.minimize.mock.invocationCallOrder[0],
        window.maximize.mock.invocationCallOrder[0],
        window.restore.mock.invocationCallOrder[0]
      ]
      expect(callOrder).toEqual([1, 2, 3])
    })

    test('should support async mock behavior', async () => {
      const window = new BrowserWindow()
      
      // Mock async behavior
      window.webContents.executeJavaScript.mockImplementation(async (code: string) => {
        if (code.includes('error')) {
          throw new Error('Script error')
        }
        return 'success'
      })
      
      await expect(window.webContents.executeJavaScript('return 1')).resolves.toBe('success')
      await expect(window.webContents.executeJavaScript('throw error')).rejects.toThrow('Script error')
    })

    test('should support event emitter mocking', () => {
      const window = new BrowserWindow()
      const readyCallback = vi.fn()
      const closeCallback = vi.fn()
      
      window.webContents.on('did-finish-load', readyCallback)
      window.on('close', closeCallback)
      
      expect(window.webContents.on).toHaveBeenCalledWith('did-finish-load', readyCallback)
      expect(window.on).toHaveBeenCalledWith('close', closeCallback)
    })
  })
})

// Export mock factory for use in other tests
export function createElectronMocks(overrides = {}) {
  return {
    app,
    BrowserWindow,
    dialog,
    shell,
    clipboard,
    nativeImage,
    Menu,
    Tray,
    globalShortcut,
    screen,
    powerMonitor,
    systemPreferences,
    ...overrides
  }
}