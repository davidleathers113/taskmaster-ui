# Task: TypeScript Module Resolution Errors

## Overview

This task focuses on resolving TypeScript module resolution errors (TS2307 and TS2484) in the TaskMaster UI codebase. These errors prevent the application from compiling successfully and must be fixed before other TypeScript improvements can be made.

## Error Types

### TS2307: Cannot find module
This error occurs when TypeScript cannot resolve an import statement. Common causes:
- Missing type definitions
- Incorrect import paths
- Missing dependencies
- Incorrect path aliases

### TS2484: Export conflicts
This error occurs when there are conflicting exports or re-exports. Common causes:
- Multiple exports with the same name
- Circular dependencies
- Incorrect re-export syntax

## Approach

1. **Analyze Error Patterns**
   ```bash
   npm run typecheck 2>&1 | grep -E "TS2307|TS2484"
   ```

2. **Common Fixes for TS2307**
   - Check if the module exists in node_modules
   - Verify path aliases in `tsconfig.json` and `electron.vite.config.ts`
   - Add missing type definitions (`@types/*` packages)
   - Fix relative import paths
   - Check for case sensitivity issues

3. **Common Fixes for TS2484**
   - Identify and resolve circular dependencies
   - Use explicit exports instead of `export *`
   - Rename conflicting exports
   - Restructure module organization

## Path Aliases

The project uses these path aliases:
- `@/` → `./src/renderer/src/`
- `@components/` → `./src/renderer/src/components/`
- `@lib/` → `./src/renderer/src/lib/`
- `@hooks/` → `./src/renderer/src/hooks/`
- `@types/` → `./src/renderer/src/types/`
- `@store/` → `./src/renderer/src/store/`

## Priority Order

1. Fix imports in main process (`src/main/`)
2. Fix imports in preload script (`src/preload/`)
3. Fix imports in renderer process (`src/renderer/`)
4. Fix test file imports

## Verification

After each batch of fixes:
1. Run `npm run typecheck` to verify errors are resolved
2. Check that no new errors are introduced
3. Run `npm run lint` to ensure code quality
4. Test that the application still builds: `npm run build`

## Example Fixes

### Missing Type Definitions
```typescript
// Before: TS2307: Cannot find module 'some-library'
import something from 'some-library';

// Fix: Install types
// npm install --save-dev @types/some-library

// Or create ambient declaration
// Create: src/types/some-library.d.ts
declare module 'some-library' {
  const value: any;
  export default value;
}
```

### Path Alias Issues
```typescript
// Before: TS2307: Cannot find module '@/utils/helpers'
import { helper } from '@/utils/helpers';

// Fix: Ensure path exists relative to alias
// Check: src/renderer/src/utils/helpers.ts exists

// Or use relative import
import { helper } from '../utils/helpers';
```

### Export Conflicts
```typescript
// Before: TS2484: Export 'Component' has or is using name 'Props' from external module
export * from './moduleA';
export * from './moduleB'; // Both export 'Props'

// Fix: Use explicit exports
export { ComponentA, type PropsA } from './moduleA';
export { ComponentB, type PropsB } from './moduleB';
```

## Commit Guidelines

Use conventional commits with appropriate scopes:
- `fix(main): resolve module imports in main process`
- `fix(renderer): add missing type definitions`
- `fix(preload): correct path aliases in preload script`
- `fix(types): resolve export conflicts in type definitions`

## Success Criteria

- [ ] All TS2307 errors resolved
- [ ] All TS2484 errors resolved
- [ ] Application compiles without module errors
- [ ] No new TypeScript errors introduced
- [ ] All imports use consistent style
- [ ] Path aliases work correctly