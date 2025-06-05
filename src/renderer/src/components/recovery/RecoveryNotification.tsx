/**
 * Recovery Notification Component (2025)
 * 
 * Provides user-friendly notifications for recovery operations,
 * crash detection, and state restoration activities.
 * 
 * Features:
 * - Animated toast notifications
 * - Progress indicators for recovery operations
 * - Interactive recovery options
 * - Accessibility support
 * - Auto-dismiss with manual override
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  X, 
  Download, 
  Eye, 
  Settings,
  Shield
} from 'lucide-react';

// Notification types
export type NotificationType = 'success' | 'warning' | 'error' | 'info' | 'recovery';

// Notification data structure
export interface RecoveryNotificationData {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  duration?: number; // Auto-dismiss time in ms (0 = manual dismiss only)
  persistent?: boolean; // Don't auto-dismiss
  actions?: NotificationAction[];
  progress?: number; // 0-100 for progress notifications
  metadata?: Record<string, any>;
}

// Action button configuration
export interface NotificationAction {
  id: string;
  label: string;
  variant: 'primary' | 'secondary' | 'destructive';
  icon?: React.ComponentType<{ size?: number }>;
  onClick: () => void | Promise<void>;
  loading?: boolean;
}

// Notification component props
export interface RecoveryNotificationProps {
  notification: RecoveryNotificationData;
  onDismiss: (id: string) => void;
  onActionClick: (notificationId: string, actionId: string) => void;
}

// Notification manager props
export interface RecoveryNotificationManagerProps {
  maxNotifications?: number;
  defaultDuration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
  className?: string;
}

/**
 * Individual notification component
 */
