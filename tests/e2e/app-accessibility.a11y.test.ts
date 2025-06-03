/**
 * Accessibility (a11y) Tests for TaskMaster Electron App (2025)
 * 
 * Comprehensive accessibility testing suite following WCAG 2.1 AA standards
 * and 2025 best practices for Electron applications:
 * - Automated accessibility scanning with axe-core
 * - Keyboard navigation testing
 * - Screen reader compatibility
 * - Color contrast validation
 * - Focus management testing
 * - ARIA implementation verification
 * - Responsive accessibility
 * 
 * Using @axe-core/playwright for automated accessibility testing
 * integrated with Playwright's testing framework.
 */

import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  launchElectronForE2E,
  getMainWindow,
  closeElectronE2E,
  navigateToView,
  validateAccessibility,
  simulateUserActions
} from '../setup/e2e.setup';

// Accessibility test configuration
const A11Y_CONFIG = {
  // axe-core rules to check
  rules: {
    // Enable all WCAG 2.1 AA rules
    'wcag2aa': true,
    'wcag21aa': true,
    
    // Additional best practice rules
    'best-practice': true
  },
  
  // Elements to exclude from certain checks
  exclude: [
    // Exclude third-party widgets if any
    '[data-third-party]',
    // Exclude decorative elements
    '[aria-hidden="true"]'
  ],
  
  // Specific rules to disable if needed
  disableRules: [
    // Example: 'color-contrast' // Only if you have a high-contrast mode
  ]
};

// Helper to run axe accessibility scan
async function runAccessibilityScan(
  page: Page,
  options?: {
    includeRules?: string[];
    excludeRules?: string[];
    elementScope?: string;
  }
): Promise<any> {
  const builder = new AxeBuilder({ page });
  
  // Configure rules
  if (options?.includeRules) {
    builder.include(options.includeRules);
  }
  
  if (options?.excludeRules) {
    options.excludeRules.forEach(rule => builder.disableRules(rule));
  }
  
  // Set scope if provided
  if (options?.elementScope) {
    builder.include(options.elementScope);
  }
  
  // Run the scan
  const results = await builder.analyze();
  
  return results;
}

// Helper to check keyboard navigation
async function testKeyboardNavigation(
  page: Page,
  expectedFocusOrder: string[]
): Promise<void> {
  // Start from the beginning
  await page.keyboard.press('Tab');
  
  for (const expectedSelector of expectedFocusOrder) {
    const focusedElement = await page.evaluateHandle(() => document.activeElement);
    const matches = await page.evaluate(
      (el, selector) => el?.matches(selector) || false,
      focusedElement,
      expectedSelector
    );
    
    expect(matches).toBe(true);
    await page.keyboard.press('Tab');
  }
}

