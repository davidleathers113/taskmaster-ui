/**
 * Security Monitor Module (2025)
 * 
 * Real-time security monitoring, alerting, and attack pattern detection
 */

export interface SecurityEvent {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  details: any
  timestamp: number
}

export interface SecurityThreshold {
  count: number
  window: number // milliseconds
}

export interface AttackPattern {
  name: string
  detect: (events: SecurityEvent[]) => boolean
  severity: 'high' | 'critical'
}

export class SecurityMonitor {
  private events: SecurityEvent[] = []
  private alerts: any[] = []
  private thresholds = new Map<string, SecurityThreshold>()
  private attackPatterns: AttackPattern[] = []
  private maxEvents = 10000
  
  constructor() {
    this.setupDefaultThresholds()
    this.setupAttackPatterns()
  }

  private setupDefaultThresholds() {
    this.thresholds.set('rate_limit_exceeded', { count: 10, window: 60000 }) // 10 per minute
    this.thresholds.set('auth_failure', { count: 5, window: 300000 }) // 5 per 5 minutes
    this.thresholds.set('unauthorized_sender', { count: 20, window: 60000 }) // 20 per minute
    this.thresholds.set('invalid_input', { count: 50, window: 300000 }) // 50 per 5 minutes
  }

  private setupAttackPatterns() {
    // Rapid channel switching pattern
    this.attackPatterns.push({
      name: 'rapid_channel_switching',
      severity: 'high',
      detect: (events: SecurityEvent[]) => {
        if (events.length < 10) return false
        
        const recentEvents = events.slice(-20)
        const channels = new Set(recentEvents.map(e => e.details?.channel).filter(Boolean))
        const timeWindow = recentEvents[recentEvents.length - 1].timestamp - recentEvents[0].timestamp
        
        return channels.size > 10 && timeWindow < 5000 // 10+ channels in 5 seconds
      }
    })

    // Privilege escalation attempt pattern
    this.attackPatterns.push({
      name: 'privilege_escalation_attempt',
      severity: 'critical',
      detect: (events: SecurityEvent[]) => {
        const privilegedChannels = ['admin:', 'system:', 'internal:']
        const recentEvents = events.slice(-50)
        
        const privilegedAttempts = recentEvents.filter(e => 
          e.type === 'unauthorized_sender' &&
          privilegedChannels.some(p => e.details?.channel?.startsWith(p))
        )
        
        return privilegedAttempts.length > 5 // Multiple attempts at privileged channels
      }
    })

    // DDoS pattern
    this.attackPatterns.push({
      name: 'ddos_attack',
      severity: 'critical',
      detect: (events: SecurityEvent[]) => {
        const recentEvents = events.slice(-100)
        const rateLimitEvents = recentEvents.filter(e => e.type === 'rate_limit_exceeded')
        const timeWindow = Date.now() - (recentEvents[0]?.timestamp || Date.now())
        
        return rateLimitEvents.length > 50 && timeWindow < 60000 // 50+ rate limits in 1 minute
      }
    })

    // Automated attack pattern (regular intervals)
    this.attackPatterns.push({
      name: 'automated_attack',
      severity: 'high',
      detect: (events: SecurityEvent[]) => {
        if (events.length < 10) return false
        
        const recentEvents = events.slice(-10)
        const intervals: number[] = []
        
        for (let i = 1; i < recentEvents.length; i++) {
          intervals.push(recentEvents[i].timestamp - recentEvents[i-1].timestamp)
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const variance = intervals.reduce((sum, interval) => 
          sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length
        
        return variance < 100 // Very regular intervals (within 10ms variance)
      }
    })
  }

  logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      id: `SEC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }

    this.events.push(fullEvent)
    
    // Trim events if exceeding max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }

    // Check thresholds
    this.checkThresholds(event.type)
    
    // Check attack patterns
    this.checkAttackPatterns()
  }

  private checkThresholds(eventType: string): void {
    const threshold = this.thresholds.get(eventType)
    if (!threshold) return

    const now = Date.now()
    const recentEvents = this.events.filter(e => 
      e.type === eventType && 
      now - e.timestamp < threshold.window
    )

    if (recentEvents.length >= threshold.count) {
      this.triggerAlert({
        type: 'threshold_exceeded',
        eventType,
        count: recentEvents.length,
        threshold: threshold.count,
        window: threshold.window,
        timestamp: now
      })
    }
  }

  private checkAttackPatterns(): void {
    for (const pattern of this.attackPatterns) {
      if (pattern.detect(this.events)) {
        this.triggerAlert({
          type: 'attack_pattern_detected',
          pattern: pattern.name,
          severity: pattern.severity,
          timestamp: Date.now()
        })
      }
    }
  }

  private triggerAlert(alert: any): void {
    // Avoid duplicate alerts within 5 minutes
    const recentAlert = this.alerts.find(a => 
      a.type === alert.type &&
      a.eventType === alert.eventType &&
      a.pattern === alert.pattern &&
      Date.now() - a.timestamp < 300000
    )

    if (recentAlert) return

    this.alerts.push(alert)
    
    // In production, this would trigger actual alerts (email, monitoring system, etc.)
    console.error('SECURITY ALERT:', alert)
  }

  getRecentEvents(count: number = 100): SecurityEvent[] {
    return this.events.slice(-count)
  }

  getEventsByType(type: string, timeWindow?: number): SecurityEvent[] {
    const cutoff = timeWindow ? Date.now() - timeWindow : 0
    return this.events.filter(e => 
      e.type === type && 
      e.timestamp > cutoff
    )
  }

  getHighSeverityEvents(): SecurityEvent[] {
    return this.events.filter(e => e.severity === 'high' || e.severity === 'critical')
  }

  getAlerts(): any[] {
    return [...this.alerts]
  }

  // DDoS detection specific methods
  detectFloodingAttack(senderId: string, threshold: number = 100): boolean {
    const recentEvents = this.events.filter(e => 
      e.details?.senderId === senderId &&
      Date.now() - e.timestamp < 1000 // Last second
    )
    
    return recentEvents.length > threshold
  }

  // Get security metrics
  getMetrics() {
    const now = Date.now()
    const last5Min = now - 300000
    const last1Hour = now - 3600000

    return {
      totalEvents: this.events.length,
      eventsLast5Min: this.events.filter(e => e.timestamp > last5Min).length,
      eventsLastHour: this.events.filter(e => e.timestamp > last1Hour).length,
      alertsTriggered: this.alerts.length,
      severityBreakdown: {
        low: this.events.filter(e => e.severity === 'low').length,
        medium: this.events.filter(e => e.severity === 'medium').length,
        high: this.events.filter(e => e.severity === 'high').length,
        critical: this.events.filter(e => e.severity === 'critical').length
      }
    }
  }

  // Clean up old data
  cleanup(): void {
    const cutoff = Date.now() - 86400000 // Keep last 24 hours
    this.events = this.events.filter(e => e.timestamp > cutoff)
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff)
  }
}