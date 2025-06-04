/**
 * Playwright Configuration for TaskMaster Electron E2E Testing (2025)
 * 
 * Advanced configuration following 2025 best practices for Playwright + Electron testing.
 * Supports cross-platform testing, performance monitoring, accessibility validation,
 * and comprehensive CI/CD integration.
 * 
 * Research-based implementation incorporating:
 * - Playwright v1.52.0+ Electron support via CDP
 * - Cross-platform testing matrix (Windows, macOS, Linux)
 * - Performance and memory monitoring
 * - Visual regression testing capabilities
 * - CI/CD optimized configurations
 * - Security and accessibility testing integration
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * Environment Detection and Configuration
 */
const isCI = !!process.env.CI;
const isDebug = !!process.env.PLAYWRIGHT_DEBUG;

/**
 * 2025 Playwright Configuration for Electron Applications
 */
export default defineConfig({
  // Test Directory Configuration
  testDir: './tests/e2e',
  
  // Global Test Configuration
  globalSetup: './tests/setup/e2e.setup.ts',
  
  // Timeout Configuration (2025 best practices for Electron)
  timeout: 60000,        // 60 seconds for complex E2E scenarios
  expect: { timeout: 15000 }, // 15 seconds for assertions
  
  // Test Execution Configuration
  fullyParallel: !isDebug, // Parallel execution except when debugging
  forbidOnly: isCI,        // Prevent .only in CI
  retries: isCI ? 2 : 0,   // Retry failed tests in CI only
  workers: isCI ? 2 : 1,   // Limited workers for Electron stability
  
  // Reporting Configuration (2025 enhanced reporting)
  reporter: [
    // Always include list reporter for terminal output
    ['list'],
    
    // HTML reporter for detailed analysis
    ['html', { 
      open: !isCI ? 'on-failure' : 'never',
      outputFolder: './playwright-report'
    }],
    
    // JSON reporter for CI/CD integration
    ['json', { 
      outputFile: './test-results/playwright-results.json'
    }],
    
    // JUnit reporter for CI/CD systems
    ...(isCI ? [['junit', { 
      outputFile: './test-results/playwright-junit.xml'
    }]] : []),
    
    // GitHub Actions reporter for PR annotations
    ...(process.env.GITHUB_ACTIONS ? [['github']] : []),
  ],
  
  // Global Test Options
  use: {
    // Base URL for web content (if any)
    baseURL: 'file://',
    
    // Screenshot Configuration (2025 best practices)
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },
    
    // Video Recording (optimized for CI/CD)
    video: {
      mode: isCI ? 'retain-on-failure' : 'off',
      size: { width: 1280, height: 720 }
    },
    
    // Trace Collection (performance monitoring)
    trace: {
      mode: isCI ? 'retain-on-failure' : 'off',
      screenshots: true,
      snapshots: true,
      sources: true
    },
    
    // Action Timeout Configuration
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: true,
    
    // Locale and timezone for consistent testing
    locale: 'en-US',
    timezoneId: 'UTC',
    
    // Viewport configuration for consistent testing
    viewport: { width: 1280, height: 720 },
    
    // Color scheme preference
    colorScheme: 'light',
    
    // Reduced motion for accessibility testing
    reducedMotion: 'reduce',
  },

  // Project Configuration for Cross-Platform Testing
  projects: [
    // Electron Desktop Application Testing
    {
      name: 'electron-main',
      testMatch: /.*\.e2e\.(test|spec)\.(js|ts)$/,
      use: {
        // Electron-specific configuration
        ...devices['Desktop Chrome'],
        
        // Custom configuration for Electron testing
        channel: 'stable',
        headless: isCI,
        slowMo: isDebug ? 500 : 0,
        
        // Context options for Electron
        contextOptions: {
          strictSelectors: false,
          serviceWorkers: 'block',
          offline: false,
        }
      },
      
      // Project-specific timeout overrides
      timeout: 90000, // Extended timeout for Electron startup
      
      // Project metadata
      metadata: {
        platform: 'electron',
        type: 'desktop-app',
        framework: 'electron-vite'
      }
    },

    // Performance Testing Project
    {
      name: 'performance',
      testMatch: /.*\.performance\.(test|spec)\.(js|ts)$/,
      use: {
        ...devices['Desktop Chrome'],
        // Performance-specific configuration
        trace: 'on',
        video: 'on',
        // Extended timeouts for performance tests
        timeout: 120000,
        actionTimeout: 30000,
        navigationTimeout: 60000,
      },
      metadata: {
        type: 'performance',
        description: 'Performance and memory usage testing'
      }
    },

    // Accessibility Testing Project  
    {
      name: 'accessibility',
      testMatch: /.*\.a11y\.(test|spec)\.(js|ts)$/,
      use: {
        ...devices['Desktop Chrome'],
        // Accessibility-specific configuration
        reducedMotion: 'reduce',
        forcedColors: 'none',
        colorScheme: 'no-preference',
      },
      metadata: {
        type: 'accessibility',
        description: 'Accessibility compliance testing'
      }
    },

    // Visual Regression Testing Project
    {
      name: 'visual',
      testMatch: /.*\.visual\.(test|spec)\.(js|ts)$/,
      use: {
        ...devices['Desktop Chrome'],
        // Visual testing configuration
        screenshot: 'on',
        video: 'off',
        viewport: { width: 1280, height: 720 },
        reducedMotion: 'reduce',
      },
      metadata: {
        type: 'visual-regression',
        description: 'Visual consistency and regression testing'
      }
    }
  ],

  // Output Directory Configuration
  outputDir: './test-results',
  
  // Expect Configuration (2025 enhanced assertions)
  expect: {
    // Screenshot comparison configuration
    toMatchSnapshot: {
      threshold: 0.2,
      animations: 'disabled',
      fullPage: true,
      omitBackground: false,
      scale: 'device',
    },
    
    // Playwright visual comparison options
    toHaveScreenshot: {
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
      mask: [],
      mode: 'actual',
      scale: 'device',
    }
  },

  // Metadata for test organization
  metadata: {
    framework: 'playwright',
    version: '1.52.0',
    target: 'electron',
    year: 2025,
    maintainer: 'TaskMaster Team',
    description: 'Comprehensive E2E testing for TaskMaster Electron application'
  }
});