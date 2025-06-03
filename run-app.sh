#!/bin/bash

# TaskMaster UI Production Run Script
# Updated for electron-vite 2025 structure  
# This script runs the app in production mode

echo "🚀 Starting TaskMaster UI (Production Mode)..."
echo ""

# Check if build exists with new electron-vite structure
if [ ! -d "dist/main" ] || [ ! -d "dist/renderer" ] || [ ! -d "dist/preload" ]; then
    echo "📦 Building application with electron-vite..."
    npm run build
    
    # Verify build completed successfully
    if [ ! -f "dist/main/main.cjs" ]; then
        echo "❌ Build failed - main.cjs not found!"
        exit 1
    fi
    
    echo "✅ Build completed successfully"
fi

# Set production environment variables
export NODE_ENV="production"

# Run Electron with new structure
echo "🖥️  Launching Electron (electron-vite structure)..."
echo "   📁 Main: dist/main/main.cjs"
echo "   📁 Preload: dist/preload/preload.cjs"  
echo "   📁 Renderer: dist/renderer/"
echo ""

./node_modules/.bin/electron dist/main/main.cjs
