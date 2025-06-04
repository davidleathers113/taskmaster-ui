# TypeScript Fix Implementation Guide

**Quick Start for Immediate Action**

## Step 1: Set Up Mock Infrastructure (30 minutes)

```bash
# Create mock factory directory structure
mkdir -p src/test-utils/mock-factories

# The factory files are already created:
# - src/test-utils/mock-factories/auto-updater.factory.ts
# - src/test-utils/mock-factories/browser-window.factory.ts
# - src/test-utils/mock-factories/index.ts
```

## Step 2: Run Safe Fixes First (1 hour)

### 2.1 Fix Express Handler Returns (TS7030)
```bash
# This fixes ~50 errors without changing behavior
npx ts-node scripts/ts-morph-fixes/fix-express-handlers.ts

# Validate no regressions
./scripts/validate-ts-fixes.sh
```

### 2.2 Add Global Type Declarations
```typescript
// Create src/types/test-globals.d.ts
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

## Step 3: Update Test Files to Use Mock Factories (2 hours)

### Example: Update auto-updater.test.ts
```typescript
// Before (causes test failures)
import { autoUpdater } from 'electron-updater'

vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdates: vi.fn().mockResolvedValue({
      updateInfo: { version: '2.0.0' },
      cancellationToken: null // This causes issues!
    })
  }
}))

// After (using factory)
import { createMockAutoUpdater } from '@/test-utils/mock-factories'

const mockAutoUpdater = createMockAutoUpdater()
vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater
}))
```

## Step 4: Fix Remaining Type Errors (2-3 hours)

### Priority Order:
1. **TS7030** - Missing returns (use fix-express-handlers.ts)
2. **TS2345** - Type mismatches (use mock factories)
3. **TS2554** - Argument counts (add missing args with defaults)
4. **TS2349** - Non-callable (ensure mocks have all methods)
5. **TS2769** - Overload issues (use proper Electron types)

### Validation After Each Batch:
```bash
# Run validation script after each set of fixes
./scripts/validate-ts-fixes.sh --apply-fixes

# If tests regress, check the report
cat scripts/ts-fix-validation/*/validation-report.md
```

## Common Patterns to Fix

### Pattern 1: Null vs Undefined
```typescript
// Problem: Type expects undefined, not null
cancellationToken: null // ❌

// Solution: Use undefined for optional properties
cancellationToken: undefined // ✅
```

### Pattern 2: Missing Mock Properties
```typescript
// Problem: Incomplete mock
const mockResult = { updateInfo: {...} } // ❌

// Solution: Use factory for complete mock
const mockResult = createMockUpdateCheckResult({
  updateInfo: { version: '2.0.0' }
}) // ✅
```

### Pattern 3: Express Handler Returns
```typescript
// Problem: No return statement
app.get('/update', (req, res) => {
  res.json({ version: '2.0.0' }) // ❌
})

// Solution: Add return
app.get('/update', (req, res) => {
  return res.json({ version: '2.0.0' }) // ✅
})
```

## Emergency Rollback

If fixes cause too many regressions:

```bash
# Stash changes
git stash

# Or reset to last commit
git reset --hard HEAD

# Then approach more carefully
# Fix only compilation errors, not test mocks
```

## Success Checklist

- [ ] Mock factories created in `src/test-utils/mock-factories/`
- [ ] Global type declarations added
- [ ] Express handlers have return statements
- [ ] Tests updated to use mock factories
- [ ] TypeScript errors < 100
- [ ] No test regressions (or acceptable trade-off)
- [ ] Validation script passes

## Next Phase

Once TypeScript compiles:
1. Enable stricter TypeScript settings gradually
2. Add type coverage monitoring
3. Set up pre-commit hooks
4. Document patterns for team

## Getting Help

If stuck on specific errors:
1. Check error code in TypeScript docs
2. Use mock factories for complex types
3. Add `as any` temporarily and document for later
4. Focus on compilation over perfection