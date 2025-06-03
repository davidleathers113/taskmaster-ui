/**
 * Error Handling Configuration (2025)
 * 
 * Centralized configuration for error handling, user feedback mechanisms,
 * and error reporting behavior across the application.
 * 
 * Features:
 * - Environment-specific configurations
 * - User feedback settings
 * - Error reporting thresholds
 * - Privacy and security settings
 * - Integration configurations
 */

import { ErrorReportingConfig } from '../services/ErrorReportingService';
import { MUIErrorBoundaryProps } from '../components/error/MUIErrorBoundary';

// Application error handling configuration
export interface AppErrorHandlingConfig {
  // Global error handling settings
  global: {
    enableErrorBoundaries: boolean;
    enableGlobalErrorHandlers: boolean;
    enableUnhandledRejectionHandling: boolean;
    maxErrorsPerSession: number;
    enableErrorPersistence: boolean;
  };

  // User feedback configuration
  userFeedback: {
    enableUserReporting: boolean;
    enableAnonymousReporting: boolean;
    requireEmailForReporting: boolean;
    enableScreenshotCapture: boolean;
    enableAutomaticContextCollection: boolean;
    maxFeedbackLength: number;
    enableOfflineFeedback: boolean;
  };

  // Error boundary behavior
  errorBoundary: {
    showDialogByDefault: boolean;
    showSnackbarByDefault: boolean;
    enableAutoRecovery: boolean;
    maxRetryAttempts: number;
    retryDelayMs: number;
    enableStatePreservation: boolean;
    isolationLevel: 'none' | 'component' | 'feature' | 'page';
  };

  // MUI-specific settings
  mui: {
    defaultSeverity: 'error' | 'warning' | 'info';
    autoHideDuration: number;
    maxDialogWidth: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    enableDetailedReporting: boolean;
    theme: 'light' | 'dark' | 'auto';
  };

  // Privacy and security
  privacy: {
    enableDataSanitization: boolean;
    enableStackTraceSanitization: boolean;
    excludeSensitiveData: boolean;
    enableDataEncryption: boolean;
    enableUserConsent: boolean;
    dataRetentionDays: number;
  };

  // Integration settings
  integrations: {
    sentry: {
      enabled: boolean;
      dsn?: string;
      environment?: string;
      sampleRate?: number;
    };
    customEndpoint: {
      enabled: boolean;
      url?: string;
      apiKey?: string;
      timeout?: number;
    };
  };

  // Error categories and filtering
  filtering: {
    ignoredErrors: string[];
    ignoredUrls: string[];
    ignoredUserAgents: string[];
    enabledEnvironments: string[];
    minimumSeverity: 'low' | 'medium' | 'high' | 'critical';
  };

  // Development settings
  development: {
    enableDetailedLogging: boolean;
    enableConsoleReporting: boolean;
    enableSourceMapSupport: boolean;
    enableComponentStackTraces: boolean;
    enablePerformanceTracking: boolean;
  };
}

// Environment-specific configurations
const developmentConfig: AppErrorHandlingConfig = {
  global: {
    enableErrorBoundaries: true,
    enableGlobalErrorHandlers: true,
    enableUnhandledRejectionHandling: true,
    maxErrorsPerSession: 50,
    enableErrorPersistence: true,
  },
  userFeedback: {
    enableUserReporting: true,
    enableAnonymousReporting: true,
    requireEmailForReporting: false,
    enableScreenshotCapture: false,
    enableAutomaticContextCollection: true,
    maxFeedbackLength: 1000,
    enableOfflineFeedback: true,
  },
  errorBoundary: {
    showDialogByDefault: true,
    showSnackbarByDefault: false,
    enableAutoRecovery: false,
    maxRetryAttempts: 3,
    retryDelayMs: 1000,
    enableStatePreservation: true,
    isolationLevel: 'component',
  },
  mui: {
    defaultSeverity: 'error',
    autoHideDuration: 8000,
    maxDialogWidth: 'md',
    enableDetailedReporting: true,
    theme: 'auto',
  },
  privacy: {
    enableDataSanitization: false,
    enableStackTraceSanitization: false,
    excludeSensitiveData: true,
    enableDataEncryption: false,
    enableUserConsent: false,
    dataRetentionDays: 7,
  },
  integrations: {
    sentry: {
      enabled: false,
    },
    customEndpoint: {
      enabled: false,
    },
  },
  filtering: {
    ignoredErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Script error.',
      'Non-Error promise rejection captured'
    ],
    ignoredUrls: [
      'chrome-extension://',
      'moz-extension://',
      'safari-extension://',
    ],
    ignoredUserAgents: [],
    enabledEnvironments: ['development'],
    minimumSeverity: 'low',
  },
  development: {
    enableDetailedLogging: true,
    enableConsoleReporting: true,
    enableSourceMapSupport: true,
    enableComponentStackTraces: true,
    enablePerformanceTracking: true,
  },
};

