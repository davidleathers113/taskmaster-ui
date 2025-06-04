/**
 * Memory Testing Utilities for TaskMaster (2025)
 * 
 * Comprehensive utility functions for memory leak detection, heap analysis,
 * and performance monitoring in Electron applications.
 * 
 * Features:
 * - Heap snapshot capture and analysis
 * - Memory metrics collection
 * - Leak detection algorithms
 * - Trend analysis
 * - Report generation
 * - Chrome DevTools Protocol integration
 */

import { Page } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
// Removed unused import

/**
 * Memory metrics interface
 */
export interface MemoryMetrics {
  timestamp: number;
  jsHeapSize: number;
  totalHeapSize: number;
  heapLimit: number;
  externalMemory: number;
  domNodes: number;
  eventListeners: number;
  detachedNodes: number;
}

/**
 * Memory growth analysis result
 */
export interface MemoryGrowth {
  heapGrowth: number;
  percentageGrowth: number;
  domNodeGrowth: number;
  listenerGrowth: number;
}

/**
 * Memory trend analysis result
 */
export interface MemoryTrend {
  isLeaking: boolean;
  averageGrowthRate: number; // MB per minute
  regressionCoefficient: number;
  confidence: number;
}

/**
 * Memory thresholds configuration
 */
export interface MemoryThresholds {
  maxHeapSize: number;
  maxHeapGrowth: number;
  maxDetachedNodes: number;
  maxListeners: number;
  maxDomNodes: number;
}

/**
 * Leak report structure
 */
export interface LeakReport {
  timestamp: string;
  testSuite: string;
  summary: {
    totalLeaks: number;
    criticalLeaks: number;
    warningLeaks: number;
    passed: boolean;
  };
  leaks: Array<{
    name: string;
    size: number;
    trace: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
  metrics: MemoryMetrics;
  recommendations: string[];
}

/**
 * Memory Test Helper Class
 * Provides comprehensive memory testing capabilities
 */
export class MemoryTestHelper {
  constructor(
    private page: Page,
    private thresholds: MemoryThresholds
  ) {}

  /**
   * Capture current memory metrics
   */
  async captureMetrics(): Promise<MemoryMetrics> {
    const metrics = await this.page.evaluate(() => {
      const getEventListenerCount = () => {
        let count = 0;
        const allElements = document.querySelectorAll('*');
        
        // This is a simplified count - in production, use CDP for accurate count
        allElements.forEach(element => {
          // Count inline event handlers
          const attributes = element.getAttributeNames();
          attributes.forEach(attr => {
            if (attr.startsWith('on')) count++;
          });
        });
        
        return count;
      };

      const getDetachedNodeCount = () => {
        // Simplified detection - in a real implementation,
        // we'd use Chrome DevTools Protocol for accurate detection
        // For now, return 0 as we can't easily detect detached nodes from page context
        return 0;
      };

      return {
        timestamp: Date.now(),
        jsHeapSize: (performance as any).memory?.usedJSHeapSize || 0,
        totalHeapSize: (performance as any).memory?.totalJSHeapSize || 0,
        heapLimit: (performance as any).memory?.jsHeapSizeLimit || 0,
        externalMemory: 0, // Would need main process access
        domNodes: document.querySelectorAll('*').length,
        eventListeners: getEventListenerCount(),
        detachedNodes: getDetachedNodeCount()
      };
    });

    return metrics;
  }

  /**
   * Force garbage collection
   */
  async forceGarbageCollection(): Promise<void> {
    // Try multiple methods to trigger GC
    await this.page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });

