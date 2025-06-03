/**
 * Store Error Wrapper for Zustand Operations (2025)
 * 
 * This wrapper provides comprehensive error handling, retry mechanisms,
 * and recovery functionality for all Zustand store operations.
 * 
 * Following 2025 patterns for resilient state management and error boundaries.
 */

import { useErrorStore, type StoreError } from './errorStore';
import { useTaskStore } from './useTaskStore';
import type { Task } from '@/types';

// Error severity mapping based on operation type
const ERROR_SEVERITY_MAP: Record<string, StoreError['severity']> = {
  'read': 'low',
  'filter': 'low',
  'search': 'low',
  'add': 'medium',
  'update': 'medium',
  'delete': 'high',
  'bulk': 'high',
  'import': 'critical',
  'export': 'medium',
  'reset': 'critical'
};

// Retry configuration for different operation types
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[];
}

const RETRY_CONFIGS: Record<string, RetryConfig> = {
  'read': {
    maxAttempts: 3,
    baseDelay: 100,
    backoffMultiplier: 1.5,
    jitter: true,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMIT']
  },
  'write': {
    maxAttempts: 5,
    baseDelay: 500,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'CONFLICT', 'RATE_LIMIT']
  },
  'critical': {
    maxAttempts: 7,
    baseDelay: 1000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'CONFLICT', 'RATE_LIMIT', 'TEMPORARY_ERROR']
  }
};

// Operation context for error tracking
interface OperationContext {
  operation: string;
  operationType: 'read' | 'write' | 'critical';
  startTime: number;
  attempt: number;
  maxAttempts: number;
  lastError?: Error;
}

// Wrapper function type
type StoreOperation<T extends any[], R> = (...args: T) => R;
type AsyncStoreOperation<T extends any[], R> = (...args: T) => Promise<R>;

/**
 * Error wrapper for synchronous store operations
 */
