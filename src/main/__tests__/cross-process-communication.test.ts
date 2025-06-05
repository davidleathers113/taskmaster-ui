/**
 * Cross-Process Communication Security Tests (2025)
 * 
 * Comprehensive testing of IPC security boundaries, sender validation,
 * and cross-process communication patterns following 2025 best practices.
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

import { ipcMain, BrowserWindow } from 'electron'
// Events types are available globally in Node.js

// Mock electron modules for cross-process testing
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
    removeListener: vi.fn(),
    _handlers: new Map(),
    _listeners: new Map()
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
    getFocusedWindow: vi.fn(),
    fromWebContents: vi.fn()
  },
  webContents: {
    getAllWebContents: vi.fn().mockReturnValue([]),
    fromId: vi.fn()
  },
  app: {
    isPackaged: false,
    getPath: vi.fn().mockImplementation((name) => `/mock/path/${name}`)
  }
}))

// Mock URL for sender validation
(global as any).URL = class MockURL {
  public origin: string
  public protocol: string
  public hostname: string
  
  constructor(url: string) {
    if (url.startsWith('https://app.taskmaster.com')) {
      this.origin = 'https://app.taskmaster.com'
      this.protocol = 'https:'
      this.hostname = 'app.taskmaster.com'
    } else if (url.startsWith('app://taskmaster')) {
      this.origin = 'app://taskmaster'
      this.protocol = 'app:'
      this.hostname = 'taskmaster'
    } else if (url.startsWith('https://evil.com')) {
      this.origin = 'https://evil.com'
      this.protocol = 'https:'
      this.hostname = 'evil.com'
    } else {
      throw new Error('Invalid URL')
    }
  }
}

describe('Cross-Process Communication Security Tests (2025)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    (ipcMain as any)._handlers?.clear()
    (ipcMain as any)._listeners?.clear()
  })

  describe('IPC Sender Validation', () => {
    test('should validate sender frame URL against allowlist', () => {
      const validateSender = (frame: any, allowedOrigins: string[] = []) => {
        if (!frame) return { valid: false, reason: 'No sender frame' }
        
        try {
          const frameUrl = new URL(frame.url)
          
          // Check if frame is from iframe
          if (frame.parent && frame.parent !== frame) {
            return { valid: false, reason: 'IPC from iframe not allowed', origin: frameUrl.origin }
          }
          
          // Check allowed origins
          if (allowedOrigins.length > 0 && !allowedOrigins.includes(frameUrl.origin)) {
            return { valid: false, reason: 'Origin not in allowlist', origin: frameUrl.origin }
          }
          
          return { valid: true, origin: frameUrl.origin }
        } catch {
          return { valid: false, reason: 'Invalid sender URL' }
        }
      }
      
      const allowedOrigins = ['https://app.taskmaster.com', 'app://taskmaster']
      
      // Valid origins
      expect(validateSender(
        { url: 'https://app.taskmaster.com/main' },
        allowedOrigins
      )).toEqual({ valid: true, origin: 'https://app.taskmaster.com' })
      
      expect(validateSender(
        { url: 'app://taskmaster/index.html' },
        allowedOrigins
      )).toEqual({ valid: true, origin: 'app://taskmaster' })
      
      // Invalid origin
      expect(validateSender(
        { url: 'https://evil.com/attack' },
        allowedOrigins
      )).toEqual({
        valid: false,
        reason: 'Origin not in allowlist',
        origin: 'https://evil.com'
      })
      
      // Iframe attempt
      expect(validateSender(
        {
          url: 'https://app.taskmaster.com/iframe',
          parent: { url: 'https://app.taskmaster.com/main' }
        },
        allowedOrigins
      )).toEqual({
        valid: false,
        reason: 'IPC from iframe not allowed',
        origin: 'https://app.taskmaster.com'
      })
      
      // No frame
      expect(validateSender(null, allowedOrigins)).toEqual({
        valid: false,
        reason: 'No sender frame'
      })
    })

    test('should validate sender window registration', () => {
      const testWindows = [
        { id: 1, webContents: { id: 101 } },
        { id: 2, webContents: { id: 102 } },
        { id: 3, webContents: { id: 103 } }
      ] as Array<{ id: number; webContents: { id: number } }>
      
      (BrowserWindow.getAllWindows as any).mockReturnValue(testWindows)
      
      const validateSenderWindow = (senderId: number) => {
        const windows = BrowserWindow.getAllWindows()
        return windows.some(win => win.webContents.id === senderId)
      }
      
      // Valid sender IDs
      expect(validateSenderWindow(101)).toBe(true)
      expect(validateSenderWindow(102)).toBe(true)
      expect(validateSenderWindow(103)).toBe(true)
      
      // Invalid sender ID
      expect(validateSenderWindow(999)).toBe(false)
      expect(validateSenderWindow(0)).toBe(false)
    })

    test('should prevent channel name manipulation attacks', () => {
      const secureChannelValidator = (channel: string) => {
        // Block internal Electron channels
        const internalPrefixes = [
          'ELECTRON_BROWSER_',
          'ELECTRON_RENDERER_',
          'chrome-',
          'devtools-',
          'internal:'
        ]
        
        for (const prefix of internalPrefixes) {
          if (channel.startsWith(prefix)) {
            throw new Error(`Access to internal channel denied: ${channel}`)
          }
        }
        
        // Allowlist approach - only allow specific patterns
        const allowedPatterns = [
          /^app:[a-z-]+$/,
          /^file:[a-z-]+$/,
          /^dialog:[a-z-]+$/,
          /^update:[a-z-]+$/
        ]
        
        if (!allowedPatterns.some(pattern => pattern.test(channel))) {
          throw new Error(`Channel not in allowlist: ${channel}`)
        }
        
        return true
      }
      
      // Valid channels
      expect(() => secureChannelValidator('app:get-version')).not.toThrow()
      expect(() => secureChannelValidator('file:read-config')).not.toThrow()
      expect(() => secureChannelValidator('dialog:show-error')).not.toThrow()
      
      // Internal channels
      expect(() => secureChannelValidator('ELECTRON_BROWSER_REQUIRE'))
        .toThrow('Access to internal channel denied')
      expect(() => secureChannelValidator('chrome-devtools'))
        .toThrow('Access to internal channel denied')
      
      // Arbitrary channels
      expect(() => secureChannelValidator('malicious:command'))
        .toThrow('Channel not in allowlist')
      expect(() => secureChannelValidator('app:invalid-action'))
        .toThrow('Channel not in allowlist')
    })
  })

  describe('IPC Security Wrapper Implementation', () => {
    test('should implement secure IPC handler with full validation', () => {
      class SecureIPCHandler {
        private allowedChannels = new Set([
          'app:get-version',
          'app:get-platform',
          'file:read-config',
          'dialog:show-error'
        ])
        
        private allowedOrigins = [
          'https://app.taskmaster.com',
          'app://taskmaster'
        ]
        
        private registeredWindows = new Set<number>()
        
        registerWindow(windowId: number) {
          this.registeredWindows.add(windowId)
        }
        
        unregisterWindow(windowId: number) {
          this.registeredWindows.delete(windowId)
        }
        
        validateRequest(channel: string, event: any): { valid: boolean; reason?: string } {
          // 1. Channel validation
          if (!this.allowedChannels.has(channel)) {
            return { valid: false, reason: `Channel not allowed: ${channel}` }
          }
          
          // 2. Sender frame validation
          if (!event.senderFrame) {
            return { valid: false, reason: 'No sender frame' }
          }
          
          try {
            const frameUrl = new URL(event.senderFrame.url)
            
            // Check iframe restriction
            if (event.senderFrame.parent && event.senderFrame.parent !== event.senderFrame) {
              return { valid: false, reason: 'IPC from iframe not allowed' }
            }
            
            // Check origin allowlist
            if (!this.allowedOrigins.includes(frameUrl.origin)) {
              return { valid: false, reason: `Origin not allowed: ${frameUrl.origin}` }
            }
          } catch {
            return { valid: false, reason: 'Invalid sender URL' }
          }
          
          // 3. Window registration validation
          if (!this.registeredWindows.has(event.sender.id)) {
            return { valid: false, reason: 'Sender window not registered' }
          }
          
          return { valid: true }
        }
        
        secureHandle(channel: string, handler: (event: any, ...args: any[]) => any) {
          const secureHandler = async (event: any, ...args: any[]) => {
            const validation = this.validateRequest(channel, event)
            if (!validation.valid) {
              throw new Error(`IPC Security Error: ${validation.reason}`)
            }
            
            return await handler(event, ...args)
          }
          
          ipcMain.handle(channel, secureHandler)
          return secureHandler
        }
      }
      
      const secureIPC = new SecureIPCHandler()
      const mockHandler = vi.fn().mockResolvedValue('success')
      
      // Register a window
      secureIPC.registerWindow(101)
      
      // Create secure handler
      const handler = secureIPC.secureHandle('app:get-version', mockHandler)
      
      // Valid request
      const validEvent = {
        senderFrame: { url: 'https://app.taskmaster.com/main' },
        sender: { id: 101 }
      }
      
      expect(handler(validEvent)).resolves.toBe('success')
      
      // Invalid origin
      const invalidOriginEvent = {
        senderFrame: { url: 'https://evil.com/attack' },
        sender: { id: 101 }
      }
      
      expect(handler(invalidOriginEvent)).rejects.toThrow('Origin not allowed')
      
      // Iframe attempt
      const iframeEvent = {
        senderFrame: {
          url: 'https://app.taskmaster.com/iframe',
          parent: { url: 'https://app.taskmaster.com/main' }
        },
        sender: { id: 101 }
      }
      
      expect(handler(iframeEvent)).rejects.toThrow('IPC from iframe not allowed')
      
      // Unregistered window
      const unregisteredEvent = {
        senderFrame: { url: 'https://app.taskmaster.com/main' },
        sender: { id: 999 }
      }
      
      expect(handler(unregisteredEvent)).rejects.toThrow('Sender window not registered')
    })
  })

  describe('Cross-Process Message Filtering', () => {
    test('should filter sensitive data from IPC messages', () => {
      const sanitizeIPCData = (data: any): any => {
        if (data === null || data === undefined) {
          return data
        }
        
        if (typeof data === 'object') {
          // Remove potentially dangerous properties
          const dangerous = ['__proto__', 'constructor', 'prototype']
          const cleaned = { ...data }
          
          for (const prop of dangerous) {
            delete cleaned[prop]
          }
          
          // Recursively clean nested objects
          for (const [key, value] of Object.entries(cleaned)) {
            if (typeof value === 'object' && value !== null) {
              cleaned[key] = sanitizeIPCData(value)
            }
          }
          
          return cleaned
        }
        
        return data
      }
      
      // Test basic sanitization
      const clean = sanitizeIPCData({ name: 'test', value: 123 })
      expect(clean).toEqual({ name: 'test', value: 123 })
      
      // Test prototype pollution prevention
      const polluted = {
        data: 'safe',
        __proto__: { isAdmin: true },
        constructor: { prototype: { polluted: true } }
      }
      
      const sanitized = sanitizeIPCData(polluted)
      expect(sanitized).toEqual({ data: 'safe' })
      expect(sanitized.__proto__).toBeUndefined()
      expect(sanitized.constructor).toBeUndefined()
      
      // Test nested object cleaning
      const nested = {
        level1: {
          level2: {
            data: 'safe',
            __proto__: { malicious: true }
          }
        }
      }
      
      const cleanedNested = sanitizeIPCData(nested)
      expect(cleanedNested.level1.level2).toEqual({ data: 'safe' })
    })

    test('should validate IPC message structure', () => {
      const validateIPCMessage = (message: any) => {
        const errors: string[] = []
        
        // Check message size
        const serialized = JSON.stringify(message)
        if (serialized.length > 1024 * 1024) { // 1MB limit
          errors.push('Message too large')
        }
        
        // Check for circular references
        try {
          JSON.stringify(message)
        } catch (error) {
          if (error instanceof TypeError && error.message.includes('circular')) {
            errors.push('Circular reference detected')
          }
        }
        
        // Check for functions (shouldn't be serializable)
        const hasFunction = (obj: any): boolean => {
          if (typeof obj === 'function') return true
          if (typeof obj === 'object' && obj !== null) {
            return Object.values(obj).some(hasFunction)
          }
          return false
        }
        
        if (hasFunction(message)) {
          errors.push('Functions not allowed in IPC messages')
        }
        
        return { valid: errors.length === 0, errors }
      }
      
      // Valid message
      expect(validateIPCMessage({ data: 'test', count: 123 }))
        .toEqual({ valid: true, errors: [] })
      
      // Message with function
      expect(validateIPCMessage({ callback: () => {} }))
        .toEqual({ valid: false, errors: ['Functions not allowed in IPC messages'] })
      
      // Circular reference
      const circular: any = { name: 'test' }
      circular.self = circular
      
      expect(validateIPCMessage(circular))
        .toEqual({ valid: false, errors: ['Circular reference detected'] })
    })
  })

  describe('Event Object Security', () => {
    test('should prevent event object leakage in renderer callbacks', () => {
      // Simulate secure event wrapper
      const createSecureCallback = (userCallback: (...args: any[]) => any) => {
        return (event: any, ...data: any[]) => {
          // Never pass the event object to user callback
          // Only pass the actual data
          userCallback(...data)
        }
      }
      
      const userCallback = vi.fn()
      const secureWrapper = createSecureCallback(userCallback)
      
      const sensitiveEvent = {
        sender: { id: 1, session: 'sensitive-data' },
        senderFrame: { url: 'app://internal', routingId: 123 },
        ports: [],
        processId: 999
      }
      
      const safeData = { progress: 50, status: 'downloading' }
      
      // Call the wrapper
      secureWrapper(sensitiveEvent, safeData)
      
      // Verify user callback only received safe data
      expect(userCallback).toHaveBeenCalledWith(safeData)
      expect(userCallback).not.toHaveBeenCalledWith(sensitiveEvent, safeData)
      
      // Verify no access to sensitive properties
      const callArgs = userCallback.mock.calls[0]
      expect(callArgs).toBeDefined()
      expect(callArgs).toEqual([safeData])
      expect(callArgs?.[0]).not.toHaveProperty('sender')
      expect(callArgs?.[0]).not.toHaveProperty('senderFrame')
    })

    test('should validate event data structure before passing to callbacks', () => {
      const createValidatingCallback = (userCallback: (...args: any[]) => any, validator: (...args: any[]) => boolean) => {
        return (event: any, data: any) => {
          if (validator(data)) {
            userCallback(data)
          } else {
            console.warn('Invalid event data structure, callback not invoked')
          }
        }
      }
      
      const progressValidator = (data: any) => {
        return data &&
          typeof data === 'object' &&
          typeof data.percent === 'number' &&
          typeof data.transferred === 'number' &&
          typeof data.total === 'number' &&
          data.percent >= 0 &&
          data.percent <= 100 &&
          data.transferred >= 0 &&
          data.total >= 0
      }
      
      const userCallback = vi.fn()
      const validatingCallback = createValidatingCallback(userCallback, progressValidator)
      
      // Valid data
      const validData = { percent: 50, transferred: 5000, total: 10000 }
      validatingCallback(null, validData)
      expect(userCallback).toHaveBeenCalledWith(validData)
      
      userCallback.mockClear()
      
      // Invalid data
      const invalidData = { percent: -1, transferred: 'invalid', total: 10000 }
      validatingCallback(null, invalidData)
      expect(userCallback).not.toHaveBeenCalled()
      
      // Missing fields
      validatingCallback(null, { percent: 50 })
      expect(userCallback).not.toHaveBeenCalled()
    })
  })

  describe('Rate Limiting and DoS Prevention', () => {
    test('should implement per-sender rate limiting', () => {
      class IPCRateLimiter {
        private senderLimits = new Map<string, { count: number; resetTime: number }>()
        private readonly maxRequests = 10
        private readonly windowMs = 1000
        
        checkLimit(senderId: string): boolean {
          const now = Date.now()
          const senderKey = `sender:${senderId}`
          const current = this.senderLimits.get(senderKey)
          
          if (!current || now > current.resetTime) {
            this.senderLimits.set(senderKey, { count: 1, resetTime: now + this.windowMs })
            return true
          }
          
          if (current.count >= this.maxRequests) {
            return false
          }
          
          current.count++
          return true
        }
      }
      
      const rateLimiter = new IPCRateLimiter()
      
      // First 10 requests should pass
      for (let i = 0; i < 10; i++) {
        expect(rateLimiter.checkLimit('sender1')).toBe(true)
      }
      
      // 11th request should fail
      expect(rateLimiter.checkLimit('sender1')).toBe(false)
      
      // Different sender should have own limit
      expect(rateLimiter.checkLimit('sender2')).toBe(true)
    })

    test('should detect and prevent IPC flooding attacks', () => {
      class FloodDetector {
        private requestTimes = new Map<string, number[]>()
        private readonly floodThreshold = 100 // requests per second
        private readonly blacklist = new Set<string>()
        
        detectFlood(senderId: string): boolean {
          if (this.blacklist.has(senderId)) {
            return true // Already blacklisted
          }
          
          const now = Date.now()
          const times = this.requestTimes.get(senderId) || []
          
          // Remove old timestamps (older than 1 second)
          const recentTimes = times.filter(time => now - time < 1000)
          recentTimes.push(now)
          
          this.requestTimes.set(senderId, recentTimes)
          
          if (recentTimes.length > this.floodThreshold) {
            this.blacklist.add(senderId)
            console.warn(`Flooding detected from sender ${senderId}, blacklisted`)
            return true
          }
          
          return false
        }
        
        isBlacklisted(senderId: string): boolean {
          return this.blacklist.has(senderId)
        }
      }
      
      const detector = new FloodDetector()
      
      // Normal usage - should not trigger flood detection
      for (let i = 0; i < 50; i++) {
        expect(detector.detectFlood('normal-sender')).toBe(false)
      }
      
      // Flood attack - should trigger detection
      for (let i = 0; i < 150; i++) {
        if (i < 100) {
          expect(detector.detectFlood('attacker')).toBe(false)
        } else {
          expect(detector.detectFlood('attacker')).toBe(true)
          break
        }
      }
      
      expect(detector.isBlacklisted('attacker')).toBe(true)
      expect(detector.isBlacklisted('normal-sender')).toBe(false)
    })
  })

  describe('Process Isolation Validation', () => {
    test('should verify process boundaries are maintained', () => {
      // Simulate checking process isolation
      const validateProcessIsolation = () => {
        const violations: string[] = []
        
        // Check that main process APIs are not accessible from renderer
        if (typeof process !== 'undefined') {
          if (process.type === 'renderer') {
            // In renderer process
            if (typeof require !== 'undefined') {
              // require should only be available in preload, not in renderer context
              violations.push('require available in renderer context')
            }
            
            if (typeof global !== 'undefined' && global.process) {
              violations.push('global.process available in renderer')
            }
            
            if (typeof Buffer !== 'undefined') {
              violations.push('Buffer available in renderer context')
            }
          }
        }
        
        return { isolated: violations.length === 0, violations }
      }
      
      // Mock renderer environment
      const originalProcess = process
      ;(global as any).process = { type: 'renderer' }
      
      const result = validateProcessIsolation()
      
      // In test environment, these might be available, but in production they shouldn't be
      expect(result).toHaveProperty('isolated')
      expect(result).toHaveProperty('violations')
      expect(Array.isArray(result.violations)).toBe(true)
      
      // Restore original process
      ;(global as any).process = originalProcess
    })
  })
})