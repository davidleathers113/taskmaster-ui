# Electron Memory Leak Detection Best Practices and Implementation Guide (2025)

## Table of Contents
1. [Overview](#overview)
2. [Modern Tooling Landscape](#modern-tooling-landscape)
3. [Framework-Specific Considerations](#framework-specific-considerations)
4. [Implementation Strategies](#implementation-strategies)
5. [CI/CD Integration](#cicd-integration)
6. [Advanced Monitoring](#advanced-monitoring)
7. [Best Practices](#best-practices)

## Overview

Memory leak detection in Electron applications has evolved significantly in 2025, with new tools, frameworks, and methodologies emerging to address the unique challenges of multi-process architecture. This guide provides comprehensive coverage of the latest tools and techniques for implementing automated memory leak detection in Electron applications.

## Modern Tooling Landscape

### MemLab - Primary Framework for 2025

**Meta's MemLab** has emerged as the primary tool for JavaScript memory leak detection and is actively maintained with the latest version 1.1.58 published 14 days ago.

**Key Features:**
- Supports programmatic analysis of JS heap snapshots from Chromium-based browsers, Node.js, Electron.js, and Hermes
- Automates memory leak detection by running headless browser through predefined test scenarios
- Finds potential memory leaks by diffing JavaScript heap snapshots
- Can be integrated into CI/CD pipelines for continuous monitoring
- Provides retainer trace analysis showing object reference chains from GC root to leaked objects

**Installation:**
```bash
npm install memlab
# or globally
npm install -g memlab
```

**Basic Usage:**
```javascript
const memlab = require('memlab');

// Define test scenario
const scenario = {
  url: () => 'http://localhost:3000',
  action: async (page) => {
    // Interact with your Electron app
    await page.click('#trigger-memory-usage');
  },
  back: async (page) => {
    // Return to initial state
    await page.click('#reset');
  }
};

// Run memory leak detection
await memlab.run({ scenario });
```

### NLeak - Node.js Specific Detection

**NLeak** is an automatic memory leak detection and diagnosis tool specifically for Node.js applications, designed for CI/CD integration.

**Features:**
- Lightweight and extensible
- Uses heap snapshot algorithms to identify memory leaks
- Identifies heap objects that gain more outgoing references across snapshots
- Currently under development (not production-ready)

### memwatch-next - Traditional Monitoring

**memwatch-next** remains relevant for basic memory monitoring:

**Features:**
- Emits leak events when heap grows over 5 consecutive garbage collections
- Useful for automated testing scenarios
- Can trigger heapdump generation on leak detection
- Beware of false positives from short memory spikes

**Usage:**
```javascript
const memwatch = require('memwatch-next');
const heapdump = require('heapdump');

memwatch.on('leak', (info) => {
  console.error('Memory leak detected:', info);
  const filename = `heapdump-${Date.now()}.heapsnapshot`;
  heapdump.writeSnapshot(filename);
});
```

## Framework-Specific Considerations

### Electron Multi-Process Architecture

Electron's multi-process architecture requires specific monitoring approaches:

**Main Process Monitoring:**
- Monitor main process using `process.getProcessMemoryInfo()`
- Watch for file handle leaks in ASAR archive operations
- Track IPC event listener accumulation

**Renderer Process Monitoring:**
- Use `process.getProcessMemoryInfo()` in renderer contexts
- Monitor DOM element cleanup
- Track Angular component lifecycle issues (OnDestroy)

**Process Isolation Benefits:**
- Prevents single process failures from affecting the entire application
- Allows independent monitoring of each process
- Enables targeted leak detection in specific processes

### Testing Framework Integration

**Vitest vs Jest Performance (2025):**
- Vitest runs 10-20x faster in watch mode due to Vite's dev server
- Jest still struggles with memory leaks in CI environments
- Vitest provides better ESM support and modern testing patterns

**Jest Memory Leak Solutions:**
```javascript
// package.json
{
  "scripts": {
    "test": "node --expose-gc --no-compilation-cache node_modules/.bin/jest"
  }
}
```

## Implementation Strategies

### MemLab Integration with Playwright

For comprehensive Electron testing, integrate MemLab with Playwright:

```javascript
// tests/memory-leak.test.js
const { test, expect, _electron: electron } = require('@playwright/test');
const memlab = require('memlab');

test('detect memory leaks in main workflow', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  
  // Define memory leak detection scenario
  const scenario = {
    app: electronApp,
    action: async () => {
      // Perform memory-intensive operations
      const page = await electronApp.firstWindow();
      await page.click('#load-large-dataset');
      await page.waitForSelector('#data-loaded');
    },
    back: async () => {
      // Reset to initial state
      const page = await electronApp.firstWindow();
      await page.click('#clear-data');
    }
  };
  
  // Run memory analysis
  const leaks = await memlab.findLeaks(scenario);
  expect(leaks).toHaveLength(0);
  
  await electronApp.close();
});
```

### Automated Heap Snapshot Collection

```javascript
// utils/memory-monitor.js
const v8 = require('v8');
const fs = require('fs');
const path = require('path');

class MemoryMonitor {
  constructor() {
    this.snapshots = [];
    this.snapshotDir = path.join(__dirname, '../heap-snapshots');
    this.ensureSnapshotDir();
  }
  
  ensureSnapshotDir() {
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }
  }
  
  async takeSnapshot(label = 'snapshot') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${label}-${timestamp}.heapsnapshot`;
    const filepath = path.join(this.snapshotDir, filename);
    
    const snapshot = v8.getHeapSnapshot();
    const fileStream = fs.createWriteStream(filepath);
    
    return new Promise((resolve, reject) => {
      snapshot.pipe(fileStream);
      fileStream.on('finish', () => {
        this.snapshots.push({ label, filepath, timestamp });
        resolve(filepath);
      });
      fileStream.on('error', reject);
    });
  }
  
  async analyzeSnapshots() {
    if (this.snapshots.length < 2) {
      throw new Error('Need at least 2 snapshots for comparison');
    }
    
    // Use MemLab for analysis
    const analysis = await memlab.analyzeSnapshots(this.snapshots);
    return analysis;
  }
}

module.exports = MemoryMonitor;
```

### Process-Specific Memory Monitoring

```javascript
// src/main/memory-monitor.js
class ElectronMemoryMonitor {
  constructor() {
    this.mainProcessMetrics = [];
    this.rendererProcessMetrics = new Map();
    this.monitoringInterval = null;
  }
  
  startMonitoring(interval = 5000) {
    this.monitoringInterval = setInterval(() => {
      this.collectMainProcessMetrics();
      this.collectRendererProcessMetrics();
    }, interval);
  }
  
  collectMainProcessMetrics() {
    const metrics = {
      timestamp: Date.now(),
      memory: process.getProcessMemoryInfo(),
      system: process.getSystemMemoryInfo(),
      heap: process.memoryUsage()
    };
    
    this.mainProcessMetrics.push(metrics);
    
    // Detect potential leaks
    if (this.mainProcessMetrics.length > 10) {
      const recent = this.mainProcessMetrics.slice(-10);
      const growth = this.calculateMemoryGrowth(recent);
      
      if (growth.isLeaking) {
        this.reportLeak('main', growth);
      }
    }
  }
  
  collectRendererProcessMetrics() {
    const windows = BrowserWindow.getAllWindows();
    
    windows.forEach(window => {
      const webContents = window.webContents;
      const processId = webContents.getOSProcessId();
      
      // Collect metrics from renderer
      webContents.executeJavaScript(`
        ({
          memory: process.getProcessMemoryInfo(),
          heap: performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
          } : null
        })
      `).then(metrics => {
        this.updateRendererMetrics(processId, metrics);
      }).catch(err => {
        console.warn('Failed to collect renderer metrics:', err);
      });
    });
  }
  
  calculateMemoryGrowth(metrics) {
    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    
    const heapGrowth = last.heap.heapUsed - first.heap.heapUsed;
    const timespan = last.timestamp - first.timestamp;
    const growthRate = heapGrowth / timespan; // bytes per ms
    
    return {
      isLeaking: growthRate > 1000, // 1MB per second threshold
      growthRate,
      totalGrowth: heapGrowth,
      timespan
    };
  }
  
  reportLeak(processType, growth) {
    console.error(`Memory leak detected in ${processType} process:`, {
      growthRate: `${(growth.growthRate * 1000).toFixed(2)} bytes/sec`,
      totalGrowth: `${(growth.totalGrowth / 1024 / 1024).toFixed(2)} MB`,
      timespan: `${(growth.timespan / 1000).toFixed(1)} seconds`
    });
    
    // Trigger heap snapshot for analysis
    this.takeEmergencySnapshot(processType);
  }
}
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/memory-tests.yml
name: Memory Leak Tests

on: [push, pull_request]

jobs:
  memory-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install MemLab
        run: npm install -g memlab
      
      - name: Run memory leak detection
        run: |
          npm run test:memory
          memlab analyze --snapshot-dir ./heap-snapshots
      
      - name: Upload heap snapshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: heap-snapshots
          path: heap-snapshots/
          retention-days: 7
      
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            if (fs.existsSync('./memory-report.json')) {
              const report = JSON.parse(fs.readFileSync('./memory-report.json'));
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: `## Memory Leak Test Results\n\n${report.summary}`
              });
            }
```

### Continuous Monitoring Setup

```javascript
// scripts/memory-monitoring.js
const memlab = require('memlab');
const { ElectronMemoryMonitor } = require('../src/main/memory-monitor');

class ContinuousMemoryMonitoring {
  constructor() {
    this.monitor = new ElectronMemoryMonitor();
    this.alertThresholds = {
      heapGrowthRate: 1024 * 1024, // 1MB/sec
      maxHeapSize: 512 * 1024 * 1024, // 512MB
      consecutiveLeaks: 3
    };
  }
  
  async startContinuousMonitoring() {
    // Run memory checks every hour
    setInterval(async () => {
      await this.runMemoryAnalysis();
    }, 60 * 60 * 1000);
    
    // Start real-time monitoring
    this.monitor.startMonitoring(10000); // 10 second intervals
  }
  
  async runMemoryAnalysis() {
    try {
      // Take baseline snapshot
      const baseline = await this.monitor.takeSnapshot('baseline');
      
      // Simulate application usage
      await this.simulateUsage();
      
      // Take post-usage snapshot
      const postUsage = await this.monitor.takeSnapshot('post-usage');
      
      // Analyze for leaks
      const analysis = await memlab.analyze([baseline, postUsage]);
      
      if (analysis.leaks.length > 0) {
        await this.reportToMonitoring(analysis);
      }
      
    } catch (error) {
      console.error('Memory analysis failed:', error);
    }
  }
  
  async reportToMonitoring(analysis) {
    // Send to monitoring service
    const report = {
      timestamp: new Date().toISOString(),
      leakCount: analysis.leaks.length,
      severity: this.calculateSeverity(analysis),
      details: analysis.leaks.map(leak => ({
        size: leak.size,
        type: leak.type,
        retainerPath: leak.retainerPath
      }))
    };
    
    // Send to external monitoring (e.g., Datadog, New Relic)
    await this.sendToExternalMonitoring(report);
  }
}
```

## Advanced Monitoring

### Real-time Memory Dashboard

```javascript
// src/renderer/components/MemoryDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';

interface MemoryMetrics {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

export const MemoryDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<MemoryMetrics[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isMonitoring) {
      interval = setInterval(async () => {
        const memInfo = await window.electronAPI.getMemoryInfo();
        const newMetric: MemoryMetrics = {
          timestamp: Date.now(),
          heapUsed: memInfo.heap.heapUsed,
          heapTotal: memInfo.heap.heapTotal,
          external: memInfo.heap.external
        };
        
        setMetrics(prev => [...prev.slice(-100), newMetric]); // Keep last 100 points
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring]);
  
  const chartData = {
    labels: metrics.map(m => new Date(m.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Heap Used (MB)',
        data: metrics.map(m => m.heapUsed / 1024 / 1024),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
      {
        label: 'Heap Total (MB)',
        data: metrics.map(m => m.heapTotal / 1024 / 1024),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
      }
    ]
  };
  
  return (
    <div className="memory-dashboard">
      <h3>Real-time Memory Monitoring</h3>
      <button onClick={() => setIsMonitoring(!isMonitoring)}>
        {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
      </button>
      <Line data={chartData} />
    </div>
  );
};
```

## Best Practices

### 1. Multi-layered Detection Strategy

- **Level 1**: Real-time monitoring with memwatch-next for immediate detection
- **Level 2**: Periodic heap snapshot analysis with MemLab
- **Level 3**: Long-term trend analysis with custom monitoring

### 2. Test Environment Configuration

```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup/memory-monitoring.ts'],
    pool: 'forks', // Avoid memory sharing between tests
    poolOptions: {
      forks: {
        singleFork: true // Use single fork to avoid memory fragmentation
      }
    },
    testTimeout: 30000,
    hookTimeout: 10000
  }
});
```

### 3. Automated Cleanup Verification

```javascript
// tests/memory/cleanup-verification.test.js
import { test, expect } from 'vitest';
import { MemoryMonitor } from '../utils/memory-monitor';

test('verify proper cleanup after operations', async () => {
  const monitor = new MemoryMonitor();
  
  // Take baseline
  const baseline = await monitor.takeSnapshot('baseline');
  
  // Perform operations that should be cleaned up
  await performMemoryIntensiveOperations();
  
  // Force garbage collection
  if (global.gc) {
    global.gc();
    global.gc(); // Run twice to ensure thorough cleanup
  }
  
  // Take post-cleanup snapshot
  const postCleanup = await monitor.takeSnapshot('post-cleanup');
  
  // Analyze memory difference
  const growth = await monitor.compareSnapshots(baseline, postCleanup);
  
  // Allow for some growth but not excessive
  expect(growth.percentageIncrease).toBeLessThan(10);
});
```

### 4. Production Monitoring Integration

```javascript
// src/main/production-monitoring.js
class ProductionMemoryMonitoring {
  constructor() {
    this.enabled = process.env.NODE_ENV === 'production';
    this.reportingInterval = 5 * 60 * 1000; // 5 minutes
  }
  
  initialize() {
    if (!this.enabled) return;
    
    // Monitor main process
    setInterval(() => {
      this.reportMainProcessMetrics();
    }, this.reportingInterval);
    
    // Monitor renderer processes
    app.on('web-contents-created', (event, webContents) => {
      this.monitorWebContents(webContents);
    });
  }
  
  async reportMainProcessMetrics() {
    const metrics = {
      pid: process.pid,
      memory: process.memoryUsage(),
      timestamp: Date.now(),
      version: app.getVersion()
    };
    
    // Send to analytics service
    await this.sendToAnalytics('main_process_memory', metrics);
  }
}
```

## Summary

The 2025 landscape for Electron memory leak detection emphasizes:

1. **MemLab as Primary Tool**: Meta's MemLab framework leads in automated memory leak detection
2. **CI/CD Integration**: Continuous monitoring and automated testing in pipelines
3. **Multi-Process Awareness**: Separate monitoring strategies for main and renderer processes
4. **Real-time Monitoring**: Live dashboards and immediate alerting
5. **Vitest Performance**: Superior performance compared to Jest for memory testing
6. **Playwright Integration**: Seamless E2E testing with memory analysis
7. **Production Monitoring**: Continuous tracking in production environments

This comprehensive approach ensures robust memory leak detection and prevention throughout the development lifecycle.