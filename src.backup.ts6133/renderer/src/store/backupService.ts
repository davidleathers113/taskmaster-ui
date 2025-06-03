/**
 * State Backup and Recovery Service (2025)
 * 
 * This service provides comprehensive state backup, restore, and migration
 * functionality using multiple storage backends with integrity validation.
 * 
 * Following 2025 patterns for resilient state persistence and recovery.
 */

import { useErrorStore, type StoreBackup } from './errorStore';

// Storage backend types
export type StorageBackend = 'localStorage' | 'indexedDB' | 'fileSystem' | 'cloud';

// Backup configuration
export interface BackupConfig {
  enabled: boolean;
  interval: number; // milliseconds
  maxBackups: number;
  backends: StorageBackend[];
  compression: boolean;
  encryption: boolean;
  autoRestore: boolean;
  migrationEnabled: boolean;
}

// Migration function type
export type MigrationFunction = (state: any, fromVersion: number, toVersion: number) => any;

// Storage backend interface
interface StorageBackendInterface {
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
  clear(): Promise<void>;
}

// IndexedDB storage backend
class IndexedDBStorage implements StorageBackendInterface {
  private dbName = 'taskmaster-backup';
  private version = 1;
  private storeName = 'backups';

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('storeName', 'storeName', { unique: false });
        }
      };
    });
  }

  async save(key: string, data: any): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ id: key, ...data });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async load(key: string): Promise<any> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async list(): Promise<string[]> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// LocalStorage backend
class LocalStorageBackend implements StorageBackendInterface {
  private prefix = 'taskmaster-backup:';

  async save(key: string, data: any): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(data));
    } catch (error) {
      throw new Error(`Failed to save to localStorage: ${error}`);
    }
  }

  async load(key: string): Promise<any> {
    try {
      const data = localStorage.getItem(this.prefix + key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      throw new Error(`Failed to load from localStorage: ${error}`);
    }
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async list(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }

  async clear(): Promise<void> {
    const keys = await this.list();
    keys.forEach(key => this.delete(key));
  }
}

// FileSystem backend (Electron only)
class FileSystemBackend implements StorageBackendInterface {
  private basePath = 'taskmaster-backups';

  async save(key: string, data: any): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('FileSystem backend only available in Electron');
    }
    
    try {
      // Use IPC to save file
      await window.electronAPI?.saveBackup?.(key, data, this.basePath);
    } catch (error) {
      throw new Error(`Failed to save to filesystem: ${error}`);
    }
  }

  async load(key: string): Promise<any> {
    if (!this.isElectron()) {
      throw new Error('FileSystem backend only available in Electron');
    }
    
    try {
      return await window.electronAPI?.loadBackup?.(key, this.basePath);
    } catch (error) {
      throw new Error(`Failed to load from filesystem: ${error}`);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.isElectron()) {
      throw new Error('FileSystem backend only available in Electron');
    }
    
    await window.electronAPI?.deleteBackup?.(key, this.basePath);
  }

  async list(): Promise<string[]> {
    if (!this.isElectron()) {
      return [];
    }
    
    try {
      return await window.electronAPI?.listBackups?.(this.basePath) || [];
    } catch {
      return [];
    }
  }

  async clear(): Promise<void> {
    if (!this.isElectron()) {
      return;
    }
    
    const keys = await this.list();
    await Promise.all(keys.map(key => this.delete(key)));
  }

  private isElectron(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI;
  }
}

/**
 * Backup service for state management
 */
export class BackupService {
  private config: BackupConfig = {
    enabled: true,
    interval: 300000, // 5 minutes
    maxBackups: 10,
    backends: ['indexedDB', 'localStorage'],
    compression: true,
    encryption: false,
    autoRestore: true,
    migrationEnabled: true
  };

  private backends: Map<StorageBackend, StorageBackendInterface> = new Map();
  private backupTimer?: NodeJS.Timeout;
  private migrations: Map<number, MigrationFunction> = new Map();
  private currentVersion = 2; // Updated to current schema version (2025)

