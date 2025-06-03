# Development Guide - TaskMaster UI (electron-vite)

## 🚀 2025 Development Workflow

TaskMaster UI has been migrated to **electron-vite** for superior development experience and performance.

### Quick Start Commands

```bash
# Full setup (recommended for new developers)
npm run setup              # Install all dependencies (UI + server)
npm run start:all          # Start both UI and file watcher server

# Development modes
npm run dev                # electron-vite dev server (all processes)
npm run dev:watch          # Development with auto-restart
npm run dev:renderer       # Renderer-only development

# Production testing
npm run build              # Build optimized bundles
npm run start:prod         # Test production build
```

## 🏗️ Project Architecture (electron-vite)

### Directory Structure
```
taskmaster-ui/
├── src/
│   ├── main/              # Electron main process
│   │   └── index.ts
│   ├── preload/           # Secure IPC bridge
│   │   └── index.ts  
│   └── renderer/          # React application
│       ├── index.html
│       ├── public/        # Static assets
│       └── src/           # React source
├── resources/             # Main process assets (icons)
├── electron.vite.config.js # Unified build configuration
└── dist/                  # Build output
    ├── main/
    ├── preload/
    └── renderer/
```

### Multi-Process Development

**Main Process** (`src/main/`)
- Electron app lifecycle management
- Window creation and management
- Auto-updater integration
- IPC handler registration

**Preload Scripts** (`src/preload/`)
- Secure bridge between main and renderer
- API exposure via contextBridge
- Input validation and rate limiting

**Renderer Process** (`src/renderer/`)
- React 18 application
- UI components and views
- State management (Zustand)
- Real-time file watching

## 🔥 Hot Reloading (2025 Features)

electron-vite provides enhanced hot reloading:

- **Main Process**: Automatic restart on changes
- **Preload Scripts**: Rebuild and reload on changes  
- **Renderer**: Full HMR with state preservation
- **Source Maps**: Available in all processes for debugging

### Development Server

```bash
npm run dev:watch
```

Features:
- Auto-restart on main/preload changes
- Hot module replacement for renderer
- Error overlay with source maps
- DevTools integration

## 🎯 Build Optimization (Task 11 Results)

### Bundle Performance (Achieved in Migration)
- **Main App Bundle**: 48.52 kB (91% reduction)
- **React Vendor**: 167.25 kB (69% reduction from original 545.59 kB)
- **Total Chunks**: 12 intelligently separated
- **Build Time**: ~15s (3x faster than Electron Forge)

### Code Splitting Strategy
```javascript
// Automatic chunking in electron.vite.config.js
manualChunks: (id) => {
  if (id.includes('react')) return 'react-vendor';
  if (id.includes('@mui')) return 'mui-vendor';
  if (id.includes('framer-motion')) return 'animation-vendor';
  if (id.includes('lucide-react')) return 'icons-vendor';
  if (id.includes('src/components/views/')) return 'views';
  if (id.includes('src/components/project/')) return 'project';
  return 'vendor';
}
```

## 🛠️ Development Tools

### TypeScript Configuration

Path aliases are configured for clean imports:
```typescript
// Use these import patterns:
import { useTaskStore } from '@/store/useTaskStore'
import { TaskCard } from '@components/task/TaskCard' 
import { cn } from '@lib/utils'
import { Task } from '@types'
```

### Code Quality Tools

#### ESLint Flat Config Development Workflow

TaskMaster uses ESLint v9+ flat configuration optimized for multi-process Electron development:

```bash
# Basic Linting Commands
npm run typecheck         # TypeScript validation across all processes
npm run lint              # ESLint checking with flat config
npm run lint --fix        # Auto-fix linting issues

# Advanced Development Commands
npx eslint --inspect-config src/main/index.ts      # Debug main process config
npx eslint --inspect-config src/renderer/src/App.tsx # Debug renderer config
npx eslint --print-config src/preload/index.ts     # View preload script config
```

#### Flat Config Structure & Customization

The `eslint.config.js` uses a modern array-based configuration:

