#!/bin/bash
# verify-shared-files.sh - Verify that shared files configuration is complete

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

CONFIG_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wt_config.json"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log_info "Verifying shared files configuration"
log_info "Config: $CONFIG_FILE"
log_info "Base directory: $BASE_DIR"

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    log_error "Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Read shared files from config
SHARED_FILES=($(jq -r '.worktrees.sharedFiles[]' "$CONFIG_FILE"))
log_info "Found ${#SHARED_FILES[@]} shared files in configuration"

# Verify each file exists
echo ""
log_info "Checking shared files..."
MISSING_FILES=()
EXISTING_FILES=()
TOTAL_SIZE=0

for file in "${SHARED_FILES[@]}"; do
    FILE_PATH="$BASE_DIR/$file"
    
    if [ -f "$FILE_PATH" ]; then
        SIZE=$(stat -f%z "$FILE_PATH" 2>/dev/null || echo 0)
        TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
        EXISTING_FILES+=("$file")
        echo "  ✓ $file ($(numfmt --to=iec $SIZE))"
    elif [ -d "$FILE_PATH" ]; then
        SIZE=$(du -sb "$FILE_PATH" 2>/dev/null | cut -f1 || echo 0)
        TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
        EXISTING_FILES+=("$file")
        echo "  ✓ $file/ (directory, $(numfmt --to=iec $SIZE))"
    else
        MISSING_FILES+=("$file")
        echo "  ✗ $file (not found)"
    fi
done

echo ""

# Summary
if [ ${#MISSING_FILES[@]} -eq 0 ]; then
    log_success "All ${#EXISTING_FILES[@]} shared files/directories exist"
else
    log_warning "${#MISSING_FILES[@]} shared files/directories are missing:"
    for missing in "${MISSING_FILES[@]}"; do
        echo "    - $missing"
    done
fi

echo ""
log_info "Total size of shared files: $(numfmt --to=iec $TOTAL_SIZE)"

# Check for essential files that might be missing
echo ""
log_info "Checking for essential development files..."

ESSENTIAL_FILES=(
    "package.json"
    "tsconfig.json"
    "eslint.config.js"
    "vitest.config.ts"
    "electron.vite.config.ts"
)

MISSING_ESSENTIAL=()
for essential in "${ESSENTIAL_FILES[@]}"; do
    if [[ ! " ${EXISTING_FILES[*]} " =~ " ${essential} " ]]; then
        MISSING_ESSENTIAL+=("$essential")
    fi
done

if [ ${#MISSING_ESSENTIAL[@]} -eq 0 ]; then
    log_success "All essential development files are included"
else
    log_error "Missing essential files:"
    for missing in "${MISSING_ESSENTIAL[@]}"; do
        echo "    - $missing"
    done
fi

# Check for potential additional files that should be shared
echo ""
log_info "Checking for potentially missing development files..."

POTENTIAL_FILES=(
    ".husky"
    ".github"
    ".vscode"
    "docs"
    "public"
    "build-electron.sh"
    "run-dev.sh"
    "run-app.sh"
)

SUGGESTED_ADDITIONS=()
for potential in "${POTENTIAL_FILES[@]}"; do
    if [ -e "$BASE_DIR/$potential" ] && [[ ! " ${EXISTING_FILES[*]} " =~ " ${potential} " ]]; then
        SUGGESTED_ADDITIONS+=("$potential")
    fi
done

if [ ${#SUGGESTED_ADDITIONS[@]} -gt 0 ]; then
    log_info "Consider adding these files/directories:"
    for suggestion in "${SUGGESTED_ADDITIONS[@]}"; do
        echo "    - $suggestion"
    done
else
    log_success "No additional files suggested"
fi

# Test worktree functionality readiness
echo ""
log_info "Testing worktree readiness..."

# Check if package.json has required scripts
if [ -f "$BASE_DIR/package.json" ]; then
    REQUIRED_SCRIPTS=("typecheck" "lint" "dev" "build")
    MISSING_SCRIPTS=()
    
    for script in "${REQUIRED_SCRIPTS[@]}"; do
        if ! jq -e ".scripts[\"$script\"]" "$BASE_DIR/package.json" >/dev/null 2>&1; then
            MISSING_SCRIPTS+=("$script")
        fi
    done
    
    if [ ${#MISSING_SCRIPTS[@]} -eq 0 ]; then
        log_success "All required npm scripts are present"
    else
        log_warning "Missing npm scripts: ${MISSING_SCRIPTS[*]}"
    fi
else
    log_error "package.json not found in shared files"
fi

# Final recommendation
echo ""
if [ ${#MISSING_FILES[@]} -eq 0 ] && [ ${#MISSING_ESSENTIAL[@]} -eq 0 ]; then
    log_success "Shared files configuration looks good for worktree development!"
    echo ""
    echo "Each worktree will have:"
    echo "  - All TypeScript/JavaScript build configuration"
    echo "  - All testing setup and configuration"
    echo "  - All linting and code quality tools"
    echo "  - Project documentation and guidelines"
    echo "  - Development utilities and scripts"
    echo ""
    echo "Total overhead per worktree: $(numfmt --to=iec $TOTAL_SIZE)"
else
    log_error "Configuration needs improvement before creating worktrees"
    exit 1
fi