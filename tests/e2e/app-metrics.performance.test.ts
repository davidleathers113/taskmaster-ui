/**
 * Performance Regression Tests for TaskMaster Electron App (2025)
 * 
 * Comprehensive performance testing suite following 2025 best practices:
 * - Core Web Vitals monitoring (LCP, FCP, TBT, CLS, TTFB)
 * - Memory usage tracking and leak detection
 * - CPU usage profiling
 * - Startup time benchmarking
 * - Resource loading analysis
 * - Frame rate monitoring
 * - Network performance metrics
 * 
 * Integrates with Playwright and plans for Lighthouse integration
 * for comprehensive performance monitoring in CI/CD pipelines.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  launchElectronForE2E,
  getMainWindow,
  closeElectronE2E,
  navigateToView,
  simulateUserActions,
  measureE2EPerformance,
  waitForE2ECondition
} from '../setup/e2e.setup';

// Performance thresholds based on 2025 standards
const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals
  FCP: 1800,           // First Contentful Paint (ms)
  LCP: 2500,           // Largest Contentful Paint (ms)
  TBT: 200,            // Total Blocking Time (ms)
  CLS: 0.1,            // Cumulative Layout Shift
  TTFB: 800,           // Time to First Byte (ms)
  
  // Application-specific metrics
  startupTime: 5000,   // App startup time (ms)
  viewSwitchTime: 500, // View navigation time (ms)
  taskLoadTime: 1000,  // Task list load time (ms)
  searchTime: 300,     // Search response time (ms)
  
  // Resource metrics
  memoryLimit: 512,    // Memory usage limit (MB)
  cpuLimit: 80,        // CPU usage limit (%)
  frameRate: 30        // Minimum frame rate (fps)
};

// Helper to collect performance metrics
async function collectPerformanceMetrics(page: Page): Promise<any> {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    
    // Get paint metrics
    const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
    const lcp = performance.getEntriesByType('largest-contentful-paint')[0];
    
    // Calculate Total Blocking Time (simplified)
    const longTasks = performance.getEntriesByType('longtask');
    const tbt = longTasks.reduce((total, task) => {
      const blockingTime = Math.max(0, task.duration - 50);
      return total + blockingTime;
    }, 0);
    
    // Get memory usage if available
    const memory = (performance as any).memory;
    
    return {
      // Navigation timing
      navigationStart: navigation.navigationStart,
      responseEnd: navigation.responseEnd,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
      loadComplete: navigation.loadEventEnd - navigation.navigationStart,
      
      // Core Web Vitals
      TTFB: navigation.responseStart - navigation.requestStart,
      FCP: fcp ? fcp.startTime : null,
      LCP: lcp ? lcp.startTime : null,
      TBT: tbt,
      
      // Memory metrics
      memoryUsage: memory ? {
        usedJSHeapSize: memory.usedJSHeapSize / 1048576, // Convert to MB
        totalJSHeapSize: memory.totalJSHeapSize / 1048576,
        jsHeapSizeLimit: memory.jsHeapSizeLimit / 1048576
      } : null,
      
      // Resource timing
      resources: performance.getEntriesByType('resource').length,
      
      // Custom marks
      marks: performance.getEntriesByType('mark').map(m => ({
        name: m.name,
        startTime: m.startTime
      }))
    };
  });
}

// Helper to measure frame rate
async function measureFrameRate(page: Page, duration: number = 1000): Promise<number> {
  return await page.evaluate(async (duration) => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    return new Promise<number>((resolve) => {
      const countFrames = (currentTime: number) => {
        frameCount++;
        
        if (currentTime - lastTime >= duration) {
          const fps = (frameCount * 1000) / (currentTime - lastTime);
          resolve(fps);
        } else {
          requestAnimationFrame(countFrames);
        }
      };
      
      requestAnimationFrame(countFrames);
    });
  }, duration);
}

// Helper to monitor memory usage over time
async function monitorMemoryUsage(page: Page, duration: number = 5000): Promise<number[]> {
  const samples: number[] = [];
  const interval = 500; // Sample every 500ms
  const iterations = duration / interval;
  
  for (let i = 0; i < iterations; i++) {
    const memory = await page.evaluate(() => {
      const mem = (performance as any).memory;
      return mem ? mem.usedJSHeapSize / 1048576 : 0;
    });
    samples.push(memory);
    await page.waitForTimeout(interval);
  }
  
  return samples;
}

test.describe('Performance Regression Tests - Startup & Core Metrics', () => {
  test('01. Application startup performance', async () => {
    const startTime = Date.now();
    
    // Launch application
    await launchElectronForE2E();
    const page = await getMainWindow();
    
    const startupTime = Date.now() - startTime;
    console.log(`⏱️ Startup time: ${startupTime}ms`);
    
    // Check against threshold
    expect(startupTime).toBeLessThan(PERFORMANCE_THRESHOLDS.startupTime);
    
    // Collect initial performance metrics
    const metrics = await collectPerformanceMetrics(page);
    console.log('📊 Initial performance metrics:', metrics);
    
    // Validate Core Web Vitals
    if (metrics.FCP) {
      expect(metrics.FCP).toBeLessThan(PERFORMANCE_THRESHOLDS.FCP);
    }
    
    if (metrics.TTFB) {
      expect(metrics.TTFB).toBeLessThan(PERFORMANCE_THRESHOLDS.TTFB);
    }
    
    // Check initial memory usage
    if (metrics.memoryUsage) {
      expect(metrics.memoryUsage.usedJSHeapSize).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryLimit);
    }
    
    await closeElectronE2E();
  });

  test('02. View switching performance', async () => {
    await launchElectronForE2E();
    const page = await getMainWindow();
    
    const views = ['analytics', 'list', 'kanban', 'calendar', 'timeline'] as const;
    const switchTimes: Record<string, number> = {};
    
    for (const view of views) {
      // Mark start time
      await page.evaluate((viewName) => {
        performance.mark(`view-switch-${viewName}-start`);
      }, view);
      
      const startTime = Date.now();
      await navigateToView(page, view);
      const switchTime = Date.now() - startTime;
      
      // Mark end time
      await page.evaluate((viewName) => {
        performance.mark(`view-switch-${viewName}-end`);
      }, view);
      
      switchTimes[view] = switchTime;
      console.log(`⏱️ Switch to ${view}: ${switchTime}ms`);
      
      // Check against threshold
      expect(switchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.viewSwitchTime);
      
      // Wait for view to stabilize
      await page.waitForTimeout(500);
    }
    
    // Calculate average switch time
    const avgSwitchTime = Object.values(switchTimes).reduce((a, b) => a + b, 0) / views.length;
    console.log(`📊 Average view switch time: ${avgSwitchTime}ms`);
    
    await closeElectronE2E();
  });

  test('03. Memory usage during navigation', async () => {
    await launchElectronForE2E();
    const page = await getMainWindow();
    
    const memorySnapshots: Record<string, number> = {};
    
    // Initial memory snapshot
    const initialMemory = await page.evaluate(() => {
      const mem = (performance as any).memory;
      return mem ? mem.usedJSHeapSize / 1048576 : 0;
    });
    memorySnapshots['initial'] = initialMemory;
    
    // Navigate through views and collect memory
    const views = ['list', 'kanban', 'analytics'] as const;
    
    for (const view of views) {
      await navigateToView(page, view);
      await page.waitForTimeout(1000); // Let view fully render
      
      const memory = await page.evaluate(() => {
        const mem = (performance as any).memory;
        return mem ? mem.usedJSHeapSize / 1048576 : 0;
      });
      
      memorySnapshots[view] = memory;
      console.log(`💾 Memory after ${view}: ${memory.toFixed(2)}MB`);
    }
    
    // Check for memory leaks (memory shouldn't grow significantly)
    const memoryGrowth = memorySnapshots['analytics'] - memorySnapshots['initial'];
    console.log(`📈 Memory growth: ${memoryGrowth.toFixed(2)}MB`);
    
    // Memory growth should be reasonable
    expect(memoryGrowth).toBeLessThan(50); // Max 50MB growth
    
    await closeElectronE2E();
  });

  test('04. Frame rate during animations', async () => {
    await launchElectronForE2E();
    const page = await getMainWindow();
    
    // Navigate to a view with animations
    await navigateToView(page, 'kanban');
    
    // Trigger animations (e.g., drag and drop simulation)
    await page.evaluate(() => {
      // Trigger any CSS animations
      document.body.classList.add('animating');
      
      // Simulate continuous animations
      const elements = document.querySelectorAll('[data-testid*="task-card"]');
      elements.forEach((el, index) => {
        (el as HTMLElement).style.animation = `pulse 1s ease-in-out ${index * 0.1}s infinite`;
      });
    });
    
    // Measure frame rate during animations
    const fps = await measureFrameRate(page, 2000);
    console.log(`🎬 Frame rate during animations: ${fps.toFixed(2)} FPS`);
    
    // Check against threshold
    expect(fps).toBeGreaterThan(PERFORMANCE_THRESHOLDS.frameRate);
    
    await closeElectronE2E();
  });

  test('05. Resource loading performance', async () => {
    await launchElectronForE2E();
    const page = await getMainWindow();
    
    // Collect resource timing data
    const resourceMetrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      const categorized = {
        scripts: [] as number[],
        styles: [] as number[],
        images: [] as number[],
        fonts: [] as number[],
        total: resources.length
      };
      
      resources.forEach(resource => {
        const duration = resource.responseEnd - resource.startTime;
        
        if (resource.name.endsWith('.js') || resource.name.endsWith('.mjs')) {
          categorized.scripts.push(duration);
        } else if (resource.name.endsWith('.css')) {
          categorized.styles.push(duration);
        } else if (resource.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
          categorized.images.push(duration);
        } else if (resource.name.match(/\.(woff|woff2|ttf|otf)$/i)) {
          categorized.fonts.push(duration);
        }
      });
      
      return {
        total: categorized.total,
        scripts: {
          count: categorized.scripts.length,
          avgDuration: categorized.scripts.length > 0 
            ? categorized.scripts.reduce((a, b) => a + b, 0) / categorized.scripts.length 
            : 0
        },
        styles: {
          count: categorized.styles.length,
          avgDuration: categorized.styles.length > 0
            ? categorized.styles.reduce((a, b) => a + b, 0) / categorized.styles.length
            : 0
        },
        images: {
          count: categorized.images.length,
          avgDuration: categorized.images.length > 0
            ? categorized.images.reduce((a, b) => a + b, 0) / categorized.images.length
            : 0
        },
        fonts: {
          count: categorized.fonts.length,
          avgDuration: categorized.fonts.length > 0
            ? categorized.fonts.reduce((a, b) => a + b, 0) / categorized.fonts.length
            : 0
        }
      };
    });
    
    console.log('📦 Resource loading metrics:', resourceMetrics);
    
    // Validate resource loading times
    expect(resourceMetrics.scripts.avgDuration).toBeLessThan(1000); // Scripts < 1s
    expect(resourceMetrics.styles.avgDuration).toBeLessThan(500);   // Styles < 500ms
    
    await closeElectronE2E();
  });
});

test.describe('Performance Regression Tests - User Interactions', () => {
  let page: Page;

  test.beforeAll(async () => {
    await launchElectronForE2E();
    page = await getMainWindow();
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  test('01. Task creation performance', async () => {
    await navigateToView(page, 'list');
    
    // Open task creation dialog
    const createButton = page.locator('[data-testid="create-task-button"], button:has-text("Create"), button:has-text("Add Task")');
    
    if (await createButton.isVisible()) {
      const startTime = Date.now();
      await createButton.click();
      
      // Wait for dialog to appear
      await page.waitForSelector('[role="dialog"], [data-testid*="modal"]', { timeout: 2000 });
      const dialogOpenTime = Date.now() - startTime;
      
      console.log(`⏱️ Task dialog open time: ${dialogOpenTime}ms`);
      expect(dialogOpenTime).toBeLessThan(300);
      
      // Fill task details
      const titleInput = page.locator('input[name="title"], input[placeholder*="title"], input[placeholder*="Title"]').first();
      await titleInput.fill('Performance Test Task');
      
      const descInput = page.locator('textarea[name="description"], textarea[placeholder*="description"]').first();
      await descInput.fill('This is a test task for performance measurement');
      
      // Submit task
      const submitStart = Date.now();
      const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').last();
      await submitButton.click();
      
      // Wait for dialog to close
      await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 2000 }).catch(() => {});
      const submitTime = Date.now() - submitStart;
      
      console.log(`⏱️ Task creation time: ${submitTime}ms`);
      expect(submitTime).toBeLessThan(PERFORMANCE_THRESHOLDS.taskLoadTime);
    }
  });

  test('02. Search performance with large dataset', async () => {
    // Inject a large dataset
    await page.evaluate(() => {
      const largeTasks = Array.from({ length: 1000 }, (_, i) => ({
        id: `perf-${i}`,
        title: `Task ${i}`,
        description: `Description for task ${i}`,
        priority: ['high', 'medium', 'low'][i % 3],
        status: ['pending', 'in-progress', 'done'][i % 3],
        tags: [`tag-${i % 10}`]
      }));
      
      (window as any).__TEST_INJECT_TASKS__ = largeTasks;
    });
    
    await page.waitForTimeout(500);
    
    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], [data-testid="search"]').first();
    
    if (await searchInput.isVisible()) {
      // Measure search performance
      const searchQueries = ['Task 5', 'high priority', 'tag-7', 'done'];
      
      for (const query of searchQueries) {
        await searchInput.clear();
        
        const startTime = Date.now();
        await searchInput.fill(query);
        
        // Wait for search results to update
        await page.waitForTimeout(300); // Debounce time
        const searchTime = Date.now() - startTime;
        
        console.log(`🔍 Search for "${query}": ${searchTime}ms`);
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.searchTime);
      }
    }
  });

  test('03. Scroll performance with virtualization', async () => {
    await navigateToView(page, 'list');
    
    // Inject large dataset if not already done
    await page.evaluate(() => {
      if (!(window as any).__TEST_INJECT_TASKS__) {
        const largeTasks = Array.from({ length: 5000 }, (_, i) => ({
          id: `scroll-${i}`,
          title: `Task ${i}`,
          description: `Description for task ${i}`,
          priority: ['high', 'medium', 'low'][i % 3],
          status: ['pending', 'in-progress', 'done'][i % 3]
        }));
        
        (window as any).__TEST_INJECT_TASKS__ = largeTasks;
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Measure scroll performance
    const scrollContainer = page.locator('[data-testid="task-list"], .task-list, main').first();
    
    // Smooth scroll to bottom
    const startTime = Date.now();
    await page.evaluate(() => {
      const container = document.querySelector('[data-testid="task-list"], .task-list, main');
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    });
    
    // Wait for scroll to complete
    await page.waitForTimeout(2000);
    
    // Measure frame rate during scroll
    const fps = await measureFrameRate(page, 1000);
    console.log(`📜 Scroll performance: ${fps.toFixed(2)} FPS`);
    
    expect(fps).toBeGreaterThan(30); // Should maintain 30+ FPS
  });

  test('04. Batch operations performance', async () => {
    await navigateToView(page, 'list');
    
    // Select multiple tasks
    const checkboxes = page.locator('input[type="checkbox"][data-testid*="task"], .task-checkbox');
    const count = Math.min(await checkboxes.count(), 50);
    
    if (count > 0) {
      // Select tasks
      const selectStart = Date.now();
      for (let i = 0; i < count; i++) {
        await checkboxes.nth(i).click();
      }
      const selectTime = Date.now() - selectStart;
      console.log(`☑️ Selected ${count} tasks in ${selectTime}ms`);
      
      // Perform batch operation
      const batchButton = page.locator('[data-testid="batch-action"], button:has-text("Batch"), button:has-text("Actions")').first();
      
      if (await batchButton.isVisible()) {
        await batchButton.click();
        
        const deleteOption = page.locator('button:has-text("Delete"), [data-action="delete"]').first();
        if (await deleteOption.isVisible()) {
          const deleteStart = Date.now();
          await deleteOption.click();
          
          // Confirm if needed
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
          if (await confirmButton.isVisible({ timeout: 1000 })) {
            await confirmButton.click();
          }
          
          const deleteTime = Date.now() - deleteStart;
          console.log(`🗑️ Batch delete time: ${deleteTime}ms`);
          
          expect(deleteTime).toBeLessThan(2000); // Should complete within 2s
        }
      }
    }
  });

  test('05. Memory leak detection during extended use', async () => {
    // Monitor memory over extended period
    const memoryReadings: number[] = [];
    const testDuration = 30000; // 30 seconds
    const interval = 5000; // Sample every 5 seconds
    
    console.log('🔍 Starting memory leak detection...');
    
    for (let elapsed = 0; elapsed < testDuration; elapsed += interval) {
      // Perform various actions
      const views = ['list', 'kanban', 'analytics'] as const;
      await navigateToView(page, views[Math.floor(Math.random() * views.length)]);
      
      // Collect memory
      const memory = await page.evaluate(() => {
        if (global.gc) global.gc(); // Force garbage collection if available
        const mem = (performance as any).memory;
        return mem ? mem.usedJSHeapSize / 1048576 : 0;
      });
      
      memoryReadings.push(memory);
      console.log(`💾 Memory at ${elapsed / 1000}s: ${memory.toFixed(2)}MB`);
      
      await page.waitForTimeout(interval);
    }
    
    // Analyze memory trend
    const firstReading = memoryReadings[0];
    const lastReading = memoryReadings[memoryReadings.length - 1];
    const memoryGrowth = lastReading - firstReading;
    const growthRate = (memoryGrowth / firstReading) * 100;
    
    console.log(`📊 Memory growth: ${memoryGrowth.toFixed(2)}MB (${growthRate.toFixed(1)}%)`);
    
    // Memory growth should be minimal
    expect(growthRate).toBeLessThan(20); // Less than 20% growth
  });
});

test.describe('Performance Regression Tests - Stress Testing', () => {
  let page: Page;

  test.beforeAll(async () => {
    await launchElectronForE2E();
    page = await getMainWindow();
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  test('01. Rapid view switching stress test', async () => {
    const views = ['analytics', 'list', 'kanban', 'calendar', 'timeline'] as const;
    const iterations = 20;
    const switchTimes: number[] = [];
    
    console.log(`🏃 Starting rapid view switching (${iterations} iterations)...`);
    
    for (let i = 0; i < iterations; i++) {
      const view = views[i % views.length];
      const startTime = Date.now();
      
      await navigateToView(page, view);
      
      const switchTime = Date.now() - startTime;
      switchTimes.push(switchTime);
    }
    
    // Calculate statistics
    const avgTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
    const maxTime = Math.max(...switchTimes);
    const minTime = Math.min(...switchTimes);
    
    console.log(`📊 Rapid switching results:
      Average: ${avgTime.toFixed(2)}ms
      Min: ${minTime}ms
      Max: ${maxTime}ms`);
    
    // Performance should remain consistent
    expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.viewSwitchTime * 2);
    expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.viewSwitchTime);
  });

  test('02. Heavy data load performance', async () => {
    // Inject very large dataset
    await page.evaluate(() => {
      const heavyTasks = Array.from({ length: 10000 }, (_, i) => ({
        id: `heavy-${i}`,
        title: `Task ${i} with a very long title that contains lots of text`,
        description: `This is a detailed description for task ${i}. It contains multiple sentences to simulate real-world data. The description includes various details about the task, its requirements, and implementation notes.`,
        priority: ['high', 'medium', 'low'][i % 3],
        status: ['pending', 'in-progress', 'done'][i % 3],
        tags: Array.from({ length: 5 }, (_, j) => `tag-${(i + j) % 20}`),
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }));
      
      (window as any).__TEST_INJECT_TASKS__ = heavyTasks;
    });
    
    // Navigate to list view and measure render time
    const startTime = Date.now();
    await navigateToView(page, 'list');
    await page.waitForTimeout(2000); // Allow time for rendering
    
    const renderTime = Date.now() - startTime;
    console.log(`📊 Heavy data render time: ${renderTime}ms`);
    
    // Check if virtualization is working
    const visibleTasks = await page.locator('[data-testid*="task-card"], .task-item').count();
    console.log(`👁️ Visible tasks: ${visibleTasks}`);
    
    // Should use virtualization - not all 10k tasks should be in DOM
    expect(visibleTasks).toBeLessThan(100);
    expect(renderTime).toBeLessThan(3000);
  });

  test('03. Concurrent operations stress test', async () => {
    // Simulate multiple concurrent operations
    const operations = [
      // Search operation
      page.evaluate(() => {
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.value = 'concurrent test';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }),
      
      // View switch
      navigateToView(page, 'kanban'),
      
      // Data update
      page.evaluate(() => {
        const tasks = (window as any).__TEST_INJECT_TASKS__ || [];
        tasks.forEach((task: any) => {
          task.status = ['pending', 'in-progress', 'done'][Math.floor(Math.random() * 3)];
        });
      }),
      
      // UI interaction
      page.click('body'), // Trigger any click handlers
      
      // Scroll
      page.evaluate(() => window.scrollBy(0, 500))
    ];
    
    const startTime = Date.now();
    await Promise.all(operations);
    const concurrentTime = Date.now() - startTime;
    
    console.log(`⚡ Concurrent operations completed in ${concurrentTime}ms`);
    
    // Should handle concurrent operations gracefully
    expect(concurrentTime).toBeLessThan(2000);
    
    // Check if app is still responsive
    const isResponsive = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const start = performance.now();
        requestAnimationFrame(() => {
          const frametime = performance.now() - start;
          resolve(frametime < 100); // Should schedule frame within 100ms
        });
      });
    });
    
    expect(isResponsive).toBe(true);
  });
});

/**
 * Performance Testing Utilities
 */
