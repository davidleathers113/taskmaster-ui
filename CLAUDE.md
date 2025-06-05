# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- Build: `npm run build`
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Development server: `npm run dev`
- Start all services: `npm run start:all` (UI + file watcher server)

### Electron App
- Development mode: `npm run start:dev` or `./run-dev.sh`
- Production mode: `npm run start:prod` or `./run-app.sh`
- Package app: `npm run package`
- Make distributable: `npm run make`

### Server Operations
- Install server deps: `npm run server:install`
- Start server dev: `npm run server:dev`
- Start server prod: `npm run server:start`

### Testing Commands
- All tests: `npm test` or `npm run test` (Playwright E2E)
- E2E tests: `npm run test:e2e`
- Visual tests: `npm run test:visual`
- Performance tests: `npm run test:performance`
- Accessibility tests: `npm run test:accessibility`
- Interactive test UI: `npm run test:ui`
- Debug mode: `npm run test:debug`
- Headed mode: `npm run test:headed`
- Test report: `npm run test:report`

### Memory & Performance Testing
- Memory leak tests: `npm run test:memory`
- Detailed memory tests: `npm run test:memory:detailed`
- Performance benchmarks: `npm run test:benchmark`
- MemLab scenarios: `npm run memlab:all`
- Individual scenarios: `npm run memlab:task-operations`, `npm run memlab:view-switching`, `npm run memlab:extended-usage`

### Security Testing
- Security audit: `npm run test:security:full`
- Dependency vulnerabilities: `npm run test:security:deps`
- CSP validation: `npm run test:security:csp`
- Electron security: `npm run test:security:electron`
- Security baseline: `npm run test:security:baseline`

### Setup Commands
- Full setup: `npm run setup` (installs UI + server dependencies)
- Security audit: `npm run security:audit`
- CI validation: `npm run ci:validate`
- Complete CI test suite: `npm run test:ci`

## Architecture Overview

### Multi-Process Electron Application
- **Main Process**: `src/main/index.ts` - Handles app lifecycle, window management
- **Renderer Process**: React app in `src/renderer/` - The UI that users interact with
- **Preload Script**: `src/preload/index.ts` - Secure IPC bridge between main and renderer
- **File Watcher Server**: Separate Node.js server in `server/` for real-time file monitoring

### Core Technologies
- **React 18** with Framer Motion for animations
- **TypeScript** with strict configuration
- **Zustand** for state management (not Redux)
- **Tailwind CSS** with custom design system
- **electron-vite** for unified Electron development
- **WebSockets** for real-time file watching
- **Playwright** for comprehensive E2E testing
- **ApexCharts** for analytics visualization

### State Management (Zustand)
The main store is `src/renderer/src/store/useTaskStore.ts`:
- Manages all task data, filters, view modes, user settings
- Uses computed getters for filtered data
- Generates analytics automatically when tasks change
- Provides bulk operations for efficiency

### Component Architecture
```
src/renderer/src/
├── components/
│   ├── layout/           # Sidebar, Header, MainContent
│   ├── task/            # TaskCard, TaskDetailPanel
│   ├── views/           # TaskListView, KanbanView, AnalyticsView, CalendarView, TimelineView
│   ├── ui/              # CommandPalette, VirtualizedList, EmptyState
│   ├── project/         # ProjectManager, ProjectDiscovery
│   ├── claude/          # Claude configuration components
│   ├── error/           # ErrorBoundary components
│   └── examples/        # AdvancedTypesExample
├── hooks/               # Custom React hooks for reusable logic
├── lib/                 # Utilities, services, and advanced types
├── store/               # Zustand state management
├── types/               # TypeScript type definitions
└── styles/              # Global CSS and styling
```

### File Watching System
- **Server**: `server/file-watcher.ts` - Node.js server with TypeScript
- **Purpose**: Watches `tasks/tasks.json` files in project directories
- **Communication**: WebSocket connection to UI for real-time updates
- **Security**: Rate limiting, CORS, Helmet security headers

### Design System
- **Glass Morphism**: Backdrop blur effects throughout UI
- **Spring Animations**: Physics-based motion using Framer Motion
- **Multi-View System**: List, Kanban, Analytics, Calendar, Timeline views
- **Command Palette**: ⌘K powered interface for power users

## Key Patterns and Conventions

### Import Aliases
Use configured path aliases in `electron.vite.config.ts`:
- `@/` → `./src/renderer/src/`
- `@components/` → `./src/renderer/src/components/`
- `@lib/` → `./src/renderer/src/lib/`
- `@hooks/` → `./src/renderer/src/hooks/`
- `@types/` → `./src/renderer/src/types/`
- `@store/` → `./src/renderer/src/store/`

### Animation Philosophy
- All animations use Framer Motion with spring physics
- Staggered animations for lists and collections
- Respect user's reduced motion preferences
- 60fps target for all interactions

