/**
 * Comprehensive Electron Mock Utilities (2025)
 * 
 * Type-safe, reusable mock implementations for Electron APIs
 * following 2025 testing best practices.
 */

import { vi } from 'vitest';
import type { 
  BrowserWindow, 
  IpcMain, 
  IpcRenderer, 
  App, 
  Dialog,
  Shell,
  Menu,
  MenuItem,
  WebContents,
  Session,
  Protocol,
  AutoUpdater,
  CancellationToken
} from 'electron';

// Mock Event Implementation
export class MockEvent {
  defaultPrevented = false;
  sender: any;
  returnValue: any;
  frameId?: number;
  processId?: number;
  
  constructor(sender?: any) {
    this.sender = sender || createMockWebContents();
  }
  
  preventDefault() {
    this.defaultPrevented = true;
  }
}

// Mock WebContents
export function createMockWebContents(overrides: Partial<WebContents> = {}): WebContents {
  return {
    id: 1,
    send: vi.fn(),
    postMessage: vi.fn(),
    sendSync: vi.fn(),
    sendTo: vi.fn(),
    sendToFrame: vi.fn(),
    loadURL: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn(),
    downloadURL: vi.fn(),
    canGoBack: vi.fn().mockReturnValue(false),
    canGoForward: vi.fn().mockReturnValue(false),
    canGoToOffset: vi.fn().mockReturnValue(false),
    clearHistory: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    goToIndex: vi.fn(),
    goToOffset: vi.fn(),
    isCrashed: vi.fn().mockReturnValue(false),
    setUserAgent: vi.fn(),
    getUserAgent: vi.fn().mockReturnValue('MockElectron/1.0'),
    insertCSS: vi.fn().mockResolvedValue(''),
    removeInsertedCSS: vi.fn().mockResolvedValue(undefined),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    setIgnoreMenuShortcuts: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    ...overrides
  } as unknown as WebContents;
}

// Mock BrowserWindow
export function createMockBrowserWindow(overrides: Partial<BrowserWindow> = {}): BrowserWindow {
  const mockWebContents = createMockWebContents();
  
  return {
    id: 1,
    webContents: mockWebContents,
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
    isFocused: vi.fn().mockReturnValue(true),
    isDestroyed: vi.fn().mockReturnValue(false),
    isVisible: vi.fn().mockReturnValue(true),
    isModal: vi.fn().mockReturnValue(false),
    isFullScreen: vi.fn().mockReturnValue(false),
    isMaximized: vi.fn().mockReturnValue(false),
    isMinimized: vi.fn().mockReturnValue(false),
    setTitle: vi.fn(),
    getTitle: vi.fn().mockReturnValue('Mock Window'),
    setBounds: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
    setSize: vi.fn(),
    getSize: vi.fn().mockReturnValue([800, 600]),
    setPosition: vi.fn(),
    getPosition: vi.fn().mockReturnValue([0, 0]),
    center: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    isAlwaysOnTop: vi.fn().mockReturnValue(false),
    moveTop: vi.fn(),
    loadURL: vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),
    removeAllListeners: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
    ...overrides
  } as unknown as BrowserWindow;
}

// Mock IPC Main
export function createMockIpcMain(): IpcMain {
  const handlers = new Map<string, Function>();
  const listeners = new Map<string, Set<Function>>();
  
  return {
    handle: vi.fn((channel: string, handler: Function) => {
      handlers.set(channel, handler);
    }),
    handleOnce: vi.fn((channel: string, handler: Function) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel);
    }),
    on: vi.fn((event: string, listener: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);
      return this;
    }),
    once: vi.fn((event: string, listener: Function) => {
      const wrapper = (...args: any[]) => {
        listener(...args);
        listeners.get(event)?.delete(wrapper);
      };
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(wrapper);
      return this;
    }),
    off: vi.fn((event: string, listener: Function) => {
      listeners.get(event)?.delete(listener);
      return this;
    }),
    removeListener: vi.fn((event: string, listener: Function) => {
      listeners.get(event)?.delete(listener);
      return this;
    }),
    removeAllListeners: vi.fn((event?: string) => {
      if (event) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
      return this;
    }),
    emit: vi.fn((event: string, ...args: any[]) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(listener => listener(...args));
      }
      return true;
    }),
    // Test helper to trigger handlers
    _triggerHandler: async (channel: string, event: any, ...args: any[]) => {
      const handler = handlers.get(channel);
      if (handler) {
        return await handler(event, ...args);
      }
      throw new Error(`No handler registered for channel: ${channel}`);
    },
    // Test helper to get handlers
    _getHandlers: () => handlers,
    _getListeners: () => listeners
  } as unknown as IpcMain & {
    _triggerHandler: (channel: string, event: any, ...args: any[]) => Promise<any>;
    _getHandlers: () => Map<string, Function>;
    _getListeners: () => Map<string, Set<Function>>;
  };
}

