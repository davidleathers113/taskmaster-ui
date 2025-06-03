/**
 * Performance Benchmarking Utilities for Electron App
 * 
 * Comprehensive performance measurement including:
 * - CPU usage profiling
 * - Memory allocation tracking
 * - Disk I/O monitoring
 * - Network performance
 * - Rendering performance
 */

import { Page, ElectronApplication } from '@playwright/test';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PerformanceMetrics {
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  rendering: RenderingMetrics;
  network: NetworkMetrics;
  timestamp: number;
}

export interface CPUMetrics {
  usage: number; // Percentage
  systemLoad: number[];
  processTime: number;
  idleTime: number;
}

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number; // Resident Set Size
  arrayBuffers: number;
}

export interface DiskMetrics {
  readBytes: number;
  writeBytes: number;
  readOperations: number;
  writeOperations: number;
}

export interface RenderingMetrics {
  fps: number;
  jank: number;
  paintTime: number;
  layoutTime: number;
}

export interface NetworkMetrics {
  requestCount: number;
  bytesReceived: number;
  bytesSent: number;
  avgLatency: number;
}

export class PerformanceBenchmark {
  private startCPUUsage: NodeJS.CpuUsage | null = null;
  private startTime: number = 0;
  private metricsHistory: PerformanceMetrics[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  
  constructor(
    private page: Page,
    private app?: ElectronApplication
  ) {}
  
  /**
   * Start collecting performance metrics
   */
  async startBenchmark(intervalMs: number = 1000): Promise<void> {
    this.startTime = Date.now();
    this.startCPUUsage = process.cpuUsage();
    
    // Set up performance observer in the page
    await this.page.evaluate(() => {
      (window as any).__performanceMetrics = {
        fps: [],
        paintTimes: [],
        layoutTimes: [],
        longTasks: []
      };
      
      // FPS calculation
      let lastTime = performance.now();
      let frameCount = 0;
      
      const calculateFPS = (currentTime: number) => {
        frameCount++;
        if (currentTime - lastTime >= 1000) {
          (window as any).__performanceMetrics.fps.push({
            value: frameCount,
            timestamp: currentTime
          });
          frameCount = 0;
          lastTime = currentTime;
        }
        requestAnimationFrame(calculateFPS);
      };
      requestAnimationFrame(calculateFPS);
      
      // Performance observer for paint and layout metrics
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint') {
            (window as any).__performanceMetrics.paintTimes.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration
            });
          } else if (entry.entryType === 'layout-shift') {
            (window as any).__performanceMetrics.layoutTimes.push({
              value: (entry as any).value,
              startTime: entry.startTime
            });
          } else if (entry.entryType === 'longtask') {
            (window as any).__performanceMetrics.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        }
      });
      
      observer.observe({ 
        entryTypes: ['paint', 'layout-shift', 'longtask', 'measure'] 
      });
    });
    
    // Start periodic metric collection
    this.intervalId = setInterval(async () => {
      const metrics = await this.collectMetrics();
      this.metricsHistory.push(metrics);
    }, intervalMs);
  }
  
  /**
   * Stop collecting metrics and return results
   */
  async stopBenchmark(): Promise<BenchmarkResults> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Collect final metrics
    const finalMetrics = await this.collectMetrics();
    this.metricsHistory.push(finalMetrics);
    
    // Calculate summary statistics
    return this.analyzeBenchmarkResults();
  }
  
  /**
   * Collect current performance metrics
   */
  private async collectMetrics(): Promise<PerformanceMetrics> {
    const [cpu, memory, disk, rendering, network] = await Promise.all([
      this.collectCPUMetrics(),
      this.collectMemoryMetrics(),
      this.collectDiskMetrics(),
      this.collectRenderingMetrics(),
      this.collectNetworkMetrics()
    ]);
    
    return {
      cpu,
      memory,
      disk,
      rendering,
      network,
      timestamp: Date.now()
    };
  }
  
  /**
   * Collect CPU metrics
   */
  private async collectCPUMetrics(): Promise<CPUMetrics> {
    const cpuUsage = process.cpuUsage(this.startCPUUsage || undefined);
    const loadAvg = os.loadavg();
    
    // Calculate CPU percentage
    const elapsedTime = Date.now() - this.startTime;
    const totalCPUTime = cpuUsage.user + cpuUsage.system;
    const cpuPercent = (totalCPUTime / 1000 / elapsedTime) * 100;
    
    return {
      usage: cpuPercent,
      systemLoad: loadAvg,
      processTime: totalCPUTime,
      idleTime: elapsedTime * 1000 - totalCPUTime
    };
  }
  
  /**
   * Collect memory metrics
   */
  private async collectMemoryMetrics(): Promise<MemoryMetrics> {
    const memUsage = process.memoryUsage();
    
    // Also get browser memory if available
    const browserMemory = await this.page.evaluate(() => {
      const memory = (performance as any).memory;
      return memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize
      } : null;
    });
    
    return {
      heapUsed: browserMemory?.usedJSHeapSize || memUsage.heapUsed,
      heapTotal: browserMemory?.totalJSHeapSize || memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0
    };
  }
  
  /**
   * Collect disk I/O metrics (simulated for now)
   */
  private async collectDiskMetrics(): Promise<DiskMetrics> {
    // Note: Real disk I/O monitoring would require native modules
    // This is a simplified version that tracks file operations
    
    const diskMetrics = await this.page.evaluate(() => {
      // Track localStorage/sessionStorage operations as proxy for disk I/O
      const storage = {
        reads: parseInt(localStorage.getItem('__diskReads') || '0'),
        writes: parseInt(localStorage.getItem('__diskWrites') || '0')
      };
      
      return storage;
    });
    
    return {
      readBytes: diskMetrics.reads * 1024, // Estimate
      writeBytes: diskMetrics.writes * 1024,
      readOperations: diskMetrics.reads,
      writeOperations: diskMetrics.writes
    };
  }
  
  /**
   * Collect rendering performance metrics
   */
  private async collectRenderingMetrics(): Promise<RenderingMetrics> {
    const metrics = await this.page.evaluate(() => {
      const perfMetrics = (window as any).__performanceMetrics || {};
      
      // Calculate average FPS
      const fpsData = perfMetrics.fps || [];
      const avgFPS = fpsData.length > 0
        ? fpsData.reduce((sum: number, item: any) => sum + item.value, 0) / fpsData.length
        : 60;
      
      // Calculate jank (frames that took > 16.67ms)
      const longTasks = perfMetrics.longTasks || [];
      const jankCount = longTasks.filter((task: any) => task.duration > 50).length;
      
      // Calculate paint times
      const paintTimes = perfMetrics.paintTimes || [];
      const avgPaintTime = paintTimes.length > 0
        ? paintTimes.reduce((sum: number, item: any) => sum + (item.duration || 0), 0) / paintTimes.length
        : 0;
      
      // Calculate layout shift
      const layoutShifts = perfMetrics.layoutTimes || [];
      const totalLayoutShift = layoutShifts.reduce((sum: number, item: any) => sum + (item.value || 0), 0);
      
      return {
        fps: avgFPS,
        jank: jankCount,
        paintTime: avgPaintTime,
        layoutTime: totalLayoutShift
      };
    });
    
    return metrics;
  }
  
  /**
   * Collect network metrics
   */
  private async collectNetworkMetrics(): Promise<NetworkMetrics> {
    const networkData = await this.page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      let totalBytes = 0;
      let totalLatency = 0;
      let requestCount = entries.length;
      
      entries.forEach(entry => {
        // Estimate bytes based on timing (rough approximation)
        const duration = entry.responseEnd - entry.startTime;
        totalBytes += duration * 1000; // Very rough estimate
        
        // Calculate latency
        const latency = entry.responseStart - entry.fetchStart;
        totalLatency += latency;
      });
      
      return {
        requestCount,
        bytesReceived: totalBytes,
        avgLatency: requestCount > 0 ? totalLatency / requestCount : 0
      };
    });
    
    return {
      requestCount: networkData.requestCount,
      bytesReceived: networkData.bytesReceived,
      bytesSent: 0, // Would need to intercept requests to get this
      avgLatency: networkData.avgLatency
    };
  }
  
  /**
   * Analyze benchmark results and provide summary
   */
  private analyzeBenchmarkResults(): BenchmarkResults {
    const summary = {
      duration: Date.now() - this.startTime,
      sampleCount: this.metricsHistory.length,
      cpu: this.calculateAverageMetric('cpu'),
      memory: this.calculateAverageMetric('memory'),
      disk: this.calculateAverageMetric('disk'),
      rendering: this.calculateAverageMetric('rendering'),
      network: this.calculateAverageMetric('network'),
      performance: this.calculatePerformanceScore()
    };
    
    return {
      summary,
      history: this.metricsHistory,
      recommendations: this.generateRecommendations(summary)
    };
  }
  
  /**
   * Calculate average for a metric category
   */
  private calculateAverageMetric(category: keyof PerformanceMetrics): any {
    if (this.metricsHistory.length === 0) return null;
    
    const values = this.metricsHistory.map(m => m[category]);
    
    // Calculate averages for each property
    const result: any = {};
    const firstValue = values[0];
    
    Object.keys(firstValue).forEach(key => {
      if (typeof firstValue[key] === 'number') {
        const sum = values.reduce((acc, val) => acc + val[key], 0);
        result[key] = sum / values.length;
      } else if (Array.isArray(firstValue[key])) {
        // For arrays, take the average of each position
        result[key] = firstValue[key].map((_, index) => {
          const sum = values.reduce((acc, val) => acc + (val[key][index] || 0), 0);
          return sum / values.length;
        });
      }
    });
    
    return result;
  }
  
  /**
   * Calculate overall performance score
   */
  private calculatePerformanceScore(): number {
    const summary = {
      cpu: this.calculateAverageMetric('cpu'),
      memory: this.calculateAverageMetric('memory'),
      rendering: this.calculateAverageMetric('rendering')
    };
    
    let score = 100;
    
    // CPU score (0-25 points)
    if (summary.cpu.usage > 80) score -= 25;
    else if (summary.cpu.usage > 60) score -= 15;
    else if (summary.cpu.usage > 40) score -= 5;
    
    // Memory score (0-25 points)
    const memoryUsagePercent = (summary.memory.heapUsed / summary.memory.heapTotal) * 100;
    if (memoryUsagePercent > 90) score -= 25;
    else if (memoryUsagePercent > 75) score -= 15;
    else if (memoryUsagePercent > 60) score -= 5;
    
    // Rendering score (0-25 points)
    if (summary.rendering.fps < 30) score -= 25;
    else if (summary.rendering.fps < 50) score -= 15;
    else if (summary.rendering.fps < 55) score -= 5;
    
    // Jank score (0-25 points)
    if (summary.rendering.jank > 10) score -= 25;
    else if (summary.rendering.jank > 5) score -= 15;
    else if (summary.rendering.jank > 2) score -= 5;
    
    return Math.max(0, score);
  }
  
  /**
   * Generate performance recommendations
   */
  private generateRecommendations(summary: any): string[] {
    const recommendations: string[] = [];
    
    // CPU recommendations
    if (summary.cpu.usage > 60) {
      recommendations.push('High CPU usage detected. Consider optimizing computationally intensive operations.');
    }
    
    // Memory recommendations
    const memoryUsagePercent = (summary.memory.heapUsed / summary.memory.heapTotal) * 100;
    if (memoryUsagePercent > 75) {
      recommendations.push('High memory usage detected. Check for memory leaks and optimize data structures.');
    }
    
    // Rendering recommendations
    if (summary.rendering.fps < 50) {
      recommendations.push('Low frame rate detected. Optimize animations and reduce DOM manipulations.');
    }
    
    if (summary.rendering.jank > 5) {
      recommendations.push('Jank detected. Break up long-running tasks and use requestIdleCallback for non-critical work.');
    }
    
    // Network recommendations
    if (summary.network.avgLatency > 500) {
      recommendations.push('High network latency detected. Consider implementing caching and reducing API calls.');
    }
    
    return recommendations;
  }
  
  /**
   * Export benchmark results to file
   */
  async exportResults(outputPath: string): Promise<void> {
    const results = this.analyzeBenchmarkResults();
    const data = {
      ...results,
      metadata: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      }
    };
    
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
  }
}

