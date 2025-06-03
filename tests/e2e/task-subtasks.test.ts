/**
 * TaskMaster Subtask Management E2E Tests (2025)
 * 
 * Comprehensive test suite for subtask CRUD operations and hierarchical task management.
 * Following 2025 best practices for complex workflow testing.
 * 
 * Test Coverage:
 * - Subtask creation and management
 * - Parent-child task relationships
 * - Progress calculation based on subtasks
 * - Subtask status updates affecting parent task
 * - Hierarchical task operations
 * - Bulk subtask operations
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { 
  launchElectronForE2E, 
  getMainWindow, 
  closeElectronE2E,
  takeE2EScreenshot,
  simulateUserActions
} from '../setup/e2e.setup';

/**
 * Page Object Model for Subtask Management
 */
class SubtaskManagementPage {
  constructor(private page: Page) {}

  // Locators for subtask-specific elements
  get addSubtaskButton() { return this.page.locator('[data-testid="add-subtask"], button:has-text("Add Subtask")'); }
  get subtaskList() { return this.page.locator('[data-testid="subtask-list"], .subtask-list'); }
  get subtaskItems() { return this.page.locator('[data-testid="subtask-item"], .subtask-item'); }
  get subtaskTitleInput() { return this.page.locator('[data-testid="subtask-title"], input[placeholder*="subtask"]'); }
  get subtaskDescriptionInput() { return this.page.locator('[data-testid="subtask-description"], textarea[placeholder*="subtask"]'); }
  get saveSubtaskButton() { return this.page.locator('[data-testid="save-subtask"], button:has-text("Save Subtask")'); }
  get progressBar() { return this.page.locator('[data-testid="progress-bar"], .progress-bar'); }
  get progressPercentage() { return this.page.locator('[data-testid="progress-percentage"], .progress-percentage'); }

  // Task creation for subtask testing
  async createParentTask(title: string, description?: string) {
    // Navigate to task creation
    const addTaskButtons = [
      '[data-testid="add-task"]',
      'button:has-text("Add Task")',
      'button:has-text("New Task")'
    ];

    for (const selector of addTaskButtons) {
      const button = this.page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }

    await this.page.waitForTimeout(500);

    // Fill task details
    const titleSelectors = [
      '[data-testid="task-title"]',
      'input[placeholder*="title"]',
      'input[name="title"]'
    ];

    for (const selector of titleSelectors) {
      const input = this.page.locator(selector).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(title);
        break;
      }
    }

    if (description) {
      const descSelectors = [
        '[data-testid="task-description"]',
        'textarea[placeholder*="description"]',
        'textarea[name="description"]'
      ];

      for (const selector of descSelectors) {
        const textarea = this.page.locator(selector).first();
        if (await textarea.isVisible().catch(() => false)) {
          await textarea.fill(description);
          break;
        }
      }
    }

    // Save task
    const saveSelectors = [
      '[data-testid="save-task"]',
      'button[type="submit"]',
      'button:has-text("Save")'
    ];

    for (const selector of saveSelectors) {
      const button = this.page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }

    await this.page.waitForTimeout(1000);
  }

  async selectTask(taskTitle: string) {
    const taskSelectors = [
      `[data-testid="task-card"]:has-text("${taskTitle}")`,
      `.task-card:has-text("${taskTitle}")`,
      `text=${taskTitle}`
    ];

    for (const selector of taskSelectors) {
      const task = this.page.locator(selector).first();
      if (await task.isVisible().catch(() => false)) {
        await task.click();
        break;
      }
    }

    // Wait for task detail panel to open
    await this.page.waitForTimeout(1000);
  }

  async addSubtask(title: string, description?: string) {
    // Find and click add subtask button
    const addButtons = [
      '[data-testid="add-subtask"]',
      'button:has-text("Add Subtask")',
      'button:has-text("New Subtask")',
      '[aria-label*="add subtask"]'
    ];

    for (const selector of addButtons) {
      const button = this.page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }

    await this.page.waitForTimeout(500);

    // Fill subtask details
    const titleSelectors = [
      '[data-testid="subtask-title"]',
      'input[placeholder*="subtask"]',
      'input[placeholder*="title"]'
    ];

    for (const selector of titleSelectors) {
      const input = this.page.locator(selector).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(title);
        break;
      }
    }

    if (description) {
      const descSelectors = [
        '[data-testid="subtask-description"]',
        'textarea[placeholder*="subtask"]',
        'textarea[placeholder*="description"]'
      ];

      for (const selector of descSelectors) {
        const textarea = this.page.locator(selector).first();
        if (await textarea.isVisible().catch(() => false)) {
          await textarea.fill(description);
          break;
        }
      }
    }

    // Save subtask
    const saveSelectors = [
      '[data-testid="save-subtask"]',
      'button:has-text("Save Subtask")',
      'button:has-text("Add")',
      'button[type="submit"]'
    ];

    for (const selector of saveSelectors) {
      const button = this.page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }

    await this.page.waitForTimeout(1000);
  }

  async toggleSubtaskStatus(subtaskTitle: string) {
    // Find the specific subtask and toggle its status
    const subtask = this.page.locator(`[data-testid="subtask-item"]:has-text("${subtaskTitle}"), .subtask-item:has-text("${subtaskTitle}")`).first();
    
    if (await subtask.isVisible()) {
      const statusToggle = subtask.locator('[data-testid="subtask-status-toggle"], button[aria-label*="status"], .status-toggle').first();
      if (await statusToggle.isVisible()) {
        await statusToggle.click();
      } else {
        // Fallback: click on status indicator within subtask
        const statusIndicator = subtask.locator('svg, [class*="status"], [class*="circle"]').first();
        await statusIndicator.click();
      }
    }

    await this.page.waitForTimeout(500);
  }

  async deleteSubtask(subtaskTitle: string) {
    const subtask = this.page.locator(`[data-testid="subtask-item"]:has-text("${subtaskTitle}"), .subtask-item:has-text("${subtaskTitle}")`).first();
    
    if (await subtask.isVisible()) {
      // Try to find delete button within subtask
      const deleteButton = subtask.locator('[data-testid="delete-subtask"], button[aria-label*="delete"], [title*="delete"]').first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
      } else {
        // Fallback: right-click for context menu
        await subtask.click({ button: 'right' });
        await this.page.locator('text=Delete').click();
      }
    }

    // Confirm deletion if needed
    const confirmSelectors = [
      '[data-testid="confirm-delete"]',
      'button:has-text("Delete")',
      'button:has-text("Confirm")'
    ];

    for (const selector of confirmSelectors) {
      const button = this.page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }

    await this.page.waitForTimeout(1000);
  }

  async verifySubtaskExists(subtaskTitle: string): Promise<boolean> {
    const subtaskSelectors = [
      `[data-testid="subtask-item"]:has-text("${subtaskTitle}")`,
      `.subtask-item:has-text("${subtaskTitle}")`,
      `text=${subtaskTitle}`
    ];

    for (const selector of subtaskSelectors) {
      const subtask = this.page.locator(selector).first();
      if (await subtask.isVisible().catch(() => false)) {
        return true;
      }
    }
    return false;
  }

  async verifySubtaskCount(expectedCount: number): Promise<boolean> {
    const subtasks = this.page.locator('[data-testid="subtask-item"], .subtask-item');
    const count = await subtasks.count();
    return count === expectedCount;
  }

  async getProgressPercentage(): Promise<number> {
    const progressSelectors = [
      '[data-testid="progress-percentage"]',
      '.progress-percentage',
      '[class*="progress"]:has-text("%")'
    ];

    for (const selector of progressSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        const text = await element.textContent();
        const match = text?.match(/(\d+)%/);
        if (match) {
          return parseInt(match[1]);
        }
      }
    }

    // Fallback: check progress bar width or aria-valuenow
    const progressBar = this.page.locator('[data-testid="progress-bar"], .progress-bar, [role="progressbar"]').first();
    if (await progressBar.isVisible().catch(() => false)) {
      const valueNow = await progressBar.getAttribute('aria-valuenow');
      if (valueNow) {
        return parseInt(valueNow);
      }
    }

    return 0;
  }

  async navigateToTasks() {
    const navSelectors = [
      '[data-testid="tasks-nav"]',
      'nav a[href*="task"]',
      'button:has-text("Tasks")'
    ];

    for (const selector of navSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.click();
        break;
      }
    }

    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
  }
}

/**
 * Test Suite: Subtask Management
 */