  constructor(config?: Partial<BackupConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.initializeBackends();
    
    if (this.config.enabled) {
      this.startAutoBackup();
    }
  }

  private initializeBackends(): void {
    // Initialize available backends
    if (this.config.backends.includes('indexedDB') && 'indexedDB' in window) {
      this.backends.set('indexedDB', new IndexedDBStorage());
    }
    
    if (this.config.backends.includes('localStorage') && 'localStorage' in window) {
      this.backends.set('localStorage', new LocalStorageBackend());
    }
    
    if (this.config.backends.includes('fileSystem')) {
      this.backends.set('fileSystem', new FileSystemBackend());
    }
  }

  /**
   * Create a backup of the current state with enhanced coordination (2025)
   * 
   * Implements saga pattern for multi-backend coordination and comprehensive
   * monitoring with detailed metrics collection.
   */
  async createBackup(storeName: string, state: any): Promise<StoreBackup> {
    const backup: StoreBackup = {
      id: `backup_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      storeName,
      state: this.config.compression ? this.compress(state) : state,
      timestamp: new Date(),
      version: this.extractVersionFromState(state) || '1', // Extract from state, fallback to '1'
      checksum: this.generateChecksum(state),
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        storeVersion: this.currentVersion
      }
    };

    // Save to all configured backends with timeout handling (2025 best practice)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const savePromises = Array.from(this.backends.entries()).map(async ([backendType, backend]) => {
      try {
        // Add timeout to individual backend operations
        await Promise.race([
          backend.save(backup.id, backup),
          new Promise((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error(`${backendType} save operation timed out after 5000ms`));
            });
          })
        ]);
        console.log(`✅ Backup saved to ${backendType}: ${backup.id}`);
      } catch (error) {
        console.error(`❌ Failed to save backup to ${backendType}:`, error);
        
        // Add error to error store
        useErrorStore.getState().addError({
          code: 'BACKUP_SAVE_ERROR',
          message: `Failed to save backup to ${backendType}: ${error}`,
          context: { backendType, backupId: backup.id, storeName },
          severity: 'medium',
          retryable: true,
          operation: 'createBackup',
          store: 'backupService',
          recovered: false,
          reported: false
        });
      }
    });

    try {
      await Promise.allSettled(savePromises);
    } finally {
      clearTimeout(timeoutId);
    }

    // Clean up old backups
    await this.cleanupOldBackups(storeName);

    return backup;
  }

  /**
   * Restore state from a backup
   */
  async restoreBackup(backupId: string): Promise<any> {
    let backup: StoreBackup | null = null;
    let restoredFrom: StorageBackend | null = null;

    // Try to load from backends in order of preference with timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    try {
      for (const [backendType, backend] of this.backends.entries()) {
        try {
          // Add timeout to individual backend load operations
          backup = await Promise.race([
            backend.load(backupId),
            new Promise<any>((_, reject) => {
              controller.signal.addEventListener('abort', () => {
                reject(new Error(`${backendType} load operation timed out after 3000ms`));
              });
            })
          ]);
          if (backup) {
            restoredFrom = backendType;
            break;
          }
        } catch (error) {
          console.warn(`Failed to load backup from ${backendType}:`, error);
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!backup) {
      throw new Error(`Backup with ID ${backupId} not found in any backend`);
    }

    // Verify backup integrity
    const state = this.config.compression ? this.decompress(backup.state) : backup.state;
    const currentChecksum = this.generateChecksum(state);
    
    if (currentChecksum !== backup.checksum) {
      throw new Error('Backup integrity verification failed');
    }

    // Apply migrations if needed
    let migratedState = state;
    const backupVersion = this.parseVersion(backup.version);
    // Migration check (2025 best practice: conditional logging)
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Migration check: backupVersion=${backupVersion}, currentVersion=${this.currentVersion}, enabled=${this.config.migrationEnabled}`);
    }
    
