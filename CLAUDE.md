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

### Setup Commands
- Full setup: `npm run setup` (installs UI + server dependencies)
- Security audit: `npm run security:audit`
- CI validation: `npm run ci:validate`

## Architecture Overview

### Multi-Process Electron Application
- **Main Process**: `electron/main.ts` - Handles app lifecycle, window management
- **Renderer Process**: React app in `src/` - The UI that users interact with
- **Preload Script**: `electron/preload.ts` - Secure IPC bridge between main and renderer
- **File Watcher Server**: Separate Node.js server in `server/` for real-time file monitoring

### Core Technologies
- **React 18** with Framer Motion for animations
- **TypeScript** with strict configuration
- **Zustand** for state management (not Redux)
- **Tailwind CSS** with custom design system
- **Electron Forge** for packaging/distribution
- **WebSockets** for real-time file watching

### State Management (Zustand)
The main store is `src/store/useTaskStore.ts`:
- Manages all task data, filters, view modes, user settings
- Uses computed getters for filtered data
- Generates analytics automatically when tasks change
- Provides bulk operations for efficiency

### Component Architecture
```
src/
├── components/
│   ├── layout/           # Sidebar, Header, MainContent
│   ├── task/            # TaskCard, TaskDetailPanel
│   ├── views/           # TaskListView, KanbanView, AnalyticsView
│   ├── ui/              # CommandPalette, VirtualizedList
│   ├── project/         # ProjectManager, ProjectDiscovery
│   └── claude/          # Claude configuration components
├── hooks/               # Custom React hooks for reusable logic
├── lib/                 # Utilities and advanced types
└── types/              # TypeScript type definitions
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
Use configured path aliases in `vite.config.ts`:
- `@/` → `./src/`
- `@components/` → `./src/components/`
- `@lib/` → `./src/lib/`
- `@hooks/` → `./src/hooks/`
- `@types/` → `./src/types/`
- `@store/` → `./src/store/`

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
1. Create types in `src/types/`
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

### Known Issues
- Electron Forge Vite plugin has experimental issues - use shell scripts instead
- Single instance lock may require killing processes between runs
- File watcher requires Node.js 18+ for optimal performance