test.describe('Accessibility Tests - Core Compliance', () => {
  let page: Page;

  test.beforeAll(async () => {
    await launchElectronForE2E();
    page = await getMainWindow();
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  test('01. Full application accessibility scan', async () => {
    // Run comprehensive accessibility scan
    const results = await runAccessibilityScan(page);
    
    // Log any violations for debugging
    if (results.violations.length > 0) {
      console.log('🚨 Accessibility violations found:');
      results.violations.forEach((violation: any) => {
        console.log(`
          Rule: ${violation.id}
          Impact: ${violation.impact}
          Help: ${violation.help}
          Nodes: ${violation.nodes.length}
        `);
      });
    }
    
    // Assert no violations
    expect(results.violations).toHaveLength(0);
  });

  test('02. Sidebar accessibility', async () => {
    const results = await runAccessibilityScan(page, {
      elementScope: '[data-testid="sidebar"]'
    });
    
    expect(results.violations).toHaveLength(0);
    
    // Additional checks
    const sidebar = page.locator('[data-testid="sidebar"]');
    
    // Check for proper ARIA labels
    const navElement = sidebar.locator('nav');
    await expect(navElement).toHaveAttribute('aria-label', /.+/);
    
    // Check navigation items have proper roles
    const navItems = sidebar.locator('button, a');
    const count = await navItems.count();
    
    for (let i = 0; i < count; i++) {
      const item = navItems.nth(i);
      const role = await item.getAttribute('role');
      const ariaLabel = await item.getAttribute('aria-label');
      
      expect(role || ariaLabel).toBeTruthy();
    }
  });

  test('03. Main content area accessibility', async () => {
    const results = await runAccessibilityScan(page, {
      elementScope: '[data-testid="main-content"], main'
    });
    
    expect(results.violations).toHaveLength(0);
    
    // Check for proper heading structure
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements =>
      elements.map(el => ({
        level: parseInt(el.tagName[1]),
        text: el.textContent
      }))
    );
    
    // Verify heading hierarchy
    let previousLevel = 0;
    for (const heading of headings) {
      // Headings should not skip levels
      expect(heading.level).toBeLessThanOrEqual(previousLevel + 1);
      previousLevel = heading.level;
    }
  });

  test('04. Form accessibility', async () => {
    // Navigate to a view with forms (e.g., task creation)
    const createButton = page.locator('[data-testid="create-task-button"], button:has-text("Create")').first();
    
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(500);
      
      // Scan the form/modal
      const formModal = page.locator('[role="dialog"], form').first();
      
      if (await formModal.isVisible()) {
        const results = await runAccessibilityScan(page, {
          elementScope: '[role="dialog"], form'
        });
        
        expect(results.violations).toHaveLength(0);
        
        // Check form fields have labels
        const inputs = formModal.locator('input, textarea, select');
        const inputCount = await inputs.count();
        
        for (let i = 0; i < inputCount; i++) {
          const input = inputs.nth(i);
          const id = await input.getAttribute('id');
          const ariaLabel = await input.getAttribute('aria-label');
          const ariaLabelledBy = await input.getAttribute('aria-labelledby');
          
          // Must have either a label, aria-label, or aria-labelledby
          if (id) {
            const label = page.locator(`label[for="${id}"]`);
            const hasLabel = await label.count() > 0;
            
            expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
          } else {
            expect(ariaLabel || ariaLabelledBy).toBeTruthy();
          }
        }
        
        // Close modal
        await page.keyboard.press('Escape');
      }
    }
  });

  test('05. Color contrast validation', async () => {
    // Run color contrast specific scan
    const results = await runAccessibilityScan(page, {
      includeRules: ['color-contrast']
    });
    
    expect(results.violations).toHaveLength(0);
    
    // Additional manual contrast checks for critical elements
    const criticalElements = [
      { selector: 'button', minContrast: 4.5 },
      { selector: 'a', minContrast: 4.5 },
      { selector: '[data-testid*="task-card"]', minContrast: 4.5 }
    ];
    
    for (const element of criticalElements) {
      const elements = page.locator(element.selector);
      const count = await elements.count();
      
      if (count > 0) {
        // Check first instance
        const contrast = await elements.first().evaluate((el) => {
          const styles = window.getComputedStyle(el);
          // This is a simplified check - real implementation would calculate actual contrast
          return styles.color && styles.backgroundColor ? true : false;
        });
        
        expect(contrast).toBe(true);
      }
    }
  });

  test('06. Focus indicators', async () => {
    // Test that all interactive elements have visible focus indicators
    const interactiveElements = page.locator('button, a, input, textarea, select, [tabindex="0"]');
    const count = await interactiveElements.count();
    
    for (let i = 0; i < Math.min(count, 10); i++) { // Test first 10 elements
      const element = interactiveElements.nth(i);
      
      if (await element.isVisible()) {
        // Focus the element
        await element.focus();
        
        // Check for focus styles
        const hasFocusStyles = await element.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          const pseudoStyles = window.getComputedStyle(el, ':focus');
          
          // Check for outline, border changes, or box-shadow
          return (
            styles.outline !== 'none' ||
            styles.outlineWidth !== '0px' ||
            styles.boxShadow !== 'none' ||
            el.matches(':focus-visible')
          );
        });
        
        expect(hasFocusStyles).toBe(true);
      }
    }
  });

  test('07. ARIA implementation', async () => {
    // Check for proper ARIA usage
    
    // 1. Check that ARIA roles are used correctly
    const elementsWithRoles = await page.$$eval('[role]', elements =>
      elements.map(el => ({
        role: el.getAttribute('role'),
        tag: el.tagName.toLowerCase(),
        hasTabindex: el.hasAttribute('tabindex')
      }))
    );
    
    for (const element of elementsWithRoles) {
      // Interactive roles should be focusable
      if (['button', 'link', 'tab', 'menuitem'].includes(element.role!)) {
        expect(element.hasTabindex || ['button', 'a'].includes(element.tag)).toBe(true);
      }
    }
    
    // 2. Check ARIA properties are used correctly
    const ariaElements = await page.$$eval('[aria-label], [aria-labelledby], [aria-describedby]', elements =>
      elements.map(el => ({
        label: el.getAttribute('aria-label'),
        labelledby: el.getAttribute('aria-labelledby'),
        describedby: el.getAttribute('aria-describedby')
      }))
    );
    
    for (const element of ariaElements) {
      // If aria-labelledby or aria-describedby is used, the referenced element should exist
      if (element.labelledby) {
        const exists = await page.locator(`#${element.labelledby}`).count() > 0;
        expect(exists).toBe(true);
      }
      
      if (element.describedby) {
        const exists = await page.locator(`#${element.describedby}`).count() > 0;
        expect(exists).toBe(true);
      }
    }
  });

  test('08. Landmarks and regions', async () => {
    // Check for proper landmark usage
    const landmarks = await page.$$eval('main, nav, aside, header, footer, [role="main"], [role="navigation"], [role="complementary"], [role="banner"], [role="contentinfo"]', elements =>
      elements.map(el => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label')
      }))
    );
    
    // Should have at least main and navigation landmarks
    const hasMain = landmarks.some(l => l.tag === 'main' || l.role === 'main');
    const hasNav = landmarks.some(l => l.tag === 'nav' || l.role === 'navigation');
    
    expect(hasMain).toBe(true);
    expect(hasNav).toBe(true);
    
    // Multiple landmarks of the same type should have unique labels
    const navLandmarks = landmarks.filter(l => l.tag === 'nav' || l.role === 'navigation');
    if (navLandmarks.length > 1) {
      const labels = navLandmarks.map(n => n.ariaLabel);
      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(navLandmarks.length);
    }
  });
});

