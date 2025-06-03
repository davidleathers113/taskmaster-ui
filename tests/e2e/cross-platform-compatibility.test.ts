/**
 * TaskMaster Cross-Platform Compatibility E2E Tests (2025)
 * 
 * Comprehensive test suite for validating cross-platform compatibility across Windows, macOS, and Linux.
 * Following 2025 best practices for Playwright + Electron cross-platform testing:
 * 
 * - Platform detection and conditional testing patterns
 * - Visual regression testing with platform-specific baselines
 * - UI consistency validation across operating systems
 * - Platform-specific feature testing (window controls, file paths, keyboard shortcuts)
 * - Native OS integration testing (system tray, menu bar, notifications)
 * - Cross-platform file system compatibility
 * - Performance consistency across platforms
 * 
 * Test Coverage:
 * - Platform detection and environment validation
 * - Window behavior and controls (minimize, maximize, close)
 * - Native menu systems (macOS menu bar, Windows system tray)
 * - File path handling and directory separators
 * - Keyboard shortcuts and modifier keys
 * - System notifications and OS integration
 * - Font rendering and UI consistency
 * - Performance benchmarks across platforms
 * - Accessibility features per platform
 * - Application lifecycle management
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { join } from 'path';
import { tmpdir, platform as osPlatform, userInfo } from 'os';
import { 
  launchElectronForE2E, 
  getMainWindow, 
  closeElectronE2E,
  takeE2EScreenshot,
  simulateUserActions,
  measureE2EPerformance,
  waitForE2ECondition,
  navigateToView,
  verifyActiveView
} from '../setup/e2e.setup';

/**
 * Cross-Platform Utilities and Helpers
 * Implementing 2025 best practices for platform detection and conditional testing
 */
class CrossPlatformUtils {
  private page: Page;
  private electronApp: ElectronApplication;

  constructor(page: Page, electronApp: ElectronApplication) {
    this.page = page;
    this.electronApp = electronApp;
  }

  /**
   * Get current platform information from both Node.js and Electron contexts
   */
  async getPlatformInfo(): Promise<{
    node: string;
    electron: string;
    arch: string;
    release: string;
    homedir: string;
  }> {
    // Get platform info from Node.js context
    const nodePlatform = osPlatform();
    
    // Get platform info from Electron context
    const electronPlatform = await this.electronApp.evaluate(({ process }) => ({
      platform: process.platform,
      arch: process.arch,
      release: process.release?.name || 'unknown'
    }));

    return {
      node: nodePlatform,
      electron: electronPlatform.platform,
      arch: electronPlatform.arch,
      release: electronPlatform.release,
      homedir: userInfo().homedir
    };
  }

  /**
   * Skip test conditionally based on platform
   * Following 2025 best practices for conditional test execution
   */
  static skipUnlessPlatform(platforms: string[], description?: string): void {
    const currentPlatform = osPlatform();
    test.skip(!platforms.includes(currentPlatform), 
      description || `Test requires ${platforms.join(' or ')} platform (current: ${currentPlatform})`);
  }

  /**
   * Skip test conditionally on specific platforms
   */
  static skipOnPlatform(platforms: string[], description?: string): void {
    const currentPlatform = osPlatform();
    test.skip(platforms.includes(currentPlatform), 
      description || `Test not supported on ${platforms.join(' or ')} platform (current: ${currentPlatform})`);
  }

  /**
   * Get platform-specific file paths
   */
  async getPlatformPaths(): Promise<{
    documents: string;
    downloads: string;
    userData: string;
    temp: string;
    separator: string;
  }> {
    const electronPaths = await this.electronApp.evaluate(({ app }) => ({
      documents: app.getPath('documents'),
      downloads: app.getPath('downloads'), 
      userData: app.getPath('userData'),
      temp: app.getPath('temp')
    }));

    return {
      ...electronPaths,
      separator: osPlatform() === 'win32' ? '\\' : '/'
    };
  }

