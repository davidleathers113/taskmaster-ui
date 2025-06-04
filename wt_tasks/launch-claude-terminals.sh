#!/bin/bash
# launch-claude-terminals.sh - Advanced terminal launcher for TaskMaster UI worktrees
# Implements 2025 best practices with enhanced automation and error handling

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Check dependencies
if ! command -v jq &> /dev/null; then
    log_error "jq is not installed. Install with: brew install jq"
    exit 1
fi

if ! command -v claude &> /dev/null; then
    log_warning "Claude CLI not found. Install from: https://claude.ai/download"
    log_info "Terminals will open but Claude won't start automatically"
fi

# Function to create absolute path
get_absolute_path() {
    echo "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
}

# Function to sanitize names
sanitize_name() {
    echo "$1" | sed 's/[^a-zA-Z0-9_\-]/-/g'
}

# Function to process prompt template
process_prompt_template() {
    local prompt="$1"
    local task="$2"
    
    # Extract task fields
    local task_id=$(echo "$task" | jq -r '.id')
    local task_name=$(echo "$task" | jq -r '.name')
    local task_desc=$(echo "$task" | jq -r '.description')
    local branch_prefix=$(echo "$task" | jq -r '.branchPrefix // "fix/"')
    local phase=$(echo "$task" | jq -r '.phase // 1')
    local error_types=$(echo "$task" | jq -r '.errorTypes[]? // empty' | tr '\n' ', ' | sed 's/,$//')
    
    local sanitized_task=$(sanitize_name "$task_id")
    local branch_name="${branch_prefix}${sanitized_task}"
    
    # Build error context
    local error_context=""
    if [ -n "$error_types" ]; then
        error_context="Error types to fix: $error_types"
    fi
    
    # Replace template variables
    prompt="${prompt//\{TASK_NAME\}/$task_name}"
    prompt="${prompt//\{TASK_ID\}/$task_id}"
    prompt="${prompt//\{TASK_DESCRIPTION\}/$task_desc}"
    prompt="${prompt//\{BRANCH_NAME\}/$branch_name}"
    prompt="${prompt//\{PHASE\}/$phase}"
    prompt="${prompt//\{ERROR_CONTEXT\}/$error_context}"
    
    echo "$prompt"
}

# Function to escape string for AppleScript
escape_applescript() {
    echo "$1" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g'
}

# Function to create startup script
create_startup_script() {
    local worktree_path="$1"
    local prompt="$2"
    local task_id="$3"
    local port_main="$4"
    local port_renderer="$5"
    local port_server="$6"
    
    cat > "$worktree_path/startup.sh" << 'STARTUP_EOF'
#!/bin/bash
# Startup script for Claude in worktree

cd "$(dirname "$0")"

# Source environment variables
if [ -f ".env.worktree" ]; then
    export $(cat .env.worktree | xargs)
fi

# Clear screen and show banner
clear
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         TaskMaster UI - Claude Development Session         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Task: TASK_ID_PLACEHOLDER"
echo "Ports: Main=PORT_MAIN_PLACEHOLDER, Renderer=PORT_RENDERER_PLACEHOLDER, Server=PORT_SERVER_PLACEHOLDER"
echo ""
echo "Starting Claude..."
echo ""

# Check if Claude is available
if command -v claude &> /dev/null; then
    claude "PROMPT_PLACEHOLDER"
else
    echo "Claude CLI not found. Please install it from: https://claude.ai/download"
    echo ""
    echo "You can start Claude manually with:"
    echo "claude"
    echo ""
    echo "Initial prompt saved to: initial-prompt.txt"
    echo "PROMPT_PLACEHOLDER" > initial-prompt.txt
fi
STARTUP_EOF
    
    # Replace placeholders
    sed -i '' "s|TASK_ID_PLACEHOLDER|$task_id|g" "$worktree_path/startup.sh"
    sed -i '' "s|PORT_MAIN_PLACEHOLDER|$port_main|g" "$worktree_path/startup.sh"
    sed -i '' "s|PORT_RENDERER_PLACEHOLDER|$port_renderer|g" "$worktree_path/startup.sh"
    sed -i '' "s|PORT_SERVER_PLACEHOLDER|$port_server|g" "$worktree_path/startup.sh"
    
    # Escape prompt for sed
    local escaped_prompt=$(echo "$prompt" | sed 's/[[\.*^$()+?{|]/\\&/g')
    sed -i '' "s|PROMPT_PLACEHOLDER|$escaped_prompt|g" "$worktree_path/startup.sh"
    
    chmod +x "$worktree_path/startup.sh"
}

