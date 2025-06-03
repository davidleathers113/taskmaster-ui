/**
 * MemLab Scenario: Task Operations Memory Leak Detection
 * 
 * This scenario tests for memory leaks during common task operations:
 * - Creating and deleting tasks
 * - Filtering and sorting tasks
 * - Navigating between views
 * - Batch operations
 */

import { Page } from 'puppeteer';
import { IScenario } from '@memlab/api';

const scenario: IScenario = {
  setup: async (page: Page) => {
    // Navigate to the application
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Wait for the app to fully load
    await page.waitForSelector('[data-testid="task-list"], .task-list', { timeout: 10000 });
  },
  
  action: async (page: Page) => {
    // 1. Create multiple tasks
    for (let i = 0; i < 50; i++) {
      // Open create task dialog
      const createButton = await page.$('[data-testid="create-task-button"], button:has-text("Create")');
      if (createButton) {
        await createButton.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 2000 });
        
        // Fill task details
        await page.type('input[name="title"]', `Memory Test Task ${i}`);
        await page.type('textarea[name="description"]', `Description for task ${i} - testing memory leaks`);
        
        // Submit
        await page.click('button[type="submit"]');
        await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 2000 }).catch(() => {});
      }
    }
    
    // 2. Navigate through different views
    const views = ['kanban', 'analytics', 'calendar', 'timeline', 'list'];
    for (const view of views) {
      const viewButton = await page.$(`[data-testid="view-${view}"], button:has-text("${view}")`);
      if (viewButton) {
        await viewButton.click();
        await page.waitForTimeout(1000); // Wait for view to render
      }
    }
    
    // 3. Perform search operations
    const searchInput = await page.$('input[type="search"], input[placeholder*="Search"]');
    if (searchInput) {
      await searchInput.type('Memory Test');
      await page.waitForTimeout(500);
      await searchInput.click({ clickCount: 3 }); // Select all
      await searchInput.type('Task 2');
      await page.waitForTimeout(500);
    }
    
    // 4. Select and delete tasks
    const checkboxes = await page.$$('input[type="checkbox"][data-testid*="task"]');
    for (let i = 0; i < Math.min(checkboxes.length, 20); i++) {
      await checkboxes[i].click();
    }
    
    // Perform batch delete
    const batchButton = await page.$('[data-testid="batch-action"], button:has-text("Batch")');
    if (batchButton) {
      await batchButton.click();
      const deleteOption = await page.$('button:has-text("Delete")');
      if (deleteOption) {
        await deleteOption.click();
        const confirmButton = await page.$('button:has-text("Confirm")');
        if (confirmButton) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  },
  
  back: async (page: Page) => {
    // Navigate back to the initial state
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-testid="task-list"], .task-list', { timeout: 10000 });
    
    // Force garbage collection if available
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });
  },
  
  // Optional: Define what constitutes a memory leak
  leakFilter: (node: any, _snapshot: any, _leakedNodeIds: Set<number>) => {
    // Filter for specific types of leaks
    // Return true if this node should be considered a leak
    
    // Check for detached DOM nodes
    if (node.name && node.name.includes('Detached')) {
      return true;
    }
    
    // Check for event listeners that weren't cleaned up
    if (node.name && (node.name.includes('EventListener') || node.name.includes('EventEmitter'))) {
      return true;
    }
    
    // Check for React components that should have been unmounted
    if (node.name && node.name.includes('Fiber') && node.retainedSize > 10000) {
      return true;
    }
    
    // Check for large arrays or objects that might indicate a leak
    if (node.type === 'Array' && node.retainedSize > 1000000) { // 1MB
      return true;
    }
    
    return false;
  }
};

export default scenario;