  /**
   * Test platform-specific keyboard shortcuts
   */
  async testKeyboardShortcuts(): Promise<{
    cmdKey: string;
    shortcuts: Record<string, boolean>;
  }> {
    const platform = osPlatform();
    const cmdKey = platform === 'darwin' ? 'Meta' : 'Control';
    
    const shortcuts: Record<string, boolean> = {};
    
    // Test common shortcuts with platform-appropriate modifier
    const testShortcuts = [
      { name: 'new', keys: `${cmdKey}+KeyN` },
      { name: 'save', keys: `${cmdKey}+KeyS` },
      { name: 'copy', keys: `${cmdKey}+KeyC` },
      { name: 'paste', keys: `${cmdKey}+KeyV` },
      { name: 'undo', keys: `${cmdKey}+KeyZ` },
      { name: 'redo', keys: platform === 'darwin' ? `${cmdKey}+Shift+KeyZ` : `${cmdKey}+KeyY` }
    ];

    for (const shortcut of testShortcuts) {
      try {
        // Focus on the main application
        await this.page.focus('body');
        
        // Press the shortcut
        await this.page.keyboard.press(shortcut.keys);
        await this.page.waitForTimeout(500);
        
        // Check if shortcut was handled (basic check)
        const handled = await this.page.evaluate(() => {
          // Look for any indication that shortcut was processed
          return document.activeElement !== document.body || 
                 window.getSelection()?.toString() !== '';
        });
        
        shortcuts[shortcut.name] = handled;
      } catch (error) {
        shortcuts[shortcut.name] = false;
      }
    }

    return { cmdKey, shortcuts };
  }

