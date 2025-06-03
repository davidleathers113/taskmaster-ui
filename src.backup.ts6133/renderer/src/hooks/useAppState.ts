/**
 * Application State Hook (2025)
 * 
 * Custom React hook for managing application state during error scenarios.
 * Provides seamless state preservation, restoration, and recovery mechanisms
 * with integration to Zustand stores and session management.
 * 
 * Features:
 * - Automatic state preservation on errors
 * - Intelligent state restoration
 * - Integration with error boundaries
 * - Cross-component state synchronization
 * - Performance-optimized state handling
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { sessionPreservationManager, SessionData, preserveCurrentSession } from '../utils/sessionPreservation';
import { errorReportingService } from '../services/ErrorReportingService';
import { errorHandlingConfig } from '../config/errorHandling';

// App state interface
export interface AppState {
  tasks: any;
  ui: {
    currentView: string;
    sidebarOpen: boolean;
    theme: string;
    filters: any;
    search: string;
    selectedTasks: string[];
  };
  user: {
    preferences: any;
    settings: any;
    profile?: any;
  };
  navigation: {
    history: string[];
    currentPath: string;
    previousPath?: string;
  };
  forms: Record<string, any>;
  errors: {
    count: number;
    lastError?: Error;
    recoveryAttempts: number;
  };
}

// State preservation result
export interface StatePreservationResult {
  sessionId: string;
  success: boolean;
  dataSize: number;
  timestamp: number;
}

// State restoration result
export interface StateRestorationResult {
  success: boolean;
  sessionId: string;
  restoredData: any;
  partialRestore: boolean;
  errors: string[];
}

// Hook options
export interface UseAppStateOptions {
  enableAutoPreservation?: boolean;
  enablePeriodicBackup?: boolean;
  backupInterval?: number;
  enableErrorReporting?: boolean;
  preserveOnUnload?: boolean;
  restoreOnMount?: boolean;
  enableCrossTabSync?: boolean;
}

// Default options
const defaultOptions: Required<UseAppStateOptions> = {
  enableAutoPreservation: true,
  enablePeriodicBackup: false,
  backupInterval: 30000, // 30 seconds
  enableErrorReporting: true,
  preserveOnUnload: true,
  restoreOnMount: true,
  enableCrossTabSync: false,
};

/**
 * Application State Management Hook
 */
