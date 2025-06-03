/**
 * Complete Store Error Handling Integration Example (2025)
 * 
 * This example demonstrates how to integrate the complete Zustand error handling
 * system including error boundaries, backup/recovery, and store wrappers.
 * 
 * Following 2025 patterns for robust state management and error recovery.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Database, Shield, Activity, CheckCircle, Play, Download, Settings } from 'lucide-react';

// Import our error handling system
import { StoreErrorBoundary } from '@/components/error/StoreErrorBoundary';
import { useErrorStore } from '@/store/errorStore';
import { backupService } from '@/store/backupService';
import { useErrorHandledTaskStore } from '@/store/storeErrorWrapper';
import type { } from '@/types';

/**
 * Error simulation component for testing
 */
function ErrorSimulator() {
  const [isSimulating, setIsSimulating] = useState(false);
  const errorStore = useErrorStore();

  const simulateStoreError = async () => {
    setIsSimulating(true);
    try {
      // Simulate various types of errors
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // This will be caught by the error wrapper
      throw new Error('Simulated critical store operation failure');
    } catch (error) {
      console.error('Simulated error:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const simulateNetworkError = () => {
    errorStore.addError({
      code: 'NETWORK_ERROR',
      message: 'Simulated network connection failure',
      context: { endpoint: '/api/tasks', method: 'GET' },
      severity: 'high',
      retryable: true,
      operation: 'fetchTasks',
      store: 'taskStore',
      recovered: false,
      reported: false
    });
  };

  const simulateDataCorruption = () => {
    errorStore.addError({
      code: 'DATA_CORRUPTION',
      message: 'Simulated data integrity check failure',
      context: { corruptedFields: ['tasks', 'metadata'] },
      severity: 'critical',
      retryable: false,
      operation: 'dataValidation',
      store: 'taskStore',
      recovered: false,
      reported: false
    });
  };

  const triggerComponentError = () => {
    // This will be caught by the StoreErrorBoundary
    throw new Error('Simulated React component error');
  };

  return (
    <div className="bg-card border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Play className="w-5 h-5" />
        Error Simulation Controls
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={simulateStoreError}
          disabled={isSimulating}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:opacity-50"
        >
          <Database className="w-4 h-4" />
          {isSimulating ? 'Simulating...' : 'Store Error'}
        </button>
        
        <button
          onClick={simulateNetworkError}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          Network Error
        </button>
        
        <button
          onClick={simulateDataCorruption}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          <Shield className="w-4 h-4" />
          Data Corruption
        </button>
        
        <button
          onClick={triggerComponentError}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700 transition-colors"
        >
          <Activity className="w-4 h-4" />
          Component Error
        </button>
      </div>
    </div>
  );
}

/**
 * Error monitoring dashboard
 */
function ErrorMonitoringDashboard() {
  const errorStore = useErrorStore();
  const [metrics, setMetrics] = useState(errorStore.metrics);
  const [errors, setErrors] = useState(errorStore.errors);

  useEffect(() => {
    const unsubscribe = useErrorStore.subscribe((state) => {
      setMetrics(state.metrics);
      setErrors(state.errors);
    });

    return unsubscribe;
  }, []);

  const recentErrors = errors.slice(0, 5);

  return (
    <div className="bg-card border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5" />
        Error Monitoring Dashboard
      </h3>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{metrics.totalErrors}</p>
          <p className="text-sm text-muted-foreground">Total Errors</p>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{metrics.criticalErrorCount}</p>
          <p className="text-sm text-muted-foreground">Critical</p>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{Math.round(metrics.recoverySuccessRate)}%</p>
          <p className="text-sm text-muted-foreground">Recovery Rate</p>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">
            {Object.keys(metrics.errorsByStore).length}
          </p>
          <p className="text-sm text-muted-foreground">Affected Stores</p>
        </div>
      </div>

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Recent Errors</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {recentErrors.map((error) => (
              <motion.div
                key={error.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-lg border-l-4 ${
                  error.severity === 'critical' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                  error.severity === 'high' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' :
                  error.severity === 'medium' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                  'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{error.operation}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    error.severity === 'critical' ? 'bg-red-100 text-red-800' :
                    error.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                    error.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {error.severity}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{error.message}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(error.timestamp).toLocaleTimeString()}
                  </span>
                  {error.recovered && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      Recovered
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => errorStore.clearAllErrors()}
          className="flex items-center gap-1 px-3 py-1 bg-destructive text-destructive-foreground rounded text-sm hover:bg-destructive/90"
        >
          Clear All
        </button>
        
        <button
          onClick={() => {
            const data = errorStore.exportErrorData();
            console.log('Exported error data:', data);
          }}
          className="flex items-center gap-1 px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/90"
        >
          <Download className="w-3 h-3" />
          Export
        </button>
      </div>
    </div>
  );
}

/**
 * Backup status panel
 */
function BackupStatusPanel() {
  const [backups, setBackups] = useState<any[]>([]);
  const [backendStatus, setBackendStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const availableBackups = await backupService.listBackups('taskStore');
        setBackups(availableBackups);
        setBackendStatus(backupService.getBackendStatus());
      } catch (error) {
        console.error('Failed to load backup data:', error);
      }
    };

    loadData();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const createTestBackup = async () => {
    try {
      const testState = {
        tasks: [
          {
            id: Date.now(),
            title: `Test Backup ${new Date().toLocaleTimeString()}`,
            description: 'Backup created for testing purposes',
            status: 'pending',
            priority: 'medium',
            dependencies: [],
            subtasks: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        selectedTask: null,
        filters: {}
      };

      await backupService.createBackup('taskStore', testState);
      
      // Refresh backup list
      const updatedBackups = await backupService.listBackups('taskStore');
      setBackups(updatedBackups);
    } catch (error) {
      console.error('Failed to create test backup:', error);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Database className="w-5 h-5" />
        Backup Status
      </h3>

      {/* Backend Status */}
      <div className="mb-4">
        <h4 className="font-medium mb-2">Storage Backends</h4>
        <div className="flex gap-2">
          {Object.entries(backendStatus).map(([backend, available]) => (
            <div key={backend} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${available ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm capitalize">{backend}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Backup List */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium">Available Backups ({backups.length})</h4>
          <button
            onClick={createTestBackup}
            className="text-sm bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90"
          >
            Create Test Backup
          </button>
        </div>
        
        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backups available</p>
        ) : (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {backups.slice(0, 5).map((backup) => (
              <div key={backup.id} className="text-sm bg-muted/50 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{backup.storeName}</span>
                  <span className="text-muted-foreground">v{backup.version}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(backup.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configuration */}
      <div>
        <h4 className="font-medium mb-2">Configuration</h4>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span>Auto-backup:</span>
            <span className="text-green-600">Enabled</span>
          </div>
          <div className="flex justify-between">
            <span>Max backups:</span>
            <span>{backupService.getConfig().maxBackups}</span>
          </div>
          <div className="flex justify-between">
            <span>Interval:</span>
            <span>{Math.round(backupService.getConfig().interval / 60000)}m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main example component demonstrating the complete error handling system
 */
export function StoreErrorHandlingExample() {
  const store = useErrorHandledTaskStore();
  const [tasks, setTasks] = useState(store.getTasks());

  useEffect(() => {
    // Subscribe to store changes
    const unsubscribe = store.subscribe(() => {
      setTasks(store.getTasks());
    });

    return unsubscribe;
  }, []);

  const addSampleTask = () => {
    store.addTask({
      title: `Sample Task ${Date.now()}`,
      description: 'This is a sample task created for testing',
      status: 'pending',
      priority: 'medium',
      dependencies: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <StoreErrorBoundary
      enableAutoRecovery={true}
      maxAutoRecoveryAttempts={3}
      showDeveloperInfo={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        console.group('🔴 Store Error Boundary Triggered');
        console.error('Error:', error);
        console.error('Error Info:', errorInfo);
        console.groupEnd();
      }}
    >
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Store Error Handling Example</h1>
            <p className="text-muted-foreground">
              Comprehensive demonstration of Zustand error handling, backup/recovery, and UI integration
            </p>
          </div>

          {/* Current Tasks */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Current Tasks ({tasks.length})</h3>
              <button
                onClick={addSampleTask}
                className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
              >
                Add Sample Task
              </button>
            </div>
            
            {tasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No tasks yet. Add a sample task to get started.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {tasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="font-medium">{task.title}</h4>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        task.status === 'done' ? 'bg-green-100 text-green-800' :
                        task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.status}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        task.priority === 'high' ? 'bg-red-100 text-red-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))}
                {tasks.length > 5 && (
                  <p className="text-center text-sm text-muted-foreground">
                    ...and {tasks.length - 5} more tasks
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Error Simulation */}
          <ErrorSimulator />

          {/* Two-column layout for monitoring */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ErrorMonitoringDashboard />
            <BackupStatusPanel />
          </div>

          {/* Usage Instructions */}
          <div className="bg-muted/50 rounded-lg p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Usage Instructions
            </h3>
            <div className="space-y-2 text-sm">
              <p><strong>1. Error Simulation:</strong> Click the error simulation buttons to test different error scenarios.</p>
              <p><strong>2. Automatic Recovery:</strong> The system will automatically attempt recovery for retryable errors.</p>
              <p><strong>3. Backup System:</strong> State is automatically backed up before critical operations.</p>
              <p><strong>4. Monitoring:</strong> Real-time error tracking and metrics are displayed in the dashboard.</p>
              <p><strong>5. Manual Recovery:</strong> If automatic recovery fails, use the error boundary UI for manual recovery.</p>
            </div>
          </div>

          {/* Integration Status */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Error Handling System Active</span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              All error handling components are properly integrated and operational.
            </p>
          </div>
        </div>
      </div>
    </StoreErrorBoundary>
  );
}

export default StoreErrorHandlingExample;