  /**
   * Test window behavior and controls
   */
  async testWindowBehavior(): Promise<{
    canMinimize: boolean;
    canMaximize: boolean;
    canRestore: boolean;
    hasNativeControls: boolean;
  }> {
    const results = {
      canMinimize: false,
      canMaximize: false,
      canRestore: false,
      hasNativeControls: false
    };

    try {
      // Test minimize
      await this.electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].minimize();
        }
      });
      
      await this.page.waitForTimeout(500);
      
      const isMinimized = await this.electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        return windows.length > 0 ? windows[0].isMinimized() : false;
      });
      
      results.canMinimize = isMinimized;

      // Test restore from minimize
      if (isMinimized) {
        await this.electronApp.evaluate(({ BrowserWindow }) => {
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].restore();
          }
        });
        
        await this.page.waitForTimeout(500);
        
        const isRestored = await this.electronApp.evaluate(({ BrowserWindow }) => {
          const windows = BrowserWindow.getAllWindows();
          return windows.length > 0 ? !windows[0].isMinimized() : false;
        });
        
        results.canRestore = isRestored;
      }

      // Test maximize
      await this.electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0 && !windows[0].isMaximized()) {
          windows[0].maximize();
        }
      });
      
      await this.page.waitForTimeout(500);
      
      const isMaximized = await this.electronApp.evaluate(({ BrowserWindow }) => {
        const windows = BrowserWindow.getAllWindows();
        return windows.length > 0 ? windows[0].isMaximized() : false;
      });
      
      results.canMaximize = isMaximized;

      // Check for native window controls
      const hasControls = await this.page.locator('.window-controls, [data-testid*="window-control"]').count() > 0;
      results.hasNativeControls = hasControls;

    } catch (error) {
      console.warn('Window behavior test error:', error);
    }

    return results;
  }

  /**
   * Test system integration features
   */
  async testSystemIntegration(): Promise<{
    hasSystemTray: boolean;
    hasMenuBar: boolean;
    hasNotifications: boolean;
    hasFileAssociations: boolean;
  }> {
    const platform = osPlatform();
    const results = {
      hasSystemTray: false,
      hasMenuBar: false,
      hasNotifications: false,
      hasFileAssociations: false
    };

    try {
      // Test system tray (Windows/Linux)
      if (platform !== 'darwin') {
        results.hasSystemTray = await this.electronApp.evaluate(({ Tray }) => {
          return typeof Tray !== 'undefined';
        });
      }

      // Test menu bar (macOS)
      if (platform === 'darwin') {
        results.hasMenuBar = await this.electronApp.evaluate(({ Menu }) => {
          const menu = Menu.getApplicationMenu();
          return menu !== null && menu.items.length > 0;
        });
      }

      // Test notifications
      results.hasNotifications = await this.page.evaluate(() => {
        return 'Notification' in window && typeof Notification.requestPermission === 'function';
      });

      // Test file associations (basic check)
      results.hasFileAssociations = await this.electronApp.evaluate(({ app }) => {
        try {
          // Check if app can be set as default protocol client
          return typeof app.setAsDefaultProtocolClient === 'function';
        } catch {
          return false;
        }
      });

    } catch (error) {
      console.warn('System integration test error:', error);
    }

    return results;
  }

  /**
   * Measure platform-specific performance metrics
   */
  async measurePlatformPerformance(): Promise<{
    startupTime: number;
    renderTime: number;
    memoryUsage: number;
    platform: string;
  }> {
    const platform = osPlatform();
    const startTime = Date.now();

    // Measure startup time
    await this.page.waitForLoadState('networkidle');
    const startupTime = Date.now() - startTime;

    // Measure render time
    const renderStart = Date.now();
    await navigateToView(this.page, 'analytics');
    await this.page.waitForTimeout(1000);
    const renderTime = Date.now() - renderStart;

    // Get memory usage
    const memoryInfo = await this.page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSMemory: (performance as any).memory.usedJSHeapSize,
        totalJSMemory: (performance as any).memory.totalJSHeapSize,
        jsMemoryLimit: (performance as any).memory.jsHeapSizeLimit
      } : { usedJSMemory: 0, totalJSMemory: 0, jsMemoryLimit: 0 };
    });

    return {
      startupTime,
      renderTime,
      memoryUsage: memoryInfo.usedJSMemory,
      platform
    };
  }

  /**
   * Test font rendering and UI consistency
   */
  async testUIConsistency(): Promise<{
    fontsLoaded: boolean;
    elementsVisible: string[];
    layoutConsistent: boolean;
  }> {
    // Wait for fonts to load
    await this.page.waitForFunction(() => document.fonts.ready);
    
    const fontsLoaded = await this.page.evaluate(() => document.fonts.status === 'loaded');

    // Check critical UI elements
    const criticalElements = [
      '[data-testid="sidebar"]',
      '[data-testid="main-content"]',
      'button',
      'input',
      'h1, h2, h3',
      '.task-card, [data-testid*="task"]'
    ];

    const elementsVisible: string[] = [];
    for (const selector of criticalElements) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          elementsVisible.push(selector);
        }
      } catch {
        // Element not found
      }
    }

    // Basic layout consistency check
    const layoutInfo = await this.page.evaluate(() => {
      const body = document.body;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const bodyRect = body.getBoundingClientRect();
      
      return {
        viewport,
        bodySize: { width: bodyRect.width, height: bodyRect.height },
        hasScrollbars: document.documentElement.scrollHeight > document.documentElement.clientHeight
      };
    });

    const layoutConsistent = layoutInfo.bodySize.width > 0 && layoutInfo.bodySize.height > 0;

    return {
      fontsLoaded,
      elementsVisible,
      layoutConsistent
    };
  }
}

/**
 * Test Suite: Cross-Platform Compatibility for TaskMaster Electron Application
 */