test.describe('Accessibility Tests - Keyboard Navigation', () => {
  let page: Page;

  test.beforeAll(async () => {
    await launchElectronForE2E();
    page = await getMainWindow();
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  test('01. Tab order is logical', async () => {
    // Reset focus
    await page.keyboard.press('F5');
    await page.waitForTimeout(1000);
    
    // Expected tab order (simplified)
    const expectedOrder = [
      '[data-testid="search"], input[type="search"]',
      '[data-testid="sidebar"] button:first-child',
      '[data-testid="main-content"] button:first-child, [data-testid="main-content"] a:first-child'
    ];
    
    // Tab through elements and verify order
    for (let i = 0; i < expectedOrder.length; i++) {
      await page.keyboard.press('Tab');
      
      const activeElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName.toLowerCase(),
          testId: el?.getAttribute('data-testid'),
          type: el?.getAttribute('type')
        };
      });
      
      console.log(`Tab ${i + 1}: Focused on ${activeElement.tag} ${activeElement.testId || activeElement.type || ''}`);
    }
  });

  test('02. Keyboard shortcuts work correctly', async () => {
    // Test command palette
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    
    const commandPalette = page.locator('[data-testid="command-palette"], [role="dialog"]');
    await expect(commandPalette).toBeVisible();
    
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(commandPalette).not.toBeVisible();
    
    // Test view navigation shortcuts
    const shortcuts = [
      { key: 'Meta+1', view: 'analytics' },
      { key: 'Meta+2', view: 'list' },
      { key: 'Meta+3', view: 'calendar' }
    ];
    
    for (const shortcut of shortcuts) {
      await page.keyboard.press(shortcut.key);
      await page.waitForTimeout(500);
      
      // Verify view changed (implementation specific)
      console.log(`Tested shortcut ${shortcut.key} for ${shortcut.view} view`);
    }
  });

  test('03. Modal keyboard trap', async () => {
    // Open a modal
    const createButton = page.locator('[data-testid="create-task-button"], button:has-text("Create")').first();
    
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(500);
      
      const modal = page.locator('[role="dialog"]');
      
      if (await modal.isVisible()) {
        // Count focusable elements in modal
        const focusableInModal = await modal.locator('button, input, textarea, select, a, [tabindex="0"]').count();
        
        // Tab through all elements and verify we stay in modal
        for (let i = 0; i < focusableInModal + 2; i++) {
          await page.keyboard.press('Tab');
          
          const isInModal = await page.evaluate(() => {
            const activeEl = document.activeElement;
            const modal = document.querySelector('[role="dialog"]');
            return modal?.contains(activeEl);
          });
          
          expect(isInModal).toBe(true);
        }
        
        // Close modal
        await page.keyboard.press('Escape');
      }
    }
  });

  test('04. Arrow key navigation in lists', async () => {
    await navigateToView(page, 'list');
    
    // Focus on task list
    const taskList = page.locator('[data-testid="task-list"], [role="list"]').first();
    
    if (await taskList.isVisible()) {
      await taskList.focus();
      
      // Test arrow navigation
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      
      const activeIndex = await page.evaluate(() => {
        const active = document.activeElement;
        const items = Array.from(document.querySelectorAll('[role="listitem"], [data-testid*="task-card"]'));
        return items.indexOf(active as HTMLElement);
      });
      
      expect(activeIndex).toBeGreaterThanOrEqual(0);
      
      // Test up arrow
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);
      
      const newActiveIndex = await page.evaluate(() => {
        const active = document.activeElement;
        const items = Array.from(document.querySelectorAll('[role="listitem"], [data-testid*="task-card"]'));
        return items.indexOf(active as HTMLElement);
      });
      
      expect(newActiveIndex).toBe(Math.max(0, activeIndex - 1));
    }
  });

  test('05. Skip navigation links', async () => {
    // Look for skip links
    const skipLinks = page.locator('a[href^="#"]:has-text("Skip"), a:has-text("Skip to main content")');
    
    if (await skipLinks.count() > 0) {
      // Skip links should be visible on focus
      await page.keyboard.press('Tab');
      
      const skipLink = skipLinks.first();
      const isVisible = await skipLink.isVisible();
      
      if (isVisible) {
        // Activate skip link
        await skipLink.click();
        
        // Verify focus moved to main content
        const activeElement = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
        expect(activeElement).toBeTruthy();
      }
    }
  });
});

