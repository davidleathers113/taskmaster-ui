// Mock factory for electron-updater to prevent test regressions
import { vi } from 'vitest'
import type { UpdateCheckResult, UpdateInfo, AppUpdater } from 'electron-updater'

export interface MockUpdateInfo extends UpdateInfo {
  version: string
  files: Array<{ url: string; sha512: string; size: number }>
  path: string
  sha512: string
  releaseDate: string
  releaseNotes?: string | null
  releaseName?: string | null
  releaseNotesFile?: string | null
  stagingPercentage?: number
  minimumSystemVersion?: string
}

export interface MockUpdateCheckResult extends UpdateCheckResult {
  updateInfo: MockUpdateInfo
  downloadPromise?: Promise<string[]> | null
  cancellationToken?: any
  versionInfo?: { version: string }
}

export function createMockUpdateInfo(overrides?: Partial<MockUpdateInfo>): MockUpdateInfo {
  return {
    version: '2.0.0',
    files: [],
    path: '',
    sha512: '',
    releaseDate: new Date().toISOString(),
    releaseNotes: null,
    releaseName: null,
    releaseNotesFile: null,
    ...overrides
  }
}

export function createMockUpdateCheckResult(overrides?: Partial<MockUpdateCheckResult>): MockUpdateCheckResult {
  return {
    updateInfo: createMockUpdateInfo(overrides?.updateInfo),
    downloadPromise: null,
    cancellationToken: undefined, // Use undefined instead of null for consistency
    versionInfo: { version: '2.0.0' },
    ...overrides
  }
}

export function createMockAutoUpdater(): MockedAutoUpdater {
  const mockAutoUpdater = {
    currentVersion: { version: '1.0.0' },
    autoDownload: false,
    autoInstallOnAppQuit: true,
    autoRunAppAfterInstall: true,
    allowPrerelease: false,
    fullChangelog: false,
    allowDowngrade: false,
    channel: 'latest',
    disableWebInstaller: false,
    disableDifferentialDownload: false,
    httpExecutor: null,
    logger: null,
    updateConfigPath: null,
    requestHeaders: null,
    signals: {},
    app: {} as any,
    
    checkForUpdates: vi.fn().mockResolvedValue(createMockUpdateCheckResult()),
    checkForUpdatesAndNotify: vi.fn().mockResolvedValue(createMockUpdateCheckResult()),
    downloadUpdate: vi.fn().mockResolvedValue([]),
    getFeedURL: vi.fn().mockReturnValue('https://update.server.com'),
    setFeedURL: vi.fn(),
    quitAndInstall: vi.fn(),
    restartAndInstall: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    emit: vi.fn(),
    listenerCount: vi.fn().mockReturnValue(0),
    addListener: vi.fn(),
    off: vi.fn(),
    prependListener: vi.fn(),
    prependOnceListener: vi.fn(),
    eventNames: vi.fn().mockReturnValue([]),
    listeners: vi.fn().mockReturnValue([]),
    rawListeners: vi.fn().mockReturnValue([]),
    getMaxListeners: vi.fn().mockReturnValue(10),
    setMaxListeners: vi.fn(),
    
    // Private/internal methods that might be accessed in tests
    _checkForUpdates: vi.fn(),
    _downloadUpdate: vi.fn(),
    _installUpdate: vi.fn()
  }

  return mockAutoUpdater as MockedAutoUpdater
}

export type MockedAutoUpdater = AppUpdater & {
  checkForUpdates: ReturnType<typeof vi.fn>
  checkForUpdatesAndNotify: ReturnType<typeof vi.fn>
  downloadUpdate: ReturnType<typeof vi.fn>
  getFeedURL: ReturnType<typeof vi.fn>
  setFeedURL: ReturnType<typeof vi.fn>
  quitAndInstall: ReturnType<typeof vi.fn>
  _checkForUpdates?: ReturnType<typeof vi.fn>
  _downloadUpdate?: ReturnType<typeof vi.fn>
  _installUpdate?: ReturnType<typeof vi.fn>
}