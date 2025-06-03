/**
 * Main Process Error Reporting (2025)
 * 
 * Error reporting and telemetry for Electron main process with IPC integration
 * for communicating with renderer process monitoring systems.
 * 
 * Following 2025 patterns for cross-process error monitoring and resilience.
 */

import { ipcMain, app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Configuration for main process error reporting
export interface MainErrorReportingConfig {
  enabled: boolean;
  logToFile: boolean;
  logFilePath?: string;
  maxLogFileSize: number; // bytes
  maxLogFiles: number;
  enableIpcBridge: boolean;
  enableCrashReporting: boolean;
  reportToRenderer: boolean;
  environment: string;
}

// Error data structure for main process
export interface MainProcessError {
  id: string;
  timestamp: Date;
  message: string;
  stack?: string;
  type: 'uncaught_exception' | 'unhandled_rejection' | 'electron_error' | 'ipc_error';
  processType: 'main';
  context: {
    platform: string;
    arch: string;
    electronVersion: string;
    nodeVersion: string;
    appVersion: string;
    workingDirectory: string;
    commandLine: string[];
    memoryUsage: NodeJS.MemoryUsage;
    [key: string]: any;
  };
}

// IPC message structure for renderer communication
export interface IPCErrorMessage {
  type: 'error_report' | 'telemetry_data' | 'status_request';
  payload: any;
  timestamp: number;
  id: string;
}

/**
 * Main Process Error Reporting Service
 */
export class MainProcessErrorReporting {
  private config: MainErrorReportingConfig = {
    enabled: true,
    logToFile: true,
    maxLogFileSize: 10 * 1024 * 1024, // 10MB
    maxLogFiles: 5,
    enableIpcBridge: true,
    enableCrashReporting: true,
    reportToRenderer: true,
    environment: 'development'
  };

  private isInitialized = false;
  private logFilePath?: string;
  private errorCount = 0;
  private rendererErrors: any[] = [];

  constructor() {
    // Set up default log path
    this.logFilePath = path.join(app.getPath('logs'), 'taskmaster-main-errors.log');
  }

  /**
   * Initialize main process error reporting
   */
  async initialize(config: Partial<MainErrorReportingConfig> = {}): Promise<void> {
    this.config = { ...this.config, ...config };

    if (!this.config.enabled) {
      console.log('Main process error reporting disabled');
      return;
    }

    try {
      // Set up log file if enabled
      if (this.config.logToFile) {
        await this.setupLogFile();
      }

      // Set up global error handlers
      this.setupGlobalErrorHandlers();

      // Set up IPC handlers
      if (this.config.enableIpcBridge) {
        this.setupIpcHandlers();
      }

      // Set up crash reporting
      if (this.config.enableCrashReporting) {
        this.setupCrashReporting();
      }

      this.isInitialized = true;
      
      const initMessage = 'Main process error reporting initialized';

      await this.logMessage('info', initMessage);
      console.log('✅ Main process error reporting initialized');

    } catch (error) {
      console.error('❌ Failed to initialize main process error reporting:', error);
      throw error;
    }
  }

  /**
   * Set up log file with rotation
   */
  private async setupLogFile(): Promise<void> {
    if (!this.config.logFilePath && !this.logFilePath) {
      throw new Error('No log file path specified');
    }

    const logPath = this.config.logFilePath || this.logFilePath!;
    const logDir = path.dirname(logPath);

    // Ensure log directory exists
    await fs.promises.mkdir(logDir, { recursive: true });

    // Rotate log files if current file is too large
    await this.rotateLogFiles(logPath);

    this.logFilePath = logPath;
    console.log(`📝 Main process error logging to: ${logPath}`);
  }

  /**
   * Rotate log files when they get too large
   */
  private async rotateLogFiles(logPath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(logPath);
      
      if (stats.size > this.config.maxLogFileSize) {
        // Move current log to backup
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = logPath.replace('.log', `-${timestamp}.log`);
        
        await fs.promises.rename(logPath, backupPath);
        
        // Clean up old backup files
        await this.cleanupOldLogFiles(path.dirname(logPath));
      }
    } catch (error) {
      // File doesn't exist or can't be read, that's fine
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogFiles(logDir: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(logDir);
      const logFiles = files.filter(file => file.includes('taskmaster-main-errors'))
                           .map(file => ({
                             name: file,
                             path: path.join(logDir, file),
                             mtime: fs.statSync(path.join(logDir, file)).mtime
                           }))
                           .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the most recent files
      const filesToDelete = logFiles.slice(this.config.maxLogFiles);
      
      for (const file of filesToDelete) {
        await fs.promises.unlink(file.path);
        console.log(`🗑️ Cleaned up old log file: ${file.name}`);
      }
    } catch (error) {
      console.warn('Failed to clean up old log files:', error);
    }
  }

  /**
   * Set up global error handlers for main process
   */
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleMainProcessError(error, 'uncaught_exception', {
        fatal: true,
        reason: 'Uncaught exception in main process'
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.handleMainProcessError(error, 'unhandled_rejection', {
        fatal: false,
        reason: 'Unhandled promise rejection in main process',
        promise: promise.toString()
      });
    });

    // Handle app crashes using modern Electron APIs
    app.on('child-process-gone', (_event, details) => {
      const error = new Error(`${details.type} process crashed`);
      this.handleMainProcessError(error, 'electron_error', {
        event: 'child-process-gone',
        type: details.type,
        reason: details.reason,
        exitCode: details.exitCode,
        fatal: false
      });
    });

    app.on('render-process-gone', (_event, webContents, details) => {
      const error = new Error('Renderer process crashed');
      this.handleMainProcessError(error, 'electron_error', {
        event: 'render-process-gone',
        webContentsId: webContents.id,
        reason: details.reason,
        exitCode: details.exitCode,
        fatal: false
      });
    });

    app.on('child-process-gone', (_event, details) => {
      const error = new Error(`Child process gone: ${details.type}`);
      this.handleMainProcessError(error, 'electron_error', {
        event: 'child-process-gone',
        details,
        fatal: false
      });
    });

    console.log('🛡️ Main process error handlers set up');
  }

  /**
   * Set up IPC handlers for renderer communication
   */
  private setupIpcHandlers(): void {
    // Handle error reports from renderer
    ipcMain.handle('error-reporting:report', async (_event, errorData) => {
      return this.handleRendererError(errorData);
    });

    // Handle telemetry data from renderer
    ipcMain.handle('error-reporting:telemetry', async (_event, telemetryData) => {
      return this.handleRendererTelemetry(telemetryData);
    });

    // Handle status requests
    ipcMain.handle('error-reporting:status', async (_event) => {
      return this.getStatus();
    });

    // Handle log message requests
    ipcMain.handle('error-reporting:log', async (_event, level, message, context) => {
      return this.logMessage(level, message, context);
    });

    console.log('🔗 IPC handlers set up for error reporting');
  }

  /**
   * Set up crash reporting
   */
  private setupCrashReporting(): void {
    // Set up crash dumps directory
    const crashesDirectory = path.join(app.getPath('crashDumps'), 'taskmaster-crashes');
    
    try {
      fs.mkdirSync(crashesDirectory, { recursive: true });
      console.log(`💥 Crash reporting enabled, dumps in: ${crashesDirectory}`);
    } catch (error) {
      console.warn('Failed to set up crash reporting directory:', error);
    }
  }

  /**
   * Handle main process errors
   */
  private async handleMainProcessError(
    error: Error, 
    type: MainProcessError['type'], 
    additionalContext: Record<string, any> = {}
  ): Promise<void> {
    this.errorCount++;

    const errorData: MainProcessError = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      type,
      processType: 'main',
      context: {
        platform: os.platform(),
        arch: os.arch(),
        electronVersion: process.versions.electron || 'unknown',
        nodeVersion: process.version,
        appVersion: app.getVersion(),
        workingDirectory: process.cwd(),
        commandLine: process.argv,
        memoryUsage: process.memoryUsage(),
        ...additionalContext
      }
    };

    // Log the error
    await this.logMessage('error', 'Main process error occurred', errorData);

    // Report to renderer if enabled and windows are available
    if (this.config.reportToRenderer) {
      this.reportToRenderer('main_process_error', errorData);
    }

    // Console output
    console.error('🔴 Main Process Error:', {
      type,
      message: error.message,
      stack: error.stack,
      context: additionalContext
    });

    // Exit on fatal errors (uncaught exceptions)
    if (type === 'uncaught_exception') {
      console.error('💀 Fatal error in main process, exiting...');
      
      // Give some time for logging and reporting
      setTimeout(() => {
        app.exit(1);
      }, 1000);
    }
  }

  /**
   * Handle errors reported from renderer process
   */
  private async handleRendererError(errorData: any): Promise<boolean> {
    try {
      this.rendererErrors.push({
        ...errorData,
        receivedAt: new Date(),
        processType: 'renderer'
      });

      // Keep only recent renderer errors
      if (this.rendererErrors.length > 100) {
        this.rendererErrors = this.rendererErrors.slice(-100);
      }

      await this.logMessage('error', 'Renderer error received', {
        errorId: errorData.id,
        message: errorData.message,
        severity: errorData.severity,
        tags: errorData.tags
      });

      return true;
    } catch (error) {
      console.error('Failed to handle renderer error:', error);
      return false;
    }
  }

  /**
   * Handle telemetry data from renderer process
   */
  private async handleRendererTelemetry(telemetryData: any): Promise<boolean> {
    try {
      await this.logMessage('info', 'Telemetry data received', {
        type: telemetryData.type,
        sessionId: telemetryData.sessionId,
        dataPoints: Array.isArray(telemetryData.data) ? telemetryData.data.length : 1
      });

      return true;
    } catch (error) {
      console.error('Failed to handle renderer telemetry:', error);
      return false;
    }
  }

  /**
   * Report data to renderer processes
   */
  private reportToRenderer(type: string, data: any): void {
    const message: IPCErrorMessage = {
      type: type as any,
      payload: data,
      timestamp: Date.now(),
      id: this.generateErrorId()
    };

    // Send to all renderer processes
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('main-error-report', message);
      }
    });
  }

  /**
   * Log message to file and console
   */
  private async logMessage(level: 'info' | 'warn' | 'error', message: string, context?: any): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      pid: process.pid,
      memory: process.memoryUsage()
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    // Write to file if enabled
    if (this.config.logToFile && this.logFilePath) {
      try {
        await fs.promises.appendFile(this.logFilePath, logLine);
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }

    // Console output in development
    if (this.config.environment === 'development') {
      const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      consoleMethod(`[${level.toUpperCase()}] ${message}`, context || '');
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      errorCount: this.errorCount,
      rendererErrorCount: this.rendererErrors.length,
      logFilePath: this.logFilePath,
      config: this.config,
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        appVersion: app.getVersion(),
        memoryUsage: process.memoryUsage()
      }
    };
  }

  /**
   * Get recent renderer errors for debugging
   */
  getRendererErrors(): any[] {
    return [...this.rendererErrors];
  }

  /**
   * Clear renderer error history
   */
  clearRendererErrors(): void {
    this.rendererErrors = [];
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `main_error_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Cleanup and stop error reporting
   */
  destroy(): void {
    // Remove process listeners
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');

    // Remove IPC handlers
    if (this.config.enableIpcBridge) {
      ipcMain.removeHandler('error-reporting:report');
      ipcMain.removeHandler('error-reporting:telemetry');
      ipcMain.removeHandler('error-reporting:status');
      ipcMain.removeHandler('error-reporting:log');
    }

    this.isInitialized = false;
    console.log('🛡️ Main process error reporting destroyed');
  }
}

// Global instance for main process
export const mainProcessErrorReporting = new MainProcessErrorReporting();

// Types are already exported above with their interface declarations