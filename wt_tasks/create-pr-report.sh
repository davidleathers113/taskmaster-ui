#!/bin/bash
# create-pr-report.sh - Enhanced PR report generator for TaskMaster UI
# Follows 2025 best practices and conventional commit standards

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

# Default values
DEFAULT_PREFIX=""
COMMIT_MESSAGE=""
TASK_ID=""
PR_DESCRIPTION=""
PUSH_TO_REMOTE=false
RUN_CHECKS=true
SCOPE=""

# Function to print help
print_help() {
    cat << EOF
Usage: $0 [options]

Create commit and generate PR report following conventional commit standards.

Options:
  -t, --task TASK_ID      Task ID (required, e.g., 'ts-module-errors')
  -m, --message MESSAGE   Commit message (without type/scope)
  -s, --scope SCOPE       Commit scope (e.g., 'main', 'renderer', 'preload')
  -d, --description DESC  PR description
  --type TYPE            Commit type (default: auto-detected)
  --push                 Push changes to remote
  --no-checks           Skip pre-commit checks
  -h, --help            Show this help message

Commit Types:
  feat     New feature
  fix      Bug fix
  docs     Documentation only
  style    Code style (formatting, semicolons, etc)
  refactor Code change that neither fixes nor adds feature
  perf     Performance improvement
  test     Adding/correcting tests
  build    Build system or dependencies
  ci       CI configuration
  chore    Other changes

Example:
  $0 -t ts-module-errors -s renderer -m "resolve missing module imports" \\
     -d "Fixed all TS2307 errors in renderer process" --push

Conventional Commit Format:
  <type>(<scope>): <subject>
  
  Example: fix(renderer): resolve missing module imports
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--task)
            TASK_ID="$2"
            shift 2
            ;;
        -m|--message)
            COMMIT_MESSAGE="$2"
            shift 2
            ;;
        -s|--scope)
            SCOPE="$2"
            shift 2
            ;;
        -d|--description)
            PR_DESCRIPTION="$2"
            shift 2
            ;;
        --type)
            COMMIT_TYPE="$2"
            shift 2
            ;;
        --push)
            PUSH_TO_REMOTE=true
            shift
            ;;
        --no-checks)
            RUN_CHECKS=false
            shift
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            print_help
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$TASK_ID" ]; then
    log_error "Task ID is required"
    print_help
    exit 1
fi

if [ -z "$COMMIT_MESSAGE" ]; then
    log_error "Commit message is required"
    print_help
    exit 1
fi

# Load configuration
CONFIG_FILE="$(git rev-parse --show-toplevel)/wt_tasks/wt_config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    log_error "Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Get task details
TASK_JSON=$(jq -r ".tasks[] | select(.id == \"$TASK_ID\")" "$CONFIG_FILE")
if [ -z "$TASK_JSON" ]; then
    log_error "Task not found: $TASK_ID"
    exit 1
fi

TASK_NAME=$(echo "$TASK_JSON" | jq -r '.name')
TASK_DESC=$(echo "$TASK_JSON" | jq -r '.description')
CATEGORY=$(echo "$TASK_JSON" | jq -r '.category // "general"')

# Auto-detect commit type if not provided
if [ -z "${COMMIT_TYPE:-}" ]; then
    case "$CATEGORY" in
        typescript)
            COMMIT_TYPE="fix"
            ;;
        testing)
            COMMIT_TYPE="test"
            ;;
        code-quality)
            COMMIT_TYPE="chore"
            ;;
        infrastructure)
            COMMIT_TYPE="ci"
            ;;
        *)
            COMMIT_TYPE="fix"
            ;;
    esac
fi

# Auto-detect scope if not provided
if [ -z "$SCOPE" ]; then
    # Try to determine scope from changed files
    CHANGED_FILES=$(git diff --name-only --cached || git diff --name-only)
    if echo "$CHANGED_FILES" | grep -q "src/main/"; then
        SCOPE="main"
    elif echo "$CHANGED_FILES" | grep -q "src/renderer/"; then
        SCOPE="renderer"
    elif echo "$CHANGED_FILES" | grep -q "src/preload/"; then
        SCOPE="preload"
    elif echo "$CHANGED_FILES" | grep -q "tests/"; then
        SCOPE="test"
    else
        SCOPE=$(echo "$CATEGORY" | tr '[:upper:]' '[:lower:]')
    fi
fi

# Get current branch
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH_NAME" = "HEAD" ]; then
    log_error "Not on a branch"
    exit 1
fi

# Check for changes
CHANGED_FILES=$(git diff --name-only --cached)
if [ -z "$CHANGED_FILES" ]; then
    CHANGED_FILES=$(git diff --name-only)
    if [ -z "$CHANGED_FILES" ]; then
        log_warning "No changes detected"
        exit 0
    else
        log_info "Staging all changes..."
        git add -A
        CHANGED_FILES=$(git diff --name-only --cached)
    fi
fi

# Count changes by type
TS_FILES=$(echo "$CHANGED_FILES" | grep -E '\.(ts|tsx)$' | wc -l || echo 0)
TEST_FILES=$(echo "$CHANGED_FILES" | grep -E '\.(test|spec)\.(ts|tsx)$' | wc -l || echo 0)
CONFIG_FILES=$(echo "$CHANGED_FILES" | grep -E '\.(json|js|yml|yaml)$' | wc -l || echo 0)

