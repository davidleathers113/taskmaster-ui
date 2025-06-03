/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vitest Configuration for TaskMaster Desktop (2025)
 * 
 * Comprehensive testing setup for Electron + React + TypeScript application
 * with electron-vite build system integration. Following 2025 best practices
 * with projects configuration instead of deprecated workspace files.
 * 
 * Features:
 * - Multi-project configuration for process isolation
 * - React Testing Library support
 * - Path aliases matching electron-vite config
 * - Environment isolation for different test types
 * - Mock configurations for Electron APIs
 * - Coverage reporting with exclusions
 * - Performance monitoring
 */
export default defineConfig({
  plugins: [react()],
  
  test: {
    // Projects configuration (2025 best practice - replaces deprecated workspace)
    projects: [
      // Main Process Testing Configuration
      {
        name: 'main',
        test: {
          include: ['src/main/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/main/**/*.e2e.{test,spec}.{js,ts}'],
          environment: 'node',
          setupFiles: ['./tests/setup/main.setup.ts'],
          globals: true,
          mockReset: false,
          clearMocks: true,
          restoreMocks: false,
          coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/main/**/*.{js,ts}'],
            exclude: ['src/main/**/*.d.ts', 'src/main/**/index.ts'],
            thresholds: {
              statements: 80,
              branches: 75,
              functions: 80,
              lines: 80
            }
          }
        },
        define: {
          __ELECTRON_MAIN__: true,
          __ELECTRON_RENDERER__: false,
          __ELECTRON_PRELOAD__: false
        },
        resolve: {
          alias: {
            '@tests': resolve(__dirname, 'tests')
          }
        }
      },
      
      // Renderer Process Testing Configuration
      {
        name: 'renderer',
        test: {
          include: ['src/renderer/**/*.{test,spec}.{js,ts,jsx,tsx}'],
          exclude: ['src/renderer/**/*.e2e.{test,spec}.{js,ts,jsx,tsx}'],
          environment: 'happy-dom',
          setupFiles: ['./tests/setup/renderer.setup.ts'],
          globals: true,
          mockReset: false,
          clearMocks: true,
          restoreMocks: false,
          coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/renderer/**/*.{js,ts,jsx,tsx}'],
            exclude: ['src/renderer/**/*.d.ts', 'src/renderer/**/index.ts', 'src/renderer/**/main.tsx'],
            thresholds: {
              statements: 85,
              branches: 80,
              functions: 85,
              lines: 85
            }
          }
        },
        define: {
          __ELECTRON_MAIN__: false,
          __ELECTRON_RENDERER__: true,
          __ELECTRON_PRELOAD__: false
        },
        resolve: {
          alias: {
            '@': resolve(__dirname, 'src/renderer/src'),
            '@components': resolve(__dirname, 'src/renderer/src/components'),
            '@hooks': resolve(__dirname, 'src/renderer/src/hooks'),
            '@store': resolve(__dirname, 'src/renderer/src/store'),
            '@types': resolve(__dirname, 'src/renderer/src/types'),
            '@lib': resolve(__dirname, 'src/renderer/src/lib'),
            '@tests': resolve(__dirname, 'tests')
          }
        }
      },
      
      // Preload Scripts Testing Configuration
      {
        name: 'preload',
        test: {
          include: ['src/preload/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/preload/**/*.e2e.{test,spec}.{js,ts}'],
          environment: 'node',
          setupFiles: ['./tests/setup/preload.setup.ts'],
          globals: true,
          mockReset: false,
          clearMocks: true,
          restoreMocks: false,
          coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/preload/**/*.{js,ts}'],
            exclude: ['src/preload/**/*.d.ts', 'src/preload/**/index.ts'],
            thresholds: {
              statements: 90,
              branches: 85,
              functions: 90,
              lines: 90
            }
          }
        },
        define: {
          __ELECTRON_MAIN__: false,
          __ELECTRON_RENDERER__: false,
          __ELECTRON_PRELOAD__: true
        },
        resolve: {
          alias: {
            '@tests': resolve(__dirname, 'tests')
          }
        }
      },
      
      // Integration Testing Configuration
      {
        name: 'integration',
        test: {
          include: ['tests/integration/**/*.{test,spec}.{js,ts}'],
          environment: 'node',
          setupFiles: ['./tests/setup/integration.setup.ts'],
          globals: true,
          testTimeout: 30000,
          hookTimeout: 10000,
          teardownTimeout: 10000,
          mockReset: false,
          clearMocks: true,
          restoreMocks: false,
          coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{js,ts,jsx,tsx}'],
            exclude: ['src/**/*.d.ts', 'src/**/index.ts', 'tests/**/*'],
            thresholds: {
              statements: 70,
              branches: 65,
              functions: 70,
              lines: 70
            }
          }
        },
        define: {
          __ELECTRON_MAIN__: true,
          __ELECTRON_RENDERER__: true,
          __ELECTRON_PRELOAD__: true,
          __INTEGRATION_TEST__: true
        }
      },
      
      // E2E Testing Configuration (Playwright-based)
      {
        name: 'e2e',
        test: {
          include: ['tests/e2e/**/*.{test,spec}.{js,ts}'],
          environment: 'node',
          setupFiles: ['./tests/setup/e2e.setup.ts'],
          globals: true,
          testTimeout: 60000,
          hookTimeout: 20000,
          teardownTimeout: 20000,
          mockReset: false,
          clearMocks: false,
          restoreMocks: false,
          coverage: {
            enabled: false
          }
        },
        define: {
          __E2E_TEST__: true
        }
      }
    ],

    // Default configuration for any tests not in projects
    environment: 'happy-dom',
    
    // Global test configuration
    globals: true,
    setupFiles: ['./vitest-setup.ts', './tests/setup.ts'],
    
    // Mock directory configuration
    deps: {
      moduleDirectories: ['node_modules', 'tests/__mocks__']
    },
    
    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'out/**',
      'server/**',
      '**/*.e2e.{test,spec}.{ts,tsx}' // Exclude E2E tests from unit test runs
    ],
    
    // Test timeout configuration (2025 best practices)
    testTimeout: 15000, // 15 seconds for complex integration tests
    hookTimeout: 10000, // 10 seconds for setup/teardown hooks
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      
      // Include source files for coverage
      include: [
        'src/renderer/src/**/*.{ts,tsx}',
        'src/main/**/*.ts',
        'src/preload/**/*.ts'
      ],
      
      // Exclude from coverage
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.config.{ts,js}',
        'src/**/types/**',
        'src/**/*.stories.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/node_modules/**',
        'src/renderer/public/**',
        'src/main/index.ts', // Entry points
        'src/preload/index.ts'
      ],
      
      // Coverage thresholds for quality assurance
      thresholds: {
        global: {
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70
        },
        // Higher standards for critical components
        'src/renderer/src/store/**': {
          statements: 85,
          branches: 80,
          functions: 85,
          lines: 85
        },
        'src/renderer/src/components/error/**': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90
        }
      }
    },
    
    // Parallel execution for performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    },
    
    // Reporter configuration
    reporter: ['default', 'json', 'html'],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/index.html'
    },
    
    // Watch configuration for development
    watch: true,
    
    // Mock configuration  
    mockReset: false, // Preserve custom mocks like Zustand
    clearMocks: true,
    restoreMocks: false, // Don't restore mocks to preserve __mocks__ directory functionality
    
    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      VITE_APP_VERSION: '1.0.0-test'
    }
  },
  
  // Resolve configuration matching electron-vite setup
  resolve: {
    alias: {
      // Main renderer aliases
      '@': resolve(__dirname, './src/renderer/src'),
      '@components': resolve(__dirname, './src/renderer/src/components'),
      '@lib': resolve(__dirname, './src/renderer/src/lib'),
      '@hooks': resolve(__dirname, './src/renderer/src/hooks'),
      '@types': resolve(__dirname, './src/renderer/src/types'),
      '@store': resolve(__dirname, './src/renderer/src/store'),
      '@utils': resolve(__dirname, './src/renderer/src/utils'),
      
      // Main process aliases for testing IPC
      '@main': resolve(__dirname, './src/main'),
      '@preload': resolve(__dirname, './src/preload'),
      
      // Test utilities
      '@tests': resolve(__dirname, './tests')
    }
  },
  
  // Define global constants for testing
  define: {
    __APP_VERSION__: '"1.0.0-test"',
    __IS_DEV__: 'true',
    __IS_TEST__: 'true'
  },
  
  // ESBuild configuration for TypeScript
  esbuild: {
    target: 'node18'
  }
});