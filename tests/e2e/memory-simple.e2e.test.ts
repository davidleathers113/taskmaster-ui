/**
 * Simplified Memory Testing for TaskMaster (2025)
 * 
 * Basic memory tests that work with Playwright + Electron
 * without requiring full MemLab integration.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchElectronForE2E, getMainWindow, closeElectronE2E } from '../setup/e2e.setup';
import { 
  MemoryTestHelper, 
  MemoryMetrics,
  analyzeMemoryGrowth
} from '../utils/memory-test-utils';

test.describe('Basic Memory Tests', () => {
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    console.log('🧪 Starting Basic Memory Tests...');
    app = await launchElectronForE2E({
      env: {
        NODE_OPTIONS: '--expose-gc --max-old-space-size=512',
        ELECTRON_ENABLE_MEMORY_PROFILING: '1'
      }
    });
    page = await getMainWindow();
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  /**
   * Test 1: Basic Memory Stability
   */
  test('should maintain stable memory during navigation', async () => {
    console.log('📊 Testing memory stability...');

    const helper = new MemoryTestHelper(page, {
      maxHeapSize: 300 * 1024 * 1024,
      maxHeapGrowth: 50 * 1024 * 1024,
      maxDetachedNodes: 100,
      maxListeners: 50,
      maxDomNodes: 5000
    });

    // Capture initial metrics
    const initialMetrics = await helper.captureMetrics();
    console.log(`Initial heap: ${(initialMetrics.jsHeapSize / 1024 / 1024).toFixed(2)}MB`);

    // Perform navigation
    await page.waitForTimeout(2000); // Let app stabilize
    
    // Check if navigation elements exist
    const tasksNav = await page.locator('[data-testid="tasks-nav"], button:has-text("Tasks")').first();
    if (await tasksNav.isVisible({ timeout: 5000 })) {
      await tasksNav.click();
      await page.waitForTimeout(1000);
    }

    const analyticsNav = await page.locator('[data-testid="analytics-nav"], button:has-text("Overview")').first();
    if (await analyticsNav.isVisible({ timeout: 5000 })) {
      await analyticsNav.click();
      await page.waitForTimeout(1000);
    }

    // Force garbage collection
    await helper.forceGarbageCollection();
    await page.waitForTimeout(2000);

    // Capture final metrics
    const finalMetrics = await helper.captureMetrics();
    console.log(`Final heap: ${(finalMetrics.jsHeapSize / 1024 / 1024).toFixed(2)}MB`);

    // Analyze growth
    const growth = analyzeMemoryGrowth(initialMetrics, finalMetrics);
    console.log(`Memory growth: ${(growth.heapGrowth / 1024 / 1024).toFixed(2)}MB (${growth.percentageGrowth.toFixed(2)}%)`);

    // Assert reasonable growth
    expect(growth.heapGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
    expect(growth.percentageGrowth).toBeLessThan(25); // Less than 25% growth
  });

  /**
   * Test 2: DOM Node Cleanup
   */
  test('should not accumulate DOM nodes', async () => {
    console.log('📊 Testing DOM node cleanup...');

    const helper = new MemoryTestHelper(page, {
      maxHeapSize: 300 * 1024 * 1024,
      maxHeapGrowth: 50 * 1024 * 1024,
      maxDetachedNodes: 100,
      maxListeners: 50,
      maxDomNodes: 5000
    });

    const initialMetrics = await helper.captureMetrics();
    console.log(`Initial DOM nodes: ${initialMetrics.domNodes}`);

    // Perform actions that create/destroy DOM nodes
    for (let i = 0; i < 5; i++) {
      // Try to open and close a modal or panel
      const addButton = await page.locator('[data-testid="add-task-button"], button:has-text("Add")').first();
      if (await addButton.isVisible({ timeout: 2000 })) {
        await addButton.click();
        await page.waitForTimeout(500);
        
        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    const finalMetrics = await helper.captureMetrics();
    console.log(`Final DOM nodes: ${finalMetrics.domNodes}`);

    const domGrowth = finalMetrics.domNodes - initialMetrics.domNodes;
    console.log(`DOM node growth: ${domGrowth}`);

    // Assert minimal DOM growth
    expect(domGrowth).toBeLessThan(100);
  });

  /**
   * Test 3: Process Memory Monitoring
   */
  test('should monitor Electron process memory', async () => {
    console.log('📊 Testing process memory...');

    // Get main process memory
    const mainMemory = await app.evaluate(async () => {
      return process.memoryUsage();
    });

    console.log('Main process memory:');
    console.log(`  RSS: ${(mainMemory.rss / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Heap Total: ${(mainMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Heap Used: ${(mainMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  External: ${(mainMemory.external / 1024 / 1024).toFixed(2)}MB`);

    // Check renderer process memory
    const rendererMemory = await page.evaluate(() => {
      if ((performance as any).memory) {
        return {
          jsHeapSize: (performance as any).memory.usedJSHeapSize,
          totalHeapSize: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    if (rendererMemory) {
      console.log('Renderer process memory:');
      console.log(`  JS Heap: ${(rendererMemory.jsHeapSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Total Heap: ${(rendererMemory.totalHeapSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Heap Limit: ${(rendererMemory.limit / 1024 / 1024).toFixed(2)}MB`);
    }

    // Basic assertions
    expect(mainMemory.heapUsed).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
    expect(rendererMemory?.jsHeapSize || 0).toBeLessThan(150 * 1024 * 1024); // Less than 150MB
  });
});