// Mock factory for Electron BrowserWindow to prevent test regressions
import { vi } from 'vitest'
import type { BrowserWindow, WebContents, BrowserWindowConstructorOptions } from 'electron'

export interface MockWebContents extends Partial<WebContents> {
  send: ReturnType<typeof vi.fn>
  openDevTools: ReturnType<typeof vi.fn>
  closeDevTools: ReturnType<typeof vi.fn>
  isDevToolsOpened: ReturnType<typeof vi.fn>
  reload: ReturnType<typeof vi.fn>
  reloadIgnoringCache: ReturnType<typeof vi.fn>
  canGoBack: ReturnType<typeof vi.fn>
  canGoForward: ReturnType<typeof vi.fn>
  canGoToOffset: ReturnType<typeof vi.fn>
  goBack: ReturnType<typeof vi.fn>
  goForward: ReturnType<typeof vi.fn>
  loadURL: ReturnType<typeof vi.fn>
  getURL: ReturnType<typeof vi.fn>
  getTitle: ReturnType<typeof vi.fn>
  isLoading: ReturnType<typeof vi.fn>
  isLoadingMainFrame: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  isCrashed: ReturnType<typeof vi.fn>
  setUserAgent: ReturnType<typeof vi.fn>
  insertCSS: ReturnType<typeof vi.fn>
  executeJavaScript: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  once: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
}

export interface MockBrowserWindow extends Partial<BrowserWindow> {
  id: number
  webContents: MockWebContents
  loadURL: ReturnType<typeof vi.fn>
  loadFile: ReturnType<typeof vi.fn>
  show: ReturnType<typeof vi.fn>
  hide: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  isDestroyed: ReturnType<typeof vi.fn>
  isVisible: ReturnType<typeof vi.fn>
  isFocused: ReturnType<typeof vi.fn>
  isMinimized: ReturnType<typeof vi.fn>
  isMaximized: ReturnType<typeof vi.fn>
  isFullScreen: ReturnType<typeof vi.fn>
  setBounds: ReturnType<typeof vi.fn>
  getBounds: ReturnType<typeof vi.fn>
  setSize: ReturnType<typeof vi.fn>
  getSize: ReturnType<typeof vi.fn>
  setContentSize: ReturnType<typeof vi.fn>
  getContentSize: ReturnType<typeof vi.fn>
  setMinimumSize: ReturnType<typeof vi.fn>
  getMinimumSize: ReturnType<typeof vi.fn>
  setMaximumSize: ReturnType<typeof vi.fn>
  getMaximumSize: ReturnType<typeof vi.fn>
  center: ReturnType<typeof vi.fn>
  setPosition: ReturnType<typeof vi.fn>
  getPosition: ReturnType<typeof vi.fn>
  setTitle: ReturnType<typeof vi.fn>
  getTitle: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  once: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
}

let windowIdCounter = 1

export function createMockWebContents(overrides?: Partial<MockWebContents>): MockWebContents {
  return {
    send: vi.fn(),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn(),
    isDevToolsOpened: vi.fn().mockReturnValue(false),
    reload: vi.fn(),
    reloadIgnoringCache: vi.fn(),
    canGoBack: vi.fn().mockReturnValue(false),
    canGoForward: vi.fn().mockReturnValue(false),
    canGoToOffset: vi.fn().mockReturnValue(false),
    goBack: vi.fn(),
    goForward: vi.fn(),
    loadURL: vi.fn().mockResolvedValue(undefined),
    getURL: vi.fn().mockReturnValue(''),
    getTitle: vi.fn().mockReturnValue(''),
    isLoading: vi.fn().mockReturnValue(false),
    isLoadingMainFrame: vi.fn().mockReturnValue(false),
    stop: vi.fn(),
    isCrashed: vi.fn().mockReturnValue(false),
    setUserAgent: vi.fn(),
    insertCSS: vi.fn().mockResolvedValue(''),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    ...overrides
  }
}

export function createMockBrowserWindow(
  options?: BrowserWindowConstructorOptions,
  overrides?: Partial<MockBrowserWindow>
): MockBrowserWindow {
  const id = windowIdCounter++
  const webContents = createMockWebContents(overrides?.webContents)
  
  const mockWindow: MockBrowserWindow = {
    id,
    webContents,
    loadURL: vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(undefined),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    isVisible: vi.fn().mockReturnValue(true),
    isFocused: vi.fn().mockReturnValue(false),
    isMinimized: vi.fn().mockReturnValue(false),
    isMaximized: vi.fn().mockReturnValue(false),
    isFullScreen: vi.fn().mockReturnValue(false),
    setBounds: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
    setSize: vi.fn(),
    getSize: vi.fn().mockReturnValue([800, 600]),
    setContentSize: vi.fn(),
    getContentSize: vi.fn().mockReturnValue([800, 600]),
    setMinimumSize: vi.fn(),
    getMinimumSize: vi.fn().mockReturnValue([0, 0]),
    setMaximumSize: vi.fn(),
    getMaximumSize: vi.fn().mockReturnValue([0, 0]),
    center: vi.fn(),
    setPosition: vi.fn(),
    getPosition: vi.fn().mockReturnValue([0, 0]),
    setTitle: vi.fn(),
    getTitle: vi.fn().mockReturnValue(''),
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),
    removeAllListeners: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnValue(false),
    ...overrides
  }

  // Set up destroy behavior
  mockWindow.destroy.mockImplementation(() => {
    mockWindow.isDestroyed.mockReturnValue(true)
    mockWindow.isVisible.mockReturnValue(false)
  })

  // Set up close behavior
  mockWindow.close.mockImplementation(() => {
    mockWindow.emit('close')
    mockWindow.destroy()
  })

  return mockWindow
}

export function resetWindowIdCounter(): void {
  windowIdCounter = 1
}

// Helper to create multiple windows
export function createMockBrowserWindows(count: number): MockBrowserWindow[] {
  return Array.from({ length: count }, () => createMockBrowserWindow())
}