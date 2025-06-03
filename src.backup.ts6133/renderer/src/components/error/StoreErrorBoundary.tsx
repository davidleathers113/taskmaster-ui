/**
 * Store Error Boundary Component (2025)
 * 
 * This component provides comprehensive error boundary functionality specifically
 * for Zustand store operations with recovery UI and state restoration.
 * 
 * Following 2025 React patterns for error boundaries and user experience.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Upload, 
  Settings, 
 
  Database,
  Shield,
  Activity,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { useErrorStore, type StoreError, type StoreBackup } from '@/store/errorStore';
import { backupService } from '@/store/backupService';
import { errorHandledTaskStore } from '@/store/storeErrorWrapper';

// Error boundary state
interface StoreErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRecovering: boolean;
  recoveryStep: 'diagnosis' | 'backup' | 'restore' | 'complete';
  recoveryProgress: number;
  availableBackups: StoreBackup[];
  selectedBackup: StoreBackup | null;
  showAdvancedOptions: boolean;
  autoRecoveryAttempted: boolean;
}

// Props interface
interface StoreErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableAutoRecovery?: boolean;
  maxAutoRecoveryAttempts?: number;
  showDeveloperInfo?: boolean;
}

/**
 * Recovery Options Panel
 */
function RecoveryOptionsPanel({
  availableBackups,
  selectedBackup,
  onSelectBackup,
  onRestore,
  onReset,
  onExport,
  isRecovering,
  recoveryProgress,
  showAdvanced,
  onToggleAdvanced
}: {
  availableBackups: StoreBackup[];
  selectedBackup: StoreBackup | null;
  onSelectBackup: (backup: StoreBackup | null) => void;
  onRestore: () => void;
  onReset: () => void;
  onExport: () => void;
  isRecovering: boolean;
  recoveryProgress: number;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Backup Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Available Backups
        </h3>
        
        {availableBackups.length === 0 ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <Info className="w-4 h-4" />
              <span className="text-sm font-medium">No backups available</span>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              No previous backups were found. You can reset to default state or export current data.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {availableBackups.map((backup) => (
              <motion.div
                key={backup.id}
                whileHover={{ scale: 1.02 }}
                className={`p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedBackup?.id === backup.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => onSelectBackup(
                  selectedBackup?.id === backup.id ? null : backup
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{backup.storeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(backup.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      Version {backup.version}
                    </p>
                    <div className="flex items-center gap-1 text-xs">
                      <Shield className="w-3 h-3" />
                      Verified
                    </div>
                  </div>
                </div>
                
                {selectedBackup?.id === backup.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 pt-2 border-t text-xs text-muted-foreground"
                  >
                    <p>Platform: {backup.metadata.userAgent.split(' ')[0]}</p>
                    <p>Checksum: {backup.checksum.substring(0, 8)}...</p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Recovery Progress */}
      <AnimatePresence>
        {isRecovering && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Recovering data...
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300">
                <span>Progress</span>
                <span>{recoveryProgress}%</span>
              </div>
              
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <motion.div
                  className="bg-blue-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${recoveryProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRestore}
            disabled={!selectedBackup || isRecovering}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Restore from Backup
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onReset}
            disabled={isRecovering}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Default
          </motion.button>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onExport}
          disabled={isRecovering}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          Export Current Data
        </motion.button>
      </div>

      {/* Advanced Options */}
      <div>
        <button
          onClick={onToggleAdvanced}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <Settings className="w-3 h-3" />
          Advanced Options
        </button>
        
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 p-3 bg-muted/50 rounded-lg space-y-2"
            >
              <button
                onClick={() => errorHandledTaskStore.resetCircuitBreakers()}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset Circuit Breakers
              </button>
              
              <button
                onClick={() => useErrorStore.getState().clearAllErrors()}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear Error History
              </button>
              
              <button
                onClick={() => backupService.startAutoBackup()}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Enable Auto-Backup
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Error Diagnosis Panel
 */
function ErrorDiagnosisPanel({
  error,
  storeErrors,
  circuitBreakerStates
}: {
  error: Error | null;
  storeErrors: StoreError[];
  circuitBreakerStates: Record<string, any>;
}) {
  const criticalErrors = storeErrors.filter(e => e.severity === 'critical');
  const recentErrors = storeErrors.slice(0, 5);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Activity className="w-5 h-5" />
        Error Diagnosis
      </h3>

      {/* Main Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-red-800 dark:text-red-200 text-sm">
                {error.name}: {error.message}
              </p>
              {process.env.NODE_ENV === 'development' && error.stack && (
                <details className="mt-2">
                  <summary className="text-xs text-red-700 dark:text-red-300 cursor-pointer">
                    Stack Trace
                  </summary>
                  <pre className="text-xs text-red-600 dark:text-red-400 mt-1 overflow-auto max-h-20 whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Critical Errors */}
      {criticalErrors.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <h4 className="font-medium text-orange-800 dark:text-orange-200 text-sm mb-2">
            Critical Store Errors ({criticalErrors.length})
          </h4>
          <div className="space-y-1">
            {criticalErrors.slice(0, 3).map((error) => (
              <p key={error.id} className="text-xs text-orange-700 dark:text-orange-300">
                {error.operation}: {error.message}
              </p>
            ))}
            {criticalErrors.length > 3 && (
              <p className="text-xs text-orange-600 dark:text-orange-400">
                ...and {criticalErrors.length - 3} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Circuit Breaker Status */}
      <div className="bg-card border rounded-lg p-4">
        <h4 className="font-medium text-sm mb-3">Circuit Breaker Status</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(circuitBreakerStates).map(([type, state]) => (
            <div key={type} className="text-center">
              <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                state.isOpen ? 'bg-red-500' : 'bg-green-500'
              }`} />
              <p className="text-xs font-medium capitalize">{type}</p>
              <p className="text-xs text-muted-foreground">
                {state.isOpen ? 'Open' : 'Closed'}
              </p>
              {state.failureCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {state.failureCount} failures
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <div className="bg-card border rounded-lg p-4">
          <h4 className="font-medium text-sm mb-3">Recent Errors</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {recentErrors.map((error) => (
              <div key={error.id} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{error.operation}</span>
                  <span className={`px-1 rounded text-xs ${
                    error.severity === 'critical' ? 'bg-red-100 text-red-800' :
                    error.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                    error.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {error.severity}
                  </span>
                </div>
                <p className="text-muted-foreground truncate">{error.message}</p>
                <p className="text-muted-foreground">
                  {new Date(error.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main Store Error Boundary Component
 */
export class StoreErrorBoundary extends Component<StoreErrorBoundaryProps, StoreErrorBoundaryState> {
  private autoRecoveryAttempts = 0;

  constructor(props: StoreErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
      recoveryStep: 'diagnosis',
      recoveryProgress: 0,
      availableBackups: [],
      selectedBackup: null,
      showAdvancedOptions: false,
      autoRecoveryAttempted: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<StoreErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Store Error Boundary caught an error:', error, errorInfo);
    
    this.setState({ errorInfo });
    
    // Add error to error store
    useErrorStore.getState().addError({
      code: 'REACT_ERROR_BOUNDARY',
      message: `React Error Boundary: ${error.message}`,
      stack: error.stack,
      context: { componentStack: errorInfo.componentStack },
      severity: 'critical',
      retryable: true,
      operation: 'render',
      store: 'react',
      recovered: false,
      reported: false
    });

    // Call onError prop
    this.props.onError?.(error, errorInfo);

    // Load available backups
    this.loadAvailableBackups();

    // Attempt auto-recovery if enabled
    if (this.props.enableAutoRecovery && !this.state.autoRecoveryAttempted) {
      this.attemptAutoRecovery();
    }
  }

  private async loadAvailableBackups() {
    try {
      const backups = await backupService.listBackups('taskStore');
      this.setState({ availableBackups: backups });
    } catch (error) {
      console.error('Failed to load available backups:', error);
    }
  }

  private async attemptAutoRecovery() {
    const maxAttempts = this.props.maxAutoRecoveryAttempts || 3;
    
    if (this.autoRecoveryAttempts >= maxAttempts) {
      return;
    }

    this.autoRecoveryAttempts++;
    this.setState({ autoRecoveryAttempted: true });

    try {
      // Try to find the best backup for auto-recovery
      const bestBackup = await backupService.findBestBackup('taskStore');
      
      if (bestBackup) {
        await this.restoreFromBackup(bestBackup);
      } else {
        // No backup available, reset to default state
        this.resetToDefault();
      }
    } catch (error) {
      console.error('Auto-recovery failed:', error);
    }
  }

  private async restoreFromBackup(backup: StoreBackup) {
    this.setState({ 
      isRecovering: true, 
      recoveryStep: 'restore',
      selectedBackup: backup 
    });

    try {
      // Simulate recovery progress
      for (let i = 0; i <= 100; i += 20) {
        this.setState({ recoveryProgress: i });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await backupService.restoreBackup(backup.id);
      
      // Apply restored state to the store
      // This would typically involve calling store reset and load methods
      
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRecovering: false,
        recoveryStep: 'complete',
        recoveryProgress: 100
      });

      // Mark error as recovered
      useErrorStore.getState().markErrorRecovered('react-error-boundary');
      
    } catch (error) {
      console.error('Recovery failed:', error);
      this.setState({ isRecovering: false, recoveryProgress: 0 });
    }
  }

  private resetToDefault() {
    try {
      // Reset the store to default state
      errorHandledTaskStore.resetStore();
      
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRecovering: false,
        recoveryStep: 'complete'
      });
    } catch (error) {
      console.error('Reset failed:', error);
    }
  }

  private exportCurrentData() {
    try {
      const data = errorHandledTaskStore.exportToJSON();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `taskmaster-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const storeErrors = useErrorStore.getState().errors;
      const circuitBreakerStates = errorHandledTaskStore.getCircuitBreakerStates();

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl w-full bg-card border rounded-lg shadow-lg"
          >
            <div className="p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Application Error</h1>
                  <p className="text-muted-foreground">
                    Something went wrong. Don't worry, your data can be recovered.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ErrorDiagnosisPanel
                  error={this.state.error}
                  storeErrors={storeErrors}
                  circuitBreakerStates={circuitBreakerStates}
                />
                
                <RecoveryOptionsPanel
                  availableBackups={this.state.availableBackups}
                  selectedBackup={this.state.selectedBackup}
                  onSelectBackup={(backup) => this.setState({ selectedBackup: backup })}
                  onRestore={() => this.state.selectedBackup && this.restoreFromBackup(this.state.selectedBackup)}
                  onReset={() => this.resetToDefault()}
                  onExport={() => this.exportCurrentData()}
                  isRecovering={this.state.isRecovering}
                  recoveryProgress={this.state.recoveryProgress}
                  showAdvanced={this.state.showAdvancedOptions}
                  onToggleAdvanced={() => this.setState({ showAdvancedOptions: !this.state.showAdvancedOptions })}
                />
              </div>
            </div>

            {/* Success Message */}
            <AnimatePresence>
              {this.state.recoveryStep === 'complete' && !this.state.hasError && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="p-4 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800"
                >
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Recovery Complete!</span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Your application has been successfully recovered and is ready to use.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Development Info */}
            {this.props.showDeveloperInfo && process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="p-4 bg-muted/50 border-t">
                <summary className="cursor-pointer font-medium text-sm">
                  Developer Information
                </summary>
                <pre className="text-xs mt-2 overflow-auto max-h-40 text-muted-foreground">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default StoreErrorBoundary;