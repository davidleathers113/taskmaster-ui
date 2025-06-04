/**
 * Mocked Electron APIs Security Tests (2025)
 * 
 * Comprehensive testing of Electron API security measures including
 * URL validation, file path sanitization, dialog security, and
 * protection against common attack vectors following 2025 best practices.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

// Global type declarations for test environment
declare global {
  const vi: typeof import('vitest').vi
  interface GlobalThis {
    __mockElectron?: any
    __electron?: any
    electronAPI?: any
    taskmaster?: any
    __DEV__?: boolean
    __TEST__?: boolean
  }
}

import { app, dialog, shell, clipboard, globalShortcut } from 'electron'
import * as path from 'path'
// import * as fs from 'fs' // Not used

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(),
    getVersion: vi.fn().mockReturnValue('1.0.0-test'),
    getName: vi.fn().mockReturnValue('TaskMaster'),
    isPackaged: false,
    setAsDefaultProtocolClient: vi.fn(),
    removeAsDefaultProtocolClient: vi.fn(),
    getLoginItemSettings: vi.fn(),
    setLoginItemSettings: vi.fn()
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
    showErrorBox: vi.fn(),
    showCertificateTrustDialog: vi.fn()
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(),
    trashItem: vi.fn(),
    beep: vi.fn(),
    writeShortcutLink: vi.fn(),
    readShortcutLink: vi.fn()
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
    getFocusedWindow: vi.fn().mockReturnValue(null),
    fromWebContents: vi.fn()
  },
  protocol: {
    registerFileProtocol: vi.fn(),
    registerHttpProtocol: vi.fn(),
    registerStringProtocol: vi.fn(),
    unregisterProtocol: vi.fn(),
    isProtocolRegistered: vi.fn(),
    interceptFileProtocol: vi.fn()
  },
  clipboard: {
    readText: vi.fn(),
    writeText: vi.fn(),
    readHTML: vi.fn(),
    writeHTML: vi.fn(),
    clear: vi.fn()
  },
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn(),
    isRegistered: vi.fn(),
    unregisterAll: vi.fn()
  }
}))

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      access: vi.fn(),
      stat: vi.fn()
    }
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    stat: vi.fn()
  }
}))

describe('Electron API Security Tests (2025)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('External URL Validation', () => {
    // URL validation utility
    const openExternalLink = async (url: string): Promise<void> => {
      // Validate URL scheme
      const allowedProtocols = ['http:', 'https:', 'mailto:']
      const parsedUrl = new URL(url)
      
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        throw new Error(`Disallowed protocol: ${parsedUrl.protocol}`)
      }
      
      // Additional validation for suspicious URLs
      const suspiciousPatterns = [
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /file:/i,
        /about:/i
      ]
      
      if (suspiciousPatterns.some(pattern => pattern.test(url))) {
        throw new Error('Suspicious URL pattern detected')
      }
      
      return shell.openExternal(url)
    }

    test('should allow valid HTTP/HTTPS URLs', async () => {
      shell.openExternal = vi.fn().mockResolvedValue(undefined)
      
      await openExternalLink('https://example.com')
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')
      
      await openExternalLink('http://example.org')
      expect(shell.openExternal).toHaveBeenCalledWith('http://example.org')
      
      await openExternalLink('mailto:user@example.com')
      expect(shell.openExternal).toHaveBeenCalledWith('mailto:user@example.com')
    })

    test('should block dangerous URL schemes', async () => {
      shell.openExternal = vi.fn()
      
      // File URLs should be blocked
      await expect(openExternalLink('file:///etc/passwd')).rejects.toThrow('Disallowed protocol: file:')
      await expect(openExternalLink('file://C:/Windows/System32')).rejects.toThrow('Disallowed protocol: file:')
      
      // JavaScript URLs should be blocked
      await expect(openExternalLink('javascript:alert("xss")')).rejects.toThrow('Suspicious URL pattern detected')
      
      // Data URLs should be blocked
      await expect(openExternalLink('data:text/html,<script>alert("xss")</script>')).rejects.toThrow('Suspicious URL pattern detected')
      
      // VBScript URLs should be blocked
      await expect(openExternalLink('vbscript:msgbox("xss")')).rejects.toThrow('Suspicious URL pattern detected')
      
      expect(shell.openExternal).not.toHaveBeenCalled()
    })

    test('should validate URLs before opening', async () => {
      shell.openExternal = vi.fn()
      
      // Invalid URLs should throw
      await expect(openExternalLink('not a valid url')).rejects.toThrow()
      await expect(openExternalLink('')).rejects.toThrow()
      await expect(openExternalLink('://broken')).rejects.toThrow()
      
      expect(shell.openExternal).not.toHaveBeenCalled()
    })
  })

  describe('File Dialog Security', () => {
    // Secure file selection utility
    const selectAndProcessFile = async (options: any = {}): Promise<string[]> => {
      const defaultOptions = {
        properties: ['openFile'],
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        // Security: Restrict to user directories by default
        defaultPath: app.getPath('documents')
      }
      
      const result = await dialog.showOpenDialog({ ...defaultOptions, ...options })
      
      if (result.canceled || !result.filePaths.length) {
        return []
      }
      
      // Sanitize and validate file paths
      const sanitizedPaths = result.filePaths.map(filePath => {
        // Normalize path to prevent traversal
        const normalizedPath = path.normalize(filePath)
        
        // Check for directory traversal attempts
        if (normalizedPath.includes('..')) {
          throw new Error('Directory traversal detected')
        }
        
        // Validate path is within allowed directories
        const allowedBasePaths = [
          app.getPath('home'),
          app.getPath('documents'),
          app.getPath('downloads'),
          app.getPath('userData')
        ]
        
        const isInAllowedPath = allowedBasePaths.some(basePath => 
          normalizedPath.startsWith(basePath)
        )
        
        if (!isInAllowedPath) {
          throw new Error('File path outside allowed directories')
        }
        
        return normalizedPath
      })
      
      return sanitizedPaths
    }

    test('should sanitize file paths from dialog', async () => {
      app.getPath = vi.fn().mockImplementation((name) => {
        const paths: Record<string, string> = {
          home: '/Users/test',
          documents: '/Users/test/Documents',
          downloads: '/Users/test/Downloads',
          userData: '/Users/test/AppData/TaskMaster'
        }
        return paths[name] || `/mock/${name}`
      })
      
      dialog.showOpenDialog = vi.fn().mockResolvedValue({
        canceled: false,
        filePaths: ['/Users/test/Documents/file.json']
      })
      
      const paths = await selectAndProcessFile()
      expect(paths).toEqual(['/Users/test/Documents/file.json'])
    })

    test('should reject paths with directory traversal', async () => {
      dialog.showOpenDialog = vi.fn().mockResolvedValue({
        canceled: false,
        filePaths: ['/Users/test/Documents/../../../etc/passwd']
      })
      
      await expect(selectAndProcessFile()).rejects.toThrow('Directory traversal detected')
    })

    test('should reject paths outside allowed directories', async () => {
      app.getPath = vi.fn().mockImplementation((name) => {
        if (name === 'home') return '/Users/test'
        if (name === 'documents') return '/Users/test/Documents'
        return `/mock/${name}`
      })
      
      dialog.showOpenDialog = vi.fn().mockResolvedValue({
        canceled: false,
        filePaths: ['/etc/passwd']
      })
      
      await expect(selectAndProcessFile()).rejects.toThrow('File path outside allowed directories')
    })

    test('should handle canceled dialogs gracefully', async () => {
      dialog.showOpenDialog = vi.fn().mockResolvedValue({
        canceled: true,
        filePaths: []
      })
      
      const paths = await selectAndProcessFile()
      expect(paths).toEqual([])
    })
  })

  describe('Protocol Handler Security', () => {
    test('should validate custom protocol registration', () => {
      const registerSecureProtocol = (scheme: string) => {
        // Validate protocol name
        if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) {
          throw new Error('Invalid protocol scheme')
        }
        
        // Block potentially dangerous protocol names
        const dangerousSchemes = ['javascript', 'data', 'vbscript', 'file', 'about']
        if (dangerousSchemes.includes(scheme)) {
          throw new Error('Dangerous protocol scheme')
        }
        
        return app.setAsDefaultProtocolClient(scheme)
      }
      
      // Valid protocol
      expect(() => registerSecureProtocol('taskmaster')).not.toThrow()
      expect(app.setAsDefaultProtocolClient).toHaveBeenCalledWith('taskmaster')
      
      // Invalid protocols
      expect(() => registerSecureProtocol('JavaScript')).toThrow('Invalid protocol scheme')
      expect(() => registerSecureProtocol('file')).toThrow('Dangerous protocol scheme')
      expect(() => registerSecureProtocol('data')).toThrow('Dangerous protocol scheme')
    })

    test('should handle protocol requests securely', () => {
      const handleProtocolRequest = (url: string) => {
        // Parse and validate protocol URL
        const parsedUrl = new URL(url)
        
        if (parsedUrl.protocol !== 'taskmaster:') {
          throw new Error('Unexpected protocol')
        }
        
        // Extract and sanitize parameters
        const action = parsedUrl.pathname.replace(/^\/+/, '')
        const params = Object.fromEntries(parsedUrl.searchParams)
        
        // Validate action
        const allowedActions = ['open', 'create', 'import']
        if (!allowedActions.includes(action)) {
          throw new Error('Invalid protocol action')
        }
        
        // Sanitize parameters
        Object.keys(params).forEach(key => {
          if (typeof params[key] !== 'string') return
          // Remove any script tags or dangerous content
          params[key] = params[key].replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .trim()
        })
        
        return { action, params }
      }
      
      // Valid protocol URL
      const result = handleProtocolRequest('taskmaster://open?file=test.json')
      expect(result).toEqual({
        action: 'open',
        params: { file: 'test.json' }
      })
      
      // Invalid protocol
      expect(() => handleProtocolRequest('javascript://alert')).toThrow('Unexpected protocol')
      
      // Invalid action
      expect(() => handleProtocolRequest('taskmaster://execute?cmd=rm')).toThrow('Invalid protocol action')
      
      // Sanitized parameters
      const sanitized = handleProtocolRequest('taskmaster://open?file=<script>alert("xss")</script>')
      expect(sanitized.params.file).toBe('')
    })
  })

  describe('Clipboard Security', () => {
    test('should sanitize clipboard content', () => {
      const writeToClipboard = (text: string, type: 'text' | 'html' = 'text') => {
        // Sanitize content based on type
        let sanitized = text
        
        if (type === 'html') {
          // Remove script tags and event handlers
          sanitized = text
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/javascript:/gi, '')
        } else {
          // For plain text, limit length to prevent memory issues
          const maxLength = 1000000 // 1MB
          if (text.length > maxLength) {
            sanitized = text.substring(0, maxLength)
          }
        }
        
        if (type === 'html') {
          clipboard.writeHTML(sanitized)
        } else {
          clipboard.writeText(sanitized)
        }
        
        return sanitized
      }
      
      // Test HTML sanitization
      const html = '<div onclick="alert(\'xss\')">Text</div><script>alert("xss")</script>'
      const sanitizedHtml = writeToClipboard(html, 'html')
      expect(sanitizedHtml).toBe('<div>Text</div>')
      expect(clipboard.writeHTML).toHaveBeenCalledWith('<div>Text</div>')
      
      // Test text length limiting
      const longText = 'a'.repeat(2000000)
      const sanitizedText = writeToClipboard(longText)
      expect(sanitizedText.length).toBe(1000000)
      expect(clipboard.writeText).toHaveBeenCalledWith('a'.repeat(1000000))
    })

    test('should validate clipboard read operations', () => {
      const readFromClipboard = (type: 'text' | 'html' = 'text'): string => {
        const content = type === 'html' ? clipboard.readHTML() : clipboard.readText()
        
        // Validate content isn't suspiciously large (potential DoS)
        const maxSize = 10000000 // 10MB
        if (content && content.length > maxSize) {
          throw new Error('Clipboard content too large')
        }
        
        return content || ''
      }
      
      // Normal content
      clipboard.readText = vi.fn().mockReturnValue('Normal text')
      expect(readFromClipboard()).toBe('Normal text')
      
      // Extremely large content
      clipboard.readText = vi.fn().mockReturnValue('x'.repeat(20000000))
      expect(() => readFromClipboard()).toThrow('Clipboard content too large')
    })
  })

  describe('Global Shortcut Security', () => {
    test('should validate shortcut patterns', () => {
      const registerSecureShortcut = (accelerator: string, callback: () => void) => {
        // Validate accelerator format
        const validPattern = /^(Command|Cmd|Control|Ctrl|CommandOrControl|CmdOrCtrl|Alt|Option|AltGr|Shift|Super)?\+?[A-Z0-9]$/i
        
        if (!validPattern.test(accelerator)) {
          throw new Error('Invalid accelerator pattern')
        }
        
        // Block potentially dangerous shortcuts
        const dangerousShortcuts = [
          'Cmd+Q', // macOS quit
          'Alt+F4', // Windows close
          'Ctrl+Alt+Delete', // Windows system
          'Cmd+Option+Esc' // macOS force quit
        ]
        
        if (dangerousShortcuts.includes(accelerator)) {
          throw new Error('Dangerous shortcut blocked')
        }
        
        return globalShortcut.register(accelerator, callback)
      }
      
      const callback = vi.fn()
      
      // Valid shortcuts
      expect(() => registerSecureShortcut('Ctrl+S', callback)).not.toThrow()
      expect(() => registerSecureShortcut('Cmd+Shift+P', callback)).not.toThrow()
      
      // Invalid patterns
      expect(() => registerSecureShortcut('InvalidKey', callback)).toThrow('Invalid accelerator pattern')
      expect(() => registerSecureShortcut('Ctrl+Alt+Delete', callback)).toThrow('Dangerous shortcut blocked')
    })
  })

  describe('App Path Security', () => {
    test('should validate app.getPath calls', () => {
      const getSecurePath = (name: string): string => {
        // Whitelist of allowed path names
        const allowedPaths = [
          'home', 'appData', 'userData', 'sessionData', 'temp',
          'exe', 'module', 'desktop', 'documents', 'downloads',
          'music', 'pictures', 'videos', 'recent', 'logs', 'crashDumps'
        ]
        
        if (!allowedPaths.includes(name)) {
          throw new Error(`Invalid path name: ${name}`)
        }
        
        return app.getPath(name as any)
      }
      
      app.getPath = vi.fn().mockImplementation((name) => `/mock/${name}`)
      
      // Valid paths
      expect(getSecurePath('userData')).toBe('/mock/userData')
      expect(getSecurePath('documents')).toBe('/mock/documents')
      
      // Invalid paths
      expect(() => getSecurePath('../../etc')).toThrow('Invalid path name: ../../etc')
      expect(() => getSecurePath('system32')).toThrow('Invalid path name: system32')
    })
  })

  describe('Certificate Trust Dialog Security', () => {
    test('should validate certificate before showing trust dialog', async () => {
      const showCertificateTrustDialog = async (certificate: any) => {
        // Validate certificate structure
        if (!certificate || typeof certificate !== 'object') {
          throw new Error('Invalid certificate object')
        }
        
        // Check required fields
        const requiredFields = ['issuerName', 'subjectName', 'serialNumber', 'validStart', 'validExpiry']
        for (const field of requiredFields) {
          if (!certificate[field]) {
            throw new Error(`Missing required certificate field: ${field}`)
          }
        }
        
        // Validate certificate dates
        const now = new Date()
        const validStart = new Date(certificate.validStart)
        const validExpiry = new Date(certificate.validExpiry)
        
        if (now < validStart || now > validExpiry) {
          throw new Error('Certificate is not valid for current date')
        }
        
        // Check for self-signed certificates (subject === issuer)
        if (certificate.issuerName === certificate.subjectName) {
          console.warn('Warning: Self-signed certificate detected')
        }
        
        return dialog.showCertificateTrustDialog(certificate)
      }
      
      // Valid certificate
      const validCert = {
        issuerName: 'CN=Example CA',
        subjectName: 'CN=example.com',
        serialNumber: '123456',
        validStart: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        validExpiry: new Date(Date.now() + 86400000).toISOString() // Tomorrow
      }
      
      dialog.showCertificateTrustDialog = vi.fn().mockResolvedValue(true)
      await showCertificateTrustDialog(validCert)
      expect(dialog.showCertificateTrustDialog).toHaveBeenCalledWith(validCert)
      
      // Invalid certificate
      await expect(showCertificateTrustDialog(null)).rejects.toThrow('Invalid certificate object')
      await expect(showCertificateTrustDialog({ issuerName: 'test' })).rejects.toThrow('Missing required certificate field')
      
      // Expired certificate
      const expiredCert = {
        ...validCert,
        validExpiry: new Date(Date.now() - 86400000).toISOString() // Yesterday
      }
      await expect(showCertificateTrustDialog(expiredCert)).rejects.toThrow('Certificate is not valid for current date')
    })
  })

  describe('Login Item Security', () => {
    test('should validate login item settings', () => {
      const setSecureLoginItem = (settings: any) => {
        // Validate settings object
        if (!settings || typeof settings !== 'object') {
          throw new Error('Invalid login item settings')
        }
        
        // Only allow specific fields
        const allowedFields = ['openAtLogin', 'openAsHidden', 'path', 'args']
        const providedFields = Object.keys(settings)
        
        for (const field of providedFields) {
          if (!allowedFields.includes(field)) {
            throw new Error(`Unexpected field in login item settings: ${field}`)
          }
        }
        
        // Validate path if provided
        if (settings.path) {
          const normalizedPath = path.normalize(settings.path)
          if (normalizedPath.includes('..')) {
            throw new Error('Path traversal in login item path')
          }
        }
        
        // Validate args if provided
        if (settings.args && Array.isArray(settings.args)) {
          // Check for dangerous arguments
          const dangerousArgs = ['--enable-logging', '--remote-debugging-port', '--inspect']
          for (const arg of settings.args) {
            if (dangerousArgs.some(dangerous => arg.includes(dangerous))) {
              throw new Error('Dangerous argument in login item')
            }
          }
        }
        
        return app.setLoginItemSettings(settings)
      }
      
      // Valid settings
      expect(() => setSecureLoginItem({ openAtLogin: true })).not.toThrow()
      expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true })
      
      // Invalid settings
      expect(() => setSecureLoginItem({ malicious: 'code' })).toThrow('Unexpected field')
      expect(() => setSecureLoginItem({ path: '../../../etc/passwd' })).toThrow('Path traversal')
      expect(() => setSecureLoginItem({ args: ['--remote-debugging-port=9222'] })).toThrow('Dangerous argument')
    })
  })
})