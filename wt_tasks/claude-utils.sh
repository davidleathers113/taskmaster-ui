#!/bin/bash
# claude-utils.sh - Claude AI utilities for development workflow
# Collection of Claude-powered Unix utilities for TaskMaster UI

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to check if Claude is available
check_claude() {
    if ! command -v claude &> /dev/null; then
        echo "Error: Claude CLI not found. Install from: https://claude.ai/download" >&2
        return 1
    fi
    return 0
}

# Analyze TypeScript errors with Claude
analyze_ts_errors() {
    check_claude || return 1
    
    echo -e "${BLUE}Analyzing TypeScript errors with Claude...${NC}"
    
    npm run typecheck 2>&1 | claude -p 'You are a TypeScript expert. Analyze these TypeScript errors and provide:
1. Summary of error types and counts
2. Root causes of the most common errors
3. Prioritized fix order (easiest to hardest)
4. Code patterns that would prevent these errors

Format as markdown with clear sections.' --output-format text
}

# Review code changes before commit
review_changes() {
    check_claude || return 1
    
    echo -e "${BLUE}Reviewing staged changes with Claude...${NC}"
    
    git diff --cached | claude -p 'You are a code reviewer. Review these changes and provide:
1. Summary of what changed
2. Potential issues or bugs
3. Suggestions for improvement
4. Security concerns (if any)

Be concise but thorough. Use markdown format.' --output-format text
}

# Generate test cases for a file
generate_tests() {
    local file=$1
    
    if [ -z "$file" ]; then
        echo "Usage: generate_tests <file_path>" >&2
        return 1
    fi
    
    check_claude || return 1
    
    echo -e "${BLUE}Generating test cases for $file...${NC}"
    
    cat "$file" | claude -p "You are a test engineer. Generate comprehensive test cases for this TypeScript/JavaScript file.

Include:
1. Unit tests for each function/method
2. Edge cases and error conditions
3. Integration test scenarios (if applicable)
4. Mock setup (if external dependencies exist)

Use the project's testing framework (Vitest for unit tests, Playwright for E2E).
Output valid test code that can be directly used." --output-format text
}

# Explain complex code
explain_code() {
    local file=$1
    local line_start=${2:-1}
    local line_end=${3:-$((line_start + 20))}
    
    if [ -z "$file" ]; then
        echo "Usage: explain_code <file> [start_line] [end_line]" >&2
        return 1
    fi
    
    check_claude || return 1
    
    echo -e "${BLUE}Explaining code from $file:$line_start-$line_end...${NC}"
    
    sed -n "${line_start},${line_end}p" "$file" | claude -p 'You are a senior developer. Explain this code:
1. What it does (high level)
2. How it works (implementation details)
3. Why it might be written this way
4. Potential improvements

Be clear and educational. Assume the reader knows TypeScript basics.' --output-format text
}

# Suggest refactoring for a file
suggest_refactor() {
    local file=$1
    
    if [ -z "$file" ]; then
        echo "Usage: suggest_refactor <file_path>" >&2
        return 1
    fi
    
    check_claude || return 1
    
    echo -e "${BLUE}Analyzing $file for refactoring opportunities...${NC}"
    
    cat "$file" | claude -p 'You are a refactoring expert. Analyze this code and suggest refactoring to improve:
1. Code readability and maintainability
2. Performance (if applicable)
3. Type safety
4. Compliance with modern TypeScript/React patterns

Provide specific before/after code examples for each suggestion.
Prioritize suggestions by impact.' --output-format text
}

# Generate documentation from code
generate_docs() {
    local file=$1
    
    if [ -z "$file" ]; then
        echo "Usage: generate_docs <file_path>" >&2
        return 1
    fi
    
    check_claude || return 1
    
    echo -e "${BLUE}Generating documentation for $file...${NC}"
    
    cat "$file" | claude -p 'You are a technical writer. Generate comprehensive documentation for this code:
1. Overview and purpose
2. API documentation (all public functions/classes)
3. Usage examples
4. Configuration options (if any)
5. Common patterns and best practices

Use JSDoc format for inline comments and markdown for external docs.' --output-format text
}