const productionConfig: AppErrorHandlingConfig = {
  global: {
    enableErrorBoundaries: true,
    enableGlobalErrorHandlers: true,
    enableUnhandledRejectionHandling: true,
    maxErrorsPerSession: 10,
    enableErrorPersistence: true,
  },
  userFeedback: {
    enableUserReporting: true,
    enableAnonymousReporting: true,
    requireEmailForReporting: false,
    enableScreenshotCapture: true,
    enableAutomaticContextCollection: true,
    maxFeedbackLength: 2000,
    enableOfflineFeedback: true,
  },
  errorBoundary: {
    showDialogByDefault: true,
    showSnackbarByDefault: true,
    enableAutoRecovery: true,
    maxRetryAttempts: 3,
    retryDelayMs: 2000,
    enableStatePreservation: true,
    isolationLevel: 'feature',
  },
  mui: {
    defaultSeverity: 'error',
    autoHideDuration: 6000,
    maxDialogWidth: 'sm',
    enableDetailedReporting: false,
    theme: 'auto',
  },
  privacy: {
    enableDataSanitization: true,
    enableStackTraceSanitization: true,
    excludeSensitiveData: true,
    enableDataEncryption: true,
    enableUserConsent: true,
    dataRetentionDays: 30,
  },
  integrations: {
    sentry: {
      enabled: true,
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: 'production',
      sampleRate: 0.1,
    },
    customEndpoint: {
      enabled: true,
      url: process.env.REACT_APP_ERROR_ENDPOINT,
      apiKey: process.env.REACT_APP_ERROR_API_KEY,
      timeout: 10000,
    },
  },
  filtering: {
    ignoredErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Script error.',
      'Non-Error promise rejection captured',
      'Network request failed',
      'Load failed',
      'ChunkLoadError'
    ],
    ignoredUrls: [
      'chrome-extension://',
      'moz-extension://',
      'safari-extension://',
      'webpack-internal://',
    ],
    ignoredUserAgents: [
      'bot',
      'crawler',
      'spider',
      'headless'
    ],
    enabledEnvironments: ['production', 'staging'],
    minimumSeverity: 'medium',
  },
  development: {
    enableDetailedLogging: false,
    enableConsoleReporting: false,
    enableSourceMapSupport: false,
    enableComponentStackTraces: false,
    enablePerformanceTracking: true,
  },
};

const stagingConfig: AppErrorHandlingConfig = {
  ...productionConfig,
  userFeedback: {
    ...productionConfig.userFeedback,
    enableScreenshotCapture: false,
  },
  mui: {
    ...productionConfig.mui,
    enableDetailedReporting: true,
  },
  privacy: {
    ...productionConfig.privacy,
    enableDataSanitization: false,
    enableStackTraceSanitization: false,
    enableUserConsent: false,
  },
  integrations: {
    sentry: {
      enabled: true,
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: 'staging',
      sampleRate: 0.5,
    },
    customEndpoint: {
      enabled: true,
      url: process.env.REACT_APP_ERROR_ENDPOINT,
      apiKey: process.env.REACT_APP_ERROR_API_KEY,
      timeout: 10000,
    },
  },
  filtering: {
    ...productionConfig.filtering,
    enabledEnvironments: ['staging'],
    minimumSeverity: 'low',
  },
  development: {
    enableDetailedLogging: true,
    enableConsoleReporting: true,
    enableSourceMapSupport: true,
    enableComponentStackTraces: true,
    enablePerformanceTracking: true,
  },
};

