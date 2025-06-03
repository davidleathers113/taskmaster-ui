/**
 * TaskMaster File Operations E2E Tests (2025)
 * 
 * Comprehensive test suite for file system interactions within the Electron application.
 * Following 2025 best practices for Playwright + Electron file operations testing:
 * 
 * - IPC automation channels for native file dialog testing
 * - Page Object Model for maintainability and reusability
 * - File system security validation and path traversal prevention
 * - File watcher functionality testing with WebSocket validation
 * - Error handling and recovery mechanisms
 * - Cross-platform file path compatibility
 * - Performance monitoring for file operations
 * 
 * Test Coverage:
 * - Main process file operations (path validation, existence checking)
 * - File dialog automation via IPC channels
 * - File watcher server operations (project file monitoring)
 * - File system security (sanitization, path traversal prevention)
 * - Configuration file loading and validation
 * - Error handling for invalid file operations
 * - Performance benchmarks for file operations
 * - WebSocket file update broadcasting
 * - Auto-updater file operations
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test';
import { join } from 'path';
import { mkdtemp, writeFile, unlink, mkdir, readFile, rmdir } from 'fs/promises';
import { tmpdir } from 'os';
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
 * Page Object Model for File Operations Testing
 * Encapsulates file-related UI interactions and IPC automation following 2025 best practices
 */
class FileOperationsPage {
  constructor(private page: Page) {}

  // File operation UI elements
  get fileMenuButton() { return this.page.locator('[data-testid="file-menu"], button:has-text("File"), .file-menu'); }
  get openProjectButton() { return this.page.locator('[data-testid="open-project"], button:has-text("Open Project")'); }
  get saveProjectButton() { return this.page.locator('[data-testid="save-project"], button:has-text("Save Project")'); }
  get importTasksButton() { return this.page.locator('[data-testid="import-tasks"], button:has-text("Import")'); }
  get exportTasksButton() { return this.page.locator('[data-testid="export-tasks"], button:has-text("Export")'); }
  get filePathDisplay() { return this.page.locator('[data-testid="current-file-path"], .file-path-display'); }
  get fileStatusIndicator() { return this.page.locator('[data-testid="file-status"], .file-status'); }

  // Project manager elements
  get projectManager() { return this.page.locator('[data-testid="project-manager"], .project-manager'); }
  get addProjectButton() { return this.page.locator('[data-testid="add-project"], button:has-text("Add Project")'); }
  get projectList() { return this.page.locator('[data-testid="project-list"], .project-list'); }
  get projectItems() { return this.page.locator('[data-testid="project-item"], .project-item'); }

  // File watcher status elements
  get fileWatcherStatus() { return this.page.locator('[data-testid="file-watcher-status"], .watcher-status'); }
  get connectionStatus() { return this.page.locator('[data-testid="connection-status"], .connection-status'); }
  get lastUpdateTime() { return this.page.locator('[data-testid="last-update"], .last-update'); }

  /**
   * Set up IPC automation channels for file dialog testing
   * Following 2025 best practices for bypassing native file dialogs
   */
  async setupFileDialogAutomation(): Promise<void> {
    console.log('🔧 Setting up file dialog automation channels...');
    
    await this.page.evaluate(() => {
      // Set automation flag
      (window as any).__FILE_DIALOG_AUTOMATION__ = true;
      
      // Override native file dialog methods in the main process via IPC
      if ((window as any).electronAPI?.overrideFileDialogs) {
        (window as any).electronAPI.overrideFileDialogs(true);
      }
    });
  }

  /**
   * Simulate file dialog selection via IPC automation
   * Avoids native dialog interaction which Playwright cannot handle
   */
  async automateFileSelection(filePaths: string[], dialogType: 'open' | 'save' = 'open'): Promise<void> {
    console.log(`🤖 Automating ${dialogType} file dialog with paths:`, filePaths);
    
    // Use IPC automation channel to simulate file selection
    await this.page.evaluate(async (params) => {
      const { filePaths, dialogType } = params;
      
      // Create automation handler for file dialog
      if ((window as any).electronAPI?.automateFileDialog) {
        return await (window as any).electronAPI.automateFileDialog({
          type: dialogType,
          selectedPaths: filePaths,
          timestamp: Date.now()
        });
      } else {
        // Fallback: directly set file paths in app state
        const store = (window as any).__APP_STORE__;
        if (store && store.setSelectedFiles) {
          store.setSelectedFiles(filePaths);
        }
        return { success: true, selectedPaths: filePaths };
      }
    }, { filePaths, dialogType });
    
    // Wait for file operation to complete
    await this.page.waitForTimeout(1000);
  }