```javascript
// eslint.config.js - Development-focused structure
export default defineConfig([
  // Global ignores (applied first)
  { ignores: ['dist/**', 'out/**', 'node_modules/**'] },
  
  // Base configurations
  eslint.configs.recommended,
  ...tseslint.config(tseslint.configs.recommended),
  
  // Process-specific overrides
  {
    files: ['src/main/**/*.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { /* main process rules */ }
  }
]);
```

#### Development Rule Customization

Add custom rules for specific development needs:

```javascript
// Custom development rules example
{
  files: ['src/**/*.{ts,tsx}'],
  rules: {
    // Development-specific overrides
    '@typescript-eslint/no-console': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // React development rules
    'react-hooks/exhaustive-deps': 'warn'
  }
}
```

#### Debugging ESLint Issues

```bash
# Debug configuration resolution
DEBUG=eslint:* npx eslint src/main/index.ts

# Check which files are being processed
npx eslint src/ --debug

# Validate configuration file syntax
node -c eslint.config.js
```

**📋 For comprehensive troubleshooting, see:**
- **[ESLint Troubleshooting Guide](./docs/ESLINT_TROUBLESHOOTING.md)** - Detailed solutions for multi-process Electron issues
- **[ESLint Rollback Guide](./docs/ESLINT_ROLLBACK_GUIDE.md)** - Emergency rollback procedures
- **Automated Rollback Script**: `./scripts/eslint-rollback.sh`

### Bundle Analysis

View bundle composition:
```bash
npm run build
# Open dist/bundle-analysis.html in browser
```

## 🔒 Security Development

### Content Security Policy
```javascript
// Configured in electron.vite.config.js
'Content-Security-Policy': [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Vite dev needs unsafe-eval
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "connect-src 'self' ws://localhost:* http://localhost:*",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ')
```

### Process Isolation
- Context isolation enabled
- Node integration disabled in renderer
- Secure IPC via preload script
- Rate limiting and input validation

## 🎨 UI Development

### Component Development
```bash
# Start renderer-only development
npm run dev:renderer
```

### Animation System
All animations use Framer Motion with spring physics:
```typescript
const springConfig = {
  type: "spring",
  stiffness: 400,
  damping: 25,
}
```

### Design System
- Glass morphism effects
- Gradient text and backgrounds
- Physics-based micro-interactions
- Responsive design patterns

## 🔄 File Watching Integration

### Server Development
```bash
# Start file watcher server separately
npm run server:dev

# Or start everything together
npm run start:all
```

### WebSocket Connection
- Real-time task file monitoring
- Automatic UI updates on file changes
- Multi-project support
- Connection state management

## 🧪 Testing Workflow

### Development Testing Checklist
- [ ] Hot reloading works for all processes
- [ ] Source maps functional in DevTools
- [ ] File watcher server connects properly
- [ ] All views render correctly
- [ ] TypeScript compilation clean
- [ ] No console errors in any process

### Production Testing
```bash
npm run build
npm run start:prod
```

Verify:
- [ ] App launches without DevTools
- [ ] All features work identically to development
- [ ] Bundle sizes meet targets
- [ ] No runtime errors

## 📊 Performance Monitoring

### Build Performance
Monitor these metrics during development:
- Build time (target: <20s)
- Bundle sizes (main app <50kB)
- Hot reload speed
- Memory usage

### Runtime Performance
- App startup time
- UI responsiveness
- Memory footprint
- File watching efficiency

## 🛠️ Troubleshooting

### Common Issues

**Hot Reload Not Working**
```bash
# Clear cache and restart
rm -rf node_modules/.vite
npm run dev:watch
```

**TypeScript Path Errors**
```bash
# Verify tsconfig.json paths match electron.vite.config.js aliases
npm run typecheck
```

**Build Failures**
```bash
# Clean build directory
rm -rf dist
npm run build
```

**File Watcher Issues**
```bash
# Restart file watcher server
npm run server:dev
```

### Development Scripts

```bash
# Debug mode with inspect
npm run dev:debug

# Full clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

## 📚 Additional Resources

- [electron-vite Documentation](https://electron-vite.org/)
- [Migration Guide](./MIGRATION.md)
- [Project Structure](./PROJECT_STRUCTURE.md)
- [Running Instructions](./RUNNING.md)

---

*Updated for electron-vite migration - June 2025*