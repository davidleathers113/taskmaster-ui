/**
 * Error Reporting Preload Script (2025)
 * 
 * Secure IPC bridge between main and renderer processes for error reporting
 * and telemetry data with proper context isolation.
 * 
 * Following 2025 Electron security patterns with contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for the exposed API
export interface ElectronErrorReportingAPI {
  // Error reporting
  reportError: (errorData: {
    id: string;
    message: string;
    stack?: string;
    severity: string;
    context: Record<string, any>;
    tags: Record<string, string>;
    timestamp: number;
  }) => Promise<boolean>;

  // Telemetry
  sendTelemetry: (telemetryData: {
    type: 'metric' | 'event' | 'batch';
    data: any;
    sessionId: string;
    timestamp: number;
  }) => Promise<boolean>;

  // Status and health
  getMainProcessStatus: () => Promise<{
    isInitialized: boolean;
    errorCount: number;
    rendererErrorCount: number;
    systemInfo: Record<string, any>;
  }>;

  // Logging
  logToMain: (level: 'info' | 'warn' | 'error', message: string, context?: any) => Promise<void>;

  // Event listeners
  onMainError: (callback: (errorData: any) => void) => () => void;
  onMainStatusUpdate: (callback: (status: any) => void) => () => void;

  // Utilities
  getSystemInfo: () => Promise<{
    platform: string;
    arch: string;
    version: string;
    memory: any;
  }>;
}

// Implementation of the error reporting API
const errorReportingAPI: ElectronErrorReportingAPI = {
  // Report error to main process
  reportError: async (errorData) => {
    try {
      return await ipcRenderer.invoke('error-reporting:report', errorData);
    } catch (error) {
      console.error('Failed to report error to main process:', error);
      return false;
    }
  },

  // Send telemetry data to main process
  sendTelemetry: async (telemetryData) => {
    try {
      return await ipcRenderer.invoke('error-reporting:telemetry', telemetryData);
    } catch (error) {
      console.error('Failed to send telemetry to main process:', error);
      return false;
    }
  },

  // Get main process status
  getMainProcessStatus: async () => {
    try {
      return await ipcRenderer.invoke('error-reporting:status');
    } catch (error) {
      console.error('Failed to get main process status:', error);
      return {
        isInitialized: false,
        errorCount: 0,
        rendererErrorCount: 0,
        systemInfo: {}
      };
    }
  },

  // Send log message to main process
  logToMain: async (level, message, context) => {
    try {
      await ipcRenderer.invoke('error-reporting:log', level, message, context);
    } catch (error) {
      console.error('Failed to log to main process:', error);
    }
  },

  // Listen for main process errors
  onMainError: (callback) => {
    const listener = (_event: any, errorData: any) => {
      callback(errorData);
    };

    ipcRenderer.on('main-error-report', listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('main-error-report', listener);
    };
  },

  // Listen for main process status updates
  onMainStatusUpdate: (callback) => {
    const listener = (_event: any, status: any) => {
      callback(status);
    };

    ipcRenderer.on('main-status-update', listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('main-status-update', listener);
    };
  },

  // Get system information
  getSystemInfo: async () => {
    try {
      return await ipcRenderer.invoke('system:info');
    } catch (error) {
      console.error('Failed to get system info:', error);
      return {
        platform: 'unknown',
        arch: 'unknown',
        version: 'unknown',
        memory: {}
      };
    }
  }
};

// Security-conscious exposure of the API
if (process.contextIsolated) {
  try {
    // Expose the API to the renderer process via contextBridge
    contextBridge.exposeInMainWorld('electronErrorReporting', errorReportingAPI);
    
    // Also expose a simpler interface for basic error reporting
    contextBridge.exposeInMainWorld('electronAPI', {
      // Backward compatibility with existing error reporting
      reportError: errorReportingAPI.reportError,
      
      // System information
      getSystemInfo: errorReportingAPI.getSystemInfo,
      
      // Simple logging
      log: (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
        return errorReportingAPI.logToMain(level, message);
      }
    });

    console.log('✅ Error reporting preload API exposed successfully');
  } catch (error) {
    console.error('❌ Failed to expose error reporting API:', error);
  }
} else {
  console.warn('⚠️ Context isolation is disabled. Error reporting API not exposed for security reasons.');
}

// System information utility for renderer process (removed unused function)

// Performance monitoring helpers
const _performanceAPI = {
  // Mark performance milestones
  mark: (name: string) => {
    if ('performance' in globalThis && 'mark' in performance) {
      performance.mark(name);
    }
  },

  // Measure performance between marks
  measure: (name: string, startMark: string, endMark: string) => {
    if ('performance' in globalThis && 'measure' in performance) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        return measure ? measure.duration : 0;
      } catch (error) {
        console.warn('Performance measure failed:', error);
        return 0;
      }
    }
    return 0;
  },

  // Get navigation timing
  getNavigationTiming: () => {
    if ('performance' in globalThis && 'timing' in performance) {
      const timing = performance.timing;
      return {
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
        firstByte: timing.responseStart - timing.requestStart,
        domProcessing: timing.domComplete - timing.domLoading
      };
    }
    return null;
  },

  // Get memory information
  getMemoryInfo: () => {
    const memInfo = (performance as any).memory;
    if (memInfo) {
      return {
        usedJSHeapSize: memInfo.usedJSHeapSize,
        totalJSHeapSize: memInfo.totalJSHeapSize,
        jsHeapSizeLimit: memInfo.jsHeapSizeLimit,
        usagePercent: (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }
};

// Expose performance API if context is isolated
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronPerformance', _performanceAPI);
  } catch (error) {
    console.error('Failed to expose performance API:', error);
  }
}

// Debug utilities for development
if (process.env.NODE_ENV === 'development') {
  const debugAPI = {
    // Trigger test error
    triggerTestError: () => {
      throw new Error('Test error from preload script');
    },

    // Get all available APIs
    getAvailableAPIs: () => {
      return {
        electronErrorReporting: !!(globalThis as any).electronErrorReporting,
        electronAPI: !!(globalThis as any).electronAPI,
        electronPerformance: !!(globalThis as any).electronPerformance
      };
    },

    // Test IPC communication
    testIPC: async () => {
      try {
        const status = await errorReportingAPI.getMainProcessStatus();
        return { success: true, status };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  };

  if (process.contextIsolated) {
    try {
      contextBridge.exposeInMainWorld('electronDebug', debugAPI);
      console.log('🐛 Debug API exposed for development');
    } catch (error) {
      console.error('Failed to expose debug API:', error);
    }
  }
}

// Window error handler for preload script
window.addEventListener('error', (event) => {
  console.error('Preload script error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });

  // Report to main process if API is available
  if (errorReportingAPI) {
    errorReportingAPI.reportError({
      id: `preload_error_${Date.now()}`,
      message: event.message,
      stack: event.error?.stack,
      severity: 'error',
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        source: 'preload'
      },
      tags: {
        processType: 'preload',
        errorType: 'uncaught_exception'
      },
      timestamp: Date.now()
    }).catch(err => {
      console.error('Failed to report preload error:', err);
    });
  }
});

// Type is already exported above with interface declaration