/**
 * Basic Memory Testing for TaskMaster (2025)
 * 
 * Simplified memory leak detection using real UI elements and modern CDP patterns.
 * Tests basic navigation patterns and memory stability.
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchElectronForE2E, getMainWindow, closeElectronE2E } from '../setup/e2e.setup';
import { MemoryTestHelper, MemoryThresholds } from '../utils/memory-test-utils';

test.describe('Basic Memory Testing Suite', () => {
  let app: ElectronApplication;
  let page: Page;
  let memoryHelper: MemoryTestHelper;

  const memoryThresholds: MemoryThresholds = {
    maxHeapSize: 100 * 1024 * 1024, // 100MB
    maxHeapGrowth: 10 * 1024 * 1024, // 10MB
    maxDetachedNodes: 50,
    maxListeners: 30,
    maxDomNodes: 3000
  };

  test.beforeAll(async () => {
    console.log('🧪 Starting Basic Memory Testing Suite...');
    app = await launchElectronForE2E({
      env: {
        NODE_OPTIONS: '--expose-gc',
        ELECTRON_ENABLE_MEMORY_PROFILING: '1'
      }
    });
    page = await getMainWindow();
    memoryHelper = new MemoryTestHelper(page, memoryThresholds);
    
    // Wait for app to fully load
    await page.waitForSelector('text=TaskMaster', { timeout: 10000 });
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  test.beforeEach(async () => {
    await memoryHelper.clearMemory();
    await page.waitForTimeout(1000);
  });

  test('should maintain stable memory during basic app usage', async () => {
    console.log('📊 Testing basic memory stability...');

    const initialMetrics = await memoryHelper.captureMetrics();
    console.log(`Initial: Heap ${(initialMetrics.jsHeapSize / 1024 / 1024).toFixed(2)}MB`);

    // Interact with actual UI elements
    // 1. Look for the sample task
    const welcomeTask = page.getByText('Welcome to TaskMaster!');
    if (await welcomeTask.isVisible()) {
      await welcomeTask.click();
      await page.waitForTimeout(1000);
    }

    // 2. Navigate using semantic selectors
    // Check if sidebar is visible and interact with it
    const sidebar = page.locator('[class*="sidebar"], nav, [role="navigation"]').first();
    if (await sidebar.isVisible()) {
      await sidebar.hover();
      await page.waitForTimeout(500);
    }

    // 3. Force GC and check final memory
    await memoryHelper.forceGarbageCollection();
    await page.waitForTimeout(2000);

    const finalMetrics = await memoryHelper.captureMetrics();
    console.log(`Final: Heap ${(finalMetrics.jsHeapSize / 1024 / 1024).toFixed(2)}MB`);

    const growth = finalMetrics.jsHeapSize - initialMetrics.jsHeapSize;
    const percentageGrowth = (growth / initialMetrics.jsHeapSize) * 100;

    console.log(`Growth: ${(growth / 1024 / 1024).toFixed(2)}MB (${percentageGrowth.toFixed(2)}%)`);

    // Assert reasonable memory usage
    expect(growth).toBeLessThan(memoryThresholds.maxHeapGrowth);
    expect(percentageGrowth).toBeLessThan(15); // Less than 15% growth
    expect(finalMetrics.jsHeapSize).toBeLessThan(memoryThresholds.maxHeapSize);
  });

  test('should have functional memory utilities', async () => {
    console.log('🔧 Testing memory utility functions...');

    // Test basic memory capture
    const metrics = await memoryHelper.captureMetrics();
    expect(metrics.timestamp).toBeGreaterThan(0);
    expect(metrics.jsHeapSize).toBeGreaterThan(0);
    expect(metrics.domNodes).toBeGreaterThan(0);

    // Test GC functionality
    await expect(async () => {
      await memoryHelper.forceGarbageCollection();
    }).not.toThrow();

    // Test threshold checking
    const withinThresholds = memoryHelper.isWithinThresholds(metrics);
    expect(typeof withinThresholds).toBe('boolean');

    console.log('✅ Memory utilities working correctly');
  });
});