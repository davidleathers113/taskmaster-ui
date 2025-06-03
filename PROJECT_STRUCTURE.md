# TaskMaster UI - Project Structure

## Overview

TaskMaster UI follows the **electron-vite** project structure, which provides a clean separation between Electron's main process, preload scripts, and renderer process. This structure was adopted in 2025 following migration from Electron Forge to leverage modern build tooling and improved developer experience.

## 🏗️ High-Level Architecture

```
taskmaster-ui/
├── src/                    # Source code (electron-vite structure)
│   ├── main/              # Electron main process
│   ├── preload/           # Secure bridge scripts  
│   └── renderer/          # React UI application
├── server/                # File watcher server (Node.js)
├── resources/             # Main process assets
├── dist/                  # Build output
├── electron.vite.config.js # Unified build configuration
└── docs/                  # Documentation files
```

## 📁 Detailed Directory Structure

### `/src/` - Source Code Root

The `src/` directory follows **electron-vite conventions** with three distinct process types:

```
src/
├── main/                  # 🖥️  Electron Main Process
│   ├── index.ts          # Main process entry point
│   └── vite-env.d.ts     # Vite environment types
├── preload/               # 🔐 Security Bridge
│   └── index.ts          # Preload script entry point
└── renderer/              # 🎨 React UI Application
    ├── index.html        # HTML entry point
    ├── public/           # Static assets for renderer
    │   └── sample-tasks.json
    └── src/              # React source code
        ├── App.tsx       # Main React component
        ├── main.tsx      # React DOM entry point
        ├── components/   # UI Components
        ├── hooks/        # Custom React hooks
        ├── lib/          # Utilities and helpers
        ├── store/        # Zustand state management
        ├── styles/       # Global styles
        └── types/        # TypeScript definitions
```

### `/src/main/` - Electron Main Process

**Purpose**: Controls the application lifecycle, manages windows, and handles system interactions.

```
src/main/
├── index.ts              # Main process implementation
│   ├── Window creation and management
│   ├── App lifecycle handlers
│   ├── Security configurations
│   ├── IPC handlers
│   ├── Auto-updater integration
│   └── Development/production environment handling
└── vite-env.d.ts         # Vite-specific type declarations
```

**Key Responsibilities**:
- 🪟 **Window Management**: Creating, configuring, and managing BrowserWindows
- 🔒 **Security**: Enforcing security policies, CSP, context isolation
- 🔌 **IPC Communication**: Handling inter-process communication with renderer
- 📦 **Auto-Updates**: Managing application updates via electron-updater
- 🛠️ **Development Tools**: DevTools integration and debugging support

### `/src/preload/` - Security Bridge

**Purpose**: Provides a secure communication bridge between main and renderer processes.

```
src/preload/
└── index.ts              # Preload script implementation
    ├── contextBridge API exposure
    ├── IPC communication helpers
    ├── Security validations
    ├── Rate limiting
    └── Development debugging
```

**Key Features**:
- 🛡️ **Context Isolation**: Safely exposes APIs to renderer via contextBridge
- 🚦 **Rate Limiting**: Prevents IPC abuse with built-in rate limiting
- ✅ **Input Validation**: Sanitizes data between processes
- 🔐 **Security First**: No direct Node.js access for renderer process

### `/src/renderer/` - React UI Application

**Purpose**: The user interface built with React, TypeScript, and modern web technologies.

```
src/renderer/
├── index.html            # Entry HTML file
├── public/               # Static assets
│   └── sample-tasks.json # Example task data
└── src/                  # React application source
    ├── App.tsx           # Root React component
    ├── main.tsx          # React DOM entry point
    ├── components/       # UI Components
    │   ├── DebugPanel.tsx
    │   ├── claude/       # Claude AI configuration
    │   ├── error/        # Error handling components
    │   ├── examples/     # Example components
    │   ├── layout/       # Layout components (Header, Sidebar, etc.)
    │   ├── project/      # Project management UI
    │   ├── task/         # Task-related components
    │   ├── ui/           # Reusable UI primitives
    │   └── views/        # Main view components
    ├── hooks/            # Custom React hooks
    │   ├── useClaudeConfig.ts
    │   ├── useProjectDiscovery.ts
    │   └── useProjectManager.ts
    ├── lib/              # Utilities and helpers
    │   ├── advanced-types.ts
    │   └── utils.ts
    ├── store/            # State management
    │   └── useTaskStore.ts # Zustand store
    ├── styles/           # Global CSS
    │   └── globals.css
    └── types/            # TypeScript definitions
        ├── claude-config.ts
        └── index.ts
```

**Architecture Highlights**:
- ⚛️ **React 18**: Modern React with concurrent features
- 🎭 **Framer Motion**: Physics-based animations
- 🎨 **Tailwind CSS**: Utility-first styling
- 🐻 **Zustand**: Lightweight state management
- 📱 **Responsive Design**: Multi-device support

### `/server/` - File Watcher Server

**Purpose**: Standalone Node.js server for real-time file monitoring and WebSocket communication.

```
server/
├── README.md             # Server documentation
├── package.json          # Server dependencies
├── tsconfig.json         # TypeScript configuration
├── file-watcher.ts       # Core file watching logic
├── file-watcher.js       # Compiled JavaScript
├── claude-config-api.ts  # Claude AI integration
├── claude-config-api.js  # Compiled JavaScript
└── discovery-engine.js   # Project discovery engine
```

**Key Features**:
- 📁 **Multi-Project Watching**: Monitors multiple `tasks/tasks.json` files
- 🔌 **WebSocket Communication**: Real-time updates to UI
- 🛡️ **Security**: Rate limiting, CORS, input validation
- 🔍 **Auto-Discovery**: Finds TaskMaster projects automatically

