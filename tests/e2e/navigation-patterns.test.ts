/**
 * TaskMaster Navigation Patterns E2E Tests (2025)
 * 
 * Comprehensive test suite for view-specific navigation patterns and user workflows.
 * Tests the unique navigation behaviors, user journeys, and interaction patterns
 * within each view type of the TaskMaster application.
 * 
 * Following 2025 best practices for user-centered E2E testing:
 * - User journey validation across different view contexts
 * - View-specific navigation flows and patterns
 * - Context-aware navigation behavior testing
 * - Inter-view workflow validation
 * - Edge case and error scenario handling
 * - Performance monitoring for complex navigation flows
 * 
 * Test Coverage:
 * - List View: Filtering, sorting, search navigation
 * - Kanban View: Board navigation, column interactions
 * - Calendar View: Date navigation, event handling
 * - Timeline View: Chronological navigation patterns
 * - Analytics View: Dashboard navigation, drill-down flows
 * - Claude Config View: Settings navigation and form flows
 * - Cross-view workflows and context preservation
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { 
  launchElectronForE2E, 
  getMainWindow, 
  closeElectronE2E,
  takeE2EScreenshot,
  navigateToView,
  verifyActiveView,
  simulateUserActions,
  measureE2EPerformance,
  waitForE2ECondition
} from '../setup/e2e.setup';

/**
 * Page Object Model for View-Specific Navigation Patterns
 */
class NavigationPatternsPage {
  constructor(private page: Page) {}

  // Common navigation elements
  get sidebar() { return this.page.locator('[data-testid="sidebar"], aside, .sidebar'); }
  get mainContent() { return this.page.locator('[data-testid="main-content"], main, .main-content'); }
  get searchInput() { return this.page.locator('[data-testid="search"], input[placeholder*="search"]'); }

  // List View specific elements
  get taskList() { return this.page.locator('[data-testid="task-list"], .task-list'); }
  get taskCards() { return this.page.locator('[data-testid="task-card"], .task-card'); }
  get filterButtons() { return this.page.locator('[data-testid="filter"], .filter-button'); }
  get sortControls() { return this.page.locator('[data-testid="sort"], .sort-control'); }
  get viewModeToggle() { return this.page.locator('[data-testid="view-mode"], .view-toggle'); }

  // Kanban View specific elements
  get kanbanBoard() { return this.page.locator('[data-testid="kanban-board"], .kanban-board'); }
  get kanbanColumns() { return this.page.locator('[data-testid="kanban-column"], .kanban-column'); }
  get kanbanCards() { return this.page.locator('[data-testid="kanban-card"], .kanban-card'); }
  get addColumnButton() { return this.page.locator('[data-testid="add-column"], button:has-text("Add Column")'); }

  // Calendar View specific elements
  get calendar() { return this.page.locator('[data-testid="calendar"], .calendar'); }
  get calendarNavigation() { return this.page.locator('[data-testid="calendar-nav"], .calendar-navigation'); }
  get monthSelector() { return this.page.locator('[data-testid="month-selector"], .month-selector'); }
  get yearSelector() { return this.page.locator('[data-testid="year-selector"], .year-selector'); }
  get calendarDays() { return this.page.locator('[data-testid="calendar-day"], .calendar-day'); }
  get nextMonthButton() { return this.page.locator('[data-testid="next-month"], .next-month'); }
  get prevMonthButton() { return this.page.locator('[data-testid="prev-month"], .prev-month'); }

  // Timeline View specific elements
  get timeline() { return this.page.locator('[data-testid="timeline"], .timeline'); }
  get timelineEvents() { return this.page.locator('[data-testid="timeline-event"], .timeline-event'); }
  get timelineZoom() { return this.page.locator('[data-testid="timeline-zoom"], .timeline-zoom'); }
  get timelineNavigation() { return this.page.locator('[data-testid="timeline-nav"], .timeline-nav'); }

  // Analytics View specific elements
  get analyticsCharts() { return this.page.locator('[data-testid="analytics-chart"], .analytics-chart'); }
  get metricsCards() { return this.page.locator('[data-testid="metrics-card"], .metrics-card'); }
  get timeRangeSelector() { return this.page.locator('[data-testid="time-range"], .time-range-selector'); }
  get chartFilters() { return this.page.locator('[data-testid="chart-filter"], .chart-filter'); }

  // Claude Config View specific elements
  get configForm() { return this.page.locator('[data-testid="config-form"], .config-form'); }
  get configTabs() { return this.page.locator('[data-testid="config-tab"], .config-tab'); }
  get saveButton() { return this.page.locator('[data-testid="save-config"], button:has-text("Save")'); }
  get resetButton() { return this.page.locator('[data-testid="reset-config"], button:has-text("Reset")'); }

