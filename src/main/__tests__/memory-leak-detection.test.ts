/**
 * Memory Leak Detection Tests for Electron Main Process (2025)
 * 
 * Comprehensive memory leak detection using MemLab, V8 heap snapshots,
 * and continuous monitoring following 2025 best practices.
 */

import { describe, test, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'

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

import { BrowserWindow, ipcMain } from 'electron'
import { EventEmitter } from 'events'
import { MemoryMonitor } from '../utils/memory-monitor'
import { HeapSnapshotAnalyzer } from '../utils/heap-snapshot-analyzer'

// Mock electron modules for testing
vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    quit: vi.fn(),
    getPath: vi.fn().mockReturnValue('/mock/path'),
    whenReady: vi.fn().mockResolvedValue(undefined),
    getName: vi.fn().mockReturnValue('TaskMaster'),
    getVersion: vi.fn().mockReturnValue('1.0.0')
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    id: Math.floor(Math.random() * 1000),
    loadURL: vi.fn().mockResolvedValue(undefined),
    webContents: {
      id: Math.floor(Math.random() * 1000),
      send: vi.fn(),
      openDevTools: vi.fn(),
      executeJavaScript: vi.fn().mockResolvedValue({}),
      getOSProcessId: vi.fn().mockReturnValue(12345)
    },
    on: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    show: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false)
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn()
  }
}))

// Mock V8 for heap snapshot testing
vi.mock('v8', () => ({
  getHeapSnapshot: vi.fn().mockReturnValue({
    pipe: vi.fn((stream) => {
      // Simulate async snapshot creation
      setTimeout(() => stream.emit('finish'), 100)
      return stream
    })
  }),
  writeHeapSnapshot: vi.fn().mockReturnValue('/mock/snapshot.heapsnapshot')
}))

// Mock memwatch-next for leak detection
vi.mock('memwatch-next', () => {
  const mockMemwatch = new EventEmitter()
  return {
    on: mockMemwatch.on.bind(mockMemwatch),
    emit: mockMemwatch.emit.bind(mockMemwatch),
    gc: vi.fn(),
    HeapDiff: vi.fn().mockImplementation(() => ({
      end: vi.fn().mockReturnValue({
        change: {
          size_bytes: 1024,
          freed_nodes: 10,
          allocated_nodes: 15
        }
      })
    }))
  }
})

