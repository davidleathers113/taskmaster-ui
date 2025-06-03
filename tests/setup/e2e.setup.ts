/**
 * TaskMaster E2E Setup and Helper Functions (2025)
 * 
 * Comprehensive setup utilities for Playwright + Electron testing following
 * 2025 best practices. Provides reusable functions for app lifecycle management,
 * performance monitoring, accessibility validation, and test utilities.
 * 
 * Features:
 * - Electron app launch with optimized settings
 * - Window management and configuration
 * - Performance and memory monitoring
 * - Screenshot and video utilities
 * - Accessibility testing support
 * - Cross-platform compatibility
 * - Error handling and logging
 */

import { ElectronApplication, Page, _electron as electron, type FullConfig } from '@playwright/test';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { join as pathJoin } from 'path';

// Global variables for test session
let globalElectronApp: ElectronApplication | null = null;
let globalMainPage: Page | null = null;

// 2025 Best Practice: Track all windows for debugging
const windowTracker = new Map<string, Page>();
let windowCounter = 0;

/**
 * Interface for launch options
 */
interface LaunchOptions {
  env?: Record<string, string>;
  recordVideo?: boolean;
  slowMo?: number;
  headless?: boolean;
  timeout?: number;
}

/**
 * Interface for performance metrics
 */
interface PerformanceMetrics {
  startupTime?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  timestamp: number;
}

/**
 * Launch Electron application with optimized settings for E2E testing
 * Following 2025 best practices for Playwright + Electron integration
 */
export async function launchElectronForE2E(options: LaunchOptions = {}): Promise<ElectronApplication> {
  console.log('🚀 Launching TaskMaster Electron app for E2E testing...');
  
  const startTime = Date.now();
  
  // Default environment variables for testing
  const defaultEnv = {
    NODE_ENV: 'test',
    ELECTRON_IS_DEV: '0',
    PLAYWRIGHT_TEST: '1',
    ELECTRON_UPDATER_DISABLED: '1',
    ELECTRON_ENABLE_LOGGING: '1',
    CI: process.env.CI || 'false'
  };

  // Determine the main file path
  const mainPath = process.env.ELECTRON_MAIN_PATH || join(process.cwd(), 'dist', 'electron', 'main.cjs');
  
  try {
    // Launch Electron with optimized configuration
    globalElectronApp = await electron.launch({
      args: [mainPath],
      env: {
        ...defaultEnv,
        ...options.env
      },
      timeout: options.timeout || 30000,
      // Enable logging for debugging
      // Enable logging for debugging
      // (logger option removed in newer Playwright - use ELECTRON_ENABLE_LOGGING=1 env var instead)
    });

    // 2025 Best Practice: Set up window event tracking
    globalElectronApp.on('window', async (window) => {
      windowCounter++;
      const windowId = `window-${windowCounter}`;
      
      try {
        // Wait for window to be ready
        await window.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
        
        const title = await window.title();
        const url = await window.url();
        
        console.log(`📱 New window opened [${windowId}]: title="${title}", url="${url}"`);
        windowTracker.set(windowId, window);
        
        // Attach console logging for debugging
        if (process.env.PLAYWRIGHT_DEBUG) {
          window.on('console', (msg) => {
            console.log(`[${windowId} CONSOLE]:`, msg.text());
          });
        }
      } catch (err) {
        console.log(`⚠️  Error tracking window [${windowId}]:`, err);
      }
    });

    const launchTime = Date.now() - startTime;
    console.log(`✅ Electron app launched successfully in ${launchTime}ms`);

    return globalElectronApp;
  } catch (error) {
    console.error('❌ Failed to launch Electron app:', error);
    throw error;
  }
}

/**
 * Get the main window and configure it for testing
 * Implements 2025 best practices for window management
 */
