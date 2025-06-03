/**
 * Higher-Order Component for IPC Error Handling (2025)
 * 
 * This HOC wraps components that require IPC communication with standardized
 * error handling, fallback UI, and recovery mechanisms.
 * 
 * Following 2025 React patterns for HOCs and error boundaries.
 */

import React, { Component, ComponentType, ReactNode, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Wifi, WifiOff, Settings, Info } from 'lucide-react';
import { useIPC, useRequireIPC, useSafeIPC } from '@/contexts/IPCContext';
import { IPCErrorCode, type IPCResponse } from '@/lib/ipc';

// Props interface for the HOC
interface WithIPCErrorHandlingProps {
  fallbackComponent?: ReactNode;
  requiresIPC?: boolean;
  gracefulDegradation?: boolean;
  retryable?: boolean;
  showConnectionStatus?: boolean;
  onIPCError?: (error: string, context?: any) => void;
  onConnectionLost?: () => void;
  onConnectionRestored?: () => void;
}

// Fallback UI props
interface IPCFallbackUIProps {
  error?: string;
  isAvailable: boolean;
  isHealthy: boolean;
  isRetrying: boolean;
  canRetry: boolean;
  connectionErrors: number;
  onRetry: () => void;
  onDismiss?: () => void;
  gracefulDegradation?: boolean;
  children?: ReactNode;
}

/**
 * Default fallback UI component for IPC errors
 */