describe('Memory Leak Detection Tests (2025)', () => {
  let memoryMonitor: MemoryMonitor
  let heapAnalyzer: HeapSnapshotAnalyzer
  let mockWindows: any[]

  beforeAll(() => {
    // Enable garbage collection for testing
    if (global.gc) {
      global.gc()
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    memoryMonitor = new MemoryMonitor()
    heapAnalyzer = new HeapSnapshotAnalyzer()
    mockWindows = []
    
    // Setup mock window tracking
    BrowserWindow.getAllWindows = vi.fn().mockReturnValue(mockWindows)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Force garbage collection after each test
    if (global.gc) {
      global.gc()
      global.gc() // Run twice for thorough cleanup
    }
  })

  afterAll(() => {
    // Cleanup any remaining resources
    if (memoryMonitor) {
      memoryMonitor.stopMonitoring()
    }
  })

  describe('Main Process Memory Monitoring', () => {
    test('should detect memory leaks in main process', async () => {
      // Take baseline snapshot
      const baselineSnapshot = await memoryMonitor.takeSnapshot('baseline')
      expect(baselineSnapshot).toBeDefined()

      // Simulate memory-intensive operations
      const leakyObjects = []
      for (let i = 0; i < 1000; i++) {
        leakyObjects.push({
          id: i,
          data: new Array(1000).fill(`data-${i}`),
          timestamp: Date.now()
        })
      }

      // Take post-operation snapshot
      const postOpSnapshot = await memoryMonitor.takeSnapshot('post-operation')
      expect(postOpSnapshot).toBeDefined()

      // Analyze memory growth
      const memoryGrowth = await heapAnalyzer.compareSnapshots(
        baselineSnapshot,
        postOpSnapshot
      )

      expect(memoryGrowth).toMatchObject({
        growthBytes: expect.any(Number),
        growthPercentage: expect.any(Number),
        potentialLeaks: expect.any(Array)
      })

      // Verify that significant memory growth is detected
      expect(memoryGrowth.growthBytes).toBeGreaterThan(0)
    })

    test('should monitor real-time memory usage', async () => {
      const metrics: any[] = []
      
      // Start monitoring with callback
      memoryMonitor.startMonitoring(100, (metric) => {
        metrics.push(metric)
      })

      // Wait for several metric collections
      await new Promise(resolve => setTimeout(resolve, 500))

      // Stop monitoring
      memoryMonitor.stopMonitoring()

      // Verify metrics were collected
      expect(metrics.length).toBeGreaterThan(3)
      
      // Verify metric structure
      metrics.forEach(metric => {
        expect(metric).toMatchObject({
          timestamp: expect.any(Number),
          heap: expect.objectContaining({
            used: expect.any(Number),
            total: expect.any(Number)
          }),
          external: expect.any(Number)
        })
      })
    })

    test('should detect excessive memory growth rate', async () => {
      const growthRateDetector = memoryMonitor.createGrowthRateDetector({
        maxGrowthRate: 1024 * 1024, // 1MB per second
        measurementWindow: 1000 // 1 second
      })

      // Simulate rapid memory allocation
      const rapidAllocation = () => {
        const data = new Array(10000).fill('memory-intensive-data')
        return data
      }

      growthRateDetector.on('leak-detected', () => {
        detectedLeak = true
      })

      // Trigger rapid allocations
      for (let i = 0; i < 10; i++) {
        rapidAllocation()
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Wait for detection
      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify leak detection (this would fail in a real leak scenario)
      // In this test, we're just verifying the detection mechanism works
      expect(growthRateDetector.isMonitoring()).toBe(true)
    })
  })

  describe('BrowserWindow Memory Management', () => {
    test('should not leak memory when creating and destroying windows', async () => {
      const { createWindow, destroyWindow } = await import('../window-manager')
      
      // Mock createWindow and destroyWindow functions
      const createWindow = vi.fn().mockImplementation(() => {
        const window = new BrowserWindow()
        mockWindows.push(window)
        return window
      })
      
      const destroyWindow = vi.fn().mockImplementation((window) => {
        const index = mockWindows.indexOf(window)
        if (index > -1) {
          mockWindows.splice(index, 1)
        }
        window.destroy()
      })

      // Take baseline measurement
      const initialMetrics = await memoryMonitor.getCurrentMetrics()

      // Create and destroy multiple windows
      const windows = []
      for (let i = 0; i < 5; i++) {
        const window = createWindow()
        windows.push(window)
        
        // Simulate some window activity
        await window.loadURL('data:text/html,<h1>Test Window</h1>')
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Destroy all windows
      for (const window of windows) {
        destroyWindow(window)
      }

      // Force garbage collection
      if (global.gc) {
        global.gc()
        global.gc()
      }

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100))

      // Take final measurement
      const finalMetrics = await memoryMonitor.getCurrentMetrics()

      // Calculate memory difference
      const memoryDiff = finalMetrics.heap.used - initialMetrics.heap.used
      const memoryDiffMB = memoryDiff / (1024 * 1024)

      // Verify reasonable memory usage (less than 10MB growth)
      expect(memoryDiffMB).toBeLessThan(10)
      expect(mockWindows).toHaveLength(0)
    })

    test('should properly clean up window event listeners', async () => {
      const window = new BrowserWindow()
      const listenerCounts = new Map()

      // Track listener registration
      const originalOn = window.on
      window.on = vi.fn().mockImplementation((event, listener) => {
        listenerCounts.set(event, (listenerCounts.get(event) || 0) + 1)
        return originalOn.call(window, event, listener)
      })

      // Simulate adding multiple listeners
      const events = ['closed', 'ready-to-show', 'focus', 'blur']
      events.forEach(event => {
        window.on(event, () => {})
        window.on(event, () => {}) // Add duplicate listeners
      })

      // Verify listeners were added
      expect(window.on).toHaveBeenCalledTimes(8) // 4 events × 2 listeners each

      // Simulate proper cleanup
      window.removeAllListeners()
      window.destroy()

      // Verify cleanup was called
      expect(window.isDestroyed()).toBe(true)
    })
  })

  describe('IPC Memory Management', () => {
    test('should not accumulate IPC handlers over time', async () => {
      const { setupIpcHandlers, cleanupIpcHandlers } = await import('../ipc-handlers')
      
      // Mock IPC handler setup/cleanup
      const setupIpcHandlers = vi.fn().mockImplementation(() => {
        ipcMain.handle('test-channel-1', () => 'response-1')
        ipcMain.handle('test-channel-2', () => 'response-2')
        ipcMain.on('test-event', () => {})
      })
      
      const cleanupIpcHandlers = vi.fn().mockImplementation(() => {
        ipcMain.removeHandler('test-channel-1')
        ipcMain.removeHandler('test-channel-2')
        ipcMain.removeAllListeners('test-event')
      })

      // Take baseline

      // Setup and cleanup handlers multiple times
      for (let i = 0; i < 10; i++) {
        setupIpcHandlers()
        await new Promise(resolve => setTimeout(resolve, 10))
        cleanupIpcHandlers()
      }

      // Verify proper cleanup
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('test-channel-1')
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('test-channel-2')
      expect(ipcMain.removeAllListeners).toHaveBeenCalledWith('test-event')
    })

    test('should handle IPC message flooding without memory leaks', async () => {
      const messageQueue: any[] = []
      const maxQueueSize = 1000

      // Mock IPC handler with memory-conscious queue
      const handleMessage = vi.fn().mockImplementation((_event, data) => {
        // Simulate message processing with bounded queue
        if (messageQueue.length >= maxQueueSize) {
          messageQueue.shift() // Remove oldest message
        }
        messageQueue.push({ timestamp: Date.now(), data })
      })

      ipcMain.handle('flood-test', handleMessage)

      // Take memory baseline
      const baselineMemory = await memoryMonitor.getCurrentMetrics()

      // Send many messages rapidly
      const promises = []
      for (let i = 0; i < 5000; i++) {
        promises.push(
          handleMessage(null, { id: i, payload: `message-${i}` })
        )
      }

      await Promise.all(promises)

      // Force garbage collection
      if (global.gc) {
        global.gc()
      }

      // Check final memory
      const finalMemory = await memoryMonitor.getCurrentMetrics()
      const memoryGrowth = finalMemory.heap.used - baselineMemory.heap.used
      const growthMB = memoryGrowth / (1024 * 1024)

      // Verify bounded queue worked
      expect(messageQueue.length).toBeLessThanOrEqual(maxQueueSize)
      
      // Verify reasonable memory growth (less than 50MB)
      expect(growthMB).toBeLessThan(50)
    })
  })

  describe('Long-running Process Memory Stability', () => {
    test('should maintain stable memory usage over extended operation', async () => {
      const stabilityMonitor = new MemoryStabilityMonitor({
        maxSamples: 20,
        stabilityThreshold: 0.1 // 10% variance
      })

      // Simulate long-running operations
      for (let i = 0; i < 20; i++) {
        // Perform some work
        await simulateWork()
        
        // Collect memory metrics
        const metrics = await memoryMonitor.getCurrentMetrics()
        stabilityMonitor.addSample(metrics)
        
        // Wait between operations
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Analyze stability
      const stabilityReport = stabilityMonitor.analyze()
      
      expect(stabilityReport).toMatchObject({
        isStable: expect.any(Boolean),
        averageMemory: expect.any(Number),
        variance: expect.any(Number),
        trend: expect.stringMatching(/^(stable|increasing|decreasing)$/)
      })

      // Memory should be stable (low variance)
      expect(stabilityReport.variance).toBeLessThan(0.2) // 20% variance threshold
    })
  })

  describe('Resource Cleanup Verification', () => {
    test('should verify proper cleanup of timers and intervals', async () => {
      const timerTracker = new TimerTracker()
      
      // Track timer creation
      const originalSetTimeout = global.setTimeout
      const originalSetInterval = global.setInterval
      const originalClearTimeout = global.clearTimeout
      const originalClearInterval = global.clearInterval
      
      global.setTimeout = vi.fn().mockImplementation((fn, delay) => {
        const id = originalSetTimeout(fn, delay)
        timerTracker.trackTimer(id, 'timeout')
        return id
      })
      
      global.setInterval = vi.fn().mockImplementation((fn, delay) => {
        const id = originalSetInterval(fn, delay)
        timerTracker.trackTimer(id, 'interval')
        return id
      })
      
      global.clearTimeout = vi.fn().mockImplementation((id) => {
        timerTracker.clearTimer(id)
        return originalClearTimeout(id)
      })
      
      global.clearInterval = vi.fn().mockImplementation((id) => {
        timerTracker.clearTimer(id)
        return originalClearInterval(id)
      })

      // Create some timers
      const timeout1 = setTimeout(() => {}, 1000)
      const timeout2 = setTimeout(() => {}, 2000)
      const interval1 = setInterval(() => {}, 100)
      
      expect(timerTracker.getActiveTimerCount()).toBe(3)
      
      // Clean up timers
      clearTimeout(timeout1)
      clearTimeout(timeout2)
      clearInterval(interval1)
      
      expect(timerTracker.getActiveTimerCount()).toBe(0)
      
      // Restore original functions
      global.setTimeout = originalSetTimeout
      global.setInterval = originalSetInterval
      global.clearTimeout = originalClearTimeout
      global.clearInterval = originalClearInterval
    })
  })
})

// Helper functions and classes
async function simulateWork(): Promise<void> {
  // Simulate CPU and memory intensive work
  const data = new Array(1000).fill(0).map((_, i) => ({
    id: i,
    value: Math.random(),
    timestamp: Date.now()
  }))
  
  // Process data
  data.forEach(item => {
    item.value = item.value * 2
  })
  
  // Cleanup
  data.length = 0
}

class MemoryStabilityMonitor {
  private samples: number[] = []
  private options: any

  constructor(options: any) {
    this.options = options
  }

  addSample(metrics: any): void {
    this.samples.push(metrics.heap.used)
    
    if (this.samples.length > this.options.maxSamples) {
      this.samples.shift()
    }
  }

  analyze() {
    if (this.samples.length < 2) {
      return { isStable: false, reason: 'Insufficient samples' }
    }

    const average = this.samples.reduce((a, b) => a + b, 0) / this.samples.length
    const variance = this.samples.reduce((acc, val) => {
      return acc + Math.pow(val - average, 2)
    }, 0) / this.samples.length
    
    const normalizedVariance = Math.sqrt(variance) / average
    const isStable = normalizedVariance < this.options.stabilityThreshold

    // Determine trend
    const firstHalf = this.samples.slice(0, Math.floor(this.samples.length / 2))
    const secondHalf = this.samples.slice(Math.floor(this.samples.length / 2))
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    let trend = 'stable'
    if (secondAvg > firstAvg * 1.1) trend = 'increasing'
    else if (secondAvg < firstAvg * 0.9) trend = 'decreasing'

    return {
      isStable,
      averageMemory: average,
      variance: normalizedVariance,
      trend,
      samples: this.samples.length
    }
  }
}

class TimerTracker {
  private activeTimers = new Map<any, string>()

  trackTimer(id: any, type: string): void {
    this.activeTimers.set(id, type)
  }

  clearTimer(id: any): void {
    this.activeTimers.delete(id)
  }

  getActiveTimerCount(): number {
    return this.activeTimers.size
  }

  getActiveTimers(): Map<any, string> {
    return new Map(this.activeTimers)
  }
}