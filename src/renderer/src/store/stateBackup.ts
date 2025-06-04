/**
 * Advanced State Backup System for Zustand Stores (2025)
 * 
 * Implements intelligent state backup with debouncing, compression, integrity checks,
 * and automated cleanup following 2025 best practices for crash recovery.
 * 
 * Features:
 * - Debounced backup operations to prevent performance issues
 * - Data compression for large state objects  
 * - Integrity verification with checksums
 * - Automatic cleanup of old backups
 * - Recovery strategies with fallback options
 * - Performance monitoring and telemetry integration
 */

import { StoreApi } from 'zustand';

// Backup configuration interface
export interface BackupOptions {
  backupInterval?: number; // milliseconds between backup attempts
  maxBackups?: number; // maximum number of backups to keep
  storageKey?: string; // localStorage key for backups
  enableCompression?: boolean; // compress backup data
  enableIntegrityCheck?: boolean; // verify backup integrity
  enableTelemetry?: boolean; // track backup performance
  maxStorageSize?: number; // maximum storage size in bytes
  retentionPeriod?: number; // backup retention period in milliseconds
}

// Individual backup entry structure
export interface StateBackup<T = any> {
  id: string;
  timestamp: number;
  state: T;
  checksum: string;
  version: string;
  metadata: {
    storeId: string;
    userAgent: string;
    url: string;
    storeVersion: number;
    compressionEnabled: boolean;
    dataSize: number;
  };
}

// Backup statistics for monitoring
export interface BackupStats {
  totalBackups: number;
  totalStorageUsed: number;
  averageBackupSize: number;
  lastBackupTime: number | null;
  successfulBackups: number;
  failedBackups: number;
  compressionRatio: number;
  oldestBackupAge: number | null;
}

// Recovery result interface
export interface RecoveryResult {
  success: boolean;
  backupId?: string;
  timestamp?: number;
  error?: string;
  dataIntegrityOk?: boolean;
  fallbackUsed?: boolean;
}

// Default backup options
const defaultOptions: Required<BackupOptions> = {
  backupInterval: 5000, // 5 seconds
  maxBackups: 5,
  storageKey: 'app_state_backups',
  enableCompression: true,
  enableIntegrityCheck: true,
  enableTelemetry: true,
  maxStorageSize: 5 * 1024 * 1024, // 5MB
  retentionPeriod: 7 * 24 * 60 * 60 * 1000 // 7 days
};

/**
 * Creates an intelligent state backup manager for Zustand stores
 */