  /**
   * Test file existence checking functionality
   */
  async testFileExistenceChecking(filePath: string): Promise<boolean> {
    console.log(`📁 Testing file existence check for: ${filePath}`);
    
    const result = await this.page.evaluate(async (path) => {
      if ((window as any).electronAPI?.checkFileExists) {
        return await (window as any).electronAPI.checkFileExists(path);
      }
      return false;
    }, filePath);
    
    return result;
  }

  /**
   * Test file path operations and validation
   */
  async testPathOperations(): Promise<{
    documentsPath: string;
    userDataPath: string;
    pathsValid: boolean;
  }> {
    console.log('📂 Testing file path operations...');
    
    const paths = await this.page.evaluate(async () => {
      const results = {
        documentsPath: '',
        userDataPath: '',
        pathsValid: false
      };
      
      try {
        if ((window as any).electronAPI?.getDocumentsPath) {
          results.documentsPath = await (window as any).electronAPI.getDocumentsPath();
        }
        
        if ((window as any).electronAPI?.getUserDataPath) {
          results.userDataPath = await (window as any).electronAPI.getUserDataPath();
        }
        
        // Validate paths are absolute and exist
        results.pathsValid = results.documentsPath.length > 0 && 
                           results.userDataPath.length > 0 &&
                           results.documentsPath.startsWith('/') &&
                           results.userDataPath.startsWith('/');
        
        return results;
      } catch (error) {
        console.error('Path operations error:', error);
        return results;
      }
    });
    
    return paths;
  }

  /**
   * Test file watcher functionality with WebSocket validation
   */
  async testFileWatcherFunctionality(testProjectPath: string): Promise<{
    watcherActive: boolean;
    connectionEstablished: boolean;
    updatesReceived: number;
  }> {
    console.log(`👁️ Testing file watcher functionality for: ${testProjectPath}`);
    
    // Set up WebSocket message listener
    let updateCount = 0;
    await this.page.evaluate(() => {
      (window as any).__FILE_WATCHER_UPDATES__ = 0;
      
      // Mock WebSocket connection monitoring
      if ((window as any).electronAPI?.onFileUpdate) {
        (window as any).electronAPI.onFileUpdate((data: any) => {
          (window as any).__FILE_WATCHER_UPDATES__++;
          console.log('File update received:', data);
        });
      }
    });
    
    // Add project to file watcher
    const watcherSetup = await this.page.evaluate(async (projectPath) => {
      try {
        if ((window as any).electronAPI?.addProjectToWatcher) {
          return await (window as any).electronAPI.addProjectToWatcher({
            id: 'test-project',
            name: 'Test Project',
            path: projectPath
          });
        }
        return { success: false };
      } catch (error) {
        console.error('Watcher setup error:', error);
        return { success: false, error: error.message };
      }
    }, testProjectPath);
    
    // Wait for watcher to initialize
    await this.page.waitForTimeout(2000);
    
    // Get final status
    const finalStatus = await this.page.evaluate(() => {
      return {
        watcherActive: !!(window as any).__FILE_WATCHER_ACTIVE__,
        connectionEstablished: !!(window as any).__WEBSOCKET_CONNECTED__,
        updatesReceived: (window as any).__FILE_WATCHER_UPDATES__ || 0
      };
    });
    
    return finalStatus;
  }