### Security Implementation
- Context isolation enabled in Electron
- Node integration disabled in renderer
- Secure IPC via contextBridge
- CSP headers in Vite config
- Input validation using Zod schemas

### State Management Rules
- Use Zustand store for global state
- Computed values via store getters
- Avoid prop drilling - use store selectors
- Update analytics automatically on state changes

## Development Workflow

### Adding New Features
1. Create types in `src/renderer/src/types/`
2. Add store actions if needed in `useTaskStore.ts`
3. Build components in appropriate `components/` subdirectory
4. Use existing design system classes and animations
5. Add to view components if applicable

### Testing Real-Time Features
1. Start both UI and server: `npm run start:all`
2. Add project directory via Project Manager UI
3. Edit `tasks/tasks.json` files to see live updates
4. Verify WebSocket connection in browser dev tools

### Electron-Specific Considerations
- Use `npm run start:dev` for development with hot reload
- Use `npm run start:prod` to test production builds
- Main process logs appear in terminal, renderer logs in DevTools
- IPC communication must go through preload script

## Project Structure Notes

### Multi-Project Support
The app can watch multiple project directories simultaneously:
- Each project must have `tasks/tasks.json` file
- Projects are managed via `ProjectManager` component
- File watcher server monitors all registered projects
- UI updates in real-time when any project's tasks change

### Task Data Format
Tasks follow the TaskMaster format with:
- Main task properties (id, title, description, status, priority)
- Subtasks array for hierarchical organization
- Dependencies for task relationships
- Automatic timestamps for created/updated dates

### Build System (electron-vite)
The project uses **electron-vite** for unified development across all Electron processes:
- **Configuration**: `electron.vite.config.ts` - Main configuration file
- **Development**: `npm run dev` - Starts all processes with hot reload
- **Building**: `npm run build` - Builds all processes for production
- **Preview**: `npm run preview` - Preview built application

### Known Issues
- Single instance lock may require killing processes between runs
- File watcher requires Node.js 18+ for optimal performance
- Use shell scripts (`./run-dev.sh`, `./run-app.sh`) for reliable Electron startup

## CRITICAL CODE MODIFICATION STANDARDS

**ABSOLUTELY FORBIDDEN**: Using regex (regular expressions) to modify any code files. This is a HUGE violation of coding standards.

**REQUIRED APPROACH**: When modifying TypeScript/JavaScript code:
- Use AST-based tools like ts-morph, babel, or TypeScript compiler API
- Use proper parsing and manipulation libraries
- For simple text processing, use string methods but NEVER regex replacements on code

**PARSING vs MODIFICATION**:
- Regex is acceptable for PARSING error messages or log output
- Regex is NEVER acceptable for MODIFYING source code files
- Always use proper AST manipulation for code changes

**EXAMPLES**:
- ✅ GOOD: Using ts-morph to remove unused imports
- ✅ GOOD: Using regex to parse TypeScript error messages  
- ❌ BAD: Using regex to remove code lines or modify imports
- ❌ BAD: String replacement on source code files

## TYPESCRIPT DISCOVERIES AND KNOWN ISSUES

### String/Number Constructor Anomalies (TS2349)

**Issue**: TypeScript may report mysterious "Type 'String' has no call signatures" or "Type 'Number' has no call signatures" errors when using inline type assertions like `(autoUpdater as any).property = value`.

**Root Cause**: TypeScript's parser can get confused by inline type assertions followed by property access, especially in test files with complex mock setups.

**Solutions**:
1. **Use typed references instead of inline assertions**:
   ```typescript
   // ❌ BAD - can cause parser confusion
   (autoUpdater as any).channel = 'beta'
   
   // ✅ GOOD - clear type assertion
   const mockUpdater = autoUpdater as MockAutoUpdater
   mockUpdater.channel = 'beta'
   ```

2. **Add explicit type annotations to prevent inference issues**:
   ```typescript
   // ❌ BAD - TypeScript might misinterpret
   let callCount = 0
   
   // ✅ GOOD - explicit type
   let callCount: number = 0
   ```

3. **Use type assertions after array literals**:
   ```typescript
   // ❌ BAD - inline type annotation can confuse parser
   const mockWindows: Array<{ id: number }> = [...]
   
   // ✅ GOOD - type assertion after literal
   const mockWindows = [...] as Array<{ id: number }>
   ```

4. **Fix ES module imports**:
   ```typescript
   // ❌ BAD - old CommonJS style
   import * as express from 'express'
   
   // ✅ GOOD - ES module default import
   import express from 'express'
   ```

**When to Apply**: If you see TS2349 errors claiming String, Number, or other built-in types "have no call signatures", look for inline type assertions and refactor them.

## MANDATORY GIT WORKFLOW PRACTICES

**CRITICAL**: You MUST follow these Git workflow practices without exception. These are NOT optional guidelines - they are strict requirements for all development work.

### 1. BRANCH MANAGEMENT (MANDATORY)

