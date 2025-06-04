# Test Strategy Implementation Guide

## Overview
This guide provides detailed, step-by-step implementation instructions for each testing strategy recommendation. Follow these guides to systematically improve the TaskMaster UI testing infrastructure.

## Quick Start Checklist
- [ ] Review current test failures and warnings
- [ ] Set up proper development environment
- [ ] Implement Phase 1 critical fixes
- [ ] Establish monitoring and metrics
- [ ] Begin iterative improvements

## Detailed Implementation Guides

### 1. Test Coverage Improvements

#### 1.1 Critical Path Coverage Implementation

**Step 1: Identify Critical Paths**
```bash
# Analyze current coverage
npm run test:coverage

# Generate detailed coverage report
npm run test -- --coverage --coverage.reporter=html
```

**Step 2: Create Coverage Configuration**
```typescript
// vitest.config.coverage.ts
export default {
  test: {
    coverage: {
      include: [
        'src/renderer/src/store/**/*.ts',
        'src/main/ipc-handlers.ts',
        'src/renderer/src/components/error/**/*.tsx'
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90
      }
    }
  }
}
```

**Step 3: Write Missing Tests**
```typescript
// Example: Task Store Test
import { describe, it, expect, beforeEach } from 'vitest'
import { useTaskStore } from '@/store/useTaskStore'

describe('Task Store Critical Operations', () => {
  beforeEach(() => {
    useTaskStore.getState().reset()
  })

  it('should handle task CRUD operations', async () => {
    const store = useTaskStore.getState()
    
    // Create
    const task = await store.createTask({ title: 'Test Task' })
    expect(task).toBeDefined()
    
    // Read
    const tasks = store.getTasks()
    expect(tasks).toHaveLength(1)
    
    // Update
    await store.updateTask(task.id, { status: 'completed' })
    expect(store.getTaskById(task.id)?.status).toBe('completed')
    
    // Delete
    await store.deleteTask(task.id)
    expect(store.getTasks()).toHaveLength(0)
  })
})
```

**Step 4: Enforce Coverage in CI/CD**
```yaml
# .github/workflows/test.yml
- name: Run Tests with Coverage
  run: npm run test:coverage
  
- name: Check Coverage Thresholds
  run: |
    if [ $(jq '.total.statements.pct' coverage/coverage-summary.json) -lt 90 ]; then
      echo "Coverage below threshold"
      exit 1
    fi
```

#### 1.2 Integration Test Expansion

**Step 1: Set Up Integration Test Environment**
```typescript
// tests/setup/integration.setup.ts
import { app, BrowserWindow } from 'electron'
import { vi } from 'vitest'

// Mock Electron APIs
vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(true),
    quit: vi.fn()
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    on: vi.fn(),
    webContents: {
      send: vi.fn(),
      on: vi.fn()
    }
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  }
}))
```

**Step 2: Create IPC Test Suite**
```typescript
// tests/integration/ipc-communication.test.ts
import { describe, it, expect } from 'vitest'
import { setupIpcHandlers } from '@main/ipc-handlers'
import { ipcMain } from 'electron'

describe('IPC Communication Integration', () => {
  it('should handle task operations via IPC', async () => {
    setupIpcHandlers()
    
    // Verify handler registration
    expect(ipcMain.handle).toHaveBeenCalledWith('task:create', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('task:read', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('task:update', expect.any(Function))
    expect(ipcMain.handle).toHaveBeenCalledWith('task:delete', expect.any(Function))
  })
})
```

**Step 3: Test Cross-Process State Sync**
```typescript
// tests/integration/state-sync.test.ts
describe('Cross-Process State Synchronization', () => {
  it('should sync state between main and renderer', async () => {
    const mainState = createMainProcessState()
    const rendererState = createRendererState()
    
    // Simulate state change in renderer
    await rendererState.updateTask({ id: '1', status: 'done' })
    
    // Verify sync to main process
    await waitFor(() => {
      expect(mainState.getTask('1').status).toBe('done')
    })
  })
})
```

### 2. Test Stability Enhancements

#### 2.1 React Testing Best Practices

**Step 1: Fix act() Warnings**
```typescript
// Before (causes warnings)
it('should update state', () => {
  const { result } = renderHook(() => useTaskStore())
  result.current.updateTask({ id: '1', title: 'Updated' })
  expect(result.current.tasks[0].title).toBe('Updated')
})

// After (proper implementation)
import { act, renderHook, waitFor } from '@testing-library/react'

it('should update state', async () => {
  const { result } = renderHook(() => useTaskStore())
  
  await act(async () => {
    await result.current.updateTask({ id: '1', title: 'Updated' })
  })
  
  await waitFor(() => {
    expect(result.current.tasks[0].title).toBe('Updated')
  })
})
```

