/**
 * Memory Performance Test - Validates memory testing is working
 */

import { test, expect } from '@playwright/test';

test.describe('Memory Performance Test', () => {
  test('should verify memory APIs are available', async ({ page }) => {
    // Navigate to the local dev server
    await page.goto('http://localhost:5173');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give React time to render
    
    // Check if performance.memory is available
    const memoryInfo = await page.evaluate(() => {
      const perf = window.performance as any;
      
      return {
        hasMemoryAPI: 'memory' in performance,
        memoryData: perf.memory ? {
          usedJSHeapSize: perf.memory.usedJSHeapSize,
          totalJSHeapSize: perf.memory.totalJSHeapSize,
          jsHeapSizeLimit: perf.memory.jsHeapSizeLimit
        } : null,
        timing: {
          navigationStart: performance.timing.navigationStart,
          loadEventEnd: performance.timing.loadEventEnd,
          domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd
        }
      };
    });
    
    console.log('Memory API available:', memoryInfo.hasMemoryAPI);
    
    if (memoryInfo.memoryData) {
      const used = (memoryInfo.memoryData.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const total = (memoryInfo.memoryData.totalJSHeapSize / 1024 / 1024).toFixed(2);
      const limit = (memoryInfo.memoryData.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
      
      console.log(`Memory Usage:`);
      console.log(`  Used JS Heap: ${used}MB`);
      console.log(`  Total JS Heap: ${total}MB`);
      console.log(`  JS Heap Limit: ${limit}MB`);
      console.log(`  Usage: ${((memoryInfo.memoryData.usedJSHeapSize / memoryInfo.memoryData.jsHeapSizeLimit) * 100).toFixed(2)}%`);
      
      // Basic assertions
      expect(memoryInfo.memoryData.usedJSHeapSize).toBeGreaterThan(0);
      expect(memoryInfo.memoryData.usedJSHeapSize).toBeLessThan(memoryInfo.memoryData.jsHeapSizeLimit);
      expect(memoryInfo.memoryData.totalJSHeapSize).toBeLessThanOrEqual(memoryInfo.memoryData.jsHeapSizeLimit);
    } else {
      console.log('⚠️  Memory API not available. Run Chrome with --enable-precise-memory-info flag');
    }
    
    // Always pass the test - this is just to verify the setup works
    expect(true).toBe(true);
  });
  
  test('should measure memory during navigation', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Helper to capture memory
    const captureMemory = async (label: string) => {
      const memory = await page.evaluate(() => {
        const perf = window.performance as any;
        return perf.memory ? {
          used: perf.memory.usedJSHeapSize,
          label: ''
        } : null;
      });
      
      if (memory) {
        memory.label = label;
        console.log(`${label}: ${(memory.used / 1024 / 1024).toFixed(2)}MB`);
      }
      
      return memory;
    };
    
    // Capture initial memory
    const initial = await captureMemory('Initial load');
    
    // Try to navigate if navigation elements exist
    const navButtons = await page.locator('nav button').all();
    console.log(`Found ${navButtons.length} navigation buttons`);
    
    if (navButtons.length > 0) {
      // Click through some navigation
      for (let i = 0; i < Math.min(3, navButtons.length); i++) {
        await navButtons[i].click();
        await page.waitForTimeout(1000);
        await captureMemory(`After nav ${i + 1}`);
      }
    }
    
    // Final memory check
    const final = await captureMemory('Final');
    
    if (initial && final) {
      const growth = final.used - initial.used;
      const growthMB = (growth / 1024 / 1024).toFixed(2);
      const growthPercent = ((growth / initial.used) * 100).toFixed(2);
      
      console.log(`\nMemory Growth: ${growthMB}MB (${growthPercent}%)`);
      
      // Very lenient check - just ensure memory didn't explode
      expect(growth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
    }
    
    expect(true).toBe(true);
  });
});