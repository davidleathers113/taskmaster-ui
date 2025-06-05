# TaskMaster UI - TypeScript Best Practices (2025)

This document outlines TypeScript best practices and standards for the TaskMaster UI project, focusing on maintainability, type safety, and developer experience.

## Table of Contents

- [Configuration](#configuration)
- [Type Safety Standards](#type-safety-standards)
- [Testing Types](#testing-types)
- [Common Patterns](#common-patterns)
- [Error Resolution](#error-resolution)
- [CI/CD Integration](#cicd-integration)

## Configuration

### TypeScript Configuration Files

The project uses multiple TypeScript configuration files for different contexts:

- `tsconfig.json` - Main configuration for renderer process
- `tsconfig.node.json` - Configuration for Node.js/main process
- `server/tsconfig.json` - Configuration for file watcher server

### Strict Mode Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

## Type Safety Standards

### 1. Explicit Type Annotations

**Always provide explicit types for:**
- Function parameters and return types
- Complex object properties
- Generic type parameters

```typescript
// ✅ Good
interface TaskUpdate {
  id: string;
  status: TaskStatus;
  updatedAt: Date;
}

function updateTask(id: string, updates: Partial<TaskUpdate>): Promise<Task> {
  // Implementation
}

// ❌ Avoid
function updateTask(id, updates) {
  // Implementation
}
```

### 2. Null Safety

**Use strict null checks and handle undefined values:**

```typescript
// ✅ Good
function getTaskById(id: string): Task | undefined {
  return tasks.find(task => task.id === id);
}

const task = getTaskById('123');
if (task) {
  console.log(task.title); // Safe access
}

// ❌ Avoid
function getTaskById(id: string): Task {
  return tasks.find(task => task.id === id); // May return undefined
}
```

### 3. Union Types and Type Guards

**Use union types for state and implement type guards:**

```typescript
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

function isLoadingState(state: string): state is LoadingState {
  return ['idle', 'loading', 'success', 'error'].includes(state);
}
```

## Testing Types

### 1. Mock Types

**Define proper mock types for testing:**

```typescript
// mock-types.d.ts
export interface MockAutoUpdater extends AppUpdater {
  checkForUpdates: MockedFunction<() => Promise<UpdateCheckResult | null>>;
  downloadUpdate: MockedFunction<(cancellationToken?: CancellationToken) => Promise<string[]>>;
}
```

### 2. Global Test Types

**Declare global test variables properly:**

```typescript
declare global {
  var mockElectron: {
    app: {
      isReady: ReturnType<typeof vi.fn>;
      whenReady: ReturnType<typeof vi.fn>;
    };
  };
}
```

### 3. Test File Imports

**Always import necessary test utilities:**

```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest';
```

## Common Patterns

### 1. Event Handler Types

```typescript
type EventHandler<T = void> = (event: IpcMainEvent, data: T) => void | Promise<void>;

const handleTaskUpdate: EventHandler<TaskUpdate> = async (event, data) => {
  // Implementation
};
```

### 2. Store Types

```typescript
interface TaskStore {
  tasks: Task[];
  filters: FilterState;
  loading: boolean;
  
  // Actions
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
}
```

### 3. Component Props

```typescript
interface TaskCardProps {
  task: Task;
  onUpdate?: (task: Task) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate, onDelete, className }) => {
  // Implementation
};
```

## Error Resolution

### Common TypeScript Errors and Solutions

#### TS2322: Type is not assignable

**Problem:** Attempting to assign incompatible types
**Solution:** Check type definitions and ensure compatibility

```typescript
// ❌ Error
const result: UpdateCheckResult = {
  updateInfo: mockInfo,
  cancellationToken: null // Should be undefined
};

// ✅ Fixed
const result: UpdateCheckResult = {
  isUpdateAvailable: true,
  updateInfo: mockInfo,
  versionInfo: mockInfo,
  cancellationToken: undefined
};
```

#### TS2349: This expression is not callable

**Problem:** Treating an object as a function
**Solution:** Add proper semicolons and check function definitions

```typescript
// ❌ Error - missing semicolon
const myFunction = () => {
  return value;
}

const myObject = {
  // TypeScript thinks this is calling myFunction
};

// ✅ Fixed
const myFunction = () => {
  return value;
}; // Added semicolon

const myObject = {
  // Now properly recognized as object
};
```

#### TS7017: Element implicitly has 'any' type

**Problem:** Accessing properties on global objects without type declarations
**Solution:** Add proper global type declarations

```typescript
// ❌ Error
global.mockElectron.app.isReady();

// ✅ Fixed - Add declaration
declare global {
  var mockElectron: {
    app: {
      isReady: () => boolean;
    };
  };
}
```

## CI/CD Integration

### GitHub Actions Configuration

The project includes automated type checking in CI/CD:

```yaml
- name: Run TypeScript type checking
  run: npm run typecheck

- name: Run ESLint
  run: npm run lint

- name: Type check server
  run: |
    cd server
    npx tsc --noEmit
```

### Pre-commit Hooks

Configure pre-commit hooks to catch type errors:

```json
{
  "scripts": {
    "pre-commit": "npm run typecheck && npm run lint"
  }
}
```

### IDE Configuration

**Recommended VS Code settings:**

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.inlayHints.parameterNames.enabled": "all",
  "typescript.inlayHints.variableTypes.enabled": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  }
}
```

## Performance Considerations

### 1. Project References

Use project references for large codebases:

```json
{
  "references": [
    { "path": "./src/main" },
    { "path": "./src/preload" },
    { "path": "./src/renderer" },
    { "path": "./server" }
  ]
}
```

### 2. Incremental Compilation

Enable incremental compilation:

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

### 3. Skip Library Checks

For faster builds in CI:

```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

## Maintenance

### Regular Updates

1. Update TypeScript version quarterly
2. Review and update type definitions
3. Run type coverage analysis
4. Monitor and fix new type errors promptly

### Documentation

1. Document complex type definitions
2. Maintain type examples in code comments
3. Update this guide as patterns evolve
4. Share type safety learnings with team

---

**Last Updated:** January 2025  
**Next Review:** April 2025