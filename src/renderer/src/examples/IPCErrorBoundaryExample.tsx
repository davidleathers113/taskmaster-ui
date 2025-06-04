/**
 * IPC Error Boundary Integration Example (2025)
 * 
 * This example demonstrates how to integrate the complete IPC error boundary
 * system into TaskMaster components, showing best practices for implementation.
 * 
 * Following 2025 patterns for error handling, user experience, and resilience.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

// Import our IPC error boundary system
import { IPCProvider, useIPC, useSafeIPC } from '@/contexts/IPCContext';
import { withIPCErrorHandling, useIPCErrorHandling } from '@/components/error/withIPCErrorHandling';
import { IPCStatusNotification } from '@/components/error/IPCStatusNotification';
import { services } from '@/lib/services';
import { ipcCritical } from '@/lib/ipcRetry';

/**
 * Example component using HOC pattern
 */
const _AppInfoDisplayHOC = withIPCErrorHandling(
  function AppInfoDisplay() {
    const [appInfo, setAppInfo] = useState<{
      version?: string;
      platform?: string;
    }>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const loadAppInfo = async () => {
        try {
          // Use service layer with built-in error handling
          const [versionResult, platformResult] = await Promise.all([
            services.app.getVersion(),
            services.app.getPlatform()
          ]);

          setAppInfo({
            version: versionResult.data,
            platform: platformResult.data
          });
        } catch (error) {
          console.error('Failed to load app info:', error);
        } finally {
          setLoading(false);
        }
      };

      loadAppInfo();
    }, []);

    if (loading) {
      return <div className="animate-pulse">Loading app information...</div>;
    }

    return (
      <div className="bg-card p-4 rounded-lg border">
        <h3 className="font-semibold mb-2">Application Information</h3>
        <div className="space-y-1 text-sm">
          <div>Version: {appInfo.version || 'Unknown'}</div>
          <div>Platform: {appInfo.platform || 'Unknown'}</div>
        </div>
      </div>
    );
  },
  {
    requiresIPC: true,
    gracefulDegradation: false,
    retryable: true,
    showConnectionStatus: false
  }
);

/**
 * Example component using hook pattern
 */
