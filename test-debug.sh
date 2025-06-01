#!/bin/bash

# Quick test script to run your Electron app and capture ALL debug output
# Save this as test-debug.sh in your project root

echo "🚀 TASKMASTER DEBUG TEST SCRIPT 🚀"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check current directory
echo -e "${YELLOW}📍 Current Directory:${NC} $(pwd)"
echo ""

# Clean previous builds
echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
rm -rf dist .vite 2>/dev/null
echo -e "${GREEN}✅ Clean complete${NC}"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${RED}❌ node_modules not found! Run 'npm install' first${NC}"
    exit 1
fi

# Create debug log directory
mkdir -p debug-logs
LOG_FILE="debug-logs/debug-$(date +%Y%m%d-%H%M%S).log"

echo -e "${YELLOW}📝 Logging to:${NC} $LOG_FILE"
echo ""

# Set all debug environment variables
export DEBUG="*"
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_ENABLE_STACK_DUMPING=1
export NODE_ENV="development"
export TASKMASTER_DEBUG="true"

echo -e "${YELLOW}🔧 Environment Variables Set:${NC}"
echo "  DEBUG=*"
echo "  ELECTRON_ENABLE_LOGGING=1"
echo "  ELECTRON_ENABLE_STACK_DUMPING=1"
echo "  NODE_ENV=development"
echo "  TASKMASTER_DEBUG=true"
echo ""

# Function to monitor log file in background
monitor_log() {
    echo -e "${GREEN}📺 Monitoring log file for errors...${NC}"
    echo ""
    
    # Start monitoring in background
    (
        tail -f "$LOG_FILE" | while read line; do
            if [[ $line == *"ERROR"* ]] || [[ $line == *"❌"* ]]; then
                echo -e "${RED}❌ ERROR DETECTED:${NC} $line"
            elif [[ $line == *"WARNING"* ]] || [[ $line == *"⚠️"* ]]; then
                echo -e "${YELLOW}⚠️  WARNING:${NC} $line"
            elif [[ $line == *"SUCCESS"* ]] || [[ $line == *"✅"* ]]; then
                echo -e "${GREEN}✅ SUCCESS:${NC} $line"
            fi
        done
    ) &
    MONITOR_PID=$!
}

# Start monitoring
monitor_log

# Run the app with all output captured
echo -e "${YELLOW}🚀 Starting Electron app...${NC}"
echo "===================================================="
echo ""

# Run npm start and capture everything
npm start 2>&1 | tee "$LOG_FILE"

# Kill the monitor process
kill $MONITOR_PID 2>/dev/null

echo ""
echo "===================================================="
echo -e "${GREEN}📋 Debug session complete!${NC}"
echo ""
echo -e "${YELLOW}📊 Summary:${NC}"
echo -e "  Log file: ${GREEN}$LOG_FILE${NC}"

# Count errors and warnings
ERROR_COUNT=$(grep -c "ERROR\|❌" "$LOG_FILE" 2>/dev/null || echo 0)
WARNING_COUNT=$(grep -c "WARNING\|⚠️" "$LOG_FILE" 2>/dev/null || echo 0)
SUCCESS_COUNT=$(grep -c "SUCCESS\|✅" "$LOG_FILE" 2>/dev/null || echo 0)

echo -e "  Errors: ${RED}$ERROR_COUNT${NC}"
echo -e "  Warnings: ${YELLOW}$WARNING_COUNT${NC}"
echo -e "  Successes: ${GREEN}$SUCCESS_COUNT${NC}"
echo ""

# Check if critical errors occurred
if grep -q "MAIN_WINDOW_VITE_DEV_SERVER_URL is not defined" "$LOG_FILE"; then
    echo -e "${RED}❌ CRITICAL: Vite magic variables not defined!${NC}"
    echo "   Solution: The build cache is stale. Already cleaned, try running again."
fi

if grep -q "Failed to load dev server URL" "$LOG_FILE"; then
    echo -e "${RED}❌ CRITICAL: Could not connect to Vite dev server!${NC}"
    echo "   Solution: Check if port 5173 is in use or if Vite failed to start."
fi

if grep -q "Preload.*NOT FOUND" "$LOG_FILE"; then
    echo -e "${RED}❌ CRITICAL: Preload script not found!${NC}"
    echo "   Solution: Check build output paths in vite.preload.config.ts"
fi

if grep -q "electronAPI is NOT available" "$LOG_FILE"; then
    echo -e "${RED}❌ CRITICAL: electronAPI not exposed to renderer!${NC}"
    echo "   Solution: Preload script failed. Check contextBridge.exposeInMainWorld()"
fi

echo ""
echo "💡 TIP: Open $LOG_FILE in your editor to see the full debug output"
echo ""