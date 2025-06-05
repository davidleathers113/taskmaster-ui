/**
 * Zustand Error Store for Centralized Error Management (2025)
 * 
 * This store manages application-wide errors from Zustand operations,
 * providing recovery mechanisms and state backup/restore functionality.
 * 
 * Following 2025 patterns for error boundaries and state recovery.
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Error types and interfaces
export interface StoreError {
  id: string;
  code: string;
  message: string;
  stack?: string;
  context?: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  operation: string;
  store: string;
  recovered: boolean;
  reported: boolean;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByStore: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  recoverySuccessRate: number;
  lastErrorTime: Date | null;
  criticalErrorCount: number;
}

export interface StoreBackup {
  id: string;
  storeName: string;
  state: any;
  timestamp: Date;
  version: string;
  checksum: string;
  metadata: {
    userAgent: string;
    url: string;
    storeVersion: number;
  };
}

export interface RecoveryStrategy {
  type: 'rollback' | 'reset' | 'merge' | 'retry' | 'ignore';
  description: string;
  automatic: boolean;
  priority: number;
}

export interface ErrorStoreState {
  // Error management
  errors: StoreError[];
  maxErrors: number;
  autoCleanupEnabled: boolean;
  autoCleanupThreshold: number;
  
  // Recovery state
  isRecovering: boolean;
  recoveryProgress: number;
  lastRecoveryAttempt: Date | null;
  
  // Backup management
  backups: StoreBackup[];
  maxBackups: number;
  autoBackupEnabled: boolean;
  backupInterval: number;
  
  // Metrics and monitoring
  metrics: ErrorMetrics;
  
  // Configuration
  enableDetailedLogging: boolean;
  enableTelemetry: boolean;
  recoveryStrategies: Record<string, RecoveryStrategy>;
}

export interface ErrorStoreActions {
  // Error management
  addError: (error: Omit<StoreError, 'id' | 'timestamp'>) => void;
  addErrors: (errors: Omit<StoreError, 'id' | 'timestamp'>[]) => void; // 2025 bulk operation
  clearError: (errorId: string) => void;
  clearErrors: (storeName?: string) => void;
  clearAllErrors: () => void;
  markErrorRecovered: (errorId: string) => void;
  
  // Recovery actions
  startRecovery: (strategy: string) => Promise<boolean>;
  cancelRecovery: () => void;
  setRecoveryProgress: (progress: number) => void;
  
  // Backup management
  createBackup: (storeName: string, state: any) => StoreBackup;
  restoreFromBackup: (backupId: string) => Promise<boolean>;
  deleteBackup: (backupId: string) => void;
  cleanupOldBackups: () => void;
  
  // Metrics
  updateMetrics: () => void;
  getErrorsByStore: (storeName: string) => StoreError[];
  getErrorsBySeverity: (severity: StoreError['severity']) => StoreError[];
  getCriticalErrors: () => StoreError[];
  
  // Configuration
  setMaxErrors: (max: number) => void;
  setAutoBackup: (enabled: boolean, interval?: number) => void;
  setRecoveryStrategy: (operation: string, strategy: RecoveryStrategy) => void;
  
  // Utility
  resetStore: () => void;
  exportErrorData: () => string;
  importErrorData: (data: string) => boolean;
}

type ErrorStore = ErrorStoreState & ErrorStoreActions;

// Default recovery strategies
const _defaultRecoveryStrategies: Record<string, RecoveryStrategy> = {
  'task-operations': {
    type: 'rollback',
    description: 'Rollback to last known good state for task operations',
    automatic: true,
    priority: 1
  },
  'data-loading': {
    type: 'retry',
    description: 'Retry data loading operations',
    automatic: true,
    priority: 2
  },
  'user-settings': {
    type: 'merge',
    description: 'Merge user settings with defaults',
    automatic: true,
    priority: 3
  },
  'critical-failure': {
    type: 'reset',
    description: 'Reset to initial state for critical failures',
    automatic: false,
    priority: 0
  }
};

// Initial state
const initialState: ErrorStoreState = {
  errors: [],
  maxErrors: 50,
  autoCleanupEnabled: true,
  autoCleanupThreshold: 100,
  
  isRecovering: false,
  recoveryProgress: 0,
  lastRecoveryAttempt: null,
  
  backups: [],
  maxBackups: 10,
  autoBackupEnabled: true,
  backupInterval: 300000, // 5 minutes
  
  metrics: {
    totalErrors: 0,
    errorsByStore: {},
    errorsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    recoverySuccessRate: 100,
    lastErrorTime: null,
    criticalErrorCount: 0
  },
  
  enableDetailedLogging: process.env.NODE_ENV === 'development',
  enableTelemetry: true,
  recoveryStrategies: _defaultRecoveryStrategies
};

// Utility functions
const generateId = (): string => {
  return `error_${Date.now()}_${Math.random().toString(36).substring(2)}`;
};

const generateChecksum = (data: any): string => {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
};

const shouldAutoCleanup = (state: ErrorStoreState): boolean => {
  return state.autoCleanupEnabled && state.errors.length >= state.autoCleanupThreshold;
};

// Create the error store with middleware
export const useErrorStore = create<ErrorStore>()(
  persist(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,
        
        // Error management
        addError: (errorData) => set((state) => {
          const error: StoreError = {
            ...errorData,
            id: generateId(),
            timestamp: new Date()
          };
          
          state.errors.unshift(error);
          
          // Enforce max errors limit
          if (state.errors.length > state.maxErrors) {
            state.errors = state.errors.slice(0, state.maxErrors);
          }
          
          // Auto cleanup if needed
          if (shouldAutoCleanup(state)) {
            const keepCount = Math.floor(state.maxErrors * 0.7);
            state.errors = state.errors.slice(0, keepCount);
          }
          
          // Update metrics
          state.metrics.totalErrors++;
          state.metrics.errorsByStore[error.store] = (state.metrics.errorsByStore[error.store] || 0) + 1;
          state.metrics.errorsBySeverity[error.severity] = (state.metrics.errorsBySeverity[error.severity] || 0) + 1;
          state.metrics.lastErrorTime = error.timestamp;
          
          if (error.severity === 'critical') {
            state.metrics.criticalErrorCount++;
          }
          
          // Log error in development
          if (state.enableDetailedLogging) {
            console.group(`🔴 Store Error [${error.severity.toUpperCase()}]`);
            console.error('Operation:', error.operation);
            console.error('Store:', error.store);
            console.error('Message:', error.message);
            if (error.context) console.error('Context:', error.context);
            if (error.stack) console.error('Stack:', error.stack);
            console.groupEnd();
          }
        }),

        // 2025 Bulk Operations for Performance (optimized)
        addErrors: (errorDataArray) => set((state) => {
          if (errorDataArray.length === 0) return;
          
          // Create all error objects at once (2025 pattern)
          const newErrors: StoreError[] = errorDataArray.map(errorData => ({
            ...errorData,
            id: generateId(),
            timestamp: new Date()
          }));
          
          // Batch add all errors (single state mutation)
          state.errors.unshift(...newErrors);
          
          // Efficient cleanup with single slice operation
          if (state.errors.length > state.maxErrors) {
            state.errors = state.errors.slice(0, state.maxErrors);
          }
          
          // Auto cleanup optimization
          if (shouldAutoCleanup(state)) {
            const keepCount = Math.floor(state.maxErrors * 0.7);
            state.errors = state.errors.slice(0, keepCount);
          }
          
          // Batch metrics updates (2025 pattern)
          const errorsByStore: Record<string, number> = {};
          const errorsBySeverity: Record<string, number> = {};
          let criticalCount = 0;
          
          newErrors.forEach(error => {
            errorsByStore[error.store] = (errorsByStore[error.store] || 0) + 1;
            errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
            if (error.severity === 'critical') criticalCount++;
          });
          
          // Update metrics in batch
          state.metrics.totalErrors += newErrors.length;
          Object.entries(errorsByStore).forEach(([store, count]) => {
            state.metrics.errorsByStore[store] = (state.metrics.errorsByStore[store] || 0) + count;
          });
          Object.entries(errorsBySeverity).forEach(([severity, count]) => {
            state.metrics.errorsBySeverity[severity] = (state.metrics.errorsBySeverity[severity] || 0) + count;
          });
          state.metrics.criticalErrorCount += criticalCount;
          state.metrics.lastErrorTime = newErrors[0]?.timestamp || new Date();
          
          // Batch logging for development (2025 pattern)
          if (state.enableDetailedLogging && newErrors.length > 0) {
            console.group(`🔴 Bulk Store Errors [${newErrors.length} errors]`);
            console.table(newErrors.map(e => ({
              severity: e.severity,
              operation: e.operation,
              store: e.store,
              message: e.message.substring(0, 50) + '...'
            })));
            console.groupEnd();
          }
        }),
        
        clearError: (errorId: string) => set((state) => {
          state.errors = state.errors.filter((error: StoreError) => error.id !== errorId);
        }),
        
        clearErrors: (storeName?: string) => set((state) => {
          if (storeName) {
            state.errors = state.errors.filter((error: StoreError) => error.store !== storeName);
          } else {
            state.errors = [];
          }
        }),
        
        clearAllErrors: () => set((state) => {
          state.errors = [];
        }),
        
        markErrorRecovered: (errorId: string) => set((state) => {
          const error = state.errors.find((e: StoreError) => e.id === errorId);
          if (error) {
            error.recovered = true;
          }
        }),
        
        // Recovery actions
        startRecovery: async (_strategy: string) => {
          set((state) => {
            state.isRecovering = true;
            state.recoveryProgress = 0;
            state.lastRecoveryAttempt = new Date();
          });
          
          try {
            // Simulate recovery process
            for (let i = 0; i <= 100; i += 10) {
              set((state) => {
                state.recoveryProgress = i;
              });
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            set((state) => {
              state.isRecovering = false;
              state.recoveryProgress = 100;
              // Update success rate
              const totalAttempts = state.metrics.totalErrors || 1;
              const successfulRecoveries = state.errors.filter((e: StoreError) => e.recovered).length + 1;
              state.metrics.recoverySuccessRate = (successfulRecoveries / totalAttempts) * 100;
            });
            
            return true;
          } catch (error) {
            set((state) => {
              state.isRecovering = false;
              state.recoveryProgress = 0;
            });
            return false;
          }
        },
        
        cancelRecovery: () => set((state) => {
          state.isRecovering = false;
          state.recoveryProgress = 0;
        }),
        
        setRecoveryProgress: (progress) => set((state) => {
          state.recoveryProgress = Math.max(0, Math.min(100, progress));
        }),
        
        // Backup management
        createBackup: (storeName, storeState) => {
          const backup: StoreBackup = {
            id: `backup_${Date.now()}_${Math.random().toString(36).substring(2)}`,
            storeName,
            state: storeState,
            timestamp: new Date(),
            version: '1.0.0',
            checksum: generateChecksum(storeState),
            metadata: {
              userAgent: navigator.userAgent,
              url: window.location.href,
              storeVersion: 1
            }
          };
          
          set((state) => {
            state.backups.unshift(backup);
            
            // Enforce max backups limit
            if (state.backups.length > state.maxBackups) {
              state.backups = state.backups.slice(0, state.maxBackups);
            }
          });
          
          return backup;
        },
        
        restoreFromBackup: async (backupId) => {
          const { backups } = get();
          const backup = backups.find(b => b.id === backupId);
          
          if (!backup) {
            throw new Error(`Backup with ID ${backupId} not found`);
          }
          
          // Verify checksum
          const currentChecksum = generateChecksum(backup.state);
          if (currentChecksum !== backup.checksum) {
            throw new Error('Backup integrity check failed');
          }
          
          // Simulate restore process
          set((state) => {
            state.isRecovering = true;
            state.recoveryProgress = 0;
          });
          
          try {
            for (let i = 0; i <= 100; i += 20) {
              set((state) => {
                state.recoveryProgress = i;
              });
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            set((state) => {
              state.isRecovering = false;
              state.recoveryProgress = 100;
            });
            
            return true;
          } catch (error) {
            set((state) => {
              state.isRecovering = false;
              state.recoveryProgress = 0;
            });
            return false;
          }
        },
        
        deleteBackup: (backupId: string) => set((state) => {
          state.backups = state.backups.filter((backup: StoreBackup) => backup.id !== backupId);
        }),
        
        cleanupOldBackups: () => set((state) => {
          const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
          state.backups = state.backups.filter((backup: StoreBackup) => backup.timestamp > cutoffDate);
        }),
        
        // Metrics
        updateMetrics: () => set((state) => {
          const errors = state.errors;
          
          state.metrics.totalErrors = errors.length;
          state.metrics.errorsByStore = {};
          state.metrics.errorsBySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
          
          errors.forEach((error: StoreError) => {
            state.metrics.errorsByStore[error.store] = (state.metrics.errorsByStore[error.store] || 0) + 1;
            state.metrics.errorsBySeverity[error.severity] = (state.metrics.errorsBySeverity[error.severity] || 0) + 1;
          });
          
          state.metrics.criticalErrorCount = state.metrics.errorsBySeverity.critical || 0;
          
          const recoveredErrors = errors.filter(e => e.recovered).length;
          state.metrics.recoverySuccessRate = errors.length > 0 ? (recoveredErrors / errors.length) * 100 : 100;
        }),
        
        getErrorsByStore: (storeName) => {
          return get().errors.filter(error => error.store === storeName);
        },
        
        getErrorsBySeverity: (severity) => {
          return get().errors.filter(error => error.severity === severity);
        },
        
        getCriticalErrors: () => {
          return get().errors.filter(error => error.severity === 'critical');
        },
        
        // Configuration
        setMaxErrors: (max) => set((state) => {
          state.maxErrors = Math.max(1, max); // Allow minimum of 1, not 10
        }),
        
        setAutoBackup: (enabled, interval) => set((state) => {
          state.autoBackupEnabled = enabled;
          if (interval) {
            state.backupInterval = interval;
          }
        }),
        
        setRecoveryStrategy: (operation, strategy) => set((state) => {
          state.recoveryStrategies[operation] = strategy;
        }),
        
        // Utility
        resetStore: () => set(() => ({ ...initialState })),
        
        exportErrorData: () => {
          const { errors, metrics, backups } = get();
          return JSON.stringify({ errors, metrics, backups: backups.length }, null, 2);
        },
        
        importErrorData: (data) => {
          try {
            const parsed = JSON.parse(data);
            set((state) => {
              if (parsed.errors) state.errors = parsed.errors;
              if (parsed.metrics) state.metrics = parsed.metrics;
            });
            return true;
          } catch {
            return false;
          }
        }
      }))
    ),
    {
      name: 'taskmaster-error-store',
      version: 1,
      partialize: (state) => ({
        errors: state.errors.slice(0, 20), // Only persist last 20 errors
        metrics: state.metrics,
        backups: state.backups.slice(0, 5), // Only persist last 5 backups
        maxErrors: state.maxErrors,
        autoBackupEnabled: state.autoBackupEnabled,
        backupInterval: state.backupInterval,
        enableDetailedLogging: state.enableDetailedLogging,
        recoveryStrategies: state.recoveryStrategies
      }),
      merge: (persistedState: any, currentState: ErrorStoreState) => ({
        ...currentState,
        ...persistedState,
        // Reset volatile state
        isRecovering: false,
        recoveryProgress: 0
      })
    }
  )
);

// Export types
export type { ErrorStore };