export const _RecoveryNotification: React.FC<RecoveryNotificationProps> = ({
  notification,
  onDismiss,
  onActionClick
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Auto-dismiss timer
  useEffect(() => {
    if (!notification.persistent && notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, notification.duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [notification.duration, notification.persistent]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    // Delay actual dismissal to allow exit animation
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  }, [notification.id, onDismiss]);

  const handleActionClick = useCallback(async (actionId: string) => {
    const action = notification.actions?.find(a => a.id === actionId);
    if (!action) return;

    setActionLoading(prev => ({ ...prev, [actionId]: true }));

    try {
      await action.onClick();
      onActionClick(notification.id, actionId);
    } catch (error) {
      console.error('Notification action failed:', error);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionId]: false }));
    }
  }, [notification.actions, notification.id, onActionClick]);

  // Get notification styling based on type
  const getNotificationStyles = () => {
    const baseStyles = "relative overflow-hidden bg-card border shadow-lg rounded-lg";
    
    switch (notification.type) {
      case 'success':
        return `${baseStyles} border-green-200 bg-green-50`;
      case 'warning':
        return `${baseStyles} border-yellow-200 bg-yellow-50`;
      case 'error':
        return `${baseStyles} border-red-200 bg-red-50`;
      case 'recovery':
        return `${baseStyles} border-blue-200 bg-blue-50`;
      default:
        return `${baseStyles} border-border`;
    }
  };

  // Get icon for notification type
  const getIcon = () => {
    const iconProps = { size: 20 };
    
    switch (notification.type) {
      case 'success':
        return <CheckCircle {...iconProps} className="text-green-600" />;
      case 'warning':
        return <AlertTriangle {...iconProps} className="text-yellow-600" />;
      case 'error':
        return <XCircle {...iconProps} className="text-red-600" />;
      case 'recovery':
        return <Shield {...iconProps} className="text-blue-600" />;
      default:
        return <Clock {...iconProps} className="text-muted-foreground" />;
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor(diff / 1000);

    if (minutes > 0) return `${minutes}m ago`;
    if (seconds > 0) return `${seconds}s ago`;
    return 'Just now';
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.8 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={getNotificationStyles()}
      style={{ width: '400px', maxWidth: '90vw' }}
    >
      {/* Progress bar for recovery operations */}
      {typeof notification.progress === 'number' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${notification.progress}%` }}
            className="h-full bg-primary transition-all duration-300"
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className="font-medium text-foreground">
                  {notification.title}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {notification.message}
                </p>
              </div>

              {/* Dismiss button */}
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 hover:bg-muted rounded transition-colors"
                aria-label="Dismiss notification"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Progress text for recovery operations */}
            {typeof notification.progress === 'number' && (
              <div className="mt-2 text-xs text-muted-foreground">
                {notification.progress < 100 
                  ? `Recovery in progress: ${notification.progress}%`
                  : 'Recovery completed'
                }
              </div>
            )}

            {/* Actions */}
            {notification.actions && notification.actions.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                {notification.actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action.id)}
                    disabled={actionLoading[action.id] || action.loading}
                    className={`
                      inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                      ${action.variant === 'primary' 
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : action.variant === 'destructive'
                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                      }
                    `}
                  >
                    {(actionLoading[action.id] || action.loading) ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <RefreshCw size={12} />
                      </motion.div>
                    ) : action.icon ? (
                      <action.icon size={12} />
                    ) : null}
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <div className="mt-2 text-xs text-muted-foreground">
              {formatTime(notification.timestamp)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Notification manager component
 */
export const _RecoveryNotificationManager: React.FC<RecoveryNotificationManagerProps> = ({
  maxNotifications = 5,
  defaultDuration = 5000,
  position = 'top-right',
  className = ''
}) => {
  const [notifications, setNotifications] = useState<RecoveryNotificationData[]>([]);

  // Add notification method (exposed via ref or context)
  const addNotification = useCallback((
    notification: Omit<RecoveryNotificationData, 'id' | 'timestamp'>
  ) => {
    const newNotification: RecoveryNotificationData = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      timestamp: Date.now(),
      duration: notification.duration ?? defaultDuration
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, maxNotifications);
    });

    return newNotification.id;
  }, [defaultDuration, maxNotifications]);

  // Update notification (for progress updates)
  const updateNotification = useCallback((id: string, updates: Partial<RecoveryNotificationData>) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, ...updates }
          : notification
      )
    );
  }, []);

  // Remove notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Handle action clicks
  const handleActionClick = useCallback((notificationId: string, actionId: string) => {
    // Could emit events or handle specific actions here
    console.debug('Notification action clicked:', { notificationId, actionId });
  }, []);

  // Position styles
  const getPositionStyles = () => {
    const baseStyles = "fixed z-50 pointer-events-none";
    
    switch (position) {
      case 'top-right':
        return `${baseStyles} top-4 right-4`;
      case 'top-left':
        return `${baseStyles} top-4 left-4`;
      case 'bottom-right':
        return `${baseStyles} bottom-4 right-4`;
      case 'bottom-left':
        return `${baseStyles} bottom-4 left-4`;
      case 'top-center':
        return `${baseStyles} top-4 left-1/2 transform -translate-x-1/2`;
      default:
        return `${baseStyles} top-4 right-4`;
    }
  };

  // Expose methods via global context or window object for external use
  useEffect(() => {
    // In a real implementation, you'd use a context provider or global state
    (window as any).recoveryNotificationManager = {
      addNotification,
      updateNotification,
      removeNotification,
      
      // Convenience methods for common notification types
      success: (title: string, message: string, options?: Partial<RecoveryNotificationData>) =>
        addNotification({ type: 'success', title, message, ...options }),
      
      warning: (title: string, message: string, options?: Partial<RecoveryNotificationData>) =>
        addNotification({ type: 'warning', title, message, ...options }),
      
      error: (title: string, message: string, options?: Partial<RecoveryNotificationData>) =>
        addNotification({ type: 'error', title, message, persistent: true, ...options }),
      
      recovery: (title: string, message: string, progress?: number, options?: Partial<RecoveryNotificationData>) =>
        addNotification({ 
          type: 'recovery', 
          title, 
          message, 
          progress, 
          persistent: progress !== undefined && progress < 100,
          ...options 
        })
    };

    return () => {
      delete (window as any).recoveryNotificationManager;
    };
  }, [addNotification, updateNotification, removeNotification]);

  return (
    <div className={`${getPositionStyles()} ${className}`}>
      <div className="space-y-3 pointer-events-auto">
        <AnimatePresence>
          {notifications.map(notification => (
            <_RecoveryNotification
              key={notification.id}
              notification={notification}
              onDismiss={removeNotification}
              onActionClick={handleActionClick}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Convenience hooks for using notifications
export const useRecoveryNotifications = () => {
  const manager = (window as any).recoveryNotificationManager;
  
  if (!manager) {
    console.warn('RecoveryNotificationManager not found. Make sure it is mounted in your app.');
    return {
      addNotification: () => '',
      updateNotification: () => {},
      removeNotification: () => {},
      success: () => '',
      warning: () => '',
      error: () => '',
      recovery: () => ''
    };
  }
  
  return manager;
};

// Export utility function for creating notification data
export const createRecoveryNotification = (
  type: NotificationType,
  title: string,
  message: string,
  options?: Partial<RecoveryNotificationData>
): Omit<RecoveryNotificationData, 'id' | 'timestamp'> => ({
  type,
  title,
  message,
  ...options
});


export default _RecoveryNotificationManager;