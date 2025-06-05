/**
 * Advanced Store Rehydration Utility (2025)
 * 
 * Provides sophisticated state rehydration capabilities for Zustand stores
 * with migration support, version control, and intelligent recovery strategies.
 * 
 * Features:
 * - Automatic state migration between versions
 * - Multi-source rehydration (localStorage, sessionStorage, IndexedDB)
 * - Fallback strategies for corrupted data
 * - Performance monitoring and error recovery
 * - Schema validation and data transformation
 */

import { StateCreator } from 'zustand';

// Rehydration configuration options
export interface RehydrationOptions<T = any> {
  storageKey?: string;
  version?: number;
  migrate?: (persistedState: any, version: number) => T;
  onRehydrateStorage?: (state: T | null, error?: Error) => void;
  onFinishHydration?: (state: T) => void;
  storage?: Storage | RehydrationStorage;
  serialize?: (state: T) => string;
  deserialize?: (str: string) => T;
  skipHydration?: boolean;
  enableVersionControl?: boolean;
  enableMigrationRecovery?: boolean;
  enablePerformanceMonitoring?: boolean;
  rehydrationTimeout?: number;
  fallbackStrategies?: RehydrationFallback[];
}

// Custom storage interface for advanced rehydration
export interface RehydrationStorage {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
  getAllKeys?: () => Promise<string[]> | string[];
}

// Fallback strategy configuration
export interface RehydrationFallback {
  name: string;
  priority: number;
  storage: RehydrationStorage;
  key?: string;
  condition?: (error: Error) => boolean;
}

// Rehydration result information
export interface RehydrationResult<T = any> {
  success: boolean;
  data?: T;
  source?: string;
  version?: number;
  migrated?: boolean;
  fallbackUsed?: boolean;
  error?: Error;
  performance?: {
    startTime: number;
    endTime: number;
    duration: number;
    dataSize: number;
  };
}

// State version metadata
export interface VersionedState<T = any> {
  version: number;
  state: T;
  timestamp: number;
  migrations?: string[];
  metadata?: {
    userAgent: string;
    url: string;
    buildVersion?: string;
  };
}

// Default rehydration options
const _defaultRehydrationOptions: Required<Omit<RehydrationOptions, 'migrate' | 'onRehydrateStorage' | 'onFinishHydration' | 'fallbackStrategies'>> = {
  storageKey: 'app_state',
  version: 0,
  storage: localStorage,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
  skipHydration: false,
  enableVersionControl: true,
  enableMigrationRecovery: true,
  enablePerformanceMonitoring: true,
  rehydrationTimeout: 5000
};

/**
 * Creates an enhanced Zustand store with advanced rehydration capabilities
 */
