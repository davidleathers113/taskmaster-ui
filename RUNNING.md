# TaskMaster UI - Running the Electron Application

## Current Status (June 1, 2025)

The TaskMaster UI Electron application has been successfully migrated from Electron Forge to electron-vite! The application now uses modern electron-vite tooling for faster development and better performance.

## 🚀 Quick Start

### Development Mode (Recommended for Development)
```bash
npm run dev
# or for enhanced watch mode
npm run dev:watch
```

### Electron App Development
```bash
npm run start:dev
# or
./run-dev.sh
```

### Production Mode
```bash
npm run start:prod
# or  
./run-app.sh
```

## 🏗️ electron-vite Architecture

### Build Process
The application uses electron-vite with three separate build targets:

- **Main Process**: `src/main/index.ts` → `dist/main/main.cjs`
- **Preload Script**: `src/preload/index.ts` → `dist/preload/preload.cjs`  
- **Renderer Process**: `src/renderer/` → `dist/renderer/`

### Development Workflow
```bash
# Build all processes
npm run build

# Individual builds (if needed)
electron-vite build

# Development with hot reload
npm run dev:watch
```

## 📁 Directory Structure

```
taskmaster-ui/
├── src/
│   ├── main/           # Electron main process
│   │   └── index.ts
│   ├── preload/        # Secure bridge scripts
│   │   └── index.ts
│   └── renderer/       # React UI application
│       ├── index.html
│       ├── public/
│       └── src/
├── resources/          # Main process assets (icons, etc.)
├── electron.vite.config.js  # Unified configuration
├── dist/              # Build output
│   ├── main/
│   ├── preload/
│   └── renderer/
└── server/            # File watcher server
```

## ⚡ Available Commands

### Core Development
```bash
npm run dev              # Start renderer in browser
npm run dev:watch        # Start with enhanced watch mode  
npm run dev:renderer     # Renderer-only development
npm run build           # Build all processes
npm run preview         # Preview built renderer
```

### Electron Application
```bash
npm run start:dev       # Electron dev mode with hot reload
npm run start:prod      # Electron production mode
```

### File Watcher Server
```bash
npm run server:install  # Install server dependencies
npm run server:dev      # Start server in development
npm run server:start    # Start server in production
npm run start:all       # Start both UI and server
```

### Code Quality
```bash
npm run lint            # ESLint checking
npm run typecheck       # TypeScript type checking
npm run security:audit  # Security audit
npm run ci:validate     # Full CI validation
```

## 🎯 Development Modes

### 1. Browser-Only Development (Fastest)
```bash
npm run dev
```
- React app runs at http://localhost:5173
- Hot Module Replacement (HMR) enabled
- Best for UI development

### 2. Full Electron Development
```bash
npm run start:dev
```
- Complete Electron environment
- Main process hot reload
- Renderer process HMR
- DevTools opened automatically

### 3. Combined Development (UI + File Watcher)
```bash
npm run start:all
```
- UI at http://localhost:5173
- File watcher server at http://localhost:3001
- Real-time file watching enabled

## 🔧 electron-vite Configuration

The application uses a unified `electron.vite.config.js` with:

- **Main Process**: TypeScript support, externalized dependencies
- **Preload Scripts**: Secure context bridge compilation  
- **Renderer**: React, Tailwind CSS, optimized bundling
- **Security**: CSP headers, content security policies
- **Performance**: Source maps, minification, code splitting

## 🛡️ Security Features

- ✅ Context Isolation enabled
- ✅ Node Integration disabled in renderer
- ✅ Secure IPC via contextBridge
- ✅ Content Security Policy configured
- ✅ Input validation in preload scripts
- ✅ Rate limiting for IPC calls
- ✅ Dependency externalization for main process

## 🏗️ Build Output

After running `npm run build`, the structure is:

```
dist/
├── main/
│   ├── main.cjs         # Main process bundle
│   └── main.cjs.map     # Source map
├── preload/
│   ├── preload.cjs      # Preload script bundle
│   └── preload.cjs.map  # Source map
└── renderer/
    ├── index.html       # Entry point
    ├── assets/          # Bundled CSS/JS
    └── ...
```

## 🐛 Troubleshooting

### Application Won't Start
```bash
# Check for existing Electron processes
ps aux | grep -i electron | grep -i taskmaster
pkill -f "electron.*taskmaster"

# Clean and rebuild
rm -rf dist
npm run build
npm run start:prod
```

### Development Server Issues
```bash
# Check port availability
lsof -i :5173  # Vite dev server
lsof -i :3001  # File watcher server

# Restart development
npm run dev:watch
```

### Build Failures
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run typecheck

# Check for linting issues
npm run lint
```

### electron-vite Specific Issues

**Issue**: Module resolution errors
**Solution**: Verify path aliases in `electron.vite.config.js`

**Issue**: Preload script not loading
**Solution**: Check preload path in main process configuration

**Issue**: Renderer hot reload not working
**Solution**: Ensure Vite dev server is running on correct port

## 🚀 Performance Optimizations

### Development
- Hot Module Replacement for instant updates
- Efficient file watching with debounced rebuilds
- Source maps for debugging
- TypeScript compilation caching

### Production
- Tree shaking to remove unused code
- Code splitting for optimal loading
- Asset optimization and compression
- Dependency externalization for smaller bundles

## 📊 Monitoring and Debugging

### Development Tools
- **Electron DevTools**: Automatically opened in dev mode
- **React DevTools**: Available in development
- **Console Logging**: Comprehensive debug output
- **Source Maps**: Full debugging support

### Performance Monitoring
```bash
# Bundle analysis (if configured)
npm run build -- --analyze

# Development server performance
npm run dev -- --debug
```

## 🎯 Next Steps

1. **Hot Reloading**: Fully implemented for all processes
2. **Production Packaging**: Ready for electron-builder integration
3. **Code Signing**: Prepared for distribution setup
4. **Auto-Updates**: Architecture supports electron-updater

## 📚 Related Documentation

- `SETUP.md` - Initial setup and installation
- `README.md` - Project overview and features  
- `CLAUDE.md` - Architecture and development patterns
- `PROJECT_STRUCTURE.md` - Detailed directory layout
- `MIGRATION.md` - Electron Forge to electron-vite migration

---

**electron-vite** provides faster builds, better development experience, and modern tooling for Electron applications. The migration is complete and the application is ready for continued development!