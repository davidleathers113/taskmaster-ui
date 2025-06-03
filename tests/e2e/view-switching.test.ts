/**
 * TaskMaster View Switching and Navigation E2E Tests (2025)
 * 
 * Comprehensive test suite for view switching, navigation patterns, and UI state management.
 * Following 2025 best practices for Playwright + Electron testing:
 * 
 * - Multi-view application testing patterns
 * - State persistence across view transitions
 * - Animation and transition validation
 * - Keyboard navigation and accessibility
 * - Performance monitoring for view switches
 * - Cross-platform navigation consistency
 * 
 * Test Coverage:
 * - View switching via sidebar navigation
 * - Keyboard shortcut navigation (⌘1-6)
 * - State preservation during view changes
 * - Animation and transition behavior
 * - URL/route management (if applicable)
 * - View-specific UI elements and behaviors
 * - Error handling for invalid view states
 * - Performance metrics for view transitions
 * - Accessibility compliance for navigation
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { 
  launchElectronForE2E, 
  getMainWindow, 
  closeElectronE2E,
  takeE2EScreenshot,
  navigateToView,
  verifyActiveView,
  getCurrentViewInfo,
  measureE2EPerformance,
  waitForE2ECondition,
  validateAccessibility
} from '../setup/e2e.setup';

/**
 * Page Object Model for View Navigation
 * Encapsulates view switching and navigation interactions
 */
class ViewNavigationPage {
  constructor(private page: Page) {}

  // Navigation elements
  get sidebar() { return this.page.locator('[data-testid="sidebar"], aside, .sidebar'); }
  get mainContent() { return this.page.locator('[data-testid="main-content"], main, .main-content'); }
  get header() { return this.page.locator('[data-testid="header"], header, .header'); }
  
  // View navigation buttons
  get overviewButton() { return this.page.locator('button:has-text("Overview"), [data-testid="analytics-nav"]'); }
  get tasksButton() { return this.page.locator('button:has-text("All Tasks"), [data-testid="tasks-nav"]'); }
  get calendarButton() { return this.page.locator('button:has-text("Calendar"), [data-testid="calendar-nav"]'); }
  get kanbanButton() { return this.page.locator('button:has-text("Kanban"), [data-testid="kanban-nav"]'); }
  get timelineButton() { return this.page.locator('button:has-text("Timeline"), [data-testid="timeline-nav"]'); }
  get claudeConfigButton() { return this.page.locator('button:has-text("Claude Config"), [data-testid="claude-config-nav"]'); }

  // View content indicators
  get analyticsView() { return this.page.locator('[data-testid="analytics-view"], .analytics-view'); }
  get taskListView() { return this.page.locator('[data-testid="task-list-view"], .task-list-view'); }
  get kanbanView() { return this.page.locator('[data-testid="kanban-view"], .kanban-view'); }
  get calendarView() { return this.page.locator('[data-testid="calendar-view"], .calendar-view'); }
  get timelineView() { return this.page.locator('[data-testid="timeline-view"], .timeline-view'); }
  get claudeConfigView() { return this.page.locator('[data-testid="claude-config-view"], .claude-config-view'); }

  // State management elements
  get sidebarToggle() { return this.page.locator('[data-testid="sidebar-toggle"], .sidebar-toggle'); }
  get searchInput() { return this.page.locator('[data-testid="search"], input[placeholder*="search"]'); }
  get filterControls() { return this.page.locator('[data-testid="filters"], .filters'); }

  /**
   * Navigate to a specific view using sidebar buttons
   */
  async navigateToViewBySidebar(viewType: 'analytics' | 'list' | 'calendar' | 'kanban' | 'timeline' | 'claude-config'): Promise<void> {
    console.log(`🧭 Navigating to ${viewType} view via sidebar...`);
    
    const buttonMap = {
      analytics: this.overviewButton,
      list: this.tasksButton,
      calendar: this.calendarButton,
      kanban: this.kanbanButton,
      timeline: this.timelineButton,
      'claude-config': this.claudeConfigButton
    };

    const button = buttonMap[viewType];
    if (button) {
      await button.click();
      await this.waitForViewTransition();
      console.log(`✅ Navigated to ${viewType} view`);
    } else {
      throw new Error(`Unknown view type: ${viewType}`);
    }
  }