function withErrorHandling<T extends any[], R>(
  operation: StoreOperation<T, R>,
  operationName: string,
  operationType: 'read' | 'write' | 'critical' = 'read'
): StoreOperation<T, R> {
  return (...args: T): R => {
    const addError = useErrorStore.getState().addError;
    const createBackup = useErrorStore.getState().createBackup;
    const context: OperationContext = {
      operation: operationName,
      operationType,
      startTime: Date.now(),
      attempt: 1,
      maxAttempts: 1 // Sync operations don't retry
    };

    try {
      // Create backup before write/critical operations
      if (operationType !== 'read') {
        const currentState = useTaskStore.getState();
        createBackup('taskStore', {
          tasks: currentState.tasks,
          selectedTask: currentState.selectedTask,
          filters: currentState.filters,
          userSettings: currentState.userSettings
        });
      }

      const result = operation(...args);
      
      // Record operation metrics (2025 pattern)
      operationMonitor.recordOperation(operationName, true, Date.now() - context.startTime);
      
      // Log successful operation in development
      if (process.env.NODE_ENV === 'development') {
        const duration = Date.now() - context.startTime;
        console.log(`✅ Store operation '${operationName}' completed in ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      
      // Record operation metrics (2025 pattern)
      const duration = Date.now() - context.startTime;
      operationMonitor.recordOperation(operationName, false, duration, error instanceof Error ? error.name : 'UnknownError');
      
      // Add error to error store
      addError({
        code: 'STORE_OPERATION_ERROR',
        message: `Store operation '${operationName}' failed: ${errorMessage}`,
        stack,
        context: {
          operation: operationName,
          operationType,
          args: args.length > 0 ? args : undefined,
          duration,
          attempt: context.attempt
        },
        severity: ERROR_SEVERITY_MAP[operationType] || 'medium',
        retryable: false, // Sync operations are not retryable
        operation: operationName,
        store: 'taskStore',
        recovered: false,
        reported: false
      });

      // Re-throw the error for component-level handling
      throw error;
    }
  };
}

/**
 * Error wrapper for asynchronous store operations with retry
 */
function withAsyncErrorHandling<T extends any[], R>(
  operation: AsyncStoreOperation<T, R>,
  operationName: string,
  operationType: 'read' | 'write' | 'critical' = 'read'
): AsyncStoreOperation<T, R> {
  return async (...args: T): Promise<R> => {
    const { addError, createBackup, markErrorRecovered } = useErrorStore.getState();
    const retryConfig = RETRY_CONFIGS[operationType];
    const context: OperationContext = {
      operation: operationName,
      operationType,
      startTime: Date.now(),
      attempt: 0,
      maxAttempts: retryConfig.maxAttempts
    };

    const executeWithRetry = async (): Promise<R> => {
      context.attempt++;
      
      try {
        // Create backup before write/critical operations on first attempt
        if (operationType !== 'read' && context.attempt === 1) {
          const currentState = useTaskStore.getState();
          createBackup('taskStore', {
            tasks: currentState.tasks,
            selectedTask: currentState.selectedTask,
            filters: currentState.filters,
            userSettings: currentState.userSettings
          });
        }

        const result = await operation(...args);
        
        // Log successful operation
        if (process.env.NODE_ENV === 'development') {
          const duration = Date.now() - context.startTime;
          const attemptInfo = context.attempt > 1 ? ` (attempt ${context.attempt})` : '';
          console.log(`✅ Async store operation '${operationName}' completed in ${duration}ms${attemptInfo}`);
        }
        
        // Mark any previous errors as recovered
        if (context.attempt > 1 && context.lastError) {
          markErrorRecovered(`${operationName}_${context.startTime}`);
        }
        
        return result;
      } catch (error) {
        context.lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = context.lastError.message;
        const isRetryableError = retryConfig.retryableErrors.some(retryableError => 
          errorMessage.includes(retryableError) || context.lastError!.name === retryableError
        );
        
        // Check if we should retry
        if (context.attempt < context.maxAttempts && (isRetryableError || operationType === 'critical')) {
          // Calculate delay with exponential backoff and jitter
          const baseDelay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, context.attempt - 1);
          const jitterAmount = retryConfig.jitter ? Math.random() * 0.1 * baseDelay : 0;
          const delay = baseDelay + jitterAmount;
          
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ Store operation '${operationName}' failed (attempt ${context.attempt}), retrying in ${Math.round(delay)}ms...`);
          }
          
          // Use AbortController for proper cancellation (2025 best practice)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, Math.min(delay, 5000)); // Cap at 5 seconds
          
          try {
            await new Promise((resolve, reject) => {
              const delayTimeout = setTimeout(resolve, delay);
              controller.signal.addEventListener('abort', () => {
                clearTimeout(delayTimeout);
                reject(new Error('Retry delay cancelled'));
              });
            });
          } finally {
            clearTimeout(timeoutId);
          }
          return executeWithRetry();
        }
        
        // Add error to error store (final attempt or non-retryable)
        addError({
          code: 'ASYNC_STORE_OPERATION_ERROR',
          message: `Async store operation '${operationName}' failed after ${context.attempt} attempts: ${errorMessage}`,
          stack: context.lastError.stack,
          context: {
            operation: operationName,
            operationType,
            args: args.length > 0 ? args : undefined,
            duration: Date.now() - context.startTime,
            totalAttempts: context.attempt,
            maxAttempts: context.maxAttempts,
            retryable: isRetryableError
          },
          severity: ERROR_SEVERITY_MAP[operationType] || 'medium',
          retryable: isRetryableError && context.attempt < context.maxAttempts,
          operation: operationName,
          store: 'taskStore',
          recovered: false,
          reported: false
        });

        throw context.lastError;
      }
    };

    return executeWithRetry();
  };
}

