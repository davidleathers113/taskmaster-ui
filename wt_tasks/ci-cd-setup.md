# Task: CI/CD Type Checking Setup

## Overview

Set up automated type checking in the CI/CD pipeline and document TypeScript best practices for the TaskMaster UI project. This ensures code quality is maintained across all contributions.

## Goals

1. Automate TypeScript type checking in CI
2. Integrate ESLint into CI pipeline
3. Set up test automation
4. Document TypeScript best practices
5. Create pre-commit hooks

## CI/CD Platforms

This guide covers setup for:
- GitHub Actions (primary)
- GitLab CI (alternative)
- Local git hooks

## GitHub Actions Setup

### Basic TypeScript CI Workflow

Create `.github/workflows/typescript-ci.yml`:

```yaml
name: TypeScript CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  typecheck:
    name: TypeScript Type Check
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run TypeScript compiler
      run: npm run typecheck
    
    - name: Upload TypeScript error report
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: typescript-errors
        path: |
          tsconfig.tsbuildinfo
          **/*.ts
          **/*.tsx

  lint:
    name: ESLint Check
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run ESLint
      run: npm run lint -- --format json > eslint-report.json
      continue-on-error: true
    
    - name: Annotate ESLint results
      uses: ataylorme/eslint-annotate-action@v3
      if: always()
      with:
        report-json: eslint-report.json
    
    - name: Upload ESLint report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: eslint-report
        path: eslint-report.json

  test:
    name: Test Suite
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test -- --coverage
    
    - name: Upload coverage
      uses: codecov/codecov-action@v4
      with:
        file: ./coverage/coverage-final.json
        flags: unittests
        name: codecov-umbrella

  build:
    name: Build Check
    runs-on: ubuntu-latest
    needs: [typecheck, lint]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build
    
    - name: Check build output
      run: |
        if [ ! -d "dist" ]; then
          echo "Build failed: dist directory not found"
          exit 1
        fi
```

### Advanced TypeScript Checks

Create `.github/workflows/advanced-typescript.yml`:

```yaml
name: Advanced TypeScript Analysis

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  strict-mode:
    name: Strict Mode Analysis
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run strict TypeScript check
      run: |
        npx tsc --noEmit --strict --skipLibCheck \
          --noUnusedLocals --noUnusedParameters \
          --noImplicitReturns --noFallthroughCasesInSwitch
    
    - name: Check for any types
      run: |
        ! grep -r "any" src/ --include="*.ts" --include="*.tsx" \
          --exclude-dir=node_modules --exclude-dir=".test." || \
          echo "Warning: 'any' types found"
    
    - name: Generate type coverage report
      run: npx type-coverage --detail
```

## Pre-commit Hooks

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# TypeScript check
echo "Running TypeScript check..."
npm run typecheck || {
  echo "TypeScript check failed. Please fix errors before committing."
  exit 1
}

# ESLint check on staged files
echo "Running ESLint..."
npx lint-staged || {
  echo "ESLint check failed. Please fix errors before committing."
  exit 1
}

# Run tests related to changed files
echo "Running affected tests..."
npm test -- --findRelatedTests $(git diff --cached --name-only) || {
  echo "Tests failed. Please fix before committing."
  exit 1
}
```

## Package.json Scripts

Add these scripts:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "typecheck:strict": "tsc --noEmit --strict",
    "lint:ci": "eslint . --format json --output-file eslint-report.json",
    "test:ci": "vitest run --coverage",
    "ci": "npm run typecheck && npm run lint && npm run test:ci",
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

## TypeScript Best Practices Documentation

Create `docs/typescript-best-practices.md`:

```markdown
# TypeScript Best Practices for TaskMaster UI

## Type Safety Rules

1. **No implicit any**
   - Always provide explicit types for function parameters
   - Use `unknown` instead of `any` when type is truly unknown

2. **Strict null checks**
   - Always handle potential null/undefined values
   - Use optional chaining (`?.`) and nullish coalescing (`??`)

3. **Prefer interfaces over type aliases for objects**
   ```typescript
   // Preferred
   interface User {
     id: string;
     name: string;
   }
   
   // Avoid for objects
   type User = {
     id: string;
     name: string;
   };
   ```

4. **Use const assertions**
   ```typescript
   const config = {
     api: 'https://api.example.com',
     timeout: 5000
   } as const;
   ```

5. **Leverage type inference**
   ```typescript
   // Don't over-annotate
   const name: string = "John"; // Unnecessary
   const name = "John"; // Better
   ```

## React + TypeScript Patterns

1. **Component props**
   ```typescript
   interface ButtonProps {
     onClick: () => void;
     children: React.ReactNode;
     variant?: 'primary' | 'secondary';
   }
   ```

2. **Event handlers**
   ```typescript
   const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
     // ...
   };
   ```

3. **Custom hooks**
   ```typescript
   function useCounter(initial = 0): [number, () => void, () => void] {
     // ...
   }
   ```

## Electron + TypeScript

1. **IPC typing**
   ```typescript
   // preload.d.ts
   interface IElectronAPI {
     sendMessage: (channel: string, data: unknown) => void;
     onMessage: (channel: string, func: Function) => void;
   }
   
   declare global {
     interface Window {
       electronAPI: IElectronAPI;
     }
   }
   ```

2. **Main/Renderer separation**
   - Keep types in shared location
   - Use type-only imports where possible
```

## Monitoring and Reporting

### Type Coverage Goals

- Minimum 95% type coverage
- Zero `any` types in new code
- All functions have explicit return types
- All event handlers properly typed

### Metrics Dashboard

Create a simple metrics script:

```bash
#!/bin/bash
# scripts/type-metrics.sh

echo "TypeScript Metrics Report"
echo "========================"
echo ""

# Count TypeScript errors
TS_ERRORS=$(npm run typecheck 2>&1 | grep -c "error TS" || echo 0)
echo "TypeScript Errors: $TS_ERRORS"

# Count any types
ANY_COUNT=$(grep -r ": any" src/ --include="*.ts" --include="*.tsx" | wc -l)
echo "Explicit 'any' usage: $ANY_COUNT"

# Type coverage
echo ""
echo "Type Coverage:"
npx type-coverage --summary

# File count
TS_FILES=$(find src -name "*.ts" -o -name "*.tsx" | wc -l)
echo ""
echo "TypeScript files: $TS_FILES"
```

## Success Criteria

- [ ] GitHub Actions workflow created and passing
- [ ] Pre-commit hooks installed and working
- [ ] TypeScript best practices documented
- [ ] Type coverage reporting enabled
- [ ] All CI checks passing on main branch
- [ ] Documentation reviewed and approved