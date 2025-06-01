# TaskMaster UI - Running the Application

## Current Status (June 1, 2025)

The TaskMaster UI Electron application is now functional! Due to issues with Electron Forge's experimental Vite plugin, we've implemented alternative run scripts.

## Quick Start

### Production Mode (Recommended)
```bash
npm run start:prod
# or
./run-app.sh
```

### Development Mode (with Hot Reload)
```bash
npm run start:dev
# or
./run-dev.sh
```

### Traditional Electron Forge (Currently has issues)
```bash
npm start
```

## Known Issues

1. **Electron Forge Vite Plugin**: The experimental Vite plugin doesn't properly inject magic variables or start the dev server. This is why we use the alternative scripts.

2. **Single Instance Lock**: If the app fails to start, check for lingering Electron processes:
   ```bash
   ps aux | grep -i electron | grep -i taskmaster
   ```

## Build Commands

```bash
# Build all components
npm run build

# Build individually
npx vite build                          # Renderer
npx vite build --config vite.main.config.ts    # Main process
npx vite build --config vite.preload.config.ts # Preload script
```

## Architecture

- **Main Process**: `dist/electron/main.cjs`
- **Preload Script**: `dist/electron/preload.cjs`
- **Renderer**: `dist/renderer/index.html`

## Security Features Implemented

- ✅ Context Isolation enabled
- ✅ Node Integration disabled
- ✅ Secure IPC communication via contextBridge
- ✅ Content Security Policy configured
- ✅ Input validation in preload script
- ✅ Rate limiting for IPC calls

## Next Steps

1. **Fix Electron Forge Integration**: Consider updating to a newer version or switching to electron-builder
2. **Add Icons**: Create app icons for all platforms
3. **Implement Auto-updater**: Configure GitHub releases for auto-updates
4. **Production Packaging**: Set up code signing and notarization

## Troubleshooting

If the app doesn't start:

1. Kill all Electron processes
2. Clear the dist directory: `rm -rf dist`
3. Rebuild: `npm run build`
4. Try again: `npm run start:prod`