// Mock IPC Renderer
export function createMockIpcRenderer(): IpcRenderer {
  const listeners = new Map<string, Set<Function>>();
  
  return {
    send: vi.fn(),
    sendSync: vi.fn().mockReturnValue(undefined),
    sendTo: vi.fn(),
    sendToHost: vi.fn(),
    postMessage: vi.fn(),
    invoke: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((channel: string, listener: Function) => {
      if (!listeners.has(channel)) {
        listeners.set(channel, new Set());
      }
      listeners.get(channel)!.add(listener);
      return this;
    }),
    once: vi.fn((channel: string, listener: Function) => {
      const wrapper = (...args: any[]) => {
        listener(...args);
        listeners.get(channel)?.delete(wrapper);
      };
      if (!listeners.has(channel)) {
        listeners.set(channel, new Set());
      }
      listeners.get(channel)!.add(wrapper);
      return this;
    }),
    off: vi.fn((channel: string, listener: Function) => {
      listeners.get(channel)?.delete(listener);
      return this;
    }),
    removeListener: vi.fn((channel: string, listener: Function) => {
      listeners.get(channel)?.delete(listener);
      return this;
    }),
    removeAllListeners: vi.fn((channel?: string) => {
      if (channel) {
        listeners.delete(channel);
      } else {
        listeners.clear();
      }
      return this;
    }),
    // Test helper to trigger listeners
    _triggerListener: (channel: string, event: any, ...args: any[]) => {
      const channelListeners = listeners.get(channel);
      if (channelListeners) {
        channelListeners.forEach(listener => listener(event, ...args));
      }
    }
  } as unknown as IpcRenderer & {
    _triggerListener: (channel: string, event: any, ...args: any[]) => void;
  };
}

// Mock App
export function createMockApp(): App {
  return {
    quit: vi.fn(),
    exit: vi.fn(),
    relaunch: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
    whenReady: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn(),
    hide: vi.fn(),
    show: vi.fn(),
    getAppPath: vi.fn().mockReturnValue('/mock/app/path'),
    getPath: vi.fn().mockReturnValue('/mock/path'),
    getFileIcon: vi.fn().mockResolvedValue('mock-icon'),
    setPath: vi.fn(),
    getVersion: vi.fn().mockReturnValue('1.0.0'),
    getName: vi.fn().mockReturnValue('MockApp'),
    setName: vi.fn(),
    getLocale: vi.fn().mockReturnValue('en-US'),
    getLocaleCountryCode: vi.fn().mockReturnValue('US'),
    addRecentDocument: vi.fn(),
    clearRecentDocuments: vi.fn(),
    setAsDefaultProtocolClient: vi.fn().mockReturnValue(true),
    removeAsDefaultProtocolClient: vi.fn().mockReturnValue(true),
    isDefaultProtocolClient: vi.fn().mockReturnValue(false),
    getJumpListSettings: vi.fn().mockReturnValue({ removedItems: [], customCategory: [] }),
    setJumpList: vi.fn(),
    requestSingleInstanceLock: vi.fn().mockReturnValue(true),
    hasSingleInstanceLock: vi.fn().mockReturnValue(true),
    releaseSingleInstanceLock: vi.fn(),
    setUserActivity: vi.fn(),
    getCurrentActivityType: vi.fn().mockReturnValue(''),
    invalidateCurrentActivity: vi.fn(),
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),
    removeAllListeners: vi.fn().mockReturnThis()
  } as unknown as App;
}

// Mock Dialog
export function createMockDialog(): Dialog {
  return {
    showOpenDialog: vi.fn().mockResolvedValue({ filePaths: [], canceled: false }),
    showOpenDialogSync: vi.fn().mockReturnValue([]),
    showSaveDialog: vi.fn().mockResolvedValue({ filePath: undefined, canceled: false }),
    showSaveDialogSync: vi.fn().mockReturnValue(undefined),
    showMessageBox: vi.fn().mockResolvedValue({ response: 0, checkboxChecked: false }),
    showMessageBoxSync: vi.fn().mockReturnValue(0),
    showErrorBox: vi.fn(),
    showCertificateTrustDialog: vi.fn()
  } as unknown as Dialog;
}

// Mock Shell
export function createMockShell(): Shell {
  return {
    showItemInFolder: vi.fn(),
    openPath: vi.fn().mockResolvedValue(''),
    openExternal: vi.fn().mockResolvedValue(undefined),
    trashItem: vi.fn().mockResolvedValue(undefined),
    beep: vi.fn(),
    writeShortcutLink: vi.fn().mockReturnValue(true),
    readShortcutLink: vi.fn().mockReturnValue({
      target: '',
      cwd: '',
      args: '',
      description: '',
      icon: '',
      iconIndex: 0,
      appUserModelId: ''
    })
  } as unknown as Shell;
}

