/**
 * Visual Regression Tests for TaskMaster Electron App (2025)
 * 
 * Comprehensive visual testing suite following 2025 best practices:
 * - Cross-browser visual consistency validation
 * - Component-level screenshot testing
 * - Dark/light theme testing
 * - Responsive design validation
 * - Animation state testing
 * - Accessibility visual checks
 * 
 * Using Playwright's built-in screenshot capabilities with plans to
 * integrate Percy or Chromatic for cloud-based visual testing.
 */

import { test, expect, Page } from '@playwright/test';
import {
  launchElectronForE2E,
  getMainWindow,
  closeElectronE2E,
  navigateToView,
  simulateUserActions,
  waitForE2ECondition
} from '../setup/e2e.setup';

// Configuration for visual tests
const VISUAL_TEST_CONFIG = {
  animations: 'disabled' as const,
  fullPage: true,
  threshold: 0.2, // 20% difference threshold
  maxDiffPixels: 100,
  screenshotOptions: {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    scale: 'device' as const
  }
};

// Helper to prepare page for visual testing
async function prepareForVisualTest(page: Page): Promise<void> {
  // Disable animations for consistent screenshots
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `
  });

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);

  // Wait for any lazy-loaded images
  await page.waitForLoadState('networkidle');

  // Additional wait for any async rendering
  await page.waitForTimeout(1000);
}

// Helper to mask dynamic content
async function maskDynamicContent(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      /* Mask timestamps and dates */
      [data-testid*="timestamp"],
      [data-testid*="date"],
      .timestamp,
      .date-display {
        visibility: hidden !important;
      }
      
      /* Mask loading states */
      .skeleton,
      [data-loading="true"] {
        opacity: 0 !important;
      }
      
      /* Stabilize scrollbars */
      ::-webkit-scrollbar {
        width: 10px !important;
        height: 10px !important;
      }
    `
  });
}