export interface BenchmarkResults {
  summary: {
    duration: number;
    sampleCount: number;
    cpu: any;
    memory: any;
    disk: any;
    rendering: any;
    network: any;
    performance: number;
  };
  history: PerformanceMetrics[];
  recommendations: string[];
}

/**
 * Profile a specific operation
 */
export async function profileOperation<T>(
  name: string,
  operation: () => Promise<T>,
  page?: Page
): Promise<{ result: T; profile: OperationProfile }> {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  const startCPU = process.cpuUsage();
  
  // Mark in browser if page is available
  if (page) {
    await page.evaluate((opName) => {
      performance.mark(`${opName}-start`);
    }, name);
  }
  
  // Execute operation
  const result = await operation();
  
  // Collect end metrics
  const endTime = Date.now();
  const endMemory = process.memoryUsage();
  const endCPU = process.cpuUsage(startCPU);
  
  // Mark end in browser
  if (page) {
    await page.evaluate((opName) => {
      performance.mark(`${opName}-end`);
      performance.measure(opName, `${opName}-start`, `${opName}-end`);
    }, name);
  }
  
  const profile: OperationProfile = {
    name,
    duration: endTime - startTime,
    cpu: {
      user: endCPU.user / 1000, // Convert to ms
      system: endCPU.system / 1000
    },
    memory: {
      heapDelta: endMemory.heapUsed - startMemory.heapUsed,
      rssDelta: endMemory.rss - startMemory.rss
    }
  };
  
  return { result, profile };
}