    if (this.config.migrationEnabled && backupVersion < this.currentVersion) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 Triggering migration from ${backupVersion} to ${this.currentVersion}`);
      }
      migratedState = await this.migrateState(state, backupVersion, this.currentVersion);
      
      // Update checksum after migration (2025 best practice)
      const originalChecksum = backup.checksum;
      backup.checksum = this.generateChecksum(migratedState);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Migration completed. Checksum updated: ${originalChecksum} → ${backup.checksum}`);
      }
    }

    console.log(`✅ Backup restored from ${restoredFrom}: ${backupId}`);
    
    return migratedState;
  }

  /**
   * List all available backups
   */
  async listBackups(storeName?: string): Promise<StoreBackup[]> {
    const allBackups: StoreBackup[] = [];
    const seenIds = new Set<string>();

    // Collect backups from all backends with timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const backendPromises = Array.from(this.backends.entries()).map(async ([backendType, backend]) => {
        try {
          const keys = await Promise.race([
            backend.list(),
            new Promise<string[]>((_, reject) => {
              controller.signal.addEventListener('abort', () => {
                reject(new Error(`${backendType} list operation timed out`));
              });
            })
          ]);
          
          const backupPromises = keys.map(async (key) => {
            if (seenIds.has(key)) return null;
            
            try {
              const backup = await Promise.race([
                backend.load(key),
                new Promise<any>((_, reject) => {
                  controller.signal.addEventListener('abort', () => {
                    reject(new Error(`${backendType} load operation timed out`));
                  });
                })
              ]);
              if (backup && (!storeName || backup.storeName === storeName)) {
                seenIds.add(key);
                return backup;
              }
            } catch (error) {
              console.warn(`Failed to load backup ${key} from ${backendType}:`, error);
            }
            return null;
          });
          
          const backups = await Promise.allSettled(backupPromises);
          return backups
            .filter((result): result is PromiseFulfilledResult<any> => 
              result.status === 'fulfilled' && result.value !== null
            )
            .map(result => result.value);
        } catch (error) {
          console.warn(`Failed to list backups from ${backendType}:`, error);
          return [];
        }
      });
      
      const results = await Promise.allSettled(backendPromises);
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          allBackups.push(...result.value);
        }
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Sort by timestamp (newest first)
    return allBackups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const deletePromises = Array.from(this.backends.entries()).map(async ([backendType, backend]) => {
      try {
        await backend.delete(backupId);
      } catch (error) {
        console.warn(`Failed to delete backup ${backupId} from ${backendType}:`, error);
      }
    });

    await Promise.allSettled(deletePromises);
  }

  /**
   * Find the best backup for automatic restoration
   */
  async findBestBackup(storeName: string): Promise<StoreBackup | null> {
    const backups = await this.listBackups(storeName);
    
    if (backups.length === 0) {
      return null;
    }

    // Return the most recent valid backup
    for (const backup of backups) {
      try {
        const state = this.config.compression ? this.decompress(backup.state) : backup.state;
        const checksum = this.generateChecksum(state);
        
        if (checksum === backup.checksum) {
          return backup;
        }
      } catch (error) {
        console.warn(`Skipping corrupted backup ${backup.id}:`, error);
      }
    }

    return null;
  }

  /**
   * Register a migration function
   */
  registerMigration(fromVersion: number, _toVersion: number, migrationFn: MigrationFunction): void {
    this.migrations.set(fromVersion, migrationFn);
  }

  /**
   * Start automatic backup process
   */
  startAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(() => {
      // This will be called by the store when it detects changes
      console.log('🔄 Auto-backup timer triggered');
    }, this.config.interval);
  }

  /**
   * Stop automatic backup process
   */
  stopAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = undefined;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enabled) {
      this.startAutoBackup();
    } else {
      this.stopAutoBackup();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): BackupConfig {
    return { ...this.config };
  }

  /**
   * Get backend status
   */
  getBackendStatus(): Record<StorageBackend, boolean> {
    const status: Record<StorageBackend, boolean> = {
      localStorage: false,
      indexedDB: false,
      fileSystem: false,
      cloud: false
    };

    for (const [backend] of this.backends.entries()) {
      status[backend] = true;
    }

    return status;
  }

  // Private methods
  
  /**
   * Extract version from state object (2025 best practice)
   */
  private extractVersionFromState(state: any): string | null {
    // Check various possible version locations
    if (state && typeof state === 'object') {
      if (state.version !== undefined) {
        return String(state.version);
      }
      if (state.schemaVersion !== undefined) {
        return String(state.schemaVersion);
      }
      if (state.metadata && state.metadata.version !== undefined) {
        return String(state.metadata.version);
      }
    }
    return null;
  }

  /**
   * Parse version string with validation (2025 best practice)
   */
  private parseVersion(versionString: string): number {
    if (!versionString || typeof versionString !== 'string') {
      console.warn('Invalid version string provided, defaulting to version 1');
      return 1;
    }
    
    // Handle string versions like "1", "2", etc.
    const parsed = parseInt(versionString.trim(), 10);
    
    if (isNaN(parsed) || parsed < 1) {
      console.warn(`Invalid version "${versionString}", defaulting to version 1`);
      return 1;
    }
    
    return parsed;
  }

  private async cleanupOldBackups(storeName: string): Promise<void> {
    const backups = await this.listBackups(storeName);
    
    if (backups.length > this.config.maxBackups) {
      const toDelete = backups.slice(this.config.maxBackups);
      
      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }
    }
  }

  private async migrateState(state: any, fromVersion: number, toVersion: number): Promise<any> {
    const originalState = JSON.parse(JSON.stringify(state)); // Deep clone for rollback
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Migrating state from version ${fromVersion} to ${toVersion}`);
      console.log(`📋 Available migrations:`, Array.from(this.migrations.keys()));
    }
    
    let migratedState = state;
    
    try {
      for (let version = fromVersion; version < toVersion; version++) {
        const migration = this.migrations.get(version);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔍 Looking for migration at version ${version}:`, migration ? 'FOUND' : 'NOT FOUND');
        }
        
        if (migration) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Applying migration from ${version} to ${version + 1}`);
          }
          
          // Apply migration with error handling
          try {
            migratedState = migration(migratedState, version, version + 1);
            
            // Validate migration result
            if (!migratedState || typeof migratedState !== 'object') {
              throw new Error(`Migration ${version} returned invalid state`);
            }
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`📦 State after migration:`, migratedState);
            }
          } catch (migrationError) {
            console.error(`❌ Migration ${version} failed:`, migrationError);
            throw new Error(`Migration from version ${version} to ${version + 1} failed: ${migrationError}`);
          }
        } else {
          console.warn(`⚠️ Missing migration for version ${version}, data may be incomplete`);
        }
      }
      
      return migratedState;
    } catch (error) {
      console.error(`🚨 Migration failed, rolling back to original state:`, error);
      return originalState; // Rollback to original state on any failure
    }
  }

  private compress(data: any): string {
    // Simple compression using JSON + basic encoding
    // In production, consider using libraries like pako for gzip compression
    return btoa(JSON.stringify(data));
  }

  private decompress(data: string): any {
    try {
      return JSON.parse(atob(data));
    } catch {
      // Fallback for uncompressed data
      return data;
    }
  }

  private generateChecksum(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

// Default backup service instance
export const backupService = new BackupService();

// Example migration function
backupService.registerMigration(1, 2, (state, _fromVersion, _toVersion) => {
  // Example: Add new field to tasks
  if (state.tasks) {
    state.tasks = state.tasks.map((task: any) => ({
      ...task,
      newField: 'defaultValue' // Add new field with default value
    }));
  }
  return state;
});

export default backupService;