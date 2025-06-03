import { ErrorInfo } from 'react';

// 2025 TypeScript Error Categorization for Production
export type ErrorCategory = 
  | 'UI_COMPONENT_ERROR'
  | 'DATA_FETCH_ERROR' 
  | 'VALIDATION_ERROR'
  | 'PERMISSION_ERROR'
  | 'NETWORK_ERROR'
  | 'STORE_ERROR'
  | 'IPC_ERROR'
  | 'UNKNOWN_ERROR';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AppError extends Error {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  context?: Record<string, any>;
  timestamp: string;
  userId?: string;
  sessionId?: string;
}

export interface ErrorContext {
  componentName?: string;
  viewType?: string;
  userActions?: string[];
  storeState?: any;
  route?: string;
  userAgent?: string;
  timestamp: string;
}

// Error reporting throttling to prevent spam
const errorReportingThrottle = new Map<string, number>();
const THROTTLE_DURATION = 5000; // 5 seconds

/**
 * Creates a standardized AppError with proper categorization
 */
export function createAppError(
  message: string,
  category: ErrorCategory,
  severity: ErrorSeverity,
  code: string,
  originalError?: Error,
  context?: Record<string, any>
): AppError {
  const error = new Error(message) as AppError;
  
  // Preserve original stack trace if available
  if (originalError?.stack) {
    error.stack = originalError.stack;
  }
  
  error.category = category;
  error.severity = severity;
  error.code = code;
  error.context = context;
  error.timestamp = new Date().toISOString();
  
  // Add session info if available
  error.sessionId = getSessionId();
  error.userId = getUserId();
  
  return error;
}

/**
 * Enhanced error logging with context and throttling
 */
export function logError(
  error: Error | AppError,
  errorInfo?: ErrorInfo,
  additionalContext?: Partial<ErrorContext>
): void {
  const timestamp = new Date().toISOString();
  const errorKey = `${error.message}_${error.stack?.slice(0, 100)}`;
  
  // Throttle identical errors
  const lastReported = errorReportingThrottle.get(errorKey);
  if (lastReported && Date.now() - lastReported < THROTTLE_DURATION) {
    return;
  }
  
  errorReportingThrottle.set(errorKey, Date.now());
  
  const context: ErrorContext = {
    componentName: errorInfo?.componentStack?.split('\n')[1]?.trim(),
    userAgent: navigator.userAgent,
    route: window.location.pathname,
    timestamp,
    ...additionalContext
  };
  
  const errorReport = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      category: (error as AppError).category || 'UNKNOWN_ERROR',
      severity: (error as AppError).severity || 'medium',
      code: (error as AppError).code || 'ERR_UNKNOWN'
    },
    context,
    errorInfo: errorInfo ? {
      componentStack: errorInfo.componentStack
    } : undefined
  };
  
  // Development logging
  if (process.env.NODE_ENV === 'development') {
    console.group(`🚨 Error Report [${errorReport.error.category}]`);
    console.error('Error:', error);
    console.error('Context:', context);
    if (errorInfo) {
      console.error('React Error Info:', errorInfo);
    }
    console.groupEnd();
  }
  
  // Production error reporting
  if (process.env.NODE_ENV === 'production') {
    // Send to error monitoring service (Sentry, LogRocket, etc.)
    try {
      // Example implementation - replace with your service
      reportToMonitoringService(errorReport);
    } catch (reportingError) {
      // Fallback: store locally for later upload
      storeErrorLocally(errorReport);
    }
  }
}

/**
 * Reports errors to external monitoring service
 */
async function reportToMonitoringService(errorReport: any): Promise<void> {
  // Implementation would depend on your monitoring service
  // Example for a generic service:
  /*
  await fetch('/api/errors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(errorReport),
  });
  */
  
  // For now, just log that we would send it
  console.info('Would report to monitoring service:', errorReport);
}

/**
 * Stores errors locally when remote reporting fails
 */
function storeErrorLocally(errorReport: any): void {
  try {
    const errors = JSON.parse(localStorage.getItem('pending_errors') || '[]');
    errors.push(errorReport);
    
    // Keep only last 50 errors to avoid storage overflow
    if (errors.length > 50) {
      errors.splice(0, errors.length - 50);
    }
    
    localStorage.setItem('pending_errors', JSON.stringify(errors));
  } catch (storageError) {
    console.error('Failed to store error locally:', storageError);
  }
}

/**
 * Gets pending errors from local storage
 */
export function getPendingErrors(): any[] {
  try {
    return JSON.parse(localStorage.getItem('pending_errors') || '[]');
  } catch {
    return [];
  }
}

/**
 * Clears pending errors from local storage
 */
export function clearPendingErrors(): void {
  localStorage.removeItem('pending_errors');
}

/**
 * Helper functions for user/session identification
 */
function getSessionId(): string {
  // Generate or retrieve session ID
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
}

function getUserId(): string | undefined {
  // This would typically come from your auth system
  // For now, return undefined as we don't have user auth in this app
  return undefined;
}

/**
 * React Error Boundary specific error handler
 */
export function handleErrorBoundaryError(
  error: Error,
  errorInfo: ErrorInfo,
  componentLevel: 'app' | 'component' | 'route',
  viewType?: string
): void {
  const appError = createAppError(
    error.message,
    'UI_COMPONENT_ERROR',
    componentLevel === 'app' ? 'critical' : 'high',
    'ERR_COMPONENT_CRASH',
    error,
    {
      componentLevel,
      viewType
    }
  );
  
  logError(appError, errorInfo, {
    viewType,
    componentName: errorInfo.componentStack?.split('\n')[1]?.trim()
  });
}

/**
 * Utility to create view-specific error handlers
 */
export function createViewErrorHandler(viewType: string) {
  return (error: Error, errorInfo: ErrorInfo) => {
    handleErrorBoundaryError(error, errorInfo, 'component', viewType);
  };
}