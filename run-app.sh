#!/bin/bash

# TaskMaster UI Run Script
# This script runs the app in production mode, bypassing Electron Forge's Vite plugin issues

echo "🚀 Starting TaskMaster UI..."
echo ""

# Check if build exists
if [ ! -d "dist" ]; then
    echo "📦 Building application first..."
    npm run build
fi

# Run Electron directly on the built files
echo "🖥️  Launching Electron..."
./node_modules/.bin/electron dist/electron/main.cjs
