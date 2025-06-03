#!/bin/bash
# create-pr-report-ai.sh - AI-enhanced PR report generator using Claude
# Uses Claude as a Unix utility for intelligent commit messages and PR descriptions

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
TASK_ID=""
USE_AI_COMMIT=true
USE_AI_PR=true
PUSH_TO_REMOTE=false
RUN_CHECKS=true
INTERACTIVE=false
AI_MODEL="claude"

# Function to print help
print_help() {
    cat << EOF
Usage: $0 [options]

AI-enhanced commit and PR creation using Claude as a Unix utility.

Options:
  -t, --task TASK_ID      Task ID (required, e.g., 'ts-module-errors')
  -i, --interactive       Review AI suggestions before using
  --no-ai-commit         Don't use AI for commit message
  --no-ai-pr            Don't use AI for PR description
  --push                Push changes to remote
  --no-checks          Skip pre-commit checks
  -h, --help           Show this help message

Examples:
  # Fully automated with AI
  $0 -t ts-module-errors --push

  # Interactive mode - review AI suggestions
  $0 -t ts-module-errors -i --push

  # Manual commit message, AI PR description
  $0 -t ts-module-errors --no-ai-commit

Environment Variables:
  CLAUDE_MODEL    Override Claude model (default: uses project config)

EOF
}

# Check if Claude is available
check_claude() {
    if ! command -v claude &> /dev/null; then
        log_error "Claude CLI not found. Please install: https://claude.ai/download"
        log_info "Falling back to manual mode"
        USE_AI_COMMIT=false
        USE_AI_PR=false
        return 1
    fi
    return 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--task)
            TASK_ID="$2"
            shift 2
            ;;
        -i|--interactive)
            INTERACTIVE=true
            shift
            ;;
        --no-ai-commit)
            USE_AI_COMMIT=false
            shift
            ;;
        --no-ai-pr)
            USE_AI_PR=false
            shift
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

# Check Claude availability
check_claude

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

# Get current branch
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)

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
    fi
fi

# Run pre-commit checks if enabled
if [ "$RUN_CHECKS" = true ]; then
    log_info "Running pre-commit checks..."
    
    # TypeScript check
    if command -v npm &> /dev/null && [ -f "package.json" ]; then
        if grep -q '"typecheck"' package.json; then
            log_info "Running TypeScript check..."
            npm run typecheck || log_warning "TypeScript check failed - continuing"
        fi
        
        if grep -q '"lint"' package.json; then
            log_info "Running ESLint..."
            npm run lint || log_warning "ESLint check failed - continuing"
        fi
    fi
fi

