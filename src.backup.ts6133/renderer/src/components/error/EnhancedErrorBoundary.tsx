/**
 * Enhanced Error Boundary Component (2025)
 * 
 * Modern error boundary implementation that combines react-error-boundary patterns
 * with advanced state preservation and recovery capabilities.
 * 
 * Features:
 * - Automatic recovery with resetKeys
 * - State preservation and restoration
 * - Integration with crash recovery service
 * - User-friendly recovery options
 * - Performance monitoring
 * - Telemetry integration
 */

import React, { Component, ErrorInfo, ReactNode, useCallback } from 'react';
import { ErrorBoundary as ReactErrorBoundary, useErrorBoundary } from 'react-error-boundary';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Bug, History, Download } from 'lucide-react';

// Enhanced error boundary props
export interface EnhancedErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  FallbackComponent?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: (details: { reason: "imperative-api"; args: any[]; } | { reason: "keys"; prev: any[] | undefined; next: any[] | undefined; }) => void;
  resetKeys?: Array<string | number | boolean | null | undefined>;
  resetOnPropsChange?: boolean;
  isolationLevel?: 'none' | 'component' | 'feature' | 'page';
  enableStatePreservation?: boolean;
  enableAutoRecovery?: boolean;
  enableUserRecovery?: boolean;
  enableTelemetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  stateKey?: string;
  recoveryStrategies?: RecoveryStrategy[];
}

// Error fallback component props
export interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: (...args: any[]) => void;
  preservedState?: any;
  recoveryOptions?: RecoveryOption[];
  retryCount?: number;
  maxRetries?: number;
  onDownloadReport?: () => void;
  onRestoreState?: (strategy: string) => void;
}

// Recovery strategy configuration
export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  priority: number;
  automatic: boolean;
  requiresConfirmation: boolean;
  execute: () => Promise<boolean>;
}

// Recovery option for UI
export interface RecoveryOption {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  action: () => void;
  variant: 'primary' | 'secondary' | 'destructive';
}

// Enhanced error boundary state
interface EnhancedErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  lastResetKey: any;
  preservedState: any;
  recoveryAttempted: boolean;
  autoRecoveryInProgress: boolean;
}

/**
 * Class-based error boundary with enhanced features
 */
class EnhancedErrorBoundaryClass extends Component<
  EnhancedErrorBoundaryProps,
  EnhancedErrorBoundaryState
