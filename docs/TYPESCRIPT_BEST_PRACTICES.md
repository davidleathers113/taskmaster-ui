# TaskMaster UI – TypeScript Best Practices (2025 Edition)

> **Purpose**  A living reference for every engineer working on **TaskMaster UI**. Follow these guidelines to write modern, safe, and performant TypeScript while keeping developer experience stellar.
>
> Target stack: **TypeScript ≥ 5.4**, **React 18**, **Vite / Electron‑Vite**, **Node 20**, **Vitest**.

---

## Table of Contents

1. [Configuration](#configuration)
2. [Type Definitions](#type-definitions)
3. [Interfaces vs Type Aliases](#interfaces-vs-type-aliases)
4. [Generics](#generics)
5. [Strict Nullability](#strict-nullability)
6. [Module Patterns](#module-patterns)
7. [Advanced Type Patterns](#advanced-type-patterns)
8. [Common Pitfalls & Remedies](#common-pitfalls--remedies)
9. [Testing Types](#testing-types)
10. [Error Resolution Cheatsheet](#error-resolution-cheatsheet)
11. [CI/CD & Developer Tooling](#cicd--developer-tooling)
12. [Performance Tips](#performance-tips)
13. [Best‑Practices Checklist](#best-practices-checklist)
14. [Maintenance & Governance](#maintenance--governance)

---

## Configuration

### tsconfig layout

| File                   | Purpose                    |
| ---------------------- | -------------------------- |
| `tsconfig.json`        | Renderer (React)           |
| `tsconfig.node.json`   | Main & Preload scripts     |
| `server/tsconfig.json` | File‑watcher micro‑service |

All three extend a shared base **`configs/tsconfig.base.json`** to avoid drift.

```jsonc
// configs/tsconfig.base.json
{
  "compilerOptions": {
    /* Strictness */
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    /* Code‑quality */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true,

    /* Module system */
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,

    /* Build targets */
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,

    /* Performance */
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  },
  "include": ["src", "types"],
  "references": [{ "path": "./server" }]
}
```

### ESLint / Biome / Oxlint

- **Biome** replaces Prettier for formatting.
- **@typescript-eslint** + custom plugin rules are enforced in CI.
- **Oxlint** (Rust) runs locally via `npm run lint:fast` for instant feedback.

### Vitest type‑checking

Add `vitest --coverage` to ensure test code follows same strictness.

---

## Type Definitions

### Explicit annotations

Always annotate **function parameters**, **return types**, complex **object literals**, **event handlers**, and **generic type parameters**.

```ts
interface TaskUpdate {
  id: TaskId;
  status: TaskStatus;
  updatedAt: string;
}

function updateTask(id: TaskId, updates: Partial<TaskUpdate>): Promise<Task> {
  return api.updateTask(id, updates);
}
```

### Index signatures & `noUncheckedIndexedAccess`

```ts
interface TaskMap {
  [taskId: TaskId]: Task;
}

const map: TaskMap = {} as TaskMap;
const maybeTask = map["123" as TaskId]; // Task | undefined
```

---

## Interfaces vs Type Aliases

- Use **interfaces** for **object shapes** you expect to extend.
- Use **type aliases** for **unions, intersections, branded & conditional types**.

```ts
interface Task {
  id: TaskId;
  title: string;
  status: TaskStatus;
}

type TaskStatus =
  | "pending"
  | "in‑progress"
  | "done"
  | "review"
  | "deferred"
  | "cancelled";
```

> **Why not enums?** Union literals are tree‑shakeable and generate no runtime code.

---

## Generics

### Generic helpers

```ts
function findById<T extends { id: string | number }>(
  items: T[],
  id: T["id"]
): T | undefined {
  return items.find((item) => item.id === id);
}
```

### Generic React components

```tsx
interface ListProps<T> {
  items: readonly T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string | number;
  onItemClick?: (item: T) => void;
}

function List<T>({
  items,
  renderItem,
  keyExtractor,
  onItemClick,
}: ListProps<T>) {
  return (
    <ul>
      {items.map((item) => (
        <li key={keyExtractor(item)} onClick={() => onItemClick?.(item)}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
```

---

## Strict Nullability

- Prefer **optional chaining** (`?.`) and **nullish coalescing** (`??`).
- Use **type guards** or **`asserts` functions** to narrow unknown/nullable values.
- Non‑null assertion (`!`) is allowed only after an explicit guard.

```ts
function isTask(x: unknown): x is Task {
  return typeof x === "object" && x !== null && "id" in x;
}
```

---

## Module Patterns

### ES modules, barrel files & path aliases

- Named exports for utilities; default export only for React components.
- Barrel files live under `src/**/index.ts`.
- All imports use `@/*` or other Vite aliases—never relative paths that traverse more than two levels (`../../..`).

### Module augmentation examples

```ts
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}
```

---

## Advanced Type Patterns

| Pattern                  | Example                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| **Branded types**        | `type TaskId = Brand<string, 'TaskId'>`                                                    |
| **Template literals**    | \`\`type APIEndpoint<T extends string> = \`api/\${T}\`\`\`                                 |
| **Satisfies operator**   | `const TASK_STATUS = { pending: 'pending' } as const satisfies Record<string, TaskStatus>` |
| **Mapped & conditional** | `type NullableKeys<T> = { [K in keyof T]: null extends T[K] ? K : never }[keyof T]`        |

> **Tip**  Prefer branded strings over raw `number` ids; they prevent accidental mix‑ups.

---

## Common Pitfalls & Remedies

| Pitfall                                               | Remedy                                                  |
| ----------------------------------------------------- | ------------------------------------------------------- |
| Missing semicolons → ASI surprises                    | Always end statements with `;` – lint rule enforced     |
| _as_ assertions                                       | Replace with **type guards** or **generic constraints** |
| Implicit `any` in catch blocks                        | `catch (err: unknown)` and narrow                       |
| Enum runtime cost                                     | Use **union literals** + `as const` objects             |
| Forgotten null checks with `noUncheckedIndexedAccess` | Guard or default value (`??`)                           |

---

## Testing Types

- **Vitest** + `@vitest/spy` mocks Typed APIs.
- Re‑export `MockedFunction` & `MockedClass` helpers in `types/test‑mocks.d.ts`.

---

## Error Resolution Cheatsheet

| Code   | Meaning              | Quick Fix                                                    |
| ------ | -------------------- | ------------------------------------------------------------ |
| TS2307 | Module not found     | Check path aliases / `paths` in tsconfig                     |
| TS2322 | Type not assignable  | Ensure types line up – enable `strictFunctionTypes`          |
| TS7053 | Implicit `any` index | Turn value into `Record<string, unknown>` or guard undefined |

---

## CI/CD & Developer Tooling

- GitHub Actions `typecheck.yml` runs **type‑checking + ESLint** in parallel.
- **Husky** pre‑commit hook runs `lint‑staged`: `eslint --fix` then `pnpm typecheck`.
- **pnpm** is the canonical package manager; `npm` will work but is slower.

```yaml
# .github/workflows/typecheck.yml
name: TypeScript CI
on: [push, pull_request]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Install deps
        run: pnpm i --frozen-lockfile
      - name: Type‑check
        run: pnpm typecheck
      - name: Lint
        run: pnpm lint
```

---

## Performance Tips

- **Incremental builds** and **composite** projects speed up IDE feedback.
- Increase `typescript.tsserver.maxTsServerMemory` to `4096` in VS Code.
- Run **Oxlint** in watch mode (`pnpm lint:fast`) for sub‑100 ms feedback.

---

## Best‑Practices Checklist

1. **Strict mode everywhere**
2. **Prefer interfaces** for extensible object shapes
3. **Union literals > enums**
4. **Handle `undefined` with `noUncheckedIndexedAccess`**
5. **Write reusable generics & hooks**
6. **Use branded types for domain ids**
7. **Leverage template literal & satisfies types**
8. **Never rely on implicit any / assertions**
9. **JSDoc complex generics** so IDEs surface intent
10. **Update this guide quarterly** – see Governance

---

## Maintenance & Governance

| Cadence   | Task                                                             |
| --------- | ---------------------------------------------------------------- |
| Quarterly | Bump TypeScript & React versions; update ESLint configs          |
| Monthly   | Run `typescript‑coverage‑report` and aim for > 95 %              |
| CI        | Fails if `pnpm lint` or `pnpm typecheck` exceed 30 s             |
| Sync      | Share new patterns during the fortnightly frontend guild meeting |

_Last updated: **June 2025** – Maintainer: Frontend Platform Team_