  /**
   * Navigate using keyboard shortcuts
   */
  async navigateToViewByKeyboard(viewType: 'analytics' | 'list' | 'calendar' | 'kanban' | 'timeline' | 'claude-config'): Promise<void> {
    console.log(`⌨️ Navigating to ${viewType} view via keyboard shortcut...`);
    
    const shortcutMap = {
      analytics: 'Meta+1',
      list: 'Meta+2',
      calendar: 'Meta+3',
      kanban: 'Meta+4',
      timeline: 'Meta+5',
      'claude-config': 'Meta+6'
    };

    const shortcut = shortcutMap[viewType];
    if (shortcut) {
      await this.page.keyboard.press(shortcut);
      await this.waitForViewTransition();
      console.log(`✅ Navigated to ${viewType} view via ${shortcut}`);
    } else {
      throw new Error(`No keyboard shortcut for view type: ${viewType}`);
    }
  }

  /**
   * Wait for view transition animations to complete
   */
  async waitForViewTransition(): Promise<void> {
    // Wait for animations to complete (Framer Motion transitions)
    await this.page.waitForTimeout(800);
    
    // Wait for network idle state (for data loading)
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify active view indicators
   */
  async verifyActiveViewIndicators(expectedView: string): Promise<boolean> {
    // Check for active state on navigation button
    const activeButton = this.page.locator(`nav button[aria-current="page"], nav button.active, nav button[data-active="true"]`);
    const hasActiveButton = await activeButton.count() > 0;

    // Check for view-specific content
    const viewContentMap = {
      analytics: this.analyticsView,
      list: this.taskListView,
      kanban: this.kanbanView,
      calendar: this.calendarView,
      timeline: this.timelineView,
      'claude-config': this.claudeConfigView
    };

    const expectedContent = viewContentMap[expectedView as keyof typeof viewContentMap];
    const hasViewContent = expectedContent ? await expectedContent.isVisible() : false;

    console.log(`📊 View verification for ${expectedView}: Button active: ${hasActiveButton}, Content visible: ${hasViewContent}`);
    return hasActiveButton || hasViewContent;
  }

  /**
   * Get the currently active view
   */
  async getCurrentView(): Promise<string | null> {
    // Try multiple methods to determine current view
    const currentView = await this.page.evaluate(() => {
      // Check data attributes
      const body = document.body;
      const dataView = body.getAttribute('data-view') || 
                      body.getAttribute('data-current-view') ||
                      document.documentElement.getAttribute('data-view');
      
      if (dataView) return dataView;

      // Check for active navigation buttons
      const activeNav = document.querySelector('nav button[aria-current="page"], nav button.active');
      if (activeNav) {
        const text = activeNav.textContent?.toLowerCase();
        if (text?.includes('overview')) return 'analytics';
        if (text?.includes('tasks')) return 'list';
        if (text?.includes('calendar')) return 'calendar';
        if (text?.includes('kanban')) return 'kanban';
        if (text?.includes('timeline')) return 'timeline';
        if (text?.includes('config')) return 'claude-config';
      }

      // Check for visible view content
      if (document.querySelector('.analytics-view, [data-testid="analytics-view"]')) return 'analytics';
      if (document.querySelector('.task-list-view, [data-testid="task-list-view"]')) return 'list';
      if (document.querySelector('.kanban-view, [data-testid="kanban-view"]')) return 'kanban';
      if (document.querySelector('.calendar-view, [data-testid="calendar-view"]')) return 'calendar';
      if (document.querySelector('.timeline-view, [data-testid="timeline-view"]')) return 'timeline';
      if (document.querySelector('.claude-config-view, [data-testid="claude-config-view"]')) return 'claude-config';

      return null;
    });

    return currentView;
  }

  /**
   * Toggle sidebar collapse state
   */
  async toggleSidebar(): Promise<void> {
    console.log('🔄 Toggling sidebar...');
    
    // Look for sidebar toggle button
    const toggleSelectors = [
      '[data-testid="sidebar-toggle"]',
      '.sidebar-toggle',
      'button[aria-label*="sidebar"]',
      'button[aria-label*="menu"]'
    ];

    for (const selector of toggleSelectors) {
      const toggle = this.page.locator(selector).first();
      if (await toggle.isVisible().catch(() => false)) {
        await toggle.click();
        await this.page.waitForTimeout(300); // Allow animation
        console.log('✅ Sidebar toggled');
        return;
      }
    }

    console.warn('⚠️ Sidebar toggle button not found');
  }

  /**
   * Verify sidebar collapse state
   */
  async isSidebarCollapsed(): Promise<boolean> {
    const sidebar = this.sidebar;
    if (await sidebar.isVisible()) {
      // Check for collapsed indicators
      const isCollapsed = await this.page.evaluate(() => {
        const sidebar = document.querySelector('[data-testid="sidebar"], aside, .sidebar');
        if (!sidebar) return false;
        
        return sidebar.classList.contains('collapsed') ||
               sidebar.getAttribute('data-collapsed') === 'true' ||
               sidebar.getAttribute('aria-expanded') === 'false';
      });
      
      return isCollapsed;
    }
    return true; // If sidebar is not visible, consider it collapsed
  }

  /**
   * Check if animations are enabled
   */
  async areAnimationsEnabled(): Promise<boolean> {
    return await this.page.evaluate(() => {
      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      // Check for animation settings in app
      const appSettings = (window as any).__APP_SETTINGS__;
      if (appSettings && appSettings.animations !== undefined) {
        return appSettings.animations && !prefersReducedMotion;
      }
      
      // Default to checking CSS animations
      const testElement = document.createElement('div');
      testElement.style.animation = 'test 1s';
      return testElement.style.animation !== '' && !prefersReducedMotion;
    });
  }

  /**
   * Measure view transition performance
   */
  async measureViewTransitionPerformance(fromView: string, toView: string): Promise<{
    transitionTime: number;
    renderTime: number;
    layoutTime: number;
  }> {
    const startTime = performance.now();
    
    // Navigate to the target view
    await this.navigateToViewBySidebar(toView as any);
    
    const endTime = performance.now();
    const transitionTime = endTime - startTime;
    
    // Measure rendering metrics
    const metrics = await this.page.evaluate(() => {
      const renderTime = performance.now();
      
      // Force a layout calculation
      document.body.offsetHeight;
      const layoutTime = performance.now();
      
      return {
        renderTime: renderTime - performance.timing.navigationStart,
        layoutTime: layoutTime - renderTime
      };
    });
    
    return {
      transitionTime,
      renderTime: metrics.renderTime,
      layoutTime: metrics.layoutTime
    };
  }
}

/**
 * Test Suite: View Switching and Navigation
 */
test.describe('View Switching and Navigation', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let navPage: ViewNavigationPage;

  test.beforeEach(async () => {
    console.log('🚀 Starting TaskMaster for view navigation testing...');
    
    electronApp = await launchElectronForE2E({
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        PLAYWRIGHT_TEST: '1'
      }
    });

    page = await getMainWindow();
    navPage = new ViewNavigationPage(page);
    
    // Wait for app to be fully loaded
    await navPage.waitForViewTransition();
    
    console.log('✅ View navigation testing environment ready');
  });

