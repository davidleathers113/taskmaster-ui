/**
 * Memory Testing Configuration for TaskMaster (2025)
 * 
 * Configuration file for MemLab and memory testing settings.
 * Defines thresholds, scenarios, and monitoring parameters.
 */

import { IConfig } from '@memlab/api';
import { join } from 'path';

/**
 * MemLab Configuration
 */
export const memLabConfig: IConfig = {
  // Working directory for MemLab output
  workDir: join(process.cwd(), 'test-results', 'memlab'),
  
  // Browser configuration
  browser: {
    type: 'chromium',
    headless: process.env.CI === 'true',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--enable-precise-memory-info',
      '--js-flags=--expose-gc'
    ]
  },
  
  // Snapshot configuration
  snapshot: {
    enable: true,
    options: {
      captureNumericValue: true,
      includeNativeSnapshots: true
    }
  },
  
  // Analysis configuration
  analysis: {
    // Minimum retained size to consider as leak (in bytes)
    minLeakSize: 1024 * 1024, // 1MB
    
    // Include source locations in leak traces
    includeSourceLocation: true,
    
    // Maximum depth for retainer traces
    maxRetainerTraceDepth: 10,
    
    // Group similar leaks together
    groupLeaks: true,
    
    // Filter out known false positives
    filterFalsePositives: true
  },
  
  // Report configuration
  report: {
    format: 'json',
    outputDir: join(process.cwd(), 'test-results', 'memory-reports'),
    includeScreenshots: true,
    includeHeapSnapshots: false // Don't include in report (too large)
  }
};

/**
 * Memory Testing Thresholds
 * Define acceptable limits for various memory metrics
 */
export const memoryThresholds = {
  // Development environment thresholds
  development: {
    maxHeapSize: 300 * 1024 * 1024,        // 300MB
    maxHeapGrowth: 50 * 1024 * 1024,       // 50MB
    maxDetachedNodes: 200,
    maxListeners: 100,
    maxDomNodes: 10000,
    maxMemoryGrowthRate: 1.0               // MB/minute
  },
  
  // CI environment thresholds (stricter)
  ci: {
    maxHeapSize: 200 * 1024 * 1024,        // 200MB
    maxHeapGrowth: 20 * 1024 * 1024,       // 20MB
    maxDetachedNodes: 100,
    maxListeners: 50,
    maxDomNodes: 5000,
    maxMemoryGrowthRate: 0.5               // MB/minute
  },
  
  // Production thresholds (strictest)
  production: {
    maxHeapSize: 150 * 1024 * 1024,        // 150MB
    maxHeapGrowth: 10 * 1024 * 1024,       // 10MB
    maxDetachedNodes: 50,
    maxListeners: 30,
    maxDomNodes: 3000,
    maxMemoryGrowthRate: 0.1               // MB/minute
  }
};

/**
 * Common memory leak scenarios for testing
 */
export const memoryLeakScenarios = {
  // Navigation memory leak test
  navigation: {
    name: 'Navigation Memory Leak Test',
    description: 'Tests for memory leaks during view navigation',
    steps: [
      { action: 'navigate', target: 'tasks' },
      { action: 'wait', duration: 1000 },
      { action: 'navigate', target: 'kanban' },
      { action: 'wait', duration: 1000 },
      { action: 'navigate', target: 'analytics' },
      { action: 'wait', duration: 1000 },
      { action: 'navigate', target: 'overview' }
    ]
  },
  
  // Task lifecycle test
  taskLifecycle: {
    name: 'Task Lifecycle Memory Test',
    description: 'Tests memory behavior during task creation/deletion',
    steps: [
      { action: 'createTask', data: { title: 'Test Task' } },
      { action: 'wait', duration: 500 },
      { action: 'editTask', data: { description: 'Updated' } },
      { action: 'wait', duration: 500 },
      { action: 'deleteTask' },
      { action: 'wait', duration: 500 }
    ]
  },
  
  // Modal/Dialog test
  modalDialog: {
    name: 'Modal Dialog Memory Test',
    description: 'Tests for leaks when opening/closing modals',
    steps: [
      { action: 'openModal', target: 'task-details' },
      { action: 'wait', duration: 500 },
      { action: 'closeModal' },
      { action: 'wait', duration: 500 }
    ],
    repeat: 10
  },
  
  // Data loading test
  dataLoading: {
    name: 'Data Loading Memory Test',
    description: 'Tests memory during data fetching and updates',
    steps: [
      { action: 'loadData', target: 'tasks', size: 'large' },
      { action: 'wait', duration: 1000 },
      { action: 'filterData', criteria: { status: 'pending' } },
      { action: 'wait', duration: 500 },
      { action: 'clearData' }
    ]
  }
};

