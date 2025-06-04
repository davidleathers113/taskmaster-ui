/**
 * Zustand Middleware Mock for Vitest (2025)
 * 
 * Provides mocks for Zustand middleware that may not work correctly
 * in test environments, particularly immer and persist.
 */

import { vi } from 'vitest';

// Mock immer middleware to pass through state mutations
export const immer = vi.fn((stateCreator) => {
  return (set, get, api) => {
    const immerSet = (fn) => {
      if (typeof fn === 'function') {
        // For immer-style mutations, extract the new state directly
        const newState = fn(get());
        set(newState);
      } else {
        set(fn);
      }
    };
    return stateCreator(immerSet, get, api);
  };
});

// Mock persist middleware to avoid localStorage complications
export const persist = vi.fn((stateCreator) => {
  return stateCreator;
});

// Mock subscribeWithSelector middleware
export const subscribeWithSelector = vi.fn((stateCreator) => {
  return stateCreator;
});