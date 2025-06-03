/**
 * IPC Rate Limiter Module (2025)
 * 
 * Advanced rate limiting implementation for Electron IPC
 * Supporting sliding window, token bucket, and multi-key patterns
 */

export interface RateLimitOptions {
  maxRequests: number
  windowMs: number
  keyGenerator?: (channel: string, senderId: string) => string
}

export interface TokenBucketOptions {
  capacity: number
  refillRate: number // tokens per second
  refillInterval?: number // ms
}

export class IPCRateLimiter {
  private limits = new Map<string, RateLimitOptions>()
  private requests = new Map<string, number[]>()
  private buckets = new Map<string, { tokens: number; lastRefill: number }>()
  private blacklist = new Set<string>()
  
  setLimit(channel: string, maxRequests: number, windowMs: number): void {
    this.limits.set(channel, {
      maxRequests,
      windowMs,
      keyGenerator: (ch, id) => `${ch}:${id}`
    })
  }

  setCustomLimit(channel: string, options: RateLimitOptions): void {
    this.limits.set(channel, options)
  }

  checkLimit(channel: string, senderId: string): boolean {
    const limit = this.limits.get(channel)
    if (!limit) return true

    if (this.blacklist.has(senderId)) {
      return false
    }

    const key = limit.keyGenerator ? limit.keyGenerator(channel, senderId) : `${channel}:${senderId}`
    const now = Date.now()
    const timestamps = this.requests.get(key) || []
    
    // Remove old timestamps outside window
    const validTimestamps = timestamps.filter(t => now - t < limit.windowMs)
    
    if (validTimestamps.length >= limit.maxRequests) {
      return false
    }
    
    validTimestamps.push(now)
    this.requests.set(key, validTimestamps)
    return true
  }

  // Token bucket implementation for burst handling
  consumeToken(key: string, options: TokenBucketOptions, tokens: number = 1): boolean {
    const now = Date.now()
    let bucket = this.buckets.get(key)
    
    if (!bucket) {
      bucket = { tokens: options.capacity, lastRefill: now }
      this.buckets.set(key, bucket)
    }
    
    // Refill tokens based on time elapsed
    const elapsed = (now - bucket.lastRefill) / 1000
    const tokensToAdd = elapsed * options.refillRate
    bucket.tokens = Math.min(options.capacity, bucket.tokens + tokensToAdd)
    bucket.lastRefill = now
    
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens
      return true
    }
    
    return false
  }

  // DDoS protection: blacklist abusive senders
  blacklistSender(senderId: string, duration: number = 3600000): void {
    this.blacklist.add(senderId)
    setTimeout(() => this.blacklist.delete(senderId), duration)
  }

  isBlacklisted(senderId: string): boolean {
    return this.blacklist.has(senderId)
  }

  // Clean up old data
  cleanup(): void {
    const now = Date.now()
    
    // Clean old request timestamps
    for (const [key, timestamps] of this.requests) {
      const validTimestamps = timestamps.filter(t => now - t < 3600000) // Keep last hour
      if (validTimestamps.length === 0) {
        this.requests.delete(key)
      } else {
        this.requests.set(key, validTimestamps)
      }
    }
  }

  // Get statistics for monitoring
  getStats(): {
    activeKeys: number
    blacklistedSenders: number
    totalRequests: number
  } {
    let totalRequests = 0
    for (const timestamps of this.requests.values()) {
      totalRequests += timestamps.length
    }

    return {
      activeKeys: this.requests.size,
      blacklistedSenders: this.blacklist.size,
      totalRequests
    }
  }
}