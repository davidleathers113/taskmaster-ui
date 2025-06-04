# Electron IPC Security Validation Standards and Attack Vectors 2025

## Executive Summary

This document outlines the latest IPC security validation standards, common attack vectors, and mitigation strategies for Electron applications in 2025. It addresses critical vulnerabilities including privilege escalation, message spoofing, data leakage, and DDoS attacks through comprehensive security patterns and implementation guidelines.

## Table of Contents

1. [Critical Vulnerabilities and Attack Vectors](#critical-vulnerabilities-and-attack-vectors)
2. [IPC Security Validation Standards](#ipc-security-validation-standards)
3. [Context Isolation and contextBridge Security](#context-isolation-and-contextbridge-security)
4. [Rate Limiting and DDoS Prevention](#rate-limiting-and-ddos-prevention)
5. [Implementation Guidelines](#implementation-guidelines)
6. [Testing Strategies](#testing-strategies)

## Critical Vulnerabilities and Attack Vectors

### 1. IPC senderFrame Validation Bypass

**Vulnerability**: All Web Frames can send IPC messages to the main process, including iframes and child windows. Without proper validation, malicious frames can execute privileged actions or access confidential data.

**Attack Vector**:
```javascript
// Vulnerable code - NO sender validation
ipcMain.handle('get-user-data', async (event) => {
  // ANY frame can call this!
  return await getUserData()
})
```

**Impact**: Complete application compromise, data exfiltration, privilege escalation

### 2. nodeIntegrationInSubFrames Exploitation

**CVE References**: Affects versions prior to 18.0.0-beta.6, 17.2.0, 16.2.6, and 15.5.5

**Attack Flow**:
1. Attacker gains JS execution through XSS or other web vulnerability
2. Exploits `nodeIntegrationInSubFrames` to access new renderer process
3. Obtains access to `ipcRenderer` in sandboxed environment
4. Leverages unvalidated IPC handlers to escalate privileges

### 3. Context Isolation Bypass

**Recent Vulnerabilities**: Context isolation bypass through unserializable objects

**Attack Pattern**:
- Exploiting APIs exposed via `contextBridge` that return non-serializable objects
- Example: Canvas rendering contexts, complex DOM elements
- Allows code in main world to reach isolated Electron context

### 4. Raw IPC API Exposure

**Critical Risk**: Exposing `ipcRenderer.on` or similar raw APIs

**Consequences**:
- Renderer can listen to ANY IPC event
- Can intercept sensitive communications
- Can send arbitrary messages to main process

### 5. Message Spoofing and Data Leakage

**Attack Scenarios**:
- Malicious renderer impersonating legitimate renderer
- Intercepting IPC responses meant for other frames
- Extracting sensitive data through unprotected channels

## IPC Security Validation Standards

### 1. Mandatory Sender Validation

**Implementation Standard**:
```javascript
// REQUIRED: Validate every IPC handler
ipcMain.handle('sensitive-operation', (event, ...args) => {
  if (!validateSender(event.senderFrame)) {
    throw new Error('Unauthorized sender')
  }
  return performOperation(...args)
})

function validateSender(frame) {
  // Use URL parser with strict allowlist
  const allowedOrigins = ['https://app.example.com', 'app://taskmaster']
  try {
    const frameUrl = new URL(frame.url)
    return allowedOrigins.includes(frameUrl.origin)
  } catch {
    return false
  }
}
```

### 2. Channel-Specific Validation

**Pattern**: Different security levels for different channels
```javascript
const securityLevels = {
  'public:*': { requireAuth: false, rateLimit: 100 },
  'user:*': { requireAuth: true, rateLimit: 50 },
  'admin:*': { requireAuth: true, requireAdmin: true, rateLimit: 10 }
}

function getSecurityLevel(channel) {
  for (const [pattern, level] of Object.entries(securityLevels)) {
    if (channel.match(pattern)) return level
  }
  return { requireAuth: true, rateLimit: 1 } // Default strict
}
```

### 3. Input Sanitization Requirements

**Mandatory Checks**:
- Path traversal prevention
- Command injection protection
- Type validation
- Size limits

```javascript
// Example sanitization
function sanitizePath(inputPath) {
  // Prevent directory traversal
  if (inputPath.includes('..') || inputPath.includes('~')) {
    throw new Error('Invalid path')
  }
  
  // Ensure within app boundaries
  const resolved = path.resolve(inputPath)
  const appDir = app.getPath('userData')
  
  if (!resolved.startsWith(appDir)) {
    throw new Error('Path outside app directory')
  }
  
  return resolved
}
```

## Context Isolation and contextBridge Security

### 1. Secure contextBridge Patterns

**2025 Best Practice**:
```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron')

// GOOD: Minimal, specific API exposure
contextBridge.exposeInMainWorld('api', {
  // One-way operations
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  
  // Filtered event listening
  onProgress: (callback) => {
    const safeCallback = (event, progress) => {
      // Filter event data before passing to renderer
      callback({ percent: progress.percent })
    }
    ipcRenderer.on('download-progress', safeCallback)
    return () => ipcRenderer.removeListener('download-progress', safeCallback)
  }
})

// NEVER DO THIS
// contextBridge.exposeInMainWorld('bad', {
//   ipcRenderer: ipcRenderer,
//   on: ipcRenderer.on.bind(ipcRenderer)
// })
```

### 2. WebPreferences Security Configuration

**Required Settings for 2025**:
```javascript
const mainWindow = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,           // MANDATORY
    nodeIntegration: false,           // MANDATORY
    sandbox: true,                    // HIGHLY RECOMMENDED
    webviewTag: false,               // Disable unless needed
    enableRemoteModule: false,       // DEPRECATED - ensure false
    preload: path.join(__dirname, 'preload.js')
  }
})
```

### 3. Avoiding Context Isolation Bypasses

**Security Guidelines**:
- Never return DOM elements through contextBridge
- Avoid exposing canvas contexts or other unserializable objects
- Use primitive types and plain objects only
- Implement object cloning for complex data

## Rate Limiting and DDoS Prevention

### 1. IPC Rate Limiting Implementation

**Per-Channel Rate Limiting**:
```javascript
class IPCRateLimiter {
  constructor() {
    this.limits = new Map()
    this.requests = new Map()
  }

  setLimit(channel, maxRequests, windowMs) {
    this.limits.set(channel, { maxRequests, windowMs })
  }

  checkLimit(channel, senderId) {
    const limit = this.limits.get(channel)
    if (!limit) return true

    const key = `${channel}:${senderId}`
    const now = Date.now()
    const requests = this.requests.get(key) || []
    
    // Remove old requests outside window
    const validRequests = requests.filter(
      time => now - time < limit.windowMs
    )
    
    if (validRequests.length >= limit.maxRequests) {
      return false // Rate limit exceeded
    }
    
    validRequests.push(now)
    this.requests.set(key, validRequests)
    return true
  }
}

// Usage
const rateLimiter = new IPCRateLimiter()
rateLimiter.setLimit('api:query', 10, 60000) // 10 requests per minute

ipcMain.handle('api:query', (event, ...args) => {
  if (!rateLimiter.checkLimit('api:query', event.sender.id)) {
    throw new Error('Rate limit exceeded')
  }
  // Process request
})
```

### 2. DDoS Attack Patterns in Electron

**2025 Threat Landscape**:
- 358% YoY increase in DDoS attacks (Q1 2025)
- Average 8 hyper-volumetric attacks per day exceeding 1 Tbps
- Multi-vector attacks targeting different application layers

**Electron-Specific Threats**:
- IPC flooding attacks
- Memory exhaustion through rapid window creation
- Resource depletion via unthrottled API calls

### 3. Defense Strategies

**Multi-Layer Protection**:
```javascript
// Layer 1: Connection-level protection
class ConnectionManager {
  constructor(maxConnections = 100) {
    this.connections = new Map()
    this.maxConnections = maxConnections
  }

  acceptConnection(id) {
    if (this.connections.size >= this.maxConnections) {
      return false
    }
    this.connections.set(id, { 
      connectedAt: Date.now(),
      requestCount: 0 
    })
    return true
  }
}

// Layer 2: Request-level protection
class RequestThrottler {
  constructor() {
    this.queue = new Map()
    this.processing = new Set()
  }

  async throttle(senderId, operation) {
    const key = `${senderId}:${operation}`
    
    if (this.processing.has(key)) {
      throw new Error('Operation already in progress')
    }
    
    this.processing.add(key)
    try {
      return await operation()
    } finally {
      this.processing.delete(key)
    }
  }
}
```

## Implementation Guidelines

### 1. Secure IPC Handler Pattern

```javascript
// Comprehensive secure IPC handler
class SecureIPCHandler {
  constructor() {
    this.rateLimiter = new IPCRateLimiter()
    this.validators = new Map()
    this.sanitizers = new Map()
  }

  handle(channel, options, handler) {
    const { 
      rateLimit, 
      validator, 
      sanitizer,
      requireAuth = true,
      allowedOrigins = []
    } = options

    if (rateLimit) {
      this.rateLimiter.setLimit(channel, ...rateLimit)
    }
    
    if (validator) {
      this.validators.set(channel, validator)
    }
    
    if (sanitizer) {
      this.sanitizers.set(channel, sanitizer)
    }

    ipcMain.handle(channel, async (event, ...args) => {
      // 1. Validate sender
      if (!this.validateSender(event.senderFrame, allowedOrigins)) {
        throw new Error('Unauthorized sender')
      }

      // 2. Check rate limit
      if (!this.rateLimiter.checkLimit(channel, event.sender.id)) {
        throw new Error('Rate limit exceeded')
      }

      // 3. Validate input
      const validator = this.validators.get(channel)
      if (validator && !validator(...args)) {
        throw new Error('Invalid input')
      }

      // 4. Sanitize input
      const sanitizer = this.sanitizers.get(channel)
      const sanitizedArgs = sanitizer ? sanitizer(...args) : args

      // 5. Execute handler
      return handler(event, ...sanitizedArgs)
    })
  }

  validateSender(frame, allowedOrigins) {
    if (allowedOrigins.length === 0) return true
    
    try {
      const frameUrl = new URL(frame.url)
      return allowedOrigins.includes(frameUrl.origin)
    } catch {
      return false
    }
  }
}
```

### 2. Preload Script Security Template

```javascript
// secure-preload.js
const { contextBridge, ipcRenderer } = require('electron')

// Define allowed channels
const ALLOWED_CHANNELS = {
  invoke: ['app:get-version', 'file:save', 'file:load'],
  on: ['app:theme-changed', 'task:updated'],
  once: ['app:ready']
}

// Secure API exposure
contextBridge.exposeInMainWorld('electronAPI', {
  // Invoke operations
  invoke: (channel, ...args) => {
    if (!ALLOWED_CHANNELS.invoke.includes(channel)) {
      throw new Error(`Channel ${channel} not allowed`)
    }
    return ipcRenderer.invoke(channel, ...args)
  },

  // Event listeners with cleanup
  on: (channel, callback) => {
    if (!ALLOWED_CHANNELS.on.includes(channel)) {
      throw new Error(`Channel ${channel} not allowed`)
    }
    
    const subscription = (event, ...args) => callback(...args)
    ipcRenderer.on(channel, subscription)
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },

  // One-time listeners
  once: (channel, callback) => {
    if (!ALLOWED_CHANNELS.once.includes(channel)) {
      throw new Error(`Channel ${channel} not allowed`)
    }
    ipcRenderer.once(channel, (event, ...args) => callback(...args))
  }
})
```

### 3. Security Monitoring and Logging

```javascript
class SecurityMonitor {
  constructor() {
    this.events = []
    this.thresholds = {
      rateLimitViolations: 10,
      authFailures: 5,
      suspiciousPatterns: 3
    }
  }

  logSecurityEvent(type, details) {
    const event = {
      type,
      timestamp: Date.now(),
      details
    }
    
    this.events.push(event)
    this.checkThresholds(type)
    
    // Log to file for audit
    console.log('[SECURITY]', JSON.stringify(event))
  }

  checkThresholds(type) {
    const recentEvents = this.events.filter(
      e => e.type === type && 
      Date.now() - e.timestamp < 300000 // 5 minutes
    )
    
    if (recentEvents.length >= this.thresholds[type]) {
      this.triggerAlert(type, recentEvents)
    }
  }

  triggerAlert(type, events) {
    // Implement alert mechanism
    console.error(`SECURITY ALERT: ${type} threshold exceeded`, events)
    // Could trigger lockdown, notification, etc.
  }
}
```

## Testing Strategies

### 1. IPC Security Test Suite

```javascript
describe('IPC Security Tests', () => {
  let secureHandler
  
  beforeEach(() => {
    secureHandler = new SecureIPCHandler()
  })

  test('should reject unauthorized senders', async () => {
    const mockEvent = {
      senderFrame: { url: 'https://evil.com' },
      sender: { id: 1 }
    }
    
    secureHandler.handle('secure:operation', {
      allowedOrigins: ['https://app.example.com']
    }, async () => 'success')
    
    await expect(
      ipcMain._handlers['secure:operation'](mockEvent)
    ).rejects.toThrow('Unauthorized sender')
  })

  test('should enforce rate limiting', async () => {
    secureHandler.handle('limited:operation', {
      rateLimit: [2, 1000] // 2 requests per second
    }, async () => 'success')
    
    const mockEvent = {
      senderFrame: { url: 'app://test' },
      sender: { id: 1 }
    }
    
    // First two should succeed
    await ipcMain._handlers['limited:operation'](mockEvent)
    await ipcMain._handlers['limited:operation'](mockEvent)
    
    // Third should fail
    await expect(
      ipcMain._handlers['limited:operation'](mockEvent)
    ).rejects.toThrow('Rate limit exceeded')
  })

  test('should prevent path traversal', () => {
    const inputs = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32',
      '~/../../sensitive',
      '/etc/passwd'
    ]
    
    inputs.forEach(input => {
      expect(() => sanitizePath(input)).toThrow('Invalid path')
    })
  })
})
```

### 2. Attack Simulation Tests

```javascript
describe('Attack Vector Tests', () => {
  test('should prevent IPC flooding', async () => {
    const attacker = new IPCFlooder()
    const results = await attacker.flood('api:endpoint', 1000)
    
    const successful = results.filter(r => r.success).length
    expect(successful).toBeLessThan(100) // Rate limiting should block most
  })

  test('should prevent context isolation bypass', () => {
    // Test returning unserializable objects
    const vulnerableAPI = {
      getCanvas: () => document.createElement('canvas').getContext('2d')
    }
    
    expect(() => {
      contextBridge.exposeInMainWorld('vulnerable', vulnerableAPI)
    }).toThrow() // Should fail in secure implementation
  })
})
```

## Conclusion

The 2025 security landscape for Electron IPC requires a multi-layered defense strategy combining:

1. **Strict sender validation** on all IPC channels
2. **Minimal API exposure** through contextBridge
3. **Comprehensive rate limiting** to prevent DDoS
4. **Input sanitization** at all entry points
5. **Security monitoring** for threat detection
6. **Regular testing** against known attack vectors

Following these standards provides robust protection against current and emerging threats while maintaining application functionality and performance.