export interface OperationProfile {
  name: string;
  duration: number;
  cpu: {
    user: number;
    system: number;
  };
  memory: {
    heapDelta: number;
    rssDelta: number;
  };
}

/**
 * Create a performance report
 */
export async function createPerformanceReport(
  benchmarkResults: BenchmarkResults,
  outputDir: string
): Promise<string> {
  const reportPath = path.join(outputDir, `performance-report-${Date.now()}.html`);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Performance Benchmark Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .metric { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    .score { font-size: 48px; font-weight: bold; color: ${benchmarkResults.summary.performance > 80 ? '#4CAF50' : benchmarkResults.summary.performance > 60 ? '#FF9800' : '#F44336'}; }
    .recommendation { background: #FFF3E0; padding: 10px; margin: 10px 0; border-radius: 5px; }
    canvas { max-width: 100%; height: 300px; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <h1>Performance Benchmark Report</h1>
  
  <div class="metric">
    <h2>Overall Performance Score</h2>
    <div class="score">${benchmarkResults.summary.performance}/100</div>
  </div>
  
  <div class="metric">
    <h2>Test Summary</h2>
    <p>Duration: ${(benchmarkResults.summary.duration / 1000).toFixed(2)}s</p>
    <p>Samples: ${benchmarkResults.summary.sampleCount}</p>
  </div>
  
  <div class="metric">
    <h2>CPU Performance</h2>
    <p>Average Usage: ${benchmarkResults.summary.cpu.usage.toFixed(2)}%</p>
    <canvas id="cpuChart"></canvas>
  </div>
  
  <div class="metric">
    <h2>Memory Performance</h2>
    <p>Heap Used: ${(benchmarkResults.summary.memory.heapUsed / 1024 / 1024).toFixed(2)} MB</p>
    <p>Total Heap: ${(benchmarkResults.summary.memory.heapTotal / 1024 / 1024).toFixed(2)} MB</p>
    <canvas id="memoryChart"></canvas>
  </div>
  
  <div class="metric">
    <h2>Rendering Performance</h2>
    <p>Average FPS: ${benchmarkResults.summary.rendering.fps.toFixed(2)}</p>
    <p>Jank Count: ${benchmarkResults.summary.rendering.jank}</p>
  </div>
  
  <div class="metric">
    <h2>Recommendations</h2>
    ${benchmarkResults.recommendations.map(rec => `<div class="recommendation">${rec}</div>`).join('')}
  </div>
  
  <script>
    // CPU Chart
    const cpuCtx = document.getElementById('cpuChart').getContext('2d');
    new Chart(cpuCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(benchmarkResults.history.map((_, i) => i))},
        datasets: [{
          label: 'CPU Usage %',
          data: ${JSON.stringify(benchmarkResults.history.map(m => m.cpu.usage))},
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      }
    });
    
    // Memory Chart
    const memCtx = document.getElementById('memoryChart').getContext('2d');
    new Chart(memCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(benchmarkResults.history.map((_, i) => i))},
        datasets: [{
          label: 'Heap Used (MB)',
          data: ${JSON.stringify(benchmarkResults.history.map(m => m.memory.heapUsed / 1024 / 1024))},
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1
        }]
      }
    });
  </script>
</body>
</html>
  `;
  
  await fs.writeFile(reportPath, html);
  return reportPath;
}