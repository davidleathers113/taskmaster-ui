#!/bin/bash

echo "🔍 DEEP DEBUG TASKMASTER 🔍"
echo "=========================="
echo ""

# Set ultra-verbose debugging
export DEBUG="*"
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_ENABLE_STACK_DUMPING=1
export NODE_ENV="development"
export ELECTRON_DISABLE_SECURITY_WARNINGS=1
export TASKMASTER_DEBUG="true"

# Electron Forge specific debugging
export ELECTRON_FORGE_DEBUG="true"
export VITE_LOG_LEVEL="debug"
export DEBUG_ELECTRON_VITE="true"

echo "📊 Environment Variables:"
echo "  DEBUG=$DEBUG"
echo "  ELECTRON_ENABLE_LOGGING=$ELECTRON_ENABLE_LOGGING"
echo "  ELECTRON_ENABLE_STACK_DUMPING=$ELECTRON_ENABLE_STACK_DUMPING"
echo "  NODE_ENV=$NODE_ENV"
echo "  TASKMASTER_DEBUG=$TASKMASTER_DEBUG"
echo "  ELECTRON_FORGE_DEBUG=$ELECTRON_FORGE_DEBUG"
echo "  VITE_LOG_LEVEL=$VITE_LOG_LEVEL"
echo ""

# Check if any process is using port 5173
echo "🔍 Checking port 5173..."
lsof -i :5173 2>/dev/null
if [ $? -eq 0 ]; then
    echo "⚠️  WARNING: Port 5173 is in use!"
else
    echo "✅ Port 5173 is available"
fi
echo ""

# Run with verbose npm logging too
echo "🚀 Starting app with maximum verbosity..."
echo "========================================="
echo ""

npm run start --verbose 2>&1 | while IFS= read -r line; do
    # Colorize output based on content
    if [[ $line == *"ERROR"* ]] || [[ $line == *"❌"* ]]; then
        echo -e "\033[0;31m$line\033[0m"
    elif [[ $line == *"WARNING"* ]] || [[ $line == *"⚠️"* ]]; then
        echo -e "\033[1;33m$line\033[0m"
    elif [[ $line == *"SUCCESS"* ]] || [[ $line == *"✅"* ]]; then
        echo -e "\033[0;32m$line\033[0m"
    elif [[ $line == *"VITE"* ]] || [[ $line == *"vite"* ]]; then
        echo -e "\033[0;36m[VITE] $line\033[0m"
    elif [[ $line == *"localhost:5173"* ]]; then
        echo -e "\033[0;35m[DEV SERVER] $line\033[0m"
    elif [[ $line == *"MAIN_WINDOW_VITE"* ]]; then
        echo -e "\033[0;34m[MAGIC VAR] $line\033[0m"
    else
        echo "$line"
    fi
done

echo ""
echo "🏁 Debug session ended"
