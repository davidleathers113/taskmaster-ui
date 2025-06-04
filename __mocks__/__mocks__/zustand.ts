/**
 * Zustand Mock for Vitest (2025)
 * 
 * Consolidated mock implementation that provides store reset functionality
 * and maintains test isolation between test runs. Includes all middleware
 * mocking in a single file for better maintainability.
 */

import { act } from '@testing-library/react';
import { vi } from 'vitest';
import type * as ZustandTypes from 'zustand';

// Export all original exports first
export * from 'zustand';

// Variable to hold reset functions for all stores declared in the app
export const storeResetFns = new Set<() => void>();

// Import actual implementations
const { create: actualCreate, createStore: actualCreateStore } = 
  await vi.importActual<typeof ZustandTypes>('zustand');

// Import actual middleware implementations
const { immer: actualImmer, persist: actualPersist, subscribeWithSelector: actualSubscribeWithSelector } = 
  await vi.importActual<any>('zustand/middleware');

// Mock middleware with proper functionality
vi.mock('zustand/middleware', () => ({
  immer: vi.fn((stateCreator) => {
    // Use actual immer but with test-friendly settings
    return actualImmer(stateCreator);
  }),
  persist: vi.fn((stateCreator, options) => {
    // For tests, use memory storage instead of localStorage
    const memoryStorage = {
      storage: new Map(),
      getItem: (key: string) => memoryStorage.storage.get(key) || null,
      setItem: (key: string, value: string) => memoryStorage.storage.set(key, value),
      removeItem: (key: string) => memoryStorage.storage.delete(key),
    };
    
    const testOptions = {
      ...options,
      storage: memoryStorage,
    };
    
    return actualPersist(stateCreator, testOptions);
  }),
  subscribeWithSelector: vi.fn((stateCreator) => {
    // Use actual implementation for proper functionality
    return actualSubscribeWithSelector(stateCreator);
  }),
}));

const createUncurried = <T>(
  stateCreator: ZustandTypes.StateCreator<T>,
) => {
  const store = actualCreate(stateCreator);
  const initialState = store.getInitialState();
  
  // Add reset function to global set for cleanup
  storeResetFns.add(() => {
    act(() => {
      store.setState(initialState, true);
    });
  });
  
  return store;
};

// Mock create function that supports both curried and uncurried usage
export const create = (<T>(
  stateCreator: ZustandTypes.StateCreator<T>,
) => {
  // Support curried version of create
  return typeof stateCreator === 'function' ? 
    createUncurried(stateCreator) : createUncurried;
}) as typeof actualCreate;

// Mock createStore function
export const createStore = <T>(
  stateCreator: ZustandTypes.StateCreator<T>,
) => {
  const store = actualCreateStore(stateCreator);
  const initialState = store.getInitialState();
  
  storeResetFns.add(() => {
    act(() => {
      store.setState(initialState, true);
    });
  });
  
  return store;
};

// Utility function to reset all stores (for use in test cleanup)
export const resetAllStores = () => {
  storeResetFns.forEach((resetFn) => {
    resetFn();
  });
};