# Run pre-commit checks if enabled
if [ "$RUN_CHECKS" = true ]; then
    log_info "Running pre-commit checks..."
    
    # TypeScript check
    if [ $TS_FILES -gt 0 ] && [ -f "package.json" ]; then
        log_info "Running TypeScript check..."
        if ! npm run typecheck; then
            log_error "TypeScript check failed"
            exit 1
        fi
    fi
    
    # ESLint check
    if [ -f "package.json" ] && grep -q '"lint"' package.json; then
        log_info "Running ESLint..."
        if ! npm run lint; then
            log_warning "ESLint check failed - continuing anyway"
        fi
    fi
fi

# Build conventional commit message
FULL_COMMIT_MESSAGE="${COMMIT_TYPE}(${SCOPE}): ${COMMIT_MESSAGE}"

# Add breaking change marker if needed
if [[ "$COMMIT_MESSAGE" =~ "BREAKING" ]]; then
    FULL_COMMIT_MESSAGE="${COMMIT_TYPE}(${SCOPE})!: ${COMMIT_MESSAGE}"
fi

# Get metrics before commit
if [ -f "package.json" ]; then
    TS_ERRORS_BEFORE=$(npm run typecheck 2>&1 | grep -E "error TS[0-9]+" | wc -l || echo "0")
    ESLINT_BEFORE=$(npm run lint 2>&1 | grep -E "[0-9]+ problems?" | grep -oE "[0-9]+" | head -1 || echo "0")
else
    TS_ERRORS_BEFORE="N/A"
    ESLINT_BEFORE="N/A"
fi

# Commit changes
log_info "Committing: $FULL_COMMIT_MESSAGE"
git commit -m "$FULL_COMMIT_MESSAGE" || {
    log_error "Commit failed"
    exit 1
}

COMMIT_HASH=$(git rev-parse HEAD)
log_success "Created commit: $COMMIT_HASH"

# Generate detailed file analysis
FILE_ANALYSIS=""
for file in $CHANGED_FILES; do
    ADDITIONS=$(git diff --cached "$file" 2>/dev/null | grep -c "^+" || echo 0)
    DELETIONS=$(git diff --cached "$file" 2>/dev/null | grep -c "^-" || echo 0)
    FILE_ANALYSIS="$FILE_ANALYSIS\n- \`$file\` (+$ADDITIONS/-$DELETIONS)"
done

# Create PR report
PR_REPORT_PATH="PR_REPORT_${TASK_ID}_$(date +%Y%m%d_%H%M%S).md"
log_info "Generating PR report: $PR_REPORT_PATH"

cat > "$PR_REPORT_PATH" << EOF
# PR: $TASK_NAME

## Summary

${PR_DESCRIPTION:-"Implemented fixes for $TASK_NAME as part of the TaskMaster UI quality improvement initiative."}

## Changes Made

### Commit Details
- **Commit**: \`$COMMIT_HASH\`
- **Message**: \`$FULL_COMMIT_MESSAGE\`
- **Type**: $COMMIT_TYPE
- **Scope**: $SCOPE
- **Branch**: $BRANCH_NAME

### Files Changed (${#CHANGED_FILES[@]} files)
$(echo -e "$FILE_ANALYSIS")

### Statistics
- TypeScript files: $TS_FILES
- Test files: $TEST_FILES
- Config files: $CONFIG_FILES

## Task Context

**Task ID**: $TASK_ID  
**Category**: $CATEGORY  
**Description**: $TASK_DESC

## Quality Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| TypeScript Errors | $TS_ERRORS_BEFORE | TBD | TBD |
| ESLint Problems | $ESLINT_BEFORE | TBD | TBD |

## Testing

- [ ] All TypeScript errors in scope have been resolved
- [ ] No new TypeScript errors introduced
- [ ] ESLint passes or warnings are acceptable
- [ ] Existing tests still pass
- [ ] Application builds successfully
- [ ] Manual testing completed where applicable

## Verification Commands

\`\`\`bash
# Verify TypeScript
npm run typecheck

# Verify ESLint
npm run lint

# Run tests
npm test

# Build application
npm run build
\`\`\`

## Review Checklist

- [ ] Code follows project conventions
- [ ] Changes are focused on the task scope
- [ ] No unrelated changes included
- [ ] Commit message follows conventional format
- [ ] PR description is clear and complete

## References

- Task Configuration: [\`wt_tasks/wt_config.json\`](../wt_tasks/wt_config.json)
- Project Guidelines: [\`CLAUDE.md\`](../CLAUDE.md)
- Git Workflow: [Mandatory practices in CLAUDE.md](../CLAUDE.md#mandatory-git-workflow-practices)

---
*Generated on $(date) by create-pr-report.sh*
EOF

log_success "PR report generated: $PR_REPORT_PATH"

# Push to remote if requested
if [ "$PUSH_TO_REMOTE" = true ]; then
    log_info "Pushing to remote..."
    if git push -u origin "$BRANCH_NAME"; then
        log_success "Pushed to origin/$BRANCH_NAME"
        
        # Generate PR creation command
        echo ""
        echo "Create PR with:"
        echo "gh pr create --title \"$FULL_COMMIT_MESSAGE\" --body-file \"$PR_REPORT_PATH\""
    else
        log_error "Push failed"
        exit 1
    fi
fi

# Summary
echo ""
log_success "Done!"
echo ""
echo "Next steps:"
echo "1. Review the PR report: $PR_REPORT_PATH"
echo "2. Update metrics in the report after verification"
if [ "$PUSH_TO_REMOTE" = false ]; then
    echo "3. Push changes: git push -u origin $BRANCH_NAME"
    echo "4. Create PR on GitHub"
else
    echo "3. Create PR: gh pr create --title \"$FULL_COMMIT_MESSAGE\" --body-file \"$PR_REPORT_PATH\""
fi