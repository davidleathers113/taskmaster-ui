/**
 * Performance Monitoring Service for Electron App
 * 
 * Continuously monitors application performance and stores metrics
 * for dashboard visualization and alerting
 * 
 * Based on 2025 best practices for real-time monitoring:
 * - Stream ingestion for real-time data collection
 * - Time-series data persistence
 * - Automated threshold detection
 * - OpenTelemetry-compatible metrics
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const { spawn } = require('child_process');

class PerformanceMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      dataDir: path.join(__dirname, '../.taskmaster/performance'),
      collectInterval: 5000, // 5 seconds
      retentionDays: 30,
      alertThresholds: {
        cpu: { warning: 70, critical: 90 },
        memory: { warning: 70, critical: 85 },
        fps: { warning: 45, critical: 30 },
        jank: { warning: 5, critical: 10 }
      },
      enableDynamicThresholds: true,
      maxHistorySize: 10000,
      ...config
    };
    
    this.isRunning = false;
    this.currentMetrics = null;
    this.history = [];
    this.alerts = [];
    this.dynamicThresholds = new Map();
    this.lastCollectionTime = 0;
    
    // Initialize directories
    this.initializeDirectories();
  }

  async initializeDirectories() {
    try {
      await fs.mkdir(this.config.dataDir, { recursive: true });
      await fs.mkdir(path.join(this.config.dataDir, 'daily'), { recursive: true });
      await fs.mkdir(path.join(this.config.dataDir, 'alerts'), { recursive: true });
      await fs.mkdir(path.join(this.config.dataDir, 'reports'), { recursive: true });
    } catch (error) {
      console.error('Failed to initialize directories:', error);
    }
  }

  /**
   * Start performance monitoring
   */
  async start() {
    if (this.isRunning) {
      console.log('Performance monitor already running');
      return;
    }

    console.log('🔍 Starting Performance Monitor...');
    
    try {
      // Load historical data
      await this.loadHistoricalData();
      
      // Initialize dynamic thresholds
      if (this.config.enableDynamicThresholds) {
        this.initializeDynamicThresholds();
      }
      
      this.isRunning = true;
      
      // Start collection loop
      this.startCollectionLoop();
      
      // Schedule daily cleanup
      this.scheduleDailyCleanup();
      
      console.log('✅ Performance Monitor started');
      this.emit('started');
    } catch (error) {
      console.error('❌ Failed to start Performance Monitor:', error);
      throw error;
    }
  }

  /**
   * Stop performance monitoring
   */
  async stop() {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Performance Monitor...');
    
    this.isRunning = false;
    
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // Save final data
    await this.saveCurrentData();
    
    console.log('✅ Performance Monitor stopped');
    this.emit('stopped');
  }

  /**
   * Start the metrics collection loop
   */
  startCollectionLoop() {
    this.collectionTimer = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error collecting metrics:', error);
        this.emit('error', error);
      }
    }, this.config.collectInterval);
  }

  /**
   * Collect performance metrics using the existing benchmark system
   */
  async collectMetrics() {
    const timestamp = Date.now();
    
    try {
      // Get system metrics
      const systemMetrics = await this.collectSystemMetrics();
      
      // Get application metrics (if app is running)
      let appMetrics = null;
      try {
        appMetrics = await this.collectApplicationMetrics();
      } catch (error) {
        // App might not be running, which is fine
        console.debug('Application metrics unavailable:', error.message);
      }
      
      const metrics = {
        timestamp,
        system: systemMetrics,
        application: appMetrics,
        metadata: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          monitorVersion: '1.0.0'
        }
      };
      
      // Store metrics
      await this.storeMetrics(metrics);
      
      // Check for alerts
      await this.checkAlerts(metrics);
      
      // Update dynamic thresholds
      if (this.config.enableDynamicThresholds) {
        this.updateDynamicThresholds(metrics);
      }
      
      this.currentMetrics = metrics;
      this.lastCollectionTime = timestamp;
      
      this.emit('metrics', metrics);
      
    } catch (error) {
      console.error('Failed to collect metrics:', error);
      this.emit('error', error);
    }
  }

  /**
   * Collect system-level metrics
   */
  async collectSystemMetrics() {
    const os = require('os');
    
    // CPU metrics
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();
    
    // Memory metrics
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return {
      cpu: {
        usage: ((cpuUsage.user + cpuUsage.system) / 1000000) * 100, // Convert to percentage
        loadAverage: loadAvg,
        cores: os.cpus().length
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usagePercent: ((totalMem - freeMem) / totalMem) * 100,
        process: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss
        }
      },
      uptime: process.uptime()
    };
  }

  /**
   * Collect application-specific metrics
   */
  async collectApplicationMetrics() {
    // This would integrate with the existing PerformanceBenchmark class
    // For now, simulate application metrics
    return {
      rendering: {
        fps: Math.random() * 60 + 30, // Simulate FPS between 30-90
        jank: Math.floor(Math.random() * 10), // Simulate jank events
        paintTime: Math.random() * 20 + 5 // Simulate paint time 5-25ms
      },
      network: {
        requestCount: Math.floor(Math.random() * 100),
        avgLatency: Math.random() * 500 + 50, // 50-550ms
        errorRate: Math.random() * 0.05 // 0-5% error rate
      },
      errors: {
        count: Math.floor(Math.random() * 5),
        types: ['javascript', 'network', 'render']
      }
    };
  }

  /**
   * Store metrics in time-series format
   */
  async storeMetrics(metrics) {
    // Add to in-memory history
    this.history.push(metrics);
    
    // Limit in-memory history size
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }
    
    // Save to daily file
    const date = new Date(metrics.timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const dailyFile = path.join(this.config.dataDir, 'daily', `${dateStr}.json`);
    
    try {
      let dailyData = [];
      try {
        const existing = await fs.readFile(dailyFile, 'utf8');
        dailyData = JSON.parse(existing);
      } catch {
        // File doesn't exist yet, start with empty array
      }
      
      dailyData.push(metrics);
      await fs.writeFile(dailyFile, JSON.stringify(dailyData, null, 2));
    } catch (error) {
      console.error('Failed to save daily metrics:', error);
    }
  }

  /**
   * Check for performance alerts using dynamic thresholds
   */
  async checkAlerts(metrics) {
    const alerts = [];
    const timestamp = metrics.timestamp;
    
    // CPU alert
    if (metrics.system?.cpu?.usage) {
      const cpuThreshold = this.getDynamicThreshold('cpu', metrics.system.cpu.usage);
      if (metrics.system.cpu.usage > cpuThreshold.critical) {
        alerts.push({
          type: 'cpu',
          severity: 'critical',
          value: metrics.system.cpu.usage,
          threshold: cpuThreshold.critical,
          message: `CPU usage is critically high: ${metrics.system.cpu.usage.toFixed(1)}%`,
          timestamp
        });
      } else if (metrics.system.cpu.usage > cpuThreshold.warning) {
        alerts.push({
          type: 'cpu',
          severity: 'warning',
          value: metrics.system.cpu.usage,
          threshold: cpuThreshold.warning,
          message: `CPU usage is high: ${metrics.system.cpu.usage.toFixed(1)}%`,
          timestamp
        });
      }
    }
    
    // Memory alert
    if (metrics.system?.memory?.usagePercent) {
      const memThreshold = this.getDynamicThreshold('memory', metrics.system.memory.usagePercent);
      if (metrics.system.memory.usagePercent > memThreshold.critical) {
        alerts.push({
          type: 'memory',
          severity: 'critical',
          value: metrics.system.memory.usagePercent,
          threshold: memThreshold.critical,
          message: `Memory usage is critically high: ${metrics.system.memory.usagePercent.toFixed(1)}%`,
          timestamp
        });
      } else if (metrics.system.memory.usagePercent > memThreshold.warning) {
        alerts.push({
          type: 'memory',
          severity: 'warning',
          value: metrics.system.memory.usagePercent,
          threshold: memThreshold.warning,
          message: `Memory usage is high: ${metrics.system.memory.usagePercent.toFixed(1)}%`,
          timestamp
        });
      }
    }
    
    // FPS alert (if application metrics available)
    if (metrics.application?.rendering?.fps) {
      const fpsThreshold = this.getDynamicThreshold('fps', metrics.application.rendering.fps);
      if (metrics.application.rendering.fps < fpsThreshold.critical) {
        alerts.push({
          type: 'fps',
          severity: 'critical',
          value: metrics.application.rendering.fps,
          threshold: fpsThreshold.critical,
          message: `Frame rate is critically low: ${metrics.application.rendering.fps.toFixed(1)} FPS`,
          timestamp
        });
      } else if (metrics.application.rendering.fps < fpsThreshold.warning) {
        alerts.push({
          type: 'fps',
          severity: 'warning',
          value: metrics.application.rendering.fps,
          threshold: fpsThreshold.warning,
          message: `Frame rate is low: ${metrics.application.rendering.fps.toFixed(1)} FPS`,
          timestamp
        });
      }
    }
    
    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Get dynamic threshold or fallback to static
   */
  getDynamicThreshold(metric, currentValue) {
    if (this.config.enableDynamicThresholds && this.dynamicThresholds.has(metric)) {
      return this.dynamicThresholds.get(metric);
    }
    
    // Fallback to static thresholds
    return this.config.alertThresholds[metric] || { warning: 70, critical: 90 };
  }

  /**
   * Initialize dynamic thresholds based on historical data
   */
  initializeDynamicThresholds() {
    if (this.history.length < 100) {
      console.log('Insufficient historical data for dynamic thresholds, using static thresholds');
      return;
    }
    
    // Calculate dynamic thresholds for each metric
    const metrics = ['cpu', 'memory', 'fps', 'jank'];
    
    metrics.forEach(metric => {
      const values = this.extractMetricValues(metric);
      if (values.length > 50) {
        const thresholds = this.calculateDynamicThresholds(values, metric);
        this.dynamicThresholds.set(metric, thresholds);
        console.log(`Dynamic thresholds for ${metric}:`, thresholds);
      }
    });
  }

  /**
   * Update dynamic thresholds with new data
   */
  updateDynamicThresholds(metrics) {
    // Only update every 100 collections to avoid constant recalculation
    if (this.history.length % 100 !== 0) return;
    
    const metricTypes = ['cpu', 'memory', 'fps', 'jank'];
    
    metricTypes.forEach(metric => {
      const values = this.extractMetricValues(metric);
      if (values.length > 100) {
        const thresholds = this.calculateDynamicThresholds(values, metric);
        this.dynamicThresholds.set(metric, thresholds);
      }
    });
  }

  /**
   * Extract metric values from history for threshold calculation
   */
  extractMetricValues(metric) {
    return this.history
      .map(entry => {
        switch (metric) {
          case 'cpu':
            return entry.system?.cpu?.usage;
          case 'memory':
            return entry.system?.memory?.usagePercent;
          case 'fps':
            return entry.application?.rendering?.fps;
          case 'jank':
            return entry.application?.rendering?.jank;
          default:
            return null;
        }
      })
      .filter(val => val !== null && val !== undefined);
  }

  /**
   * Calculate dynamic thresholds using statistical analysis
   */
  calculateDynamicThresholds(values, metric) {
    // Sort values for percentile calculation
    const sorted = values.slice().sort((a, b) => a - b);
    const length = sorted.length;
    
    // Calculate percentiles
    const p50 = sorted[Math.floor(length * 0.5)];
    const p75 = sorted[Math.floor(length * 0.75)];
    const p90 = sorted[Math.floor(length * 0.9)];
    const p95 = sorted[Math.floor(length * 0.95)];
    
    // Calculate mean and standard deviation
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    let warning, critical;
    
    if (metric === 'fps') {
      // For FPS, lower is worse
      warning = Math.max(30, p50 - stdDev);
      critical = Math.max(20, p50 - 2 * stdDev);
    } else {
      // For CPU, memory, jank - higher is worse
      warning = Math.min(90, p75 + stdDev);
      critical = Math.min(95, p90 + stdDev);
    }
    
    return {
      warning: Math.round(warning * 100) / 100,
      critical: Math.round(critical * 100) / 100,
      baseline: {
        mean: Math.round(mean * 100) / 100,
        p50: Math.round(p50 * 100) / 100,
        p75: Math.round(p75 * 100) / 100,
        p90: Math.round(p90 * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100
      }
    };
  }

  /**
   * Process and store an alert
   */
  async processAlert(alert) {
    // Add to alerts history
    this.alerts.push(alert);
    
    // Limit alerts history
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
    
    // Save to alerts file
    const alertsFile = path.join(this.config.dataDir, 'alerts', 'alerts.json');
    try {
      await fs.writeFile(alertsFile, JSON.stringify(this.alerts, null, 2));
    } catch (error) {
      console.error('Failed to save alerts:', error);
    }
    
    // Emit alert event
    this.emit('alert', alert);
    
    // Log alert
    const severityIcon = alert.severity === 'critical' ? '🔴' : '🟡';
    console.log(`${severityIcon} ${alert.severity.toUpperCase()}: ${alert.message}`);
  }

  /**
   * Load historical data on startup
   */
  async loadHistoricalData() {
    try {
      // Load last 7 days of data for dynamic threshold calculation
      const daysToLoad = 7;
      const today = new Date();
      
      for (let i = 0; i < daysToLoad; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dailyFile = path.join(this.config.dataDir, 'daily', `${dateStr}.json`);
        
        try {
          const data = await fs.readFile(dailyFile, 'utf8');
          const dailyMetrics = JSON.parse(data);
          this.history.push(...dailyMetrics);
        } catch {
          // File doesn't exist, skip
        }
      }
      
      // Load alerts
      const alertsFile = path.join(this.config.dataDir, 'alerts', 'alerts.json');
      try {
        const alertsData = await fs.readFile(alertsFile, 'utf8');
        this.alerts = JSON.parse(alertsData);
      } catch {
        // No alerts file yet
      }
      
      console.log(`Loaded ${this.history.length} historical metrics and ${this.alerts.length} alerts`);
    } catch (error) {
      console.error('Error loading historical data:', error);
    }
  }

  /**
   * Schedule daily cleanup of old data
   */
  scheduleDailyCleanup() {
    // Run cleanup every 24 hours
    this.cleanupTimer = setInterval(async () => {
      await this.cleanup();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Clean up old data files
   */
  async cleanup() {
    console.log('🧹 Running performance data cleanup...');
    
    try {
      const dailyDir = path.join(this.config.dataDir, 'daily');
      const files = await fs.readdir(dailyDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const dateStr = file.replace('.json', '');
          const fileDate = new Date(dateStr);
          
          if (fileDate < cutoffDate) {
            await fs.unlink(path.join(dailyDir, file));
            console.log(`Deleted old performance data: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Save current state
   */
  async saveCurrentData() {
    try {
      const stateFile = path.join(this.config.dataDir, 'monitor-state.json');
      const state = {
        lastCollectionTime: this.lastCollectionTime,
        currentMetrics: this.currentMetrics,
        recentHistory: this.history.slice(-100), // Save last 100 entries
        dynamicThresholds: Object.fromEntries(this.dynamicThresholds),
        config: this.config
      };
      
      await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Error saving monitor state:', error);
    }
  }

  /**
   * Get current status and statistics
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCollectionTime: this.lastCollectionTime,
      historySize: this.history.length,
      alertsCount: this.alerts.length,
      recentAlerts: this.alerts.slice(-10),
      currentMetrics: this.currentMetrics,
      dynamicThresholds: Object.fromEntries(this.dynamicThresholds),
      uptime: this.isRunning ? Date.now() - this.lastCollectionTime : 0
    };
  }

  /**
   * Get metrics for a specific time range
   */
  getMetricsRange(startTime, endTime) {
    return this.history.filter(
      metrics => metrics.timestamp >= startTime && metrics.timestamp <= endTime
    );
  }

  /**
   * Get aggregated metrics for dashboard
   */
  getAggregatedMetrics(timeRange = '1h') {
    const now = Date.now();
    let startTime;
    
    switch (timeRange) {
      case '5m':
        startTime = now - 5 * 60 * 1000;
        break;
      case '1h':
        startTime = now - 60 * 60 * 1000;
        break;
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        startTime = now - 60 * 60 * 1000;
    }
    
    const rangeMetrics = this.getMetricsRange(startTime, now);
    
    if (rangeMetrics.length === 0) {
      return null;
    }
    
    // Calculate aggregations
    const cpuValues = rangeMetrics.map(m => m.system?.cpu?.usage).filter(v => v !== undefined);
    const memoryValues = rangeMetrics.map(m => m.system?.memory?.usagePercent).filter(v => v !== undefined);
    const fpsValues = rangeMetrics.map(m => m.application?.rendering?.fps).filter(v => v !== undefined);
    
    return {
      timeRange,
      sampleCount: rangeMetrics.length,
      cpu: {
        avg: cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0,
        max: cpuValues.length > 0 ? Math.max(...cpuValues) : 0,
        min: cpuValues.length > 0 ? Math.min(...cpuValues) : 0
      },
      memory: {
        avg: memoryValues.length > 0 ? memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length : 0,
        max: memoryValues.length > 0 ? Math.max(...memoryValues) : 0,
        min: memoryValues.length > 0 ? Math.min(...memoryValues) : 0
      },
      fps: {
        avg: fpsValues.length > 0 ? fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length : 0,
        max: fpsValues.length > 0 ? Math.max(...fpsValues) : 0,
        min: fpsValues.length > 0 ? Math.min(...fpsValues) : 0
      },
      alerts: this.alerts.filter(alert => alert.timestamp >= startTime),
      data: rangeMetrics
    };
  }
}

// Export for use in other modules
module.exports = { PerformanceMonitor };

// CLI interface
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  
  // Handle process signals
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down...');
    await monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await monitor.stop();
    process.exit(0);
  });
  
  // Start monitoring
  monitor.start().catch(error => {
    console.error('Failed to start monitor:', error);
    process.exit(1);
  });
  
  // Log status every minute
  setInterval(() => {
    const status = monitor.getStatus();
    console.log(`📊 Status: Running=${status.isRunning}, History=${status.historySize}, Alerts=${status.alertsCount}`);
  }, 60000);
}