  test.afterEach(async () => {
    await takeE2EScreenshot('view-navigation-cleanup');
    await closeElectronE2E();
  });

  /**
   * Test: Basic View Switching via Sidebar
   */
  test('should switch between all views using sidebar navigation', async () => {
    const views: Array<'analytics' | 'list' | 'calendar' | 'kanban' | 'timeline' | 'claude-config'> = [
      'analytics', 'list', 'calendar', 'kanban', 'timeline', 'claude-config'
    ];

    for (const view of views) {
      console.log(`🔄 Testing navigation to ${view} view...`);
      
      // Navigate to the view
      await navPage.navigateToViewBySidebar(view);
      
      // Verify the view is active
      const isActive = await navPage.verifyActiveViewIndicators(view);
      expect(isActive).toBeTruthy();
      
      // Verify current view matches expectation
      const currentView = await navPage.getCurrentView();
      expect(currentView).toBe(view);
      
      // Take screenshot for visual verification
      await takeE2EScreenshot(`view-${view}-active`);
      
      console.log(`✅ Successfully verified ${view} view`);
    }
  });

  /**
   * Test: Keyboard Shortcut Navigation
   */
  test('should navigate using keyboard shortcuts (⌘1-6)', async () => {
    const shortcuts: Array<{
      view: 'analytics' | 'list' | 'calendar' | 'kanban' | 'timeline' | 'claude-config';
      key: string;
    }> = [
      { view: 'analytics', key: '⌘1' },
      { view: 'list', key: '⌘2' },
      { view: 'calendar', key: '⌘3' },
      { view: 'kanban', key: '⌘4' },
      { view: 'timeline', key: '⌘5' },
      { view: 'claude-config', key: '⌘6' }
    ];

    for (const { view, key } of shortcuts) {
      console.log(`⌨️ Testing ${key} shortcut for ${view} view...`);
      
      // Use keyboard shortcut
      await navPage.navigateToViewByKeyboard(view);
      
      // Verify the view is active
      const isActive = await navPage.verifyActiveViewIndicators(view);
      expect(isActive).toBeTruthy();
      
      // Verify current view
      const currentView = await navPage.getCurrentView();
      expect(currentView).toBe(view);
      
      console.log(`✅ Keyboard shortcut ${key} works for ${view} view`);
    }

    await takeE2EScreenshot('keyboard-navigation-complete');
  });

