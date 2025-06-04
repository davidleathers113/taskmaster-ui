// eslint.config.js - ESLint Flat Config for TaskMaster UI (2025)
// Electron + TypeScript + React project with multi-process architecture

// Using 2025 best practices with tseslint.config()
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Manual React hooks configuration (v4.6.2 requires manual setup)
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  // Global ignores for build artifacts and dependencies
  {
    ignores: [
      'dist/**',
      'out/**',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      '**/*.d.ts',
      '.vite/**',
      '.electron-vite/**',
      'dist-packages/**',
      'debug-logs/**',
      'server/dist/**',
      'server/node_modules/**',
      '**/*.sh', // Shell scripts should not be linted by ESLint
      'src.backup.ts6133/**', // Backup directory should be ignored
      '*.backup/**', // Any backup directories
      '.taskmaster/**', // TaskMaster utility scripts
      '.backup-duplicates/**',
      'playwright-report/**',
    ],
  },

  // Base ESLint recommended configuration
  eslint.configs.recommended,

  // TypeScript recommended configuration
  ...tseslint.configs.recommended,
  
  // TypeScript-specific settings for main source files
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // Migrated TypeScript rules from .eslintrc.cjs
      '@typescript-eslint/no-explicit-any': 'warn',
      // '@typescript-eslint/ban-types': deprecated in newer versions 
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // Core ESLint rules handled by TypeScript
      'no-undef': 'off', // TypeScript handles this
      'no-unused-vars': 'off', // Use TypeScript version instead
    },
  },

  // TypeScript files not in main tsconfig.json (root level configs, etc.)
  {
    files: ['*.{ts,tsx}', '__mocks__/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Don't require project for root-level config files
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // More relaxed rules for config files
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },

  // Base configuration for all JavaScript/TypeScript files
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Global React for JSX (migrated from .eslintrc.cjs)
        React: 'readonly',
      },
    },
  },

  // React and React Refresh configuration
  {
    files: ['src/renderer/**/*.{js,ts,jsx,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser, // Browser environment for renderer process
        React: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // React hooks rules (manual configuration for v4.6.2)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // React refresh rules (migrated from .eslintrc.cjs)
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // ELECTRON MULTI-PROCESS CONFIGURATION
  
  // Main process specific configuration
  {
    files: ['src/main/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node, // Node.js environment for main process
      },
    },
    rules: {
      // Main process can use console for debugging
      'no-console': 'off',
      // Main process handles async operations
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },

  // Preload scripts specific configuration  
  {
    files: ['src/preload/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node, // Node.js APIs available
        ...globals.browser, // Browser APIs also available in preload
      },
    },
    rules: {
      // Preload scripts should be careful with exposures
      'no-console': 'warn',
      // Strict about contextBridge usage
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // Renderer process specific configuration
  {
    files: ['src/renderer/**/*.{js,ts,jsx,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser, // Browser environment only
      },
    },
    rules: {
      // Renderer should use electron-log, not console
      'no-console': 'warn',
      // Strict about IPC usage in renderer
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },


  // Server files configuration (separate Node.js server)
  {
    files: ['server/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Server can use console for logging
      'no-console': 'off',
      // Only apply TypeScript rules to .ts files, not .js files
    },
  },

  // Server TypeScript files specific configuration
  {
    files: ['server/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './server/tsconfig.json',
      },
    },
    rules: {
      // Strict async handling for server TypeScript files
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },

  // Configuration files and CommonJS files
  {
    files: [
      '*.config.{js,ts,mjs,cjs}',
      '**/*.config.{js,ts,mjs,cjs}',
      'vite.*.config.{js,ts}',
      'electron.vite.config.{js,ts}',
      'vitest.config.{js,ts}',
      'tailwind.config.{js,ts}',
      '**/*.cjs',
      '.taskmaster/**/*.{js,cjs,ts}',
      'scripts/**/*.{js,cjs,ts}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Configuration files can be more permissive
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
      'no-undef': 'off', // Node.js globals should be available
    },
  },

  // Vitest test files specific configuration
  {
    files: [
      '**/*.test.{js,ts,jsx,tsx}',
      '**/*.spec.{js,ts,jsx,tsx}',
      'tests/**/*.{js,ts,jsx,tsx}',
      '**/__tests__/**/*.{js,ts,jsx,tsx}',
      '**/setup/**/*.{js,ts}',
      '**/mocks/**/*.{js,ts}',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // Vitest globals
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        // Additional testing globals
        global: 'readonly',
      },
    },
    rules: {
      // More relaxed rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
      'no-undef': 'off',
    },
  },

  // Script files and utilities (Node.js environment)
  {
    files: [
      'scripts/**/*.{js,ts,mjs,cjs}',
      'wt_tasks/**/*.{js,ts,mjs}',
      '.taskmaster/**/*.{js,ts,cjs}',
      '**/*.cjs',
      'cleanup-*.js',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Scripts can use console and require
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);