export const useAppState = (options: UseAppStateOptions = {}) => {
  const config = { ...defaultOptions, ...options };
  
  // Store references
  // Get the actual store instance for getState/setState access
  const taskStore = useTaskStore;
  
  // State
  const [isPreserving, setIsPreserving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastPreservation, setLastPreservation] = useState<StatePreservationResult | null>(null);
  const [availableSessions, setAvailableSessions] = useState<SessionData[]>([]);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(config.enablePeriodicBackup);
  
  // Refs for stable references
  const preservationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef(0);
  const lastErrorRef = useRef<Error | null>(null);

  /**
   * Get current application state
   */
  const getCurrentAppState = useCallback((): AppState => {
    const taskState = taskStore.getState();
    
    return {
      tasks: {
        tasks: taskState.tasks,
        filters: taskState.filters,
        viewMode: taskState.viewMode,
        analytics: taskState.analytics,
      },
      ui: {
        currentView: window.location.pathname,
        sidebarOpen: taskState.sidebarOpen || false,
        theme: taskState.theme || 'system',
        filters: taskState.filters,
        search: taskState.searchQuery || '',
        selectedTasks: taskState.selectedTaskIds || [],
      },
      user: {
        preferences: taskState.userPreferences || {},
        settings: taskState.settings || {},
      },
      navigation: {
        history: [window.location.pathname],
        currentPath: window.location.pathname,
        previousPath: document.referrer ? new URL(document.referrer).pathname : undefined,
      },
      forms: extractFormData(),
      errors: {
        count: errorCountRef.current,
        lastError: lastErrorRef.current,
        recoveryAttempts: 0,
      },
    };
  }, [taskStore]);

  /**
   * Preserve current application state
   */
  const preserveState = useCallback(async (
    reason: string = 'manual',
    errorId?: string
  ): Promise<StatePreservationResult> => {
    if (isPreserving) {
      throw new Error('State preservation already in progress');
    }

    setIsPreserving(true);

    try {
      const appState = getCurrentAppState();
      const sessionId = await sessionPreservationManager.preserveSession(
        reason,
        errorId,
        { appState }
      );

      const result: StatePreservationResult = {
        sessionId,
        success: true,
        dataSize: JSON.stringify(appState).length,
        timestamp: Date.now(),
      };

      setLastPreservation(result);
      
      // Report preservation if enabled
      if (config.enableErrorReporting && reason.includes('error')) {
        errorReportingService.reportError(
          new Error(`State preserved due to: ${reason}`),
          undefined,
          {
            component: 'useAppState',
            action: 'state_preservation',
            severity: 'medium',
            metadata: { sessionId, dataSize: result.dataSize }
          }
        );
      }

      console.debug('State preserved successfully:', result);
      return result;

    } catch (error) {
      console.error('Failed to preserve state:', error);
      
      const result: StatePreservationResult = {
        sessionId: '',
        success: false,
        dataSize: 0,
        timestamp: Date.now(),
      };

      if (config.enableErrorReporting) {
        errorReportingService.reportError(
          error as Error,
          undefined,
          {
            component: 'useAppState',
            action: 'state_preservation_failed',
            severity: 'high'
          }
        );
      }

      return result;
    } finally {
      setIsPreserving(false);
    }
  }, [isPreserving, getCurrentAppState, config.enableErrorReporting]);

  /**
   * Restore application state from session
   */
  const restoreState = useCallback(async (
    sessionId?: string
  ): Promise<StateRestorationResult> => {
    if (isRestoring) {
      throw new Error('State restoration already in progress');
    }

    setIsRestoring(true);

    try {
      let targetSessionId = sessionId;
      
      // If no session ID provided, get the most recent one
      if (!targetSessionId) {
        const sessions = await sessionPreservationManager.getSessions();
        if (sessions.length === 0) {
          throw new Error('No preserved sessions available');
        }
        targetSessionId = sessions[0].id;
      }

      const restoredData = await sessionPreservationManager.restoreSession(targetSessionId);
      const appState = restoredData.custom?.appState;

      if (!appState) {
        throw new Error('No application state found in session');
      }

      const errors: string[] = [];
      let partialRestore = false;

      // Restore task store state
      try {
        if (appState.tasks) {
          // Use batch update for better performance
          taskStore.setState({
            tasks: appState.tasks.tasks || taskStore.getState().tasks,
            filters: appState.tasks.filters || taskStore.getState().filters,
            viewMode: appState.tasks.viewMode || taskStore.getState().viewMode,
            searchQuery: appState.ui?.search || taskStore.getState().searchQuery,
            sidebarCollapsed: appState.ui?.sidebarOpen === false,
            userSettings: appState.user?.preferences || taskStore.getState().userSettings,
          });
        }
      } catch (error) {
        console.warn('Failed to restore task store state:', error);
        errors.push('Task store restoration failed');
        partialRestore = true;
      }

      // Restore navigation state
      try {
        if (appState.navigation?.currentPath && 
            appState.navigation.currentPath !== window.location.pathname) {
          // Only navigate if it's different from current path
          window.history.pushState(null, '', appState.navigation.currentPath);
        }
      } catch (error) {
        console.warn('Failed to restore navigation state:', error);
        errors.push('Navigation restoration failed');
        partialRestore = true;
      }

      // Restore form data
      try {
        if (appState.forms) {
          restoreFormData(appState.forms);
        }
      } catch (error) {
        console.warn('Failed to restore form data:', error);
        errors.push('Form data restoration failed');
        partialRestore = true;
      }

      // Restore localStorage data if available
      try {
        if (restoredData.localStorage) {
          Object.entries(restoredData.localStorage).forEach(([key, value]) => {
            try {
              localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            } catch (error) {
              console.warn(`Failed to restore localStorage key "${key}":`, error);
            }
          });
        }
      } catch (error) {
        console.warn('Failed to restore localStorage data:', error);
        errors.push('Local storage restoration failed');
        partialRestore = true;
      }

      const result: StateRestorationResult = {
        success: true,
        sessionId: targetSessionId,
        restoredData: appState,
        partialRestore,
        errors,
      };

      if (config.enableErrorReporting) {
        errorReportingService.reportError(
          new Error('State restored from session'),
          undefined,
          {
            component: 'useAppState',
            action: 'state_restoration',
            severity: 'low',
            metadata: { 
              sessionId: targetSessionId, 
              partialRestore,
              errorCount: errors.length 
            }
          }
        );
      }

      console.debug('State restored successfully:', result);
      return result;

    } catch (error) {
      console.error('Failed to restore state:', error);
      
      const result: StateRestorationResult = {
        success: false,
        sessionId: sessionId || '',
        restoredData: null,
        partialRestore: false,
        errors: [error.message],
      };

      if (config.enableErrorReporting) {
        errorReportingService.reportError(
          error as Error,
          undefined,
          {
            component: 'useAppState',
            action: 'state_restoration_failed',
            severity: 'high',
            metadata: { sessionId }
          }
        );
      }

      return result;
    } finally {
      setIsRestoring(false);
    }
  }, [isRestoring, taskStore, config.enableErrorReporting]);

  /**
   * Auto-preserve state on error
   */
  const preserveOnError = useCallback(async (error: Error, errorId?: string) => {
    errorCountRef.current += 1;
    lastErrorRef.current = error;

    if (config.enableAutoPreservation && errorHandlingConfig.errorBoundary.enableStatePreservation) {
      try {
        await preserveState(`error_${error.name}`, errorId);
      } catch (preservationError) {
        console.error('Failed to preserve state on error:', preservationError);
      }
    }
  }, [config.enableAutoPreservation, preserveState]);

  /**
   * Clear all preserved sessions
   */
  const clearPreservedSessions = useCallback(async (): Promise<boolean> => {
    try {
      await sessionPreservationManager.clearSessions();
      setAvailableSessions([]);
      setLastPreservation(null);
      return true;
    } catch (error) {
      console.error('Failed to clear preserved sessions:', error);
      return false;
    }
  }, []);

  /**
   * Get available sessions for restoration
   */
  const refreshAvailableSessions = useCallback(async () => {
    try {
      const sessions = await sessionPreservationManager.getSessions();
      setAvailableSessions(sessions);
    } catch (error) {
      console.error('Failed to refresh available sessions:', error);
    }
  }, []);

  /**
   * Toggle automatic backup
   */
  const toggleAutoBackup = useCallback((enabled?: boolean) => {
    const newState = enabled ?? !autoBackupEnabled;
    setAutoBackupEnabled(newState);

    if (newState && config.enablePeriodicBackup) {
      // Start periodic backup
      preservationIntervalRef.current = setInterval(() => {
        preserveState('periodic_backup').catch(error => {
          console.error('Periodic backup failed:', error);
        });
      }, config.backupInterval);
    } else if (preservationIntervalRef.current) {
      // Stop periodic backup
      clearInterval(preservationIntervalRef.current);
      preservationIntervalRef.current = null;
    }
  }, [autoBackupEnabled, config.enablePeriodicBackup, config.backupInterval, preserveState]);

  // Setup automatic state preservation on mount
  useEffect(() => {
    // Restore state on mount if enabled and sessions are available
    if (config.restoreOnMount) {
      refreshAvailableSessions().then(() => {
        sessionPreservationManager.getSessions().then(sessions => {
          if (sessions.length > 0) {
            // Check if we should automatically restore the most recent session
            const mostRecent = sessions[0];
            const timeSincePreservation = Date.now() - mostRecent.timestamp;
            
            // Auto-restore if session is less than 5 minutes old and was preserved due to error
            if (timeSincePreservation < 300000 && mostRecent.metadata.preservationReason.includes('error')) {
              restoreState(mostRecent.id).catch(error => {
                console.warn('Auto-restoration failed:', error);
              });
            }
          }
        });
      });
    }

    // Setup periodic backup if enabled
    if (config.enablePeriodicBackup && autoBackupEnabled) {
      toggleAutoBackup(true);
    }

    // Setup unload preservation
    if (config.preserveOnUnload) {
      const handleBeforeUnload = () => {
        preserveCurrentSession('page_unload').catch(error => {
          console.error('Failed to preserve state on page unload:', error);
        });
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        if (preservationIntervalRef.current) {
          clearInterval(preservationIntervalRef.current);
        }
      };
    }

    return () => {
      if (preservationIntervalRef.current) {
        clearInterval(preservationIntervalRef.current);
      }
    };
  }, [config, autoBackupEnabled, toggleAutoBackup, restoreState, refreshAvailableSessions]);

  // Return hook interface
  return {
    // State
    currentState: getCurrentAppState(),
    isPreserving,
    isRestoring,
    lastPreservation,
    availableSessions,
    autoBackupEnabled,

    // Actions
    preserveState,
    restoreState,
    preserveOnError,
    clearPreservedSessions,
    refreshAvailableSessions,
    toggleAutoBackup,

    // Utilities
    stats: sessionPreservationManager.getStats(),
  };
};

