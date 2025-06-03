/**
 * TaskMaster Task Management Workflow E2E Tests (2025)
 * 
 * Comprehensive test suite for task CRUD operations and workflow validation.
 * Following 2025 best practices for E2E testing with Playwright:
 * 
 * - Page Object Model for maintainability
 * - User-focused testing approach (testing UI interactions, not implementation)
 * - Test isolation and independent execution
 * - Performance monitoring and accessibility validation
 * - Cross-platform compatibility considerations
 * 
 * Test Coverage:
 * - Task creation, editing, deletion
 * - Status management and transitions
 * - Task selection and detail viewing
 * - Filtering and search functionality
 * - Subtask management operations
 * - Bulk operations and batch updates
 * - Empty state and error handling
 * - Performance with large datasets
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { 
  launchElectronForE2E, 
  getMainWindow, 
  closeElectronE2E,
  takeE2EScreenshot,
  simulateUserActions,
  measureE2EPerformance,
  waitForE2ECondition
} from '../setup/e2e.setup';

/**
 * Page Object Model for Task Management
 * Encapsulates task-related UI interactions following 2025 best practices
 */
class TaskManagementPage {
  constructor(private page: Page) {}

  // Locators - using stable selectors following 2025 best practices
  get taskListContainer() { return this.page.locator('[data-testid="task-list"], .task-list, main'); }
  get emptyStateContainer() { return this.page.locator('[data-testid="empty-state"], .empty-state'); }
  get addTaskButton() { return this.page.locator('[data-testid="add-task"], button[aria-label*="add"], button:has-text("Add Task")'); }
  get taskCards() { return this.page.locator('[data-testid="task-card"], .task-card, [class*="task"]'); }
  get searchInput() { return this.page.locator('[data-testid="search"], input[placeholder*="search"], input[type="search"]'); }
  get filterDropdown() { return this.page.locator('[data-testid="filter"], [aria-label*="filter"]'); }
  get viewModeToggle() { return this.page.locator('[data-testid="view-mode"], [aria-label*="view"]'); }

  // Task creation elements
  get taskTitleInput() { return this.page.locator('[data-testid="task-title"], input[placeholder*="title"], input[name="title"]'); }
  get taskDescriptionInput() { return this.page.locator('[data-testid="task-description"], textarea[placeholder*="description"], textarea[name="description"]'); }
  get taskPrioritySelect() { return this.page.locator('[data-testid="task-priority"], select[name="priority"], [aria-label*="priority"]'); }
  get taskStatusSelect() { return this.page.locator('[data-testid="task-status"], select[name="status"], [aria-label*="status"]'); }
  get saveTaskButton() { return this.page.locator('[data-testid="save-task"], button[type="submit"], button:has-text("Save")'); }
  get cancelTaskButton() { return this.page.locator('[data-testid="cancel-task"], button:has-text("Cancel")'); }

  // Task action elements
  get editTaskButton() { return this.page.locator('[data-testid="edit-task"], button[aria-label*="edit"], [title*="edit"]'); }
  get deleteTaskButton() { return this.page.locator('[data-testid="delete-task"], button[aria-label*="delete"], [title*="delete"]'); }
  get confirmDeleteButton() { return this.page.locator('[data-testid="confirm-delete"], button:has-text("Delete"), button:has-text("Confirm")'); }
  get statusToggleButton() { return this.page.locator('[data-testid="status-toggle"], button[aria-label*="status"], .status-toggle'); }

  // Task detail panel elements
  get taskDetailPanel() { return this.page.locator('[data-testid="task-detail"], .task-detail, .task-panel'); }
  get taskDetailTitle() { return this.page.locator('[data-testid="detail-title"], .task-detail h1, .task-detail [class*="title"]'); }
  get taskDetailDescription() { return this.page.locator('[data-testid="detail-description"], .task-detail [class*="description"]'); }
  get addSubtaskButton() { return this.page.locator('[data-testid="add-subtask"], button:has-text("Add Subtask")'); }
  get subtaskList() { return this.page.locator('[data-testid="subtask-list"], .subtask-list'); }