test.describe('Visual Regression Tests - Core UI', () => {
  let page: Page;

  test.beforeAll(async () => {
    await launchElectronForE2E();
    page = await getMainWindow();
    await prepareForVisualTest(page);
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  test.beforeEach(async () => {
    // Reset to a known state before each test
    await page.reload();
    await prepareForVisualTest(page);
    await maskDynamicContent(page);
  });

  test('01. Initial app launch visual state', async () => {
    // Capture the initial state after app launch
    await expect(page).toHaveScreenshot('initial-launch.png', {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: true
    });

    // Verify key UI elements are visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="header"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
  });

  test('02. Empty state visual appearance', async () => {
    // Ensure we're in empty state
    await page.evaluate(() => {
      // Clear any tasks from local storage
      localStorage.clear();
    });
    await page.reload();
    await prepareForVisualTest(page);

    await expect(page).toHaveScreenshot('empty-state.png', {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: true
    });
  });

  test('03. Sidebar visual states', async () => {
    const sidebar = page.locator('[data-testid="sidebar"]');
    
    // Collapsed state
    const collapseButton = page.locator('[data-testid="sidebar-toggle"]');
    if (await collapseButton.isVisible()) {
      await collapseButton.click();
      await page.waitForTimeout(300); // Wait for animation
      await expect(sidebar).toHaveScreenshot('sidebar-collapsed.png');
      
      // Expanded state
      await collapseButton.click();
      await page.waitForTimeout(300);
    }
    
    await expect(sidebar).toHaveScreenshot('sidebar-expanded.png');
    
    // Hover states
    const firstNavItem = sidebar.locator('button').first();
    await firstNavItem.hover();
    await expect(sidebar).toHaveScreenshot('sidebar-hover-state.png');
  });

  test('04. Header visual consistency', async () => {
    const header = page.locator('[data-testid="header"]');
    
    // Default state
    await expect(header).toHaveScreenshot('header-default.png');
    
    // With search active (if available)
    const searchInput = header.locator('input[type="search"], [data-testid="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.click();
      await expect(header).toHaveScreenshot('header-search-active.png');
    }
    
    // With user menu open (if available)
    const userMenu = header.locator('[data-testid="user-menu"], [aria-label*="user"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot('header-user-menu-open.png', {
        ...VISUAL_TEST_CONFIG.screenshotOptions,
        clip: await header.boundingBox() || undefined
      });
    }
  });

  test('05. Task card visual variations', async () => {
    // Navigate to task list view
    await navigateToView(page, 'list');
    
    // Create sample tasks for visual testing
    await page.evaluate(() => {
      const sampleTasks = [
        {
          id: 'visual-1',
          title: 'High Priority Task',
          description: 'This is a high priority task for visual testing',
          priority: 'high',
          status: 'pending',
          tags: ['urgent', 'important']
        },
        {
          id: 'visual-2',
          title: 'Medium Priority Task',
          description: 'This is a medium priority task',
          priority: 'medium',
          status: 'in-progress',
          tags: ['feature']
        },
        {
          id: 'visual-3',
          title: 'Completed Task',
          description: 'This task has been completed',
          priority: 'low',
          status: 'done',
          tags: ['bug-fix']
        }
      ];
      
      // Inject tasks into the app state
      (window as any).__TEST_INJECT_TASKS__ = sampleTasks;
    });
    
    await page.waitForTimeout(500);
    
    // Capture different task card states
    const taskCards = page.locator('[data-testid*="task-card"]');
    
    if (await taskCards.count() > 0) {
      // First task card (high priority)
      await expect(taskCards.nth(0)).toHaveScreenshot('task-card-high-priority.png');
      
      // Hover state
      await taskCards.nth(0).hover();
      await expect(taskCards.nth(0)).toHaveScreenshot('task-card-hover.png');
      
      // Selected state
      await taskCards.nth(0).click();
      await expect(taskCards.nth(0)).toHaveScreenshot('task-card-selected.png');
    }
  });

  test('06. Command palette visual appearance', async () => {
    // Open command palette
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    
    const commandPalette = page.locator('[data-testid="command-palette"], [role="dialog"]');
    if (await commandPalette.isVisible()) {
      await expect(commandPalette).toHaveScreenshot('command-palette-open.png');
      
      // With search query
      await page.keyboard.type('create task');
      await page.waitForTimeout(300);
      await expect(commandPalette).toHaveScreenshot('command-palette-search.png');
      
      // Close palette
      await page.keyboard.press('Escape');
    }
  });

  test('07. Modal dialogs visual consistency', async () => {
    // Test various modal states if they exist
    const modalTriggers = [
      { selector: '[data-testid="create-task-button"]', name: 'create-task-modal' },
      { selector: '[data-testid="settings-button"]', name: 'settings-modal' },
      { selector: '[data-testid="help-button"]', name: 'help-modal' }
    ];
    
    for (const trigger of modalTriggers) {
      const button = page.locator(trigger.selector);
      if (await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(300);
        
        const modal = page.locator('[role="dialog"], [data-testid*="modal"]');
        if (await modal.isVisible()) {
          await expect(modal).toHaveScreenshot(`${trigger.name}.png`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
    }
  });

  test('08. Loading states visual appearance', async () => {
    // Simulate loading states
    await page.evaluate(() => {
      document.body.setAttribute('data-loading', 'true');
    });
    
    // Check for skeleton screens or loading indicators
    const loadingIndicators = page.locator('.skeleton, [data-testid*="loading"], .spinner');
    if (await loadingIndicators.count() > 0) {
      await expect(page).toHaveScreenshot('loading-state.png', {
        ...VISUAL_TEST_CONFIG.screenshotOptions,
        fullPage: true
      });
    }
  });

  test('09. Error states visual appearance', async () => {
    // Simulate error states
    await page.evaluate(() => {
      // Inject error state
      (window as any).__TEST_INJECT_ERROR__ = {
        message: 'Failed to load tasks',
        code: 'LOAD_ERROR'
      };
    });
    
    await page.waitForTimeout(500);
    
    const errorElements = page.locator('[data-testid*="error"], .error-message, [role="alert"]');
    if (await errorElements.count() > 0) {
      await expect(page).toHaveScreenshot('error-state.png', {
        ...VISUAL_TEST_CONFIG.screenshotOptions,
        fullPage: true
      });
    }
  });

  test('10. Responsive breakpoints visual testing', async () => {
    const breakpoints = [
      { width: 1920, height: 1080, name: 'desktop-full-hd' },
      { width: 1366, height: 768, name: 'desktop-standard' },
      { width: 1024, height: 768, name: 'tablet-landscape' },
      { width: 768, height: 1024, name: 'tablet-portrait' }
    ];
    
    for (const breakpoint of breakpoints) {
      await page.setViewportSize(breakpoint);
      await page.waitForTimeout(500);
      await prepareForVisualTest(page);
      
      await expect(page).toHaveScreenshot(`responsive-${breakpoint.name}.png`, {
        ...VISUAL_TEST_CONFIG.screenshotOptions,
        fullPage: true
      });
    }
  });
});

test.describe('Visual Regression Tests - Views', () => {
  let page: Page;

  test.beforeAll(async () => {
    await launchElectronForE2E();
    page = await getMainWindow();
    await prepareForVisualTest(page);
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  test.beforeEach(async () => {
    await maskDynamicContent(page);
  });

  test('01. Analytics view visual appearance', async () => {
    await navigateToView(page, 'analytics');
    await page.waitForTimeout(1000); // Wait for charts to render
    
    await expect(page).toHaveScreenshot('view-analytics.png', {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: true
    });
  });

  test('02. List view visual appearance', async () => {
    await navigateToView(page, 'list');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('view-list.png', {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: true
    });
  });

  test('03. Kanban view visual appearance', async () => {
    await navigateToView(page, 'kanban');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('view-kanban.png', {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: true
    });
  });

  test('04. Calendar view visual appearance', async () => {
    await navigateToView(page, 'calendar');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('view-calendar.png', {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: true
    });
  });

  test('05. Timeline view visual appearance', async () => {
    await navigateToView(page, 'timeline');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('view-timeline.png', {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: true
    });
  });

  test('06. Claude Config view visual appearance', async () => {
    await navigateToView(page, 'claude-config');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('view-claude-config.png', {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: true
    });
  });
});

test.describe('Visual Regression Tests - Theme Variations', () => {
  let page: Page;

  test.beforeAll(async () => {
    await launchElectronForE2E();
    page = await getMainWindow();
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  test('01. Light theme visual consistency', async () => {
    // Ensure light theme is active
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    });
    
    await prepareForVisualTest(page);
    await maskDynamicContent(page);
    
    await expect(page).toHaveScreenshot('theme-light.png', {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: true
    });
  });

  test('02. Dark theme visual consistency', async () => {
    // Switch to dark theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    
    await prepareForVisualTest(page);
    await maskDynamicContent(page);
    
    await expect(page).toHaveScreenshot('theme-dark.png', {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: true
    });
  });

  test('03. High contrast mode visual accessibility', async () => {
    // Simulate high contrast mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-contrast', 'high');
      document.body.style.filter = 'contrast(1.5)';
    });
    
    await prepareForVisualTest(page);
    await maskDynamicContent(page);
    
    await expect(page).toHaveScreenshot('theme-high-contrast.png', {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: true
    });
  });
});

/**
 * Visual Regression Test Utilities
 */
export class VisualTestUtils {
  /**
   * Compare screenshots with custom threshold
   */
  static async compareScreenshots(
    page: Page,
    name: string,
    options?: {
      threshold?: number;
      maxDiffPixels?: number;
      clip?: { x: number; y: number; width: number; height: number };
    }
  ): Promise<void> {
    await expect(page).toHaveScreenshot(name, {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      threshold: options?.threshold ?? VISUAL_TEST_CONFIG.threshold,
      maxDiffPixels: options?.maxDiffPixels ?? VISUAL_TEST_CONFIG.maxDiffPixels,
      clip: options?.clip
    });
  }

  /**
   * Capture element screenshot with masking
   */
  static async captureElement(
    page: Page,
    selector: string,
    name: string,
    maskSelectors?: string[]
  ): Promise<void> {
    const element = page.locator(selector);
    
    if (maskSelectors && maskSelectors.length > 0) {
      const masks = maskSelectors.map(s => page.locator(s));
      await expect(element).toHaveScreenshot(name, {
        ...VISUAL_TEST_CONFIG.screenshotOptions,
        mask: masks
      });
    } else {
      await expect(element).toHaveScreenshot(name, {
        ...VISUAL_TEST_CONFIG.screenshotOptions
      });
    }
  }

  /**
   * Capture viewport screenshot at specific scroll position
   */
  static async captureAtScroll(
    page: Page,
    scrollY: number,
    name: string
  ): Promise<void> {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(500); // Wait for scroll to settle
    
    await expect(page).toHaveScreenshot(name, {
      ...VISUAL_TEST_CONFIG.screenshotOptions,
      fullPage: false
    });
  }
}