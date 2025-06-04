/**
 * Secure IPC Handler Module (2025)
 * 
 * Comprehensive IPC security handler with sender validation,
 * input sanitization, and security monitoring
 */

import { IpcMainInvokeEvent } from 'electron'
import { IPCRateLimiter } from './ipc-rate-limiter'
import { SecurityMonitor } from './security-monitor'

export interface SecureHandlerOptions {
  allowedOrigins?: string[]
  requireAuth?: boolean
  rateLimit?: [number, number] // [maxRequests, windowMs]
  validator?: (data: any) => boolean
  sanitizer?: (data: any) => any
  allowedChannels?: string[]
}

export interface SenderValidationResult {
  valid: boolean
  reason?: string
  origin?: string
  frameId?: number
}

export class SecureIPCHandler {
  private rateLimiter: IPCRateLimiter
  private securityMonitor: SecurityMonitor
  private handlers = new Map<string, Function>()
  private options = new Map<string, SecureHandlerOptions>()
  private internalChannels = [
    'ELECTRON_BROWSER_REQUIRE',
    'ELECTRON_BROWSER_GET_BUILTIN',
    'ELECTRON_BROWSER_MEMBER_GET',
    'ELECTRON_BROWSER_MEMBER_SET',
    'ELECTRON_BROWSER_MEMBER_CALL'
  ]

  constructor() {
    this.rateLimiter = new IPCRateLimiter()
    this.securityMonitor = new SecurityMonitor()
  }

  handle(channel: string, options: SecureHandlerOptions, handler: (event: any, ...args: any[]) => any): void {
    // Block internal Electron channels
    if (this.internalChannels.some(internal => channel.startsWith(internal))) {
      throw new Error('Cannot register handler for internal channel')
    }

    this.options.set(channel, options)
    this.handlers.set(channel, handler)

    // Set up rate limiting if specified
    if (options.rateLimit) {
      this.rateLimiter.setLimit(channel, ...options.rateLimit)
    }
  }

  async execute(channel: string, event: IpcMainInvokeEvent, ...args: any[]): Promise<any> {
    const options = this.options.get(channel)
    const handler = this.handlers.get(channel)

    if (!handler) {
      throw new Error(`No handler registered for channel: ${channel}`)
    }

    try {
      // 1. Validate sender
      const senderValidation = this.validateSender(event.senderFrame, options?.allowedOrigins)
      if (!senderValidation.valid) {
        this.securityMonitor.logSecurityEvent({
          type: 'unauthorized_sender',
          severity: 'high',
          details: {
            channel,
            reason: senderValidation.reason,
            origin: senderValidation.origin,
            frameId: senderValidation.frameId
          }
        })
        throw new Error(senderValidation.reason || 'Unauthorized sender')
      }

      // 2. Check rate limit
      const senderId = event.sender.id.toString()
      if (!this.rateLimiter.checkLimit(channel, senderId)) {
        this.securityMonitor.logSecurityEvent({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          details: { channel, senderId }
        })
        throw new Error('Rate limit exceeded')
      }

      // 3. Validate input
      if (options?.validator && args.length > 0) {
        if (!options.validator(args[0])) {
          this.securityMonitor.logSecurityEvent({
            type: 'invalid_input',
            severity: 'medium',
            details: { channel, input: args[0] }
          })
          throw new Error('Invalid input')
        }
      }

      // 4. Sanitize input
      let sanitizedArgs = args
      if (options?.sanitizer && args.length > 0) {
        sanitizedArgs = [options.sanitizer(args[0]), ...args.slice(1)]
      }

      // 5. Check authentication if required
      if (options?.requireAuth) {
        if (!this.checkAuthentication(event)) {
          this.securityMonitor.logSecurityEvent({
            type: 'auth_failure',
            severity: 'high',
            details: { channel, senderId }
          })
          throw new Error('Authentication required')
        }
      }

      // 6. Execute handler
      return await handler(event, ...sanitizedArgs)
    } catch (error) {
      // Log all errors
      this.securityMonitor.logSecurityEvent({
        type: 'handler_error',
        severity: 'low',
        details: {
          channel,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      throw error
    }
  }

  validateSender(frame: Electron.Renderer.WebFrame | undefined, allowedOrigins?: string[]): SenderValidationResult {
    if (!frame) {
      return { valid: false, reason: 'No sender frame' }
    }

    try {
      const frameUrl = new URL(frame.url)
      const origin = frameUrl.origin

      // Check if frame is from iframe
      if (frame.parent && frame.parent !== frame) {
        return {
          valid: false,
          reason: 'IPC from iframe not allowed',
          origin,
          frameId: frame.frameId
        }
      }

      // Check allowed origins
      if (allowedOrigins && allowedOrigins.length > 0) {
        if (!allowedOrigins.includes(origin)) {
          return {
            valid: false,
            reason: 'Origin not in allowlist',
            origin,
            frameId: frame.frameId
          }
        }
      }

      return { valid: true, origin, frameId: frame.frameId }
    } catch (error) {
      return { valid: false, reason: 'Invalid sender URL' }
    }
  }

  private checkAuthentication(event: IpcMainInvokeEvent): boolean {
    // Placeholder for authentication check
    // In production, implement proper authentication
    return true
  }

  // Input sanitization helpers
  static sanitizePath(path: string): string {
    // Remove directory traversal attempts
    const dangerous = ['../', '..\\', '%2e%2e/', '%2e%2e\\']
    for (const pattern of dangerous) {
      if (path.includes(pattern)) {
        throw new Error('Path traversal detected')
      }
    }

    // Normalize path
    return path.replace(/\\/g, '/').replace(/\/+/g, '/')
  }

  static sanitizeSQL(query: string): string {
    // Basic SQL injection prevention
    const dangerousPatterns = [
      /;\s*DROP/i,
      /;\s*DELETE/i,
      /;\s*UPDATE/i,
      /;\s*INSERT/i,
      /--/,
      /\/\*/,
      /\*\//,
      /\bUNION\b.*\bSELECT\b/i,
      /\bOR\b.*=.*\bOR\b/i
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        throw new Error('Potential SQL injection detected')
      }
    }

    return query
  }

  // Get handler statistics
  getStats() {
    return {
      registeredHandlers: this.handlers.size,
      rateLimiterStats: this.rateLimiter.getStats(),
      securityEvents: this.securityMonitor.getRecentEvents(100)
    }
  }

  // Clean up resources
  cleanup(): void {
    this.handlers.clear()
    this.options.clear()
    this.rateLimiter.cleanup()
  }
}