/**
 * Jest Unit Tests Configuration (2025)
 * 
 * Optimized configuration for unit testing following 2025 best practices:
 * - TypeScript support with latest ts-jest
 * - Multiple output formats for unified reporting
 * - Coverage collection with appropriate thresholds
 * - Performance monitoring and memory management
 */

const path = require('path')

module.exports = {
  displayName: {
    name: 'UNIT TESTS',
    color: 'blue'
  },

  // Test Environment
  testEnvironment: 'node',
  
  // Test File Patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.unit.{js,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.unit.{js,ts,tsx}',
    '<rootDir>/tests/unit/**/*.{test,spec}.{js,ts,tsx}'
  ],

  // Ignore Patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/out/',
    '/build/',
    '\\.e2e\\.(test|spec)\\.',
    '\\.integration\\.(test|spec)\\.',
    '\\.performance\\.(test|spec)\\.'
  ],

  // TypeScript Support
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
          // Optimize for testing
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
          resolveJsonModule: true
        }
      }
    }]
  },

  // Module Resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/renderer/src/$1',
    '^@components/(.*)$': '<rootDir>/src/renderer/src/components/$1',
    '^@lib/(.*)$': '<rootDir>/src/renderer/src/lib/$1',
    '^@hooks/(.*)$': '<rootDir>/src/renderer/src/hooks/$1',
    '^@types/(.*)$': '<rootDir>/src/renderer/src/types/$1',
    '^@store/(.*)$': '<rootDir>/src/renderer/src/store/$1'
  },

  // Setup Files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/unit-tests.setup.ts'
  ],

  // Coverage Configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/test-results/unit/coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'json',
    'lcov',
    'clover'
  ],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.config.{ts,js}',
    '!src/**/__tests__/**',
    '!src/**/*.{test,spec}.{ts,tsx}',
    '!src/main/index.ts', // Exclude Electron main process
    '!src/preload/index.ts' // Exclude preload scripts
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/renderer/src/store/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/renderer/src/lib/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Performance Configuration
  maxWorkers: '50%',
  testTimeout: 30000,
  
  // Memory Management
  logHeapUsage: true,
  detectOpenHandles: true,
  detectLeaks: true,

  // Reporting Configuration (2025 Multi-format)
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: '<rootDir>/test-results/unit/html',
      filename: 'unit-test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'Unit Test Report',
      logoImgPath: undefined,
      inlineSource: false
    }],
    ['jest-junit', {
      outputDirectory: '<rootDir>/test-results/unit',
      outputName: 'junit.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: false,
      suiteNameTemplate: '{filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }],
    ['jest-json-reporter', {
      outputPath: '<rootDir>/test-results/unit/results.json'
    }]
  ],

  // Global Settings
  globals: {
    'ts-jest': {
      isolatedModules: true,
      useESM: false
    }
  },

  // Module Extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],

  // Clear Mocks
  clearMocks: true,
  restoreMocks: true,

  // Verbose Output for CI
  verbose: process.env.CI === 'true',

  // Error handling
  errorOnDeprecated: true,
  
  // Watch Mode (disabled in CI)
  watchman: process.env.CI !== 'true'
}