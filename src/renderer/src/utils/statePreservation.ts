// State preservation utilities for error recovery - 2025 Best Practices

export interface ViewState {
  [key: string]: any;
  timestamp?: string;
  version?: string;
}

export interface StatePreservationOptions {
  ttl?: number; // Time to live in milliseconds
  version?: string; // State version for migration support
  encrypt?: boolean; // Whether to encrypt sensitive data
  maxSize?: number; // Maximum size in bytes
}

const _DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const _DEFAULT_MAX_SIZE = 1024 * 1024; // 1MB
const STATE_VERSION = '1.0.0';

/**
 * Saves view state to localStorage with error handling and options
 */
export function saveViewState(
  viewName: string, 
  state: ViewState,
  options: StatePreservationOptions = {}
): boolean {
  const {
    ttl = _DEFAULT_TTL,
    version = STATE_VERSION,
    maxSize = _DEFAULT_MAX_SIZE
  } = options;

  try {
    // Prepare state with metadata
    const stateWithMeta = {
      ...state,
      timestamp: new Date().toISOString(),
      version,
      expiresAt: new Date(Date.now() + ttl).toISOString()
    };

    const serialized = JSON.stringify(stateWithMeta);
    
    // Check size limit
    if (serialized.length > maxSize) {
      console.warn(`State for ${viewName} exceeds max size (${serialized.length} > ${maxSize})`);
      return false;
    }

    // Check localStorage availability and space
    if (!isLocalStorageAvailable()) {
      console.warn('localStorage is not available');
      return false;
    }

    localStorage.setItem(`view_state_${viewName}`, serialized);
    
    // Clean up expired states periodically
    cleanupExpiredStates();
    
    return true;
  } catch (error) {
    console.error(`Failed to save state for ${viewName}:`, error);
    
    // Attempt to free up space and retry once
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      cleanupExpiredStates();
      cleanupOldestStates(5); // Remove 5 oldest states
      
      try {
        localStorage.setItem(`view_state_${viewName}`, JSON.stringify({
          ...state,
          timestamp: new Date().toISOString(),
          version
        }));
        return true;
      } catch (retryError) {
        console.error(`Retry failed for ${viewName}:`, retryError);
      }
    }
    
    return false;
  }
}

/**
 * Loads view state from localStorage with validation and migration support
 */
export function loadViewState<T extends ViewState>(
  viewName: string,
  fallbackState?: T
): T | null {
  try {
    if (!isLocalStorageAvailable()) {
      console.warn('localStorage is not available');
      return fallbackState || null;
    }

    const stored = localStorage.getItem(`view_state_${viewName}`);
    if (!stored) {
      return fallbackState || null;
    }

    const parsed = JSON.parse(stored);
    
    // Check expiration
    if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
      localStorage.removeItem(`view_state_${viewName}`);
      console.info(`Expired state removed for ${viewName}`);
      return fallbackState || null;
    }

    // Version migration support
    if (parsed.version && parsed.version !== STATE_VERSION) {
      const migrated = migrateState(parsed, parsed.version, STATE_VERSION);
      if (migrated) {
        // Save migrated state
        saveViewState(viewName, migrated);
        return migrated as T;
      } else {
        // Migration failed, remove invalid state
        localStorage.removeItem(`view_state_${viewName}`);
        return fallbackState || null;
      }
    }

    // Remove metadata before returning
    const { timestamp, version, expiresAt, ...cleanState } = parsed;
    return cleanState as T;
    
  } catch (error) {
    console.error(`Failed to load state for ${viewName}:`, error);
    
    // Remove corrupted state
    try {
      localStorage.removeItem(`view_state_${viewName}`);
    } catch (cleanupError) {
      console.error(`Failed to cleanup corrupted state for ${viewName}:`, cleanupError);
    }
    
    return fallbackState || null;
  }
}

/**
 * Removes view state from localStorage
 */
export function removeViewState(viewName: string): boolean {
  try {
    localStorage.removeItem(`view_state_${viewName}`);
    return true;
  } catch (error) {
    console.error(`Failed to remove state for ${viewName}:`, error);
    return false;
  }
}

/**
 * Gets all saved view states
 */
export function getAllViewStates(): Record<string, ViewState> {
  const states: Record<string, ViewState> = {};
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('view_state_')) {
        const viewName = key.replace('view_state_', '');
        const state = loadViewState(viewName);
        if (state) {
          states[viewName] = state;
        }
      }
    }
  } catch (error) {
    console.error('Failed to get all view states:', error);
  }
  
  return states;
}

/**
 * Clears all view states
 */
export function clearAllViewStates(): boolean {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('view_state_')) {
        keys.push(key);
      }
    }
    
    keys.forEach(key => localStorage.removeItem(key));
    return true;
  } catch (error) {
    console.error('Failed to clear all view states:', error);
    return false;
  }
}

/**
 * Checks if localStorage is available and working
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes expired states from localStorage
 */
function cleanupExpiredStates(): void {
  try {
    const now = new Date();
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('view_state_')) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.expiresAt && new Date(parsed.expiresAt) < now) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // If we can't parse it, it's corrupted - remove it
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    if (keysToRemove.length > 0) {
      console.info(`Cleaned up ${keysToRemove.length} expired/corrupted view states`);
    }
  } catch (error) {
    console.error('Failed to cleanup expired states:', error);
  }
}

/**
 * Removes oldest states to free up space
 */
function cleanupOldestStates(count: number): void {
  try {
    const states: Array<{ key: string; timestamp: string }> = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('view_state_')) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            states.push({
              key,
              timestamp: parsed.timestamp || '1970-01-01T00:00:00.000Z'
            });
          }
        } catch {
          // If we can't parse it, add it for removal with old timestamp
          states.push({
            key,
            timestamp: '1970-01-01T00:00:00.000Z'
          });
        }
      }
    }
    
    // Sort by timestamp and remove oldest
    states.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const toRemove = states.slice(0, count);
    
    toRemove.forEach(({ key }) => localStorage.removeItem(key));
    
    if (toRemove.length > 0) {
      console.info(`Cleaned up ${toRemove.length} oldest view states`);
    }
  } catch (error) {
    console.error('Failed to cleanup oldest states:', error);
  }
}

/**
 * Migrates state from one version to another
 */
function migrateState(
  state: ViewState, 
  fromVersion: string, 
  toVersion: string
): ViewState | null {
  // Add migration logic here as your state structure evolves
  // For now, just return the state as-is
  console.info(`State migration from ${fromVersion} to ${toVersion} - no migration needed`);
  return state;
}

/**
 * Hook for React components to easily use state preservation
 */
export function useViewStatePreservation<T extends ViewState>(
  viewName: string,
  initialState: T,
  options?: StatePreservationOptions
) {
  // This would be implemented as a custom React hook
  // For now, providing the utilities above
  return {
    saveState: (state: T) => saveViewState(viewName, state, options),
    loadState: () => loadViewState<T>(viewName, initialState),
    removeState: () => removeViewState(viewName)
  };
}