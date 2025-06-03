/**
 * Memory Monitor Utility for Electron Applications (2025)
 * 
 * Provides comprehensive memory monitoring capabilities including
 * real-time monitoring, heap snapshot collection, and leak detection.
 */

import { EventEmitter } from 'events'
import * as v8 from 'v8'
import * as fs from 'fs'
import * as path from 'path'

export interface MemoryMetrics {
  timestamp: number
  heap: {
    used: number
    total: number
    available: number
  }
  external: number
  rss: number
  arrayBuffers: number
}

export interface MemorySnapshot {
  id: string
  filepath: string
  timestamp: number
  metrics: MemoryMetrics
}

export interface GrowthRateOptions {
  maxGrowthRate: number // bytes per second
  measurementWindow: number // milliseconds
  consecutiveViolations: number
}

export interface MemoryGrowthAnalysis {
  growthBytes: number
  growthPercentage: number
  timespan: number
  isLeaking: boolean
  growthRate: number
}

export class MemoryMonitor extends EventEmitter {
  private monitoringInterval: NodeJS.Timeout | null = null
  private snapshots: MemorySnapshot[] = []
  private snapshotDir: string
  private isMonitoring = false
  private growthRateDetector: GrowthRateDetector | null = null

  constructor(snapshotDir?: string) {
    super()
    this.snapshotDir = snapshotDir || path.join(process.cwd(), 'heap-snapshots')
    this.ensureSnapshotDir()
  }

