/**
 * MemLab Scenario: View Switching Memory Leak Detection
 * 
 * This scenario tests for memory leaks when rapidly switching between views:
 * - Component lifecycle management
 * - Event listener cleanup
 * - Animation cleanup
 * - State management
 */

import { Page } from 'puppeteer';
import { IScenario } from '@memlab/api';

const scenario: IScenario = {
  setup: async (page: Page) => {
    // Navigate to the application
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Wait for initial load
    await page.waitForSelector('[data-testid="main-content"], main', { timeout: 10000 });
    
    // Inject some test data for better testing
    await page.evaluate(() => {
      // Create test tasks if needed
      const testTasks = Array.from({ length: 100 }, (_, i) => ({
        id: `view-test-${i}`,
        title: `View Test Task ${i}`,
        description: `Task for testing view switching memory leaks`,
        priority: ['high', 'medium', 'low'][i % 3],
        status: ['pending', 'in-progress', 'done'][i % 3],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      // Store in window for testing
      (window as any).__MEMLAB_TEST_TASKS__ = testTasks;
    });
  },
  
  action: async (page: Page) => {
    const views = ['list', 'kanban', 'analytics', 'calendar', 'timeline'];
    const iterations = 20; // Rapid switching
    
    // 1. Rapid view switching
    for (let i = 0; i < iterations; i++) {
      for (const view of views) {
        // Click on view button
        const viewSelector = `[data-testid="view-${view}"], button:has-text("${view}"), [aria-label="${view} view"]`;
        const viewButton = await page.$(viewSelector);
        
        if (viewButton) {
          await viewButton.click();
          
          // Wait for view to render
          await page.waitForSelector(`[data-view="${view}"], [data-testid="${view}-view"]`, { 
            timeout: 5000 
          }).catch(() => {
            // Fallback: just wait a bit
            return page.waitForTimeout(500);
          });
          
          // Interact with the view to trigger more potential leaks
          await this.interactWithView(page, view);
        }
      }
    }
    
    // 2. Open and close modals/dialogs
    for (let i = 0; i < 10; i++) {
      // Open task creation modal
      const createButton = await page.$('[data-testid="create-task-button"], button:has-text("Create")');
      if (createButton) {
        await createButton.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 2000 });
        
        // Close without saving
        const closeButton = await page.$('[aria-label="Close"], button:has-text("Cancel")');
        if (closeButton) {
          await closeButton.click();
        } else {
          // Press Escape
          await page.keyboard.press('Escape');
        }
        
        await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 2000 }).catch(() => {});
      }
    }
    
    // 3. Trigger animations and transitions
    await page.evaluate(() => {
      // Force all animations to run
      document.querySelectorAll('*').forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.animation = 'none';
          el.offsetHeight; // Trigger reflow
          el.style.animation = '';
        }
      });
    });
  },
  
  back: async (page: Page) => {
    // Reset to initial view
    const listViewButton = await page.$('[data-testid="view-list"], button:has-text("list")');
    if (listViewButton) {
      await listViewButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Clear test data
    await page.evaluate(() => {
      delete (window as any).__MEMLAB_TEST_TASKS__;
      
      // Force cleanup of any remaining event listeners
      const events = (window as any).__memlab_event_listeners;
      if (events && Array.isArray(events)) {
        events.forEach((listener: any) => {
          if (listener.element && listener.event && listener.handler) {
            listener.element.removeEventListener(listener.event, listener.handler);
          }
        });
      }
      
      // Force garbage collection
      if ((window as any).gc) {
        (window as any).gc();
      }
    });
  },
  
  // Helper method to interact with different views
  interactWithView: async (page: Page, view: string) => {
    switch (view) {
      case 'list':
        // Scroll the list
        await page.evaluate(() => {
          const list = document.querySelector('[data-testid="task-list"], .task-list');
          if (list) {
            list.scrollTop = list.scrollHeight / 2;
          }
        });
        break;
        
      case 'kanban':
        // Simulate drag and drop
        const firstCard = await page.$('[data-testid*="task-card"]:first-child');
        if (firstCard) {
          const box = await firstCard.boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + 200, box.y);
            await page.mouse.up();
          }
        }
        break;
        
      case 'analytics':
        // Hover over chart elements
        const chartElements = await page.$$('[data-testid*="chart"], .chart-container svg *');
        for (let i = 0; i < Math.min(chartElements.length, 5); i++) {
          const box = await chartElements[i].boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.waitForTimeout(100);
          }
        }
        break;
        
      case 'calendar':
        // Click on different dates
        const dateElements = await page.$$('[data-testid*="calendar-day"], .calendar-day');
        for (let i = 0; i < Math.min(dateElements.length, 5); i++) {
          await dateElements[i].click();
          await page.waitForTimeout(100);
        }
        break;
        
      case 'timeline':
        // Scroll timeline
        await page.evaluate(() => {
          const timeline = document.querySelector('[data-testid="timeline"], .timeline-container');
          if (timeline) {
            timeline.scrollLeft = timeline.scrollWidth / 2;
          }
        });
        break;
    }
  },
  
  // Define what constitutes a memory leak for view switching
  leakFilter: (node: any, _snapshot: any, _leakedNodeIds: Set<number>) => {
    // Check for detached React Fiber nodes
    if (node.name && node.name.includes('FiberNode') && node.retainedSize > 5000) {
      return true;
    }
    
    // Check for detached DOM elements from previous views
    if (node.name && node.name.includes('Detached') && node.name.includes('Element')) {
      return true;
    }
    
    // Check for animation/transition related leaks
    if (node.name && (node.name.includes('Animation') || node.name.includes('Transition'))) {
      return true;
    }
    
    // Check for uncleaned event listeners
    if (node.name && node.name.includes('EventListener')) {
      return true;
    }
    
    // Check for retained view state
    if (node.name && node.name.includes('ViewState') && node.retainedSize > 10000) {
      return true;
    }
    
    return false;
  }
};

export default scenario;