test.describe('Subtask Management Workflows', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let subtaskPage: SubtaskManagementPage;

  test.beforeEach(async () => {
    console.log('🚀 Starting TaskMaster for subtask management testing...');
    
    electronApp = await launchElectronForE2E({
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        PLAYWRIGHT_TEST: '1'
      }
    });

    page = await getMainWindow();
    subtaskPage = new SubtaskManagementPage(page);
    
    // Navigate to tasks view
    await subtaskPage.navigateToTasks();
    
    console.log('✅ Subtask management environment ready');
  });

  test.afterEach(async () => {
    await takeE2EScreenshot('subtask-management-cleanup');
    await closeElectronE2E();
  });

  /**
   * Test: Subtask Creation
   */
  test('should create subtasks for a parent task', async () => {
    const parentTaskTitle = 'Parent Task with Subtasks';
    const subtasks = [
      { title: 'First Subtask', description: 'Description for first subtask' },
      { title: 'Second Subtask', description: 'Description for second subtask' },
      { title: 'Third Subtask', description: 'Description for third subtask' }
    ];

    // Create parent task
    await subtaskPage.createParentTask(parentTaskTitle, 'A task that will have multiple subtasks');
    
    // Select the parent task
    await subtaskPage.selectTask(parentTaskTitle);

    // Add subtasks
    for (const subtaskData of subtasks) {
      await subtaskPage.addSubtask(subtaskData.title, subtaskData.description);
    }

    // Verify all subtasks were created
    for (const subtaskData of subtasks) {
      const subtaskExists = await subtaskPage.verifySubtaskExists(subtaskData.title);
      expect(subtaskExists).toBeTruthy();
    }

    // Verify subtask count
    const correctCount = await subtaskPage.verifySubtaskCount(subtasks.length);
    expect(correctCount).toBeTruthy();

    await takeE2EScreenshot('subtasks-created');
    console.log('✅ Subtask creation test passed');
  });

  /**
   * Test: Subtask Status Updates and Progress Calculation
   */
  test('should update progress when subtask status changes', async () => {
    const parentTaskTitle = 'Task for Progress Testing';
    const subtasks = [
      { title: 'Subtask 1' },
      { title: 'Subtask 2' },
      { title: 'Subtask 3' },
      { title: 'Subtask 4' }
    ];

    // Create parent task and subtasks
    await subtaskPage.createParentTask(parentTaskTitle);
    await subtaskPage.selectTask(parentTaskTitle);

    for (const subtaskData of subtasks) {
      await subtaskPage.addSubtask(subtaskData.title);
    }

    // Initial progress should be 0%
    let progress = await subtaskPage.getProgressPercentage();
    expect(progress).toBe(0);

    // Complete first subtask (should be 25%)
    await subtaskPage.toggleSubtaskStatus('Subtask 1');
    progress = await subtaskPage.getProgressPercentage();
    expect(progress).toBe(25);

    // Complete second subtask (should be 50%)
    await subtaskPage.toggleSubtaskStatus('Subtask 2');
    progress = await subtaskPage.getProgressPercentage();
    expect(progress).toBe(50);

    // Complete third subtask (should be 75%)
    await subtaskPage.toggleSubtaskStatus('Subtask 3');
    progress = await subtaskPage.getProgressPercentage();
    expect(progress).toBe(75);

    // Complete fourth subtask (should be 100%)
    await subtaskPage.toggleSubtaskStatus('Subtask 4');
    progress = await subtaskPage.getProgressPercentage();
    expect(progress).toBe(100);

    await takeE2EScreenshot('subtask-progress-complete');
    console.log('✅ Subtask progress calculation test passed');
  });

  /**
   * Test: Subtask Deletion
   */
  test('should delete subtasks and update progress accordingly', async () => {
    const parentTaskTitle = 'Task for Subtask Deletion';
    const subtasks = [
      { title: 'Subtask to Keep' },
      { title: 'Subtask to Delete' },
      { title: 'Another Subtask to Keep' }
    ];

    // Create parent task and subtasks
    await subtaskPage.createParentTask(parentTaskTitle);
    await subtaskPage.selectTask(parentTaskTitle);

    for (const subtaskData of subtasks) {
      await subtaskPage.addSubtask(subtaskData.title);
    }

    // Complete one subtask before deletion
    await subtaskPage.toggleSubtaskStatus('Subtask to Keep');

    // Initial state: 1/3 completed = 33%
    let progress = await subtaskPage.getProgressPercentage();
    expect(progress).toBeCloseTo(33, 0);

    // Delete one subtask
    await subtaskPage.deleteSubtask('Subtask to Delete');

    // Verify subtask was deleted
    const subtaskExists = await subtaskPage.verifySubtaskExists('Subtask to Delete');
    expect(subtaskExists).toBeFalsy();

    // Verify subtask count
    const correctCount = await subtaskPage.verifySubtaskCount(2);
    expect(correctCount).toBeTruthy();

    // Progress should now be 1/2 = 50%
    progress = await subtaskPage.getProgressPercentage();
    expect(progress).toBe(50);

    await takeE2EScreenshot('subtask-deleted');
    console.log('✅ Subtask deletion test passed');
  });

  /**
   * Test: Subtask Status Toggle
   */
  test('should toggle subtask completion status', async () => {
    const parentTaskTitle = 'Task for Status Toggle';
    const subtaskTitle = 'Toggleable Subtask';

    // Create parent task and subtask
    await subtaskPage.createParentTask(parentTaskTitle);
    await subtaskPage.selectTask(parentTaskTitle);
    await subtaskPage.addSubtask(subtaskTitle);

    // Toggle subtask to completed
    await subtaskPage.toggleSubtaskStatus(subtaskTitle);

    // Progress should be 100% (1/1 completed)
    let progress = await subtaskPage.getProgressPercentage();
    expect(progress).toBe(100);

    // Toggle subtask back to pending
    await subtaskPage.toggleSubtaskStatus(subtaskTitle);

    // Progress should be 0% (0/1 completed)
    progress = await subtaskPage.getProgressPercentage();
    expect(progress).toBe(0);

    await takeE2EScreenshot('subtask-status-toggled');
    console.log('✅ Subtask status toggle test passed');
  });

  /**
   * Test: Multiple Subtasks Performance
   */
  test('should handle many subtasks efficiently', async () => {
    const parentTaskTitle = 'Task with Many Subtasks';
    const subtaskCount = 10;

    // Create parent task
    await subtaskPage.createParentTask(parentTaskTitle);
    await subtaskPage.selectTask(parentTaskTitle);

    const startTime = Date.now();

    // Create multiple subtasks
    for (let i = 1; i <= subtaskCount; i++) {
      await subtaskPage.addSubtask(`Subtask ${i}`, `Description for subtask ${i}`);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should complete in reasonable time (less than 20 seconds)
    expect(totalTime).toBeLessThan(20000);

    // Verify all subtasks were created
    const correctCount = await subtaskPage.verifySubtaskCount(subtaskCount);
    expect(correctCount).toBeTruthy();

    // Complete half of them
    for (let i = 1; i <= Math.floor(subtaskCount / 2); i++) {
      await subtaskPage.toggleSubtaskStatus(`Subtask ${i}`);
    }

    // Verify progress is approximately 50%
    const progress = await subtaskPage.getProgressPercentage();
    expect(progress).toBeCloseTo(50, 5); // Allow 5% tolerance

    console.log(`📊 Created ${subtaskCount} subtasks in ${totalTime}ms`);
    await takeE2EScreenshot('many-subtasks-performance');
    console.log('✅ Multiple subtasks performance test passed');
  });

  /**
   * Test: Subtask Hierarchy Display
   */
  test('should display subtask hierarchy correctly', async () => {
    const parentTaskTitle = 'Parent with Hierarchy';
    const subtasks = [
      { title: 'High Priority Subtask' },
      { title: 'Medium Priority Subtask' },
      { title: 'Low Priority Subtask' }
    ];

    // Create parent task and subtasks
    await subtaskPage.createParentTask(parentTaskTitle);
    await subtaskPage.selectTask(parentTaskTitle);

    for (const subtaskData of subtasks) {
      await subtaskPage.addSubtask(subtaskData.title);
    }

    // Verify subtask list is visible and contains all subtasks
    const subtaskList = subtaskPage.subtaskList;
    await expect(subtaskList).toBeVisible();

    // Verify all subtasks are displayed
    for (const subtaskData of subtasks) {
      const subtaskExists = await subtaskPage.verifySubtaskExists(subtaskData.title);
      expect(subtaskExists).toBeTruthy();
    }

    await takeE2EScreenshot('subtask-hierarchy');
    console.log('✅ Subtask hierarchy display test passed');
  });

  /**
   * Test: Empty Subtask List
   */
  test('should handle tasks with no subtasks', async () => {
    const parentTaskTitle = 'Task without Subtasks';

    // Create parent task
    await subtaskPage.createParentTask(parentTaskTitle);
    await subtaskPage.selectTask(parentTaskTitle);

    // Verify subtask count is 0
    const correctCount = await subtaskPage.verifySubtaskCount(0);
    expect(correctCount).toBeTruthy();

    // Progress should be undefined or 0 when no subtasks exist
    const progress = await subtaskPage.getProgressPercentage();
    expect(progress).toBeLessThanOrEqual(0);

    await takeE2EScreenshot('no-subtasks');
    console.log('✅ Empty subtask list test passed');
  });
});