> {
  private autoRetryTimeoutId: NodeJS.Timeout | null = null;
  private stateBackupKey: string;
  
  constructor(props: EnhancedErrorBoundaryProps) {
    super(props);
    
    this.stateBackupKey = `error_boundary_${props.stateKey || 'default'}_state`;
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastResetKey: this.serializeResetKeys(props.resetKeys),
      preservedState: null,
      recoveryAttempted: false,
      autoRecoveryInProgress: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<EnhancedErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Preserve state if enabled
    if (this.props.enableStatePreservation) {
      this.preserveApplicationState();
    }

    // Report error with telemetry
    if (this.props.enableTelemetry) {
      this.reportErrorToTelemetry(error, errorInfo);
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Attempt automatic recovery if enabled
    if (this.props.enableAutoRecovery && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.attemptAutoRecovery();
    }
  }

  componentDidUpdate(prevProps: EnhancedErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Check for reset key changes
    const currentResetKeys = this.serializeResetKeys(resetKeys);
    const prevResetKeys = this.serializeResetKeys(prevProps.resetKeys);
    
    if (hasError && currentResetKeys !== prevResetKeys) {
      this.resetErrorBoundary('resetKeys changed');
    }

    // Check for prop changes
    if (hasError && resetOnPropsChange && this.hasPropsChanged(prevProps)) {
      this.resetErrorBoundary('props changed');
    }

    // Update reset key tracking
    if (currentResetKeys !== this.state.lastResetKey) {
      this.setState({ lastResetKey: currentResetKeys });
    }
  }

  componentWillUnmount() {
    if (this.autoRetryTimeoutId) {
      clearTimeout(this.autoRetryTimeoutId);
    }
  }

  private serializeResetKeys(resetKeys?: any[]): string {
    return JSON.stringify(resetKeys || []);
  }

  private hasPropsChanged(prevProps: EnhancedErrorBoundaryProps): boolean {
    const currentProps = this.props;
    const keysToCheck = ['children', 'fallback', 'FallbackComponent'] as const;
    
    return keysToCheck.some(key => currentProps[key] !== prevProps[key]);
  }

  private preserveApplicationState(): void {
    try {
      // Get current state from local storage and session storage
      const preservedData = {
        localStorage: this.extractStorageData(localStorage),
        sessionStorage: this.extractStorageData(sessionStorage),
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        error: {
          message: this.state.error?.message,
          stack: this.state.error?.stack,
          name: this.state.error?.name
        }
      };

      localStorage.setItem(this.stateBackupKey, JSON.stringify(preservedData));
      
      console.debug('Application state preserved for error recovery', {
        stateKey: this.stateBackupKey,
        dataSize: JSON.stringify(preservedData).length
      });
    } catch (error) {
      console.warn('Failed to preserve application state:', error);
    }
  }

  private extractStorageData(storage: Storage): Record<string, any> {
    const data: Record<string, any> = {};
    
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && this.shouldPreserveStorageKey(key)) {
          const value = storage.getItem(key);
          if (value) {
            try {
              data[key] = JSON.parse(value);
            } catch {
              data[key] = value;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to extract storage data:', error);
    }
    
    return data;
  }

  private shouldPreserveStorageKey(key: string): boolean {
    // Preserve taskmaster-related keys and exclude sensitive data
    const preservePatterns = [
      /^taskmaster-/,
      /^app_state/,
      /_store$/,
      /backup_/
    ];
    
    const excludePatterns = [
      /^auth/,
      /^token/,
      /^session/,
      /password/,
      /secret/
    ];
    
    const shouldPreserve = preservePatterns.some(pattern => pattern.test(key));
    const shouldExclude = excludePatterns.some(pattern => pattern.test(key));
    
    return shouldPreserve && !shouldExclude;
  }

  private reportErrorToTelemetry(error: Error, errorInfo: ErrorInfo): void {
    try {
      // In a real implementation, this would integrate with the telemetry service
      console.error('Error Boundary Telemetry:', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        errorInfo: {
          componentStack: errorInfo.componentStack
        },
        context: {
          stateKey: this.props.stateKey,
          retryCount: this.state.retryCount,
          isolationLevel: this.props.isolationLevel,
          url: window.location.href,
          timestamp: Date.now()
        }
      });
    } catch (telemetryError) {
      console.warn('Failed to report error to telemetry:', telemetryError);
    }
  }

  private attemptAutoRecovery(): void {
    if (this.state.autoRecoveryInProgress) return;
    
    this.setState({ autoRecoveryInProgress: true });
    
    const delay = (this.props.retryDelay || 1000) * Math.pow(2, this.state.retryCount);
    
    this.autoRetryTimeoutId = setTimeout(() => {
      this.setState(prevState => ({
        autoRecoveryInProgress: false,
        recoveryAttempted: true,
        retryCount: prevState.retryCount + 1
      }));
      
      this.resetErrorBoundary('auto recovery');
    }, delay);
  }

  private resetErrorBoundary = (reason: string): void => {
    if (this.autoRetryTimeoutId) {
      clearTimeout(this.autoRetryTimeoutId);
      this.autoRetryTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      autoRecoveryInProgress: false
    });

    // Call reset handler
    this.props.onReset?.({ reason: "imperative-api", args: [] });

    console.debug('Error boundary reset:', { reason, stateKey: this.props.stateKey });
  };

  private getRecoveryOptions(): RecoveryOption[] {
    const options: RecoveryOption[] = [
      {
        id: 'retry',
        label: 'Try Again',
        description: 'Retry the operation that caused the error',
        icon: RefreshCw,
        action: () => this.resetErrorBoundary('manual retry'),
        variant: 'primary'
      }
    ];

    // Add state restoration option if state was preserved
    const preservedData = localStorage.getItem(this.stateBackupKey);
    if (preservedData && this.props.enableStatePreservation) {
      options.push({
        id: 'restore',
        label: 'Restore Previous State',
        description: 'Restore the application to its previous state',
        icon: History,
        action: () => this.restorePreservedState(),
        variant: 'secondary'
      });
    }

    // Add page reload option for severe errors
    if (this.state.retryCount > 1) {
      options.push({
        id: 'reload',
        label: 'Reload Page',
        description: 'Reload the entire page to recover',
        icon: RefreshCw,
        action: () => window.location.reload(),
        variant: 'secondary'
      });
    }

    // Add home navigation for app-level errors
    if (this.props.isolationLevel === 'page') {
      options.push({
        id: 'home',
        label: 'Go Home',
        description: 'Navigate to the home page',
        icon: Home,
        action: () => window.location.href = '/',
        variant: 'secondary'
      });
    }

    return options;
  }

  private restorePreservedState(): void {
    try {
      const preservedData = localStorage.getItem(this.stateBackupKey);
      if (!preservedData) return;

      const parsed = JSON.parse(preservedData);
      
      // Restore localStorage data
      Object.entries(parsed.localStorage || {}).forEach(([key, value]) => {
        try {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (error) {
          console.warn(`Failed to restore localStorage key "${key}":`, error);
        }
      });

      this.resetErrorBoundary('state restored');
      
    } catch (error) {
      console.error('Failed to restore preserved state:', error);
    }
  }

  private generateErrorReport(): string {
    const report = {
      error: {
        name: this.state.error?.name,
        message: this.state.error?.message,
        stack: this.state.error?.stack
      },
      errorInfo: {
        componentStack: this.state.errorInfo?.componentStack
      },
      context: {
        stateKey: this.props.stateKey,
        retryCount: this.state.retryCount,
        isolationLevel: this.props.isolationLevel,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      },
      preservedState: this.state.preservedState
    };

    return JSON.stringify(report, null, 2);
  }

  private downloadErrorReport = (): void => {
    const report = this.generateErrorReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  render() {
    if (this.state.hasError) {
      const { FallbackComponent, fallback } = this.props;
      const recoveryOptions = this.getRecoveryOptions();

      // Custom fallback component
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={this.state.error!}
            resetErrorBoundary={this.resetErrorBoundary}
            preservedState={this.state.preservedState}
            recoveryOptions={recoveryOptions}
            retryCount={this.state.retryCount}
            maxRetries={this.props.maxRetries || 3}
            onDownloadReport={this.downloadErrorReport}
            onRestoreState={this.restorePreservedState}
          />
        );
      }

      // Custom fallback element
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={this.state.error!}
          resetErrorBoundary={this.resetErrorBoundary}
          recoveryOptions={recoveryOptions}
          retryCount={this.state.retryCount}
          maxRetries={this.props.maxRetries || 3}
          autoRecoveryInProgress={this.state.autoRecoveryInProgress}
          onDownloadReport={this.downloadErrorReport}
          isolationLevel={this.props.isolationLevel || 'component'}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component with modern UI
 */
interface DefaultErrorFallbackProps {
  error: Error;
  resetErrorBoundary: (reason: string) => void;
  recoveryOptions: RecoveryOption[];
  retryCount: number;
  maxRetries: number;
  autoRecoveryInProgress: boolean;
  onDownloadReport: () => void;
  isolationLevel: string;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({
  error,
  recoveryOptions,
  retryCount,
  maxRetries,
  autoRecoveryInProgress,
  onDownloadReport,
  isolationLevel
}) => {
  const isAppLevel = isolationLevel === 'page';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        flex flex-col items-center justify-center p-8 text-center
        ${isAppLevel ? 'min-h-screen bg-background' : 'min-h-64 bg-card rounded-lg border'}
      `}
    >
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="relative">
          <motion.div
            animate={{ 
              rotate: autoRecoveryInProgress ? 360 : [0, -10, 10, 0],
              scale: autoRecoveryInProgress ? [1, 1.1, 1] : 1
            }}
            transition={{ 
              duration: autoRecoveryInProgress ? 1 : 2, 
              repeat: autoRecoveryInProgress ? Infinity : Infinity,
              repeatDelay: autoRecoveryInProgress ? 0 : 3
            }}
            className="w-16 h-16 mx-auto text-destructive"
          >
            <AlertTriangle size={64} />
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-4 max-w-md"
      >
        <h2 className="text-2xl font-bold text-foreground">
          {isAppLevel ? 'Application Error' : 'Component Error'}
        </h2>
        
        <p className="text-muted-foreground">
          {autoRecoveryInProgress
            ? 'Attempting automatic recovery...'
            : isAppLevel 
              ? 'An unexpected error occurred. We\'re working to recover your session.'
              : 'This component encountered an error. Other parts of the app should work normally.'
          }
        </p>

        {/* Error details in development */}
        {process.env.NODE_ENV === 'development' && error && (
          <motion.details
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-left bg-muted/50 rounded-lg p-4 mt-4"
          >
            <summary className="cursor-pointer font-medium text-sm mb-2 flex items-center gap-2">
              <Bug size={16} />
              Error Details (Development)
            </summary>
            <pre className="text-xs text-destructive overflow-auto max-h-32 whitespace-pre-wrap">
              {error.name}: {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </motion.details>
        )}

        {/* Recovery progress */}
        {autoRecoveryInProgress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full bg-muted rounded-full h-2"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="bg-primary h-2 rounded-full"
            />
          </motion.div>
        )}

        {/* Retry counter */}
        {retryCount > 0 && !autoRecoveryInProgress && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground"
          >
            Recovery attempt: {retryCount}/{maxRetries}
          </motion.p>
        )}
      </motion.div>

      {/* Recovery options */}
      {!autoRecoveryInProgress && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-3 mt-8"
        >
          <AnimatePresence>
            {recoveryOptions.map((option) => (
              <motion.button
                key={option.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={option.action}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                  ${option.variant === 'primary' 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : option.variant === 'destructive'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                  }
                `}
              >
                <option.icon size={16} />
                {option.label}
              </motion.button>
            ))}
          </AnimatePresence>

          {/* Download error report */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDownloadReport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/90 transition-colors"
          >
            <Download size={16} />
            Download Report
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
};

/**
 * Hook for manual error handling
 */
export const useEnhancedErrorHandler = () => {
  const { showBoundary } = useErrorBoundary();
  
  const reportError = useCallback((error: Error, context?: Record<string, any>) => {
    // Add context to error if provided
    if (context) {
      (error as any).__errorContext = context;
    }
    
    showBoundary(error);
  }, [showBoundary]);

  return { reportError };
};

/**
 * Higher-order component wrapper
 */
export const withEnhancedErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<EnhancedErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundaryClass {...errorBoundaryProps}>
      <Component {...props} />
    </EnhancedErrorBoundaryClass>
  );

  WrappedComponent.displayName = `withEnhancedErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

/**
 * Main enhanced error boundary component using react-error-boundary
 */
export const EnhancedErrorBoundary: React.FC<EnhancedErrorBoundaryProps> = ({
  children,
  resetKeys,
  onReset,
  onError,
  ...props
}) => {
  return (
    <ReactErrorBoundary
      FallbackComponent={(fallbackProps) => (
        <EnhancedErrorBoundaryClass {...props} {...fallbackProps}>
          {children}
        </EnhancedErrorBoundaryClass>
      )}
      resetKeys={resetKeys}
      onReset={(details) => onReset?.(details)}
      onError={onError}
    >
      {children}
    </ReactErrorBoundary>
  );
};

// Export the class-based component as default for direct use
export default EnhancedErrorBoundaryClass;