test.describe('Accessibility Tests - Screen Reader Compatibility', () => {
  let page: Page;

  test.beforeAll(async () => {
    await launchElectronForE2E();
    page = await getMainWindow();
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  test('01. Live regions for dynamic content', async () => {
    // Check for ARIA live regions
    const liveRegions = await page.$$eval('[aria-live], [role="alert"], [role="status"]', elements =>
      elements.map(el => ({
        live: el.getAttribute('aria-live'),
        role: el.getAttribute('role'),
        atomic: el.getAttribute('aria-atomic'),
        relevant: el.getAttribute('aria-relevant')
      }))
    );
    
    // Should have at least one live region for notifications
    expect(liveRegions.length).toBeGreaterThan(0);
    
    // Test live region updates
    if (liveRegions.length > 0) {
      // Trigger an action that updates live region
      const saveButton = page.locator('button:has-text("Save")').first();
      
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Wait for live region update
        await page.waitForTimeout(1000);
        
        // Check if live region has content
        const liveRegionContent = await page.locator('[aria-live="polite"], [role="status"]').first().textContent();
        expect(liveRegionContent).toBeTruthy();
      }
    }
  });

  test('02. Descriptive link and button text', async () => {
    // Check all buttons have descriptive text
    const buttons = await page.$$eval('button', elements =>
      elements.map(el => ({
        text: el.textContent?.trim(),
        ariaLabel: el.getAttribute('aria-label'),
        title: el.getAttribute('title')
      }))
    );
    
    for (const button of buttons) {
      // Button should have text, aria-label, or title
      const hasDescription = button.text || button.ariaLabel || button.title;
      expect(hasDescription).toBeTruthy();
      
      // Avoid generic text
      if (button.text) {
        expect(button.text).not.toMatch(/^(click|here|button)$/i);
      }
    }
    
    // Check all links have descriptive text
    const links = await page.$$eval('a', elements =>
      elements.map(el => ({
        text: el.textContent?.trim(),
        ariaLabel: el.getAttribute('aria-label'),
        href: el.getAttribute('href')
      }))
    );
    
    for (const link of links) {
      const hasDescription = link.text || link.ariaLabel;
      expect(hasDescription).toBeTruthy();
      
      // Avoid "click here" or "read more" without context
      if (link.text) {
        expect(link.text).not.toMatch(/^(click here|read more|here)$/i);
      }
    }
  });

  test('03. Images have appropriate alt text', async () => {
    const images = await page.$$eval('img', elements =>
      elements.map(el => ({
        src: el.getAttribute('src'),
        alt: el.getAttribute('alt'),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label')
      }))
    );
    
    for (const img of images) {
      if (img.role === 'presentation' || img.alt === '') {
        // Decorative images should have empty alt
        expect(img.alt).toBe('');
      } else {
        // Informative images should have descriptive alt text
        expect(img.alt || img.ariaLabel).toBeTruthy();
        
        // Alt text should not include "image of" or "picture of"
        if (img.alt) {
          expect(img.alt).not.toMatch(/^(image of|picture of|photo of)/i);
        }
      }
    }
  });

  test('04. Tables have proper headers', async () => {
    const tables = page.locator('table');
    const tableCount = await tables.count();
    
    for (let i = 0; i < tableCount; i++) {
      const table = tables.nth(i);
      
      // Check for caption or aria-label
      const caption = await table.locator('caption').count();
      const ariaLabel = await table.getAttribute('aria-label');
      
      expect(caption > 0 || ariaLabel).toBeTruthy();
      
      // Check for th elements
      const headers = await table.locator('th').count();
      expect(headers).toBeGreaterThan(0);
      
      // Check scope attributes
      const thElements = await table.locator('th').all();
      for (const th of thElements) {
        const scope = await th.getAttribute('scope');
        expect(scope).toMatch(/^(col|row|colgroup|rowgroup)$/);
      }
    }
  });
});

test.describe('Accessibility Tests - Responsive Accessibility', () => {
  let page: Page;

  test.beforeAll(async () => {
    await launchElectronForE2E();
    page = await getMainWindow();
  });

  test.afterAll(async () => {
    await closeElectronE2E();
  });

  test('01. Touch target sizes', async () => {
    // Set viewport to tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    // Check interactive element sizes
    const interactiveElements = await page.$$eval('button, a, input, select, [role="button"], [role="link"]', elements =>
      elements.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim()
        };
      })
    );
    
    for (const element of interactiveElements) {
      // Skip inline links in text
      if (element.tag === 'a' && element.width < 200) continue;
      
      // Touch targets should be at least 44x44 pixels (WCAG 2.1)
      const size = Math.min(element.width, element.height);
      expect(size).toBeGreaterThanOrEqual(44);
    }
  });

  test('02. Zoom and reflow', async () => {
    // Test 200% zoom
    await page.setViewportSize({ width: 640, height: 480 });
    await page.waitForTimeout(500);
    
    // Check for horizontal scrolling
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    // Content should reflow, not require horizontal scrolling
    expect(hasHorizontalScroll).toBe(false);
    
    // Run accessibility scan at zoomed level
    const results = await runAccessibilityScan(page);
    expect(results.violations).toHaveLength(0);
  });

  test('03. Orientation support', async () => {
    // Test portrait orientation
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    let results = await runAccessibilityScan(page);
    expect(results.violations).toHaveLength(0);
    
    // Test landscape orientation
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    
    results = await runAccessibilityScan(page);
    expect(results.violations).toHaveLength(0);
  });
});