# Read configuration
CONFIG_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wt_config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    log_error "Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Extract configuration
BASE_REPO=$(jq -r '.repository.baseRepo' "$CONFIG_FILE")
BASE_DIR=$(get_absolute_path "$BASE_REPO")
REPO_NAME=$(basename "$BASE_DIR")
PARENT_DIR=$(dirname "$BASE_DIR")
WORKTREES_DIR="$PARENT_DIR/${REPO_NAME}_worktrees"

# Terminal configuration
WINDOW_WIDTH=$(jq -r '.terminals.windowWidth // 900' "$CONFIG_FILE")
WINDOW_HEIGHT=$(jq -r '.terminals.windowHeight // 700' "$CONFIG_FILE")
INITIAL_POS_X=$(jq -r '.terminals.initialPositionX // 50' "$CONFIG_FILE")
INITIAL_POS_Y=$(jq -r '.terminals.initialPositionY // 50' "$CONFIG_FILE")
OFFSET_X=$(jq -r '.terminals.offsetX // 40' "$CONFIG_FILE")
OFFSET_Y=$(jq -r '.terminals.offsetY // 40' "$CONFIG_FILE")
TITLE_PREFIX=$(jq -r '.terminals.titlePrefix // "TaskMaster - "' "$CONFIG_FILE")

# Claude configuration
CLAUDE_ENABLE_PROMPT=$(jq -r '.claude.enableInitialPrompt // true' "$CONFIG_FILE")
CLAUDE_DEFAULT_PROMPT=$(jq -r '.claude.defaultPrompt // ""' "$CONFIG_FILE")

# Port allocation
ELECTRON_MAIN_START=$(jq -r '.coordination.portAllocation.electronMainStart // 5170' "$CONFIG_FILE")
ELECTRON_RENDERER_START=$(jq -r '.coordination.portAllocation.electronRendererStart // 5270' "$CONFIG_FILE")
SERVER_START=$(jq -r '.coordination.portAllocation.serverStart // 3100' "$CONFIG_FILE")

# Get tasks
TASK_COUNT=$(jq '.tasks | length' "$CONFIG_FILE")
log_info "Found $TASK_COUNT tasks to launch"

# Verify worktrees exist
MISSING_WORKTREES=()
for i in $(seq 0 $(($TASK_COUNT - 1))); do
    TASK_ID=$(jq -r ".tasks[$i].id" "$CONFIG_FILE")
    SANITIZED_TASK=$(sanitize_name "$TASK_ID")
    
    if [ ! -d "$WORKTREES_DIR/$SANITIZED_TASK" ]; then
        MISSING_WORKTREES+=("$TASK_ID")
    fi
done

