/**
 * Vitest Global Setup for TaskMaster Desktop (2025)
 * 
 * This file configures the global testing environment for DOM-based tests only.
 * For Node.js environments, separate setup files are used for proper isolation.
 * Following 2025 best practices with proper environment separation.
 */

import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Import Zustand mock to ensure it's loaded for DOM environment tests
import '../__mocks__/zustand';

// Check if we're in a DOM environment before accessing window
const isDOMEnvironment = typeof window !== 'undefined';

// Global test configuration for DOM environments only
beforeAll(() => {
  if (!isDOMEnvironment) {
    console.warn('DOM-specific setup skipped in Node.js environment');
    return;
  }

  // Mock window.matchMedia for CSS-in-JS libraries
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver for components that use it
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver for virtual scrolling components
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock window.scrollTo for components that programmatically scroll
  window.scrollTo = vi.fn();

  // Mock performance.now for tests that use timing
  if (typeof performance !== 'undefined' && performance.now) {
    performance.now = vi.fn(() => Date.now());
  }

  // Mock requestAnimationFrame for Framer Motion
  global.requestAnimationFrame = vi.fn((cb) => {
    setTimeout(cb, 16); // ~60fps
    return 1;
  });

  global.cancelAnimationFrame = vi.fn();
});

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Enhanced setup for each test
beforeEach(() => {
  if (!isDOMEnvironment) {
    return;
  }
  
  // Reset DOM state
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  
  // Reset scroll position
  window.scrollX = 0;
  window.scrollY = 0;
  
  // Reset localStorage mock
  if (typeof localStorage !== 'undefined' && localStorage.clear) {
    localStorage.clear();
  }
  
  // Reset console methods if they were mocked
  if (vi.isMockFunction(console.error)) {
    console.error.mockClear();
  }
  if (vi.isMockFunction(console.warn)) {
    console.warn.mockClear();
  }
  
  // Reset all Zustand stores (2025 best practice)
  try {
    const { resetAllStores } = require('../__mocks__/zustand');
    resetAllStores();
  } catch (error) {
    // Fail silently if Zustand mock not available
    console.warn('Zustand mock not found at ../__mocks__/zustand:', error.message);
  }
});

// Mock localStorage (only in DOM environment)
const localStorageMock = (() => {
  const storage = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => storage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
    key: vi.fn((index: number) => {
      const keys = Array.from(storage.keys());
      return keys[index] || null;
    }),
    get length() {
      return storage.size;
    }
  };
})();

if (isDOMEnvironment) {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  });
}

// Mock sessionStorage
const sessionStorageMock = {
  storage: new Map<string, string>(),
  getItem: vi.fn((key: string) => sessionStorageMock.storage.get(key) || null),
  setItem: vi.fn((key: string, value: string) => {
    sessionStorageMock.storage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    sessionStorageMock.storage.delete(key);
  }),
  clear: vi.fn(() => {
    sessionStorageMock.storage.clear();
  }),
  key: vi.fn((index: number) => {
    const keys = Array.from(sessionStorageMock.storage.keys());
    return keys[index] || null;
  }),
  get length() {
    return sessionStorageMock.storage.size;
  }
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true
});

// Mock IndexedDB for backup service tests
const indexedDBMock = {
  open: vi.fn(() => {
    const request = {
      result: {
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            put: vi.fn(() => ({ onsuccess: null, onerror: null })),
            get: vi.fn(() => ({ result: null, onsuccess: null, onerror: null })),
            delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
            getAllKeys: vi.fn(() => ({ result: [], onsuccess: null, onerror: null })),
            clear: vi.fn(() => ({ onsuccess: null, onerror: null })),
            count: vi.fn(() => ({ result: 0, onsuccess: null, onerror: null }))
          }))
        })),
        objectStoreNames: { 
          contains: vi.fn(() => false),
          length: 0
        },
        createObjectStore: vi.fn(() => ({
          createIndex: vi.fn()
        })),
        close: vi.fn()
      },
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null
    };
    
    // Simulate successful connection
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess({ target: request });
    }, 0);
    
    return request;
  }),
  deleteDatabase: vi.fn(() => {
    const request = { onsuccess: null, onerror: null };
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess({ target: request });
    }, 0);
    return request;
  })
};

Object.defineProperty(window, 'indexedDB', {
  value: indexedDBMock,
  writable: true
});

// Mock Electron APIs for renderer process tests
const electronAPIsMock = {
  // IPC communication mocks
  invoke: vi.fn().mockResolvedValue({}),
  on: vi.fn(),
  off: vi.fn(),
  send: vi.fn(),
  
  // File system operations
  showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
  showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '' }),
  readFile: vi.fn().mockResolvedValue(''),
  writeFile: vi.fn().mockResolvedValue(void 0),
  
  // App information
  getVersion: vi.fn().mockReturnValue('1.0.0-test'),
  getPlatform: vi.fn().mockReturnValue('test'),
  
  // Window controls
  minimize: vi.fn(),
  maximize: vi.fn(),
  close: vi.fn(),
  
  // Project management
  selectProjectDirectory: vi.fn().mockResolvedValue('/mock/project/path'),
  getProjectFiles: vi.fn().mockResolvedValue([]),
  
  // Backup operations
  saveBackup: vi.fn().mockResolvedValue(void 0),
  loadBackup: vi.fn().mockResolvedValue({}),
  listBackups: vi.fn().mockResolvedValue([]),
  deleteBackup: vi.fn().mockResolvedValue(void 0)
};

// Make electronAPI available globally for tests
Object.defineProperty(window, 'electronAPI', {
  value: electronAPIsMock,
  writable: true
});

// Export mocks for use in individual tests
export {
  localStorageMock,
  sessionStorageMock,
  indexedDBMock,
  electronAPIsMock
};

// Test utilities for common patterns
export const testUtils = {
  // Wait for async operations to complete
  waitForAsync: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create mock task data
  createMockTask: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000000),
    title: 'Test Task',
    description: 'Test task description',
    status: 'pending' as const,
    priority: 'medium' as const,
    dependencies: [],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),
  
  // Create mock user settings
  createMockUserSettings: (overrides = {}) => ({
    ui: {
      theme: 'system' as const,
      density: 'comfortable' as const,
      animations: true,
      ...overrides.ui
    },
    notifications: {
      enabled: true,
      sound: false,
      ...overrides.notifications
    },
    workingHours: {
      start: '09:00',
      end: '17:00',
      timezone: 'UTC',
      ...overrides.workingHours
    },
    ...overrides
  }),
  
  // Simulate user interactions
  simulateKeyPress: (key: string) => {
    const event = new KeyboardEvent('keydown', { key });
    document.dispatchEvent(event);
  },
  
  // Mock component with error boundary testing
  createErrorThrowingComponent: (errorMessage = 'Test error') => {
    return () => {
      throw new Error(errorMessage);
    };
  }
};