  private ensureSnapshotDir(): void {
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true })
    }
  }

  /**
   * Start real-time memory monitoring
   */
  startMonitoring(interval = 5000, callback?: (metrics: MemoryMetrics) => void): void {
    if (this.isMonitoring) {
      this.stopMonitoring()
    }

    this.isMonitoring = true
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.getCurrentMetrics()
        this.emit('metrics', metrics)
        
        if (callback) {
          callback(metrics)
        }

        // Check for potential leaks
        this.analyzeMemoryTrend(metrics)
      } catch (error) {
        this.emit('error', error)
      }
    }, interval)

    this.emit('monitoring-started', { interval })
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    this.isMonitoring = false
    this.emit('monitoring-stopped')
  }

  /**
   * Get current memory metrics
   */
  async getCurrentMetrics(): Promise<MemoryMetrics> {
    const memUsage = process.memoryUsage()
    
    return {
      timestamp: Date.now(),
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        available: memUsage.heapTotal - memUsage.heapUsed
      },
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers
    }
  }

  /**
   * Take a heap snapshot for analysis
   */
  async takeSnapshot(label = 'snapshot'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${label}-${timestamp}.heapsnapshot`
    const filepath = path.join(this.snapshotDir, filename)

    return new Promise((resolve, reject) => {
      try {
        const snapshot = v8.getHeapSnapshot()
        const fileStream = fs.createWriteStream(filepath)

        snapshot.pipe(fileStream)

        fileStream.on('finish', async () => {
          try {
            const metrics = await this.getCurrentMetrics()
            const snapshotRecord: MemorySnapshot = {
              id: label,
              filepath,
              timestamp: Date.now(),
              metrics
            }

            this.snapshots.push(snapshotRecord)
            this.emit('snapshot-created', snapshotRecord)
            resolve(filepath)
          } catch (error) {
            reject(error)
          }
        })

        fileStream.on('error', reject)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Create a growth rate detector for automated leak detection
   */
  createGrowthRateDetector(options: Partial<GrowthRateOptions> = {}): GrowthRateDetector {
    const defaultOptions: GrowthRateOptions = {
      maxGrowthRate: 1024 * 1024, // 1MB per second
      measurementWindow: 10000, // 10 seconds
      consecutiveViolations: 3
    }

    const finalOptions = { ...defaultOptions, ...options }
    this.growthRateDetector = new GrowthRateDetector(finalOptions)
    
    // Connect to monitoring events
    this.on('metrics', (metrics) => {
      this.growthRateDetector?.addMeasurement(metrics)
    })

    return this.growthRateDetector
  }

  /**
   * Analyze memory growth between two snapshots
   */
  async analyzeMemoryGrowth(
    baseline: MemorySnapshot,
    current: MemorySnapshot
  ): Promise<MemoryGrowthAnalysis> {
    const growthBytes = current.metrics.heap.used - baseline.metrics.heap.used
    const timespan = current.timestamp - baseline.timestamp
    const growthPercentage = (growthBytes / baseline.metrics.heap.used) * 100
    const growthRate = growthBytes / (timespan / 1000) // bytes per second

    // Simple heuristic for leak detection
    const isLeaking = growthRate > 100 * 1024 && growthPercentage > 10 // 100KB/s and 10% growth

    return {
      growthBytes,
      growthPercentage,
      timespan,
      isLeaking,
      growthRate
    }
  }

  /**
   * Analyze memory trend from recent metrics
   */
  private analyzeMemoryTrend(currentMetrics: MemoryMetrics): void {
    // Keep only recent snapshots for trend analysis
    const recentSnapshots = this.snapshots.slice(-10)
    
    if (recentSnapshots.length < 3) return

    const trend = this.calculateMemoryTrend(recentSnapshots)
    if (trend.isIncreasing && trend.rate > 50 * 1024) { // 50KB/s threshold
      this.emit('potential-leak', {
        metrics: currentMetrics,
        trend,
        message: 'Sustained memory growth detected'
      })
    }
  }

  /**
   * Calculate memory growth trend
   */
  private calculateMemoryTrend(snapshots: MemorySnapshot[]) {
    if (snapshots.length < 2) {
      return { isIncreasing: false, rate: 0 }
    }

    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]
    
    const growthBytes = last.metrics.heap.used - first.metrics.heap.used
    const timespan = last.timestamp - first.timestamp
    const rate = growthBytes / (timespan / 1000) // bytes per second

    return {
      isIncreasing: growthBytes > 0,
      rate,
      totalGrowth: growthBytes,
      timespan
    }
  }

  /**
   * Generate memory report
   */
  generateReport(): any {
    const currentMetrics = this.getCurrentMetrics()
    const totalSnapshots = this.snapshots.length
    
    let memoryTrend = null
    if (this.snapshots.length >= 2) {
      const baseline = this.snapshots[0]
      const latest = this.snapshots[this.snapshots.length - 1]
      memoryTrend = this.calculateMemoryTrend([baseline, latest])
    }

    return {
      timestamp: new Date().toISOString(),
      isMonitoring: this.isMonitoring,
      totalSnapshots,
      snapshotDirectory: this.snapshotDir,
      memoryTrend,
      recommendations: this.generateRecommendations(memoryTrend)
    }
  }

  /**
   * Generate recommendations based on memory analysis
   */
  private generateRecommendations(trend: any): string[] {
    const recommendations: string[] = []

    if (trend && trend.isIncreasing && trend.rate > 10 * 1024) {
      recommendations.push('Consider analyzing heap snapshots for potential memory leaks')
      recommendations.push('Review recent code changes for unreleased resources')
    }

    if (trend && trend.rate > 100 * 1024) {
      recommendations.push('URGENT: High memory growth rate detected - investigate immediately')
      recommendations.push('Consider implementing more aggressive garbage collection')
    }

    if (this.snapshots.length === 0) {
      recommendations.push('Take baseline heap snapshots for future comparison')
    }

    return recommendations
  }

  /**
   * Cleanup old snapshots
   */
  cleanupOldSnapshots(maxAge = 24 * 60 * 60 * 1000): void { // 24 hours default
    const cutoff = Date.now() - maxAge
    
    this.snapshots = this.snapshots.filter(snapshot => {
      if (snapshot.timestamp < cutoff) {
        try {
          fs.unlinkSync(snapshot.filepath)
          return false
        } catch (error) {
          // File might already be deleted, keep the record
          return true
        }
      }
      return true
    })
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots]
  }

  /**
   * Check if monitoring is active
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring
  }
}

/**
 * Growth Rate Detector for automatic leak detection
 */
export class GrowthRateDetector extends EventEmitter {
  private measurements: { timestamp: number; heapUsed: number }[] = []
  private violations = 0
  private options: GrowthRateOptions

  constructor(options: GrowthRateOptions) {
    super()
    this.options = options
  }

  addMeasurement(metrics: MemoryMetrics): void {
    const measurement = {
      timestamp: metrics.timestamp,
      heapUsed: metrics.heap.used
    }

    this.measurements.push(measurement)

    // Keep only measurements within the window
    const windowStart = measurement.timestamp - this.options.measurementWindow
    this.measurements = this.measurements.filter(m => m.timestamp >= windowStart)

    if (this.measurements.length >= 2) {
      this.checkGrowthRate()
    }
  }

  private checkGrowthRate(): void {
    const first = this.measurements[0]
    const last = this.measurements[this.measurements.length - 1]

    const growthBytes = last.heapUsed - first.heapUsed
    const timeSpan = last.timestamp - first.timestamp
    const growthRate = (growthBytes / timeSpan) * 1000 // bytes per second

    if (growthRate > this.options.maxGrowthRate) {
      this.violations++
      
      if (this.violations >= this.options.consecutiveViolations) {
        this.emit('leak-detected', {
          growthRate,
          maxAllowed: this.options.maxGrowthRate,
          violations: this.violations,
          measurements: this.measurements.length
        })
      }
    } else {
      this.violations = 0 // Reset on normal measurement
    }
  }

  isMonitoring(): boolean {
    return this.measurements.length > 0
  }

  reset(): void {
    this.measurements = []
    this.violations = 0
  }
}

/**
 * Memory pressure detector
 */
export class MemoryPressureDetector extends EventEmitter {
  private thresholds = {
    warning: 0.8, // 80% of available memory
    critical: 0.95 // 95% of available memory
  }

  checkMemoryPressure(metrics: MemoryMetrics): void {
    const usageRatio = metrics.heap.used / metrics.heap.total
    
    if (usageRatio >= this.thresholds.critical) {
      this.emit('critical-pressure', {
        usageRatio,
        metrics,
        message: 'Critical memory pressure - immediate action required'
      })
    } else if (usageRatio >= this.thresholds.warning) {
      this.emit('warning-pressure', {
        usageRatio,
        metrics,
        message: 'Memory pressure warning - consider cleanup'
      })
    }
  }

  setThresholds(warning: number, critical: number): void {
    this.thresholds = { warning, critical }
  }
}

export default MemoryMonitor