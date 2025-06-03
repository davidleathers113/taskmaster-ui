#!/bin/bash

echo "Building Electron app..."

# Clean previous build
rm -rf dist/electron-temp
mkdir -p dist/electron-temp

# Build with electron-vite
npm run build

# The build creates index.cjs for both main and preload, overwriting each other
# We need to build them separately and preserve the files

# Save the current preload build (which overwrote main)
cp dist/electron/index.cjs dist/electron-temp/preload.cjs
cp dist/electron/index.cjs.map dist/electron-temp/preload.cjs.map

# Now we need to rebuild just the main process
# Since electron-vite doesn't support selective builds well, we'll use a workaround

# Temporarily rename preload to prevent it from building
mv src/preload/index.ts src/preload/index.ts.bak

# Clean and rebuild (this will only build main now)
rm -rf dist/electron
npm run build 2>/dev/null || true

# Copy main files
cp dist/electron/index.cjs dist/electron-temp/main.cjs
cp dist/electron/index.cjs.map dist/electron-temp/main.cjs.map

# Restore preload file
mv src/preload/index.ts.bak src/preload/index.ts

# Copy all files to final location
rm -rf dist/electron
mv dist/electron-temp dist/electron

echo "Build complete! Files created:"
ls -la dist/electron/