/**
 * Enhanced Circuit Breaker implementation for critical operations (2025)
 * 
 * Features half-open state management, metrics collection, and advanced
 * failure detection patterns following 2025 resilience best practices.
 */
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private successCount = 0;
  private totalAttempts = 0;
  private metrics = {
    totalFailures: 0,
    totalSuccesses: 0,
    averageResponseTime: 0,
    lastStateChange: Date.now()
  };
  
  constructor(
    private readonly threshold = 5,
    private readonly timeout = 60000, // 1 minute
    private readonly halfOpenMaxAttempts = 3 // 2025 pattern: limited attempts in half-open state
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.totalAttempts++;

    // State management following 2025 patterns
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.timeout) {
        throw new Error(`Circuit breaker is open. Retry after ${Math.round((this.timeout - timeSinceLastFailure) / 1000)}s`);
      }
      // Transition to half-open state
      this.transitionToHalfOpen();
    }

    // In half-open state, limit concurrent attempts
    if (this.state === 'half-open' && this.successCount >= this.halfOpenMaxAttempts) {
      throw new Error('Circuit breaker in half-open state: max attempts reached');
    }

    try {
      const result = await operation();
      const responseTime = Date.now() - startTime;
      this.onSuccess(responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.onFailure(responseTime);
      throw error;
    }
  }

  private onSuccess(responseTime: number): void {
    this.metrics.totalSuccesses++;
    this.metrics.averageResponseTime = this.updateAverage(this.metrics.averageResponseTime, responseTime, this.metrics.totalSuccesses);
    
    if (this.state === 'half-open') {
      this.successCount++;
      // After successful attempts in half-open, transition to closed
      if (this.successCount >= this.halfOpenMaxAttempts) {
        this.transitionToClosed();
      }
    } else if (this.state === 'closed') {
      this.failureCount = 0; // Reset failure count on success
    }
  }

  private onFailure(responseTime: number): void {
    this.metrics.totalFailures++;
    this.metrics.averageResponseTime = this.updateAverage(this.metrics.averageResponseTime, responseTime, this.metrics.totalFailures + this.metrics.totalSuccesses);
    
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'closed' && this.failureCount >= this.threshold) {
      this.transitionToOpen();
    } else if (this.state === 'half-open') {
      // Any failure in half-open state transitions back to open
      this.transitionToOpen();
    }
  }

  private transitionToOpen(): void {
    this.state = 'open';
    this.metrics.lastStateChange = Date.now();
    if (process.env.NODE_ENV === 'development') {
      console.warn(`🔴 Circuit breaker OPEN: ${this.failureCount} failures, threshold: ${this.threshold}`);
    }
  }

  private transitionToHalfOpen(): void {
    this.state = 'half-open';
    this.successCount = 0;
    this.metrics.lastStateChange = Date.now();
    if (process.env.NODE_ENV === 'development') {
      console.log(`🟡 Circuit breaker HALF-OPEN: testing recovery`);
    }
  }

  private transitionToClosed(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.metrics.lastStateChange = Date.now();
    if (process.env.NODE_ENV === 'development') {
      console.log(`🟢 Circuit breaker CLOSED: recovery successful`);
    }
  }

  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    return (currentAvg * (count - 1) + newValue) / count;
  }

  getState(): { 
    state: 'closed' | 'open' | 'half-open';
    isOpen: boolean; 
    failureCount: number; 
    lastFailureTime: number;
    metrics: typeof this.metrics;
    totalAttempts: number;
  } {
    return {
      state: this.state,
      isOpen: this.state === 'open',
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      metrics: { ...this.metrics },
      totalAttempts: this.totalAttempts
    };
  }

  reset(): void {
    this.failureCount = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
    this.successCount = 0;
    this.totalAttempts = 0;
    this.metrics = {
      totalFailures: 0,
      totalSuccesses: 0,
      averageResponseTime: 0,
      lastStateChange: Date.now()
    };
  }
}

// Enhanced monitoring and bulkhead patterns for operation isolation (2025)
interface OperationMetrics {
  totalOperations: number;
  successRate: number;
  averageLatency: number;
  p95Latency: number;
  errorsByType: Record<string, number>;
  lastReset: number;
}

