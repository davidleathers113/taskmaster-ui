/**
 * Unified Test Runner Configuration (2025)
 * 
 * Orchestrates all test types (Jest, Playwright, Memory, Performance, Security)
 * with comprehensive reporting and result aggregation.
 * 
 * Research-based implementation following 2025 best practices:
 * - Test runner orchestration with proper dependency management
 * - Multi-format reporting (JSON, HTML, JUnit, Allure)
 * - Performance monitoring and regression detection
 * - Cross-platform compatibility matrix
 */

export interface TestSuite {
  name: string
  command: string
  timeout: number
  retries: number
  parallel: boolean
  dependencies?: string[]
  platforms?: string[]
  critical: boolean
  reportFormat: string[]
  outputPath: string
}

export interface UnifiedTestConfig {
  suites: TestSuite[]
  reporting: {
    outputDir: string
    formats: string[]
    aggregation: boolean
    retention: number
  }
  performance: {
    thresholds: Record<string, number>
    monitoring: boolean
    regression: boolean
  }
  scheduling: {
    sequential: string[]
    parallel: string[]
    conditional: Record<string, string[]>
  }
  notifications: {
    slack?: {
      webhook: string
      channels: string[]
    }
    github?: {
      createIssues: boolean
      labels: string[]
    }
  }
}

export const unifiedTestConfig: UnifiedTestConfig = {
  suites: [
    // Unit Tests (Jest)
    {
      name: 'unit-tests',
      command: 'jest --config=tests/config/jest.unit.config.js',
      timeout: 300000, // 5 minutes
      retries: 1,
      parallel: true,
      platforms: ['linux', 'windows', 'macos'],
      critical: true,
      reportFormat: ['json', 'junit', 'html'],
      outputPath: 'test-results/unit'
    },

    // Integration Tests (Jest)
    {
      name: 'integration-tests',
      command: 'jest --config=tests/config/jest.integration.config.js',
      timeout: 600000, // 10 minutes
      retries: 2,
      parallel: false,
      dependencies: ['unit-tests'],
      platforms: ['linux', 'windows', 'macos'],
      critical: true,
      reportFormat: ['json', 'junit', 'html'],
      outputPath: 'test-results/integration'
    },

    // E2E Tests (Playwright)
    {
      name: 'e2e-tests',
      command: 'playwright test --project=electron-main',
      timeout: 1800000, // 30 minutes
      retries: 3,
      parallel: true,
      dependencies: ['unit-tests'],
      platforms: ['linux', 'windows', 'macos'],
      critical: true,
      reportFormat: ['html', 'json', 'junit'],
      outputPath: 'test-results/e2e'
    },

    // Memory Tests
    {
      name: 'memory-tests',
      command: 'npm run test:memory:detailed',
      timeout: 900000, // 15 minutes
      retries: 2,
      parallel: false,
      dependencies: ['unit-tests'],
      platforms: ['linux'],
      critical: false,
      reportFormat: ['json', 'html'],
      outputPath: 'test-results/memory'
    },

    // Performance Tests
    {
      name: 'performance-tests',
      command: 'playwright test --project=performance',
      timeout: 1200000, // 20 minutes
      retries: 1,
      parallel: false,
      dependencies: ['e2e-tests'],
      platforms: ['linux'],
      critical: false,
      reportFormat: ['json', 'html'],
      outputPath: 'test-results/performance'
    },

    // Security Tests
    {
      name: 'security-tests',
      command: 'npm run test:security:full',
      timeout: 600000, // 10 minutes
      retries: 1,
      parallel: true,
      platforms: ['linux'],
      critical: true,
      reportFormat: ['json', 'html'],
      outputPath: 'test-results/security'
    },

    // Visual Regression Tests
    {
      name: 'visual-tests',
      command: 'playwright test --project=visual',
      timeout: 900000, // 15 minutes
      retries: 2,
      parallel: true,
      dependencies: ['e2e-tests'],
      platforms: ['linux', 'windows', 'macos'],
      critical: false,
      reportFormat: ['html', 'json'],
      outputPath: 'test-results/visual'
    },

    // Accessibility Tests
    {
      name: 'accessibility-tests',
      command: 'playwright test --project=accessibility',
      timeout: 600000, // 10 minutes
      retries: 1,
      parallel: true,
      dependencies: ['e2e-tests'],
      platforms: ['linux'],
      critical: false,
      reportFormat: ['html', 'json'],
      outputPath: 'test-results/accessibility'
    }
  ],

  reporting: {
    outputDir: 'test-results/unified',
    formats: ['html', 'json', 'junit', 'allure'],
    aggregation: true,
    retention: 30 // days
  },

  performance: {
    thresholds: {
      'startup-time': 5000,
      'memory-usage': 512,
      'cpu-usage': 80,
      'test-duration': 1800000,
      'memory-leaks': 10
    },
    monitoring: true,
    regression: true
  },

  scheduling: {
    sequential: ['unit-tests', 'integration-tests'],
    parallel: ['e2e-tests', 'security-tests'],
    conditional: {
      'ci': ['unit-tests', 'integration-tests', 'e2e-tests', 'security-tests'],
      'nightly': ['memory-tests', 'performance-tests', 'visual-tests', 'accessibility-tests'],
      'release': ['unit-tests', 'integration-tests', 'e2e-tests', 'performance-tests', 'security-tests']
    }
  },

  notifications: {
    github: {
      createIssues: true,
      labels: ['testing', 'automated', 'unified-pipeline']
    }
  }
}

export default unifiedTestConfig