# Electron Preload Script Security, API Mocking, and Cross-Process Communication (2025)

## Table of Contents
1. [Preload Script Security Best Practices](#preload-script-security-best-practices)
2. [Cross-Process Communication Security](#cross-process-communication-security)
3. [Testing Strategies and Frameworks](#testing-strategies-and-frameworks)
4. [API Mocking Approaches](#api-mocking-approaches)
5. [Implementation Guidelines](#implementation-guidelines)

## Preload Script Security Best Practices

### Context Isolation (Default Since Electron 12)

Context isolation is a critical security feature that ensures preload scripts and Electron's internal logic run in a separate JavaScript context from the website loaded in webContents:

```javascript
// BrowserWindow configuration
const mainWindow = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,     // Default since Electron 12
    nodeIntegration: false,     // Always disable
    sandbox: true,              // Enable for all renderers
    webSecurity: true,          // Never disable in production
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    preload: path.join(__dirname, 'preload.js')
  }
})
```

**Key Points:**
- Context isolation prevents websites from accessing Electron internals
- Even with `nodeIntegration: false`, context isolation must be enabled for true security
- Without context isolation, prototype pollution attacks can override preload script code

### Sandbox Configuration

The sandbox is a Chromium feature that uses OS-level restrictions to limit renderer process access:

```javascript
// Since Electron 20, preload scripts are sandboxed by default
// Sandbox restrictions:
const sandboxRestrictions = {
  canAccessNodeAPIs: false,
  canRequireModules: false,
  canAccessRemoteModule: false,
  canModifyProcess: false,
  canAccessFileSystem: false
}
```

### Secure API Exposure with contextBridge

**NEVER expose raw Electron APIs directly**. Use contextBridge to create a secure API surface:

```javascript
// preload.js - SECURE IMPLEMENTATION
const { contextBridge, ipcRenderer } = require('electron')

// ✅ GOOD: Limited, validated API exposure
contextBridge.exposeInMainWorld('electronAPI', {
  // One-way communication
  sendMessage: (channel, data) => {
    const validChannels = ['save-file', 'load-file', 'app-settings']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  
  // Two-way communication with validation
  invoke: async (channel, data) => {
    const validChannels = ['get-user-data', 'save-user-data']
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, data)
    }
    throw new Error('Invalid channel')
  },
  
  // Secure event handling - never expose the event object
  onMessage: (channel, callback) => {
    const validChannels = ['update-available', 'file-saved']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, value) => callback(value))
    }
  }
})

// ❌ BAD: Direct API exposure
// contextBridge.exposeInMainWorld('electronAPI', {
//   ipcRenderer: ipcRenderer,  // NEVER DO THIS
//   send: ipcRenderer.send,     // NEVER DO THIS
//   on: ipcRenderer.on          // NEVER DO THIS
// })
```

### Vulnerability Risks Without Proper Isolation

1. **Prototype Pollution**: Malicious JavaScript can alter preload functions to bypass security checks
2. **IPC Event System Access**: Direct ipcRenderer exposure allows listening to any IPC events
3. **Node.js Primitive Access**: Without isolation, attackers can access Node.js APIs
4. **Sandbox Escapes**: Improper configuration can lead to sandbox bypass vulnerabilities

## Cross-Process Communication Security

### IPC Message Validation

**Always validate the sender of all IPC messages**:

```javascript
// main.js - Secure IPC handler with sender validation
const { ipcMain, BrowserWindow } = require('electron')
const { URL } = require('url')

ipcMain.handle('get-sensitive-data', (event) => {
  // Validate sender frame
  if (!validateSender(event.senderFrame)) {
    return null
  }
  
  // Validate sender window
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || !isWindowTrusted(window)) {
    return null
  }
  
  return getSensitiveData()
})

function validateSender(frame) {
  if (!frame) return false
  
  try {
    const frameUrl = new URL(frame.url)
    const allowedOrigins = ['https://app.example.com', 'app://taskmaster']
    
    // Check if frame is from iframe (security risk)
    if (frame.parent && frame.parent !== frame) {
      return false // Reject IPC from iframes
    }
    
    return allowedOrigins.includes(frameUrl.origin)
  } catch {
    return false
  }
}

function isWindowTrusted(window) {
  // Implement window trust validation
  return registeredWindows.has(window.id)
}
```

### IPC Communication Patterns

#### 1. Renderer to Main (One-way)
```javascript
// Renderer (via preload)
electronAPI.sendMessage('save-file', { content: 'data' })

// Main
ipcMain.on('save-file', (event, data) => {
  if (validateSender(event.senderFrame)) {
    saveFile(data)
  }
})
```

#### 2. Renderer to Main (Two-way)
```javascript
// Renderer (via preload)
const result = await electronAPI.invoke('get-user-data', { userId: 123 })

// Main
ipcMain.handle('get-user-data', async (event, data) => {
  if (!validateSender(event.senderFrame)) {
    throw new Error('Unauthorized')
  }
  return await getUserData(data.userId)
})
```

#### 3. Main to Renderer
```javascript
// Main
const window = BrowserWindow.getFocusedWindow()
if (window && isWindowTrusted(window)) {
  window.webContents.send('update-available', { version: '2.0.0' })
}

// Renderer (via preload)
electronAPI.onMessage('update-available', (data) => {
  console.log('Update available:', data.version)
})
```

### Security Checklist

- [ ] All IPC handlers validate sender frame URL
- [ ] IPC from iframes is explicitly rejected
- [ ] Channel names are whitelisted in preload script
- [ ] No raw IPC methods exposed to renderer
- [ ] Event objects are never passed to renderer callbacks
- [ ] All input data is validated and sanitized
- [ ] Rate limiting implemented for sensitive operations

## Testing Strategies and Frameworks

### Framework Comparison (2025)

| Feature | Vitest | Jest | Playwright |
|---------|--------|------|------------|
| Performance | 10-20x faster in watch mode | Slower with TS/ESM | N/A for unit tests |
| ES Module Support | Native | Limited (unstable) | N/A |
| Electron Testing | Via mocks | Via mocks | Native support |
| Use Case | Unit tests | Legacy projects | E2E tests |

### Recommended Testing Stack

1. **Unit Tests**: Vitest with mocked Electron APIs
2. **Integration Tests**: Vitest with partial mocks
3. **E2E Tests**: Playwright with Electron support
4. **Security Tests**: Custom test suites with security-focused scenarios

### Testing Preload Scripts with Vitest

```javascript
// preload.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { contextBridge, ipcRenderer } from 'electron'

// Mock Electron modules
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn()
  },
  ipcRenderer: {
    send: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  }
}))

describe('Preload Script Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-import preload script for each test
    vi.resetModules()
  })

  it('should only expose allowed API methods', async () => {
    // Import preload script
    await import('../src/preload/index.js')
    
    // Verify contextBridge was called correctly
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
      expect.objectContaining({
        sendMessage: expect.any(Function),
        invoke: expect.any(Function),
        onMessage: expect.any(Function)
      })
    )
    
    // Verify no dangerous APIs are exposed
    const exposedAPI = contextBridge.exposeInMainWorld.mock.calls[0][1]
    expect(exposedAPI.ipcRenderer).toBeUndefined()
    expect(exposedAPI.require).toBeUndefined()
    expect(exposedAPI.process).toBeUndefined()
  })

  it('should validate channels in sendMessage', async () => {
    await import('../src/preload/index.js')
    const api = contextBridge.exposeInMainWorld.mock.calls[0][1]
    
    // Valid channel should work
    api.sendMessage('save-file', { data: 'test' })
    expect(ipcRenderer.send).toHaveBeenCalledWith('save-file', { data: 'test' })
    
    // Invalid channel should be rejected
    vi.clearAllMocks()
    api.sendMessage('dangerous-channel', { data: 'test' })
    expect(ipcRenderer.send).not.toHaveBeenCalled()
  })

  it('should not expose event object in callbacks', async () => {
    await import('../src/preload/index.js')
    const api = contextBridge.exposeInMainWorld.mock.calls[0][1]
    
    const callback = vi.fn()
    api.onMessage('update-available', callback)
    
    // Simulate IPC event
    const mockEvent = { sender: {}, senderFrame: {} }
    const mockData = { version: '2.0.0' }
    
    // Get the registered handler
    const handler = ipcRenderer.on.mock.calls[0][1]
    handler(mockEvent, mockData)
    
    // Callback should only receive data, not event
    expect(callback).toHaveBeenCalledWith(mockData)
    expect(callback).not.toHaveBeenCalledWith(mockEvent, mockData)
  })
})
```

### E2E Testing with Playwright

```javascript
// e2e/preload-security.test.ts
import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'

test.describe('Preload Script Security E2E', () => {
  let electronApp
  let window

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../')],
      env: { ...process.env, NODE_ENV: 'test' }
    })
    window = await electronApp.firstWindow()
  })

  test.afterEach(async () => {
    await electronApp.close()
  })

  test('should not expose Node.js APIs to renderer', async () => {
    // Check that Node APIs are not available
    const hasNodeAPIs = await window.evaluate(() => {
      return {
        hasRequire: typeof require !== 'undefined',
        hasProcess: typeof process !== 'undefined',
        hasBuffer: typeof Buffer !== 'undefined',
        hasGlobal: typeof global !== 'undefined'
      }
    })
    
    expect(hasNodeAPIs.hasRequire).toBe(false)
    expect(hasNodeAPIs.hasProcess).toBe(false)
    expect(hasNodeAPIs.hasBuffer).toBe(false)
    expect(hasNodeAPIs.hasGlobal).toBe(false)
  })

  test('should only expose whitelisted electronAPI', async () => {
    const exposedAPIs = await window.evaluate(() => {
      return window.electronAPI ? Object.keys(window.electronAPI) : []
    })
    
    expect(exposedAPIs).toEqual(['sendMessage', 'invoke', 'onMessage'])
  })

  test('should reject invalid IPC channels', async () => {
    const result = await window.evaluate(async () => {
      try {
        await window.electronAPI.invoke('malicious-channel', {})
        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid channel')
  })
})
```

## API Mocking Approaches

### 1. Vitest Mocking for Unit Tests

```javascript
// Mock entire Electron module
vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    getPath: vi.fn((name) => `/mock/path/${name}`),
    isPackaged: false
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn()
    },
    on: vi.fn(),
    show: vi.fn(),
    close: vi.fn()
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn()
  }
}))
```

### 2. WebdriverIO Electron Service Mocking

```javascript
// Advanced mocking with WebdriverIO
const mockApp = await browser.electron.mock('app', 'getName')
const mockDialog = await browser.electron.mock('dialog', 'showOpenDialog')

// Execute with mocked APIs
await browser.electron.execute((electron) => {
  return electron.app.getName() // Returns mocked value
})

// Verify mock calls
expect(mockApp).toHaveBeenCalled()
```

### 3. Custom Mock Factory Pattern

```javascript
// test/mocks/electronMockFactory.js
export function createElectronMocks(overrides = {}) {
  return {
    app: {
      on: vi.fn(),
      whenReady: vi.fn(() => Promise.resolve()),
      quit: vi.fn(),
      ...overrides.app
    },
    BrowserWindow: createBrowserWindowMock(overrides.BrowserWindow),
    ipcMain: createIPCMainMock(overrides.ipcMain),
    contextBridge: {
      exposeInMainWorld: vi.fn()
    },
    ipcRenderer: createIPCRendererMock(overrides.ipcRenderer)
  }
}

function createBrowserWindowMock(overrides = {}) {
  return vi.fn().mockImplementation(() => ({
    id: Math.random(),
    loadURL: vi.fn(),
    webContents: {
      send: vi.fn(),
      id: Math.random()
    },
    ...overrides
  }))
}
```

## Implementation Guidelines

### 1. Security-First Development

```javascript
// security/preloadValidator.js
export class PreloadSecurityValidator {
  constructor() {
    this.allowedChannels = new Set([
      'save-file',
      'load-file',
      'get-user-data',
      'update-settings'
    ])
    
    this.blockedPatterns = [
      /^ELECTRON_/,
      /^internal:/,
      /^devtools:/
    ]
  }

  validateChannel(channel) {
    // Check blocked patterns
    if (this.blockedPatterns.some(pattern => pattern.test(channel))) {
      throw new Error(`Blocked channel pattern: ${channel}`)
    }
    
    // Check allowed list
    if (!this.allowedChannels.has(channel)) {
      throw new Error(`Channel not in allowlist: ${channel}`)
    }
    
    return true
  }

  validateData(data) {
    // Prevent prototype pollution
    if (data && typeof data === 'object') {
      const dangerous = ['__proto__', 'constructor', 'prototype']
      for (const key of dangerous) {
        if (key in data) {
          throw new Error('Potential prototype pollution detected')
        }
      }
    }
    
    return true
  }
}
```

### 2. Testing Security Boundaries

```javascript
// tests/security/contextIsolation.test.js
describe('Context Isolation Security', () => {
  it('should prevent prototype pollution attacks', async () => {
    const maliciousPayload = {
      __proto__: { isAdmin: true },
      data: 'normal data'
    }
    
    // This should throw in the preload script
    await expect(
      electronAPI.invoke('save-data', maliciousPayload)
    ).rejects.toThrow('prototype pollution')
  })

  it('should prevent access to internal Electron channels', async () => {
    const internalChannels = [
      'ELECTRON_BROWSER_REQUIRE',
      'ELECTRON_BROWSER_GET_BUILTIN'
    ]
    
    for (const channel of internalChannels) {
      await expect(
        electronAPI.sendMessage(channel, {})
      ).rejects.toThrow('Blocked channel pattern')
    }
  })
})
```

### 3. Performance Testing for IPC

```javascript
// tests/performance/ipc.bench.js
import { bench, describe } from 'vitest'

describe('IPC Performance', () => {
  bench('validated IPC call', async () => {
    await electronAPI.invoke('get-user-data', { userId: 1 })
  })

  bench('batch IPC calls', async () => {
    const promises = Array(100).fill(null).map((_, i) => 
      electronAPI.invoke('get-user-data', { userId: i })
    )
    await Promise.all(promises)
  })
})
```

## Summary

The 2025 best practices for Electron preload script security emphasize:

1. **Mandatory Security Features**: Context isolation, sandbox, and secure webPreferences
2. **Minimal API Exposure**: Only expose necessary APIs through contextBridge
3. **Strict Validation**: Validate all IPC messages, channels, and data
4. **Modern Testing**: Use Vitest for unit tests, Playwright for E2E tests
5. **Continuous Security**: Regular audits, automated security testing, and monitoring

By following these guidelines, Electron applications can maintain a strong security posture while providing necessary functionality to renderer processes.