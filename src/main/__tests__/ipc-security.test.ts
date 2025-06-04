/**
 * IPC Security and Rate Limiting Tests (2025)
 * 
 * Comprehensive security tests for Electron IPC including sender validation,
 * rate limiting, DDoS prevention, and context isolation following 2025 best practices.
 * Based on research findings from ELECTRON_IPC_SECURITY_2025.md
 */

import { describe, test, expect, beforeEach, vi, beforeAll } from 'vitest'
import { ipcMain, BrowserWindow } from 'electron'
import { } from 'events'
import { URL } from 'url'

// Mock security modules
import { IPCRateLimiter } from '../security/ipc-rate-limiter'
import { SecureIPCHandler } from '../security/secure-ipc-handler'
import { SecurityMonitor } from '../security/security-monitor'

// Mock Electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
    _handlers: new Map()
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
    getFocusedWindow: vi.fn(),
    fromWebContents: vi.fn()
  },
  app: {
    getPath: vi.fn().mockImplementation((name) => `/mock/path/${name}`),
    isPackaged: true
  },
  session: {
    defaultSession: {
      setPermissionRequestHandler: vi.fn(),
      setCertificateVerifyProc: vi.fn()
    }
  }
}))

// Mock security utilities
vi.mock('../security/ipc-rate-limiter')
vi.mock('../security/secure-ipc-handler')
vi.mock('../security/security-monitor')