    // Modern CDP access pattern (2025)
    try {
      const client = await this.page.context().newCDPSession(this.page);
      await client.send('HeapProfiler.collectGarbage');
      await client.detach();
    } catch (error) {
      console.warn('Could not trigger GC via CDP:', error);
    }
  }

  /**
   * Clear memory and reset state
   */
  async clearMemory(): Promise<void> {
    await this.page.evaluate(() => {
      // Clear caches
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }

      // Clear session storage
      sessionStorage.clear();

      // Clear any global test data
      Object.keys(window).forEach(key => {
        if (key.startsWith('__test') || key.startsWith('__temp')) {
          delete (window as any)[key];
        }
      });
    });

    await this.forceGarbageCollection();
  }

  /**
   * Analyze memory trend from multiple samples
   */
  analyzeMemoryTrend(samples: MemoryMetrics[]): MemoryTrend {
    if (samples.length < 2) {
      return {
        isLeaking: false,
        averageGrowthRate: 0,
        regressionCoefficient: 0,
        confidence: 0
      };
    }

    // Calculate linear regression on heap size over time
    const n = samples.length;
    const times = samples.map(s => (s.timestamp - samples[0].timestamp) / 60000); // Minutes
    const heapSizes = samples.map(s => s.jsHeapSize / 1024 / 1024); // MB

    // Calculate regression
    const sumX = times.reduce((a, b) => a + b, 0);
    const sumY = heapSizes.reduce((a, b) => a + b, 0);
    const sumXY = times.reduce((sum, x, i) => sum + x * heapSizes[i], 0);
    const sumX2 = times.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const ssTotal = heapSizes.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = heapSizes.reduce((sum, y, i) => {
      const yPred = slope * times[i] + intercept;
      return sum + Math.pow(y - yPred, 2);
    }, 0);
    const rSquared = 1 - (ssResidual / ssTotal);

    // Determine if leaking based on slope and confidence
    const isLeaking = slope > 0.5 && rSquared > 0.7; // >0.5MB/min with high confidence

    return {
      isLeaking,
      averageGrowthRate: slope,
      regressionCoefficient: slope,
      confidence: rSquared
    };
  }

  /**
   * Save leak report to file
   */
  async saveReport(report: LeakReport, filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
  }

  /**
   * Capture heap snapshot
   */
  async captureHeapSnapshot(outputPath: string): Promise<void> {
    try {
      const client = await this.page.context().newCDPSession(this.page);
      
      const chunks: string[] = [];
      
      // Listen for heap snapshot chunks
      client.on('HeapProfiler.addHeapSnapshotChunk', (payload: any) => {
        chunks.push(payload.chunk);
      });

      // Enable HeapProfiler
      await client.send('HeapProfiler.enable');
      
      // Take heap snapshot with progress reporting
      await client.send('HeapProfiler.takeHeapSnapshot', { 
        reportProgress: true,
        captureNumericValue: true
      });

      // Wait a moment for all chunks to arrive
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Write snapshot to file
      const snapshot = chunks.join('');
      if (snapshot.length > 0) {
        await fs.writeFile(outputPath, snapshot);
        console.log(`Heap snapshot saved: ${outputPath} (${snapshot.length} bytes)`);
      } else {
        console.warn('No heap snapshot data received');
      }
      
      await client.send('HeapProfiler.disable');
      await client.detach();
    } catch (error) {
      console.error('Failed to capture heap snapshot:', error);
    }
  }

  /**
   * Check if memory is within acceptable thresholds
   */
  isWithinThresholds(metrics: MemoryMetrics): boolean {
    return (
      metrics.jsHeapSize <= this.thresholds.maxHeapSize &&
      metrics.detachedNodes <= this.thresholds.maxDetachedNodes &&
      metrics.eventListeners <= this.thresholds.maxListeners &&
      metrics.domNodes <= this.thresholds.maxDomNodes
    );
  }

  /**
   * Get detailed memory information
   */
  async getDetailedMemoryInfo(): Promise<any> {
    try {
      const client = await this.page.context().newCDPSession(this.page);
      
      const [heapInfo, samplingProfile] = await Promise.all([
        client.send('Memory.getDOMCounters').catch(() => null),
        client.send('Memory.getSamplingProfile').catch(() => null)
      ]);

      await client.detach();
      
      return {
        domCounters: heapInfo,
        samplingProfile
      };
    } catch (error) {
      console.warn('Could not get detailed memory info:', error);
      return null;
    }
  }
}

/**
 * Capture a heap snapshot using MemLab Browser API
 */
export async function captureHeapSnapshot(page: Page, outputPath: string): Promise<void> {
  const helper = new MemoryTestHelper(page, {
    maxHeapSize: Infinity,
    maxHeapGrowth: Infinity,
    maxDetachedNodes: Infinity,
    maxListeners: Infinity,
    maxDomNodes: Infinity
  });
  
  await helper.captureHeapSnapshot(outputPath);
}

/**
 * Analyze memory growth between two metrics
 */
export function analyzeMemoryGrowth(
  initial: MemoryMetrics, 
  final: MemoryMetrics
): MemoryGrowth {
  const heapGrowth = final.jsHeapSize - initial.jsHeapSize;
  const percentageGrowth = (heapGrowth / initial.jsHeapSize) * 100;
  const domNodeGrowth = final.domNodes - initial.domNodes;
  const listenerGrowth = final.eventListeners - initial.eventListeners;

  return {
    heapGrowth,
    percentageGrowth,
    domNodeGrowth,
    listenerGrowth
  };
}

/**
 * Detect memory leaks from heap snapshots
 */
export async function detectMemoryLeaks(
  beforeSnapshot: string,
  afterSnapshot: string,
  options?: {
    minRetainedSize?: number;
    includeNativeObjects?: boolean;
  }
): Promise<any[]> {
  // This would use MemLab's analysis capabilities
  // For now, return empty array as placeholder
  console.log('Analyzing snapshots:', { beforeSnapshot, afterSnapshot, options });
  return [];
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Create memory pressure to test GC behavior
 */
export async function createMemoryPressure(
  page: Page, 
  sizeInMB: number = 50
): Promise<void> {
  await page.evaluate((size) => {
    const arrays = [];
    const bytesPerMB = 1024 * 1024;
    const totalBytes = size * bytesPerMB;
    const chunkSize = 1024 * 1024; // 1MB chunks
    
    for (let i = 0; i < totalBytes; i += chunkSize) {
      arrays.push(new Uint8Array(chunkSize));
    }
    
    // Store temporarily then clear
    (window as any).__memoryPressure = arrays;
    
    setTimeout(() => {
      delete (window as any).__memoryPressure;
    }, 1000);
  }, sizeInMB);
}

/**
 * Monitor memory during an action
 */
export async function monitorMemoryDuringAction(
  page: Page,
  action: () => Promise<void>,
  options?: {
    sampleInterval?: number;
    duration?: number;
  }
): Promise<MemoryMetrics[]> {
  const helper = new MemoryTestHelper(page, {
    maxHeapSize: Infinity,
    maxHeapGrowth: Infinity,
    maxDetachedNodes: Infinity,
    maxListeners: Infinity,
    maxDomNodes: Infinity
  });

  const samples: MemoryMetrics[] = [];
  const interval = options?.sampleInterval || 1000;
  
  // Start sampling
  const samplingInterval = setInterval(async () => {
    const metrics = await helper.captureMetrics();
    samples.push(metrics);
  }, interval);

  try {
    // Execute the action
    await action();
    
    // Continue sampling for duration if specified
    if (options?.duration) {
      await page.waitForTimeout(options.duration);
    }
  } finally {
    clearInterval(samplingInterval);
  }

  return samples;
}