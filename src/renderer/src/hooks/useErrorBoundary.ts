/**
 * Error Boundary Hook (2025)
 * 
 * Custom React hook that provides comprehensive error boundary functionality
 * with MUI integration, user feedback mechanisms, and state preservation.
 * Combines error handling patterns for seamless error recovery experience.
 * 
 * Features:
 * - Integration with MUI error boundary components
 * - Automatic error reporting and user feedback collection
 * - State preservation and restoration during errors
 * - Error categorization and smart recovery strategies
 * - Performance monitoring and error analytics
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useErrorHandler } from 'react-error-boundary';
import { errorReportingService, ErrorContext, UserFeedback } from '../services/ErrorReportingService';
import { useAppState } from './useAppState';
import { errorHandlingConfig, classifyError, getErrorMessage } from '../config/errorHandling';

// Error boundary state
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  errorType: string;
  retryCount: number;
  lastRetryTime: number | null;
  canRetry: boolean;
  autoRecoveryInProgress: boolean;
  userFeedbackSubmitted: boolean;
}

// Error recovery strategy
export interface ErrorRecoveryStrategy {
  id: string;
  name: string;
  description: string;
  automatic: boolean;
  priority: number;
  canExecute: (error: Error, state: ErrorBoundaryState) => boolean;
  execute: () => Promise<boolean>;
}

// Error handling options
export interface UseErrorBoundaryOptions {
  enableAutoRecovery?: boolean;
  enableUserFeedback?: boolean;
  enableStatePreservation?: boolean;
  maxRetryAttempts?: number;
  retryDelay?: number;
  isolationLevel?: 'component' | 'feature' | 'page';
  enableErrorReporting?: boolean;
  enableMUIIntegration?: boolean;
  customRecoveryStrategies?: ErrorRecoveryStrategy[];
  onError?: (error: Error, errorInfo: any) => void;
  onRecover?: (strategy: string) => void;
  onRetry?: (attempt: number) => void;
}

// Default options
const _defaultOptions: Required<UseErrorBoundaryOptions> = {
  enableAutoRecovery: errorHandlingConfig.errorBoundary.enableAutoRecovery,
  enableUserFeedback: errorHandlingConfig.userFeedback.enableUserReporting,
  enableStatePreservation: errorHandlingConfig.errorBoundary.enableStatePreservation,
  maxRetryAttempts: errorHandlingConfig.errorBoundary.maxRetryAttempts,
  retryDelay: errorHandlingConfig.errorBoundary.retryDelayMs,
  isolationLevel: errorHandlingConfig.errorBoundary.isolationLevel as 'component' | 'feature' | 'page',
  enableErrorReporting: errorHandlingConfig.global.enableErrorBoundaries,
  enableMUIIntegration: true,
  customRecoveryStrategies: [],
  onError: () => {},
  onRecover: () => {},
  onRetry: () => {},
};

/**
 * Error Boundary Hook
 */
