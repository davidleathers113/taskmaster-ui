/**
 * Error Reporting Service (2025)
 * 
 * Comprehensive error reporting service with user feedback mechanisms,
 * in-app reporting, and integration with error boundary systems.
 * 
 * Features:
 * - User-initiated error reporting
 * - Automatic error tracking
 * - Offline support with retry logic
 * - User context collection
 * - Integration with external services (Sentry, etc.)
 * - Privacy-focused data collection
 */

import { ErrorInfo } from 'react';

// Error context for enhanced reporting
export interface ErrorContext {
  userInitiated?: boolean;
  userInfo?: {
    userId?: string;
    sessionId?: string;
    userAgent?: string;
    timestamp?: string;
  };
  component?: string;
  action?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  metadata?: Record<string, any>;
}

// Error report structure
export interface ErrorReport {
  id: string;
  timestamp: string;
  error: {
    name: string;
    message: string;
    stack?: string;
    cause?: any;
  };
  errorInfo?: {
    componentStack?: string;
    errorBoundary?: string;
  };
  context: ErrorContext;
  systemInfo: {
    userAgent: string;
    platform: string;
    language: string;
    screenSize: string;
    url: string;
    viewport: string;
    memory?: number;
    connection?: string;
  };
  appInfo: {
    version: string;
    environment: string;
    buildId?: string;
    feature?: string;
  };
}

// User feedback structure
export interface UserFeedback {
  reportId: string;
  userEmail?: string;
  userName?: string;
  description: string;
  steps?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'bug' | 'feature' | 'improvement' | 'question';
  screenshots?: string[];
  timestamp: string;
}

// Configuration for error reporting
export interface ErrorReportingConfig {
  apiEndpoint?: string;
  apiKey?: string;
  enableErrorReporting?: boolean;
  enableUserFeedback?: boolean;
  enableOfflineSupport?: boolean;
  maxErrorsPerSession?: number;
  maxRetryAttempts?: number;
  retryDelay?: number;
  enableTelemetry?: boolean;
  privacyMode?: boolean;
  ignoredErrors?: string[];
  enabledEnvironments?: string[];
}

// Default configuration
const _defaultConfig: Required<ErrorReportingConfig> = {
  apiEndpoint: process.env.REACT_APP_ERROR_REPORTING_API || '/api/errors',
  apiKey: process.env.REACT_APP_ERROR_REPORTING_KEY || '',
  enableErrorReporting: process.env.NODE_ENV === 'production',
  enableUserFeedback: true,
  enableOfflineSupport: true,
  maxErrorsPerSession: 10,
  maxRetryAttempts: 3,
  retryDelay: 1000,
  enableTelemetry: process.env.NODE_ENV === 'production',
  privacyMode: false,
  ignoredErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    'Script error.',
    'Network request failed'
  ],
  enabledEnvironments: ['production', 'staging', 'development']
};

/**
 * Error Reporting Service Implementation
 */
class ErrorReportingService {
  private config: Required<ErrorReportingConfig>;
  private errorCount = 0;
  private pendingReports: ErrorReport[] = [];
  private offlineQueue: ErrorReport[] = [];
  private isOnline = navigator.onLine;
  private sessionId: string;

  constructor(config: Partial<ErrorReportingConfig> = {}) {
    this.config = { ..._defaultConfig, ...config };
    this.sessionId = this.generateSessionId();
    
    // Initialize service
    this.initialize();
  }

  /**
   * Initialize the error reporting service
   */
  private initialize(): void {
    // Set up online/offline detection
    this.setupNetworkDetection();
    
    // Set up global error handlers
    this.setupGlobalErrorHandlers();
    
    // Process any queued reports from previous sessions
    this.processOfflineQueue();
    
    console.debug('🔍 Error Reporting Service initialized', {
      config: this.getPublicConfig()
    });
  }

  /**
   * Report an error with context
   */
  async reportError(
    error: Error, 
    errorInfo?: ErrorInfo, 
    context: Partial<ErrorContext> = {}
  ): Promise<string | null> {
    if (!this.shouldReportError(error)) {
      return null;
    }

    const report = this.createErrorReport(error, errorInfo, context);
    
    if (this.config.enableErrorReporting) {
      return this.sendErrorReport(report);
    }
    
    // In development, just log to console
    if (process.env.NODE_ENV === 'development') {
      this.logErrorReport(report);
    }
    
    return report.id;
  }