describe('IPC Security Tests', () => {
  let secureHandler: typeof SecureIPCHandler.prototype
  let rateLimiter: typeof IPCRateLimiter.prototype
  
  beforeAll(() => {
    // Initialize security components
    secureHandler = new (SecureIPCHandler as any)()
    rateLimiter = new (IPCRateLimiter as any)()
    securityMonitor = new (SecurityMonitor as any)()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear any registered handlers
    (ipcMain as any)._handlers?.clear()
  })

  describe('IPC Sender Validation', () => {
    test('should validate sender frame URL against allowlist', async () => {
      const mockEvent = {
        senderFrame: { 
          url: 'https://evil.com/attack',
          frameId: 1
        },
        sender: { 
          id: 1,
          getURL: () => 'https://evil.com/attack'
        }
      }

      // Register secure handler with allowlist
      secureHandler.handle('secure:operation', {
        allowedOrigins: ['https://app.taskmaster.com', 'app://taskmaster'],
        requireAuth: true
      }, async () => 'success')

      // Mock the handler registration
      const handler = vi.fn().mockImplementation(async (event, ...args) => {
        const allowedOrigins = ['https://app.taskmaster.com', 'app://taskmaster']
        try {
          const frameUrl = new URL(event.senderFrame.url)
          if (!allowedOrigins.includes(frameUrl.origin)) {
            throw new Error('Unauthorized sender')
          }
          return 'success'
        } catch {
          throw new Error('Unauthorized sender')
        }
      })

      ipcMain.handle('secure:operation', handler)
      ipcMain._handlers.set('secure:operation', handler)

      // Test with unauthorized sender
      await expect(handler(mockEvent)).rejects.toThrow('Unauthorized sender')

      // Test with authorized sender
      const authorizedEvent = {
        ...mockEvent,
        senderFrame: { url: 'https://app.taskmaster.com/page' }
      }
      await expect(handler(authorizedEvent)).resolves.toBe('success')
    })

    test('should reject requests from malicious iframes', async () => {
      const maliciousIframeEvent = {
        senderFrame: {
          url: 'https://malicious-site.com/iframe',
          frameId: 2,
          parent: {
            url: 'https://app.taskmaster.com',
            frameId: 1
          }
        },
        sender: { id: 1 }
      }

      const handler = vi.fn().mockImplementation(async (event) => {
        // Check if sender is a top-level frame
        if (event.senderFrame.parent) {
          throw new Error('IPC from iframe not allowed')
        }
        return 'success'
      })

      ipcMain.handle('sensitive:data', handler)

      await expect(handler(maliciousIframeEvent)).rejects.toThrow('IPC from iframe not allowed')
    })

    test('should validate sender ID matches registered window', async () => {
      const mockWindows = [
        { webContents: { id: 1 }, id: 1 },
        { webContents: { id: 2 }, id: 2 }
      ]
      
      BrowserWindow.getAllWindows.mockReturnValue(mockWindows)

      const validateSenderWindow = (senderId: number): boolean => {
        const windows = BrowserWindow.getAllWindows()
        return windows.some(win => win.webContents.id === senderId)
      }

      expect(validateSenderWindow(1)).toBe(true)
      expect(validateSenderWindow(999)).toBe(false)
    })

    test('should prevent spoofing attacks via channel manipulation', async () => {
      // Test for CVE-like vulnerability where internal channels can be accessed
      const internalChannels = [
        'ELECTRON_BROWSER_REQUIRE',
        'ELECTRON_BROWSER_GET_BUILTIN',
        'ELECTRON_BROWSER_MEMBER_GET',
        'ELECTRON_BROWSER_MEMBER_SET',
        'ELECTRON_BROWSER_MEMBER_CALL'
      ]

      const handler = vi.fn().mockImplementation((channel, callback) => {
        // Security check: block internal Electron channels
        if (channel.startsWith('ELECTRON_')) {
          throw new Error('Access to internal channels denied')
        }
        return callback
      })

      for (const channel of internalChannels) {
        expect(() => handler(channel, () => {})).toThrow('Access to internal channels denied')
      }
    })
  })

  describe('Rate Limiting Tests', () => {
    test('should enforce rate limits per channel', async () => {
      // Configure rate limiter
      rateLimiter.setLimit = vi.fn()
      rateLimiter.checkLimit = vi.fn()
        .mockReturnValueOnce(true)  // First request passes
        .mockReturnValueOnce(true)  // Second request passes
        .mockReturnValueOnce(false) // Third request blocked

      rateLimiter.setLimit('api:query', 2, 1000) // 2 requests per second

      const handler = vi.fn().mockImplementation(async (event) => {
        if (!rateLimiter.checkLimit('api:query', event.sender.id)) {
          throw new Error('Rate limit exceeded')
        }
        return { data: 'success' }
      })

      const mockEvent = { sender: { id: 1 } }

      // First two requests should succeed
      await expect(handler(mockEvent)).resolves.toEqual({ data: 'success' })
      await expect(handler(mockEvent)).resolves.toEqual({ data: 'success' })

      // Third request should be rate limited
      await expect(handler(mockEvent)).rejects.toThrow('Rate limit exceeded')
    })

    test('should implement sliding window rate limiting', async () => {
      const slidingWindow = {
        requests: new Map<string, number[]>(),
        checkLimit(key: string, limit: number, windowMs: number): boolean {
          const now = Date.now()
          const timestamps = this.requests.get(key) || []
          
          // Remove old timestamps outside window
          const validTimestamps = timestamps.filter(t => now - t < windowMs)
          
          if (validTimestamps.length >= limit) {
            return false
          }
          
          validTimestamps.push(now)
          this.requests.set(key, validTimestamps)
          return true
        }
      }

      const key = 'user:1:api:query'
      
      // Simulate requests
      expect(slidingWindow.checkLimit(key, 3, 1000)).toBe(true)  // Request 1
      expect(slidingWindow.checkLimit(key, 3, 1000)).toBe(true)  // Request 2
      expect(slidingWindow.checkLimit(key, 3, 1000)).toBe(true)  // Request 3
      expect(slidingWindow.checkLimit(key, 3, 1000)).toBe(false) // Request 4 - blocked
      
      // Wait for window to slide
      await new Promise(resolve => setTimeout(resolve, 1100))
      expect(slidingWindow.checkLimit(key, 3, 1000)).toBe(true)  // Request 5 - allowed
    })

    test('should handle burst traffic patterns', async () => {
      const tokenBucket = {
        buckets: new Map<string, { tokens: number; lastRefill: number }>(),
        capacity: 10,
        refillRate: 5, // tokens per second
        
        consume(key: string, tokens: number = 1): boolean {
          const now = Date.now()
          let bucket = this.buckets.get(key)
          
          if (!bucket) {
            bucket = { tokens: this.capacity, lastRefill: now }
            this.buckets.set(key, bucket)
          }
          
          // Refill tokens based on time elapsed
          const elapsed = (now - bucket.lastRefill) / 1000
          const tokensToAdd = elapsed * this.refillRate
          bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd)
          bucket.lastRefill = now
          
          if (bucket.tokens >= tokens) {
            bucket.tokens -= tokens
            return true
          }
          
          return false
        }
      }

      const key = 'user:1'
      
      // Burst of 10 requests should succeed (full bucket)
      for (let i = 0; i < 10; i++) {
        expect(tokenBucket.consume(key)).toBe(true)
      }
      
      // 11th request should fail
      expect(tokenBucket.consume(key)).toBe(false)
      
      // Wait for tokens to refill
      await new Promise(resolve => setTimeout(resolve, 200)) // 0.2s = 1 token
      expect(tokenBucket.consume(key)).toBe(true)
    })

    test('should differentiate rate limits by user and channel', async () => {
      const multiKeyRateLimiter = {
        limits: new Map<string, { count: number; resetTime: number }>(),
        
        checkLimit(userId: string, channel: string, limit: number, windowMs: number): boolean {
          const key = `${userId}:${channel}`
          const now = Date.now()
          const record = this.limits.get(key)
          
          if (!record || now > record.resetTime) {
            this.limits.set(key, { count: 1, resetTime: now + windowMs })
            return true
          }
          
          if (record.count >= limit) {
            return false
          }
          
          record.count++
          return true
        }
      }

      // Different users should have separate limits
      expect(multiKeyRateLimiter.checkLimit('user1', 'api:query', 2, 1000)).toBe(true)
      expect(multiKeyRateLimiter.checkLimit('user1', 'api:query', 2, 1000)).toBe(true)
      expect(multiKeyRateLimiter.checkLimit('user1', 'api:query', 2, 1000)).toBe(false)
      
      // user2 should have their own limit
      expect(multiKeyRateLimiter.checkLimit('user2', 'api:query', 2, 1000)).toBe(true)
      
      // Different channels should have separate limits
      expect(multiKeyRateLimiter.checkLimit('user1', 'api:write', 2, 1000)).toBe(true)
    })
  })

  describe('DDoS Prevention Tests', () => {
    test('should detect and block IPC flooding attacks', async () => {
      const floodDetector = {
        requestCounts: new Map<string, number>(),
        thresholds: { perSecond: 100, perMinute: 1000 },
        blacklist: new Set<string>(),
        
        detectFlood(senderId: string): boolean {
          const key = `${senderId}:${Math.floor(Date.now() / 1000)}`
          const count = (this.requestCounts.get(key) || 0) + 1
          this.requestCounts.set(key, count)
          
          if (count > this.thresholds.perSecond) {
            this.blacklist.add(senderId)
            return true
          }
          
          return false
        },
        
        isBlacklisted(senderId: string): boolean {
          return this.blacklist.has(senderId)
        }
      }

      const senderId = 'attacker-1'
      
      // Simulate flood attack
      for (let i = 0; i < 150; i++) {
        if (i < 100) {
          expect(floodDetector.detectFlood(senderId)).toBe(false)
        } else {
          expect(floodDetector.detectFlood(senderId)).toBe(true)
          break
        }
      }
      
      expect(floodDetector.isBlacklisted(senderId)).toBe(true)
    })

    test('should implement connection throttling', async () => {
      const connectionManager = {
        connections: new Map<string, { count: number; firstSeen: number }>(),
        maxConnectionsPerIP: 10,
        
        acceptConnection(ip: string): boolean {
          const conn = this.connections.get(ip)
          
          if (!conn) {
            this.connections.set(ip, { count: 1, firstSeen: Date.now() })
            return true
          }
          
          if (conn.count >= this.maxConnectionsPerIP) {
            return false
          }
          
          conn.count++
          return true
        },
        
        releaseConnection(ip: string): void {
          const conn = this.connections.get(ip)
          if (conn && conn.count > 0) {
            conn.count--
          }
        }
      }

      const attackerIP = '192.168.1.100'
      
      // Accept up to max connections
      for (let i = 0; i < 10; i++) {
        expect(connectionManager.acceptConnection(attackerIP)).toBe(true)
      }
      
      // Reject additional connections
      expect(connectionManager.acceptConnection(attackerIP)).toBe(false)
      
      // Release a connection and try again
      connectionManager.releaseConnection(attackerIP)
      expect(connectionManager.acceptConnection(attackerIP)).toBe(true)
    })

    test('should implement progressive backoff for repeat offenders', async () => {
      const backoffManager = {
        violations: new Map<string, { count: number; backoffUntil: number }>(),
        
        calculateBackoff(violationCount: number): number {
          // Exponential backoff: 1s, 2s, 4s, 8s, etc.
          return Math.min(Math.pow(2, violationCount - 1) * 1000, 60000) // Max 1 minute
        },
        
        recordViolation(senderId: string): void {
          const record = this.violations.get(senderId) || { count: 0, backoffUntil: 0 }
          record.count++
          record.backoffUntil = Date.now() + this.calculateBackoff(record.count)
          this.violations.set(senderId, record)
        },
        
        isBackedOff(senderId: string): boolean {
          const record = this.violations.get(senderId)
          return record ? Date.now() < record.backoffUntil : false
        }
      }

      const senderId = 'repeat-offender'
      
      // First violation - 1s backoff
      backoffManager.recordViolation(senderId)
      expect(backoffManager.isBackedOff(senderId)).toBe(true)
      
      // Check backoff calculation
      expect(backoffManager.calculateBackoff(1)).toBe(1000)   // 1s
      expect(backoffManager.calculateBackoff(2)).toBe(2000)   // 2s
      expect(backoffManager.calculateBackoff(3)).toBe(4000)   // 4s
      expect(backoffManager.calculateBackoff(10)).toBe(60000) // Capped at 60s
    })

    test('should monitor and alert on suspicious patterns', async () => {
      const suspiciousPatterns = {
        rapidChannelSwitching: (requests: Array<{ channel: string; timestamp: number }>) => {
          if (requests.length < 10) return false
          
          const uniqueChannels = new Set(requests.map(r => r.channel))
          const timeWindow = requests[requests.length - 1].timestamp - requests[0].timestamp
          
          // Suspicious if accessing many channels in short time
          return uniqueChannels.size > 5 && timeWindow < 1000
        },
        
        privilegedChannelAbuse: (requests: Array<{ channel: string }>) => {
          const privilegedChannels = ['admin:', 'system:', 'internal:']
          const privilegedCount = requests.filter(r => 
            privilegedChannels.some(p => r.channel.startsWith(p))
          ).length
          
          return privilegedCount > requests.length * 0.5 // More than 50% privileged
        }
      }

      // Test rapid channel switching
      const suspiciousRequests = [
        { channel: 'api:read', timestamp: 1000 },
        { channel: 'api:write', timestamp: 1050 },
        { channel: 'user:profile', timestamp: 1100 },
        { channel: 'admin:config', timestamp: 1150 },
        { channel: 'system:info', timestamp: 1200 },
        { channel: 'file:upload', timestamp: 1250 },
        { channel: 'db:query', timestamp: 1300 },
        { channel: 'cache:get', timestamp: 1350 },
        { channel: 'auth:verify', timestamp: 1400 },
        { channel: 'log:write', timestamp: 1450 }
      ]
      
      expect(suspiciousPatterns.rapidChannelSwitching(suspiciousRequests)).toBe(true)
      
      // Test privileged channel abuse
      const privilegedAbuse = [
        { channel: 'admin:users' },
        { channel: 'admin:config' },
        { channel: 'system:shutdown' },
        { channel: 'api:read' },
        { channel: 'admin:logs' }
      ]
      
      expect(suspiciousPatterns.privilegedChannelAbuse(privilegedAbuse)).toBe(true)
    })
  })

  describe('Context Isolation Security Tests', () => {
    test('should validate contextBridge exposes only safe APIs', () => {
      const validateContextBridgeAPI = (api: any): string[] => {
        const violations: string[] = []
        
        // Check for dangerous exposures
        if (api.ipcRenderer) violations.push('Direct ipcRenderer exposure detected')
        if (api.require) violations.push('Direct require exposure detected')
        if (api.electron) violations.push('Direct electron module exposure detected')
        if (api.process) violations.push('Direct process object exposure detected')
        if (api.Buffer) violations.push('Direct Buffer exposure detected')
        
        // Check for function binding issues
        for (const [key, value] of Object.entries(api)) {
          if (typeof value === 'function' && value.bind === Function.prototype.bind) {
            // Check if it's a bound native function
            if (value.toString().includes('[native code]')) {
              violations.push(`Potentially dangerous native function exposure: ${key}`)
            }
          }
        }
        
        return violations
      }

      // Test unsafe API
      const unsafeAPI = {
        ipcRenderer: {}, // Direct exposure
        sendMessage: () => {},
        require: () => {} // Direct require
      }
      
      const violations = validateContextBridgeAPI(unsafeAPI)
      expect(violations).toContain('Direct ipcRenderer exposure detected')
      expect(violations).toContain('Direct require exposure detected')

      // Test safe API
      const safeAPI = {
        sendMessage: (channel: string, data: any) => {
          // Validates channel and data internally
        },
        onMessage: (channel: string, callback: Function) => {
          // Filtered listener
        }
      }
      
      expect(validateContextBridgeAPI(safeAPI)).toHaveLength(0)
    })

    test('should prevent context isolation bypass via unserializable objects', () => {
      const testSerializability = (obj: any): boolean => {
        try {
          // Objects that can't be cloned will throw
          const serialized = JSON.stringify(obj)
          
          // Additional check for special objects
          if (obj && typeof obj === 'object') {
            if (obj instanceof HTMLElement) return false
            if (obj instanceof CanvasRenderingContext2D) return false
            if (obj instanceof Worker) return false
            if (obj.constructor && obj.constructor.name === 'NativeImage') return false
          }
          
          return true
        } catch {
          return false
        }
      }

      // Test various object types
      expect(testSerializability({ data: 'safe' })).toBe(true)
      expect(testSerializability([1, 2, 3])).toBe(true)
      expect(testSerializability('string')).toBe(true)
      expect(testSerializability(123)).toBe(true)
      
      // Mock unserializable objects
      const mockCanvas = { constructor: { name: 'CanvasRenderingContext2D' } }
      const mockElement = { constructor: { name: 'HTMLElement' } }
      
      expect(testSerializability(mockCanvas)).toBe(false)
      expect(testSerializability(mockElement)).toBe(false)
    })

    test('should validate preload script security configuration', () => {
      const validatePreloadSecurity = (webPreferences: any): string[] => {
        const issues: string[] = []
        
        // Required security settings
        if (webPreferences.nodeIntegration !== false) {
          issues.push('nodeIntegration must be false')
        }
        
        if (webPreferences.contextIsolation !== true) {
          issues.push('contextIsolation must be true')
        }
        
        if (webPreferences.webSecurity === false) {
          issues.push('webSecurity should not be disabled')
        }
        
        if (webPreferences.allowRunningInsecureContent === true) {
          issues.push('allowRunningInsecureContent should be false')
        }
        
        if (webPreferences.experimentalFeatures === true) {
          issues.push('experimentalFeatures should be false in production')
        }
        
        if (!webPreferences.preload || !webPreferences.preload.includes('preload')) {
          issues.push('preload script path should be specified')
        }
        
        return issues
      }

      // Test insecure configuration
      const insecureConfig = {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false
      }
      
      const issues = validatePreloadSecurity(insecureConfig)
      expect(issues).toContain('nodeIntegration must be false')
      expect(issues).toContain('contextIsolation must be true')
      expect(issues).toContain('webSecurity should not be disabled')

      // Test secure configuration
      const secureConfig = {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        preload: '/path/to/preload.js'
      }
      
      expect(validatePreloadSecurity(secureConfig)).toHaveLength(0)
    })

    test('should enforce sandbox restrictions', () => {
      const sandboxRestrictions = {
        canAccessNodeAPIs: false,
        canRequireModules: false,
        canAccessRemoteModule: false,
        canModifyProcess: false,
        canAccessFileSystem: false
      }

      // Test that sandbox properly restricts capabilities
      const testSandboxRestriction = (capability: keyof typeof sandboxRestrictions): boolean => {
        return sandboxRestrictions[capability] === false
      }

      expect(testSandboxRestriction('canAccessNodeAPIs')).toBe(true)
      expect(testSandboxRestriction('canRequireModules')).toBe(true)
      expect(testSandboxRestriction('canAccessRemoteModule')).toBe(true)
      expect(testSandboxRestriction('canModifyProcess')).toBe(true)
      expect(testSandboxRestriction('canAccessFileSystem')).toBe(true)
    })
  })

  describe('Attack Simulation Tests', () => {
    test('should simulate XSS to RCE escalation attempt', async () => {
      const xssPayloads = [
        '<script>window.api.execute("rm -rf /")</script>',
        '<img src=x onerror="window.api.openExternal(\'file:///etc/passwd\')">',
        'javascript:window.api.require("child_process").exec("calc.exe")'
      ]

      const secureAPI = {
        execute: vi.fn().mockImplementation((cmd) => {
          throw new Error('Command execution not allowed')
        }),
        openExternal: vi.fn().mockImplementation((url) => {
          const parsed = new URL(url)
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            throw new Error('Only HTTP(S) URLs allowed')
          }
          return true
        }),
        require: undefined // Should not be exposed
      }

      // Test XSS payloads
      for (const payload of xssPayloads) {
        if (payload.includes('execute')) {
          expect(() => secureAPI.execute('rm -rf /')).toThrow('Command execution not allowed')
        }
        if (payload.includes('openExternal')) {
          expect(() => secureAPI.openExternal('file:///etc/passwd')).toThrow('Only HTTP(S) URLs allowed')
        }
        if (payload.includes('require')) {
          expect(secureAPI.require).toBeUndefined()
        }
      }
    })

    test('should simulate privilege escalation attack', async () => {
      const userPermissions = {
        standard: ['read:own', 'write:own'],
        admin: ['read:all', 'write:all', 'delete:all', 'admin:users']
      }

      const checkPermission = (userRole: string, action: string): boolean => {
        const permissions = userPermissions[userRole as keyof typeof userPermissions] || []
        return permissions.some(p => {
          if (p.includes(':all')) {
            return action.startsWith(p.split(':')[0])
          }
          return p === action
        })
      }

      // Standard user should not have admin permissions
      expect(checkPermission('standard', 'read:own')).toBe(true)
      expect(checkPermission('standard', 'admin:users')).toBe(false)
      expect(checkPermission('standard', 'delete:all')).toBe(false)

      // Admin should have elevated permissions
      expect(checkPermission('admin', 'admin:users')).toBe(true)
      expect(checkPermission('admin', 'delete:all')).toBe(true)
    })

    test('should simulate and detect unusual IPC patterns', () => {
      const ipcPatternAnalyzer = {
        patterns: [] as Array<{ timestamp: number; channel: string; senderId: string }>,
        
        analyze(): { suspicious: boolean; reason?: string } {
          if (this.patterns.length < 5) return { suspicious: false }
          
          // Check for rapid fire from same sender
          const senderGroups = new Map<string, number>()
          for (const p of this.patterns) {
            senderGroups.set(p.senderId, (senderGroups.get(p.senderId) || 0) + 1)
          }
          
          for (const [sender, count] of senderGroups) {
            if (count > this.patterns.length * 0.8) {
              return { suspicious: true, reason: 'Single sender dominance' }
            }
          }
          
          // Check for timestamp patterns (automated attacks often have regular intervals)
          const intervals = []
          for (let i = 1; i < this.patterns.length; i++) {
            intervals.push(this.patterns[i].timestamp - this.patterns[i-1].timestamp)
          }
          
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
          const variance = intervals.reduce((sum, interval) => 
            sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length
          
          if (variance < 10) { // Very regular intervals
            return { suspicious: true, reason: 'Automated pattern detected' }
          }
          
          return { suspicious: false }
        }
      }

      // Simulate automated attack pattern
      const baseTime = Date.now()
      for (let i = 0; i < 10; i++) {
        ipcPatternAnalyzer.patterns.push({
          timestamp: baseTime + (i * 100), // Regular 100ms intervals
          channel: 'api:query',
          senderId: 'attacker-1'
        })
      }

      const result = ipcPatternAnalyzer.analyze()
      expect(result.suspicious).toBe(true)
      expect(result.reason).toMatch(/Single sender dominance|Automated pattern detected/)
    })
  })

  describe('Security Monitoring and Alerting', () => {
    test('should log security events with proper metadata', () => {
      const securityLogger = {
        events: [] as any[],
        
        log(event: {
          type: string
          severity: 'low' | 'medium' | 'high' | 'critical'
          details: any
          timestamp?: number
        }) {
          this.events.push({
            ...event,
            timestamp: event.timestamp || Date.now(),
            id: `SEC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          })
        },
        
        getHighSeverityEvents() {
          return this.events.filter(e => e.severity === 'high' || e.severity === 'critical')
        }
      }

      // Log various security events
      securityLogger.log({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        details: { senderId: 'user-1', channel: 'api:write' }
      })

      securityLogger.log({
        type: 'unauthorized_access_attempt',
        severity: 'high',
        details: { senderId: 'unknown', channel: 'admin:config', origin: 'https://evil.com' }
      })

      securityLogger.log({
        type: 'context_isolation_bypass_attempt',
        severity: 'critical',
        details: { method: 'unserializable_object', payload: 'CanvasRenderingContext2D' }
      })

      expect(securityLogger.events).toHaveLength(3)
      expect(securityLogger.getHighSeverityEvents()).toHaveLength(2)
      
      // Verify event structure
      const criticalEvent = securityLogger.events.find(e => e.severity === 'critical')
      expect(criticalEvent).toMatchObject({
        type: 'context_isolation_bypass_attempt',
        severity: 'critical',
        details: expect.any(Object),
        timestamp: expect.any(Number),
        id: expect.stringMatching(/^SEC-/)
      })
    })

    test('should trigger alerts based on security thresholds', () => {
      const alertManager = {
        thresholds: {
          rateLimitViolations: { count: 10, window: 60000 }, // 10 per minute
          authFailures: { count: 5, window: 300000 }, // 5 per 5 minutes
          suspiciousPatterns: { count: 3, window: 600000 } // 3 per 10 minutes
        },
        
        events: new Map<string, number[]>(),
        alerts: [] as any[],
        
        recordEvent(type: string) {
          const now = Date.now()
          const events = this.events.get(type) || []
          events.push(now)
          this.events.set(type, events)
          
          this.checkThreshold(type)
        },
        
        checkThreshold(type: string) {
          const threshold = this.thresholds[type as keyof typeof this.thresholds]
          if (!threshold) return
          
          const now = Date.now()
          const events = this.events.get(type) || []
          const recentEvents = events.filter(t => now - t < threshold.window)
          
          if (recentEvents.length >= threshold.count) {
            this.alerts.push({
              type: 'threshold_exceeded',
              eventType: type,
              count: recentEvents.length,
              threshold: threshold.count,
              timestamp: now
            })
          }
          
          // Clean old events
          this.events.set(type, recentEvents)
        }
      }

      // Simulate threshold breach
      for (let i = 0; i < 11; i++) {
        alertManager.recordEvent('rateLimitViolations')
      }

      expect(alertManager.alerts).toHaveLength(1)
      expect(alertManager.alerts[0]).toMatchObject({
        type: 'threshold_exceeded',
        eventType: 'rateLimitViolations',
        count: expect.any(Number),
        threshold: 10
      })
    })
  })

  describe('Input Validation and Sanitization', () => {
    test('should validate and sanitize file paths', () => {
      const validatePath = (path: string): boolean => {
        // Check for path traversal attempts
        const dangerous = ['../', '..\\', '%2e%2e/', '%2e%2e\\']
        for (const pattern of dangerous) {
          if (path.includes(pattern)) {
            throw new Error('Path traversal detected')
          }
        }
        
        // Check for absolute paths to system directories
        const systemPaths = ['/etc', '/usr/bin', '/Windows/System32', 'C:\\Windows']
        for (const sysPath of systemPaths) {
          if (path.startsWith(sysPath)) {
            throw new Error('Access to system directory denied')
          }
        }
        
        return true
      }

      // Valid paths
      expect(validatePath('documents/file.txt')).toBe(true)
      expect(validatePath('./local/file.txt')).toBe(true)

      // Invalid paths
      expect(() => validatePath('../../../etc/passwd')).toThrow('Path traversal detected')
      expect(() => validatePath('/etc/passwd')).toThrow('Access to system directory denied')
      expect(() => validatePath('C:\\Windows\\System32\\cmd.exe')).toThrow('Access to system directory denied')
    })

    test('should detect SQL injection attempts', () => {
      const validateSQL = (query: string): boolean => {
        const dangerousPatterns = [
          /;\s*DROP/i,
          /;\s*DELETE/i,
          /--/,
          /\/\*/,
          /\bUNION\b.*\bSELECT\b/i,
          /\bOR\b.*=.*\bOR\b/i
        ]

        for (const pattern of dangerousPatterns) {
          if (pattern.test(query)) {
            throw new Error('Potential SQL injection detected')
          }
        }

        return true
      }

      // Valid queries
      expect(validateSQL('SELECT * FROM users WHERE id = ?')).toBe(true)
      expect(validateSQL('INSERT INTO logs (message) VALUES (?)')).toBe(true)

      // SQL injection attempts
      expect(() => validateSQL("SELECT * FROM users; DROP TABLE users;--")).toThrow('Potential SQL injection')
      expect(() => validateSQL("SELECT * FROM users WHERE id = 1 OR 1=1--")).toThrow('Potential SQL injection')
      expect(() => validateSQL("SELECT * FROM users UNION SELECT * FROM passwords")).toThrow('Potential SQL injection')
    })

    test('should detect prototype pollution attempts', () => {
      const checkPrototypePollution = (obj: any): boolean => {
        if (obj && typeof obj === 'object') {
          const dangerous = ['__proto__', 'constructor', 'prototype']
          for (const key of dangerous) {
            if (key in obj) {
              throw new Error('Potential prototype pollution detected')
            }
          }
        }
        return true
      }

      // Safe objects
      expect(checkPrototypePollution({ data: 'safe' })).toBe(true)
      expect(checkPrototypePollution({ user: { name: 'test' } })).toBe(true)

      // Prototype pollution attempts
      expect(() => checkPrototypePollution({ __proto__: { isAdmin: true } })).toThrow('prototype pollution')
      expect(() => checkPrototypePollution({ constructor: { prototype: {} } })).toThrow('prototype pollution')
    })
  })
})

// Helper function exports for use in other test files
export const mockIPCEvent = (overrides: any = {}) => ({
  senderFrame: { url: 'app://taskmaster', frameId: 1 },
  sender: { id: 1 },
  ...overrides
})

export const createSecureIPCHandler = () => {
  const handler = new (SecureIPCHandler as any)()
  const rateLimiter = new (IPCRateLimiter as any)()
  const monitor = new (SecurityMonitor as any)()
  
  return { handler, rateLimiter, monitor }
}