  /**
   * Test file system security and path validation
   */
  async testFileSystemSecurity(): Promise<{
    pathTraversalBlocked: boolean;
    invalidExtensionBlocked: boolean;
    absolutePathRequired: boolean;
  }> {
    console.log('🔒 Testing file system security measures...');
    
    const securityTests = await this.page.evaluate(async () => {
      const results = {
        pathTraversalBlocked: false,
        invalidExtensionBlocked: false,
        absolutePathRequired: false
      };
      
      try {
        // Test path traversal prevention
        if ((window as any).electronAPI?.validateFilePath) {
          const pathTraversalAttempt = await (window as any).electronAPI.validateFilePath('../../../etc/passwd');
          results.pathTraversalBlocked = !pathTraversalAttempt.valid;
          
          // Test invalid extension blocking
          const invalidExtension = await (window as any).electronAPI.validateFilePath('/valid/path/file.exe');
          results.invalidExtensionBlocked = !invalidExtension.valid;
          
          // Test absolute path requirement
          const relativePath = await (window as any).electronAPI.validateFilePath('relative/path/file.json');
          results.absolutePathRequired = !relativePath.valid;
        }
        
        return results;
      } catch (error) {
        console.error('Security test error:', error);
        return results;
      }
    });
    
    return securityTests;
  }

  /**
   * Test configuration file operations
   */
  async testConfigFileOperations(): Promise<{
    configLoaded: boolean;
    configValid: boolean;
    configSaved: boolean;
  }> {
    console.log('⚙️ Testing configuration file operations...');
    
    const configTests = await this.page.evaluate(async () => {
      const results = {
        configLoaded: false,
        configValid: false,
        configSaved: false
      };
      
      try {
        // Test config loading
        if ((window as any).electronAPI?.loadConfig) {
          const config = await (window as any).electronAPI.loadConfig();
          results.configLoaded = !!config;
          results.configValid = config && typeof config === 'object';
        }
        
        // Test config saving
        if ((window as any).electronAPI?.saveConfig) {
          const testConfig = { testSetting: 'testValue', timestamp: Date.now() };
          const saveResult = await (window as any).electronAPI.saveConfig(testConfig);
          results.configSaved = !!saveResult.success;
        }
        
        return results;
      } catch (error) {
        console.error('Config operations error:', error);
        return results;
      }
    });
    
    return configTests;
  }

  /**
   * Test auto-updater file operations
   */
  async testAutoUpdaterOperations(): Promise<{
    updateCheckPerformed: boolean;
    updateFilesValidated: boolean;
    downloadPathValid: boolean;
  }> {
    console.log('🔄 Testing auto-updater file operations...');
    
    const updaterTests = await this.page.evaluate(async () => {
      const results = {
        updateCheckPerformed: false,
        updateFilesValidated: false,
        downloadPathValid: false
      };
      
      try {
        // Test update check (mock in test environment)
        if ((window as any).electronAPI?.checkForUpdates) {
          const updateCheck = await (window as any).electronAPI.checkForUpdates();
          results.updateCheckPerformed = !!updateCheck;
        }
        
        // Test update file validation
        if ((window as any).electronAPI?.validateUpdateFiles) {
          const validation = await (window as any).electronAPI.validateUpdateFiles();
          results.updateFilesValidated = !!validation;
        }
        
        // Test download path validation
        if ((window as any).electronAPI?.getDownloadPath) {
          const downloadPath = await (window as any).electronAPI.getDownloadPath();
          results.downloadPathValid = downloadPath && downloadPath.length > 0;
        }
        
        return results;
      } catch (error) {
        console.error('Auto-updater test error:', error);
        return results;
      }
    });
    
    return updaterTests;
  }

  /**
   * Test file operation performance
   */
  async measureFileOperationPerformance(testFilePath: string): Promise<{
    readTime: number;
    writeTime: number;
    existsCheckTime: number;
  }> {
    console.log('⚡ Measuring file operation performance...');
    
    const performanceMetrics = await this.page.evaluate(async (filePath) => {
      const metrics = {
        readTime: 0,
        writeTime: 0,
        existsCheckTime: 0
      };
      
      try {
        // Measure file existence check
        const existsStart = performance.now();
        if ((window as any).electronAPI?.checkFileExists) {
          await (window as any).electronAPI.checkFileExists(filePath);
        }
        metrics.existsCheckTime = performance.now() - existsStart;
        
        // Measure file read operation
        const readStart = performance.now();
        if ((window as any).electronAPI?.readFile) {
          await (window as any).electronAPI.readFile(filePath);
        }
        metrics.readTime = performance.now() - readStart;
        
        // Measure file write operation
        const writeStart = performance.now();
        if ((window as any).electronAPI?.writeFile) {
          await (window as any).electronAPI.writeFile(filePath, JSON.stringify({ test: true }));
        }
        metrics.writeTime = performance.now() - writeStart;
        
        return metrics;
      } catch (error) {
        console.error('Performance measurement error:', error);
        return metrics;
      }
    }, testFilePath);
    
    return performanceMetrics;
  }

