# TypeScript Error Resolution Strategy

**Project**: taskmaster-ui  
**Date**: June 4, 2025  
**Current State**: 375 TypeScript errors, 18 test regressions after initial fixes

## Executive Summary

This document provides a systematic approach to resolving TypeScript errors while preventing test regressions. The strategy emphasizes compilation fixes without changing runtime behavior, using AST-based tools (ts-morph) exclusively, and implementing proper mock patterns.

## Current Error Distribution

### By Error Code (375 total)
1. **TS2345**: Type assignment mismatches (~100 errors)
   - Nullable type issues
   - Interface property mismatches
   - Mock object incomplete implementations

2. **TS2554**: Argument count mismatches (~80 errors)
   - Missing required function arguments
   - Extra arguments in function calls
   - Mock function signature mismatches

3. **TS2349**: Non-callable expressions (~60 errors)
   - Attempting to call non-function types
   - Missing method implementations
   - Incorrect mock setups

4. **TS7030**: Not all code paths return value (~50 errors)
   - Missing return statements in Express handlers
   - Incomplete conditional logic
   - Async function return issues

5. **TS2769**: No overload matches call (~40 errors)
   - Electron API mock mismatches
   - Event emitter type issues
   - Complex generic type problems

6. **Other**: Various type safety issues (~45 errors)
   - Implicit any types
   - Missing type declarations
   - Module resolution problems

## Problem Areas Analysis

### 1. Mock Update Server (High Priority)
**Files**: `tests/mocks/mock-update-server.ts`
- Express route handlers missing return statements
- Type mismatches in request/response handling
- Incomplete error simulation logic

### 2. Auto-updater Tests (Critical)
**Files**: `src/main/__tests__/auto-updater*.test.ts`
- Complex mock type mismatches with electron-updater
- UpdateCheckResult interface incomplete
- Event emitter mock type issues

### 3. IPC Communication (Medium Priority)
**Files**: `src/main/ipc-handlers.ts`, related tests
- Handler type definitions incomplete
- Missing type safety for IPC channels
- Inconsistent event typing

### 4. Window Management (Medium Priority)
**Files**: `src/main/window-manager.ts`, related tests
- BaseWindow mock complexity
- BrowserWindow type mismatches
- Window state management types

## Resolution Strategy

### Phase 1: Safe Compilation Fixes (Immediate)

#### 1.1 Create Mock Factory System
```typescript
// src/test-utils/mock-factories/auto-updater.factory.ts
import { vi } from 'vitest'
import type { UpdateCheckResult, UpdateInfo } from 'electron-updater'

export interface MockUpdateInfo extends UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

export interface MockUpdateCheckResult extends UpdateCheckResult {
  updateInfo: MockUpdateInfo
  cancellationToken?: any
}

export const createMockUpdateCheckResult = (
  overrides?: Partial<MockUpdateCheckResult>
): MockUpdateCheckResult => ({
  updateInfo: {
    version: '1.0.0',
    releaseDate: new Date().toISOString(),
    releaseNotes: 'Test release',
    ...overrides?.updateInfo
  },
  cancellationToken: undefined,
  ...overrides
})

export const createMockAutoUpdater = () => ({
  checkForUpdates: vi.fn().mockResolvedValue(createMockUpdateCheckResult()),
  downloadUpdate: vi.fn().mockResolvedValue(undefined),
  quitAndInstall: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  // Add all required methods with proper types
})
```

#### 1.2 Fix Express Handler Returns (TS7030)
```typescript
// Use ts-morph to add return statements
import { Project } from 'ts-morph'

const project = new Project({
  tsConfigFilePath: './tsconfig.json'
})

const sourceFile = project.getSourceFileOrThrow('tests/mocks/mock-update-server.ts')

// Find all arrow functions in route handlers
sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction).forEach(func => {
  const parent = func.getParent()
  if (parent?.getKindName() === 'CallExpression') {
    const body = func.getBody()
    if (body?.getKindName() === 'Block') {
      const statements = body.getStatements()
      const lastStatement = statements[statements.length - 1]
      
      // Check if last statement is a response call without return
      if (lastStatement?.getText().includes('res.') && 
          !lastStatement.getText().startsWith('return')) {
        lastStatement.replaceWithText(`return ${lastStatement.getText()}`)
      }
    }
  }
})

await sourceFile.save()
```

#### 1.3 Type Declaration Additions
```typescript
// Create global type declarations file
// src/types/test-globals.d.ts
declare global {
  const vi: typeof import('vitest').vi
  
  interface Window {
    electronAPI?: any
    taskmaster?: any
  }
  
  namespace NodeJS {
    interface Global {
      __mockElectron?: any
      __electron?: any
    }
  }
}

export {}
```

### Phase 2: Mock System Overhaul (Week 1)

#### 2.1 Centralized Mock Utilities
```typescript
// src/test-utils/electron-mocks/index.ts
export * from './auto-updater.mock'
export * from './browser-window.mock'
export * from './ipc-main.mock'
export * from './dialog.mock'

// Each mock file follows factory pattern
// Example: browser-window.mock.ts
import { vi } from 'vitest'
import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'

export class MockBrowserWindow {
  private static instances: MockBrowserWindow[] = []
  
  constructor(options?: BrowserWindowConstructorOptions) {
    MockBrowserWindow.instances.push(this)
  }
  
  static getAllWindows(): MockBrowserWindow[] {
    return MockBrowserWindow.instances
  }
  
  static resetInstances(): void {
    MockBrowserWindow.instances = []
  }
  
  // Implement all required BrowserWindow methods
  loadURL = vi.fn().mockResolvedValue(undefined)
  show = vi.fn()
  hide = vi.fn()
  close = vi.fn()
  destroy = vi.fn()
  isDestroyed = vi.fn().mockReturnValue(false)
  // ... etc
}
```