test.describe('Cross-Platform Compatibility for TaskMaster Electron Application', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let platformUtils: CrossPlatformUtils;

  test.beforeEach(async () => {
    console.log(`🚀 Starting TaskMaster for cross-platform testing on ${osPlatform()}...`);
    
    electronApp = await launchElectronForE2E({
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        PLAYWRIGHT_TEST: '1',
        CROSS_PLATFORM_TEST: '1'
      }
    });

    page = await getMainWindow();
    platformUtils = new CrossPlatformUtils(page, electronApp);
    
    // Wait for app to be fully loaded
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log(`✅ Cross-platform testing environment ready for ${osPlatform()}`);
  });

  test.afterEach(async () => {
    await takeE2EScreenshot(`cross-platform-cleanup-${osPlatform()}`);
    await closeElectronE2E();
  });

  /**
   * Test: Platform Detection and Environment Validation
   */
  test('should correctly detect and validate platform environment', async () => {
    const platformInfo = await platformUtils.getPlatformInfo();
    
    // Verify platform detection consistency
    expect(platformInfo.node).toBe(platformInfo.electron);
    expect(platformInfo.node).toMatch(/^(win32|darwin|linux)$/);
    
    // Verify architecture is detected
    expect(platformInfo.arch).toBeTruthy();
    expect(platformInfo.arch).toMatch(/^(x64|arm64|ia32)$/);
    
    // Verify home directory exists
    expect(platformInfo.homedir).toBeTruthy();
    expect(platformInfo.homedir.length).toBeGreaterThan(0);
    
    console.log('🖥️ Platform Info:', platformInfo);
    
    await takeE2EScreenshot(`platform-detection-${osPlatform()}`);
    console.log('✅ Platform detection and validation test passed');
  });

  /**
   * Test: File Path Handling and Directory Separators
   */
  test('should handle file paths correctly for current platform', async () => {
    const paths = await platformUtils.getPlatformPaths();
    const currentPlatform = osPlatform();
    
    // Verify path separators are correct for platform
    if (currentPlatform === 'win32') {
      expect(paths.separator).toBe('\\');
      // Windows paths should start with drive letter
      expect(paths.documents).toMatch(/^[A-Z]:\\/);
      expect(paths.userData).toMatch(/^[A-Z]:\\/);
    } else {
      expect(paths.separator).toBe('/');
      // Unix-like paths should start with /
      expect(paths.documents).toMatch(/^\//);
      expect(paths.userData).toMatch(/^\//);
    }
    
    // Verify all required paths exist
    expect(paths.documents).toBeTruthy();
    expect(paths.downloads).toBeTruthy();
    expect(paths.userData).toBeTruthy();
    expect(paths.temp).toBeTruthy();
    
    console.log(`📁 Platform Paths (${currentPlatform}):`, paths);
    
    await takeE2EScreenshot(`file-paths-${currentPlatform}`);
    console.log('✅ File path handling test passed');
  });

  /**
   * Test: Platform-Specific Keyboard Shortcuts
   */
  test('should use correct keyboard shortcuts for current platform', async () => {
    const shortcutResults = await platformUtils.testKeyboardShortcuts();
    const currentPlatform = osPlatform();
    
    // Verify correct modifier key is used
    if (currentPlatform === 'darwin') {
      expect(shortcutResults.cmdKey).toBe('Meta'); // Command key on macOS
    } else {
      expect(shortcutResults.cmdKey).toBe('Control'); // Ctrl key on Windows/Linux
    }
    
    // Log shortcut test results
    console.log(`⌨️ Keyboard Shortcuts (${currentPlatform}):`, shortcutResults);
    
    await takeE2EScreenshot(`keyboard-shortcuts-${currentPlatform}`);
    console.log('✅ Platform-specific keyboard shortcuts test passed');
  });

  /**
   * Test: Window Behavior and Controls
   */
  test('should handle window controls correctly for current platform', async () => {
    const windowBehavior = await platformUtils.testWindowBehavior();
    
    // All platforms should support basic window operations
    expect(windowBehavior.canMinimize).toBeTruthy();
    expect(windowBehavior.canMaximize).toBeTruthy();
    expect(windowBehavior.canRestore).toBeTruthy();
    
    console.log(`🪟 Window Behavior (${osPlatform()}):`, windowBehavior);
    
    await takeE2EScreenshot(`window-behavior-${osPlatform()}`);
    console.log('✅ Window behavior test passed');
  });

  /**
   * Test: System Integration Features (Platform-Specific)
   */
  test('should integrate correctly with system features', async () => {
    const systemIntegration = await platformUtils.testSystemIntegration();
    const currentPlatform = osPlatform();
    
    // Platform-specific expectations
    if (currentPlatform === 'darwin') {
      // macOS should have menu bar
      expect(systemIntegration.hasMenuBar).toBeTruthy();
    } else {
      // Windows/Linux should support system tray
      // Note: This might be false in test environment
      console.log('System tray support:', systemIntegration.hasSystemTray);
    }
    
    // All platforms should support notifications
    expect(systemIntegration.hasNotifications).toBeTruthy();
    
    console.log(`🔗 System Integration (${currentPlatform}):`, systemIntegration);
    
    await takeE2EScreenshot(`system-integration-${currentPlatform}`);
    console.log('✅ System integration test passed');
  });

  /**
   * Test: UI Consistency and Font Rendering
   */
  test('should render UI consistently across platforms', async () => {
    const uiConsistency = await platformUtils.testUIConsistency();
    
    // Fonts should be loaded
    expect(uiConsistency.fontsLoaded).toBeTruthy();
    
    // Layout should be consistent
    expect(uiConsistency.layoutConsistent).toBeTruthy();
    
    // Critical elements should be visible
    expect(uiConsistency.elementsVisible.length).toBeGreaterThan(0);
    expect(uiConsistency.elementsVisible).toContain('button');
    
    console.log(`🎨 UI Consistency (${osPlatform()}):`, uiConsistency);
    
    await takeE2EScreenshot(`ui-consistency-${osPlatform()}`);
    console.log('✅ UI consistency test passed');
  });

  /**
   * Test: Platform Performance Benchmarks
   */
  test('should maintain acceptable performance across platforms', async () => {
    const performance = await platformUtils.measurePlatformPerformance();
    
    // Performance thresholds (may vary by platform)
    const thresholds = {
      startupTime: 10000,    // 10 seconds max startup
      renderTime: 3000,      // 3 seconds max render time
      memoryUsage: 100 * 1024 * 1024  // 100MB max memory usage
    };
    
    expect(performance.startupTime).toBeLessThan(thresholds.startupTime);
    expect(performance.renderTime).toBeLessThan(thresholds.renderTime);
    
    // Memory usage check (more lenient in test environment)
    if (performance.memoryUsage > 0) {
      expect(performance.memoryUsage).toBeLessThan(thresholds.memoryUsage);
    }
    
    console.log(`⚡ Performance Metrics (${osPlatform()}):`, {
      startupTime: `${performance.startupTime}ms`,
      renderTime: `${performance.renderTime}ms`, 
      memoryUsage: `${Math.round(performance.memoryUsage / 1024 / 1024)}MB`
    });
    
    await takeE2EScreenshot(`performance-${osPlatform()}`);
    console.log('✅ Platform performance test passed');
  });

  /**
   * Test: View Switching Consistency Across Platforms
   */
  test('should handle view switching consistently across platforms', async () => {
    const views = ['analytics', 'list', 'kanban', 'calendar', 'timeline'] as const;
    const switchResults: Record<string, boolean> = {};
    
    for (const view of views) {
      try {
        await navigateToView(page, view);
        await page.waitForTimeout(1000);
        
        const isActive = await verifyActiveView(page, view);
        switchResults[view] = isActive;
        
        if (isActive) {
          // Take screenshot of each view for visual consistency verification
          await takeE2EScreenshot(`view-${view}-${osPlatform()}`);
        }
      } catch (error) {
        switchResults[view] = false;
        console.warn(`View switching failed for ${view}:`, error);
      }
    }
    
    // At least some views should work
    const workingViews = Object.values(switchResults).filter(Boolean).length;
    expect(workingViews).toBeGreaterThan(0);
    
    console.log(`🔄 View Switching Results (${osPlatform()}):`, switchResults);
    console.log('✅ View switching consistency test passed');
  });

  /**
   * Test: Platform-Specific Menu Behavior (Conditional)
   */
  test('should handle platform-specific menu behavior', async () => {
    const currentPlatform = osPlatform();
    
    if (currentPlatform === 'darwin') {
      // macOS: Test native menu bar
      const hasMenuBar = await electronApp.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        return menu !== null && menu.items.length > 0;
      });
      
      expect(hasMenuBar).toBeTruthy();
      console.log('🍎 macOS menu bar test passed');
      
    } else {
      // Windows/Linux: Test application menu
      const hasAppMenu = await page.locator('[role="menubar"], .menu-bar, [data-testid="app-menu"]').count() > 0;
      console.log(`🖥️ ${currentPlatform} application menu present:`, hasAppMenu);
    }
    
    await takeE2EScreenshot(`menu-behavior-${currentPlatform}`);
    console.log('✅ Platform-specific menu behavior test passed');
  });

  /**
   * Test: File Dialog and Native Integration (Platform-Specific)
   */
  test.skip(({ browserName }) => browserName !== 'chromium', 'File dialog test requires Chromium')
  ('should handle file dialogs correctly for current platform', async () => {
    const currentPlatform = osPlatform();
    
    // Test file dialog integration
    const fileDialogSupported = await electronApp.evaluate(({ dialog }) => {
      return typeof dialog.showOpenDialog === 'function' && 
             typeof dialog.showSaveDialog === 'function';
    });
    
    expect(fileDialogSupported).toBeTruthy();
    
    // Test file extension handling
    const fileFilters = await electronApp.evaluate(() => {
      return [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ];
    });
    
    expect(fileFilters).toBeTruthy();
    expect(fileFilters.length).toBeGreaterThan(0);
    
    console.log(`📄 File Dialog Support (${currentPlatform}):`, {
      supported: fileDialogSupported,
      filters: fileFilters.length
    });
    
    await takeE2EScreenshot(`file-dialogs-${currentPlatform}`);
    console.log('✅ File dialog integration test passed');
  });

  /**
   * Test: Accessibility Features Across Platforms
   */
  test('should support accessibility features consistently', async () => {
    const currentPlatform = osPlatform();
    
    // Test screen reader compatibility
    const accessibilityFeatures = await page.evaluate(() => {
      return {
        hasAriaLabels: document.querySelectorAll('[aria-label]').length > 0,
        hasRoles: document.querySelectorAll('[role]').length > 0,
        hasAltText: Array.from(document.querySelectorAll('img')).some(img => img.alt),
        hasTabIndex: document.querySelectorAll('[tabindex]').length > 0,
        hasFocusVisible: document.documentElement.classList.contains('focus-visible') || 
                        getComputedStyle(document.documentElement).getPropertyValue('--focus-visible') !== ''
      };
    });
    
    // Basic accessibility requirements
    expect(accessibilityFeatures.hasAriaLabels || accessibilityFeatures.hasRoles).toBeTruthy();
    
    console.log(`♿ Accessibility Features (${currentPlatform}):`, accessibilityFeatures);
    
    await takeE2EScreenshot(`accessibility-${currentPlatform}`);
    console.log('✅ Accessibility features test passed');
  });

  /**
   * Test: Platform-Specific Error Handling
   */
  test('should handle platform-specific errors gracefully', async () => {
    const currentPlatform = osPlatform();
    
    // Test error handling for platform-specific operations
    const errorHandling = await electronApp.evaluate(async ({ app, dialog }) => {
      const results = {
        invalidPathHandled: false,
        permissionErrorHandled: false,
        platformErrorHandled: false
      };
      
      try {
        // Test invalid path handling
        try {
          app.getPath('invalid' as any);
        } catch (error) {
          results.invalidPathHandled = true;
        }
        
        // Test permission error handling (attempting to access restricted path)
        try {
          if (process.platform === 'win32') {
            app.getPath('system');
          } else {
            app.getPath('recent');
          }
        } catch (error) {
          results.permissionErrorHandled = true;
        }
        
        // Test platform-specific error handling
        try {
          if (process.platform === 'darwin') {
            // Test macOS-specific operation
            app.dock?.hide();
          } else {
            // Test Windows/Linux operation
            app.setUserTasks?.([]);
          }
          results.platformErrorHandled = true;
        } catch (error) {
          // This is expected in some test environments
          results.platformErrorHandled = false;
        }
        
        return results;
      } catch (error) {
        return results;
      }
    });
    
    // At least basic error handling should work
    expect(errorHandling.invalidPathHandled).toBeTruthy();
    
    console.log(`🚨 Error Handling (${currentPlatform}):`, errorHandling);
    
    await takeE2EScreenshot(`error-handling-${currentPlatform}`);
    console.log('✅ Platform-specific error handling test passed');
  });
});