**Step 2: Implement Testing Utilities**
```typescript
// tests/utils/react-testing.ts
import { act, waitFor } from '@testing-library/react'

export async function waitForStateUpdate(callback: () => void) {
  await act(async () => {
    callback()
    // Allow microtasks to complete
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

export async function waitForAsync(assertion: () => void, timeout = 5000) {
  await waitFor(assertion, { timeout })
}
```

**Step 3: Create Custom Render Function**
```typescript
// tests/utils/custom-render.tsx
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllTheProviders, ...options })
}
```

#### 2.2 Test Isolation and Cleanup

**Step 1: Global Test Hooks**
```typescript
// vitest-setup.ts
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'

beforeEach(() => {
  // Reset all stores
  useTaskStore.setState(initialState)
  
  // Clear storage
  localStorage.clear()
  sessionStorage.clear()
  
  // Reset fetch mocks
  global.fetch = vi.fn()
})

afterEach(() => {
  // React Testing Library cleanup
  cleanup()
  
  // Clear all mocks
  vi.clearAllMocks()
  
  // Clear timers
  vi.clearAllTimers()
  
  // Restore mocks
  vi.restoreAllMocks()
})
```

**Step 2: Store Reset Utilities**
```typescript
// tests/utils/store-reset.ts
export function resetAllStores() {
  const stores = [useTaskStore, useProjectStore, useSettingsStore]
  
  stores.forEach(store => {
    if ('reset' in store.getState()) {
      store.getState().reset()
    } else {
      // Fallback: manually reset to initial state
      store.setState(store.getInitialState())
    }
  })
}
```

### 3. Environment Configuration

#### 3.1 CI/CD Environment Optimization

**Step 1: GitHub Actions Configuration**
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [18, 20]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'
      
      - name: Setup Display (Linux)
        if: runner.os == 'Linux'
        run: |
          export DISPLAY=:99
          sudo Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Run Linting
        run: npm run lint -- --max-warnings 0
      
      - name: Run Type Check
        run: npm run typecheck
      
      - name: Run Unit Tests
        run: npm run test:unit -- --coverage
      
      - name: Run Integration Tests
        run: npm run test:integration
      
      - name: Run E2E Tests
        run: npm run test:e2e
        
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          
      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ matrix.os }}-node${{ matrix.node }}
          path: |
            test-results/
            playwright-report/
            coverage/
```

**Step 2: Parallel Test Execution**
```json
// package.json
{
  "scripts": {
    "test:parallel": "concurrently \"npm:test:unit\" \"npm:test:integration\" \"npm:test:e2e\"",
    "test:unit": "vitest run --project=main --project=renderer --project=preload",
    "test:integration": "vitest run --project=integration",
    "test:e2e": "playwright test"
  }
}
```

### 4. Process Improvements

#### 4.1 Test-Driven Development

**Step 1: Pre-commit Hook Setup**
```bash
# Install husky
npm install --save-dev husky lint-staged

# Initialize husky
npx husky init

# Add pre-commit hook
echo 'npx lint-staged' > .husky/pre-commit
```

**Step 2: Lint-staged Configuration**
```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "vitest related --run"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

**Step 3: TDD Workflow Script**
```bash
#!/bin/bash
# scripts/tdd-workflow.sh

echo "TDD Workflow Helper"
echo "==================="

# Step 1: Create test file
read -p "Feature name: " feature
test_file="src/__tests__/${feature}.test.ts"

cat > $test_file << EOF
import { describe, it, expect } from 'vitest'

describe('${feature}', () => {
  it('should [describe expected behavior]', () => {
    // Arrange
    
    // Act
    
    // Assert
    expect(true).toBe(false) // Start with failing test
  })
})
EOF

echo "✅ Test file created: $test_file"
echo "📝 Write your test first, then implement the feature"

# Step 2: Watch mode
npm run test -- --watch $test_file
```

### 5. Advanced Testing Strategies

#### 5.2 Performance Testing

**Step 1: Performance Test Setup**
```typescript
// tests/e2e/performance.test.ts
import { test, expect } from '@playwright/test'

test.describe('Performance Metrics', () => {
  test('should measure app startup time', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('/')
    await page.waitForSelector('[data-testid="app-ready"]')
    
    const loadTime = Date.now() - startTime
    
    expect(loadTime).toBeLessThan(3000) // 3 second threshold
    
    // Collect performance metrics
    const metrics = await page.evaluate(() => ({
      memory: performance.memory,
      timing: performance.timing,
      paint: performance.getEntriesByType('paint')
    }))
    
    console.log('Performance Metrics:', metrics)
  })
})
```

**Step 2: Memory Leak Detection**
```typescript
// tests/e2e/memory-leak.test.ts
test('should not leak memory on repeated operations', async ({ page }) => {
  const measurements = []
  
  for (let i = 0; i < 10; i++) {
    // Perform operations
    await page.click('[data-testid="create-task"]')
    await page.fill('[name="title"]', `Task ${i}`)
    await page.click('[type="submit"]')
    
    // Measure memory
    const memory = await page.evaluate(() => performance.memory.usedJSHeapSize)
    measurements.push(memory)
  }
  
  // Check for memory growth
  const growth = measurements[9] - measurements[0]
  const avgGrowthPerOperation = growth / 10
  
  expect(avgGrowthPerOperation).toBeLessThan(1_000_000) // 1MB per operation threshold
})
```