#### 2.2 Test Refactoring Pattern
```typescript
// Before: Tightly coupled to mock structure
test('should check for updates', async () => {
  const result = await autoUpdater.checkForUpdates()
  expect(result.updateInfo.version).toBe('2.0.0')
  expect(result.cancellationToken).toBe(null) // Fails after type fix
})

// After: Behavior-focused testing
test('should check for updates', async () => {
  const mockResult = createMockUpdateCheckResult({
    updateInfo: { version: '2.0.0' }
  })
  
  vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue(mockResult)
  
  const result = await autoUpdater.checkForUpdates()
  expect(result.updateInfo.version).toBe('2.0.0')
  // Don't test implementation details like cancellationToken
})
```

### Phase 3: Systematic Error Resolution (Week 2)

#### 3.1 Priority Order
1. **Build-blocking errors first**
   - Fix TS7030 (missing returns) in all Express handlers
   - Resolve TS2307 (module not found) issues
   - Address TS2345 in critical paths

2. **Test infrastructure second**
   - Implement mock factories for all Electron APIs
   - Fix test setup files with proper types
   - Resolve mock type mismatches

3. **Application code third**
   - Fix remaining TS2345/TS2554 in components
   - Address TS2769 overload issues
   - Clean up implicit any types

#### 3.2 Validation Approach
```bash
# Create validation script
#!/bin/bash
# validate-ts-fixes.sh

echo "Running TypeScript compilation check..."
npm run typecheck > ts-errors-before.log 2>&1
ERRORS_BEFORE=$(grep -c "error TS" ts-errors-before.log || echo "0")

echo "Running tests before fixes..."
npm test > test-results-before.log 2>&1
TESTS_BEFORE=$(grep -E "(passed|failed)" test-results-before.log)

# Apply fixes here

echo "Validating after fixes..."
npm run typecheck > ts-errors-after.log 2>&1
ERRORS_AFTER=$(grep -c "error TS" ts-errors-after.log || echo "0")

npm test > test-results-after.log 2>&1
TESTS_AFTER=$(grep -E "(passed|failed)" test-results-after.log)

echo "Results:"
echo "TypeScript errors: $ERRORS_BEFORE -> $ERRORS_AFTER"
echo "Test results before: $TESTS_BEFORE"
echo "Test results after: $TESTS_AFTER"

# Fail if tests regressed
if [[ "$TESTS_AFTER" < "$TESTS_BEFORE" ]]; then
  echo "ERROR: Test regressions detected!"
  exit 1
fi
```

### Phase 4: Long-term Improvements (Month 1)

#### 4.1 Type Safety Infrastructure
1. **Strict TypeScript Configuration**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "strictFunctionTypes": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "noImplicitReturns": true,
       "noFallthroughCasesInSwitch": true
     }
   }
   ```

2. **Type Coverage Monitoring**
   ```bash
   # Add to package.json scripts
   "type-coverage": "type-coverage --detail --show-relative"
   ```

3. **Pre-commit Hooks**
   ```json
   // .husky/pre-commit
   npm run typecheck || exit 1
   npm run lint:fix
   ```

#### 4.2 Documentation and Training
1. Create type annotation guidelines
2. Document mock pattern best practices
3. Establish code review checklist for types

## Success Metrics

### Immediate (24-48 hours)
- [ ] TypeScript errors < 300 (20% reduction)
- [ ] No new test regressions
- [ ] Mock factory system implemented

### Short-term (Week 1)
- [ ] TypeScript errors < 100 (75% reduction)
- [ ] Test pass rate > 70% (restoration)
- [ ] All critical paths compile

### Medium-term (Week 2)
- [ ] TypeScript errors = 0
- [ ] Test pass rate > 85%
- [ ] Type coverage > 90%

### Long-term (Month 1)
- [ ] Strict mode enabled
- [ ] 100% type coverage in new code
- [ ] Automated type checking in CI/CD

## Risk Mitigation

### Preventing Test Regressions
1. **Never change mock return values** without updating tests
2. **Use factory functions** for consistent mock creation
3. **Test behavior, not implementation**
4. **Run validation script** after each batch of fixes

### Handling Complex Types
1. **Start with `unknown`** then narrow types
2. **Use type assertions sparingly** and document why
3. **Create type guards** for runtime validation
4. **Leverage TypeScript inference** where possible

## Implementation Checklist

### Week 1: Foundation
- [ ] Create `src/test-utils/` directory structure
- [ ] Implement mock factories for Electron APIs
- [ ] Fix all TS7030 errors (missing returns)
- [ ] Add global type declarations
- [ ] Set up validation scripts

### Week 2: Resolution
- [ ] Fix remaining TS2345 errors (type mismatches)
- [ ] Resolve TS2554 errors (argument counts)
- [ ] Address TS2349 errors (non-callable)
- [ ] Clean up TS2769 errors (overloads)
- [ ] Achieve 0 TypeScript errors

### Week 3: Stabilization
- [ ] Refactor tests to use mock factories
- [ ] Improve test isolation
- [ ] Add type coverage monitoring
- [ ] Document patterns and decisions

### Week 4: Automation
- [ ] Enable strict TypeScript mode
- [ ] Set up pre-commit hooks
- [ ] Integrate with CI/CD pipeline
- [ ] Create team guidelines

## Conclusion

This strategy prioritizes getting the project to compile while maintaining test stability. By using mock factories and focusing on compilation-only fixes, we can resolve TypeScript errors without introducing runtime behavior changes. The phased approach allows for incremental progress with validation at each step.

The key to success is separating compilation fixes from behavioral changes, using proper tooling (ts-morph), and maintaining a clear separation between production code types and test mock types.