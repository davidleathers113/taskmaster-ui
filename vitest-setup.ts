/**
 * Global Vitest Setup File (2025)
 * 
 * Configures module mocks and global setup for all tests
 */

import { vi } from 'vitest';

// Configure manual mocks
vi.mock('zustand', () => {
  return import('./__mocks__/zustand');
});

// Export setup for tests
export {};