# Generate AI commit message
if [ "$USE_AI_COMMIT" = true ] && command -v claude &> /dev/null; then
    log_info "Generating AI commit message..."
    
    # Create prompt for Claude
    AI_COMMIT_PROMPT=$(cat << 'EOF'
You are a Git commit message generator following Conventional Commits specification.

Task context:
- Task ID: TASK_ID_PLACEHOLDER
- Task Name: TASK_NAME_PLACEHOLDER
- Category: CATEGORY_PLACEHOLDER

Changed files:
CHANGED_FILES_PLACEHOLDER

Git diff summary:
DIFF_SUMMARY_PLACEHOLDER

Generate a conventional commit message with:
1. Type (fix/feat/docs/style/refactor/perf/test/build/ci/chore)
2. Scope in parentheses (main/renderer/preload/test/docs)
3. Concise description (imperative mood, no period)
4. Optional body with details (if changes are complex)

Format exactly as:
<type>(<scope>): <description>

[optional body]

Output ONLY the commit message, nothing else.
EOF
)
    
    # Replace placeholders
    AI_COMMIT_PROMPT="${AI_COMMIT_PROMPT//TASK_ID_PLACEHOLDER/$TASK_ID}"
    AI_COMMIT_PROMPT="${AI_COMMIT_PROMPT//TASK_NAME_PLACEHOLDER/$TASK_NAME}"
    AI_COMMIT_PROMPT="${AI_COMMIT_PROMPT//CATEGORY_PLACEHOLDER/$CATEGORY}"
    AI_COMMIT_PROMPT="${AI_COMMIT_PROMPT//CHANGED_FILES_PLACEHOLDER/$CHANGED_FILES}"
    
    # Get diff summary
    DIFF_SUMMARY=$(git diff --cached --stat | head -20)
    AI_COMMIT_PROMPT="${AI_COMMIT_PROMPT//DIFF_SUMMARY_PLACEHOLDER/$DIFF_SUMMARY}"
    
    # Generate commit message with Claude
    COMMIT_MESSAGE=$(echo "$AI_COMMIT_PROMPT" | claude --output-format text)
    
    if [ "$INTERACTIVE" = true ]; then
        echo ""
        echo "AI-generated commit message:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "$COMMIT_MESSAGE"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Use this commit message? (Y/n/e to edit)"
        read -r response
        
        case "$response" in
            n|N)
                echo "Enter commit message manually:"
                read -r COMMIT_MESSAGE
                ;;
            e|E)
                # Create temp file for editing
                TEMP_FILE=$(mktemp)
                echo "$COMMIT_MESSAGE" > "$TEMP_FILE"
                ${EDITOR:-nano} "$TEMP_FILE"
                COMMIT_MESSAGE=$(cat "$TEMP_FILE")
                rm "$TEMP_FILE"
                ;;
        esac
    fi
else
    # Manual commit message
    echo "Enter commit message:"
    read -r COMMIT_MESSAGE
fi

# Commit changes
log_info "Committing changes..."
git commit -m "$COMMIT_MESSAGE" || {
    log_error "Commit failed"
    exit 1
}

COMMIT_HASH=$(git rev-parse HEAD)
log_success "Created commit: $COMMIT_HASH"

# Generate AI PR description
PR_DESCRIPTION=""
if [ "$USE_AI_PR" = true ] && command -v claude &> /dev/null; then
    log_info "Generating AI PR description..."
    
    # Create PR prompt
    AI_PR_PROMPT=$(cat << 'EOF'
You are a Pull Request description generator for a TypeScript/Electron project.

Task context:
- Task: TASK_NAME_PLACEHOLDER
- Description: TASK_DESC_PLACEHOLDER
- Branch: BRANCH_PLACEHOLDER
- Commit: COMMIT_MESSAGE_PLACEHOLDER

Changed files:
CHANGED_FILES_PLACEHOLDER

Recent commits in this branch:
RECENT_COMMITS_PLACEHOLDER

Generate a comprehensive PR description with these sections:
1. Summary (2-3 sentences about what changed and why)
2. Changes Made (bullet points of specific changes)
3. Testing (what was tested and how)
4. Checklist (relevant items only)

Be specific about TypeScript errors fixed, ESLint issues resolved, or tests repaired.
Reference specific error codes if applicable (e.g., TS2307, TS2532).

Output markdown format suitable for GitHub PRs.
EOF
)
    
    # Replace placeholders
    AI_PR_PROMPT="${AI_PR_PROMPT//TASK_NAME_PLACEHOLDER/$TASK_NAME}"
    AI_PR_PROMPT="${AI_PR_PROMPT//TASK_DESC_PLACEHOLDER/$TASK_DESC}"
    AI_PR_PROMPT="${AI_PR_PROMPT//BRANCH_PLACEHOLDER/$BRANCH_NAME}"
    AI_PR_PROMPT="${AI_PR_PROMPT//COMMIT_MESSAGE_PLACEHOLDER/$COMMIT_MESSAGE}"
    AI_PR_PROMPT="${AI_PR_PROMPT//CHANGED_FILES_PLACEHOLDER/$CHANGED_FILES}"
    
    # Get recent commits
    RECENT_COMMITS=$(git log --oneline -10 origin/main..HEAD 2>/dev/null || echo "First commit in branch")
    AI_PR_PROMPT="${AI_PR_PROMPT//RECENT_COMMITS_PLACEHOLDER/$RECENT_COMMITS}"
    
    # Generate PR description
    PR_DESCRIPTION=$(echo "$AI_PR_PROMPT" | claude --output-format text)
    
    if [ "$INTERACTIVE" = true ]; then
        echo ""
        echo "AI-generated PR description:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "$PR_DESCRIPTION"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Use this PR description? (Y/n/e to edit)"
        read -r response
        
        case "$response" in
            n|N)
                PR_DESCRIPTION=""
                ;;
            e|E)
                TEMP_FILE=$(mktemp)
                echo "$PR_DESCRIPTION" > "$TEMP_FILE"
                ${EDITOR:-nano} "$TEMP_FILE"
                PR_DESCRIPTION=$(cat "$TEMP_FILE")
                rm "$TEMP_FILE"
                ;;
        esac
    fi