export const _useErrorBoundary = (options: UseErrorBoundaryOptions = {}) => {
  const config = { ..._defaultOptions, ...options };
  
  // Hooks
  const reactErrorHandler = useErrorHandler();
  const { preserveOnError, restoreState, availableSessions } = useAppState({
    enableAutoPreservation: config.enableStatePreservation,
  });

  // State
  const [errorState, setErrorState] = useState<ErrorBoundaryState>({
    hasError: false,
    error: null,
    errorId: null,
    errorType: 'unknown',
    retryCount: 0,
    lastRetryTime: null,
    canRetry: true,
    autoRecoveryInProgress: false,
    userFeedbackSubmitted: false,
  });

  const [recoveryStrategies] = useState<ErrorRecoveryStrategy[]>([
    ...getDefaultRecoveryStrategies(),
    ...config.customRecoveryStrategies,
  ]);

  // Refs for stable references
  const autoRecoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorHistoryRef = useRef<Error[]>([]);

  /**
   * Handle error with comprehensive error boundary logic
   */
  const handleError = useCallback(async (
    error: Error,
    context: Partial<ErrorContext> = {}
  ) => {
    const errorType = classifyError(error);
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    // Add to error history
    errorHistoryRef.current.push(error);
    if (errorHistoryRef.current.length > 10) {
      errorHistoryRef.current.shift(); // Keep only last 10 errors
    }

    // Update error state
    setErrorState(prev => ({
      ...prev,
      hasError: true,
      error,
      errorId,
      errorType,
      canRetry: prev.retryCount < config.maxRetryAttempts,
      autoRecoveryInProgress: false,
      userFeedbackSubmitted: false,
    }));

    // Preserve state if enabled
    if (config.enableStatePreservation) {
      try {
        await preserveOnError(error, errorId);
      } catch (preservationError) {
        console.error('Failed to preserve state on error:', preservationError);
      }
    }

    // Report error if enabled
    if (config.enableErrorReporting) {
      try {
        await errorReportingService.reportError(error, undefined, {
          ...context,
          component: 'useErrorBoundary',
          action: 'error_caught',
          severity: getSeverityFromError(error),
          metadata: {
            errorId,
            errorType,
            isolationLevel: config.isolationLevel,
            retryCount: errorState.retryCount,
          }
        });
      } catch (reportingError) {
        console.error('Failed to report error:', reportingError);
      }
    }

    // Call custom error handler
    config.onError(error, { errorId, errorType });

    // Attempt automatic recovery if enabled
    if (config.enableAutoRecovery && errorState.canRetry) {
      attemptAutoRecovery(error);
    }

    // Use React error boundary as fallback
    reactErrorHandler(error);
  }, [
    config,
    errorState.retryCount,
    errorState.canRetry,
    preserveOnError,
    reactErrorHandler
  ]);

  /**
   * Attempt automatic recovery using available strategies
   */
  const attemptAutoRecovery = useCallback(async (error: Error) => {
    if (errorState.autoRecoveryInProgress) return;

    setErrorState(prev => ({ ...prev, autoRecoveryInProgress: true }));

    try {
      // Find applicable automatic recovery strategies
      const applicableStrategies = recoveryStrategies
        .filter(strategy => 
          strategy.automatic && 
          strategy.canExecute(error, errorState)
        )
        .sort((a, b) => b.priority - a.priority);

      for (const strategy of applicableStrategies) {
        try {
          console.debug(`Attempting recovery strategy: ${strategy.name}`);
          const success = await strategy.execute();
          
          if (success) {
            console.debug(`Recovery successful with strategy: ${strategy.name}`);
            await handleRecovery(strategy.id);
            return;
          }
        } catch (strategyError) {
          console.warn(`Recovery strategy ${strategy.name} failed:`, strategyError);
        }
      }

      // If no strategy succeeded, try exponential backoff retry
      const delay = config.retryDelay * Math.pow(2, errorState.retryCount);
      autoRecoveryTimeoutRef.current = setTimeout(() => {
        handleRetry();
      }, delay);

    } finally {
      setErrorState(prev => ({ ...prev, autoRecoveryInProgress: false }));
    }
  }, [errorState, recoveryStrategies, config.retryDelay]);

  /**
   * Handle successful recovery
   */
  const handleRecovery = useCallback(async (strategyId: string) => {
    setErrorState({
      hasError: false,
      error: null,
      errorId: null,
      errorType: 'unknown',
      retryCount: 0,
      lastRetryTime: null,
      canRetry: true,
      autoRecoveryInProgress: false,
      userFeedbackSubmitted: false,
    });

    // Report successful recovery
    if (config.enableErrorReporting) {
      try {
        await errorReportingService.reportError(
          new Error('Error recovery successful'),
          undefined,
          {
            component: 'useErrorBoundary',
            action: 'recovery_successful',
            severity: 'low',
            metadata: { strategyId, retryCount: errorState.retryCount }
          }
        );
      } catch (error) {
        console.error('Failed to report recovery:', error);
      }
    }

    config.onRecover(strategyId);
  }, [config, errorState.retryCount]);

  /**
   * Manual retry operation
   */
  const handleRetry = useCallback(async () => {
    if (!errorState.canRetry) return;

    const newRetryCount = errorState.retryCount + 1;
    const canRetryAgain = newRetryCount < config.maxRetryAttempts;

    setErrorState(prev => ({
      ...prev,
      retryCount: newRetryCount,
      lastRetryTime: Date.now(),
      canRetry: canRetryAgain,
      hasError: false,
      autoRecoveryInProgress: false,
    }));

    config.onRetry(newRetryCount);

    // If we've exhausted retries, try state restoration
    if (!canRetryAgain && availableSessions.length > 0) {
      try {
        await restoreState();
        await handleRecovery('state_restoration');
      } catch (error) {
        console.error('State restoration failed:', error);
      }
    }
  }, [
    errorState.canRetry,
    errorState.retryCount,
    config.maxRetryAttempts,
    config.onRetry,
    availableSessions,
    restoreState,
    handleRecovery
  ]);

  /**
   * Submit user feedback for error
   */
  const submitUserFeedback = useCallback(async (
    feedbackData: Omit<UserFeedback, 'reportId' | 'timestamp'>
  ): Promise<boolean> => {
    if (!errorState.errorId || errorState.userFeedbackSubmitted) {
      return false;
    }

    try {
      const userFeedback: Omit<UserFeedback, 'timestamp'> = {
        reportId: errorState.errorId,
        ...feedbackData,
      };

      const success = await errorReportingService.submitUserFeedback(userFeedback);
      
      if (success) {
        setErrorState(prev => ({ ...prev, userFeedbackSubmitted: true }));
      }

      return success;
    } catch (error) {
      console.error('Failed to submit user feedback:', error);
      return false;
    }
  }, [errorState.errorId, errorState.userFeedbackSubmitted]);

  /**
   * Reset error boundary state
   */
  const resetErrorBoundary = useCallback(() => {
    if (autoRecoveryTimeoutRef.current) {
      clearTimeout(autoRecoveryTimeoutRef.current);
      autoRecoveryTimeoutRef.current = null;
    }

    setErrorState({
      hasError: false,
      error: null,
      errorId: null,
      errorType: 'unknown',
      retryCount: 0,
      lastRetryTime: null,
      canRetry: true,
      autoRecoveryInProgress: false,
      userFeedbackSubmitted: false,
    });
  }, []);

  /**
   * Get error statistics
   */
  const getErrorStats = useCallback(() => {
    return {
      totalErrors: errorHistoryRef.current.length,
      currentRetryCount: errorState.retryCount,
      canRetry: errorState.canRetry,
      hasActiveError: errorState.hasError,
      autoRecoveryEnabled: config.enableAutoRecovery,
      lastError: errorState.error,
      errorType: errorState.errorType,
      userFeedbackSubmitted: errorState.userFeedbackSubmitted,
    };
  }, [errorState, config.enableAutoRecovery]);

  /**
   * Get user-friendly error message
   */
  const getDisplayErrorMessage = useCallback(() => {
    if (!errorState.error) return '';
    return getErrorMessage(errorState.error);
  }, [errorState.error]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoRecoveryTimeoutRef.current) {
        clearTimeout(autoRecoveryTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    errorState,
    hasError: errorState.hasError,
    error: errorState.error,
    errorId: errorState.errorId,
    errorType: errorState.errorType,
    canRetry: errorState.canRetry,
    isRecovering: errorState.autoRecoveryInProgress,

    // Actions
    handleError,
    handleRetry,
    resetErrorBoundary,
    submitUserFeedback,

    // Utilities
    getErrorStats,
    getDisplayErrorMessage,
    recoveryStrategies,
  };
};

/**
 * Get default recovery strategies
 */
function getDefaultRecoveryStrategies(): ErrorRecoveryStrategy[] {
  return [
    {
      id: 'page_reload',
      name: 'Page Reload',
      description: 'Reload the entire page to recover from critical errors',
      automatic: false,
      priority: 1,
      canExecute: (error, state) => state.retryCount >= 2,
      execute: async () => {
        window.location.reload();
        return true;
      },
    },
    {
      id: 'state_restoration',
      name: 'State Restoration',
      description: 'Restore application state from previous backup',
      automatic: true,
      priority: 5,
      canExecute: (error, state) => state.retryCount >= 1,
      execute: async () => {
        // This would be implemented with proper state restoration logic
        return false;
      },
    },
    {
      id: 'component_remount',
      name: 'Component Remount',
      description: 'Force remount the component tree',
      automatic: true,
      priority: 3,
      canExecute: (error, state) => true,
      execute: async () => {
        // This would trigger a component remount
        return false;
      },
    },
    {
      id: 'clear_storage',
      name: 'Clear Storage',
      description: 'Clear browser storage to resolve data conflicts',
      automatic: false,
      priority: 2,
      canExecute: (error, state) => 
        error.message.includes('storage') || 
        error.message.includes('quota'),
      execute: async () => {
        try {
          localStorage.clear();
          sessionStorage.clear();
          return true;
        } catch {
          return false;
        }
      },
    },
  ];
}

/**
 * Get error severity from error object
 */
function getSeverityFromError(error: Error): 'low' | 'medium' | 'high' | 'critical' {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  if (name.includes('typeerror') || name.includes('referenceerror')) {
    return 'critical';
  }

  if (message.includes('network') || message.includes('timeout')) {
    return 'medium';
  }

  if (message.includes('validation') || message.includes('parse')) {
    return 'low';
  }

  return 'medium';
}

// Export hook and types
export default _useErrorBoundary;
export type {
  ErrorBoundaryState,
  ErrorRecoveryStrategy,
  UseErrorBoundaryOptions
};
