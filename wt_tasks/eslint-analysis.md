# Task: ESLint Problems Analysis

## Overview

Analyze and categorize 1,887 ESLint problems (1,142 errors + 745 warnings) in the TaskMaster UI codebase. This analysis will prioritize fixes and establish code quality standards.

## Current Status

- Total Problems: 1,887
- Errors: 1,142 (must fix)
- Warnings: 745 (should fix)

## Analysis Approach

### 1. Generate Detailed Report

```bash
# Generate JSON report
npm run lint -- --format json > eslint-report.json

# Generate readable report
npm run lint -- --format stylish > eslint-report.txt

# Count by rule
npm run lint -- --format json | jq '.[] | .messages[].ruleId' | sort | uniq -c | sort -nr
```

### 2. Categorize by Severity

**Errors (Priority 1)**: Must be fixed
- Security vulnerabilities
- Code that won't run
- Critical anti-patterns

**Warnings (Priority 2)**: Should be fixed
- Code style issues
- Best practice violations
- Potential bugs

### 3. Group by Rule Type

Expected categories:
- **Import Issues**: unused imports, import order
- **Variable Issues**: unused vars, undefined vars
- **React Issues**: missing keys, hook violations
- **TypeScript Issues**: any usage, type assertions
- **Style Issues**: quotes, semicolons, spacing
- **Complexity Issues**: cyclomatic complexity

## Common ESLint Rules and Fixes

### @typescript-eslint/no-unused-vars
```typescript
// Before
import { Something } from './module'; // Error: 'Something' is defined but never used

// Fix 1: Remove the import
// Fix 2: Prefix with underscore if intentionally unused
import { Something as _Something } from './module';
```

### @typescript-eslint/no-explicit-any
```typescript
// Before
let data: any = fetchData(); // Error: Unexpected any

// Fix 1: Use proper type
let data: UserData = fetchData();

// Fix 2: Use unknown for truly unknown types
let data: unknown = fetchData();
```

### react/jsx-key
```typescript
// Before
items.map(item => <Item {...item} />); // Error: Missing "key" prop

// Fix
items.map(item => <Item key={item.id} {...item} />);
```

### import/order
```typescript
// Before (wrong order)
import React from 'react';
import { something } from '../utils';
import axios from 'axios';

// Fix (correct order)
import React from 'react';
import axios from 'axios';
import { something } from '../utils';
```

## Automated Fixes

Many ESLint issues can be auto-fixed:

```bash
# Dry run to see what would be fixed
npm run lint -- --fix-dry-run

# Auto-fix safe issues
npm run lint -- --fix

# Fix specific file
npx eslint --fix src/path/to/file.ts
```

## Analysis Output Structure

### eslint-analysis.json
```json
{
  "summary": {
    "total": 1887,
    "errors": 1142,
    "warnings": 745,
    "fixable": 800
  },
  "byRule": [
    {
      "rule": "@typescript-eslint/no-unused-vars",
      "count": 234,
      "severity": "error",
      "fixable": false,
      "category": "variables"
    }
  ],
  "byFile": [
    {
      "file": "src/main/index.ts",
      "errors": 45,
      "warnings": 23
    }
  ],
  "recommendations": {
    "autoFixable": ["import/order", "quotes", "semi"],
    "manualFirst": ["no-unused-vars", "no-explicit-any"],
    "consider-disable": ["max-lines", "complexity"]
  }
}
```

## Fix Strategy

### Phase 1: Automated Fixes
1. Run auto-fix for safe rules
2. Commit changes
3. Re-analyze remaining issues

### Phase 2: High-Impact Manual Fixes
1. Fix security-related errors
2. Fix React hook violations
3. Fix undefined variables

### Phase 3: Code Quality
1. Remove unused imports/variables
2. Replace any with proper types
3. Fix import ordering

### Phase 4: Style Consistency
1. Apply consistent code style
2. Fix formatting issues
3. Standardize naming

## ESLint Configuration Updates

After analysis, consider updating `.eslintrc`:

```javascript
{
  "rules": {
    // Errors that should remain errors
    "no-undef": "error",
    "react-hooks/rules-of-hooks": "error",
    
    // Warnings that might become errors
    "@typescript-eslint/no-explicit-any": "warn", // → "error"
    
    // Rules to potentially disable
    "max-lines": "off", // If files are necessarily large
  }
}
```

## Verification Process

1. Run auto-fix and verify no functionality breaks
2. Test application after each batch of fixes
3. Run TypeScript check to ensure no type errors
4. Update ESLint config based on findings

## Commands Reference

```bash
# Analyze specific directory
npx eslint src/renderer --format json > renderer-lint.json

# Check specific rule violations
npx eslint . --no-eslintrc --rule '{quotes: [2, "single"]}'

# Generate HTML report
npx eslint . --format html > eslint-report.html

# Count problems by type
npm run lint 2>&1 | grep -E "error|warning" | sort | uniq -c
```

## Success Criteria

- [ ] Complete analysis report generated
- [ ] Problems categorized by rule and severity
- [ ] Auto-fixable issues identified
- [ ] Fix priority order established
- [ ] ESLint config improvements documented
- [ ] Team coding standards documented