# Task: TypeScript Type Safety Errors

## Overview

This task addresses critical type safety issues in the TaskMaster UI codebase. These errors represent potential runtime failures and must be fixed to ensure application stability.

## Error Types

### TS7006: Parameter implicitly has an 'any' type
Occurs when function parameters lack type annotations. This bypasses TypeScript's type checking.

### TS2532: Object is possibly 'null' or 'undefined'
Occurs when accessing properties on values that might be null/undefined. Can cause runtime errors.

### TS2345: Argument type is not assignable
Occurs when passing arguments that don't match the expected parameter types.

### TS2322: Type is not assignable
Occurs when assigning values to variables with incompatible types.

## Priority Strategy

1. **High Priority**: Fix TS2532 (null/undefined) - Runtime crash risk
2. **Medium Priority**: Fix TS7006 (implicit any) - Type safety gaps
3. **Low Priority**: Fix TS2345/TS2322 - Type mismatches

## Common Patterns and Fixes

### TS7006: Implicit Any
```typescript
// Before
function handleClick(event) { // TS7006
  console.log(event.target.value);
}

// Fix 1: Add explicit type
function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
  console.log(event.currentTarget.value);
}

// Fix 2: For event handlers in components
const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
  console.log(event.currentTarget.value);
};
```

### TS2532: Null/Undefined Checks
```typescript
// Before
const user = useUser();
console.log(user.name); // TS2532: user might be null

// Fix 1: Optional chaining
console.log(user?.name);

// Fix 2: Null check
if (user) {
  console.log(user.name);
}

// Fix 3: Non-null assertion (use sparingly)
console.log(user!.name); // Only if you're certain it's not null

// Fix 4: Default value
const user = useUser() || { name: 'Guest' };
```

### TS2345/TS2322: Type Assignment Issues
```typescript
// Before
const count: number = "5"; // TS2322

// Fix 1: Correct the type
const count: number = 5;

// Fix 2: Parse the value
const count: number = parseInt("5", 10);

// Fix 3: Update the type annotation
const count: string = "5";
```

## Zustand Store Type Fixes

Many errors occur in Zustand stores. Common patterns:

```typescript
// Before
const useStore = create((set) => ({ // TS7006: set implicitly any
  count: 0,
  increment: () => set((state) => ({ // TS7006: state implicitly any
    count: state.count + 1
  }))
}));

// Fix: Add proper types
interface StoreState {
  count: number;
  increment: () => void;
}

const useStore = create<StoreState>((set) => ({
  count: 0,
  increment: () => set((state) => ({
    count: state.count + 1
  }))
}));
```

## React Component Type Fixes

```typescript
// Before
function TaskCard({ task, onUpdate }) { // TS7006
  return <div>{task.title}</div>;
}

// Fix: Add prop types
interface TaskCardProps {
  task: Task;
  onUpdate: (task: Task) => void;
}

function TaskCard({ task, onUpdate }: TaskCardProps) {
  return <div>{task.title}</div>;
}

// Or with FC type
const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdate }) => {
  return <div>{task.title}</div>;
};
```

## Electron IPC Type Fixes

```typescript
// Before
ipcRenderer.on('update-available', (event, info) => { // TS7006
  console.log(info.version);
});

// Fix: Type the event handler
interface UpdateInfo {
  version: string;
  releaseDate: string;
}

ipcRenderer.on('update-available', (event: IpcRendererEvent, info: UpdateInfo) => {
  console.log(info.version);
});
```

## Testing Strategy

1. Fix errors file by file
2. Run `npm run typecheck` after each file
3. Verify the fix doesn't introduce new errors
4. Test the specific functionality if possible

## Verification Commands

```bash
# Count specific error types
npm run typecheck 2>&1 | grep -c "TS7006"
npm run typecheck 2>&1 | grep -c "TS2532"
npm run typecheck 2>&1 | grep -c "TS2345"
npm run typecheck 2>&1 | grep -c "TS2322"

# Find files with specific errors
npm run typecheck 2>&1 | grep "TS7006" | awk -F: '{print $1}' | sort | uniq
```

## Best Practices

1. **Avoid using `any`** - Use `unknown` if type is truly unknown
2. **Use strict null checks** - Already enabled in tsconfig.json
3. **Prefer type inference** - Don't over-annotate when TypeScript can infer
4. **Use utility types** - `Partial<T>`, `Required<T>`, `Pick<T, K>`, etc.
5. **Type event handlers properly** - Use React's built-in event types

## Success Criteria

- [ ] Zero TS7006 errors (no implicit any)
- [ ] Zero TS2532 errors (null/undefined handled)
- [ ] Zero TS2345 errors (correct argument types)
- [ ] Zero TS2322 errors (correct assignments)
- [ ] All functions have proper return types
- [ ] All event handlers are properly typed
- [ ] Zustand stores have complete type definitions