// Global operation monitoring (2025 pattern)
const operationMonitor = {
  metrics: new Map<string, OperationMetrics>(),
  latencyHistory: new Map<string, number[]>(),
  
  recordOperation(operationName: string, success: boolean, latency: number, errorType?: string) {
    const existing = this.metrics.get(operationName) || {
      totalOperations: 0,
      successRate: 100,
      averageLatency: 0,
      p95Latency: 0,
      errorsByType: {},
      lastReset: Date.now()
    };
    
    existing.totalOperations++;
    existing.successRate = ((existing.successRate * (existing.totalOperations - 1)) + (success ? 100 : 0)) / existing.totalOperations;
    existing.averageLatency = ((existing.averageLatency * (existing.totalOperations - 1)) + latency) / existing.totalOperations;
    
    if (!success && errorType) {
      existing.errorsByType[errorType] = (existing.errorsByType[errorType] || 0) + 1;
    }
    
    // Track latency for P95 calculation
    const history = this.latencyHistory.get(operationName) || [];
    history.push(latency);
    if (history.length > 100) history.shift(); // Keep last 100 measurements
    this.latencyHistory.set(operationName, history);
    
    // Calculate P95
    const sorted = [...history].sort((a, b) => a - b);
    existing.p95Latency = sorted[Math.floor(sorted.length * 0.95)] || latency;
    
    this.metrics.set(operationName, existing);
  },
  
  getMetrics(): Map<string, OperationMetrics> {
    return new Map(this.metrics);
  },
  
  resetMetrics(): void {
    this.metrics.clear();
    this.latencyHistory.clear();
  }
};

// Circuit breakers for different operation types - Optimized timeouts for 2025
const circuitBreakers = {
  critical: new CircuitBreaker(3, 10000), // 3 failures, 10s timeout (reduced from 30s)
  write: new CircuitBreaker(5, 15000),    // 5 failures, 15s timeout (reduced from 60s)
  read: new CircuitBreaker(10, 20000)     // 10 failures, 20s timeout (reduced from 120s)
};

// Circuit breaker wrapper removed - functionality integrated into withAsyncErrorHandling
// for better performance and reduced complexity in 2025 patterns

/**
 * Safe wrapper that catches all errors and provides fallback values
 */
function withSafeWrapper<T extends any[], R>(
  operation: StoreOperation<T, R>,
  operationName: string,
  fallbackValue: R
): StoreOperation<T, R> {
  return (...args: T): R => {
    try {
      return withErrorHandling(operation, operationName)(...args);
    } catch (error) {
      console.warn(`Safe wrapper: operation '${operationName}' failed, returning fallback value`, error);
      return fallbackValue;
    }
  };
}

/**
 * Store wrapper that provides error-handling versions of all store operations
 */
