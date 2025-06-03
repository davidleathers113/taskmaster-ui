/**
 * IPC Context Provider for Electron API Status Management (2025)
 * 
 * This context provides application-wide access to IPC availability status,
 * connection health monitoring, and centralized IPC error handling.
 * 
 * Following 2025 React patterns for context management and error boundaries.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { ipcWrapper, IPCErrorCode, type IPCResponse } from '@/lib/ipc';

// IPC Context state interface
export interface IPCContextState {
  // Connection status
  isAvailable: boolean;
  isHealthy: boolean;
  availableMethods: string[];
  lastHealthCheck: Date | null;
  
  // Error tracking
  errorCount: number;
  lastError: string | null;
  connectionErrors: number;
  
  // Status monitoring
  isMonitoring: boolean;
  healthCheckInterval: number;
  
  // Methods
  refreshStatus: () => Promise<void>;
  performHealthCheck: () => Promise<boolean>;
  reportError: (error: string, context?: any) => void;
  clearErrors: () => void;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

// Default context state
const defaultContextState: IPCContextState = {
  isAvailable: false,
  isHealthy: false,
  availableMethods: [],
  lastHealthCheck: null,
  errorCount: 0,
  lastError: null,
  connectionErrors: 0,
  isMonitoring: false,
  healthCheckInterval: 30000, // 30 seconds
  refreshStatus: async () => {},
  performHealthCheck: async () => false,
  reportError: () => {},
  clearErrors: () => {},
  startMonitoring: () => {},
  stopMonitoring: () => {}
};

// Create context
const IPCContext = createContext<IPCContextState>(defaultContextState);

// Provider props
interface IPCProviderProps {
  children: ReactNode;
  healthCheckInterval?: number;
  autoStartMonitoring?: boolean;
  onConnectionLost?: () => void;
  onConnectionRestored?: () => void;
  onError?: (error: string, context?: any) => void;
}

/**
 * IPC Provider component that manages Electron API connection status
 */