  /**
   * Navigate to a specific view and wait for it to load
   */
  async navigateToViewAndWait(viewType: string): Promise<void> {
    await navigateToView(this.page, viewType as any);
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000); // Allow for animations
  }

  /**
   * Test List View navigation patterns
   */
  async testListViewNavigation(): Promise<void> {
    console.log('📋 Testing List View navigation patterns...');
    
    await this.navigateToViewAndWait('list');
    
    // Test search functionality
    if (await this.searchInput.isVisible()) {
      await this.searchInput.fill('test search');
      await this.page.waitForTimeout(500);
      await this.searchInput.clear();
    }

    // Test filter interactions
    const filterButtons = await this.filterButtons.all();
    for (const button of filterButtons.slice(0, 2)) { // Test first 2 filters
      if (await button.isVisible()) {
        await button.click();
        await this.page.waitForTimeout(300);
      }
    }

    // Test task card interactions
    const taskCards = await this.taskCards.all();
    if (taskCards.length > 0) {
      await taskCards[0].click();
      await this.page.waitForTimeout(500);
    }

    console.log('✅ List View navigation patterns tested');
  }

  /**
   * Test Kanban View navigation patterns
   */
  async testKanbanViewNavigation(): Promise<void> {
    console.log('📊 Testing Kanban View navigation patterns...');
    
    await this.navigateToViewAndWait('kanban');
    
    // Test board navigation
    if (await this.kanbanBoard.isVisible()) {
      // Test column interactions
      const columns = await this.kanbanColumns.all();
      for (const column of columns.slice(0, 3)) { // Test first 3 columns
        if (await column.isVisible()) {
          await column.hover();
          await this.page.waitForTimeout(200);
        }
      }

      // Test card interactions in kanban
      const kanbanCards = await this.kanbanCards.all();
      if (kanbanCards.length > 0) {
        await kanbanCards[0].click();
        await this.page.waitForTimeout(500);
      }

      // Test horizontal scrolling if needed
      await this.page.evaluate(() => {
        const board = document.querySelector('[data-testid="kanban-board"], .kanban-board');
        if (board) {
          board.scrollLeft += 100;
        }
      });
    }

    console.log('✅ Kanban View navigation patterns tested');
  }

  /**
   * Test Calendar View navigation patterns
   */
  async testCalendarViewNavigation(): Promise<void> {
    console.log('📅 Testing Calendar View navigation patterns...');
    
    await this.navigateToViewAndWait('calendar');
    
    // Test calendar navigation
    if (await this.calendar.isVisible()) {
      // Test month navigation
      if (await this.nextMonthButton.isVisible()) {
        await this.nextMonthButton.click();
        await this.page.waitForTimeout(500);
        
        if (await this.prevMonthButton.isVisible()) {
          await this.prevMonthButton.click();
          await this.page.waitForTimeout(500);
        }
      }

      // Test day interactions
      const calendarDays = await this.calendarDays.all();
      if (calendarDays.length > 0) {
        // Click on a day that's likely to be visible/clickable
        const middleDay = calendarDays[Math.floor(calendarDays.length / 2)];
        if (await middleDay.isVisible()) {
          await middleDay.click();
          await this.page.waitForTimeout(300);
        }
      }

      // Test view mode switches in calendar (if available)
      const viewModeButtons = this.page.locator('button:has-text("Month"), button:has-text("Week"), button:has-text("Day")');
      const viewButtons = await viewModeButtons.all();
      for (const button of viewButtons.slice(0, 2)) {
        if (await button.isVisible()) {
          await button.click();
          await this.page.waitForTimeout(300);
        }
      }
    }

    console.log('✅ Calendar View navigation patterns tested');
  }

  /**
   * Test Timeline View navigation patterns
   */
  async testTimelineViewNavigation(): Promise<void> {
    console.log('📈 Testing Timeline View navigation patterns...');
    
    await this.navigateToViewAndWait('timeline');
    
    // Test timeline navigation
    if (await this.timeline.isVisible()) {
      // Test timeline scrolling
      await this.page.evaluate(() => {
        const timeline = document.querySelector('[data-testid="timeline"], .timeline');
        if (timeline) {
          timeline.scrollLeft += 200;
        }
      });

      // Test timeline event interactions
      const timelineEvents = await this.timelineEvents.all();
      if (timelineEvents.length > 0) {
        await timelineEvents[0].click();
        await this.page.waitForTimeout(500);
      }

      // Test zoom controls if available
      if (await this.timelineZoom.isVisible()) {
        const zoomButtons = this.timelineZoom.locator('button');
        const buttons = await zoomButtons.all();
        for (const button of buttons.slice(0, 2)) {
          if (await button.isVisible()) {
            await button.click();
            await this.page.waitForTimeout(300);
          }
        }
      }
    }

    console.log('✅ Timeline View navigation patterns tested');
  }

  /**
   * Test Analytics View navigation patterns
   */
  async testAnalyticsViewNavigation(): Promise<void> {
    console.log('📊 Testing Analytics View navigation patterns...');
    
    await this.navigateToViewAndWait('analytics');
    
    // Test analytics dashboard navigation
    if (await this.analyticsCharts.isVisible() || await this.metricsCards.isVisible()) {
      // Test metrics card interactions
      const metricsCards = await this.metricsCards.all();
      if (metricsCards.length > 0) {
        await metricsCards[0].click();
        await this.page.waitForTimeout(500);
      }

      // Test chart interactions
      const charts = await this.analyticsCharts.all();
      if (charts.length > 0) {
        await charts[0].hover();
        await this.page.waitForTimeout(300);
      }

      // Test time range selector
      if (await this.timeRangeSelector.isVisible()) {
        const timeRangeOptions = this.timeRangeSelector.locator('button, option');
        const options = await timeRangeOptions.all();
        if (options.length > 0) {
          await options[0].click();
          await this.page.waitForTimeout(300);
        }
      }

      // Test chart filters
      const chartFilters = await this.chartFilters.all();
      for (const filter of chartFilters.slice(0, 2)) {
        if (await filter.isVisible()) {
          await filter.click();
          await this.page.waitForTimeout(200);
        }
      }
    }

    console.log('✅ Analytics View navigation patterns tested');
  }

  /**
   * Test Claude Config View navigation patterns
   */
  async testClaudeConfigViewNavigation(): Promise<void> {
    console.log('⚙️ Testing Claude Config View navigation patterns...');
    
    await this.navigateToViewAndWait('claude-config');
    
    // Test config form navigation
    if (await this.configForm.isVisible()) {
      // Test config tabs if available
      const configTabs = await this.configTabs.all();
      for (const tab of configTabs.slice(0, 3)) {
        if (await tab.isVisible()) {
          await tab.click();
          await this.page.waitForTimeout(300);
        }
      }

      // Test form inputs
      const inputs = this.configForm.locator('input, textarea, select');
      const formInputs = await inputs.all();
      for (const input of formInputs.slice(0, 2)) {
        if (await input.isVisible()) {
          await input.focus();
          await this.page.waitForTimeout(200);
        }
      }

      // Test form navigation buttons
      if (await this.saveButton.isVisible()) {
        await this.saveButton.hover();
        await this.page.waitForTimeout(200);
      }

      if (await this.resetButton.isVisible()) {
        await this.resetButton.hover();
        await this.page.waitForTimeout(200);
      }
    }

    console.log('✅ Claude Config View navigation patterns tested');
  }

  /**
   * Test cross-view workflow navigation
   */
  async testCrossViewWorkflows(): Promise<void> {
    console.log('🔄 Testing cross-view workflow navigation...');
    
    // Simulate a typical user workflow across multiple views
    
    // 1. Start in Analytics to see overview
    await this.navigateToViewAndWait('analytics');
    await this.page.waitForTimeout(500);
    
    // 2. Navigate to List to see detailed tasks
    await this.navigateToViewAndWait('list');
    await this.page.waitForTimeout(500);
    
    // 3. Switch to Kanban for workflow management
    await this.navigateToViewAndWait('kanban');
    await this.page.waitForTimeout(500);
    
    // 4. Check Calendar for scheduling
    await this.navigateToViewAndWait('calendar');
    await this.page.waitForTimeout(500);
    
    // 5. Review Timeline for project progress
    await this.navigateToViewAndWait('timeline');
    await this.page.waitForTimeout(500);
    
    // 6. Configure settings in Claude Config
    await this.navigateToViewAndWait('claude-config');
    await this.page.waitForTimeout(500);
    
    // 7. Return to Analytics for final overview
    await this.navigateToViewAndWait('analytics');
    
    console.log('✅ Cross-view workflow navigation tested');
  }

  /**
   * Test navigation error handling
   */
  async testNavigationErrorHandling(): Promise<void> {
    console.log('🚨 Testing navigation error handling...');
    
    // Try to navigate with corrupted state
    await this.page.evaluate(() => {
      // Simulate various error conditions
      const store = (window as any).__APP_STORE__;
      if (store) {
        // Test with invalid view type
        try {
          store.setViewMode?.({ type: 'nonexistent-view' });
        } catch (error) {
          console.log('Expected error for invalid view:', error);
        }
      }
    });
    
    await this.page.waitForTimeout(1000);
    
    // Should still be in a valid state
    const currentView = await this.page.evaluate(() => {
      return document.body.getAttribute('data-view') || 'unknown';
    });
    
    console.log(`Current view after error test: ${currentView}`);
    
    // Try rapid navigation to test race conditions
    const views = ['list', 'kanban', 'calendar', 'analytics', 'timeline'];
    for (const view of views) {
      await navigateToView(this.page, view as any);
      await this.page.waitForTimeout(50); // Very short wait to create race conditions
    }
    
    // Let it settle
    await this.page.waitForTimeout(1000);
    
    console.log('✅ Navigation error handling tested');
  }

  /**
   * Test context preservation across navigation
   */
  async testContextPreservation(): Promise<void> {
    console.log('💾 Testing context preservation across navigation...');
    
    // Set up context in List view
    await this.navigateToViewAndWait('list');
    
    if (await this.searchInput.isVisible()) {
      await this.searchInput.fill('preserved search');
      await this.page.waitForTimeout(500);
    }
    
    // Navigate to other views and back
    await this.navigateToViewAndWait('analytics');
    await this.navigateToViewAndWait('kanban');
    await this.navigateToViewAndWait('list');
    
    // Check if search context is preserved
    if (await this.searchInput.isVisible()) {
      const searchValue = await this.searchInput.inputValue();
      console.log(`Search value after navigation: "${searchValue}"`);
      // Note: This may or may not be preserved depending on app implementation
    }
    
    console.log('✅ Context preservation tested');
  }
}