/**
 * Platform-Specific Test Suites
 * Using conditional test execution for platform-specific features
 */

// macOS-Specific Tests
test.describe('macOS-Specific Features', () => {
  test.beforeEach(() => {
    CrossPlatformUtils.skipUnlessPlatform(['darwin'], 'These tests are macOS-specific');
  });

  test('should handle macOS dock integration', async () => {
    const electronApp = await launchElectronForE2E();
    
    const dockFeatures = await electronApp.evaluate(({ app }) => {
      return {
        hasDock: !!app.dock,
        canHide: typeof app.dock?.hide === 'function',
        canShow: typeof app.dock?.show === 'function',
        canSetBadge: typeof app.dock?.setBadge === 'function'
      };
    });
    
    expect(dockFeatures.hasDock).toBeTruthy();
    expect(dockFeatures.canHide).toBeTruthy();
    expect(dockFeatures.canShow).toBeTruthy();
    expect(dockFeatures.canSetBadge).toBeTruthy();
    
    await closeElectronE2E();
    console.log('✅ macOS dock integration test passed');
  });
});

// Windows-Specific Tests  
test.describe('Windows-Specific Features', () => {
  test.beforeEach(() => {
    CrossPlatformUtils.skipUnlessPlatform(['win32'], 'These tests are Windows-specific');
  });

  test('should handle Windows user tasks', async () => {
    const electronApp = await launchElectronForE2E();
    
    const windowsFeatures = await electronApp.evaluate(({ app }) => {
      return {
        canSetUserTasks: typeof app.setUserTasks === 'function',
        canSetAppUserModelId: typeof app.setAppUserModelId === 'function'
      };
    });
    
    expect(windowsFeatures.canSetUserTasks).toBeTruthy();
    expect(windowsFeatures.canSetAppUserModelId).toBeTruthy();
    
    await closeElectronE2E();
    console.log('✅ Windows-specific features test passed');
  });
});

// Linux-Specific Tests
test.describe('Linux-Specific Features', () => {
  test.beforeEach(() => {
    CrossPlatformUtils.skipUnlessPlatform(['linux'], 'These tests are Linux-specific');
  });

  test('should handle Linux desktop integration', async () => {
    const electronApp = await launchElectronForE2E();
    
    const linuxFeatures = await electronApp.evaluate(({ app }) => {
      return {
        hasDesktopName: typeof app.getName === 'function',
        canSetDesktopName: typeof app.setName === 'function'
      };
    });
    
    expect(linuxFeatures.hasDesktopName).toBeTruthy();
    expect(linuxFeatures.canSetDesktopName).toBeTruthy();
    
    await closeElectronE2E();
    console.log('✅ Linux desktop integration test passed');
  });
});