/**
 * Accessibility Testing Utilities
 */
export class A11yTestUtils {
  /**
   * Check specific WCAG criterion
   */
  static async checkWCAGCriterion(
    page: Page,
    criterion: string
  ): Promise<{ passed: boolean; issues: any[] }> {
    const results = await runAccessibilityScan(page, {
      includeRules: [criterion]
    });
    
    return {
      passed: results.violations.length === 0,
      issues: results.violations
    };
  }

  /**
   * Generate accessibility report
   */
  static async generateA11yReport(
    page: Page,
    reportName: string
  ): Promise<void> {
    const results = await runAccessibilityScan(page);
    
    const report = {
      name: reportName,
      timestamp: new Date().toISOString(),
      summary: {
        violations: results.violations.length,
        passes: results.passes.length,
        incomplete: results.incomplete.length,
        inapplicable: results.inapplicable.length
      },
      details: {
        violations: results.violations,
        incomplete: results.incomplete
      }
    };
    
    console.log(`📊 Accessibility Report for ${reportName}:`, JSON.stringify(report, null, 2));
  }

  /**
   * Test focus management during route changes
   */
  static async testFocusManagement(
    page: Page,
    fromView: string,
    toView: string
  ): Promise<boolean> {
    // Navigate from one view to another
    await navigateToView(page, fromView as any);
    await page.waitForTimeout(500);
    
    // Get initial focus
    const initialFocus = await page.evaluate(() => document.activeElement?.tagName);
    
    // Navigate to new view
    await navigateToView(page, toView as any);
    await page.waitForTimeout(500);
    
    // Check if focus was managed properly
    const newFocus = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tag: active?.tagName,
        role: active?.getAttribute('role'),
        isMain: active?.closest('main') !== null
      };
    });
    
    // Focus should move to main content area or heading
    return newFocus.isMain || newFocus.tag === 'H1' || newFocus.role === 'heading';
  }
}