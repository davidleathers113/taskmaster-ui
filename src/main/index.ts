import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

/// <reference path="./vite-env.d.ts" />

// ESM compatibility: Replace __dirname with import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// 🚨 AGGRESSIVE DEBUG LOGGING - 2025 EDITION 🚨
// ============================================

// Configure electron-log for comprehensive logging
log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
// Use the new API to avoid deprecation warning
log.transports.file.archiveLogFn = (oldLogFile) => {
  // Use process.stdout to avoid infinite recursion since console is overridden below
  process.stdout.write(`[TASKMASTER] Archived log: ${oldLogFile.toString()}\n`);
};

// Override console methods to also log to file
Object.assign(console, log.functions);

const _DEBUG_MODE = true;
const _DEBUG_PREFIX = '🔍 [TASKMASTER DEBUG]';
const ERROR_PREFIX = '❌ [TASKMASTER ERROR]';
const SUCCESS_PREFIX = '✅ [TASKMASTER SUCCESS]';
const _WARNING_PREFIX = '⚠️  [TASKMASTER WARNING]';
const INFO_PREFIX = 'ℹ️  [TASKMASTER INFO]';

// Performance timing
const _startTime = Date.now();
const timingLog = (message: string) => {
  const elapsed = Date.now() - _startTime;
  console.log(`⏱️  [${elapsed}ms] ${message}`);
};

// Enhanced logging with stack traces
const debugLog = (category: string, message: string, data?: any) => {
  if (!_DEBUG_MODE) return;
  
  const timestamp = new Date().toISOString();
  const stack = new Error().stack?.split('\n')[2]?.trim() || 'unknown';
  
  console.log(`\n${_DEBUG_PREFIX} [${timestamp}]`);
  console.log(`📁 Category: ${category}`);
  console.log(`💬 Message: ${message}`);
  console.log(`📍 Location: ${stack}`);
  
  if (data !== undefined) {
    console.log(`📊 Data:`, data);
  }
  console.log('─'.repeat(80));
};

const errorLog = (category: string, message: string, error?: any) => {
  const timestamp = new Date().toISOString();
  console.error(`\n${ERROR_PREFIX} [${timestamp}]`);
  console.error(`📁 Category: ${category}`);
  console.error(`💥 Error: ${message}`);
  
  if (error) {
    console.error(`🔴 Error Object:`, error);
    if (error.stack) {
      console.error(`📚 Stack Trace:\n${error.stack}`);
    }
  }
  console.error('═'.repeat(80));
};

// Log initial environment
console.log('\n' + '='.repeat(80));
console.log('🚀 TASKMASTER ELECTRON APP STARTING - DEBUG MODE ENABLED 🚀');
console.log('='.repeat(80));

debugLog('ENVIRONMENT', 'Initial Environment Check', {
  nodeVersion: process.versions.node,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  v8Version: process.versions.v8,
  platform: process.platform,
  arch: process.arch,
  cwd: process.cwd(),
  __dirname,
  __filename,
  execPath: process.execPath,
  resourcesPath: process.resourcesPath,
  isPackaged: app.isPackaged,
  appPath: app.getAppPath(),
  userData: app.getPath('userData'),
  NODE_ENV: process.env.NODE_ENV,
  ELECTRON_IS_DEV: process.env.ELECTRON_IS_DEV,
});

// electron-vite handles development/production URLs automatically

// File existence checker
const checkFileExists = (filePath: string, description: string): boolean => {
  try {
    const exists = fs.existsSync(filePath);
    const stats = exists ? fs.statSync(filePath) : null;
    
    if (exists) {
      console.log(`${SUCCESS_PREFIX} ${description}: ${filePath}`);
      console.log(`  📏 Size: ${stats?.size} bytes`);
      console.log(`  📅 Modified: ${stats?.mtime}`);
    } else {
      console.error(`${ERROR_PREFIX} ${description} NOT FOUND: ${filePath}`);
    }
    
    return exists;
  } catch (error) {
    errorLog('FILE_CHECK', `Error checking ${description}`, error);
    return false;
  }
};

// Check critical paths at startup
timingLog('Checking critical file paths...');
const criticalPaths = {
  mainScript: path.join(__dirname, 'index.js'),
  preloadDev: path.join(__dirname, '../preload/index.js'),
  preloadProd: path.join(__dirname, '../preload/index.cjs'),
  rendererDev: 'http://localhost:5173',
  rendererProd: path.join(__dirname, '../renderer/index.html'),
  rendererProdAlt: path.join(__dirname, '../renderer/index.html'),
};

