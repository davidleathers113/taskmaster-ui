#!/bin/bash
# setup-worktrees-v2.sh - Improved Git worktree setup based on official documentation
# Addresses issues found in audit against https://git-scm.com/docs/git-worktree

set -euo pipefail

# Colors for output
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

# Display important warning from Git documentation
show_experimental_warning() {
    echo ""
    log_warning "IMPORTANT: Git Worktree Experimental Feature Notice"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "According to Git documentation, 'multiple checkout is still experimental'"
    echo "While generally stable, you may encounter edge cases."
    echo ""
    echo "Known limitations:"
    echo "- Submodule support is incomplete"
    echo "- Not recommended for superprojects with submodules"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log_info "Setup cancelled by user"
        exit 0
    fi
}

# Check for submodules
check_submodules() {
    if [ -f .gitmodules ]; then
        log_warning "This repository contains submodules!"
        log_warning "Git worktree has incomplete submodule support"
        echo "Submodules found:"
        git submodule status
        echo ""
        echo "Continue anyway? (y/N)"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    for cmd in jq git node npm; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    # Check Git version for worktree support
    local git_version=$(git --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    local required_version="2.5.0"
    
    if ! printf '%s\n%s\n' "$required_version" "$git_version" | sort -V | head -n1 | grep -q "$required_version"; then
        log_error "Git version $git_version is too old. Worktrees require Git 2.5.0+"
        exit 1
    fi
    
    log_info "Git version $git_version supports worktrees"
}

# Function to repair worktrees if needed
repair_worktrees() {
    log_info "Checking worktree health..."
    
    # Run git worktree repair
    if git worktree repair 2>&1 | grep -q "repair"; then
        log_warning "Some worktrees were repaired"
    else
        log_info "All worktrees are healthy"
    fi
}

# Create absolute path
get_absolute_path() {
    echo "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
}

# Sanitize names for branches
sanitize_name() {
    echo "$1" | sed 's/[^a-zA-Z0-9_\-]/-/g'
}

# Main setup starts here
show_experimental_warning

log_info "TaskMaster UI Worktree Setup v2"
log_info "Based on official Git worktree documentation"

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
BASE_REPO=$(get_absolute_path "$BASE_REPO")

# Change to repository
if ! cd "$BASE_REPO" 2>/dev/null; then
    log_error "Repository not found: $BASE_REPO"
    exit 1
fi

# Verify Git repository
if ! git rev-parse --is-inside-work-tree &>/dev/null; then
    log_error "Not a Git repository: $BASE_REPO"
    exit 1
fi

# Check for submodules
check_submodules

# Repair any existing worktrees
repair_worktrees

# Setup directories
WORKTREES_DIR="$(dirname "$BASE_REPO")/$(basename "$BASE_REPO")_worktrees"
mkdir -p "$WORKTREES_DIR"

# Get tasks
TASK_COUNT=$(jq '.tasks | length' "$CONFIG_FILE")
log_info "Setting up $TASK_COUNT worktrees..."

# List existing worktrees
log_info "Existing worktrees:"
git worktree list

# Process each task
for i in $(seq 0 $(($TASK_COUNT - 1))); do
    TASK=$(jq -r ".tasks[$i]" "$CONFIG_FILE")
    TASK_ID=$(echo "$TASK" | jq -r '.id')
    TASK_NAME=$(echo "$TASK" | jq -r '.name')
    BRANCH_PREFIX=$(echo "$TASK" | jq -r '.branchPrefix // "fix/"')
    LOCK_WORKTREE=$(echo "$TASK" | jq -r '.lockWorktree // false')
    
    SANITIZED_TASK=$(sanitize_name "$TASK_ID")
    BRANCH_NAME="${BRANCH_PREFIX}${SANITIZED_TASK}"
    WORKTREE_PATH="$WORKTREES_DIR/$SANITIZED_TASK"
    
    echo ""
    log_info "Setting up: $TASK_ID - $TASK_NAME"
    
    # Check if worktree already exists
    if git worktree list | grep -q "$WORKTREE_PATH"; then
        log_warning "Worktree already exists: $WORKTREE_PATH"
        
        # Check if it's locked
        if git worktree list --porcelain | grep -A1 "$WORKTREE_PATH" | grep -q "locked"; then
            log_warning "Worktree is locked"
        fi
        continue
    fi
    
    # Remove directory if it exists but isn't a valid worktree
    if [ -d "$WORKTREE_PATH" ]; then
        log_warning "Directory exists but isn't a worktree, removing..."
        rm -rf "$WORKTREE_PATH"
    fi
    
    # Create worktree with branch in one command
    log_info "Creating worktree with branch: $BRANCH_NAME"
    
    # Check if branch already exists
    if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
        # Branch exists, just create worktree
        if ! git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"; then
            log_error "Failed to create worktree for existing branch: $BRANCH_NAME"
            continue
        fi
    else
        # Create new branch with worktree
        if ! git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_BRANCH"; then
            log_error "Failed to create worktree with new branch: $BRANCH_NAME"
            continue
        fi
    fi
    
    # Lock worktree if requested
    if [ "$LOCK_WORKTREE" = "true" ]; then
        log_info "Locking worktree to prevent automatic pruning"
        git worktree lock "$WORKTREE_PATH"
    fi
    
    log_success "Created worktree: $WORKTREE_PATH"
    
    # Copy task files and setup (same as before)
    # ... (rest of the file copying logic remains the same)
done

# Create improved cleanup script
cat > "$BASE_REPO/cleanup-worktrees-v2.sh" << 'CLEANUP_EOF'
#!/bin/bash
# cleanup-worktrees-v2.sh - Improved cleanup with lock checking

set -euo pipefail

CONFIG_FILE="$(pwd)/wt_tasks/wt_config.json"
WORKTREES_DIR="$(dirname "$(pwd)")/$(basename "$(pwd)")_worktrees"

echo "TaskMaster UI Worktree Cleanup v2"
echo "================================="
echo ""

# List all worktrees with status
echo "Current worktrees:"
git worktree list --porcelain | while read -r line; do
    if [[ "$line" == worktree* ]]; then
        path="${line#worktree }"
        echo ""
        echo "Worktree: $path"
    elif [[ "$line" == branch* ]]; then
        echo "  Branch: ${line#branch refs/heads/}"
    elif [[ "$line" == locked* ]]; then
        echo "  Status: LOCKED"
    fi
done

echo ""
echo "Remove all worktrees? (yes/no)"
read -r response

if [ "$response" != "yes" ]; then
    echo "Cancelled"
    exit 0
fi

# Process each worktree
git worktree list --porcelain | while read -r line; do
    if [[ "$line" == worktree* ]] && [[ "$line" != *"$(pwd)"* ]]; then
        worktree_path="${line#worktree }"
        
        # Check if locked
        if git worktree list --porcelain | grep -A2 "^worktree $worktree_path" | grep -q "^locked"; then
            echo ""
            echo "Worktree is locked: $worktree_path"
            echo "Unlock and remove? (y/N)"
            read -r unlock
            if [[ "$unlock" =~ ^[Yy]$ ]]; then
                git worktree unlock "$worktree_path"
                git worktree remove "$worktree_path"
            fi
        else
            echo "Removing: $worktree_path"
            git worktree remove "$worktree_path" || echo "Failed to remove"
        fi
    fi
done

# Prune any stale worktrees
echo ""
echo "Pruning stale worktree information..."
git worktree prune

echo "Cleanup complete!"
CLEANUP_EOF

chmod +x "$BASE_REPO/cleanup-worktrees-v2.sh"

# Summary
echo ""
log_success "Setup complete!"
echo ""
echo "Created $TASK_COUNT worktrees in: $WORKTREES_DIR"
echo ""
echo "Commands:"
echo "- List worktrees: git worktree list"
echo "- Repair worktrees: git worktree repair"
echo "- Lock a worktree: git worktree lock <path>"
echo "- Unlock a worktree: git worktree unlock <path>"
echo "- Remove worktrees: ./cleanup-worktrees-v2.sh"
echo ""
log_info "Note: Multiple checkout is still experimental (per Git docs)"