#!/bin/bash
# setup-worktrees.sh - Advanced Git worktree setup for TaskMaster UI
# Implements 2025 best practices for parallel development

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_info "Install missing dependencies:"
        for dep in "${missing_deps[@]}"; do
            case "$dep" in
                jq) echo "  brew install jq  # macOS" ;;
                git) echo "  brew install git  # macOS" ;;
                node|npm) echo "  brew install node  # macOS" ;;
            esac
        done
        exit 1
    fi
}

# Function to create absolute path
get_absolute_path() {
    echo "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
}

# Function to sanitize names for branches and directories
sanitize_name() {
    echo "$1" | sed 's/[^a-zA-Z0-9_\-]/-/g'
}

# Function to check Git worktree version and features
check_git_features() {
    local git_version=$(git --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    log_info "Git version: $git_version"
    
    # Check for FSMonitor support (Git 2.37.0+)
    if git config --get core.fsmonitor &>/dev/null; then
        log_info "FSMonitor is enabled for better performance"
    else
        log_warning "Consider enabling FSMonitor for better performance:"
        echo "  git config core.fsmonitor true"
    fi
}

# Function to create progress tracking file
create_progress_tracker() {
    local progress_file="$1"
    cat > "$progress_file" << 'EOF'
# TaskMaster UI Worktree Progress Tracker

Last Updated: $(date)

## Active Worktrees

| Task ID | Branch | Status | Errors Fixed | Tests Fixed | Started | Last Activity |
|---------|--------|--------|--------------|-------------|---------|---------------|
EOF
    
    # Add entry for each task
    for i in $(seq 0 $(($TASK_COUNT - 1))); do
        local task_id=$(jq -r ".tasks[$i].id" "$CONFIG_FILE")
        local branch_prefix=$(jq -r ".tasks[$i].branchPrefix // \"fix/\"" "$CONFIG_FILE")
        local sanitized_task=$(sanitize_name "$task_id")
        local branch_name="${branch_prefix}${sanitized_task}"
        
        echo "| $task_id | $branch_name | Setup | 0 | 0 | $(date +%Y-%m-%d) | $(date +%H:%M) |" >> "$progress_file"
    done
    
    cat >> "$progress_file" << 'EOF'

## Coordination Notes

- Phase 1: TypeScript error fixes (ts-module-errors, ts-type-safety)
- Phase 2: Test and ESLint analysis (test-failure-analysis, eslint-analysis)
- Phase 3: Documentation and CI/CD (ci-cd-setup)

## Conflict Resolution Log

_Document any merge conflicts or coordination issues here_

## Performance Metrics

- Initial TypeScript errors: 410
- Initial ESLint problems: 1,887 (1,142 errors + 745 warnings)
- Initial failing tests: 40/51

EOF
}

# Main script starts here
log_info "TaskMaster UI Advanced Worktree Setup"
log_info "Implementing 2025 best practices for parallel development"

# Check dependencies
check_dependencies

# Read configuration
CONFIG_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wt_config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    log_error "Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Extract configuration
BASE_REPO=$(jq -r '.repository.baseRepo' "$CONFIG_FILE")
BASE_BRANCH=$(jq -r '.repository.baseBranch' "$CONFIG_FILE")
MAX_WORKTREES=$(jq -r '.worktrees.maxActiveWorktrees // 10' "$CONFIG_FILE")

# Validate base repository
BASE_REPO=$(get_absolute_path "$BASE_REPO")
if ! cd "$BASE_REPO" 2>/dev/null; then
    log_error "Base repository not found: $BASE_REPO"
    exit 1
fi

if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    log_error "$BASE_REPO is not a Git repository"
    exit 1
fi

# Check Git features
check_git_features

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    log_warning "You have uncommitted changes in the main repository"
    echo "Continue anyway? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log_info "Aborted by user"
        exit 0
    fi
fi

# Setup directories
BASE_DIR=$(pwd)
REPO_NAME=$(basename "$BASE_DIR")
PARENT_DIR=$(dirname "$BASE_DIR")
WORKTREES_DIR="$PARENT_DIR/${REPO_NAME}_worktrees"

log_info "Setting up worktrees in: $WORKTREES_DIR"
mkdir -p "$WORKTREES_DIR"

# Get configuration values
TASK_COUNT=$(jq '.tasks | length' "$CONFIG_FILE")
SHARED_FILES=($(jq -r '.worktrees.sharedFiles[]' "$CONFIG_FILE" 2>/dev/null || echo))
PROGRESS_FILE=$(jq -r '.coordination.communicationFile' "$CONFIG_FILE")

# Create progress tracking file
if [ ! -f "$BASE_DIR/$PROGRESS_FILE" ]; then
    log_info "Creating progress tracking file"
    create_progress_tracker "$BASE_DIR/$PROGRESS_FILE"
fi

# Check existing worktrees
EXISTING_WORKTREES=$(git worktree list --porcelain | grep -c "^worktree" || true)
log_info "Existing worktrees: $((EXISTING_WORKTREES - 1))" # Subtract main worktree

if [ $((EXISTING_WORKTREES - 1 + TASK_COUNT)) -gt $MAX_WORKTREES ]; then
    log_warning "This will exceed the maximum worktrees limit ($MAX_WORKTREES)"
    echo "Continue anyway? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Ensure we're on the base branch
log_info "Switching to base branch: $BASE_BRANCH"
git checkout "$BASE_BRANCH" --quiet

# Update from remote if available
REMOTE_NAME=$(git remote | head -1 || true)
if [ -n "$REMOTE_NAME" ]; then
    log_info "Fetching latest changes from $REMOTE_NAME"
    git fetch "$REMOTE_NAME" --quiet || log_warning "Failed to fetch from remote"
fi

# Port allocation for Electron apps
ELECTRON_MAIN_PORT=$(jq -r '.coordination.portAllocation.electronMainStart // 5170' "$CONFIG_FILE")
ELECTRON_RENDERER_PORT=$(jq -r '.coordination.portAllocation.electronRendererStart // 5270' "$CONFIG_FILE")
SERVER_PORT=$(jq -r '.coordination.portAllocation.serverStart // 3100' "$CONFIG_FILE")

# Create worktrees for each task
log_info "Creating $TASK_COUNT worktrees..."

for i in $(seq 0 $(($TASK_COUNT - 1))); do
    # Extract task information
    TASK=$(jq -r ".tasks[$i]" "$CONFIG_FILE")
    TASK_ID=$(echo "$TASK" | jq -r '.id')
    TASK_NAME=$(echo "$TASK" | jq -r '.name')
    TASK_DESC=$(echo "$TASK" | jq -r '.description')
    BRANCH_PREFIX=$(echo "$TASK" | jq -r '.branchPrefix // "fix/"')
    CATEGORY=$(echo "$TASK" | jq -r '.category // "general"')
    PHASE=$(echo "$TASK" | jq -r '.phase // 1')
    ERROR_TYPES=$(echo "$TASK" | jq -r '.errorTypes[]? // empty' | tr '\n' ' ')
    
    SANITIZED_TASK=$(sanitize_name "$TASK_ID")
    BRANCH_NAME="${BRANCH_PREFIX}${SANITIZED_TASK}"
    WORKTREE_PATH="$WORKTREES_DIR/$SANITIZED_TASK"
    
    echo ""
    log_info "Processing: $TASK_ID - $TASK_NAME"
    log_info "Category: $CATEGORY, Phase: $PHASE"
    
    # Create or verify branch
    if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
        log_info "Branch already exists: $BRANCH_NAME"
    else
        log_info "Creating branch: $BRANCH_NAME"
        git branch "$BRANCH_NAME" "$BASE_BRANCH" --quiet
    fi
    
    # Create or update worktree
    if [ -d "$WORKTREE_PATH" ]; then
        log_warning "Worktree already exists at $WORKTREE_PATH"
        # Verify it's still valid
        if ! git worktree list | grep -q "$WORKTREE_PATH"; then
            log_error "Invalid worktree detected, cleaning up"
            rm -rf "$WORKTREE_PATH"
            git worktree prune
        else
            continue
        fi
    fi
    
    log_info "Creating worktree at: $WORKTREE_PATH"
    if ! git worktree add "$WORKTREE_PATH" "$BRANCH_NAME" --quiet; then
        log_error "Failed to create worktree for $TASK_ID"
        continue
    fi
    
    # Create task description file
    cat > "$WORKTREE_PATH/TASK.md" << EOF
# Task: $TASK_NAME

**ID**: $TASK_ID  
**Branch**: $BRANCH_NAME  
**Category**: $CATEGORY  
**Phase**: $PHASE  
**Created**: $(date)

## Description

$TASK_DESC

## Error Types to Fix

$ERROR_TYPES

## Assigned Ports

- Electron Main: $((ELECTRON_MAIN_PORT + i))
- Electron Renderer: $((ELECTRON_RENDERER_PORT + i))
- Server: $((SERVER_PORT + i))

## Quick Commands

\`\`\`bash
# Check TypeScript errors
npm run typecheck

# Check ESLint problems
npm run lint

# Run tests
npm test

# Start development server
ELECTRON_MAIN_PORT=$((ELECTRON_MAIN_PORT + i)) ELECTRON_RENDERER_PORT=$((ELECTRON_RENDERER_PORT + i)) npm run dev
\`\`\`

## Progress Tracking

Update the progress file at: $PROGRESS_FILE

## Commit Message Format

Use conventional commits:
- \`fix(main): resolve TS2307 module import errors\`
- \`fix(renderer): add null checks for TS2532 errors\`
- \`test: fix failing integration tests\`
- \`chore(eslint): resolve code quality warnings\`

EOF
    
    # Copy shared files
    log_info "Copying shared files..."
    for file in "${SHARED_FILES[@]}"; do
        if [ -f "$BASE_DIR/$file" ]; then
            # Create directory if needed
            mkdir -p "$WORKTREE_PATH/$(dirname "$file")"
            cp "$BASE_DIR/$file" "$WORKTREE_PATH/$file"
        elif [ -d "$BASE_DIR/$file" ]; then
            cp -r "$BASE_DIR/$file" "$WORKTREE_PATH/$file"
        fi
    done
    
    # Create environment file for port configuration
    cat > "$WORKTREE_PATH/.env.worktree" << EOF
# Worktree-specific environment variables
ELECTRON_MAIN_PORT=$((ELECTRON_MAIN_PORT + i))
ELECTRON_RENDERER_PORT=$((ELECTRON_RENDERER_PORT + i))
SERVER_PORT=$((SERVER_PORT + i))
WORKTREE_ID=$TASK_ID
WORKTREE_PHASE=$PHASE
EOF
    
    # Install dependencies if package.json exists
    if [ -f "$WORKTREE_PATH/package.json" ]; then
        log_info "Installing dependencies for $TASK_ID..."
        (cd "$WORKTREE_PATH" && npm install --quiet) || log_warning "Failed to install dependencies"
    fi
    
    log_success "Worktree created for $TASK_ID"
done

# Create monitoring script
log_info "Creating monitoring script..."
cat > "$BASE_DIR/wt_tasks/monitor-progress.sh" << 'MONITOR_EOF'
#!/bin/bash
# Monitor progress across all worktrees

CONFIG_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wt_config.json"
WORKTREES_DIR="$(dirname "$(jq -r '.repository.baseRepo' "$CONFIG_FILE")")/$(basename "$(jq -r '.repository.baseRepo' "$CONFIG_FILE")")_worktrees"

echo "TaskMaster UI Worktree Progress Monitor"
echo "======================================="
echo ""

# Function to count TypeScript errors
count_ts_errors() {
    local path="$1"
    if [ -f "$path/package.json" ]; then
        (cd "$path" && npm run typecheck 2>&1 | grep -E "error TS[0-9]+" | wc -l || echo "0")
    else
        echo "N/A"
    fi
}

# Function to count ESLint problems
count_eslint_problems() {
    local path="$1"
    if [ -f "$path/package.json" ]; then
        (cd "$path" && npm run lint 2>&1 | grep -E "[0-9]+ problems?" | grep -oE "[0-9]+" | head -1 || echo "0")
    else
        echo "N/A"
    fi
}

# Display worktree status
TASK_COUNT=$(jq '.tasks | length' "$CONFIG_FILE")
for i in $(seq 0 $(($TASK_COUNT - 1))); do
    TASK_ID=$(jq -r ".tasks[$i].id" "$CONFIG_FILE")
    SANITIZED_TASK=$(echo "$TASK_ID" | sed 's/[^a-zA-Z0-9_\-]/-/g')
    WORKTREE_PATH="$WORKTREES_DIR/$SANITIZED_TASK"
    
    if [ -d "$WORKTREE_PATH" ]; then
        echo "Task: $TASK_ID"
        echo "Path: $WORKTREE_PATH"
        
        # Get git status
        cd "$WORKTREE_PATH"
        BRANCH=$(git branch --show-current)
        COMMITS=$(git rev-list --count HEAD ^origin/main 2>/dev/null || echo "0")
        MODIFIED=$(git status --porcelain | wc -l)
        
        echo "Branch: $BRANCH"
        echo "Commits ahead: $COMMITS"
        echo "Modified files: $MODIFIED"
        echo "TypeScript errors: $(count_ts_errors "$WORKTREE_PATH")"
        echo "ESLint problems: $(count_eslint_problems "$WORKTREE_PATH")"
        echo "---"
    fi
done

# Show resource usage
echo ""
echo "System Resources:"
echo "Disk usage: $(du -sh "$WORKTREES_DIR" 2>/dev/null | cut -f1)"
echo "Active worktrees: $(git worktree list | wc -l)"
MONITOR_EOF

chmod +x "$BASE_DIR/wt_tasks/monitor-progress.sh"

# Create cleanup script
log_info "Creating cleanup script..."
cat > "$BASE_DIR/cleanup-worktrees.sh" << 'CLEANUP_EOF'
#!/bin/bash
# Cleanup worktrees with safety checks

set -euo pipefail

CONFIG_FILE="$(pwd)/wt_tasks/wt_config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found"
    exit 1
fi

WORKTREES_DIR="$(dirname "$(pwd)")/$(basename "$(pwd)")_worktrees"

echo "TaskMaster UI Worktree Cleanup"
echo "=============================="
echo ""
echo "This will remove worktrees in: $WORKTREES_DIR"
echo ""

# Show current worktrees
echo "Current worktrees:"
git worktree list
echo ""

# Check for uncommitted changes
echo "Checking for uncommitted changes..."
TASK_COUNT=$(jq '.tasks | length' "$CONFIG_FILE")
UNCOMMITTED=()

for i in $(seq 0 $(($TASK_COUNT - 1))); do
    TASK_ID=$(jq -r ".tasks[$i].id" "$CONFIG_FILE")
    SANITIZED_TASK=$(echo "$TASK_ID" | sed 's/[^a-zA-Z0-9_\-]/-/g')
    WORKTREE_PATH="$WORKTREES_DIR/$SANITIZED_TASK"
    
    if [ -d "$WORKTREE_PATH" ]; then
        cd "$WORKTREE_PATH"
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            UNCOMMITTED+=("$TASK_ID")
        fi
    fi
done

if [ ${#UNCOMMITTED[@]} -gt 0 ]; then
    echo ""
    echo "WARNING: Uncommitted changes found in:"
    printf '%s\n' "${UNCOMMITTED[@]}"
    echo ""
fi

echo "Are you sure you want to remove all worktrees? (yes/no)"
read -r response

if [ "$response" != "yes" ]; then
    echo "Aborted"
    exit 0
fi

# Remove each worktree
for i in $(seq 0 $(($TASK_COUNT - 1))); do
    TASK_ID=$(jq -r ".tasks[$i].id" "$CONFIG_FILE")
    BRANCH_PREFIX=$(jq -r ".tasks[$i].branchPrefix // \"fix/\"" "$CONFIG_FILE")
    SANITIZED_TASK=$(echo "$TASK_ID" | sed 's/[^a-zA-Z0-9_\-]/-/g')
    BRANCH_NAME="${BRANCH_PREFIX}${SANITIZED_TASK}"
    WORKTREE_PATH="$WORKTREES_DIR/$SANITIZED_TASK"
    
    if [ -d "$WORKTREE_PATH" ]; then
        echo "Removing worktree: $TASK_ID"
        git worktree remove --force "$WORKTREE_PATH" || echo "Failed to remove $WORKTREE_PATH"
        
        echo "Delete branch $BRANCH_NAME? (y/N)"
        read -r delete_branch
        if [[ "$delete_branch" =~ ^[Yy]$ ]]; then
            git branch -D "$BRANCH_NAME" 2>/dev/null || echo "Failed to delete branch"
        fi
    fi
done

# Prune worktrees
git worktree prune
echo ""
echo "Cleanup complete!"
CLEANUP_EOF

chmod +x "$BASE_DIR/cleanup-worktrees.sh"

# Final summary
echo ""
log_success "Worktree setup complete!"
echo ""
echo "Created $TASK_COUNT worktrees in: $WORKTREES_DIR"
echo ""
echo "Next steps:"
echo "1. Launch Claude in each worktree:"
echo "   ./wt_tasks/launch-claude-terminals.sh"
echo ""
echo "2. Monitor progress:"
echo "   ./wt_tasks/monitor-progress.sh"
echo ""
echo "3. Clean up when done:"
echo "   ./cleanup-worktrees.sh"
echo ""
echo "Port allocations:"
for i in $(seq 0 $(($TASK_COUNT - 1))); do
    TASK_ID=$(jq -r ".tasks[$i].id" "$CONFIG_FILE")
    echo "  $TASK_ID: Main=$((ELECTRON_MAIN_PORT + i)), Renderer=$((ELECTRON_RENDERER_PORT + i)), Server=$((SERVER_PORT + i))"
done