# Analyze PR for review
analyze_pr() {
    local pr_number=$1
    
    if [ -z "$pr_number" ]; then
        echo "Usage: analyze_pr <pr_number>" >&2
        return 1
    fi
    
    check_claude || return 1
    
    echo -e "${BLUE}Analyzing PR #$pr_number...${NC}"
    
    # Requires gh CLI
    if ! command -v gh &> /dev/null; then
        echo "Error: GitHub CLI (gh) required" >&2
        return 1
    fi
    
    gh pr diff "$pr_number" | claude -p 'You are a PR reviewer. Analyze this pull request and provide:
1. Summary of changes and their impact
2. Code quality assessment
3. Potential bugs or issues
4. Security implications
5. Suggestions for improvement
6. Overall recommendation (approve/request changes)

Be thorough but constructive.' --output-format text
}

# Quick type check for current changes
type_check_changes() {
    check_claude || return 1
    
    echo -e "${BLUE}Type checking current changes...${NC}"
    
    # Get list of changed TypeScript files
    CHANGED_TS_FILES=$(git diff --name-only --diff-filter=AM | grep -E '\.(ts|tsx)$' || true)
    
    if [ -z "$CHANGED_TS_FILES" ]; then
        echo "No TypeScript files changed"
        return 0
    fi
    
    # Create a focused prompt
    echo "$CHANGED_TS_FILES" | claude -p 'You are a TypeScript linter. These files have been modified:

<files>
stdin
</files>

For each file, identify:
1. Potential type errors
2. Missing type annotations
3. Any type safety concerns

Provide specific line numbers if possible.' --output-format text
}

# Generate conventional commit message from staged changes
generate_commit() {
    check_claude || return 1
    
    echo -e "${BLUE}Generating commit message...${NC}"
    
    # Get diff and file list
    DIFF_STAT=$(git diff --cached --stat)
    DIFF_CONTENT=$(git diff --cached | head -500)  # Limit size
    
    echo -e "Files changed:\n$DIFF_STAT\n\nDiff sample:\n$DIFF_CONTENT" | \
    claude -p 'Generate a conventional commit message for these changes.

Rules:
- Format: <type>(<scope>): <description>
- Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
- Scope: main, renderer, preload, test, config, etc.
- Description: imperative mood, no period, under 50 chars
- Include body if changes are complex

Output ONLY the commit message.' --output-format text
}

# Main menu if script is run directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    echo -e "${GREEN}Claude Development Utilities${NC}"
    echo "================================"
    echo "1. Analyze TypeScript errors"
    echo "2. Review staged changes"
    echo "3. Generate tests for a file"
    echo "4. Explain code section"
    echo "5. Suggest refactoring"
    echo "6. Generate documentation"
    echo "7. Analyze PR"
    echo "8. Type check changes"
    echo "9. Generate commit message"
    echo "0. Exit"
    echo ""
    echo -n "Select option: "
    read -r option
    
    case $option in
        1) analyze_ts_errors ;;
        2) review_changes ;;
        3) 
            echo -n "Enter file path: "
            read -r file
            generate_tests "$file"
            ;;
        4)
            echo -n "Enter file path: "
            read -r file
            echo -n "Start line (default 1): "
            read -r start
            echo -n "End line (default start+20): "
            read -r end
            explain_code "$file" "${start:-1}" "${end:-}"
            ;;
        5)
            echo -n "Enter file path: "
            read -r file
            suggest_refactor "$file"
            ;;
        6)
            echo -n "Enter file path: "
            read -r file
            generate_docs "$file"
            ;;
        7)
            echo -n "Enter PR number: "
            read -r pr
            analyze_pr "$pr"
            ;;
        8) type_check_changes ;;
        9) generate_commit ;;
        0) exit 0 ;;
        *) echo "Invalid option" ;;
    esac
fi