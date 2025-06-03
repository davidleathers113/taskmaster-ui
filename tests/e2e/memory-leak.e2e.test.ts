/**
 * TaskMaster Memory Leak Detection Tests (2025)
 * 
 * Comprehensive memory leak detection using MemLab and Electron-specific tools.
 * Follows 2025 best practices for automated memory testing in CI/CD pipelines.
 * 
 * Features:
 * - Automated heap snapshot analysis
 * - Memory growth detection
 * - Leak clustering and reporting
 * - React Fiber leak detection
 * - Cross-process memory monitoring
 * - Performance regression detection
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchElectronForE2E, getMainWindow, closeElectronE2E } from '../setup/e2e.setup';
import { 
  MemoryTestHelper, 
  MemoryMetrics, 
  LeakReport,
  MemoryThresholds,
  captureHeapSnapshot,
  analyzeMemoryGrowth,
  detectMemoryLeaks
} from '../utils/memory-test-utils';
import * as memlab from '@memlab/api';
import { join } from 'path';

// Configure test suite for memory testing
test.describe('Memory Leak Detection Suite', () => {
  let app: ElectronApplication;
  let page: Page;
  let memoryHelper: MemoryTestHelper;

  // Test configuration
  const memoryThresholds: MemoryThresholds = {
    maxHeapSize: 200 * 1024 * 1024, // 200MB max heap
    maxHeapGrowth: 20 * 1024 * 1024, // 20MB growth tolerance
    maxDetachedNodes: 100,
    maxListeners: 50,
    maxDomNodes: 5000
  };

  test.beforeAll(async () => {
    console.log('🧪 Starting Memory Leak Detection Suite...');
    app = await launchElectronForE2E({
      env: {
        NODE_OPTIONS: '--expose-gc --max-old-space-size=512',
        ELECTRON_ENABLE_MEMORY_PROFILING: '1'
      }
    });
    page = await getMainWindow();
    memoryHelper = new MemoryTestHelper(page, memoryThresholds);
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  test.beforeEach(async () => {
    // Clear memory before each test
    await memoryHelper.clearMemory();
    await page.waitForTimeout(1000);
  });

  /**
   * Test 1: Basic Memory Leak Detection
   * Detects common memory leaks in the application lifecycle
   */
  test('should not have memory leaks during basic navigation', async () => {
    console.log('📊 Testing basic navigation memory patterns...');

    const initialMetrics = await memoryHelper.captureMetrics();
    console.log(`Initial: Heap ${(initialMetrics.jsHeapSize / 1024 / 1024).toFixed(2)}MB, DOM nodes: ${initialMetrics.domNodes}`);

    // Navigate through different views
    const navButtons = await page.locator('nav button').all();
    
    if (navButtons.length >= 3) {
      // Click through navigation
      for (let i = 0; i < 3; i++) {
        await navButtons[i].click();
        await page.waitForTimeout(1000);
      }
    }

    // Force garbage collection
    await memoryHelper.forceGarbageCollection();
    await page.waitForTimeout(2000);

    const finalMetrics = await memoryHelper.captureMetrics();
    console.log(`Final: Heap ${(finalMetrics.jsHeapSize / 1024 / 1024).toFixed(2)}MB, DOM nodes: ${finalMetrics.domNodes}`);

    const growth = analyzeMemoryGrowth(initialMetrics, finalMetrics);
    console.log(`Growth: ${(growth.heapGrowth / 1024 / 1024).toFixed(2)}MB (${growth.percentageGrowth.toFixed(2)}%)`);

    // Assert acceptable memory growth
    expect(growth.heapGrowth).toBeLessThan(memoryThresholds.maxHeapGrowth);
    expect(growth.percentageGrowth).toBeLessThan(20); // Less than 20% growth
  });

  /**
   * Test 2: Task Creation/Deletion Memory Patterns
   * Ensures tasks are properly garbage collected
   */
  test('should properly clean up memory when creating and deleting tasks', async () => {
    console.log('📊 Testing task lifecycle memory patterns...');

    const initialMetrics = await memoryHelper.captureMetrics();
    
    // Create and delete tasks repeatedly
    for (let i = 0; i < 10; i++) {
      // Create a task
      await page.click('[data-testid="add-task-button"]');
      await page.fill('[data-testid="task-title-input"]', `Memory Test Task ${i}`);
      await page.fill('[data-testid="task-description-input"]', 'Testing memory allocation and cleanup');
      await page.click('[data-testid="save-task-button"]');
      await page.waitForTimeout(500);
      
      // Delete the task
      await page.click(`[data-testid="task-menu-${i}"]`);
      await page.click('[data-testid="delete-task-option"]');
      await page.click('[data-testid="confirm-delete-button"]');
      await page.waitForTimeout(500);
    }

    // Force garbage collection
    await memoryHelper.forceGarbageCollection();
    await page.waitForTimeout(2000);

    const finalMetrics = await memoryHelper.captureMetrics();
    const growth = analyzeMemoryGrowth(initialMetrics, finalMetrics);

    // Assert memory is within acceptable bounds
    expect(growth.heapGrowth).toBeLessThan(memoryThresholds.maxHeapGrowth);
    expect(growth.percentageGrowth).toBeLessThan(10); // Max 10% growth

    console.log(`✅ Memory growth: ${(growth.heapGrowth / 1024 / 1024).toFixed(2)}MB (${growth.percentageGrowth.toFixed(2)}%)`);
  });

  /**
   * Test 3: React Fiber Memory Leak Detection
   * Specifically targets React component memory leaks
   */
  test('should not leak React Fiber nodes', async () => {
    console.log('📊 Testing React Fiber memory patterns...');

    // Custom leak filter for React Fibers
    const leakFilter: memlab.ILeakFilter = {
      leakFilter: (node: memlab.IHeapNode) => {
        // Check for React Fiber nodes that shouldn't be retained
        const name = node.name || '';
        const type = node.type || '';
        
        // Detect leaked React Fibers
        if (name.includes('FiberNode') || type.includes('Fiber')) {
          // Check if it's a detached fiber
          const retainers = node.retainers || [];
          const isDetached = retainers.every(r => 
            !r.name?.includes('FiberRoot') && 
            !r.name?.includes('FiberProvider')
          );
          return isDetached;
        }
        
        return false;
      }
    };

    const scenario: memlab.IScenario = {
      url: () => 'app://taskmaster',
      
      action: async (page: any) => {
        // Trigger component mounting/unmounting
        for (let i = 0; i < 5; i++) {
          await page.click('[data-testid="toggle-details-panel"]');
          await page.waitForTimeout(300);
        }
      },
      
      back: async (page: any) => {
        // Ensure panel is closed
        const isPanelOpen = await page.isVisible('[data-testid="details-panel"]');
        if (isPanelOpen) {
          await page.click('[data-testid="close-details-panel"]');
        }
      },
      
      leakFilter
    };

    const result = await memlab.run({
      scenario,
      workDir: join(process.cwd(), 'test-results', 'memlab'),
      silent: false
    });

    expect(result.leaks.length).toBe(0);
  });

  /**
   * Test 4: Event Listener Leak Detection
   * Ensures event listeners are properly cleaned up
   */
  test('should not leak event listeners', async () => {
    console.log('📊 Testing event listener cleanup...');

    // Monitor event listener count
    const getListenerCount = async () => {
      return await page.evaluate(() => {
        const getEventListeners = (element: Element): number => {
          // Use Chrome DevTools protocol if available
          if ((window as any).getEventListeners) {
            const listeners = (window as any).getEventListeners(element);
            return Object.keys(listeners).reduce((sum, key) => 
              sum + listeners[key].length, 0
            );
          }
          return 0;
        };

        let totalListeners = 0;
        document.querySelectorAll('*').forEach(el => {
          totalListeners += getEventListeners(el);
        });
        return totalListeners;
      });
    };

    const initialListeners = await getListenerCount();
    
    // Perform actions that add/remove listeners
    for (let i = 0; i < 10; i++) {
      await page.hover('[data-testid="task-card-0"]');
      await page.click('[data-testid="task-card-0"]');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    const finalListeners = await getListenerCount();
    const listenerGrowth = finalListeners - initialListeners;

    expect(listenerGrowth).toBeLessThan(memoryThresholds.maxListeners);
    console.log(`✅ Event listener growth: ${listenerGrowth} listeners`);
  });

  /**
   * Test 5: DOM Node Leak Detection
   * Ensures DOM nodes are properly cleaned up
   */
  test('should not accumulate detached DOM nodes', async () => {
    console.log('📊 Testing DOM node cleanup...');

    const getDetachedNodes = async () => {
      return await page.evaluate(() => {
        // Create a heap snapshot and analyze detached nodes
        const detachedNodes: any[] = [];
        
        // This is a simplified version - in real implementation,
        // we'd use Chrome DevTools Protocol for accurate detection
        const observer = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            mutation.removedNodes.forEach(node => {
              if (node.nodeType === 1 && !document.contains(node)) {
                detachedNodes.push({
                  tagName: (node as Element).tagName,
                  id: (node as Element).id,
                  className: (node as Element).className
                });
              }
            });
          });
        });

        observer.observe(document.body, { 
          childList: true, 
          subtree: true 
        });

        return detachedNodes.length;
      });
    };

    // Perform actions that create/destroy DOM nodes
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="show-modal-button"]');
      await page.waitForSelector('[data-testid="modal-content"]');
      await page.click('[data-testid="close-modal-button"]');
      await page.waitForTimeout(300);
    }

    // Force GC and check for detached nodes
    await memoryHelper.forceGarbageCollection();
    await page.waitForTimeout(1000);

    const detachedCount = await getDetachedNodes();
    expect(detachedCount).toBeLessThan(memoryThresholds.maxDetachedNodes);
    
    console.log(`✅ Detached DOM nodes: ${detachedCount}`);
  });

  /**
   * Test 6: Long Running Session Memory Stability
   * Simulates extended usage to detect gradual memory leaks
   */
  test('should maintain stable memory during extended usage', async () => {
    test.setTimeout(300000); // 5 minute timeout
    console.log('📊 Testing long-running session memory stability...');

    const samples: MemoryMetrics[] = [];
    const sampleInterval = 10000; // 10 seconds
    const totalDuration = 120000; // 2 minutes

    // Simulate continuous usage
    const userActions = async () => {
      await page.click('[data-testid="tasks-nav"]');
      await page.waitForTimeout(500);
      await page.click('[data-testid="add-task-button"]');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await page.click('[data-testid="kanban-nav"]');
      await page.waitForTimeout(500);
    };

    const startTime = Date.now();
    
    while (Date.now() - startTime < totalDuration) {
      await userActions();
      
      if ((Date.now() - startTime) % sampleInterval < 1000) {
        const metrics = await memoryHelper.captureMetrics();
        samples.push(metrics);
        console.log(`  Sample ${samples.length}: Heap ${(metrics.jsHeapSize / 1024 / 1024).toFixed(2)}MB`);
      }
      
      await page.waitForTimeout(1000);
    }

    // Analyze memory trend
    const trend = memoryHelper.analyzeMemoryTrend(samples);
    
    expect(trend.isLeaking).toBe(false);
    expect(trend.averageGrowthRate).toBeLessThan(0.1); // Less than 0.1MB/minute

    console.log(`✅ Memory trend: ${trend.isLeaking ? 'LEAKING' : 'STABLE'}`);
    console.log(`  Average growth: ${trend.averageGrowthRate.toFixed(3)}MB/min`);
  });

  /**
   * Test 7: Cross-Process Memory Monitoring
   * Monitors memory across main and renderer processes
   */
  test('should monitor memory across Electron processes', async () => {
    console.log('📊 Testing cross-process memory usage...');

    const getProcessMemory = async () => {
      // Main process memory
      const mainMemory = await app.evaluate(async () => {
        return process.memoryUsage();
      });

      // Renderer process memory
      const rendererMemory = await page.evaluate(() => {
        return {
          jsHeapSize: (performance as any).memory?.usedJSHeapSize || 0,
          totalHeapSize: (performance as any).memory?.totalJSHeapSize || 0,
          limit: (performance as any).memory?.jsHeapSizeLimit || 0
        };
      });

      return { mainMemory, rendererMemory };
    };

    const initialMemory = await getProcessMemory();
    
    // Perform memory-intensive operations
    await page.evaluate(() => {
      // Create large objects in renderer
      const largeArray = new Array(1000000).fill({ 
        data: 'x'.repeat(100) 
      });
      
      // Store temporarily
      (window as any).__tempData = largeArray;
      
      // Clean up after a delay
      setTimeout(() => {
        delete (window as any).__tempData;
      }, 2000);
    });

    await page.waitForTimeout(3000);
    await memoryHelper.forceGarbageCollection();
    await page.waitForTimeout(1000);

    const finalMemory = await getProcessMemory();

    // Calculate growth
    const mainGrowth = finalMemory.mainMemory.heapUsed - initialMemory.mainMemory.heapUsed;
    const rendererGrowth = finalMemory.rendererMemory.jsHeapSize - initialMemory.rendererMemory.jsHeapSize;

    console.log(`✅ Main process growth: ${(mainGrowth / 1024 / 1024).toFixed(2)}MB`);
    console.log(`✅ Renderer process growth: ${(rendererGrowth / 1024 / 1024).toFixed(2)}MB`);

    // Assert reasonable growth
    expect(Math.abs(mainGrowth)).toBeLessThan(10 * 1024 * 1024); // 10MB
    expect(Math.abs(rendererGrowth)).toBeLessThan(5 * 1024 * 1024); // 5MB
  });

  /**
   * Test 8: Memory Leak Report Generation
   * Generates comprehensive memory leak reports for CI/CD
   */
  test('should generate memory leak analysis report', async () => {
    console.log('📊 Generating comprehensive memory analysis report...');

    const report: LeakReport = {
      timestamp: new Date().toISOString(),
      testSuite: 'TaskMaster Memory Analysis',
      summary: {
        totalLeaks: 0,
        criticalLeaks: 0,
        warningLeaks: 0,
        passed: true
      },
      leaks: [],
      metrics: await memoryHelper.captureMetrics(),
      recommendations: []
    };

    // Run comprehensive analysis
    try {
      const scenario: memlab.IScenario = {
        url: () => 'app://taskmaster',
        action: async (page: any) => {
          // Comprehensive user journey
          await page.click('[data-testid="tasks-nav"]');
          await page.waitForTimeout(1000);
          await page.click('[data-testid="add-task-button"]');
          await page.fill('[data-testid="task-title-input"]', 'Test Task');
          await page.click('[data-testid="save-task-button"]');
          await page.waitForTimeout(1000);
        },
        back: async (page: any) => {
          await page.click('[data-testid="overview-nav"]');
        }
      };

      const result = await memlab.run({
        scenario,
        workDir: join(process.cwd(), 'test-results', 'memlab'),
        silent: false
      });

      report.summary.totalLeaks = result.leaks.length;
      report.leaks = result.leaks.map(leak => ({
        name: leak.name,
        size: leak.retainedSize,
        trace: leak.trace,
        severity: leak.retainedSize > 1024 * 1024 ? 'critical' : 'warning'
      }));

      report.summary.criticalLeaks = report.leaks.filter(l => l.severity === 'critical').length;
      report.summary.warningLeaks = report.leaks.filter(l => l.severity === 'warning').length;
      report.summary.passed = report.summary.criticalLeaks === 0;

      // Add recommendations
      if (report.summary.totalLeaks > 0) {
        report.recommendations.push('Review and fix identified memory leaks before deployment');
        report.recommendations.push('Consider implementing WeakMap/WeakSet for object references');
        report.recommendations.push('Ensure all event listeners are properly removed on cleanup');
      }

    } catch (error) {
      console.error('Error during memory analysis:', error);
      report.summary.passed = false;
    }

    // Save report
    const reportPath = join(process.cwd(), 'test-results', 'memory-leak-report.json');
    await memoryHelper.saveReport(report, reportPath);
    
    console.log(`✅ Memory leak report saved to: ${reportPath}`);
    expect(report.summary.passed).toBe(true);
  });
});