#### 5.3 Security Testing

**Step 1: Security Test Suite**
```typescript
// tests/security/electron-security.test.ts
import { test, expect, ElectronApplication } from '@playwright/test'

test.describe('Electron Security', () => {
  let app: ElectronApplication
  
  test('should have secure webPreferences', async () => {
    const mainWindow = await app.firstWindow()
    const webPreferences = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return win.webPreferences
    })
    
    expect(webPreferences.contextIsolation).toBe(true)
    expect(webPreferences.nodeIntegration).toBe(false)
    expect(webPreferences.sandbox).toBe(true)
  })
  
  test('should validate IPC channel whitelist', async () => {
    const allowedChannels = ['task:create', 'task:read', 'task:update', 'task:delete']
    
    // Attempt to use unauthorized channel
    const result = await app.evaluate(async ({ ipcRenderer }) => {
      try {
        await ipcRenderer.invoke('unauthorized:channel')
        return 'success'
      } catch (error) {
        return 'blocked'
      }
    })
    
    expect(result).toBe('blocked')
  })
})
```

## Monitoring and Metrics

### Setting Up Test Metrics Dashboard

**Step 1: Create Metrics Collector**
```typescript
// scripts/collect-test-metrics.ts
import fs from 'fs'
import path from 'path'

interface TestMetrics {
  timestamp: string
  coverage: {
    statements: number
    branches: number
    functions: number
    lines: number
  }
  testResults: {
    passed: number
    failed: number
    skipped: number
    duration: number
  }
  flakiness: {
    flakyTests: string[]
    retryCount: number
  }
}

export async function collectMetrics(): Promise<TestMetrics> {
  // Read coverage report
  const coverage = JSON.parse(
    fs.readFileSync('./coverage/coverage-summary.json', 'utf-8')
  )
  
  // Read test results
  const testResults = JSON.parse(
    fs.readFileSync('./test-results/results.json', 'utf-8')
  )
  
  return {
    timestamp: new Date().toISOString(),
    coverage: coverage.total,
    testResults: {
      passed: testResults.numPassedTests,
      failed: testResults.numFailedTests,
      skipped: testResults.numPendingTests,
      duration: testResults.testResults.reduce((acc, t) => acc + t.duration, 0)
    },
    flakiness: detectFlakyTests(testResults)
  }
}
```

**Step 2: Generate Metrics Report**
```typescript
// scripts/generate-test-report.ts
import { collectMetrics } from './collect-test-metrics'

async function generateReport() {
  const metrics = await collectMetrics()
  
  const report = `
# Test Metrics Report
Generated: ${new Date().toLocaleString()}

## Coverage
- Statements: ${metrics.coverage.statements}%
- Branches: ${metrics.coverage.branches}%
- Functions: ${metrics.coverage.functions}%
- Lines: ${metrics.coverage.lines}%

## Test Results
- Passed: ${metrics.testResults.passed}
- Failed: ${metrics.testResults.failed}
- Duration: ${metrics.testResults.duration}ms

## Flaky Tests
${metrics.flakiness.flakyTests.map(t => `- ${t}`).join('\\n')}
`
  
  fs.writeFileSync('./test-metrics-report.md', report)
}
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: React act() warnings persist
**Solution:**
```typescript
// Use testing-library's waitFor instead of manual promises
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument()
})

// For hooks, use renderHook with proper wrapping
const { result } = renderHook(() => useCustomHook(), {
  wrapper: ({ children }) => <Provider>{children}</Provider>
})
```

#### Issue: Electron tests fail in CI
**Solution:**
```bash
# Ensure proper display setup
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 &

# Use electron-builder test config
npm run test:e2e -- --headed=false
```

#### Issue: Coverage not meeting thresholds
**Solution:**
1. Identify uncovered code: `npm run test:coverage -- --reporter=html`
2. Focus on critical paths first
3. Use coverage comments for legitimate exclusions:
```typescript
/* c8 ignore start */
// Platform-specific code
if (process.platform === 'win32') {
  // Windows-specific implementation
}
/* c8 ignore stop */
```

## Next Steps

1. **Week 1**: Implement critical fixes from sections 2.1 and 2.2
2. **Week 2**: Set up CI/CD optimizations from section 3.1
3. **Week 3**: Begin coverage improvements from section 1
4. **Week 4**: Implement monitoring and metrics
5. **Ongoing**: Follow TDD practices and continuous improvement

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Electron Testing](https://playwright.dev/docs/api/class-electron)
- [React Testing Library Best Practices](https://testing-library.com/docs/react-testing-library/intro/)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)