  /**
   * Report error with user context (for user-initiated reports)
   */
  async reportErrorWithUserContext(
    error: Error,
    errorInfo?: ErrorInfo,
    context: Partial<ErrorContext> = {}
  ): Promise<string | null> {
    const enhancedContext: Partial<ErrorContext> = {
      ...context,
      userInitiated: true,
      severity: context.severity || 'medium'
    };

    return this.reportError(error, errorInfo, enhancedContext);
  }

  /**
   * Submit user feedback for an error
   */
  async submitUserFeedback(feedback: Omit<UserFeedback, 'timestamp'>): Promise<boolean> {
    if (!this.config.enableUserFeedback) {
      return false;
    }

    const enhancedFeedback: UserFeedback = {
      ...feedback,
      timestamp: new Date().toISOString()
    };

    try {
      if (this.isOnline && this.config.apiEndpoint) {
        const response = await fetch(`${this.config.apiEndpoint}/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
          },
          body: JSON.stringify(enhancedFeedback)
        });

        if (response.ok) {
          console.debug('User feedback submitted successfully:', feedback.reportId);
          return true;
        } else {
          console.warn('Failed to submit user feedback:', await response.text());
        }
      } else {
        // Queue for later if offline
        this.queueOfflineFeedback(enhancedFeedback);
        return true;
      }
    } catch (error) {
      console.error('Error submitting user feedback:', error);
      
      // Queue for retry if offline support is enabled
      if (this.config.enableOfflineSupport) {
        this.queueOfflineFeedback(enhancedFeedback);
        return true;
      }
    }

    return false;
  }

  /**
   * Create a structured error report
   */
  private createErrorReport(
    error: Error,
    errorInfo?: ErrorInfo,
    context: Partial<ErrorContext> = {}
  ): ErrorReport {
    const id = this.generateReportId();
    const timestamp = new Date().toISOString();

    return {
      id,
      timestamp,
      error: {
        name: error.name,
        message: error.message,
        stack: this.config.privacyMode ? this.sanitizeStack(error.stack) : error.stack,
        cause: error.cause
      },
      errorInfo: errorInfo ? {
        componentStack: this.config.privacyMode 
          ? this.sanitizeStack(errorInfo.componentStack) 
          : errorInfo.componentStack,
        errorBoundary: context.component
      } : undefined,
      context: {
        userInitiated: false,
        severity: 'medium',
        ...context,
        userInfo: {
          sessionId: this.sessionId,
          userAgent: navigator.userAgent,
          timestamp,
          ...context.userInfo
        }
      },
      systemInfo: this.collectSystemInfo(),
      appInfo: this.collectAppInfo()
    };
  }

  /**
   * Send error report to API
   */
  private async sendErrorReport(report: ErrorReport): Promise<string | null> {
    try {
      if (!this.isOnline) {
        if (this.config.enableOfflineSupport) {
          this.queueOfflineReport(report);
          return report.id;
        }
        return null;
      }

      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify(report)
      });

      if (response.ok) {
        console.debug('Error report sent successfully:', report.id);
        this.errorCount++;
        return report.id;
      } else {
        console.warn('Failed to send error report:', await response.text());
        
        // Queue for retry if offline support is enabled
        if (this.config.enableOfflineSupport) {
          this.queueOfflineReport(report);
          return report.id;
        }
      }
    } catch (error) {
      console.error('Error sending report:', error);
      
      // Queue for retry if offline support is enabled
      if (this.config.enableOfflineSupport) {
        this.queueOfflineReport(report);
        return report.id;
      }
    }

    return null;
  }

  /**
   * Check if error should be reported
   */
  private shouldReportError(error: Error): boolean {
    // Check session limit
    if (this.errorCount >= this.config.maxErrorsPerSession) {
      return false;
    }

    // Check environment
    if (!this.config.enabledEnvironments.includes(process.env.NODE_ENV || 'development')) {
      return false;
    }

    // Check ignored errors
    if (this.config.ignoredErrors.some(ignored => 
      error.message.includes(ignored) || error.name.includes(ignored)
    )) {
      return false;
    }

    return true;
  }

  /**
   * Collect system information
   */
  private collectSystemInfo() {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenSize: `${screen.width}x${screen.height}`,
      url: window.location.href,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      memory: (performance as any).memory?.usedJSHeapSize,
      connection: connection?.effectiveType || 'unknown'
    };
  }

  /**
   * Collect application information
   */
  private collectAppInfo() {
    return {
      version: process.env.REACT_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      buildId: process.env.REACT_APP_BUILD_ID,
      feature: window.location.pathname
    };
  }

  /**
   * Set up network detection
   */
  private setupNetworkDetection(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Set up global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Handle unhandled errors
    window.addEventListener('error', (event) => {
      this.reportError(event.error || new Error(event.message), undefined, {
        component: 'GlobalErrorHandler',
        action: 'unhandled_error',
        severity: 'high'
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(`Unhandled Promise Rejection: ${event.reason}`);
        
      this.reportError(error, undefined, {
        component: 'GlobalErrorHandler',
        action: 'unhandled_promise_rejection',
        severity: 'medium'
      });
    });
  }

  /**
   * Process offline queue
   */
  private async processOfflineQueue(): Promise<void> {
    if (!this.isOnline || this.offlineQueue.length === 0) {
      return;
    }

    const reports = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const report of reports) {
      try {
        await this.sendErrorReport(report);
      } catch (error) {
        console.warn('Failed to send queued report:', error);
        // Re-queue if still failing
        this.offlineQueue.push(report);
      }
    }

    // Persist updated queue
    this.persistOfflineQueue();
  }

  /**
   * Queue report for offline processing
   */
  private queueOfflineReport(report: ErrorReport): void {
    this.offlineQueue.push(report);
    this.persistOfflineQueue();
  }

  /**
   * Queue feedback for offline processing
   */
  private queueOfflineFeedback(feedback: UserFeedback): void {
    const key = 'errorReporting_offlineFeedback';
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(feedback);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (error) {
      console.warn('Failed to queue offline feedback:', error);
    }
  }

  /**
   * Persist offline queue to localStorage
   */
  private persistOfflineQueue(): void {
    try {
      localStorage.setItem('errorReporting_offlineQueue', JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.warn('Failed to persist offline queue:', error);
    }
  }

  /**
   * Load offline queue from localStorage
   */
  private loadOfflineQueue(): void {
    try {
      const stored = localStorage.getItem('errorReporting_offlineQueue');
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error);
      this.offlineQueue = [];
    }
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Sanitize stack traces for privacy
   */
  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;
    
    // Remove file paths and replace with generic indicators
    return stack
      .replace(/https?:\/\/[^\s)]+/g, '[URL]')
      .replace(/file:\/\/[^\s)]+/g, '[FILE]')
      .replace(/webpack-internal:\/\/[^\s)]+/g, '[WEBPACK]')
      .replace(/at [^\s]+ \([^)]+\)/g, 'at [FUNCTION] ([LOCATION])');
  }

  /**
   * Log error report to console (development)
   */
  private logErrorReport(report: ErrorReport): void {
    console.group('🐛 Error Report');
    console.error('Error:', report.error);
    console.log('Context:', report.context);
    console.log('System Info:', report.systemInfo);
    console.log('App Info:', report.appInfo);
    if (report.errorInfo) {
      console.log('Component Stack:', report.errorInfo.componentStack);
    }
    console.groupEnd();
  }

  /**
   * Get public configuration (for debugging)
   */
  private getPublicConfig() {
    const { apiKey, ...publicConfig } = this.config;
    return {
      ...publicConfig,
      apiKey: apiKey ? '[CONFIGURED]' : '[NOT_SET]'
    };
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    return {
      sessionId: this.sessionId,
      errorCount: this.errorCount,
      pendingReports: this.pendingReports.length,
      offlineQueueSize: this.offlineQueue.length,
      isOnline: this.isOnline
    };
  }

  /**
   * Clear session data (useful for testing)
   */
  clearSession(): void {
    this.errorCount = 0;
    this.pendingReports = [];
    this.offlineQueue = [];
    this.sessionId = this.generateSessionId();
    
    try {
      localStorage.removeItem('errorReporting_offlineQueue');
      localStorage.removeItem('errorReporting_offlineFeedback');
    } catch (error) {
      console.warn('Failed to clear session data:', error);
    }
  }
}

// Create singleton instance
export const errorReportingService = new ErrorReportingService();

// Export service class for custom instances
export { ErrorReportingService };

// Types are already exported as interfaces above