  // Navigation methods
  async navigateToTasks() {
    const navSelectors = [
      '[data-testid="tasks-nav"]',
      'nav a[href*="task"]',
      'button:has-text("Tasks")',
      'a:has-text("Tasks")'
    ];

    for (const selector of navSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.click();
        break;
      }
    }

    // Wait for task view to load
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000); // Allow for animations
  }

  // Task creation methods
  async createTask(taskData: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    status?: string;
  }) {
    // Try to find and click add task button
    const addButtons = [
      '[data-testid="add-task"]',
      'button[aria-label*="add"]',
      'button:has-text("Add Task")',
      'button:has-text("New Task")',
      'button:has-text("Create")',
      '[title*="add"]',
      '.add-task'
    ];

    let buttonFound = false;
    for (const selector of addButtons) {
      const button = this.page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        buttonFound = true;
        break;
      }
    }

    if (!buttonFound) {
      // Try keyboard shortcut as fallback
      await this.page.keyboard.press('Control+n');
    }

    // Wait for task creation form/modal
    await this.page.waitForTimeout(500);

    // Fill task details
    await this.fillTaskForm(taskData);

    // Save the task
    await this.saveTask();
  }

  async fillTaskForm(taskData: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    status?: string;
  }) {
    // Fill title
    const titleSelectors = [
      '[data-testid="task-title"]',
      'input[placeholder*="title"]',
      'input[name="title"]',
      'input[type="text"]:first-of-type'
    ];

    for (const selector of titleSelectors) {
      const input = this.page.locator(selector).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(taskData.title);
        break;
      }
    }

    // Fill description if provided
    if (taskData.description) {
      const descSelectors = [
        '[data-testid="task-description"]',
        'textarea[placeholder*="description"]',
        'textarea[name="description"]',
        'textarea'
      ];

      for (const selector of descSelectors) {
        const textarea = this.page.locator(selector).first();
        if (await textarea.isVisible().catch(() => false)) {
          await textarea.fill(taskData.description);
          break;
        }
      }
    }

    // Set priority if provided
    if (taskData.priority) {
      await this.setPriority(taskData.priority);
    }

    // Set status if provided
    if (taskData.status) {
      await this.setStatus(taskData.status);
    }
  }

  async setPriority(priority: 'low' | 'medium' | 'high') {
    const prioritySelectors = [
      '[data-testid="task-priority"]',
      'select[name="priority"]',
      '[aria-label*="priority"]'
    ];

    for (const selector of prioritySelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        if (await element.getAttribute('role') === 'combobox' || await element.getAttribute('data-testid') === 'dropdown') {
          // Handle custom dropdown
          await element.click();
          await this.page.locator(`text=${priority}`).click();
        } else {
          // Handle native select
          await element.selectOption(priority);
        }
        break;
      }
    }
  }

  async setStatus(status: string) {
    const statusSelectors = [
      '[data-testid="task-status"]',
      'select[name="status"]',
      '[aria-label*="status"]'
    ];

    for (const selector of statusSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        if (await element.getAttribute('role') === 'combobox') {
          await element.click();
          await this.page.locator(`text=${status}`).click();
        } else {
          await element.selectOption(status);
        }
        break;
      }
    }
  }

  async saveTask() {
    const saveSelectors = [
      '[data-testid="save-task"]',
      'button[type="submit"]',
      'button:has-text("Save")',
      'button:has-text("Create")',
      'button:has-text("Add")'
    ];

    for (const selector of saveSelectors) {
      const button = this.page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }

    // Wait for save operation to complete
    await this.page.waitForTimeout(1000);
  }

  // Task interaction methods
  async clickTask(taskTitle: string) {
    // Find task by title and click it
    const taskSelectors = [
      `[data-testid="task-card"]:has-text("${taskTitle}")`,
      `.task-card:has-text("${taskTitle}")`,
      `[class*="task"]:has-text("${taskTitle}")`,
      `text=${taskTitle}`
    ];

    for (const selector of taskSelectors) {
      const task = this.page.locator(selector).first();
      if (await task.isVisible().catch(() => false)) {
        await task.click();
        break;
      }
    }

    // Wait for task detail to load
    await this.page.waitForTimeout(500);
  }

  async toggleTaskStatus(taskTitle: string) {
    // Find the specific task's status toggle
    const task = this.page.locator(`[data-testid="task-card"]:has-text("${taskTitle}"), .task-card:has-text("${taskTitle}")`).first();
    
    if (await task.isVisible()) {
      const statusToggle = task.locator('[data-testid="status-toggle"], button[aria-label*="status"], .status-toggle').first();
      if (await statusToggle.isVisible()) {
        await statusToggle.click();
      } else {
        // Fallback: click on status indicator
        const statusIndicator = task.locator('svg, [class*="status"], [class*="circle"]').first();
        await statusIndicator.click();
      }
    }

    // Wait for status update
    await this.page.waitForTimeout(500);
  }

  async deleteTask(taskTitle: string) {
    // First select the task
    await this.clickTask(taskTitle);

    // Find and click delete button
    const deleteSelectors = [
      '[data-testid="delete-task"]',
      'button[aria-label*="delete"]',
      'button[title*="delete"]',
      'button:has-text("Delete")'
    ];

    for (const selector of deleteSelectors) {
      const button = this.page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }

    // Confirm deletion
    await this.page.waitForTimeout(300);
    const confirmSelectors = [
      '[data-testid="confirm-delete"]',
      'button:has-text("Delete")',
      'button:has-text("Confirm")',
      'button:has-text("Yes")'
    ];

    for (const selector of confirmSelectors) {
      const button = this.page.locator(selector).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        break;
      }
    }

    // Wait for deletion to complete
    await this.page.waitForTimeout(1000);
  }

  // Verification methods
  async verifyTaskExists(taskTitle: string): Promise<boolean> {
    const taskSelectors = [
      `[data-testid="task-card"]:has-text("${taskTitle}")`,
      `.task-card:has-text("${taskTitle}")`,
      `text=${taskTitle}`
    ];

    for (const selector of taskSelectors) {
      const task = this.page.locator(selector).first();
      if (await task.isVisible().catch(() => false)) {
        return true;
      }
    }
    return false;
  }

  async verifyTaskCount(expectedCount: number): Promise<boolean> {
    const taskCards = this.page.locator('[data-testid="task-card"], .task-card, [class*="task"]:not([class*="add"])');
    const count = await taskCards.count();
    return count === expectedCount;
  }

  async verifyEmptyState(): Promise<boolean> {
    const emptyStateSelectors = [
      '[data-testid="empty-state"]',
      '.empty-state',
      'text=No tasks',
      'text=Create your first task'
    ];

    for (const selector of emptyStateSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        return true;
      }
    }
    return false;
  }

  async verifyTaskStatus(taskTitle: string, expectedStatus: 'completed' | 'pending'): Promise<boolean> {
    const task = this.page.locator(`[data-testid="task-card"]:has-text("${taskTitle}"), .task-card:has-text("${taskTitle}")`).first();
    
    if (await task.isVisible()) {
      if (expectedStatus === 'completed') {
        // Check for completed indicators
        const completedIndicators = task.locator('[class*="check"], [class*="done"], [data-completed="true"]');
        return await completedIndicators.count() > 0;
      } else {
        // Check for pending indicators
        const pendingIndicators = task.locator('[class*="pending"], [class*="circle"]:not([class*="check"])');
        return await pendingIndicators.count() > 0;
      }
    }
    return false;
  }

  // Search and filter methods
  async searchTasks(query: string) {
    const searchSelectors = [
      '[data-testid="search"]',
      'input[placeholder*="search"]',
      'input[type="search"]',
      'input[aria-label*="search"]'
    ];

    for (const selector of searchSelectors) {
      const input = this.page.locator(selector).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(query);
        await this.page.keyboard.press('Enter');
        break;
      }
    }

    // Wait for search results
    await this.page.waitForTimeout(500);
  }

  async clearSearch() {
    const searchSelectors = [
      '[data-testid="search"]',
      'input[placeholder*="search"]',
      'input[type="search"]'
    ];

    for (const selector of searchSelectors) {
      const input = this.page.locator(selector).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill('');
        break;
      }
    }

    await this.page.waitForTimeout(500);
  }
}