fi

# Create PR report file
PR_REPORT_PATH="PR_REPORT_${TASK_ID}_$(date +%Y%m%d_%H%M%S).md"
log_info "Creating PR report: $PR_REPORT_PATH"

if [ -n "$PR_DESCRIPTION" ]; then
    # Use AI-generated description
    echo "$PR_DESCRIPTION" > "$PR_REPORT_PATH"
    
    # Append metadata
    cat >> "$PR_REPORT_PATH" << EOF

---

## Metadata

- **Task ID**: $TASK_ID
- **Branch**: $BRANCH_NAME
- **Commit**: \`$COMMIT_HASH\`
- **Generated**: $(date)
- **AI-Assisted**: Yes (Claude)

## Files Changed

\`\`\`
$CHANGED_FILES
\`\`\`
EOF
else
    # Fallback to template
    cat > "$PR_REPORT_PATH" << EOF
# $TASK_NAME

## Summary

Changes implemented for task: $TASK_DESC

## Commit

- **Hash**: \`$COMMIT_HASH\`
- **Message**: \`$COMMIT_MESSAGE\`

## Files Changed

\`\`\`
$CHANGED_FILES
\`\`\`

## Testing

- [ ] TypeScript compilation passes
- [ ] ESLint checks pass
- [ ] Related tests pass
- [ ] Manual testing completed

## References

- Task: $TASK_ID
- Branch: $BRANCH_NAME
EOF
fi

log_success "PR report created: $PR_REPORT_PATH"

# Push to remote if requested
if [ "$PUSH_TO_REMOTE" = true ]; then
    log_info "Pushing to remote..."
    if git push -u origin "$BRANCH_NAME"; then
        log_success "Pushed to origin/$BRANCH_NAME"
        
        # Generate PR creation command
        echo ""
        echo "Create PR with:"
        if command -v gh &> /dev/null; then
            # Extract title from commit message
            PR_TITLE=$(echo "$COMMIT_MESSAGE" | head -1)
            echo "gh pr create --title \"$PR_TITLE\" --body-file \"$PR_REPORT_PATH\""
        else
            echo "Create PR manually on GitHub using: $PR_REPORT_PATH"
        fi
    else
        log_error "Push failed"
        exit 1
    fi
fi

# Summary with metrics
echo ""
log_success "Complete!"
echo ""

# Show AI usage metrics if available
if [ "$USE_AI_COMMIT" = true ] || [ "$USE_AI_PR" = true ]; then
    echo "AI Assistance Used:"
    [ "$USE_AI_COMMIT" = true ] && echo "  ✓ Commit message generated by Claude"
    [ "$USE_AI_PR" = true ] && echo "  ✓ PR description generated by Claude"
    echo ""
fi

echo "Next steps:"
echo "1. Review PR report: $PR_REPORT_PATH"
if [ "$PUSH_TO_REMOTE" = false ]; then
    echo "2. Push changes: git push -u origin $BRANCH_NAME"
fi
echo "3. Create PR on GitHub"