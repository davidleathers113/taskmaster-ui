/**
 * Global IPC Status Notification Component (2025)
 * 
 * This component provides application-wide notifications for IPC connectivity
 * issues, error status, and recovery actions.
 * 
 * Following 2025 React patterns for global notifications and status indicators.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  X, 
  Settings,
  Info,
  Clock
} from 'lucide-react';
import { useIPC } from '@/contexts/IPCContext';

// Notification types
type NotificationType = 'info' | 'warning' | 'error' | 'success';

interface NotificationConfig {
  type: NotificationType;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  showRetry?: boolean;
  showDismiss?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

// Notification state
interface NotificationState extends NotificationConfig {
  id: string;
  timestamp: Date;
}

/**
 * Single notification item component
 */
function NotificationItem({
  notification,
  onRetry,
  onDismiss
}: {
  notification: NotificationState;
  onRetry: () => void;
  onDismiss: (id: string) => void;
}) {
  const { type, icon: Icon, title, message, showRetry, showDismiss, id } = notification;
  
  const typeStyles = {
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={`border rounded-lg p-4 shadow-lg backdrop-blur-sm ${typeStyles[type]}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-sm mt-1 opacity-90">{message}</p>
          
          <div className="flex items-center gap-3 mt-3">
            {showRetry && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onRetry}
                className="text-xs font-medium underline hover:no-underline opacity-80 hover:opacity-100"
              >
                Try Again
              </motion.button>
            )}
            
            <span className="text-xs opacity-60">
              {notification.timestamp.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {showDismiss && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onDismiss(id)}
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Compact status indicator for the app header/toolbar
 */
function CompactStatusIndicator({
  isAvailable,
  isHealthy,
  connectionErrors,
  onToggleDetails
}: {
  isAvailable: boolean;
  isHealthy: boolean;
  connectionErrors: number;
  onToggleDetails: () => void;
}) {
  const getStatus = () => {
    if (!isAvailable) {
      return {
        icon: WifiOff,
        color: 'text-red-500',
        status: 'Offline'
      };
    }
    
    if (!isHealthy || connectionErrors > 0) {
      return {
        icon: AlertTriangle,
        color: 'text-yellow-500',
        status: 'Issues'
      };
    }
    
    return {
      icon: Wifi,
      color: 'text-green-500',
      status: 'Online'
    };
  };

  const { icon: Icon, color, status } = getStatus();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggleDetails}
      className="flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors hover:bg-accent/50"
      title={`IPC Status: ${status}${connectionErrors > 0 ? ` (${connectionErrors} errors)` : ''}`}
    >
      <Icon className={`w-3 h-3 ${color}`} />
      <span className="hidden sm:inline text-muted-foreground">{status}</span>
      {connectionErrors > 0 && (
        <span className="bg-red-500 text-white text-xs rounded-full px-1 min-w-[16px] text-center">
          {connectionErrors > 9 ? '9+' : connectionErrors}
        </span>
      )}
    </motion.button>
  );
}

/**
 * Main IPC Status Notification component
 */
export function IPCStatusNotification({
  position = 'top-right',
  showCompactIndicator = true,
  autoHideSuccess = true,
  maxNotifications = 3
}: {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showCompactIndicator?: boolean;
  autoHideSuccess?: boolean;
  maxNotifications?: number;
}) {
  const ipc = useIPC();
  const [notifications, setNotifications] = useState<NotificationState[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [lastStatus, setLastStatus] = useState({ isAvailable: false, isHealthy: false });

  // Create notification
  const addNotification = (config: NotificationConfig) => {
    const notification: NotificationState = {
      ...config,
      id: `${Date.now()}_${Math.random().toString(36).substring(2)}`,
      timestamp: new Date()
    };

    setNotifications(prev => {
      const newNotifications = [notification, ...prev];
      return newNotifications.slice(0, maxNotifications);
    });

    // Auto-hide if configured
    if (config.autoHide !== false) {
      const delay = config.autoHideDelay || (config.type === 'success' && autoHideSuccess ? 3000 : 0);
      if (delay > 0) {
        setTimeout(() => {
          removeNotification(notification.id);
        }, delay);
      }
    }
  };

  // Remove notification
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Handle IPC status changes
  useEffect(() => {
    const currentStatus = { isAvailable: ipc.isAvailable, isHealthy: ipc.isHealthy };
    
    // Connection lost
    if (lastStatus.isAvailable && !currentStatus.isAvailable) {
      addNotification({
        type: 'error',
        icon: WifiOff,
        title: 'Connection Lost',
        message: 'Lost connection to the desktop application. Some features may be unavailable.',
        showRetry: true,
        showDismiss: true
      });
    }
    
    // Connection restored
    else if (!lastStatus.isAvailable && currentStatus.isAvailable) {
      addNotification({
        type: 'success',
        icon: CheckCircle,
        title: 'Connection Restored',
        message: 'Successfully reconnected to the desktop application.',
        showDismiss: true,
        autoHide: true,
        autoHideDelay: 3000
      });
    }
    
    // Health issues
    else if (currentStatus.isAvailable && lastStatus.isHealthy && !currentStatus.isHealthy) {
      addNotification({
        type: 'warning',
        icon: AlertTriangle,
        title: 'Connection Issues',
        message: 'The desktop application is experiencing connection problems.',
        showRetry: true,
        showDismiss: true
      });
    }
    
    // Health restored
    else if (currentStatus.isAvailable && !lastStatus.isHealthy && currentStatus.isHealthy) {
      addNotification({
        type: 'success',
        icon: CheckCircle,
        title: 'Connection Healthy',
        message: 'Connection issues have been resolved.',
        showDismiss: true,
        autoHide: true,
        autoHideDelay: 2000
      });
    }

    setLastStatus(currentStatus);
  }, [ipc.isAvailable, ipc.isHealthy]);

  // Handle error changes
  useEffect(() => {
    if (ipc.lastError && ipc.connectionErrors > 0) {
      addNotification({
        type: 'error',
        icon: AlertTriangle,
        title: 'IPC Error',
        message: ipc.lastError,
        showRetry: true,
        showDismiss: true
      });
    }
  }, [ipc.lastError, ipc.connectionErrors]);

  const handleRetry = async () => {
    try {
      await ipc.refreshStatus();
    } catch (error) {
      console.error('Failed to retry IPC connection:', error);
    }
  };

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  return (
    <>
      {/* Compact indicator */}
      {showCompactIndicator && (
        <CompactStatusIndicator
          isAvailable={ipc.isAvailable}
          isHealthy={ipc.isHealthy}
          connectionErrors={ipc.connectionErrors}
          onToggleDetails={() => setShowDetails(!showDetails)}
        />
      )}

      {/* Notification panel */}
      <div className={`fixed ${positionClasses[position]} z-50 w-80 max-w-[calc(100vw-2rem)]`}>
        <AnimatePresence>
          {notifications.map((notification) => (
            <div key={notification.id} className="mb-3">
              <NotificationItem
                notification={notification}
                onRetry={handleRetry}
                onDismiss={removeNotification}
              />
            </div>
          ))}
        </AnimatePresence>

        {/* Details panel */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 bg-card border rounded-lg p-4 shadow-lg backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">IPC Status Details</h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Available:</span>
                  <span className={ipc.isAvailable ? 'text-green-600' : 'text-red-600'}>
                    {ipc.isAvailable ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Healthy:</span>
                  <span className={ipc.isHealthy ? 'text-green-600' : 'text-red-600'}>
                    {ipc.isHealthy ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Error Count:</span>
                  <span className={ipc.errorCount > 0 ? 'text-yellow-600' : 'text-green-600'}>
                    {ipc.errorCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Methods:</span>
                  <span className="text-muted-foreground">
                    {ipc.availableMethods.length}
                  </span>
                </div>
                {ipc.lastHealthCheck && (
                  <div className="flex justify-between">
                    <span>Last Check:</span>
                    <span className="text-muted-foreground">
                      {ipc.lastHealthCheck.toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRetry}
                  className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={ipc.clearErrors}
                  className="flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs hover:bg-secondary/90"
                >
                  Clear Errors
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default IPCStatusNotification;