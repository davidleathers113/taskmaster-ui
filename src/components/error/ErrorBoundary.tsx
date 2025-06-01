import React, { Component, ReactNode, ErrorInfo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'app' | 'component' | 'route';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

const MAX_RETRY_COUNT = 3;

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
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

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error reporting service
      // reportError(error, errorInfo);
    }
  }

  handleRetry = () => {
    const { retryCount } = this.state;
    
    if (retryCount < MAX_RETRY_COUNT) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));

      // Auto-retry with exponential backoff for component-level errors
      if (this.props.level === 'component') {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        this.retryTimeoutId = window.setTimeout(() => {
          this.setState({ hasError: false, error: null, errorInfo: null });
        }, delay);
      }
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      window.clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, retryCount } = this.state;
      const { level = 'component' } = this.props;
      
      const canRetry = retryCount < MAX_RETRY_COUNT;
      const isAppLevel = level === 'app';

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
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                className="w-16 h-16 mx-auto text-destructive"
              >
                <AlertTriangle size={64} />
              </motion.div>
              
              {/* Decorative elements */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive/20 rounded-full"
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="absolute -bottom-1 -left-3 w-4 h-4 bg-destructive/10 rounded-full"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-4 max-w-md"
          >
            <h2 className="text-2xl font-bold text-foreground">
              {isAppLevel ? 'Something went wrong' : 'Component Error'}
            </h2>
            
            <p className="text-muted-foreground">
              {isAppLevel 
                ? 'An unexpected error occurred in the application. Please try refreshing the page.'
                : 'This component encountered an error. You can try again or continue using other parts of the app.'
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

            {/* Retry info */}
            {retryCount > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-muted-foreground"
              >
                Retry attempt: {retryCount}/{MAX_RETRY_COUNT}
              </motion.p>
            )}
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-3 mt-8"
          >
            {canRetry && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <RefreshCw size={16} />
                Try Again
              </motion.button>
            )}

            {isAppLevel && (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={this.handleReload}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
                >
                  <RefreshCw size={16} />
                  Reload Page
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={this.handleGoHome}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/90 transition-colors"
                >
                  <Home size={16} />
                  Go Home
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

// Convenience wrapper for functional components
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};