export async function getMainWindow(): Promise<Page> {
  if (!globalElectronApp) {
    throw new Error('Electron app must be launched before getting main window');
  }

  console.log('🪟 Getting main window for testing...');

  try {
    // 2025 Best Practice: Handle multiple windows including DevTools
    // Wait for window with timeout
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const windows = globalElectronApp.windows();
      console.log(`  Found ${windows.length} window(s)`);
      
      // Look for the main application window (not DevTools)
      for (const window of windows) {
        try {
          const title = await window.title();
          const url = await window.url();
          console.log(`  Checking window: title="${title}", url="${url}"`);
          
          // Skip DevTools windows
          if (title.toLowerCase().includes('devtools') || 
              url.includes('devtools://')) {
            console.log('  ↳ Skipping DevTools window');
            continue;
          }
          
          // Found main window
          console.log('  ↳ Found main application window!');
          globalMainPage = window;
          break;
        } catch (err) {
          // Window might be closed or not ready
          console.log('  ↳ Error checking window:', err);
        }
      }
      
      if (globalMainPage) {
        break;
      }
      
      // If no windows yet or only DevTools, wait a bit
      if (windows.length === 0 || !globalMainPage) {
        console.log('  Waiting for main window...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Fallback: try firstWindow if no main window found
    if (!globalMainPage) {
      console.log('⚠️  No main window found, trying firstWindow()...');
      globalMainPage = await globalElectronApp.firstWindow();
    }
    
    // Configure page for testing
    await configurePageForTesting(globalMainPage);
    
    console.log('✅ Main window configured and ready for testing');
    return globalMainPage;
  } catch (error) {
    console.error('❌ Failed to get main window:', error);
    throw error;
  }
}

/**
 * Configure page with testing optimizations
 */
async function configurePageForTesting(page: Page): Promise<void> {
  // Set viewport to standard testing size
  await page.setViewportSize({ width: 1280, height: 720 });
  
  // Set up console logging for debugging
  if (process.env.PLAYWRIGHT_DEBUG) {
    page.on('console', (msg) => {
      console.log(`[BROWSER CONSOLE ${msg.type()}]:`, msg.text());
    });
    
    page.on('pageerror', (error) => {
      console.error('[BROWSER ERROR]:', error.message);
    });
  }

  // Wait for the page to be ready
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000); // Allow for initial animations
}

/**
 * Close Electron application and cleanup resources
 */
export async function closeElectronE2E(): Promise<void> {
  if (!globalElectronApp) {
    console.log('⚠️ No Electron app to close');
    return;
  }

  console.log('🧹 Closing Electron app and cleaning up...');
  
  try {
    await globalElectronApp.close();
    globalElectronApp = null;
    globalMainPage = null;
    
    // Clear window tracker
    windowTracker.clear();
    windowCounter = 0;
    
    console.log('✅ Electron app closed successfully');
  } catch (error) {
    console.error('❌ Error closing Electron app:', error);
  }
}

/**
 * Wait for a window with a specific title
 * 2025 Best Practice: Robust window detection with timeout
 */
export async function waitForWindowWithTitle(
  title: string | RegExp,
  options: { timeout?: number; exact?: boolean } = {}
): Promise<Page | null> {
  if (!globalElectronApp) {
    throw new Error('Electron app must be launched before waiting for windows');
  }
  
  const timeout = options.timeout || 30000;
  const exact = options.exact ?? false;
  const startTime = Date.now();
  
  console.log(`🔍 Waiting for window with title: ${title}`);
  
  while (Date.now() - startTime < timeout) {
    const windows = globalElectronApp.windows();
    
    for (const window of windows) {
      try {
        const windowTitle = await window.title();
        
        const matches = title instanceof RegExp 
          ? title.test(windowTitle)
          : exact 
            ? windowTitle === title
            : windowTitle.includes(title);
            
        if (matches) {
          console.log(`✅ Found window with title: "${windowTitle}"`);
          return window;
        }
      } catch (err) {
        // Window might be closed or not ready
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`⚠️ Timeout waiting for window with title: ${title}`);
  return null;
}

/**
 * Get all tracked windows for debugging
 * 2025 Best Practice: Window introspection for debugging
 */
export async function getTrackedWindows(): Promise<Array<{ id: string; title: string; url: string }>> {
  const windows: Array<{ id: string; title: string; url: string }> = [];
  
  for (const [id, window] of windowTracker.entries()) {
    try {
      const title = await window.title().catch(() => 'Unknown');
      const url = await window.url().catch(() => 'Unknown');
      windows.push({ id, title, url });
    } catch (err) {
      // Window might be closed
    }
  }
  
  return windows;
}

/**
 * Debug helper: Log all current windows
 */
export async function logAllWindows(): Promise<void> {
  if (!globalElectronApp) {
    console.log('⚠️ No Electron app running');
    return;
  }
  
  const windows = globalElectronApp.windows();
  console.log(`\n📱 Current Windows (${windows.length} total):`);
  
  for (let i = 0; i < windows.length; i++) {
    try {
      const title = await windows[i].title().catch(() => 'Unknown');
      const url = await windows[i].url().catch(() => 'Unknown');
      console.log(`  ${i + 1}. title="${title}", url="${url}"`);
    } catch (err) {
      console.log(`  ${i + 1}. [Error reading window info]`);
    }
  }
  console.log('');
}

/**
 * Take a screenshot with consistent naming and storage
 * Following 2025 best practices for visual testing
 */
export async function takeE2EScreenshot(name: string, options?: { fullPage?: boolean }): Promise<void> {
  if (!globalMainPage) {
    console.warn('⚠️ No page available for screenshot');
    return;
  }

  try {
    const screenshotPath = join('test-results', 'screenshots', `${name}-${Date.now()}.png`);
    
    await globalMainPage.screenshot({
      path: screenshotPath,
      fullPage: options?.fullPage ?? true,
      animations: 'disabled'
    });

    console.log(`📸 Screenshot saved: ${screenshotPath}`);
  } catch (error) {
    console.error('❌ Failed to take screenshot:', error);
  }
}

/**
 * Simulate user actions with realistic timing
 * Following 2025 UX testing best practices
 */
export async function simulateUserActions(page: Page, actions: Array<{
  type: 'click' | 'type' | 'wait' | 'hover' | 'scroll';
  selector?: string;
  text?: string;
  delay?: number;
}>): Promise<void> {
  for (const action of actions) {
    switch (action.type) {
      case 'click':
        if (action.selector) {
          await page.click(action.selector);
          await page.waitForTimeout(action.delay || 200);
        }
        break;
      case 'type':
        if (action.selector && action.text) {
          await page.fill(action.selector, action.text);
          await page.waitForTimeout(action.delay || 100);
        }
        break;
      case 'hover':
        if (action.selector) {
          await page.hover(action.selector);
          await page.waitForTimeout(action.delay || 100);
        }
        break;
      case 'wait':
        await page.waitForTimeout(action.delay || 1000);
        break;
      case 'scroll':
        await page.evaluate(() => window.scrollBy(0, 100));
        await page.waitForTimeout(action.delay || 100);
        break;
    }
  }
}

/**
 * Measure performance metrics
 * Following 2025 performance testing standards
 */
export async function measureE2EPerformance(): Promise<PerformanceMetrics> {
  const metrics: PerformanceMetrics = {
    timestamp: Date.now()
  };

  try {
    if (globalElectronApp) {
      // Measure memory usage
      const mainProcess = globalElectronApp.process();
      if (mainProcess) {
        metrics.memoryUsage = process.memoryUsage();
        metrics.cpuUsage = process.cpuUsage();
      }
    }

    if (globalMainPage) {
      // Measure page performance
      const performanceMetrics = await globalMainPage.evaluate(() => {
        return {
          timing: performance.timing,
          navigation: performance.navigation,
          memory: (performance as any).memory
        };
      });

      // Calculate startup time if available
      if (performanceMetrics.timing) {
        metrics.startupTime = performanceMetrics.timing.loadEventEnd - performanceMetrics.timing.navigationStart;
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not measure performance:', error);
  }

  return metrics;
}

/**
 * Wait for specific condition with timeout
 * Implementing 2025 async testing patterns
 */
export async function waitForE2ECondition(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number; description?: string } = {}
): Promise<void> {
  const timeout = options.timeout || 15000;
  const interval = options.interval || 500;
  const description = options.description || 'condition';
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      if (await condition()) {
        console.log(`✅ Condition met: ${description}`);
        return;
      }
    } catch (error) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`❌ Timeout waiting for ${description} (${timeout}ms)`);
}

/**
 * Validate accessibility following 2025 a11y standards
 */
export async function validateAccessibility(page: Page): Promise<void> {
  try {
    // Check for basic accessibility requirements
    const accessibilityIssues = await page.evaluate(() => {
      const issues: string[] = [];
      
      // Check for alt text on images
      const images = document.querySelectorAll('img');
      images.forEach((img, index) => {
        if (!img.alt && !img.getAttribute('aria-label')) {
          issues.push(`Image ${index + 1} missing alt text`);
        }
      });
      
      // Check for form labels
      const inputs = document.querySelectorAll('input, textarea, select');
      inputs.forEach((input, index) => {
        const id = input.id;
        const hasLabel = id && document.querySelector(`label[for="${id}"]`);
        const hasAriaLabel = input.getAttribute('aria-label');
        
        if (!hasLabel && !hasAriaLabel) {
          issues.push(`Form element ${index + 1} missing label`);
        }
      });
      
      // Check for heading structure
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings.length === 0) {
        issues.push('No heading elements found');
      }
      
      return issues;
    });
    
    if (accessibilityIssues.length > 0) {
      console.warn('⚠️ Accessibility issues found:', accessibilityIssues);
    } else {
      console.log('✅ Basic accessibility validation passed');
    }
  } catch (error) {
    console.warn('⚠️ Accessibility validation failed:', error);
  }
}

/**
 * Navigate to a specific view using the sidebar
 * Implements view switching test patterns
 */
export async function navigateToView(page: Page, viewType: 'list' | 'kanban' | 'calendar' | 'timeline' | 'analytics' | 'claude-config'): Promise<void> {
  console.log(`🧭 Navigating to ${viewType} view...`);
  
  // Mapping of view types to possible selectors
  const viewSelectors: Record<string, string[]> = {
    list: [
      '[data-testid="tasks-nav"]',
      'button:has-text("All Tasks")',
      'nav button:has-text("Tasks")',
      '[aria-label*="tasks"]'
    ],
    kanban: [
      '[data-testid="kanban-nav"]',
      'button:has-text("Kanban")',
      'nav button:has-text("Board")',
      '[aria-label*="kanban"]'
    ],
    calendar: [
      '[data-testid="calendar-nav"]',
      'button:has-text("Calendar")',
      '[aria-label*="calendar"]'
    ],
    timeline: [
      '[data-testid="timeline-nav"]',
      'button:has-text("Timeline")',
      '[aria-label*="timeline"]'
    ],
    analytics: [
      '[data-testid="analytics-nav"]',
      'button:has-text("Overview")',
      'button:has-text("Analytics")',
      '[aria-label*="overview"]'
    ],
    'claude-config': [
      '[data-testid="claude-config-nav"]',
      'button:has-text("Claude Config")',
      'button:has-text("Settings")',
      '[aria-label*="config"]'
    ]
  };
  
  const selectors = viewSelectors[viewType] || [];
  
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.click();
        await page.waitForTimeout(500); // Allow for view transition
        console.log(`✅ Successfully navigated to ${viewType} view`);
        return;
      }
    } catch (error) {
      // Continue to next selector
    }
  }
  
  // Fallback: try keyboard shortcuts
  const shortcuts: Record<string, string> = {
    analytics: 'Meta+1',
    list: 'Meta+2',
    calendar: 'Meta+3',
    kanban: 'Meta+4',
    timeline: 'Meta+5',
    'claude-config': 'Meta+6'
  };
  
  if (shortcuts[viewType]) {
    console.log(`🎹 Using keyboard shortcut for ${viewType} view`);
    await page.keyboard.press(shortcuts[viewType]);
    await page.waitForTimeout(500);
  } else {
    throw new Error(`❌ Could not navigate to ${viewType} view`);
  }
}