export function IPCProvider({
  children,
  healthCheckInterval = 30000,
  autoStartMonitoring = true,
  onConnectionLost,
  onConnectionRestored,
  onError
}: IPCProviderProps) {
  // Core state
  const [isAvailable, setIsAvailable] = useState(false);
  const [isHealthy, setIsHealthy] = useState(false);
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);
  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);
  
  // Error tracking
  const [errorCount, setErrorCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [connectionErrors, setConnectionErrors] = useState(0);
  
  // Monitoring state
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitoringInterval, setMonitoringInterval] = useState<NodeJS.Timeout | null>(null);

  /**
   * Perform comprehensive health check of IPC connection
   */
  const performHealthCheck = useCallback(async (): Promise<boolean> => {
    try {
      // Check basic availability
      const available = ipcWrapper.isAvailable();
      setIsAvailable(available);
      
      if (!available) {
        setIsHealthy(false);
        setAvailableMethods([]);
        setConnectionErrors(prev => prev + 1);
        
        if (isHealthy) {
          // Connection was healthy, now lost
          onConnectionLost?.();
        }
        
        setLastHealthCheck(new Date());
        return false;
      }

      // Get available methods
      const methods = ipcWrapper.getAvailableMethods();
      setAvailableMethods(methods);

      // Test a basic method to ensure IPC is working
      let healthy = true;
      if (methods.length > 0) {
        try {
          // Try a lightweight method that should always work
          const testMethod = methods.includes('getVersion') ? 'getVersion' : methods[0];
          const response: IPCResponse = await ipcWrapper.invoke(testMethod);
          healthy = response.success;
          
          if (!healthy && response.error) {
            setLastError(`Health check failed: ${response.error.message}`);
            setErrorCount(prev => prev + 1);
          }
        } catch (error) {
          healthy = false;
          setLastError(`Health check error: ${error}`);
          setErrorCount(prev => prev + 1);
          setConnectionErrors(prev => prev + 1);
        }
      }

      const wasHealthy = isHealthy;
      setIsHealthy(healthy);
      
      // Connection state change notifications
      if (!wasHealthy && healthy) {
        onConnectionRestored?.();
        setConnectionErrors(0); // Reset connection error count on recovery
      } else if (wasHealthy && !healthy) {
        onConnectionLost?.();
        setConnectionErrors(prev => prev + 1);
      }

      setLastHealthCheck(new Date());
      return healthy;

    } catch (error) {
      setIsAvailable(false);
      setIsHealthy(false);
      setConnectionErrors(prev => prev + 1);
      setLastError(`Health check exception: ${error}`);
      setErrorCount(prev => prev + 1);
      setLastHealthCheck(new Date());
      
      if (isHealthy) {
        onConnectionLost?.();
      }
      
      return false;
    }
  }, [isHealthy, onConnectionLost, onConnectionRestored]);

  /**
   * Refresh IPC status manually
   */
  const refreshStatus = useCallback(async (): Promise<void> => {
    await performHealthCheck();
  }, [performHealthCheck]);

  /**
   * Report an error from IPC operations
   */
  const reportError = useCallback((error: string, context?: any) => {
    setLastError(error);
    setErrorCount(prev => prev + 1);
    
    // Call external error handler
    onError?.(error, context);
    
    // If it's a connection-related error, increment connection errors
    if (error.toLowerCase().includes('connection') || 
        error.toLowerCase().includes('unavailable') ||
        error.toLowerCase().includes('timeout')) {
      setConnectionErrors(prev => prev + 1);
    }
  }, [onError]);

  /**
   * Clear error counters and messages
   */
  const clearErrors = useCallback(() => {
    setErrorCount(0);
    setLastError(null);
    setConnectionErrors(0);
  }, []);

  /**
   * Start continuous health monitoring
   */
  const startMonitoring = useCallback(() => {
    if (isMonitoring || monitoringInterval) return;
    
    setIsMonitoring(true);
    
    // Perform initial health check
    performHealthCheck();
    
    // Set up interval for continuous monitoring
    const interval = setInterval(() => {
      performHealthCheck();
    }, healthCheckInterval);
    
    setMonitoringInterval(interval);
  }, [isMonitoring, monitoringInterval, performHealthCheck, healthCheckInterval]);

  /**
   * Stop health monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring || !monitoringInterval) return;
    
    clearInterval(monitoringInterval);
    setMonitoringInterval(null);
    setIsMonitoring(false);
  }, [isMonitoring, monitoringInterval]);

  // Initialize monitoring on mount if auto-start is enabled
  useEffect(() => {
    if (autoStartMonitoring) {
      startMonitoring();
    }

    // Cleanup on unmount
    return () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
    };
  }, [autoStartMonitoring, startMonitoring]);

  // Listen for window focus to perform health check
  useEffect(() => {
    const handleFocus = () => {
      // Perform health check when window regains focus
      if (isMonitoring) {
        performHealthCheck();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isMonitoring, performHealthCheck]);

  // Context value
  const contextValue: IPCContextState = {
    isAvailable,
    isHealthy,
    availableMethods,
    lastHealthCheck,
    errorCount,
    lastError,
    connectionErrors,
    isMonitoring,
    healthCheckInterval,
    refreshStatus,
    performHealthCheck,
    reportError,
    clearErrors,
    startMonitoring,
    stopMonitoring
  };

  return (
    <IPCContext.Provider value={contextValue}>
      {children}
    </IPCContext.Provider>
  );
}

/**
 * Hook to access IPC context
 */
export function useIPC(): IPCContextState {
  const context = useContext(IPCContext);
  
  if (!context) {
    throw new Error('useIPC must be used within an IPCProvider');
  }
  
  return context;
}

/**
 * Hook for components that require IPC to be available
 */
export function useRequireIPC(fallbackMessage?: string) {
  const ipc = useIPC();
  
  useEffect(() => {
    if (!ipc.isAvailable) {
      console.warn(
        fallbackMessage || 
        'Component requires IPC but Electron API is not available'
      );
    }
  }, [ipc.isAvailable, fallbackMessage]);
  
  return {
    ...ipc,
    isRequired: true,
    fallbackMessage: fallbackMessage || 'This feature requires the desktop application'
  };
}

/**
 * Hook for safe IPC operations with automatic error reporting
 */
export function useSafeIPC() {
  const { reportError, isAvailable, isHealthy } = useIPC();
  
  const safeInvoke = useCallback(async <T = any>(
    methodName: string,
    ...args: any[]
  ): Promise<IPCResponse<T>> => {
    try {
      const response = await ipcWrapper.invoke<T>(methodName, ...args);
      
      // Report errors to context
      if (!response.success && response.error) {
        reportError(
          `${response.error.code}: ${response.error.message}`,
          { methodName, args, error: response.error }
        );
      }
      
      return response;
    } catch (error) {
      const errorMessage = `IPC invoke failed: ${error}`;
      reportError(errorMessage, { methodName, args, error });
      
      return {
        success: false,
        error: {
          code: IPCErrorCode.SYSTEM_ERROR,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          retryable: true
        }
      };
    }
  }, [reportError]);
  
  return {
    invoke: safeInvoke,
    isAvailable,
    isHealthy,
    reportError
  };
}

export default IPCContext;