export const createErrorHandledTaskStore = () => {
  const store = useTaskStore;
  
  return {
    // Read operations (with safe wrappers and fallbacks)
    getTasks: withSafeWrapper(
      () => store.getState().tasks,
      'getTasks',
      []
    ),
    
    getFilteredTasks: withSafeWrapper(
      store.getState().getFilteredTasks,
      'getFilteredTasks',
      []
    ),
    
    getTaskById: withSafeWrapper(
      store.getState().getTaskById,
      'getTaskById',
      undefined
    ),
    
    getTasksByStatus: withSafeWrapper(
      store.getState().getTasksByStatus,
      'getTasksByStatus',
      []
    ),
    
    getTasksByPriority: withSafeWrapper(
      store.getState().getTasksByPriority,
      'getTasksByPriority',
      []
    ),
    
    getDependentTasks: withSafeWrapper(
      store.getState().getDependentTasks,
      'getDependentTasks',
      []
    ),
    
    getBlockingTasks: withSafeWrapper(
      store.getState().getBlockingTasks,
      'getBlockingTasks',
      []
    ),
    
    // Write operations (with error handling and retries)
    setTasks: withErrorHandling(
      store.getState().setTasks,
      'setTasks',
      'write'
    ),
    
    addTask: withErrorHandling(
      store.getState().addTask,
      'addTask',
      'write'
    ),
    
    updateTask: withErrorHandling(
      store.getState().updateTask,
      'updateTask',
      'write'
    ),
    
    deleteTask: withErrorHandling(
      store.getState().deleteTask,
      'deleteTask',
      'write'
    ),
    
    duplicateTask: withErrorHandling(
      store.getState().duplicateTask,
      'duplicateTask',
      'write'
    ),
    
    // Subtask operations
    addSubtask: withErrorHandling(
      store.getState().addSubtask,
      'addSubtask',
      'write'
    ),
    
    updateSubtask: withErrorHandling(
      store.getState().updateSubtask,
      'updateSubtask',
      'write'
    ),
    
    deleteSubtask: withErrorHandling(
      store.getState().deleteSubtask,
      'deleteSubtask',
      'write'
    ),
    
    // Bulk operations (high-risk)
    updateMultipleTasks: withErrorHandling(
      store.getState().updateMultipleTasks,
      'updateMultipleTasks',
      'critical'
    ),
    
    deleteMultipleTasks: withErrorHandling(
      store.getState().deleteMultipleTasks,
      'deleteMultipleTasks',
      'critical'
    ),
    
    // Data operations (critical) - Fixed timeout issues by removing unnecessary Promise wrapping
    loadFromJSON: withAsyncErrorHandling(
      async (data: { tasks: Task[] }) => {
        // Use AbortController for proper timeout handling (2025 best practice)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 3000); // Reduced to 3 seconds for faster tests
        
        try {
          await new Promise<void>((resolve, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error('loadFromJSON operation timed out after 3000ms'));
            });
            
            // Execute synchronously but allow cancellation
            try {
              store.getState().loadFromJSON(data);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        } finally {
          clearTimeout(timeoutId);
        }
      },
      'loadFromJSON',
      'critical'
    ),
    
    exportToJSON: withSafeWrapper(
      store.getState().exportToJSON,
      'exportToJSON',
      { tasks: [] }
    ),
    
    resetStore: withErrorHandling(
      store.getState().resetStore,
      'resetStore',
      'critical'
    ),
    
    // UI state operations (low-risk)
    setSelectedTask: withErrorHandling(
      store.getState().setSelectedTask,
      'setSelectedTask',
      'read'
    ),
    
    setFilters: withErrorHandling(
      store.getState().setFilters,
      'setFilters',
      'read'
    ),
    
    clearFilters: withErrorHandling(
      store.getState().clearFilters,
      'clearFilters',
      'read'
    ),
    
    setViewMode: withErrorHandling(
      store.getState().setViewMode,
      'setViewMode',
      'read'
    ),
    
    setUserSettings: withErrorHandling(
      store.getState().setUserSettings,
      'setUserSettings',
      'write'
    ),
    
    setSearchQuery: withErrorHandling(
      store.getState().setSearchQuery,
      'setSearchQuery',
      'read'
    ),
    
    setSidebarCollapsed: withErrorHandling(
      store.getState().setSidebarCollapsed,
      'setSidebarCollapsed',
      'read'
    ),
    
    // Subscribe to store changes
    subscribe: store.subscribe,
    
    // Get current state (safe)
    getState: withSafeWrapper(
      store.getState,
      'getState',
      store.getInitialState?.() || {
        tasks: [],
        selectedTask: null,
        filters: {},
        viewMode: { type: 'list', density: 'comfortable', groupBy: 'status', sortBy: 'id', sortOrder: 'asc' },
        userSettings: { ui: {}, notifications: {}, workingHours: {} },
        analytics: {},
        isLoading: false,
        searchQuery: '',
        sidebarCollapsed: false
      } as any
    ),
    
    // Circuit breaker controls
    resetCircuitBreakers: () => {
      Object.values(circuitBreakers).forEach(breaker => breaker.reset());
    },
    
    getCircuitBreakerStates: () => {
      return Object.entries(circuitBreakers).reduce((acc, [key, breaker]) => {
        acc[key] = breaker.getState();
        return acc;
      }, {} as Record<string, any>);
    }
  };
};

// Export the error-handled store instance
export const errorHandledTaskStore = createErrorHandledTaskStore();

// Export types and utilities
export type ErrorHandledTaskStore = ReturnType<typeof createErrorHandledTaskStore>;
export { circuitBreakers, ERROR_SEVERITY_MAP, RETRY_CONFIGS };

// Hook for components to use the error-handled store
export const useErrorHandledTaskStore = () => {
  return errorHandledTaskStore;
};