### `/resources/` - Main Process Assets

**Purpose**: Static assets accessible by the main process (icons, native resources).

```
resources/
├── icon-16.png           # Various icon sizes
├── icon-32.png           # for different contexts
├── icon-64.png           # (tray, window, dock, etc.)
├── icon-128.png
├── icon-256.png
├── icon-512.png
├── icon.icns             # macOS icon bundle
├── icon.svg              # Vector source
└── icon.iconset/         # macOS iconset directory
    ├── icon_16x16.png
    ├── icon_16x16@2x.png
    ├── icon_32x32.png
    ├── icon_32x32@2x.png
    ├── icon_128x128.png
    ├── icon_128x128@2x.png
    ├── icon_256x256.png
    ├── icon_256x256@2x.png
    └── icon_512x512.png
```

### `/dist/` - Build Output

**Purpose**: Compiled and bundled application code for production.

```
dist/
├── main/                 # Compiled main process
│   ├── main.cjs         # Main process bundle
│   └── main.cjs.map     # Source map
├── preload/              # Compiled preload scripts
│   ├── preload.cjs      # Preload bundle
│   └── preload.cjs.map  # Source map
└── renderer/             # Compiled renderer
    ├── index.html       # Entry HTML
    ├── assets/          # Bundled CSS/JS/images
    │   ├── index-[hash].js
    │   ├── index-[hash].css
    │   └── [asset-files]
    └── [static-assets]
```

## 🔧 Configuration Files

### `/electron.vite.config.js` - Unified Build Configuration

**Purpose**: Single configuration file for all electron-vite build processes.

```javascript
export default defineConfig({
  main: {
    // Main process build configuration
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'src/main/index.ts',
        formats: ['cjs']
      }
    }
  },
  preload: {
    // Preload script build configuration
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: 'src/preload/index.ts',
        formats: ['cjs']
      }
    }
  },
  renderer: {
    // Renderer process build configuration
    plugins: [react()],
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: 'src/renderer/index.html'
      }
    }
  }
})
```

### Key Configuration Features:
- 🎯 **Unified Setup**: Single config for all processes
- ⚡ **Fast Builds**: Optimized for development and production
- 🔒 **Security**: Content Security Policy integration
- 📦 **Dependency Management**: Automatic externalization
- 🗺️ **Source Maps**: Full debugging support

## 🛠️ Development Workflow

### File Organization Principles

1. **Separation of Concerns**: Each process type has its own directory
2. **Clear Boundaries**: No cross-imports between main/preload/renderer
3. **Type Safety**: TypeScript throughout with strict configuration
4. **Asset Management**: Proper separation of main vs renderer assets
5. **Build Optimization**: Externalized dependencies where appropriate

### Import Path Aliases

```typescript
// Configured in electron.vite.config.js
'@/': './src/renderer/src/',
'@components/': './src/renderer/src/components/',
'@lib/': './src/renderer/src/lib/',
'@hooks/': './src/renderer/src/hooks/',
'@types/': './src/renderer/src/types/',
'@store/': './src/renderer/src/store/'
```

### Build Process Flow

1. **Development**: `npm run dev:watch`
   - Main process: TypeScript compilation with watch
   - Preload: TypeScript compilation with watch  
   - Renderer: Vite dev server with HMR

2. **Production**: `npm run build`
   - Main process: Bundled to `dist/main/main.cjs`
   - Preload: Bundled to `dist/preload/preload.cjs`
   - Renderer: Bundled to `dist/renderer/`

## 🔒 Security Architecture

### Process Isolation
- **Main Process**: Full Node.js access, handles system operations
- **Preload**: Limited API exposure via contextBridge
- **Renderer**: Sandboxed, no direct Node.js access

### Communication Flow
```
Renderer ↔ Preload (contextBridge) ↔ Main Process ↔ System
```

### Security Features
- ✅ Context isolation enabled
- ✅ Node integration disabled in renderer
- ✅ Secure IPC via contextBridge
- ✅ Content Security Policy
- ✅ Input validation and rate limiting

## 📈 Performance Optimizations

### Build Optimizations
- **Dependency Externalization**: Main process dependencies are externalized
- **Code Splitting**: Renderer uses dynamic imports where beneficial
- **Tree Shaking**: Unused code is eliminated from bundles
- **Asset Optimization**: Images and static assets are optimized

### Development Optimizations
- **Hot Module Replacement**: Instant updates in renderer
- **Incremental TypeScript**: Fast compilation times
- **Efficient File Watching**: Debounced rebuilds
- **Source Maps**: Full debugging support

## 🚀 Migration Notes

This structure represents the **electron-vite migration** from the previous Electron Forge setup:

### Before (Electron Forge)
```
├── electron/
│   ├── main.ts
│   └── preload.ts
├── src/           # React app
└── vite.*.config.ts  # Multiple configs
```

### After (electron-vite)
```
├── src/
│   ├── main/      # Electron main
│   ├── preload/   # Bridge scripts
│   └── renderer/  # React app
└── electron.vite.config.js  # Unified config
```

### Migration Benefits
- 🚀 **Faster Builds**: electron-vite optimizations
- 🔧 **Better DX**: Unified configuration and hot reloading
- 📦 **Modern Tooling**: Latest Vite and build optimizations
- 🛡️ **Enhanced Security**: Improved isolation and validation

## 📚 Related Documentation

- `RUNNING.md` - Development and build commands
- `SETUP.md` - Initial project setup
- `MIGRATION.md` - Detailed migration process
- `CLAUDE.md` - Architecture patterns and conventions
- `README.md` - Project overview and features

---

This structure provides a solid foundation for modern Electron development with **electron-vite**, emphasizing security, performance, and developer experience.