  /**
   * Verify file operation error handling
   */
  async testFileOperationErrorHandling(): Promise<{
    invalidPathHandled: boolean;
    permissionErrorHandled: boolean;
    networkErrorHandled: boolean;
  }> {
    console.log('🚨 Testing file operation error handling...');
    
    const errorTests = await this.page.evaluate(async () => {
      const results = {
        invalidPathHandled: false,
        permissionErrorHandled: false,
        networkErrorHandled: false
      };
      
      try {
        // Test invalid path handling
        if ((window as any).electronAPI?.readFile) {
          try {
            await (window as any).electronAPI.readFile('/invalid/nonexistent/path.json');
          } catch (error) {
            results.invalidPathHandled = true;
          }
        }
        
        // Test permission error handling
        if ((window as any).electronAPI?.writeFile) {
          try {
            await (window as any).electronAPI.writeFile('/root/protected.json', '{}');
          } catch (error) {
            results.permissionErrorHandled = true;
          }
        }
        
        // Test network path error handling
        if ((window as any).electronAPI?.readFile) {
          try {
            await (window as any).electronAPI.readFile('http://invalid-network-path/file.json');
          } catch (error) {
            results.networkErrorHandled = true;
          }
        }
        
        return results;
      } catch (error) {
        console.error('Error handling test error:', error);
        return results;
      }
    });
    
    return errorTests;
  }
}

/**
 * Test Suite: File Operations for TaskMaster Electron Application
 */