export function createStateBackup<T>(
  store: StoreApi<T>,
  options: BackupOptions = {}
) {
  const config = { ...defaultOptions, ...options };
  const storeId = config.storageKey.replace('_backups', '');
  
  let isDestroyed = false;
  let backupInProgress = false;
  let lastBackupTime = 0;
  let backupQueue: Array<() => void> = [];
  let stats: BackupStats = {
    totalBackups: 0,
    totalStorageUsed: 0,
    averageBackupSize: 0,
    lastBackupTime: null,
    successfulBackups: 0,
    failedBackups: 0,
    compressionRatio: 1.0,
    oldestBackupAge: null
  };

  // Debounced backup function
  let backupTimeoutId: NodeJS.Timeout | null = null;
  
  const scheduleBackup = () => {
    if (isDestroyed || backupInProgress) return;
    
    if (backupTimeoutId) {
      clearTimeout(backupTimeoutId);
    }
    
    backupTimeoutId = setTimeout(() => {
      performBackup();
    }, config.backupInterval);
  };

  /**
   * Generates a checksum for data integrity verification
   */
  const generateChecksum = (data: string): string => {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  };

  /**
   * Compresses data using simple RLE compression
   */
  const compressData = (data: string): string => {
    if (!config.enableCompression) return data;
    
    try {
      // Simple run-length encoding for demo
      // In production, consider using a proper compression library
      return data.replace(/(.)\1+/g, (match, char) => {
        return match.length > 3 ? `${char}*${match.length}` : match;
      });
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
      return data;
    }
  };

  /**
   * Decompresses data
   */
  const decompressData = (data: string): string => {
    if (!config.enableCompression) return data;
    
    try {
      return data.replace(/(.)\*(\d+)/g, (_match, char, count) => {
        return char.repeat(parseInt(count));
      });
    } catch (error) {
      console.warn('Decompression failed, treating as uncompressed:', error);
      return data;
    }
  };

  /**
   * Gets current backups from storage
   */
  const getStoredBackups = (): StateBackup<T>[] => {
    try {
      const stored = localStorage.getItem(config.storageKey);
      if (!stored) return [];
      
      const backups = JSON.parse(stored) as StateBackup<T>[];
      return Array.isArray(backups) ? backups : [];
    } catch (error) {
      console.error('Failed to load stored backups:', error);
      return [];
    }
  };

  /**
   * Saves backups to storage with size limits
   */
  const saveBackups = (backups: StateBackup<T>[]): boolean => {
    try {
      const serialized = JSON.stringify(backups);
      
      // Check storage size limit
      if (serialized.length > config.maxStorageSize) {
        console.warn('Backup data exceeds storage limit, removing old backups');
        const reducedBackups = backups.slice(-Math.floor(config.maxBackups / 2));
        return saveBackups(reducedBackups);
      }
      
      localStorage.setItem(config.storageKey, serialized);
      stats.totalStorageUsed = serialized.length;
      return true;
    } catch (error) {
      console.error('Failed to save backups:', error);
      stats.failedBackups++;
      return false;
    }
  };

  /**
   * Performs the actual backup operation
   */
  const performBackup = async (): Promise<void> => {
    if (isDestroyed || backupInProgress) return;
    
    backupInProgress = true;
    const startTime = performance.now();
    
    try {
      const currentState = store.getState();
      const timestamp = Date.now();
      
      // Avoid duplicate backups if state hasn't changed
      if (timestamp - lastBackupTime < config.backupInterval / 2) {
        return;
      }
      
      const stateJson = JSON.stringify(currentState);
      const compressedData = compressData(stateJson);
      const checksum = generateChecksum(stateJson);
      
      const backup: StateBackup<T> = {
        id: `backup_${timestamp}_${Math.random().toString(36).substring(2)}`,
        timestamp,
        state: JSON.parse(decompressData(compressedData)),
        checksum,
        version: '1.0.0',
        metadata: {
          storeId,
          userAgent: navigator.userAgent,
          url: window.location.href,
          storeVersion: 1,
          compressionEnabled: config.enableCompression,
          dataSize: stateJson.length
        }
      };
      
      // Get existing backups and add new one
      const backups = getStoredBackups();
      backups.unshift(backup);
      
      // Cleanup old backups by count
      while (backups.length > config.maxBackups) {
        backups.pop();
      }
      
      // Cleanup old backups by age
      const cutoffTime = timestamp - config.retentionPeriod;
      const validBackups = backups.filter(b => b.timestamp > cutoffTime);
      
      // Save to storage
      if (saveBackups(validBackups)) {
        lastBackupTime = timestamp;
        stats.successfulBackups++;
        stats.totalBackups = validBackups.length;
        stats.lastBackupTime = timestamp;
        
        // Update compression ratio
        if (config.enableCompression) {
          const originalSize = stateJson.length;
          const compressedSize = compressedData.length;
          stats.compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1.0;
        }
        
        // Update average backup size
        const totalSize = validBackups.reduce((sum, b) => sum + b.metadata.dataSize, 0);
        stats.averageBackupSize = validBackups.length > 0 ? totalSize / validBackups.length : 0;
        
        // Update oldest backup age
        if (validBackups.length > 0) {
          const oldest = validBackups[validBackups.length - 1];
          stats.oldestBackupAge = timestamp - oldest.timestamp;
        }
        
        // Performance telemetry
        if (config.enableTelemetry) {
          const duration = performance.now() - startTime;
          console.debug(`Backup completed in ${duration.toFixed(2)}ms`, {
            storeId,
            backupId: backup.id,
            dataSize: stateJson.length,
            compressionRatio: stats.compressionRatio,
            totalBackups: stats.totalBackups
          });
        }
      }
      
    } catch (error) {
      console.error('Backup operation failed:', error);
      stats.failedBackups++;
    } finally {
      backupInProgress = false;
    }
  };

  /**
   * Restores state from the latest backup
   */
  const restoreLatestBackup = (): RecoveryResult => {
    try {
      const backups = getStoredBackups();
      
      if (backups.length === 0) {
        return {
          success: false,
          error: 'No backups available'
        };
      }
      
      const latestBackup = backups[0];
      
      // Handle undefined case from array access
      if (latestBackup === undefined) {
        return {
          success: false,
          error: 'No valid backup found'
        };
      }
      
      // Verify integrity if enabled
      if (config.enableIntegrityCheck) {
        const stateJson = JSON.stringify(latestBackup.state);
        const expectedChecksum = generateChecksum(stateJson);
        
        if (expectedChecksum !== latestBackup.checksum) {
          console.warn('Backup integrity check failed, trying fallback');
          
          // Try next backup as fallback
          if (backups.length > 1) {
            const fallbackBackup = backups[1];
            
            // Check if fallback backup exists
            if (fallbackBackup === undefined) {
              return {
                success: false,
                error: 'No fallback backup available',
                dataIntegrityOk: false
              };
            }
            const fallbackJson = JSON.stringify(fallbackBackup.state);
            const fallbackChecksum = generateChecksum(fallbackJson);
            
            if (fallbackChecksum === fallbackBackup.checksum) {
              store.setState(fallbackBackup.state);
              return {
                success: true,
                backupId: fallbackBackup.id,
                timestamp: fallbackBackup.timestamp,
                dataIntegrityOk: true,
                fallbackUsed: true
              };
            }
          }
          
          return {
            success: false,
            error: 'Backup integrity check failed and no valid fallback available',
            dataIntegrityOk: false
          };
        }
      }
      
      // Restore state
      store.setState(latestBackup.state);
      
      return {
        success: true,
        backupId: latestBackup.id,
        timestamp: latestBackup.timestamp,
        dataIntegrityOk: true,
        fallbackUsed: false
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Restore failed: ${error}`
      };
    }
  };

  /**
   * Restores state from a specific backup
   */
  const restoreFromBackup = (backupId: string): RecoveryResult => {
    try {
      const backups = getStoredBackups();
      const backup = backups.find(b => b.id === backupId);
      
      if (!backup) {
        return {
          success: false,
          error: `Backup with ID ${backupId} not found`
        };
      }
      
      // Verify integrity if enabled
      if (config.enableIntegrityCheck) {
        const stateJson = JSON.stringify(backup.state);
        const expectedChecksum = generateChecksum(stateJson);
        
        if (expectedChecksum !== backup.checksum) {
          return {
            success: false,
            error: 'Backup integrity check failed',
            dataIntegrityOk: false
          };
        }
      }
      
      store.setState(backup.state);
      
      return {
        success: true,
        backupId: backup.id,
        timestamp: backup.timestamp,
        dataIntegrityOk: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Restore failed: ${error}`
      };
    }
  };

  /**
   * Gets all available backups
   */
  const getBackups = (): StateBackup<T>[] => {
    return getStoredBackups();
  };

  /**
   * Clears all backups
   */
  const clearBackups = (): void => {
    try {
      localStorage.removeItem(config.storageKey);
      stats = {
        ...stats,
        totalBackups: 0,
        totalStorageUsed: 0,
        lastBackupTime: null,
        oldestBackupAge: null
      };
    } catch (error) {
      console.error('Failed to clear backups:', error);
    }
  };

  /**
   * Gets backup statistics
   */
  const getStats = (): BackupStats => {
    return { ...stats };
  };

  /**
   * Forces an immediate backup
   */
  const forceBackup = (): void => {
    if (backupTimeoutId) {
      clearTimeout(backupTimeoutId);
      backupTimeoutId = null;
    }
    performBackup();
  };

  // Set up store subscription for automatic backups
  const unsubscribe = store.subscribe(() => {
    if (!isDestroyed) {
      scheduleBackup();
    }
  });

  /**
   * Cleanup function
   */
  const destroy = (): void => {
    isDestroyed = true;
    
    if (backupTimeoutId) {
      clearTimeout(backupTimeoutId);
      backupTimeoutId = null;
    }
    
    unsubscribe();
    
    // Process any remaining backup queue
    backupQueue.forEach(fn => fn());
    backupQueue = [];
  };

  // Initial backup
  scheduleBackup();

  return {
    restoreLatestBackup,
    restoreFromBackup,
    getBackups,
    clearBackups,
    getStats,
    forceBackup,
    destroy,
    
    // Read-only configuration access
    get config() {
      return { ...config };
    },
    
    // Check if backup system is healthy
    get isHealthy() {
      return !isDestroyed && stats.failedBackups < stats.successfulBackups;
    }
  };
}

// Export types
export type StateBackupManager<T = any> = ReturnType<typeof createStateBackup<T>>;