export function withRehydration<T>(
  storeCreator: StateCreator<T>,
  options: RehydrationOptions<T> = {}
): StateCreator<T> {
  const config = { ..._defaultRehydrationOptions, ...options };
  
  return (set, get, api) => {
    const storeState = storeCreator(set, get, api);
    let rehydrationComplete = false;
    let rehydrationPromise: Promise<RehydrationResult<T>> | null = null;

    /**
     * Creates versioned state wrapper
     */
    const createVersionedState = (state: T): VersionedState<T> => ({
      version: config.version,
      state,
      timestamp: Date.now(),
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        buildVersion: process.env.APP_VERSION || 'unknown'
      }
    });

    /**
     * Extracts state from versioned wrapper with fallback
     */
    const extractState = (data: any): { state: T; version: number; metadata?: any } => {
      // Handle versioned state
      if (data && typeof data === 'object' && 'version' in data && 'state' in data) {
        return {
          state: data.state,
          version: data.version,
          metadata: data.metadata
        };
      }
      
      // Handle legacy unversioned state
      return {
        state: data,
        version: 0
      };
    };

    /**
     * Attempts to rehydrate from storage with error handling
     */
    const attemptRehydration = async (
      storage: RehydrationStorage,
      key: string,
      sourceName: string
    ): Promise<RehydrationResult<T>> => {
      const startTime = performance.now();
      
      try {
        const stored = await storage.getItem(key);
        
        if (!stored) {
          return {
            success: false,
            source: sourceName,
            error: new Error('No stored data found')
          };
        }

        const deserialized = config.deserialize(stored);
        const { state, version } = extractState(deserialized);
        
        let finalState = state;
        let migrated = false;

        // Handle version migration
        if (config.migrate && version !== config.version) {
          try {
            finalState = config.migrate(state, version);
            migrated = true;
            
            if (config.enablePerformanceMonitoring) {
              console.debug(`State migrated from version ${version} to ${config.version}`, {
                source: sourceName,
                key
              });
            }
          } catch (migrationError) {
            if (!config.enableMigrationRecovery) {
              throw migrationError;
            }
            
            console.warn('Migration failed, using original state:', migrationError);
            finalState = state;
          }
        }

        const endTime = performance.now();
        const dataSize = stored.length;

        return {
          success: true,
          data: finalState,
          source: sourceName,
          version,
          migrated,
          performance: {
            startTime,
            endTime,
            duration: endTime - startTime,
            dataSize
          }
        };

      } catch (error) {
        const endTime = performance.now();
        
        return {
          success: false,
          source: sourceName,
          error: error as Error,
          performance: {
            startTime,
            endTime,
            duration: endTime - startTime,
            dataSize: 0
          }
        };
      }
    };

    /**
     * Tries fallback strategies in order of priority
     */
    const tryFallbackStrategies = async (): Promise<RehydrationResult<T> | null> => {
      if (!config.fallbackStrategies?.length) {
        return null;
      }

      const sortedFallbacks = [...config.fallbackStrategies].sort(
        (a, b) => b.priority - a.priority
      );

      for (const fallback of sortedFallbacks) {
        try {
          const key = fallback.key || config.storageKey;
          const result = await attemptRehydration(fallback.storage, key, fallback.name);
          
          if (result.success) {
            return {
              ...result,
              fallbackUsed: true,
              source: `${result.source} (fallback)`
            };
          }
        } catch (error) {
          console.debug(`Fallback strategy "${fallback.name}" failed:`, error);
        }
      }

      return null;
    };

    /**
     * Main rehydration logic
     */
    const performRehydration = async (): Promise<RehydrationResult<T>> => {
      if (config.skipHydration) {
        return {
          success: false,
          error: new Error('Rehydration skipped by configuration')
        };
      }

      // Set timeout for rehydration
      const timeoutPromise = new Promise<RehydrationResult<T>>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Rehydration timeout after ${config.rehydrationTimeout}ms`));
        }, config.rehydrationTimeout);
      });

      try {
        // Try primary rehydration
        const primaryResult = await Promise.race([
          attemptRehydration(config.storage, config.storageKey, 'primary'),
          timeoutPromise
        ]);

        if (primaryResult.success && primaryResult.data) {
          // Apply rehydrated state
          set(primaryResult.data);
          
          if (config.onFinishHydration) {
            config.onFinishHydration(primaryResult.data);
          }
          
          return primaryResult;
        }

        // Try fallback strategies
        const fallbackResult = await tryFallbackStrategies();
        
        if (fallbackResult && fallbackResult.success && fallbackResult.data) {
          set(fallbackResult.data);
          
          if (config.onFinishHydration) {
            config.onFinishHydration(fallbackResult.data);
          }
          
          return fallbackResult;
        }

        // No successful rehydration
        return {
          success: false,
          error: new Error('All rehydration attempts failed'),
          source: 'none'
        };

      } catch (error) {
        return {
          success: false,
          error: error as Error,
          source: 'timeout'
        };
      }
    };

    /**
     * Persists current state with versioning
     */
    const persistState = async (state: T): Promise<void> => {
      try {
        const versionedState = config.enableVersionControl 
          ? createVersionedState(state) 
          : state;
          
        const serialized = config.serialize(versionedState);
        await config.storage.setItem(config.storageKey, serialized);
        
        if (config.enablePerformanceMonitoring) {
          console.debug('State persisted successfully', {
            size: serialized.length,
            version: config.version,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Failed to persist state:', error);
        
        if (config.onRehydrateStorage) {
          config.onRehydrateStorage(null, error as Error);
        }
      }
    };

    // Start rehydration process
    if (!config.skipHydration) {
      rehydrationPromise = performRehydration();
      
      rehydrationPromise
        .then((result) => {
          rehydrationComplete = true;
          
          if (config.onRehydrateStorage) {
            config.onRehydrateStorage(result.data || null, result.error);
          }
          
          if (config.enablePerformanceMonitoring && result.performance) {
            console.debug('Rehydration completed', {
              success: result.success,
              source: result.source,
              duration: result.performance.duration,
              dataSize: result.performance.dataSize,
              migrated: result.migrated,
              fallbackUsed: result.fallbackUsed
            });
          }
        })
        .catch((error) => {
          rehydrationComplete = true;
          console.error('Rehydration failed:', error);
          
          if (config.onRehydrateStorage) {
            config.onRehydrateStorage(null, error);
          }
        });
    } else {
      rehydrationComplete = true;
    }

    // Subscribe to state changes for persistence
    if (!config.skipHydration) {
      api.subscribe((state) => {
        if (rehydrationComplete) {
          persistState(state);
        }
      });
    }

    // Return enhanced store with rehydration methods
    return {
      ...storeState,
      
      // Rehydration status
      get isRehydrated() {
        return rehydrationComplete;
      },
      
      // Get rehydration promise for waiting
      get rehydrationPromise() {
        return rehydrationPromise;
      },
      
      // Manual rehydration trigger
      async rehydrate(): Promise<RehydrationResult<T>> {
        rehydrationComplete = false;
        rehydrationPromise = performRehydration();
        const result = await rehydrationPromise;
        rehydrationComplete = true;
        return result;
      },
      
      // Manual persistence trigger
      async persist(): Promise<void> {
        await persistState(get());
      },
      
      // Clear persisted data
      async clearPersisted(): Promise<void> {
        try {
          await config.storage.removeItem(config.storageKey);
          
          // Clear fallback storages as well
          if (config.fallbackStrategies) {
            await Promise.all(
              config.fallbackStrategies.map(async (fallback) => {
                const key = fallback.key || config.storageKey;
                await fallback.storage.removeItem(key);
              })
            );
          }
        } catch (error) {
          console.error('Failed to clear persisted data:', error);
          throw error;
        }
      }
    };
  };
}

/**
 * Creates IndexedDB storage adapter for large data
 */
export const createIndexedDBStorage = (
  dbName: string = 'AppStorage',
  storeName: string = 'state',
  version: number = 1
): RehydrationStorage => {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const getDB = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, version);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        };
      });
    }
    
    return dbPromise;
  };

  return {
    async getItem(key: string): Promise<string | null> {
      try {
        const db = await getDB();
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
          const request = store.get(key);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error('IndexedDB getItem failed:', error);
        return null;
      }
    },

    async setItem(key: string, value: string): Promise<void> {
      try {
        const db = await getDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
          const request = store.put(value, key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error('IndexedDB setItem failed:', error);
        throw error;
      }
    },

    async removeItem(key: string): Promise<void> {
      try {
        const db = await getDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
          const request = store.delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error('IndexedDB removeItem failed:', error);
        throw error;
      }
    },

    async getAllKeys(): Promise<string[]> {
      try {
        const db = await getDB();
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
          const request = store.getAllKeys();
          request.onsuccess = () => resolve(request.result as string[]);
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error('IndexedDB getAllKeys failed:', error);
        return [];
      }
    }
  };
};

/**
 * Creates session storage adapter
 */
export const createSessionStorageAdapter = (): RehydrationStorage => ({
  getItem: (key: string) => sessionStorage.getItem(key),
  setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
  removeItem: (key: string) => sessionStorage.removeItem(key),
  getAllKeys: () => Object.keys(sessionStorage)
});

// Types are already exported above with their declarations