// Get environment-specific configuration
export function getErrorHandlingConfig(): AppErrorHandlingConfig {
  const environment = process.env.NODE_ENV || 'development';
  
  switch (environment) {
    case 'production':
      return productionConfig;
    case 'staging':
      return stagingConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}

// Convert to ErrorReportingService configuration
export function getErrorReportingConfig(): ErrorReportingConfig {
  const config = getErrorHandlingConfig();
  
  return {
    apiEndpoint: config.integrations.customEndpoint.url,
    apiKey: config.integrations.customEndpoint.apiKey,
    enableErrorReporting: config.global.enableErrorBoundaries,
    enableUserFeedback: config.userFeedback.enableUserReporting,
    enableOfflineSupport: config.userFeedback.enableOfflineFeedback,
    maxErrorsPerSession: config.global.maxErrorsPerSession,
    maxRetryAttempts: config.errorBoundary.maxRetryAttempts,
    retryDelay: config.errorBoundary.retryDelayMs,
    enableTelemetry: config.development.enablePerformanceTracking,
    privacyMode: config.privacy.enableDataSanitization,
    ignoredErrors: config.filtering.ignoredErrors,
    enabledEnvironments: config.filtering.enabledEnvironments,
  };
}

// Convert to MUI Error Boundary configuration
export function getMUIErrorBoundaryConfig(): Partial<MUIErrorBoundaryProps> {
  const config = getErrorHandlingConfig();
  
  return {
    showDialog: config.errorBoundary.showDialogByDefault,
    showSnackbar: config.errorBoundary.showSnackbarByDefault,
    allowUserFeedback: config.userFeedback.enableUserReporting,
    allowErrorDownload: true,
    maxWidth: config.mui.maxDialogWidth,
    autoHideDuration: config.mui.autoHideDuration,
    severity: config.mui.defaultSeverity,
    enableDetailedReporting: config.mui.enableDetailedReporting,
    enableStatePreservation: config.errorBoundary.enableStatePreservation,
    enableAutoRecovery: config.errorBoundary.enableAutoRecovery,
    maxRetries: config.errorBoundary.maxRetryAttempts,
    retryDelay: config.errorBoundary.retryDelayMs,
    isolationLevel: config.errorBoundary.isolationLevel,
  };
}

// Error type classification
export const errorTypes = {
  NETWORK_ERROR: 'NetworkError',
  VALIDATION_ERROR: 'ValidationError',
  AUTHENTICATION_ERROR: 'AuthenticationError',
  AUTHORIZATION_ERROR: 'AuthorizationError',
  NOT_FOUND_ERROR: 'NotFoundError',
  TIMEOUT_ERROR: 'TimeoutError',
  PARSE_ERROR: 'ParseError',
  STORAGE_ERROR: 'StorageError',
  RENDER_ERROR: 'RenderError',
  UNKNOWN_ERROR: 'UnknownError',
} as const;

// Custom error messages for specific error types
export const customErrorMessages: Record<string, string> = {
  [errorTypes.NETWORK_ERROR]: 'There was a problem connecting to the server. Please check your internet connection and try again.',
  [errorTypes.VALIDATION_ERROR]: 'The data you entered is invalid. Please check your inputs and try again.',
  [errorTypes.AUTHENTICATION_ERROR]: 'Your session has expired. Please log in again to continue.',
  [errorTypes.AUTHORIZATION_ERROR]: 'You don\'t have permission to perform this action. Please contact your administrator.',
  [errorTypes.NOT_FOUND_ERROR]: 'The requested resource could not be found. It may have been moved or deleted.',
  [errorTypes.TIMEOUT_ERROR]: 'The request took too long to complete. Please try again.',
  [errorTypes.PARSE_ERROR]: 'There was a problem processing the data. Please try again or contact support.',
  [errorTypes.STORAGE_ERROR]: 'There was a problem saving your data. Please try again.',
  [errorTypes.RENDER_ERROR]: 'There was a problem displaying this content. Please refresh the page.',
  [errorTypes.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
};

// Utility functions for error classification
export function classifyError(error: Error): string {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || name.includes('network')) {
    return errorTypes.NETWORK_ERROR;
  }
  
  if (message.includes('validation') || message.includes('invalid') || name.includes('validation')) {
    return errorTypes.VALIDATION_ERROR;
  }
  
  if (message.includes('unauthorized') || message.includes('authentication') || name.includes('auth')) {
    return errorTypes.AUTHENTICATION_ERROR;
  }
  
  if (message.includes('forbidden') || message.includes('permission') || name.includes('authorization')) {
    return errorTypes.AUTHORIZATION_ERROR;
  }
  
  if (message.includes('not found') || message.includes('404') || name.includes('notfound')) {
    return errorTypes.NOT_FOUND_ERROR;
  }
  
  if (message.includes('timeout') || message.includes('timed out') || name.includes('timeout')) {
    return errorTypes.TIMEOUT_ERROR;
  }
  
  if (message.includes('parse') || message.includes('json') || name.includes('syntax')) {
    return errorTypes.PARSE_ERROR;
  }
  
  if (message.includes('storage') || message.includes('quota') || name.includes('storage')) {
    return errorTypes.STORAGE_ERROR;
  }
  
  if (message.includes('render') || message.includes('component') || name.includes('render')) {
    return errorTypes.RENDER_ERROR;
  }
  
  return errorTypes.UNKNOWN_ERROR;
}

export function getErrorMessage(error: Error): string {
  const errorType = classifyError(error);
  return customErrorMessages[errorType] || error.message;
}

// Export current configuration
export const errorHandlingConfig = getErrorHandlingConfig();
export const errorReportingConfig = getErrorReportingConfig();
export const muiErrorBoundaryConfig = getMUIErrorBoundaryConfig();