// Mock AutoUpdater
export function createMockAutoUpdater(): AutoUpdater {
  const listeners = new Map<string, Set<Function>>();
  
  return {
    setFeedURL: vi.fn(),
    getFeedURL: vi.fn().mockReturnValue('https://mock-update-server.com'),
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn((event: string, listener: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);
      return this;
    }),
    once: vi.fn((event: string, listener: Function) => {
      const wrapper = (...args: any[]) => {
        listener(...args);
        listeners.get(event)?.delete(wrapper);
      };
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(wrapper);
      return this;
    }),
    off: vi.fn((event: string, listener: Function) => {
      listeners.get(event)?.delete(listener);
      return this;
    }),
    removeListener: vi.fn((event: string, listener: Function) => {
      listeners.get(event)?.delete(listener);
      return this;
    }),
    removeAllListeners: vi.fn((event?: string) => {
      if (event) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
      return this;
    }),
    emit: vi.fn((event: string, ...args: any[]) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(listener => listener(...args));
      }
      return true;
    }),
    // Test helper
    _emit: (event: string, ...args: any[]) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(listener => listener(...args));
      }
    }
  } as unknown as AutoUpdater & {
    _emit: (event: string, ...args: any[]) => void;
  };
}

// Mock CancellationToken
export function createMockCancellationToken(): CancellationToken {
  return new Proxy({} as CancellationToken, {
    get() {
      return vi.fn();
    }
  });
}

// Complete Electron Mock
export function createElectronMock() {
  const mockApp = createMockApp();
  const mockIpcMain = createMockIpcMain();
  const mockDialog = createMockDialog();
  const mockShell = createMockShell();
  const mockAutoUpdater = createMockAutoUpdater();
  
  const mockBrowserWindow = vi.fn().mockImplementation((options?: any) => {
    return createMockBrowserWindow(options);
  });
  
  // Add static methods
  mockBrowserWindow.getAllWindows = vi.fn().mockReturnValue([]);
  mockBrowserWindow.getFocusedWindow = vi.fn().mockReturnValue(null);
  mockBrowserWindow.fromWebContents = vi.fn().mockReturnValue(null);
  mockBrowserWindow.fromBrowserView = vi.fn().mockReturnValue(null);
  mockBrowserWindow.fromId = vi.fn().mockReturnValue(null);
  
  const mockMenu = vi.fn().mockImplementation(() => ({
    append: vi.fn(),
    insert: vi.fn(),
    items: [],
    popup: vi.fn()
  }));
  
  mockMenu.buildFromTemplate = vi.fn().mockReturnValue({
    append: vi.fn(),
    insert: vi.fn(),
    items: [],
    popup: vi.fn()
  });
  mockMenu.setApplicationMenu = vi.fn();
  mockMenu.getApplicationMenu = vi.fn().mockReturnValue(null);
  
  return {
    app: mockApp,
    BrowserWindow: mockBrowserWindow,
    ipcMain: mockIpcMain,
    dialog: mockDialog,
    shell: mockShell,
    Menu: mockMenu,
    MenuItem: vi.fn(),
    autoUpdater: mockAutoUpdater,
    nativeTheme: {
      shouldUseDarkColors: false,
      themeSource: 'system' as const,
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn()
    },
    session: {
      defaultSession: {
        clearCache: vi.fn().mockResolvedValue(undefined),
        clearStorageData: vi.fn().mockResolvedValue(undefined),
        setPermissionRequestHandler: vi.fn(),
        setPermissionCheckHandler: vi.fn(),
        protocol: {
          registerFileProtocol: vi.fn(),
          unregisterProtocol: vi.fn(),
          isProtocolRegistered: vi.fn().mockReturnValue(false)
        }
      }
    },
    protocol: {
      registerFileProtocol: vi.fn(),
      unregisterProtocol: vi.fn(),
      isProtocolRegistered: vi.fn().mockReturnValue(false)
    }
  };
}

// Reset all mocks utility
export function resetElectronMocks(electronMock: ReturnType<typeof createElectronMock>) {
  vi.clearAllMocks();
  
  // Reset static methods
  if (electronMock.BrowserWindow.getAllWindows) {
    electronMock.BrowserWindow.getAllWindows.mockReturnValue([]);
  }
  if (electronMock.BrowserWindow.getFocusedWindow) {
    electronMock.BrowserWindow.getFocusedWindow.mockReturnValue(null);
  }
  
  // Clear IPC handlers if they have the test helper
  const ipcMain = electronMock.ipcMain as any;
  if (ipcMain._getHandlers) {
    ipcMain._getHandlers().clear();
  }
  if (ipcMain._getListeners) {
    ipcMain._getListeners().clear();
  }
}

// Export commonly used mock scenarios
export const mockScenarios = {
  // Window with preload script loaded
  windowWithPreload: () => {
    const window = createMockBrowserWindow();
    window.webContents.executeJavaScript = vi.fn().mockResolvedValue({
      electron: true,
      versions: { electron: '20.0.0' }
    });
    return window;
  },
  
  // Window ready to show
  windowReadyToShow: () => {
    const window = createMockBrowserWindow();
    const readyCallback = vi.fn();
    window.once = vi.fn((event, callback) => {
      if (event === 'ready-to-show') {
        readyCallback.mockImplementation(callback);
      }
      return window;
    });
    return { window, triggerReady: () => readyCallback() };
  },
  
  // IPC with registered handlers
  ipcWithHandlers: (handlers: Record<string, Function>) => {
    const ipcMain = createMockIpcMain();
    Object.entries(handlers).forEach(([channel, handler]) => {
      ipcMain.handle(channel, handler);
    });
    return ipcMain;
  }
};