  /**
   * Test: View Transition Animations
   */
  test('should show smooth transitions between views', async () => {
    // Check if animations are enabled
    const animationsEnabled = await navPage.areAnimationsEnabled();
    console.log(`🎬 Animations enabled: ${animationsEnabled}`);

    // Test transitions between different view types
    const transitionTests = [
      { from: 'list', to: 'kanban' },
      { from: 'kanban', to: 'calendar' },
      { from: 'calendar', to: 'analytics' },
      { from: 'analytics', to: 'timeline' }
    ];

    for (const { from, to } of transitionTests) {
      console.log(`🔄 Testing transition from ${from} to ${to}...`);
      
      // Navigate to starting view
      await navPage.navigateToViewBySidebar(from as any);
      await takeE2EScreenshot(`transition-${from}-start`);
      
      // Measure transition performance
      const metrics = await navPage.measureViewTransitionPerformance(from, to);
      
      // Verify transition completed successfully
      const currentView = await navPage.getCurrentView();
      expect(currentView).toBe(to);
      
      // Verify transition was reasonably fast (under 2 seconds)
      expect(metrics.transitionTime).toBeLessThan(2000);
      
      await takeE2EScreenshot(`transition-${to}-end`);
      
      console.log(`✅ Transition ${from} → ${to}: ${metrics.transitionTime.toFixed(2)}ms`);
    }
  });