/**
 * Performance monitoring configuration
 */
export const performanceConfig = {
  // Metrics to collect
  metrics: [
    'heap-size',
    'heap-used',
    'external-memory',
    'dom-nodes',
    'event-listeners',
    'js-event-listeners',
    'render-time',
    'layout-time',
    'script-time'
  ],
  
  // Sampling configuration
  sampling: {
    interval: 1000,        // Sample every 1 second
    duration: 60000,       // Total monitoring duration (1 minute)
    warmupTime: 5000       // Ignore first 5 seconds
  },
  
  // Alert thresholds
  alerts: {
    heapGrowth: {
      threshold: 10,       // Alert if heap grows by 10MB
      window: 30000        // Within 30 seconds
    },
    renderTime: {
      threshold: 16,       // Alert if render takes >16ms (60fps)
      consecutive: 5       // Alert after 5 consecutive slow renders
    }
  }
};

/**
 * Chrome DevTools Protocol configuration
 */
export const cdpConfig = {
  // Domains to enable
  domains: [
    'HeapProfiler',
    'Memory',
    'Performance',
    'Runtime',
    'Page'
  ],
  
  // Heap profiler settings
  heapProfiler: {
    samplingInterval: 16384,
    includeObjectsCollectedByMajorGC: false,
    includeObjectsCollectedByMinorGC: false
  },
  
  // Performance settings
  performance: {
    timeDomain: 'timeTicks',
    enableSampling: true
  }
};

/**
 * Test environment detection
 */
export function getEnvironmentThresholds() {
  if (process.env.CI === 'true') {
    return memoryThresholds.ci;
  }
  if (process.env.NODE_ENV === 'production') {
    return memoryThresholds.production;
  }
  return memoryThresholds.development;
}

/**
 * Generate MemLab scenario from configuration
 */
export function generateMemLabScenario(scenarioName: keyof typeof memoryLeakScenarios) {
  const scenario = memoryLeakScenarios[scenarioName];
  
  return {
    name: scenario.name,
    description: scenario.description,
    
    setup: async (page: any) => {
      // Initial setup
      await page.goto('app://taskmaster');
      await page.waitForLoadState('networkidle');
    },
    
    action: async (page: any) => {
      const iterations = scenario.repeat || 1;
      
      for (let i = 0; i < iterations; i++) {
        for (const step of scenario.steps) {
          switch (step.action) {
            case 'navigate':
              await page.click(`[data-testid="${step.target}-nav"]`);
              break;
            case 'wait':
              await page.waitForTimeout(step.duration);
              break;
            case 'createTask':
              await page.click('[data-testid="add-task-button"]');
              await page.fill('[data-testid="task-title-input"]', step.data.title);
              await page.click('[data-testid="save-task-button"]');
              break;
            case 'deleteTask':
              await page.click('[data-testid="task-menu-button"]');
              await page.click('[data-testid="delete-task-option"]');
              await page.click('[data-testid="confirm-delete-button"]');
              break;
            case 'openModal':
              await page.click(`[data-testid="open-${step.target}"]`);
              break;
            case 'closeModal':
              await page.click('[data-testid="close-modal-button"]');
              break;
            // Add more actions as needed
          }
        }
      }
    },
    
    cleanup: async (page: any) => {
      // Return to initial state
      await page.click('[data-testid="overview-nav"]');
      await page.waitForTimeout(1000);
    }
  };
}

/**
 * Export all configurations
 */
export default {
  memLabConfig,
  memoryThresholds,
  memoryLeakScenarios,
  performanceConfig,
  cdpConfig,
  getEnvironmentThresholds,
  generateMemLabScenario
};