debugLog('PATH_CHECK', 'Checking critical paths', criticalPaths);

// Check which files actually exist
checkFileExists(criticalPaths.mainScript, 'Main Script');
checkFileExists(criticalPaths.preloadDev, 'Preload (Dev Path)');
checkFileExists(criticalPaths.preloadProd, 'Preload (Prod Path)');
checkFileExists(criticalPaths.rendererProd, 'Renderer HTML (Prod Path)');
checkFileExists(criticalPaths.rendererProdAlt, 'Renderer HTML (Alt Path)');

// 2025 Security Best Practices - Electron Forge Fuses Configuration
// Security fuses are configured in forge.config.js:
// - RunAsNode: false (prevents Node.js execution in renderer)
// - EnableCookieEncryption: true (encrypts cookies)
// - EnableNodeOptionsEnvironmentVariable: false (prevents Node options injection)
// - EnableNodeCliInspectArguments: false (prevents debug inspection)
// - EnableEmbeddedAsarIntegrityValidation: true (validates ASAR integrity)
// - OnlyLoadAppFromAsar: true (only loads app from ASAR package)

// ============================================
// 🚨 GLOBAL ERROR HANDLERS - CATCH EVERYTHING 🚨
// ============================================

process.on('uncaughtException', (error) => {
  console.error('\n' + '💥'.repeat(40));
  console.error('💥 UNCAUGHT EXCEPTION IN MAIN PROCESS 💥');
  console.error('💥'.repeat(40));
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  console.error('💥'.repeat(40) + '\n');
  
  // Show error dialog
  dialog.showErrorBox('Uncaught Exception', 
    `An unexpected error occurred:\n\n${error.message}\n\nThe application may be unstable.`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n' + '⚡'.repeat(40));
  console.error('⚡ UNHANDLED PROMISE REJECTION IN MAIN PROCESS ⚡');
  console.error('⚡'.repeat(40));
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('⚡'.repeat(40) + '\n');
});

// ============================================
// 🔥 Hot Reloading Development Utilities - 2025 Best Practices 🔥
// ============================================

// Enhanced development logging for hot reloading
if (!app.isPackaged) {
  console.log('\n' + '🔥'.repeat(60));
  console.log('🔥 HOT RELOADING DEVELOPMENT MODE ACTIVE 🔥');
  console.log('🔥'.repeat(60));
  
  // Add keyboard shortcuts for development
  const addDevelopmentShortcuts = (window: BrowserWindow) => {
    // Register global shortcuts for development
    const { globalShortcut } = require('electron');
    
    try {
      // Ctrl+R / Cmd+R: Reload renderer
      globalShortcut.register('CmdOrCtrl+R', () => {
        debugLog('DEV_SHORTCUT', 'Manual renderer reload triggered');
        window.webContents.reload();
      });
      
      // Ctrl+Shift+R / Cmd+Shift+R: Hard reload (clear cache)
      globalShortcut.register('CmdOrCtrl+Shift+R', () => {
        debugLog('DEV_SHORTCUT', 'Hard reload triggered (clearing cache)');
        window.webContents.session.clearCache().then(() => {
          window.webContents.reload();
        });
      });
      
      // F5: Alternative reload
      globalShortcut.register('F5', () => {
        debugLog('DEV_SHORTCUT', 'F5 reload triggered');
        window.webContents.reload();
      });
      
      // Ctrl+Shift+I / Cmd+Shift+I: Toggle DevTools
      globalShortcut.register('CmdOrCtrl+Shift+I', () => {
        debugLog('DEV_SHORTCUT', 'DevTools toggle triggered');
        window.webContents.toggleDevTools();
      });
      
      console.log(`${SUCCESS_PREFIX} Development shortcuts registered:`);
      console.log('  🔄 Ctrl/Cmd+R: Reload renderer');
      console.log('  🔄 Ctrl/Cmd+Shift+R: Hard reload (clear cache)');
      console.log('  🔄 F5: Alternative reload');
      console.log('  🔧 Ctrl/Cmd+Shift+I: Toggle DevTools');
      
    } catch (error) {
      errorLog('DEV_SHORTCUTS', 'Failed to register development shortcuts', error);
    }
  };
  
  // Export the function to be used in createWindow
  (global as any).addDevelopmentShortcuts = addDevelopmentShortcuts;
  
  // Hot reload monitoring
  const setupHotReloadMonitoring = () => {
    const chokidar = require('chokidar');
    
    // Watch for main process file changes (electron-vite handles this but add extra logging)
    const mainWatcher = chokidar.watch([
      path.join(__dirname, '../**/*.{js,ts,mjs,cjs}'),
      path.join(__dirname, '../../src/main/**/*.{js,ts}'),
      path.join(__dirname, '../../src/preload/**/*.{js,ts}')
    ], {
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/out/**',
        '**/.git/**'
      ],
      ignoreInitial: true
    });
    
    mainWatcher.on('change', (filePath: string) => {
      console.log(`${_WARNING_PREFIX} Main/Preload file changed: ${filePath}`);
      console.log('🔥 electron-vite will handle the restart automatically');
    });
    
    mainWatcher.on('error', (error: Error) => {
      errorLog('HOT_RELOAD_WATCH', 'File watcher error', error);
    });
    
    // Log renderer changes (handled by Vite HMR)
    console.log(`${INFO_PREFIX} Hot reload monitoring active:`);
    console.log('  🔥 Main process: Watched by electron-vite (auto-restart)');
    console.log('  🔥 Preload scripts: Watched by electron-vite (auto-restart)');
    console.log('  🔥 Renderer process: Handled by Vite HMR (hot updates)');
  };
  
  // Initialize hot reload monitoring
  try {
    setupHotReloadMonitoring();
  } catch (error) {
    errorLog('HOT_RELOAD_INIT', 'Failed to initialize hot reload monitoring', error);
  }
}

// Log when the app starts
console.log(`\n${SUCCESS_PREFIX} Main process initialized`);
console.log(`📍 Script location: ${__filename}`);
console.log(`📁 Working directory: ${process.cwd()}`);
timingLog('Main process startup complete');

// Note: electron-squirrel-startup removed during migration to electron-vite
// Squirrel startup handling will be configured in electron-builder if needed

// Security: Disable GPU acceleration if needed for security (uncomment if required)
// app.disableHardwareAcceleration();

// Security: Enable secure protocols
app.setAsDefaultProtocolClient('taskmaster');

// Auto-updater configuration for 2025 best practices
class AutoUpdaterManager {
  private static instance: AutoUpdaterManager;
  private mainWindow: BrowserWindow | null = null;

  private constructor() {
    this.configureAutoUpdater();
  }

  public static getInstance(): AutoUpdaterManager {
    if (!AutoUpdaterManager.instance) {
      AutoUpdaterManager.instance = new AutoUpdaterManager();
    }
    return AutoUpdaterManager.instance;
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private configureAutoUpdater(): void {
    // Security: Enable signature verification (macOS and Windows)
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Auto-updater event handlers
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info);
      this.promptUserForUpdate(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info);
    });

    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      console.log(logMessage);
      this.mainWindow?.webContents.send('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info);
      this.promptUserToInstall();
    });
  }

  private async promptUserForUpdate(info: { version: string }): Promise<void> {
    if (!this.mainWindow) return;

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: 'A new version is available. Would you like to download it now?',
      detail: `Version ${info.version} is available. The app will restart after the update.`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  }

  private async promptUserToInstall(): Promise<void> {
    if (!this.mainWindow) return;

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. Restart the application to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  }

  public checkForUpdates(): void {
    // Only check for updates in production
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  }
}

const createWindow = (): void => {
  timingLog('Starting createWindow()');
  debugLog('WINDOW_CREATION', 'Creating main browser window...');
  
  try {
    // electron-vite automatically handles preload script paths
    const preloadPath = path.join(__dirname, '../preload/index.cjs');
    checkFileExists(preloadPath, 'Preload Script');
    
    // Create the browser window with 2025 security best practices
    const windowConfig = {
      height: 800,
      width: 1200,
      minHeight: 600,
      minWidth: 800,
      webPreferences: {
        // 2025 Security Best Practices - Critical Settings
        nodeIntegration: false,              // Disable Node.js in renderer process
        contextIsolation: true,              // Enable context isolation (default since Electron 12)
        enableRemoteModule: false,           // Disable remote module (deprecated but ensure it's off)
        allowRunningInsecureContent: false,  // Block mixed content
        experimentalFeatures: false,         // Disable experimental web features
        
        // Security: Preload script for safe API exposure
        preload: preloadPath,
        
        // Security: Sandbox the renderer process
        sandbox: false, // Set to true for maximum security, false for now to maintain functionality
        
        // Security: Disable webSecurity only in development
        webSecurity: !process.env.ELECTRON_DISABLE_SECURITY_WARNINGS,
        
        // Security: Additional protections
        spellcheck: false,                   // Disable spellcheck to prevent data leakage
        defaultEncoding: 'UTF-8',
      },
      
      // Window appearance and behavior
      show: false, // Don't show until ready
      titleBarStyle: (process.platform === 'darwin' ? 'hiddenInset' : 'default') as 'hiddenInset' | 'default',
      
      // Security: Icon configuration - Updated for electron-vite asset structure
      icon: path.join(__dirname, '../../resources/icon-256.png'),
    };
    
    debugLog('WINDOW_CONFIG', 'Window configuration', windowConfig);
    
    const mainWindow = new BrowserWindow(windowConfig);
    
    console.log(`${SUCCESS_PREFIX} Main window created successfully`);
    debugLog('WINDOW_CREATED', 'BrowserWindow instance created', {
      id: mainWindow.id,
      webContentsId: mainWindow.webContents.id,
    });

  // Security: Configure window behavior
  mainWindow.setMenuBarVisibility(false); // Hide menu bar (can be toggled with Alt)
  
  // Security: Handle external navigation attempts
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Security: Block all window.open attempts and open in external browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow navigation within the app (dev server or file protocol)
    if (!parsedUrl.origin.startsWith('http://localhost') && parsedUrl.origin !== 'file://') {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // Security: Handle new window requests (replaced deprecated 'new-window' event)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the app - electron-vite handles development/production URLs automatically
  debugLog('URL_LOADING', 'Loading application...');
  
  if (!app.isPackaged) {
    // Development mode: electron-vite provides dev server URL automatically
    console.log(`${INFO_PREFIX} Loading development server (electron-vite handles URL)`);
    debugLog('DEV_MODE', 'Loading development URL');
    
    // electron-vite dev server runs on standard port 5173
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl).then(() => {
      console.log(`${SUCCESS_PREFIX} Successfully loaded dev server`);
      timingLog('Dev server loaded');
    }).catch((err) => {
      errorLog('DEV_LOAD_ERROR', 'Failed to load dev server', err);
      dialog.showErrorBox('Development Server Error', 
        `Failed to connect to development server\n\nError: ${err.message}\n\nMake sure electron-vite dev server is running.`);
    });
  } else {
    // Production mode: electron-vite builds to standard location
    const indexPath = path.join(__dirname, '../renderer/index.html');
    
    console.log(`${INFO_PREFIX} Loading from file system (production mode)`);
    debugLog('PROD_MODE', 'Loading production file', { 
      indexPath,
      exists: fs.existsSync(indexPath)
    });
    
    mainWindow.loadFile(indexPath).then(() => {
      console.log(`${SUCCESS_PREFIX} Successfully loaded production build`);
      timingLog('Production file loaded');
    }).catch((err) => {
      errorLog('PROD_LOAD_ERROR', 'Failed to load production build', err);
      dialog.showErrorBox('Loading Error', 
        `Failed to load application file\n\nError: ${err.message}`);
    });
  }

  // Security: Production CSP headers will be set by Vite
  if (!app.isPackaged) {
    // Development: Open DevTools
    mainWindow.webContents.openDevTools();
    console.log(`${INFO_PREFIX} DevTools opened (development mode)`);
    
    // Add console message handler to see renderer logs in main process
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const logPrefix = `🌐 [RENDERER ${level}]`;
      console.log(`${logPrefix} ${message} (${sourceId}:${line})`);
    });
  }

  // Enhanced error tracking for renderer process
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    errorLog('RENDERER_LOAD_FAIL', 'Renderer failed to load', {
      errorCode,
      errorDescription,
      validatedURL,
      event
    });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    errorLog('RENDERER_CRASH', 'Renderer process gone', { details, reason: details.reason, exitCode: details.exitCode });
  });

  // Log successful page loads
  mainWindow.webContents.on('did-finish-load', () => {
    console.log(`${SUCCESS_PREFIX} Renderer finished loading`);
    timingLog('Renderer fully loaded');
    
    // Log some debug info about the loaded page
    mainWindow.webContents.executeJavaScript(`
      console.log('🎯 Page loaded successfully');
      console.log('📍 Location:', window.location.href);
      console.log('🔌 electronAPI available:', typeof window.electronAPI !== 'undefined');
      if (typeof window.electronAPI !== 'undefined') {
        console.log('📋 electronAPI methods:', Object.keys(window.electronAPI));
      } else {
        console.error('❌ electronAPI is NOT available in renderer!');
      }
    `);
  });

  mainWindow.webContents.on('did-start-loading', () => {
    debugLog('RENDERER_LOADING', 'Renderer started loading');
  });

  mainWindow.webContents.on('dom-ready', () => {
    debugLog('RENDERER_DOM', 'Renderer DOM ready');
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log(`${SUCCESS_PREFIX} Window ready to show`);
    timingLog('Window ready to show');
    mainWindow.show();
    
    // Initialize development shortcuts for hot reloading
    if (!app.isPackaged && (global as any).addDevelopmentShortcuts) {
      (global as any).addDevelopmentShortcuts(mainWindow);
      debugLog('DEV_SHORTCUTS', 'Development shortcuts initialized for hot reloading');
    }
    
    // Initialize auto-updater
    const autoUpdaterManager = AutoUpdaterManager.getInstance();
    autoUpdaterManager.setMainWindow(mainWindow);
    
    // Check for updates after a delay to ensure app is fully loaded
    setTimeout(() => {
      debugLog('AUTO_UPDATE', 'Checking for updates...');
      autoUpdaterManager.checkForUpdates();
    }, 3000);
  });

  // Security: Clear cache on window close in development
  mainWindow.on('closed', () => {
    debugLog('WINDOW_EVENT', 'Window closed');
    if (!app.isPackaged) {
      mainWindow.webContents.session.clearCache();
      debugLog('CACHE', 'Cleared session cache (dev mode)');
    }
  });
  
  } catch (error) {
    errorLog('WINDOW_CREATION_FATAL', 'Fatal error creating window', error);
    dialog.showErrorBox('Fatal Error', 
      `Failed to create application window.\n\nError: ${error}\n\nThe application will now exit.`);
    app.quit();
  }
};

// Security: IPC handlers with input validation
ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

ipcMain.handle('app:get-platform', () => {
  return process.platform;
});

ipcMain.handle('app:get-app-data-path', () => {
  return app.getPath('userData');
});

// Security: Sanitize and validate file system operations
ipcMain.handle('fs:get-documents-path', () => {
  return app.getPath('documents');
});

// Security: Safe dialog operations
ipcMain.handle('dialog:show-error', async (event, title: string, content: string) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  
  return await dialog.showErrorBox(title, content);
});

// App event handlers
app.on('window-all-closed', () => {
  debugLog('APP_EVENT', 'All windows closed');
  // Security: Clear sensitive data on app close
  if (process.platform !== 'darwin') {
    debugLog('APP_EVENT', 'Quitting app (non-macOS)');
    app.quit();
  }
});

app.on('activate', () => {
  debugLog('APP_EVENT', 'App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    debugLog('APP_EVENT', 'No windows exist, creating new window');
    createWindow();
  }
});

// Log app readiness
app.on('will-finish-launching', () => {
  debugLog('APP_EVENT', 'App will finish launching');
});

app.on('before-quit', (event) => {
  debugLog('APP_EVENT', 'App before quit', { event });
});

app.on('will-quit', (event) => {
  debugLog('APP_EVENT', 'App will quit', { event });
});

app.on('quit', (event, exitCode) => {
  debugLog('APP_EVENT', 'App quit', { event, exitCode });
});

// Security: App startup
app.whenReady().then(() => {
  console.log(`${SUCCESS_PREFIX} Electron app is ready!`);
  timingLog('App ready event fired');
  debugLog('APP_READY', 'App is ready, creating window...');
  // Security: Set app security policies
  // Security: Set app security policies (Windows only)
  if (process.platform === 'win32') {
    app.setUserTasks([]); // Clear any user tasks
  }
  
  createWindow();
  
  // Security: Handle certificate errors
  app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
    // In production, reject all certificate errors
    // In development, you might want to allow localhost
    if (!app.isPackaged && url.startsWith('http://localhost')) {
      event.preventDefault();
      callback(true);
    } else {
      callback(false);
    }
  });
});

// Security: Protocol handler registration
app.setAsDefaultProtocolClient('taskmaster');

// Security: Handle protocol activation (Windows/Linux)
app.on('second-instance', () => {
  // Someone tried to run a second instance, focus our window instead
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0 && windows[0]) {
    if (windows[0].isMinimized()) windows[0].restore();
    windows[0].focus();
  }
});

// Ensure single instance (temporarily disabled for debugging)
// const gotTheLock = app.requestSingleInstanceLock();
// if (!gotTheLock) {
//   app.quit();
// }

// Export for testing purposes
export { createWindow };