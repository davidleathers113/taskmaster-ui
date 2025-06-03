#!/bin/bash

# TaskMaster UI Development Mode Script  
# Updated for electron-vite 2025 best practices
# This script runs the app in development mode with hot reload and file watching

echo "🚀 Starting TaskMaster UI in Development Mode (electron-vite)..."
echo ""

# Kill any existing processes on common ports
echo "🧹 Cleaning up any existing processes..."
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Set environment variables for development
export NODE_ENV="development"
export ELECTRON_DISABLE_SECURITY_WARNINGS="true"

# Use electron-vite with watch mode for optimal development experience
echo "🔥 Starting electron-vite in watch mode..."
echo "   ⚡ This enables HMR for renderer and hot reload for main/preload processes"
echo "   📁 File watching: Automatic rebuilds on code changes"
echo "   🔧 Using 2025 best practices for electron-vite development"
echo ""

# Run electron-vite in development mode with watch enabled
npm run dev:watch