/**
 * Extract form data from current page
 */
function extractFormData(): Record<string, any> {
  const formData: Record<string, any> = {};
  
  try {
    const forms = document.querySelectorAll('form');
    forms.forEach((form, index) => {
      const formId = form.id || `form_${index}`;
      const formValues: Record<string, any> = {};
      
      const inputs = form.querySelectorAll('input, textarea, select');
      inputs.forEach((input: any) => {
        if (input.name && input.type !== 'password') {
          formValues[input.name] = input.value;
        }
      });
      
      if (Object.keys(formValues).length > 0) {
        formData[formId] = formValues;
      }
    });
  } catch (error) {
    console.warn('Failed to extract form data:', error);
  }
  
  return formData;
}

/**
 * Restore form data to current page
 */
function restoreFormData(formData: Record<string, any>): void {
  try {
    Object.entries(formData).forEach(([formId, values]) => {
      const form = document.getElementById(formId) || 
                   document.querySelectorAll('form')[parseInt(formId.replace('form_', ''))];
      
      if (form && values) {
        Object.entries(values).forEach(([name, value]) => {
          const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement;
          if (input && input.type !== 'password') {
            input.value = value as string;
          }
        });
      }
    });
  } catch (error) {
    console.warn('Failed to restore form data:', error);
  }
}

// Export hook and types
export default useAppState;
export type {
  AppState,
  StatePreservationResult,
  StateRestorationResult,
  UseAppStateOptions
};