function FileSystemExplorer() {
  const [paths, setPaths] = useState<{
    documents?: string;
    appData?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  // Use the IPC error handling hook
  const {
    isAvailable,
    isHealthy,
    safeInvoke,
    hasError,
    canProceed,
    shouldShowFallback
  } = useIPCErrorHandling({
    requiresIPC: true,
    gracefulDegradation: true,
    onIPCError: (error) => {
      console.warn('FileSystem IPC Error:', error);
    }
  });

  const loadPaths = async () => {
    if (!canProceed) return;

    setLoading(true);
    try {
      const [docsResult, appDataResult] = await Promise.all([
        services.fs.getDocumentsPath(),
        services.fs.getAppDataPath()
      ]);

      setPaths({
        documents: docsResult.data,
        appData: appDataResult.data
      });
    } catch (error) {
      console.error('Failed to load paths:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaths();
  }, [canProceed]);

  // Show fallback UI if IPC is required but unavailable
  if (shouldShowFallback) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">Desktop Features Required</span>
        </div>
        <p className="text-sm text-yellow-700 mt-1">
          File system access requires the desktop application.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card p-4 rounded-lg border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">File System Paths</h3>
        <button
          onClick={loadPaths}
          disabled={loading || !canProceed}
          className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {!isHealthy && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          Connection issues detected. Some information may be cached.
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Documents:</span>{' '}
          {paths.documents || 'Not available'}
        </div>
        <div>
          <span className="font-medium">App Data:</span>{' '}
          {paths.appData || 'Not available'}
        </div>
      </div>
    </div>
  );
}

/**
 * Example of critical operations with retry
 */
function CriticalOperationExample() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const safeIPC = useSafeIPC();

  const performCriticalOperation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Example of critical operation with maximum retry attempts
      const response = await ipcCritical.invoke<string>(
        'getVersion' // Using getVersion as an example critical operation
      );

      if (response.success) {
        setResult(`Critical operation successful: ${response.data}`);
      } else {
        setError(response.error?.message || 'Operation failed');
      }
    } catch (error) {
      setError(`Critical operation failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card p-4 rounded-lg border">
      <h3 className="font-semibold mb-3">Critical Operation Example</h3>
      
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={performCriticalOperation}
        disabled={loading || !safeIPC.isAvailable}
        className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
      >
        <AlertTriangle className="w-4 h-4" />
        {loading ? 'Processing...' : 'Execute Critical Operation'}
      </motion.button>

      {result && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          {result}
        </div>
      )}

      {error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Example of batch operations
 */
function BatchOperationExample() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const performBatchOperations = async () => {
    setLoading(true);
    
    try {
      const batchResult = await services.batch.executeBatch([
        {
          method: 'getVersion',
          args: [],
          priority: 'high',
          allowFailure: false
        },
        {
          method: 'getPlatform',
          args: [],
          priority: 'normal',
          allowFailure: true
        },
        {
          method: 'getAppDataPath',
          args: [],
          priority: 'low',
          allowFailure: true
        }
      ]);

      if (batchResult.success) {
        setResults(batchResult.data || []);
      }
    } catch (error) {
      console.error('Batch operation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card p-4 rounded-lg border">
      <h3 className="font-semibold mb-3">Batch Operations Example</h3>
      
      <button
        onClick={performBatchOperations}
        disabled={loading}
        className="bg-blue-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Execute Batch Operations'}
      </button>

      {results.length > 0 && (
        <div className="mt-3 space-y-1">
          <h4 className="text-sm font-medium">Results:</h4>
          {results.map((result, index) => (
            <div key={index} className="text-xs bg-muted p-2 rounded">
              Operation {index + 1}: {JSON.stringify(result)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * System capabilities dashboard
 */
function SystemCapabilitiesExample() {
  const [capabilities, setCapabilities] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const ipcContext = useIPC();

  useEffect(() => {
    const loadCapabilities = async () => {
      const [capResult, healthResult] = await Promise.all([
        services.system.getCapabilities(),
        services.system.performHealthCheck()
      ]);

      setCapabilities(capResult.data);
      setHealthStatus(healthResult.data);
    };

    loadCapabilities();
  }, []);

  return (
    <div className="bg-card p-4 rounded-lg border">
      <h3 className="font-semibold mb-3">System Status</h3>
      
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <h4 className="font-medium mb-2">IPC Status</h4>
          <div className="space-y-1">
            <div>Available: {ipcContext.isAvailable ? '✅' : '❌'}</div>
            <div>Healthy: {ipcContext.isHealthy ? '✅' : '❌'}</div>
            <div>Errors: {ipcContext.errorCount}</div>
            <div>Methods: {ipcContext.availableMethods.length}</div>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Capabilities</h4>
          {capabilities && (
            <div className="space-y-1">
              <div>File Access: {capabilities.hasFileAccess ? '✅' : '❌'}</div>
              <div>Notifications: {capabilities.hasNotifications ? '✅' : '❌'}</div>
              <div>Dialogs: {capabilities.hasDialogs ? '✅' : '❌'}</div>
              <div>Platform: {capabilities.platform}</div>
            </div>
          )}
        </div>
      </div>

      {healthStatus && (
        <div className="mt-3 pt-3 border-t">
          <h4 className="font-medium mb-2 text-xs">Health Check</h4>
          <div className="text-xs space-y-1">
            <div>App Info: {healthStatus.appInfo ? '✅' : '❌'}</div>
            <div>File System: {healthStatus.fileSystem ? '✅' : '❌'}</div>
            <div>Dialogs: {healthStatus.dialogs ? '✅' : '❌'}</div>
            <div>Last Check: {new Date(healthStatus.timestamp).toLocaleTimeString()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main example component demonstrating the complete system
 */
export function IPCErrorBoundaryExample() {
  return (
    <IPCProvider
      healthCheckInterval={30000}
      autoStartMonitoring={true}
      onConnectionLost={() => console.log('🔴 IPC Connection Lost')}
      onConnectionRestored={() => console.log('🟢 IPC Connection Restored')}
      onError={(error) => console.warn('IPC Error:', error)}
    >
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header with status notification */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">IPC Error Boundary Example</h1>
            <IPCStatusNotification 
              position="top-right"
              showCompactIndicator={true}
            />
          </div>

          {/* Grid of examples */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <_AppInfoDisplayHOC />
            <FileSystemExplorer />
            <CriticalOperationExample />
            <BatchOperationExample />
            <div className="md:col-span-2 lg:col-span-1">
              <SystemCapabilitiesExample />
            </div>
          </div>

          {/* Usage instructions */}
          <div className="bg-muted/50 p-6 rounded-lg">
            <h2 className="font-semibold mb-3">Usage Instructions</h2>
            <div className="text-sm space-y-2">
              <p>1. <strong>HOC Pattern:</strong> Use `withIPCErrorHandling()` to wrap components that require IPC.</p>
              <p>2. <strong>Hook Pattern:</strong> Use `useIPCErrorHandling()` for more granular control.</p>
              <p>3. <strong>Service Layer:</strong> Use the `services` object for common operations with built-in error handling.</p>
              <p>4. <strong>Critical Operations:</strong> Use `ipcCritical.invoke()` for operations that must succeed.</p>
              <p>5. <strong>Status Monitoring:</strong> The notification component shows real-time IPC status.</p>
            </div>
          </div>
        </div>
      </div>
    </IPCProvider>
  );
}

export default IPCErrorBoundaryExample;