  /**
   * Test: State Preservation During Navigation
   */
  test('should preserve application state during view switches', async () => {
    // Start in list view and set up some state
    await navPage.navigateToViewBySidebar('list');
    
    // Add some search state
    const searchInput = navPage.searchInput;
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test search');
      await page.waitForTimeout(500);
    }

    // Switch to different views and back
    await navPage.navigateToViewBySidebar('analytics');
    await navPage.navigateToViewBySidebar('kanban');
    await navPage.navigateToViewBySidebar('list');

    // Verify search state is preserved
    if (await searchInput.isVisible().catch(() => false)) {
      const searchValue = await searchInput.inputValue();
      expect(searchValue).toBe('test search');
      console.log('✅ Search state preserved during navigation');
    }

    await takeE2EScreenshot('state-preservation-test');
  });

  /**
   * Test: Sidebar Collapse/Expand Functionality
   */
  test('should handle sidebar collapse and expand correctly', async () => {
    // Check initial sidebar state
    const initiallyCollapsed = await navPage.isSidebarCollapsed();
    console.log(`📱 Initial sidebar state: ${initiallyCollapsed ? 'collapsed' : 'expanded'}`);

    // Toggle sidebar
    await navPage.toggleSidebar();
    
    // Verify state changed
    const afterToggle = await navPage.isSidebarCollapsed();
    expect(afterToggle).toBe(!initiallyCollapsed);
    
    await takeE2EScreenshot('sidebar-toggled');

    // Test navigation with collapsed sidebar
    if (afterToggle) {
      // Try keyboard navigation with collapsed sidebar
      await navPage.navigateToViewByKeyboard('kanban');
      const currentView = await navPage.getCurrentView();
      expect(currentView).toBe('kanban');
      console.log('✅ Navigation works with collapsed sidebar');
    }

    // Expand sidebar again
    await navPage.toggleSidebar();
    const finalState = await navPage.isSidebarCollapsed();
    expect(finalState).toBe(initiallyCollapsed);

    await takeE2EScreenshot('sidebar-restored');
  });

  /**
   * Test: Navigation Performance Benchmarks
   */
  test('should meet performance benchmarks for view switching', async () => {
    const performanceResults: Array<{
      transition: string;
      time: number;
    }> = [];

    // Test all view transitions for performance
    const views: Array<'analytics' | 'list' | 'calendar' | 'kanban' | 'timeline'> = [
      'analytics', 'list', 'calendar', 'kanban', 'timeline'
    ];

    for (let i = 0; i < views.length; i++) {
      const currentView = views[i];
      const nextView = views[(i + 1) % views.length];
      
      const startTime = performance.now();
      await navPage.navigateToViewBySidebar(nextView);
      const endTime = performance.now();
      
      const transitionTime = endTime - startTime;
      performanceResults.push({
        transition: `${currentView} → ${nextView}`,
        time: transitionTime
      });

      // Each transition should be under 1 second
      expect(transitionTime).toBeLessThan(1000);
    }

    // Calculate average transition time
    const averageTime = performanceResults.reduce((sum, result) => sum + result.time, 0) / performanceResults.length;
    
    console.log('📊 Performance Results:');
    performanceResults.forEach(result => {
      console.log(`  ${result.transition}: ${result.time.toFixed(2)}ms`);
    });
    console.log(`  Average: ${averageTime.toFixed(2)}ms`);

    // Average should be under 500ms
    expect(averageTime).toBeLessThan(500);

    await takeE2EScreenshot('performance-test-complete');
  });

  /**
   * Test: Accessibility Compliance for Navigation
   */
  test('should meet accessibility standards for navigation', async () => {
    // Test keyboard navigation accessibility
    await page.keyboard.press('Tab'); // Should focus first navigation element
    
    // Verify focus indicators
    const focusedElement = await page.locator(':focus').first();
    const isFocusVisible = await focusedElement.isVisible();
    expect(isFocusVisible).toBeTruthy();

    // Test ARIA attributes
    const navButtons = await page.locator('nav button, [role="navigation"] button').all();
    
    for (const button of navButtons) {
      const hasAccessibleName = await button.evaluate(el => {
        return !!(el.getAttribute('aria-label') || 
                 el.getAttribute('aria-labelledby') || 
                 el.textContent?.trim());
      });
      expect(hasAccessibleName).toBeTruthy();
    }

    // Run general accessibility validation
    await validateAccessibility(page);

    // Test screen reader navigation
    const navElement = page.locator('nav, [role="navigation"]').first();
    const hasNavRole = await navElement.evaluate(el => 
      el.getAttribute('role') === 'navigation' || el.tagName.toLowerCase() === 'nav'
    );
    expect(hasNavRole).toBeTruthy();

    await takeE2EScreenshot('accessibility-test');
    console.log('✅ Navigation accessibility tests passed');
  });

  /**
   * Test: Error Handling for Invalid View States
   */
  test('should handle invalid view states gracefully', async () => {
    // Try to set an invalid view state via JavaScript
    await page.evaluate(() => {
      // Simulate corrupted state
      const store = (window as any).__APP_STORE__;
      if (store && store.setViewMode) {
        store.setViewMode({ type: 'invalid-view' });
      }
    });

    await page.waitForTimeout(1000);

    // Should fallback to a default view
    const currentView = await navPage.getCurrentView();
    expect(currentView).toBeTruthy();
    expect(['analytics', 'list', 'calendar', 'kanban', 'timeline', 'claude-config']).toContain(currentView);

    console.log(`✅ Gracefully handled invalid state, fell back to: ${currentView}`);
    await takeE2EScreenshot('error-handling-test');
  });

  /**
   * Test: Deep Linking and URL State Management
   */
  test('should handle view state through URL or app state', async () => {
    // Test if the app maintains view state through some mechanism
    const initialView = await navPage.getCurrentView();
    
    // Navigate through several views
    await navPage.navigateToViewBySidebar('kanban');
    await navPage.navigateToViewBySidebar('calendar');
    await navPage.navigateToViewBySidebar('analytics');

    // Check if there's any persistence mechanism
    const currentState = await page.evaluate(() => {
      return {
        localStorage: localStorage.getItem('taskmaster-view-state'),
        sessionStorage: sessionStorage.getItem('taskmaster-view-state'),
        url: window.location.href,
        history: window.history.length
      };
    });

    console.log('🔍 State persistence check:', currentState);

    // Verify current view is correct
    const finalView = await navPage.getCurrentView();
    expect(finalView).toBe('analytics');

    await takeE2EScreenshot('state-management-test');
  });

  /**
   * Test: Cross-Platform Navigation Consistency
   */
  test('should work consistently across platforms', async () => {
    const platform = process.platform;
    console.log(`🖥️ Testing on platform: ${platform}`);

    // Test platform-specific keyboard shortcuts
    const modifierKey = platform === 'darwin' ? 'Meta' : 'Control';
    
    // Test with platform-appropriate modifier
    await page.keyboard.press(`${modifierKey}+2`);
    await navPage.waitForViewTransition();
    
    const currentView = await navPage.getCurrentView();
    expect(currentView).toBe('list');

    // Test mouse navigation works regardless of platform
    await navPage.navigateToViewBySidebar('kanban');
    const afterMouseNav = await navPage.getCurrentView();
    expect(afterMouseNav).toBe('kanban');

    console.log(`✅ Navigation works correctly on ${platform}`);
    await takeE2EScreenshot(`platform-${platform}-navigation`);
  });

  /**
   * Test: Memory Usage During Navigation
   */
  test('should not leak memory during frequent navigation', async () => {
    const initialMetrics = await measureE2EPerformance();
    
    // Perform many view switches to test for memory leaks
    const views: Array<'analytics' | 'list' | 'calendar' | 'kanban' | 'timeline'> = [
      'analytics', 'list', 'calendar', 'kanban', 'timeline'
    ];

    for (let cycle = 0; cycle < 5; cycle++) {
      for (const view of views) {
        await navPage.navigateToViewBySidebar(view);
        await page.waitForTimeout(100); // Brief pause
      }
    }

    const finalMetrics = await measureE2EPerformance();
    
    // Memory should not have increased dramatically
    if (initialMetrics.memoryUsage && finalMetrics.memoryUsage) {
      const memoryIncrease = finalMetrics.memoryUsage.heapUsed - initialMetrics.memoryUsage.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
      
      console.log(`📊 Memory increase after navigation cycles: ${memoryIncreaseMB.toFixed(2)}MB`);
      
      // Should not increase by more than 50MB
      expect(memoryIncreaseMB).toBeLessThan(50);
    }

    await takeE2EScreenshot('memory-test-complete');
    console.log('✅ Memory usage test passed');
  });
});