function IPCFallbackUI({
  error,
  isAvailable,
  isHealthy,
  isRetrying,
  canRetry,
  connectionErrors,
  onRetry,
  onDismiss,
  gracefulDegradation = false,
  children
}: IPCFallbackUIProps) {
  const getErrorMessage = () => {
    if (!isAvailable) {
      return {
        title: 'Desktop Features Unavailable',
        message: 'This feature requires the TaskMaster desktop application. Some functionality may be limited in browser mode.',
        type: 'unavailable' as const
      };
    }
    
    if (!isHealthy) {
      return {
        title: 'Connection Issues',
        message: 'There seems to be a problem with the application connection. Please try refreshing or restarting the app.',
        type: 'unhealthy' as const
      };
    }

    return {
      title: 'Service Error',
      message: error || 'An unknown error occurred while communicating with the application.',
      type: 'error' as const
    };
  };

  const { title, message, type } = getErrorMessage();
  const showAsWarning = gracefulDegradation && type === 'unavailable';

  if (showAsWarning) {
    // Graceful degradation - show warning but allow interaction
    return (
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {title}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {message}
              </p>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-yellow-400 hover:text-yellow-600 dark:text-yellow-300 dark:hover:text-yellow-100"
              >
                ×
              </button>
            )}
          </div>
        </motion.div>
        {children}
      </div>
    );
  }

  // Full error state
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border min-h-48"
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
            className="w-12 h-12 mx-auto"
          >
            {!isAvailable ? (
              <WifiOff className="w-full h-full text-destructive" />
            ) : (
              <AlertTriangle className="w-full h-full text-destructive" />
            )}
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-4 max-w-md"
      >
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-muted-foreground text-sm">{message}</p>

        {/* Connection error count */}
        {connectionErrors > 0 && (
          <p className="text-xs text-muted-foreground">
            Connection attempts: {connectionErrors}
          </p>
        )}

        {/* Error details in development */}
        {process.env.NODE_ENV === 'development' && error && (
          <motion.details
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-left bg-muted/50 rounded-lg p-3 mt-4"
          >
            <summary className="cursor-pointer font-medium text-xs mb-2">
              Error Details (Development)
            </summary>
            <pre className="text-xs text-destructive overflow-auto max-h-20 whitespace-pre-wrap">
              {error}
            </pre>
          </motion.details>
        )}
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex gap-3 mt-6"
      >
        {canRetry && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </motion.button>
        )}

        {!isAvailable && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Reload App
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * Hook-based HOC for functional components
 */
export function withIPCErrorHandling<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithIPCErrorHandlingProps = {}
) {
  const {
    fallbackComponent,
    requiresIPC = true,
    gracefulDegradation = false,
    retryable = true,
    showConnectionStatus = false,
    onIPCError,
    onConnectionLost,
    onConnectionRestored
  } = options;

  const ComponentWithIPCErrorHandling = (props: P) => {
    const ipc = requiresIPC ? useRequireIPC() : useIPC();
    const [showFallback, setShowFallback] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [dismissedWarning, setDismissedWarning] = useState(false);

    // Handle connection state changes
    useEffect(() => {
      if (!ipc.isAvailable && requiresIPC && !gracefulDegradation) {
        setShowFallback(true);
        onConnectionLost?.();
      } else if (ipc.isAvailable && showFallback) {
        setShowFallback(false);
        onConnectionRestored?.();
      }
    }, [ipc.isAvailable, requiresIPC, gracefulDegradation, showFallback]);

    // Handle health changes
    useEffect(() => {
      if (requiresIPC && !ipc.isHealthy && ipc.isAvailable) {
        setShowFallback(true);
      }
    }, [ipc.isHealthy, requiresIPC, ipc.isAvailable]);

    // Handle errors
    useEffect(() => {
      if (ipc.lastError) {
        onIPCError?.(ipc.lastError);
        if (requiresIPC) {
          setShowFallback(true);
        }
      }
    }, [ipc.lastError, requiresIPC]);

    const handleRetry = async () => {
      if (!retryable || isRetrying) return;
      
      setIsRetrying(true);
      try {
        await ipc.refreshStatus();
        // Small delay to show the retry animation
        setTimeout(() => {
          setIsRetrying(false);
          if (ipc.isHealthy) {
            setShowFallback(false);
          }
        }, 1000);
      } catch (error) {
        setIsRetrying(false);
      }
    };

    // Show fallback UI if required
    if (showFallback || (!ipc.isAvailable && requiresIPC && !gracefulDegradation)) {
      if (fallbackComponent) {
        return <>{fallbackComponent}</>;
      }

      return (
        <IPCFallbackUI
          error={ipc.lastError || undefined}
          isAvailable={ipc.isAvailable}
          isHealthy={ipc.isHealthy}
          isRetrying={isRetrying}
          canRetry={retryable}
          connectionErrors={ipc.connectionErrors}
          onRetry={handleRetry}
          gracefulDegradation={gracefulDegradation}
        />
      );
    }

    // Show warning for graceful degradation
    if (!ipc.isAvailable && gracefulDegradation && !dismissedWarning) {
      return (
        <IPCFallbackUI
          error={ipc.lastError || undefined}
          isAvailable={ipc.isAvailable}
          isHealthy={ipc.isHealthy}
          isRetrying={isRetrying}
          canRetry={retryable}
          connectionErrors={ipc.connectionErrors}
          onRetry={handleRetry}
          onDismiss={() => setDismissedWarning(true)}
          gracefulDegradation={true}
        >
          <WrappedComponent {...props} />
        </IPCFallbackUI>
      );
    }

    // Connection status indicator
    if (showConnectionStatus && !ipc.isHealthy) {
      return (
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="fixed top-4 right-4 z-50 bg-destructive text-destructive-foreground px-3 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2"
          >
            <WifiOff className="w-4 h-4" />
            Connection Issues
            {retryable && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="ml-2 text-xs underline hover:no-underline"
              >
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            )}
          </motion.div>
          <WrappedComponent {...props} />
        </div>
      );
    }

    // Normal rendering
    return <WrappedComponent {...props} />;
  };

  ComponentWithIPCErrorHandling.displayName = 
    `withIPCErrorHandling(${WrappedComponent.displayName || WrappedComponent.name})`;

  return ComponentWithIPCErrorHandling;
}

/**
 * Hook for components that need IPC error handling
 */
export function useIPCErrorHandling(options: WithIPCErrorHandlingProps = {}) {
  const {
    requiresIPC = true,
    gracefulDegradation = false,
    onIPCError,
    onConnectionLost,
    onConnectionRestored
  } = options;

  const ipc = requiresIPC ? useRequireIPC() : useIPC();
  const safeIPC = useSafeIPC();
  const [hasError, setHasError] = useState(false);

  // Monitor connection state
  useEffect(() => {
    if (!ipc.isAvailable && requiresIPC) {
      setHasError(true);
      onConnectionLost?.();
    } else if (ipc.isAvailable && hasError) {
      setHasError(false);
      onConnectionRestored?.();
    }
  }, [ipc.isAvailable, requiresIPC, hasError]);

  // Monitor errors
  useEffect(() => {
    if (ipc.lastError) {
      onIPCError?.(ipc.lastError);
      if (requiresIPC && !gracefulDegradation) {
        setHasError(true);
      }
    }
  }, [ipc.lastError, requiresIPC, gracefulDegradation]);

  return {
    ...ipc,
    safeInvoke: safeIPC.invoke,
    hasError,
    canProceed: ipc.isAvailable || gracefulDegradation,
    shouldShowFallback: hasError && requiresIPC && !gracefulDegradation
  };
}

export default withIPCErrorHandling;