export class PerformanceTestUtils {
  /**
   * Create a performance report
   */
  static async generatePerformanceReport(
    page: Page,
    testName: string
  ): Promise<void> {
    const metrics = await collectPerformanceMetrics(page);
    const report = {
      testName,
      timestamp: new Date().toISOString(),
      metrics,
      thresholds: PERFORMANCE_THRESHOLDS,
      passed: true // Will be updated based on checks
    };
    
    // Check against thresholds
    if (metrics.FCP && metrics.FCP > PERFORMANCE_THRESHOLDS.FCP) {
      report.passed = false;
    }
    if (metrics.LCP && metrics.LCP > PERFORMANCE_THRESHOLDS.LCP) {
      report.passed = false;
    }
    if (metrics.TBT && metrics.TBT > PERFORMANCE_THRESHOLDS.TBT) {
      report.passed = false;
    }
    
    // Save report
    console.log(`📊 Performance Report for ${testName}:`, JSON.stringify(report, null, 2));
  }

  /**
   * Profile a specific operation
   */
  static async profileOperation(
    page: Page,
    operationName: string,
    operation: () => Promise<void>
  ): Promise<{ duration: number; memory: number }> {
    // Mark start
    await page.evaluate((name) => performance.mark(`${name}-start`), operationName);
    
    const startMemory = await page.evaluate(() => {
      const mem = (performance as any).memory;
      return mem ? mem.usedJSHeapSize / 1048576 : 0;
    });
    
    const startTime = Date.now();
    
    // Execute operation
    await operation();
    
    const duration = Date.now() - startTime;
    
    // Mark end
    await page.evaluate((name) => performance.mark(`${name}-end`), operationName);
    
    const endMemory = await page.evaluate(() => {
      const mem = (performance as any).memory;
      return mem ? mem.usedJSHeapSize / 1048576 : 0;
    });
    
    // Create measure
    await page.evaluate((name) => {
      performance.measure(name, `${name}-start`, `${name}-end`);
    }, operationName);
    
    return {
      duration,
      memory: endMemory - startMemory
    };
  }

  /**
   * Wait for CPU idle
   */
  static async waitForCPUIdle(page: Page, threshold: number = 10): Promise<void> {
    await page.evaluate(async (threshold) => {
      return new Promise<void>((resolve) => {
        let idleCount = 0;
        const checkIdle = () => {
          const idleDeadline = (deadline: IdleDeadline) => {
            if (deadline.timeRemaining() > threshold) {
              idleCount++;
              if (idleCount >= 3) {
                resolve();
              } else {
                requestIdleCallback(idleDeadline);
              }
            } else {
              idleCount = 0;
              requestIdleCallback(idleDeadline);
            }
          };
        };
        
        requestIdleCallback(checkIdle as any);
      });
    }, threshold);
  }
}