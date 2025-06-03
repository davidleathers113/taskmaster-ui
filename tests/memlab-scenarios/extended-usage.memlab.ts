/**
 * MemLab Scenario: Extended Usage Memory Leak Detection
 * 
 * This scenario simulates extended application usage patterns:
 * - Long-running sessions
 * - Repeated operations
 * - WebSocket connections
 * - Store state accumulation
 */

import { Page } from 'puppeteer';
import { IScenario } from '@memlab/api';

const scenario: IScenario = {
  setup: async (page: Page) => {
    // Set up performance observer
    await page.evaluateOnNewDocument(() => {
      (window as any).__memlab_performance_entries = [];
      
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).__memlab_performance_entries.push({
            name: entry.name,
            type: entry.entryType,
            duration: entry.duration,
            startTime: entry.startTime
          });
        }
      });
      
      observer.observe({ entryTypes: ['measure', 'navigation', 'resource', 'longtask'] });
    });
    
    // Navigate to application
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.waitForSelector('[data-testid="app-ready"], .app-container', { timeout: 15000 });
    
    // Set up WebSocket monitoring
    await page.evaluate(() => {
      const originalWebSocket = window.WebSocket;
      (window as any).__memlab_websockets = [];
      
      window.WebSocket = class extends originalWebSocket {
        constructor(url: string, protocols?: string | string[]) {
          super(url, protocols);
          (window as any).__memlab_websockets.push(this);
        }
      };
    });
  },
  
  action: async (page: Page) => {
    // Simulate a 2-minute extended usage session
    const sessionDuration = 120000; // 2 minutes
    const startTime = Date.now();
    let operationCount = 0;
    
    while (Date.now() - startTime < sessionDuration) {
      operationCount++;
      
      // 1. Create and update tasks continuously
      if (operationCount % 5 === 0) {
        await this.createAndUpdateTasks(page, 5);
      }
      
      // 2. Perform search and filter operations
      if (operationCount % 3 === 0) {
        await this.performSearchOperations(page);
      }
      
      // 3. Switch views
      if (operationCount % 7 === 0) {
        await this.switchRandomView(page);
      }
      
      // 4. Open and close detail panels
      if (operationCount % 4 === 0) {
        await this.openTaskDetails(page);
      }
      
      // 5. Trigger store updates
      if (operationCount % 6 === 0) {
        await this.triggerStoreOperations(page);
      }
      
      // 6. Check WebSocket connections
      if (operationCount % 10 === 0) {
        await this.checkWebSocketStatus(page);
      }
      
      // Small delay between operations
      await page.waitForTimeout(500);
    }
    
    // Log session statistics
    const stats = await page.evaluate(() => {
      return {
        websockets: (window as any).__memlab_websockets?.length || 0,
        performanceEntries: (window as any).__memlab_performance_entries?.length || 0,
        memory: (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize
        } : null
      };
    });
    
    console.log('Extended usage session stats:', stats);
  },
  
  back: async (page: Page) => {
    // Clean up WebSocket connections
    await page.evaluate(() => {
      const websockets = (window as any).__memlab_websockets || [];
      websockets.forEach((ws: WebSocket) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    });
    
    // Reset to initial state
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Force cleanup
    await page.evaluate(() => {
      // Clear any accumulated state
      if ((window as any).taskStore) {
        const store = (window as any).taskStore.getState();
        if (store.clearAll) {
          store.clearAll();
        }
      }
      
      // Clear performance entries
      delete (window as any).__memlab_performance_entries;
      
      // Force GC
      if ((window as any).gc) {
        (window as any).gc();
      }
    });
  },
  
  // Helper methods
  createAndUpdateTasks: async (page: Page, count: number) => {
    for (let i = 0; i < count; i++) {
      await page.evaluate((index) => {
        // Direct store manipulation for faster testing
        if ((window as any).taskStore) {
          const store = (window as any).taskStore.getState();
          const task = {
            id: `extended-${Date.now()}-${index}`,
            title: `Extended Test Task ${index}`,
            description: `Task created during extended usage testing at ${new Date().toISOString()}`,
            status: 'pending',
            priority: 'medium',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          if (store.addTask) {
            store.addTask(task);
          }
          
          // Update random existing task
          const tasks = store.tasks || [];
          if (tasks.length > 0 && store.updateTask) {
            const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
            store.updateTask(randomTask.id, {
              updatedAt: new Date().toISOString(),
              description: randomTask.description + ' [Updated]'
            });
          }
        }
      }, i);
    }
  },
  
  performSearchOperations: async (page: Page) => {
    const searchInput = await page.$('input[type="search"], input[placeholder*="Search"]');
    if (searchInput) {
      const searchTerms = ['task', 'extended', 'test', 'memory', 'leak'];
      const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
      
      await searchInput.click({ clickCount: 3 });
      await searchInput.type(term);
      await page.waitForTimeout(300); // Debounce
      
      // Clear search
      await searchInput.click({ clickCount: 3 });
      await searchInput.press('Delete');
    }
  },
  
  switchRandomView: async (page: Page) => {
    const views = ['list', 'kanban', 'analytics'];
    const view = views[Math.floor(Math.random() * views.length)];
    
    const viewButton = await page.$(`[data-testid="view-${view}"]`);
    if (viewButton) {
      await viewButton.click();
      await page.waitForTimeout(500);
    }
  },
  
  openTaskDetails: async (page: Page) => {
    const taskCards = await page.$$('[data-testid*="task-card"], .task-item');
    if (taskCards.length > 0) {
      const randomCard = taskCards[Math.floor(Math.random() * Math.min(taskCards.length, 10))];
      await randomCard.click();
      
      // Wait for detail panel
      await page.waitForSelector('[data-testid="task-detail"], .task-detail-panel', { 
        timeout: 2000 
      }).catch(() => {});
      
      // Close detail panel
      const closeButton = await page.$('[data-testid="close-detail"], [aria-label="Close"]');
      if (closeButton) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  },
  
  triggerStoreOperations: async (page: Page) => {
    await page.evaluate(() => {
      if ((window as any).taskStore) {
        const store = (window as any).taskStore.getState();
        
        // Trigger various store operations
        if (store.setFilter) store.setFilter({ status: 'pending' });
        if (store.setSortBy) store.setSortBy('createdAt');
        if (store.setViewMode) store.setViewMode('list');
        
        // Reset filters
        setTimeout(() => {
          if (store.clearFilters) store.clearFilters();
        }, 200);
      }
    });
  },
  
  checkWebSocketStatus: async (page: Page) => {
    const wsStatus = await page.evaluate(() => {
      const websockets = (window as any).__memlab_websockets || [];
      return websockets.map((ws: WebSocket) => ({
        readyState: ws.readyState,
        url: ws.url,
        bufferedAmount: ws.bufferedAmount
      }));
    });
    
    // Log if there are potential issues
    const openConnections = wsStatus.filter(ws => ws.readyState === 1).length;
    if (openConnections > 5) {
      console.warn(`High number of open WebSocket connections: ${openConnections}`);
    }
  },
  
  // Leak detection specific to extended usage
  leakFilter: (node: any, _snapshot: any, _leakedNodeIds: Set<number>) => {
    // Check for accumulated store state
    if (node.name && node.name.includes('Store') && node.retainedSize > 100000) {
      return true;
    }
    
    // Check for WebSocket related leaks
    if (node.name && node.name.includes('WebSocket')) {
      return true;
    }
    
    // Check for accumulated event listeners
    if (node.type === 'Array' && node.name && node.name.includes('listeners') && node.retainedSize > 50000) {
      return true;
    }
    
    // Check for accumulated performance entries
    if (node.name && node.name.includes('PerformanceEntry') && node.retainedSize > 10000) {
      return true;
    }
    
    // Check for task accumulation
    if (node.name && node.name.includes('Task') && node.type === 'Array' && node.retainedSize > 500000) {
      return true;
    }
    
    return false;
  }
};

export default scenario;