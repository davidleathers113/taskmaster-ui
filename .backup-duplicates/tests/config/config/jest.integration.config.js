/**
 * Jest Integration Tests Configuration (2025)
 * 
 * Configuration for integration testing with enhanced error handling,
 * async operations support, and comprehensive reporting.
 */

const path = require('path')

module.exports = {
  displayName: {
    name: 'INTEGRATION TESTS',
    color: 'yellow'
  },

  // Test Environment
  testEnvironment: 'node',
  
  // Test File Patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.integration.{js,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.integration.{js,ts,tsx}',
    '<rootDir>/tests/integration/**/*.{test,spec}.{js,ts,tsx}'
  ],

  // Ignore Patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/out/',
    '/build/',
    '\\.unit\\.(test|spec)\\.',
    '\\.e2e\\.(test|spec)\\.',
    '\\.performance\\.(test|spec)\\.'
  ],

  // TypeScript Support
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
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
    '<rootDir>/tests/setup/integration-tests.setup.ts'
  ],

  // Coverage Configuration (lighter for integration)
  collectCoverage: true,
  coverageDirectory: '<rootDir>/test-results/integration/coverage',
  coverageReporters: [
    'text-summary',
    'html',
    'json',
    'lcov'
  ],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.config.{ts,js}',
    '!src/**/__tests__/**',
    '!src/**/*.{test,spec}.{ts,tsx}'
  ],

  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Performance Configuration (adjusted for integration tests)
  maxWorkers: 2, // Reduced for integration tests
  testTimeout: 60000, // 1 minute for integration tests
  
  // Memory and Resource Management
  logHeapUsage: true,
  detectOpenHandles: true,
  detectLeaks: false, // May be too strict for integration tests

  // Sequential execution for integration tests
  maxConcurrency: 1,

  // Reporting Configuration
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: '<rootDir>/test-results/integration/html',
      filename: 'integration-test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'Integration Test Report',
      logoImgPath: undefined,
      inlineSource: false
    }],
    ['jest-junit', {
      outputDirectory: '<rootDir>/test-results/integration',
      outputName: 'junit.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: false,
      suiteNameTemplate: '{filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }],
    ['jest-json-reporter', {
      outputPath: '<rootDir>/test-results/integration/results.json'
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

  // Mock Configuration
  clearMocks: true,
  restoreMocks: true,

  // Verbose Output
  verbose: process.env.CI === 'true',

  // Error handling
  errorOnDeprecated: true,
  
  // Retry failed tests
  jest: {
    retryTimes: 2,
    retryOnFailure: true
  },

  // Watch Mode (disabled in CI)
  watchman: process.env.CI !== 'true'
}