if [ ${#MISSING_WORKTREES[@]} -gt 0 ]; then
    log_error "Missing worktrees: ${MISSING_WORKTREES[*]}"
    log_info "Run ./wt_tasks/setup-worktrees.sh first"
    exit 1
fi

# Check if Terminal is running
if ! osascript -e 'tell application "System Events" to (name of processes) contains "Terminal"' &>/dev/null; then
    log_info "Starting Terminal application..."
    open -a Terminal
    sleep 2
fi

log_info "Launching Terminal windows for each worktree..."

# Track launched windows for summary
LAUNCHED_WINDOWS=()
FAILED_LAUNCHES=()

# Launch terminals
for i in $(seq 0 $(($TASK_COUNT - 1))); do
    # Get task details
    TASK=$(jq -r ".tasks[$i]" "$CONFIG_FILE")
    TASK_ID=$(echo "$TASK" | jq -r '.id')
    TASK_NAME=$(echo "$TASK" | jq -r '.name')
    SANITIZED_TASK=$(sanitize_name "$TASK_ID")
    
    # Calculate ports
    PORT_MAIN=$((ELECTRON_MAIN_START + i))
    PORT_RENDERER=$((ELECTRON_RENDERER_START + i))
    PORT_SERVER=$((SERVER_START + i))
    
    # Paths
    WORKTREE_PATH="$WORKTREES_DIR/$SANITIZED_TASK"
    WINDOW_TITLE="$TITLE_PREFIX$TASK_ID"
    
    # Calculate window position
    POSITION_X=$((INITIAL_POS_X + i * OFFSET_X))
    POSITION_Y=$((INITIAL_POS_Y + i * OFFSET_Y))
    POSITION_WIDTH=$((POSITION_X + WINDOW_WIDTH))
    POSITION_HEIGHT=$((POSITION_Y + WINDOW_HEIGHT))
    
    log_info "Launching: $TASK_ID - $TASK_NAME"
    
    # Process prompt if enabled
    if [ "$CLAUDE_ENABLE_PROMPT" = "true" ] && [ -n "$CLAUDE_DEFAULT_PROMPT" ]; then
        PROCESSED_PROMPT=$(process_prompt_template "$CLAUDE_DEFAULT_PROMPT" "$TASK")
        create_startup_script "$WORKTREE_PATH" "$PROCESSED_PROMPT" "$TASK_ID" \
            "$PORT_MAIN" "$PORT_RENDERER" "$PORT_SERVER"
        LAUNCH_COMMAND="./startup.sh"
    else
        LAUNCH_COMMAND="bash"
    fi
    
    # Create AppleScript
    TEMP_SCRIPT=$(mktemp /tmp/taskmaster-launch.XXXXXX.scpt)
    
    cat > "$TEMP_SCRIPT" <<EOF
tell application "Terminal"
    try
        -- Activate Terminal
        activate
        
        -- Create new window
        set newTab to do script ""
        
        -- Get window reference
        set targetWindow to first window whose tabs contains newTab
        
        -- Set window properties
        set custom title of newTab to "$WINDOW_TITLE"
        set bounds of targetWindow to {$POSITION_X, $POSITION_Y, $POSITION_WIDTH, $POSITION_HEIGHT}
        
        -- Change to worktree directory and launch
        do script "cd $(printf '%q' "$WORKTREE_PATH") && $LAUNCH_COMMAND" in newTab
        
        return "Success"
        
    on error errMsg number errNum
        return "Error: " & errMsg
    end try
end tell
EOF
    
    # Execute AppleScript
    SCRIPT_RESULT=$(osascript -s o "$TEMP_SCRIPT" 2>&1)
    SCRIPT_EXIT=$?
    
    # Clean up
    rm -f "$TEMP_SCRIPT"
    
    # Check result
    if [ $SCRIPT_EXIT -eq 0 ] && [[ "$SCRIPT_RESULT" == "Success" ]]; then
        LAUNCHED_WINDOWS+=("$TASK_ID (Port $PORT_MAIN)")
        log_success "Launched $TASK_ID"
    else
        FAILED_LAUNCHES+=("$TASK_ID: $SCRIPT_RESULT")
        log_error "Failed to launch $TASK_ID: $SCRIPT_RESULT"
    fi
    
    # Small delay between launches
    sleep 0.5
done

# Create quick reference script
cat > "$BASE_DIR/wt_tasks/quick-reference.sh" << 'QUICKREF_EOF'
#!/bin/bash
# Quick reference for active worktrees

CONFIG_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wt_config.json"
TASK_COUNT=$(jq '.tasks | length' "$CONFIG_FILE")

echo "TaskMaster UI - Active Worktrees Quick Reference"
echo "=============================================="
echo ""

for i in $(seq 0 $(($TASK_COUNT - 1))); do
    TASK_ID=$(jq -r ".tasks[$i].id" "$CONFIG_FILE")
    TASK_NAME=$(jq -r ".tasks[$i].name" "$CONFIG_FILE")
    
    echo "Task: $TASK_ID"
    echo "Name: $TASK_NAME"
    echo "Commands:"
    echo "  cd \$WORKTREE_$i  # Change to worktree"
    echo "  npm run typecheck  # Check TypeScript errors"
    echo "  npm run lint       # Check ESLint problems"
    echo "  npm test          # Run tests"
    echo ""
done

echo "Monitor all: ./wt_tasks/monitor-progress.sh"
QUICKREF_EOF

chmod +x "$BASE_DIR/wt_tasks/quick-reference.sh"

# Summary
echo ""
log_success "Terminal launch complete!"
echo ""

if [ ${#LAUNCHED_WINDOWS[@]} -gt 0 ]; then
    echo "Successfully launched:"
    printf '  - %s\n' "${LAUNCHED_WINDOWS[@]}"
fi

if [ ${#FAILED_LAUNCHES[@]} -gt 0 ]; then
    echo ""
    echo "Failed launches:"
    printf '  - %s\n' "${FAILED_LAUNCHES[@]}"
fi

echo ""
echo "Quick tips:"
echo "- Monitor progress: ./wt_tasks/monitor-progress.sh"
echo "- Quick reference: ./wt_tasks/quick-reference.sh"
echo "- Update progress tracker after fixes"
echo ""
echo "Port assignments saved in each worktree's .env.worktree file"