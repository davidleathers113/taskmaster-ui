#!/bin/bash

# TaskMaster UI Development Mode Script
# This script runs the app in development mode with hot reload

echo "🚀 Starting TaskMaster UI in Development Mode..."
echo ""

# Kill any existing Vite servers on port 5173
echo "🧹 Cleaning up any existing processes..."
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Start Vite dev server in background
echo "📦 Starting Vite dev server..."
npm run dev &
VITE_PID=$!

# Wait for Vite to start
echo "⏳ Waiting for Vite dev server to start..."
sleep 3

# Check if Vite is running
if ! lsof -ti:5173 > /dev/null; then
    echo "❌ Vite dev server failed to start!"
    exit 1
fi

echo "✅ Vite dev server running on http://localhost:5173"
echo ""

# Build main and preload scripts
echo "🔨 Building Electron main and preload scripts..."
npx vite build --config vite.main.config.ts
npx vite build --config vite.preload.config.ts

# Set environment variables for development
export MAIN_WINDOW_VITE_DEV_SERVER_URL="http://localhost:5173"
export NODE_ENV="development"

# Run Electron
echo "🖥️  Launching Electron in development mode..."
./node_modules/.bin/electron dist/electron/main.cjs

# Clean up when done
kill $VITE_PID 2>/dev/null