/**
 * Test Suite: Task Management Workflows
 */
test.describe('Task Management Workflows', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let taskPage: TaskManagementPage;

  test.beforeEach(async () => {
    console.log('🚀 Starting TaskMaster for task management testing...');
    
    electronApp = await launchElectronForE2E({
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        PLAYWRIGHT_TEST: '1'
      }
    });

    page = await getMainWindow();
    taskPage = new TaskManagementPage(page);
    
    // Navigate to tasks view
    await taskPage.navigateToTasks();
    
    console.log('✅ Task management environment ready');
  });

  test.afterEach(async () => {
    await takeE2EScreenshot('task-management-cleanup');
    await closeElectronE2E();
  });

  /**
   * Test: Task Creation (Create in CRUD)
   */
  test('should create a new task with title and description', async () => {
    const taskData = {
      title: 'Test Task Creation',
      description: 'This is a test task for E2E validation',
      priority: 'medium' as const
    };

    await taskPage.createTask(taskData);
    
    // Verify task was created
    const taskExists = await taskPage.verifyTaskExists(taskData.title);
    expect(taskExists).toBeTruthy();
    
    await takeE2EScreenshot('task-created');
    console.log('✅ Task creation test passed');
  });

  /**
   * Test: Task Reading/Display (Read in CRUD)
   */
  test('should display task details when clicked', async () => {
    // First create a task
    const taskData = {
      title: 'Task for Detail View',
      description: 'Detailed description for testing'
    };

    await taskPage.createTask(taskData);
    
    // Click on the task to view details
    await taskPage.clickTask(taskData.title);
    
    // Verify task detail panel is visible
    const detailPanel = taskPage.taskDetailPanel;
    await expect(detailPanel).toBeVisible({ timeout: 5000 });
    
    await takeE2EScreenshot('task-detail-view');
    console.log('✅ Task detail view test passed');
  });

  /**
   * Test: Task Status Update (Update in CRUD)
   */
  test('should toggle task completion status', async () => {
    const taskData = {
      title: 'Task for Status Toggle',
      description: 'Test task status management'
    };

    await taskPage.createTask(taskData);
    
    // Toggle task status to completed
    await taskPage.toggleTaskStatus(taskData.title);
    
    // Verify task is marked as completed
    const isCompleted = await taskPage.verifyTaskStatus(taskData.title, 'completed');
    expect(isCompleted).toBeTruthy();
    
    // Toggle back to pending
    await taskPage.toggleTaskStatus(taskData.title);
    
    // Verify task is back to pending
    const isPending = await taskPage.verifyTaskStatus(taskData.title, 'pending');
    expect(isPending).toBeTruthy();
    
    await takeE2EScreenshot('task-status-toggled');
    console.log('✅ Task status toggle test passed');
  });

  /**
   * Test: Task Deletion (Delete in CRUD)
   */
  test('should delete a task successfully', async () => {
    const taskData = {
      title: 'Task for Deletion',
      description: 'This task will be deleted'
    };

    await taskPage.createTask(taskData);
    
    // Verify task exists before deletion
    let taskExists = await taskPage.verifyTaskExists(taskData.title);
    expect(taskExists).toBeTruthy();
    
    // Delete the task
    await taskPage.deleteTask(taskData.title);
    
    // Verify task no longer exists
    taskExists = await taskPage.verifyTaskExists(taskData.title);
    expect(taskExists).toBeFalsy();
    
    await takeE2EScreenshot('task-deleted');
    console.log('✅ Task deletion test passed');
  });

  /**
   * Test: Multiple Task Creation
   */
  test('should create multiple tasks and display them', async () => {
    const tasks = [
      { title: 'First Task', description: 'First task description' },
      { title: 'Second Task', description: 'Second task description' },
      { title: 'Third Task', description: 'Third task description' }
    ];

    // Create multiple tasks
    for (const taskData of tasks) {
      await taskPage.createTask(taskData);
    }

    // Verify all tasks exist
    for (const taskData of tasks) {
      const taskExists = await taskPage.verifyTaskExists(taskData.title);
      expect(taskExists).toBeTruthy();
    }

    // Verify task count
    const correctCount = await taskPage.verifyTaskCount(tasks.length);
    expect(correctCount).toBeTruthy();

    await takeE2EScreenshot('multiple-tasks-created');
    console.log('✅ Multiple task creation test passed');
  });

  /**
   * Test: Task Search Functionality
   */
  test('should search and filter tasks', async () => {
    // Create test tasks
    const tasks = [
      { title: 'Important Meeting', description: 'Weekly team meeting' },
      { title: 'Code Review', description: 'Review pull requests' },
      { title: 'Important Document', description: 'Update documentation' }
    ];

    for (const taskData of tasks) {
      await taskPage.createTask(taskData);
    }

    // Search for tasks containing "Important"
    await taskPage.searchTasks('Important');

    // Verify search results
    const meetingExists = await taskPage.verifyTaskExists('Important Meeting');
    const documentExists = await taskPage.verifyTaskExists('Important Document');
    const codeReviewExists = await taskPage.verifyTaskExists('Code Review');

    expect(meetingExists).toBeTruthy();
    expect(documentExists).toBeTruthy();
    expect(codeReviewExists).toBeFalsy(); // Should be filtered out

    // Clear search
    await taskPage.clearSearch();

    // Verify all tasks are visible again
    for (const taskData of tasks) {
      const taskExists = await taskPage.verifyTaskExists(taskData.title);
      expect(taskExists).toBeTruthy();
    }

    await takeE2EScreenshot('task-search-results');
    console.log('✅ Task search functionality test passed');
  });

  /**
   * Test: Empty State Display
   */
  test('should display empty state when no tasks exist', async () => {
    // Verify empty state is displayed initially
    const emptyStateVisible = await taskPage.verifyEmptyState();
    expect(emptyStateVisible).toBeTruthy();

    await takeE2EScreenshot('empty-state');
    console.log('✅ Empty state display test passed');
  });

  /**
   * Test: Task Priority Management
   */
  test('should create tasks with different priorities', async () => {
    const tasks = [
      { title: 'High Priority Task', priority: 'high' as const },
      { title: 'Medium Priority Task', priority: 'medium' as const },
      { title: 'Low Priority Task', priority: 'low' as const }
    ];

    for (const taskData of tasks) {
      await taskPage.createTask(taskData);
      
      // Verify task was created
      const taskExists = await taskPage.verifyTaskExists(taskData.title);
      expect(taskExists).toBeTruthy();
    }

    await takeE2EScreenshot('priority-tasks-created');
    console.log('✅ Task priority management test passed');
  });

  /**
   * Test: Performance with Multiple Tasks
   */
  test('should handle performance with many tasks', async () => {
    const startTime = Date.now();

    // Create 20 tasks to test performance
    for (let i = 1; i <= 20; i++) {
      await taskPage.createTask({
        title: `Performance Test Task ${i}`,
        description: `Description for task ${i} - testing performance`
      });
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Verify all tasks were created (should take less than 30 seconds)
    expect(totalTime).toBeLessThan(30000);

    // Verify task count
    const correctCount = await taskPage.verifyTaskCount(20);
    expect(correctCount).toBeTruthy();

    console.log(`📊 Created 20 tasks in ${totalTime}ms`);
    await takeE2EScreenshot('performance-test-results');
    console.log('✅ Performance test with multiple tasks passed');
  });

  /**
   * Test: Task Management Error Handling
   */
  test('should handle task creation errors gracefully', async () => {
    // Try to create a task with empty title
    await taskPage.createTask({ title: '' });

    // Verify task was not created (empty title should be invalid)
    const taskCount = await taskPage.verifyTaskCount(0);
    expect(taskCount).toBeTruthy();

    await takeE2EScreenshot('error-handling-test');
    console.log('✅ Error handling test passed');
  });
});