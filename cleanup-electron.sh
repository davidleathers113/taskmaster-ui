#!/bin/bash

# Electron Window Cleanup Script
# This script forcefully closes all Electron windows and processes

echo "🧹 Cleaning up Electron windows and processes..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Kill Electron processes
echo "Killing Electron processes..."
if command_exists pkill; then
    pkill -f "electron" 2>/dev/null && echo "✓ Killed Electron processes" || echo "- No Electron processes found"
    pkill -f "Electron" 2>/dev/null
    pkill -f "taskmaster-ui" 2>/dev/null && echo "✓ Killed TaskMaster UI processes" || echo "- No TaskMaster UI processes found"
else
    echo "⚠️  pkill command not found, trying killall..."
    killall -9 electron 2>/dev/null || echo "- No Electron processes found"
    killall -9 Electron 2>/dev/null
fi

# Kill test-related processes
echo "Killing test processes..."
pkill -f "vitest" 2>/dev/null && echo "✓ Killed vitest processes" || echo "- No vitest processes found"
pkill -f "node.*test" 2>/dev/null && echo "✓ Killed test node processes" || echo "- No test processes found"

# Kill any node processes that might be hanging
echo "Checking for hanging node processes..."
pkill -f "node.*taskmaster-ui" 2>/dev/null && echo "✓ Killed hanging node processes" || echo "- No hanging processes found"

# On macOS, also check for Electron Helper processes
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Cleaning up macOS Electron Helper processes..."
    pkill -f "Electron Helper" 2>/dev/null && echo "✓ Killed Electron Helper processes" || echo "- No Helper processes found"
fi

# Clean up any zombie processes
echo "Cleaning up zombie processes..."
ps aux | grep -E "defunct|<defunct>" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null

# List remaining Electron-related processes (if any)
echo ""
echo "Checking for remaining processes..."
REMAINING=$(ps aux | grep -i electron | grep -v grep | grep -v "cleanup-electron.sh")
if [ -z "$REMAINING" ]; then
    echo "✅ All Electron processes have been cleaned up!"
else
    echo "⚠️  Some processes may still be running:"
    echo "$REMAINING"
    echo ""
    echo "You can manually kill these with: kill -9 <PID>"
fi

echo ""
echo "🎉 Cleanup complete!"