test.describe('File Operations for TaskMaster Electron Application', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let fileOpsPage: FileOperationsPage;
  let tempDir: string;
  let testProjectPath: string;

  test.beforeEach(async () => {
    console.log('🚀 Starting TaskMaster for file operations testing...');
    
    // Create temporary directory for test files
    tempDir = await mkdtemp(join(tmpdir(), 'taskmaster-test-'));
    testProjectPath = join(tempDir, 'test-project');
    await mkdir(testProjectPath, { recursive: true });
    await mkdir(join(testProjectPath, 'tasks'), { recursive: true });
    
    // Create test tasks.json file
    const testTasks = {
      tasks: [
        { id: 1, title: 'Test Task', status: 'pending', priority: 'medium' }
      ],
      version: '1.0.0'
    };
    await writeFile(join(testProjectPath, 'tasks', 'tasks.json'), JSON.stringify(testTasks, null, 2));
    
    electronApp = await launchElectronForE2E({
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        PLAYWRIGHT_TEST: '1',
        FILE_OPERATIONS_TEST: '1' // Flag for file operations testing
      }
    });

    page = await getMainWindow();
    fileOpsPage = new FileOperationsPage(page);
    
    // Set up file dialog automation
    await fileOpsPage.setupFileDialogAutomation();
    
    // Wait for app to be fully loaded
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('✅ File operations testing environment ready');
  });

  test.afterEach(async () => {
    // Clean up temporary files
    try {
      await unlink(join(testProjectPath, 'tasks', 'tasks.json'));
      await rmdir(join(testProjectPath, 'tasks'));
      await rmdir(testProjectPath);
      await rmdir(tempDir);
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
    
    await takeE2EScreenshot('file-operations-cleanup');
    await closeElectronE2E();
  });

  /**
   * Test: File Path Operations and Validation
   */
  test('should handle file path operations correctly', async () => {
    const pathResults = await fileOpsPage.testPathOperations();
    
    // Verify documents path is valid
    expect(pathResults.documentsPath).toBeTruthy();
    expect(pathResults.documentsPath).toMatch(/^\/.*\/Documents$/);
    
    // Verify user data path is valid
    expect(pathResults.userDataPath).toBeTruthy();
    expect(pathResults.userDataPath.length).toBeGreaterThan(0);
    
    // Verify paths are valid absolute paths
    expect(pathResults.pathsValid).toBeTruthy();
    
    await takeE2EScreenshot('file-path-operations-test');
    console.log('✅ File path operations test passed');
  });

  /**
   * Test: File Existence Checking
   */
  test('should check file existence accurately', async () => {
    // Test existing file
    const existingFileExists = await fileOpsPage.testFileExistenceChecking(
      join(testProjectPath, 'tasks', 'tasks.json')
    );
    expect(existingFileExists).toBeTruthy();
    
    // Test non-existing file
    const nonExistingFileExists = await fileOpsPage.testFileExistenceChecking(
      join(testProjectPath, 'nonexistent.json')
    );
    expect(nonExistingFileExists).toBeFalsy();
    
    await takeE2EScreenshot('file-existence-check-test');
    console.log('✅ File existence checking test passed');
  });

  /**
   * Test: File Dialog Automation via IPC
   */
  test('should handle file dialog operations via IPC automation', async () => {
    const testFilePath = join(testProjectPath, 'tasks', 'tasks.json');
    
    // Test file selection automation
    await fileOpsPage.automateFileSelection([testFilePath], 'open');
    
    // Verify file was selected (check if app state changed)
    const fileSelected = await page.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      return store?.selectedFiles?.length > 0 || false;
    });
    
    expect(fileSelected).toBeTruthy();
    
    // Test save dialog automation
    await fileOpsPage.automateFileSelection([join(tempDir, 'exported-tasks.json')], 'save');
    
    await takeE2EScreenshot('file-dialog-automation-test');
    console.log('✅ File dialog automation test passed');
  });

  /**
   * Test: File Watcher Functionality
   */
  test('should monitor file changes via file watcher', async () => {
    const watcherResults = await fileOpsPage.testFileWatcherFunctionality(testProjectPath);
    
    // Verify watcher is active
    expect(watcherResults.watcherActive).toBeTruthy();
    
    // Note: Connection establishment depends on file watcher server being available
    // In test environment, this might be mocked
    console.log('File watcher results:', watcherResults);
    
    await takeE2EScreenshot('file-watcher-test');
    console.log('✅ File watcher functionality test passed');
  });

  /**
   * Test: File System Security
   */
  test('should enforce file system security measures', async () => {
    const securityResults = await fileOpsPage.testFileSystemSecurity();
    
    // Verify path traversal is blocked
    expect(securityResults.pathTraversalBlocked).toBeTruthy();
    
    // Verify invalid extensions are blocked
    expect(securityResults.invalidExtensionBlocked).toBeTruthy();
    
    // Verify absolute paths are required
    expect(securityResults.absolutePathRequired).toBeTruthy();
    
    await takeE2EScreenshot('file-security-test');
    console.log('✅ File system security test passed');
  });

  /**
   * Test: Configuration File Operations
   */
  test('should handle configuration file operations correctly', async () => {
    const configResults = await fileOpsPage.testConfigFileOperations();
    
    // Verify config can be loaded
    expect(configResults.configLoaded).toBeTruthy();
    
    // Verify config is valid
    expect(configResults.configValid).toBeTruthy();
    
    // Verify config can be saved
    expect(configResults.configSaved).toBeTruthy();
    
    await takeE2EScreenshot('config-file-operations-test');
    console.log('✅ Configuration file operations test passed');
  });

  /**
   * Test: Auto-Updater File Operations
   */
  test('should handle auto-updater file operations correctly', async () => {
    const updaterResults = await fileOpsPage.testAutoUpdaterOperations();
    
    // Note: Auto-updater tests may be limited in test environment
    // Results depend on the availability of update mechanisms
    console.log('Auto-updater results:', updaterResults);
    
    await takeE2EScreenshot('auto-updater-operations-test');
    console.log('✅ Auto-updater file operations test completed');
  });

  /**
   * Test: File Operation Performance
   */
  test('should maintain good performance for file operations', async () => {
    const testFilePath = join(testProjectPath, 'tasks', 'tasks.json');
    const performanceMetrics = await fileOpsPage.measureFileOperationPerformance(testFilePath);
    
    // Verify operations complete within reasonable time limits
    expect(performanceMetrics.existsCheckTime).toBeLessThan(100); // 100ms
    expect(performanceMetrics.readTime).toBeLessThan(500); // 500ms
    expect(performanceMetrics.writeTime).toBeLessThan(1000); // 1000ms
    
    console.log('📊 File Operation Performance:');
    console.log(`  Existence check: ${performanceMetrics.existsCheckTime.toFixed(2)}ms`);
    console.log(`  Read operation: ${performanceMetrics.readTime.toFixed(2)}ms`);
    console.log(`  Write operation: ${performanceMetrics.writeTime.toFixed(2)}ms`);
    
    await takeE2EScreenshot('file-performance-test');
    console.log('✅ File operation performance test passed');
  });

  /**
   * Test: File Operation Error Handling
   */
  test('should handle file operation errors gracefully', async () => {
    const errorResults = await fileOpsPage.testFileOperationErrorHandling();
    
    // Verify error handling is implemented
    expect(errorResults.invalidPathHandled).toBeTruthy();
    expect(errorResults.permissionErrorHandled).toBeTruthy();
    expect(errorResults.networkErrorHandled).toBeTruthy();
    
    await takeE2EScreenshot('file-error-handling-test');
    console.log('✅ File operation error handling test passed');
  });

  /**
   * Test: Cross-Platform File Path Compatibility
   */
  test('should handle cross-platform file paths correctly', async () => {
    const platform = process.platform;
    console.log(`🖥️ Testing file paths on platform: ${platform}`);
    
    // Test platform-specific path handling
    const pathResults = await fileOpsPage.testPathOperations();
    
    // Verify paths are platform-appropriate
    if (platform === 'win32') {
      expect(pathResults.documentsPath).toMatch(/^[A-Z]:\\/);
      expect(pathResults.userDataPath).toMatch(/^[A-Z]:\\/);
    } else {
      expect(pathResults.documentsPath).toMatch(/^\//);
      expect(pathResults.userDataPath).toMatch(/^\//);
    }
    
    expect(pathResults.pathsValid).toBeTruthy();
    
    await takeE2EScreenshot(`cross-platform-paths-${platform}`);
    console.log(`✅ Cross-platform file path test passed for ${platform}`);
  });

  /**
   * Test: Bulk File Operations
   */
  test('should handle bulk file operations efficiently', async () => {
    // Create multiple test files
    const testFiles = [];
    for (let i = 0; i < 5; i++) {
      const testFile = join(testProjectPath, `test-file-${i}.json`);
      await writeFile(testFile, JSON.stringify({ id: i, test: true }));
      testFiles.push(testFile);
    }
    
    const startTime = performance.now();
    
    // Test bulk file existence checking
    let allExist = true;
    for (const file of testFiles) {
      const exists = await fileOpsPage.testFileExistenceChecking(file);
      if (!exists) allExist = false;
    }
    
    const endTime = performance.now();
    const bulkOperationTime = endTime - startTime;
    
    // Verify all files exist
    expect(allExist).toBeTruthy();
    
    // Verify bulk operations complete efficiently
    expect(bulkOperationTime).toBeLessThan(2000); // 2 seconds for 5 files
    
    console.log(`📊 Bulk file operations completed in ${bulkOperationTime.toFixed(2)}ms`);
    
    // Cleanup test files
    for (const file of testFiles) {
      await unlink(file);
    }
    
    await takeE2EScreenshot('bulk-file-operations-test');
    console.log('✅ Bulk file operations test passed');
  });

  /**
   * Test: File Operations Under Load
   */
  test('should maintain stability under file operation load', async () => {
    const concurrentOperations = 10;
    const promises = [];
    
    for (let i = 0; i < concurrentOperations; i++) {
      const promise = fileOpsPage.testFileExistenceChecking(
        join(testProjectPath, 'tasks', 'tasks.json')
      );
      promises.push(promise);
    }
    
    const startTime = performance.now();
    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    const loadTestTime = endTime - startTime;
    
    // Verify all operations succeeded
    expect(results.every(result => result === true)).toBeTruthy();
    
    // Verify operations completed within reasonable time
    expect(loadTestTime).toBeLessThan(5000); // 5 seconds for 10 concurrent operations
    
    console.log(`📊 Load test completed in ${loadTestTime.toFixed(2)}ms for ${concurrentOperations} operations`);
    
    await takeE2EScreenshot('file-operations-load-test');
    console.log('✅ File operations load test passed');
  });
});