**NEVER work directly on main/master branch**. You MUST:
1. Always create a feature branch BEFORE making any changes
2. Use descriptive branch names following this pattern:
   - `feature/<description>` for new features (e.g., `feature/add-user-authentication`)
   - `fix/<issue-or-description>` for bug fixes (e.g., `fix/memory-leak-in-renderer`)
   - `refactor/<description>` for code refactoring
   - `docs/<description>` for documentation updates
   - `test/<description>` for test additions/updates
   - `chore/<description>` for maintenance tasks

**Branch Creation Commands**:
```bash
# Always check current branch first
git branch --show-current

# Create and switch to new feature branch
git checkout -b feature/descriptive-feature-name

# For fixes
git checkout -b fix/issue-description
```

### 2. COMMIT FREQUENCY AND STANDARDS (MANDATORY)

**You MUST commit changes regularly**:
- Commit after each logical unit of work (e.g., implementing a function, fixing a bug, adding a test)
- NEVER accumulate more than 50-100 lines of changes without committing
- Each commit should be atomic and focused on a single change

**Conventional Commit Format (REQUIRED)**:
```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**Allowed Types**:
- `feat`: New feature (correlates with MINOR in semantic versioning)
- `fix`: Bug fix (correlates with PATCH in semantic versioning)
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, missing semi-colons, etc)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes to build system or dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

**Breaking Changes**:
- Add `!` after type/scope for breaking changes: `feat!: remove deprecated API`
- OR include `BREAKING CHANGE:` in the footer

**Examples**:
```bash
git commit -m "feat(renderer): add dark mode toggle to settings"
git commit -m "fix(main): resolve memory leak in window management"
git commit -m "docs: update README with new build instructions"
git commit -m "feat!: migrate to new config format

BREAKING CHANGE: config files must be updated to v2 format"
```

### 3. COMMIT WORKFLOW (MANDATORY STEPS)

**Before EVERY commit, you MUST**:
1. Check git status: `git status`
2. Review changes: `git diff`
3. Stage specific files (avoid `git add .`): `git add <specific-files>`
4. Run linting: `npm run lint`
5. Run type checking: `npm run typecheck`
6. Run relevant tests
7. Make the commit with conventional format

**Commit Checklist Script**:
```bash
# Run this before committing
git status
npm run lint
npm run typecheck
git diff --staged
# Then commit with conventional format
```

### 4. PULL REQUEST WORKFLOW (MANDATORY)

**You MUST create a Pull Request for ALL changes**:
1. Push your feature branch: `git push -u origin feature/your-feature`
2. Create PR immediately using GitHub CLI:
```bash
gh pr create --title "feat: add new feature" --body "$(cat <<'EOF'
## Summary
- Added new feature X
- Improved performance of Y
- Fixed bug in Z

## Test Plan
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed
- [ ] No console errors

## Screenshots
[If applicable]

🤖 Generated with Claude Code
EOF
)"
```

### 5. AUTOMATED COMMIT SCHEDULE

**You MUST commit at these checkpoints**:
1. After implementing each function/method
2. After fixing each bug
3. After adding/updating tests
4. After refactoring a component/module
5. Before switching context to a different feature/file
6. At least every 30 minutes during active development
7. Before running any destructive commands (rebases, merges, etc.)

### 6. GIT WORKFLOW COMMANDS REFERENCE

```bash
# Start new work
git checkout main
git pull origin main
git checkout -b feature/new-feature

# Regular commit workflow
git status
git add src/specific/file.ts
npm run lint && npm run typecheck
git commit -m "feat(component): add new functionality"

# Push and create PR
git push -u origin feature/new-feature
gh pr create --title "feat: new feature" --body "..."

# After PR approval
git checkout main
git pull origin main
git branch -d feature/new-feature
```

### 7. ERROR RECOVERY

If you forget to create a branch before making changes:
```bash
# Stash your changes
git stash
# Create and switch to new branch
git checkout -b feature/forgot-to-branch
# Apply your changes
git stash pop
# Continue with normal workflow
```

### 8. MERGE CONFLICT RESOLUTION

When encountering merge conflicts:
1. NEVER force push unless explicitly instructed
2. Always communicate about conflicts
3. Preserve both changes when unclear
4. Re-run tests after resolving conflicts

### 9. FORBIDDEN PRACTICES

**You MUST NEVER**:
- Commit directly to main/master branch
- Use `git add .` without reviewing changes
- Make commits without running lint/typecheck
- Create commits larger than 200 lines without justification
- Use generic commit messages like "update", "fix", "changes"
- Force push to shared branches
- Commit sensitive information (keys, passwords, tokens)

### 10. CONTINUOUS INTEGRATION

**Every commit MUST**:
- Pass all linting rules
- Pass all type checks
- Not break existing tests
- Include tests for new functionality
- Update documentation if changing APIs

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
ALWAYS follow the MANDATORY GIT WORKFLOW PRACTICES without exception.
