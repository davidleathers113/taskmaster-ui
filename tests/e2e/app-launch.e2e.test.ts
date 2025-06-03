/**
 * TaskMaster Electron Application Launch E2E Tests (2025)
 * 
 * Comprehensive smoke tests to verify Playwright + Electron integration
 * and basic application functionality. This test suite validates:
 * 
 * - App launch and initialization
 * - Main window creation and visibility
 * - React application rendering
 * - Basic UI components and navigation
 * - Performance metrics and stability
 * - Cross-platform compatibility
 * 
 * Following 2025 best practices for Electron E2E testing with Playwright.
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { join } from 'path';
import { 
  launchElectronForE2E, 
  getMainWindow, 
  closeElectronE2E,
  takeE2EScreenshot,
  simulateUserActions,
  measureE2EPerformance,
  validateAccessibility
} from '../setup/e2e.setup';

/**
 * Test Suite: Application Launch and Basic Functionality
 */
test.describe('TaskMaster Electron App Launch', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  /**
   * Setup: Launch Electron app before each test
   */
  test.beforeEach(async () => {
    console.log('🚀 Starting TaskMaster Electron app for E2E testing...');
    
    // Launch Electron with optimized settings for E2E testing
    electronApp = await launchElectronForE2E({
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        PLAYWRIGHT_TEST: '1',
        ELECTRON_UPDATER_DISABLED: '1',
        ELECTRON_ENABLE_LOGGING: '1'
      },
      recordVideo: process.env.CI === 'true',
      slowMo: process.env.PLAYWRIGHT_DEBUG ? 500 : 0
    });

    // Get main window and configure for testing
    page = await getMainWindow();
    
    console.log('✅ TaskMaster app launched and ready for testing');
  });

  /**
   * Cleanup: Close app after each test
   */
  test.afterEach(async () => {
    console.log('🧹 Cleaning up TaskMaster app after test...');
    await closeElectronE2E();
    console.log('✅ Cleanup complete');
  });

  /**
   * Test: Basic App Launch and Window Creation
   */
  test('should launch TaskMaster app successfully', async () => {
    // Verify app is running
    expect(electronApp).toBeTruthy();
    
    // Verify main window exists and is visible
    expect(page).toBeTruthy();
    
    // 2025 Best Practice: Handle title check robustly
    const title = await page.title();
    console.log(`  Window title: "${title}"`);
    
    // Check for app content instead of title (more reliable)
    const appRoot = page.locator('#root, [data-testid="app-root"], .App');
    await expect(appRoot).toBeVisible({ timeout: 10000 });
    
    // If title check is needed, handle DevTools case
    if (!title.toLowerCase().includes('devtools')) {
      expect(title.toLowerCase()).toContain('taskmaster');
    } else {
      console.log('  ⚠️ DevTools window detected, skipping title check');
    }
    
    // Take screenshot for visual verification
    await takeE2EScreenshot('app-launch-success');
    
    console.log('✅ App launch test passed');
  });

  /**
   * Test: React Application Rendering
   */
  test('should render React application with main UI components', async () => {
    // Wait for React app to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    
    // Look for app root element (React mount point)
    const appRoot = page.locator('#root, [data-testid="app-root"]');
    await expect(appRoot).toBeVisible({ timeout: 15000 });
    
    // Verify main UI components are rendered
    await expect(page.locator('header, .header, [data-testid="header"]')).toBeVisible();
    await expect(page.locator('main, .main-content, [data-testid="main-content"]')).toBeVisible();
    
    // Take screenshot of rendered UI
    await takeE2EScreenshot('react-ui-rendered');
    
    console.log('✅ React UI rendering test passed');
  });

  /**
   * Test: Window Properties and Dimensions
   */
  test('should have correct window properties and dimensions', async () => {
    // Verify window dimensions
    const viewportSize = await page.viewportSize();
    expect(viewportSize?.width).toBeGreaterThanOrEqual(1200);
    expect(viewportSize?.height).toBeGreaterThanOrEqual(700);
    
    // Verify window is resizable
    await page.setViewportSize({ width: 1400, height: 900 });
    const newSize = await page.viewportSize();
    expect(newSize?.width).toBe(1400);
    expect(newSize?.height).toBe(900);
    
    // Reset to standard size
    await page.setViewportSize({ width: 1280, height: 720 });
    
    console.log('✅ Window properties test passed');
  });

  /**
   * Test: Task Management Interface
   */
  test('should display task management interface', async () => {
    // Wait for interface to load
    await page.waitForTimeout(2000);
    
    // Look for task-related UI elements or empty state
    const taskElements = [
      '[data-testid="task-list"]',
      '[data-testid="task-card"]', 
      '.task-list',
      '.task-card',
      '.task-item',
      '[class*="task"]'
    ];
    
    // Check for task UI or empty state
    let interfaceFound = false;
    for (const selector of taskElements) {
      const element = page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        interfaceFound = true;
        break;
      }
    }
    
    if (!interfaceFound) {
      // Check for empty state
      const emptyStateElements = [
        '[data-testid="empty-state"]',
        '.empty-state',
        'text=No tasks',
        'text=Get started'
      ];
      
      for (const selector of emptyStateElements) {
        const element = page.locator(selector).first();
        if (await element.isVisible().catch(() => false)) {
          interfaceFound = true;
          break;
        }
      }
    }
    
    expect(interfaceFound).toBeTruthy();
    await takeE2EScreenshot('task-management-ui');
    
    console.log('✅ Task management UI test passed');
  });

  /**
   * Test: Performance Metrics
   */
  test('should have reasonable performance metrics', async () => {
    // Measure performance metrics
    const metrics = await measureE2EPerformance();
    
    // Verify startup time is reasonable (under 10 seconds)
    if (metrics.startupTime) {
      expect(metrics.startupTime).toBeLessThan(10000);
      console.log(`📊 App startup time: ${metrics.startupTime}ms`);
    }
    
    // Verify memory usage is reasonable (under 200MB)
    if (metrics.memoryUsage) {
      const memoryMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
      expect(memoryMB).toBeLessThan(200);
      console.log(`📊 Memory usage: ${memoryMB.toFixed(2)}MB`);
    }
    
    console.log('✅ Performance metrics test passed');
  });

  /**
   * Test: Error Handling and Stability
   */
  test('should handle errors gracefully', async () => {
    // Monitor console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Monitor page errors
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    
    // Perform basic interactions
    await page.waitForTimeout(3000);
    
    // Check for critical errors (filter out minor warnings)
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Warning') && 
      !error.includes('DevTools') &&
      !error.includes('favicon')
    );
    
    const criticalPageErrors = pageErrors.filter(error =>
      !error.includes('Warning') &&
      !error.includes('DevTools')
    );
    
    expect(criticalErrors.length).toBeLessThan(5);
    expect(criticalPageErrors.length).toBe(0);
    
    await takeE2EScreenshot('error-handling-test');
    
    console.log('✅ Error handling test passed');
  });

  /**
   * Test: App Close and Cleanup
   */
  test('should close cleanly without hanging', async () => {
    // Verify app is running before close
    expect(electronApp).toBeTruthy();
    expect(page).toBeTruthy();
    
    // Take final screenshot
    await takeE2EScreenshot('before-close');
    
    // Close app and measure time
    const closeStartTime = Date.now();
    await closeElectronE2E();
    const closeTime = Date.now() - closeStartTime;
    
    // Verify app closed in reasonable time (under 5 seconds)
    expect(closeTime).toBeLessThan(5000);
    
    console.log(`📊 App close time: ${closeTime}ms`);
    console.log('✅ Clean app close test passed');
  });
});

/**
 * Test Suite: Cross-Platform Compatibility (CI Only)
 */
test.describe('Cross-Platform Compatibility', () => {
  test.skip(!process.env.CI, 'Cross-platform tests only run in CI');

  test('should work on current platform', async () => {
    const electronApp = await launchElectronForE2E();
    const page = await getMainWindow();
    
    await expect(page).toHaveTitle(/TaskMaster/i);
    
    const platform = process.platform;
    console.log(`🖥️ Testing on platform: ${platform}`);
    
    const viewportSize = await page.viewportSize();
    expect(viewportSize).toBeTruthy();
    
    await takeE2EScreenshot(`platform-${platform}`);
    await closeElectronE2E();
    
    console.log(`✅ Platform compatibility test passed for ${platform}`);
  });
});