/**
 * Verify that a specific view is currently active
 */
export async function verifyActiveView(page: Page, expectedView: string): Promise<boolean> {
  try {
    // Check for view-specific elements or indicators
    const viewIndicators = [
      `[data-view="${expectedView}"]`,
      `[data-testid="${expectedView}-view"]`,
      `.${expectedView}-view`,
      `[aria-label*="${expectedView}"]`
    ];
    
    for (const selector of viewIndicators) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        return true;
      }
    }
    
    // Check if the URL or state indicates the current view
    const currentView = await page.evaluate(() => {
      // Try to get view state from various possible sources
      return (window as any).__CURRENT_VIEW__ || 
             document.body.getAttribute('data-view') ||
             document.documentElement.getAttribute('data-view');
    });
    
    return currentView === expectedView;
  } catch (error) {
    console.warn(`⚠️ Could not verify ${expectedView} view:`, error);
    return false;
  }
}

/**
 * Get current view information for debugging
 */
export async function getCurrentViewInfo(page: Page): Promise<{ view?: string; elements: string[] }> {
  try {
    const info = await page.evaluate(() => {
      const elements: string[] = [];
      
      // Look for view indicators
      const possibleViewElements = document.querySelectorAll('[data-view], [data-testid*="view"], [class*="view"]');
      possibleViewElements.forEach(el => {
        elements.push(el.tagName + (el.className ? `.${el.className}` : '') + (el.id ? `#${el.id}` : ''));
      });
      
      // Try to determine current view
      const view = (window as any).__CURRENT_VIEW__ || 
                   document.body.getAttribute('data-view') ||
                   document.documentElement.getAttribute('data-view');
      
      return { view, elements };
    });
    
    return info;
  } catch (error) {
    console.warn('⚠️ Could not get current view info:', error);
    return { elements: [] };
  }
}

/**
 * Global setup function for test suites
 * This is the main function exported for Playwright's globalSetup
 */
async function globalSetup(config?: FullConfig): Promise<void> {
  console.log('🔧 Running global E2E setup...');
  
  // Ensure test directories exist
  const testDirs = [
    'test-results',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces'
  ];
  
  for (const dir of testDirs) {
    const fullPath = pathJoin(process.cwd(), dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }
  
  console.log('✅ Global setup complete');
}

// Export as default for Playwright globalSetup
export default globalSetup;