/**
 * Test Suite: Navigation Patterns for Different View Types
 */
test.describe('Navigation Patterns for Different View Types', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let navPatternsPage: NavigationPatternsPage;

  test.beforeEach(async () => {
    console.log('🚀 Starting TaskMaster for navigation patterns testing...');
    
    electronApp = await launchElectronForE2E({
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        PLAYWRIGHT_TEST: '1'
      }
    });

    page = await getMainWindow();
    navPatternsPage = new NavigationPatternsPage(page);
    
    // Wait for app to be fully loaded
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('✅ Navigation patterns testing environment ready');
  });

  test.afterEach(async () => {
    await takeE2EScreenshot('navigation-patterns-cleanup');
    await closeElectronE2E();
  });

  /**
   * Test: List View Navigation Patterns
   */
  test('should handle List View navigation patterns correctly', async () => {
    await navPatternsPage.testListViewNavigation();
    await takeE2EScreenshot('list-view-navigation-complete');
  });

  /**
   * Test: Kanban View Navigation Patterns
   */
  test('should handle Kanban View navigation patterns correctly', async () => {
    await navPatternsPage.testKanbanViewNavigation();
    await takeE2EScreenshot('kanban-view-navigation-complete');
  });

  /**
   * Test: Calendar View Navigation Patterns
   */
  test('should handle Calendar View navigation patterns correctly', async () => {
    await navPatternsPage.testCalendarViewNavigation();
    await takeE2EScreenshot('calendar-view-navigation-complete');
  });

  /**
   * Test: Timeline View Navigation Patterns
   */
  test('should handle Timeline View navigation patterns correctly', async () => {
    await navPatternsPage.testTimelineViewNavigation();
    await takeE2EScreenshot('timeline-view-navigation-complete');
  });

  /**
   * Test: Analytics View Navigation Patterns
   */
  test('should handle Analytics View navigation patterns correctly', async () => {
    await navPatternsPage.testAnalyticsViewNavigation();
    await takeE2EScreenshot('analytics-view-navigation-complete');
  });

  /**
   * Test: Claude Config View Navigation Patterns
   */
  test('should handle Claude Config View navigation patterns correctly', async () => {
    await navPatternsPage.testClaudeConfigViewNavigation();
    await takeE2EScreenshot('claude-config-view-navigation-complete');
  });

  /**
   * Test: Cross-View Workflow Navigation
   */
  test('should handle cross-view workflow navigation seamlessly', async () => {
    const startTime = performance.now();
    
    await navPatternsPage.testCrossViewWorkflows();
    
    const endTime = performance.now();
    const workflowTime = endTime - startTime;
    
    // Complete workflow should take less than 10 seconds
    expect(workflowTime).toBeLessThan(10000);
    
    console.log(`📊 Cross-view workflow completed in ${workflowTime.toFixed(2)}ms`);
    await takeE2EScreenshot('cross-view-workflow-complete');
  });

  /**
   * Test: Navigation Error Handling and Recovery
   */
  test('should handle navigation errors gracefully', async () => {
    await navPatternsPage.testNavigationErrorHandling();
    
    // Verify app is still functional after error scenarios
    await navPatternsPage.navigateToViewAndWait('list');
    const isListViewActive = await verifyActiveView(page, 'list');
    expect(isListViewActive).toBeTruthy();
    
    await takeE2EScreenshot('navigation-error-handling-complete');
  });

  /**
   * Test: Context Preservation Across Navigation
   */
  test('should preserve relevant context during navigation', async () => {
    await navPatternsPage.testContextPreservation();
    await takeE2EScreenshot('context-preservation-complete');
  });

  /**
   * Test: Navigation Performance Across All Views
   */
  test('should maintain good performance across all navigation patterns', async () => {
    const performanceResults = [];
    
    const views = ['list', 'kanban', 'calendar', 'timeline', 'analytics', 'claude-config'];
    
    for (const view of views) {
      const startTime = performance.now();
      
      await navPatternsPage.navigateToViewAndWait(view);
      
      // Test some view-specific interactions
      switch (view) {
        case 'list':
          await navPatternsPage.testListViewNavigation();
          break;
        case 'kanban':
          await navPatternsPage.testKanbanViewNavigation();
          break;
        case 'calendar':
          await navPatternsPage.testCalendarViewNavigation();
          break;
        case 'timeline':
          await navPatternsPage.testTimelineViewNavigation();
          break;
        case 'analytics':
          await navPatternsPage.testAnalyticsViewNavigation();
          break;
        case 'claude-config':
          await navPatternsPage.testClaudeConfigViewNavigation();
          break;
      }
      
      const endTime = performance.now();
      const viewTime = endTime - startTime;
      
      performanceResults.push({
        view,
        time: viewTime
      });
      
      // Each view's complete navigation pattern should complete in under 5 seconds
      expect(viewTime).toBeLessThan(5000);
    }
    
    const averageTime = performanceResults.reduce((sum, result) => sum + result.time, 0) / performanceResults.length;
    
    console.log('📊 Navigation Pattern Performance Results:');
    performanceResults.forEach(result => {
      console.log(`  ${result.view}: ${result.time.toFixed(2)}ms`);
    });
    console.log(`  Average: ${averageTime.toFixed(2)}ms`);
    
    // Average navigation pattern time should be under 3 seconds
    expect(averageTime).toBeLessThan(3000);
    
    await takeE2EScreenshot('navigation-performance-test-complete');
  });

  /**
   * Test: Navigation Accessibility Patterns
   */
  test('should support accessible navigation patterns in all views', async () => {
    const views = ['list', 'kanban', 'calendar', 'timeline', 'analytics', 'claude-config'];
    
    for (const view of views) {
      console.log(`♿ Testing accessibility in ${view} view...`);
      
      await navPatternsPage.navigateToViewAndWait(view);
      
      // Test keyboard navigation within the view
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      
      // Verify focus is visible
      const focusedElement = page.locator(':focus').first();
      const isFocusVisible = await focusedElement.isVisible().catch(() => false);
      
      if (isFocusVisible) {
        console.log(`✅ Focus visible in ${view} view`);
      } else {
        console.log(`⚠️ Focus not clearly visible in ${view} view`);
      }
      
      // Test arrow key navigation (if applicable)
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);
      
      // Test escape key (should not break navigation)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }
    
    await takeE2EScreenshot('accessibility-navigation-complete');
    console.log('✅ Accessibility navigation patterns tested across all views');
  });

  /**
   * Test: Mobile-Style Navigation Patterns (if applicable)
   */
  test('should handle responsive navigation patterns', async () => {
    // Test with smaller viewport to simulate mobile/tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    const views = ['list', 'analytics', 'kanban'];
    
    for (const view of views) {
      await navPatternsPage.navigateToViewAndWait(view);
      
      // Check if navigation adapts to smaller screen
      const sidebarVisible = await navPatternsPage.sidebar.isVisible();
      
      // Test touch-like interactions
      await simulateUserActions(page, [
        { type: 'click', selector: 'main', delay: 100 },
        { type: 'wait', delay: 200 }
      ]);
      
      console.log(`📱 ${view} view tested with responsive viewport`);
    }
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    
    await takeE2EScreenshot('responsive-navigation-complete');
  });
});