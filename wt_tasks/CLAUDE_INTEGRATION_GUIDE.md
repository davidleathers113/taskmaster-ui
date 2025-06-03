# Claude AI Integration Guide

## Overview

This guide shows how to use Claude as a Unix-style utility in your development workflow. Claude integrates seamlessly into scripts, build processes, and git hooks to provide AI-powered assistance.

## Installation Requirements

1. **Claude CLI**: Install from https://claude.ai/download
2. **Verify Installation**: `claude --version`
3. **Authentication**: Follow setup instructions from Claude

## Available Commands

### Package.json Scripts

```bash
# AI-powered linting of staged changes
npm run lint:claude

# Review staged changes before commit
npm run review:staged

# AI-assisted commit and PR creation
npm run commit:ai -- -t [task-id]

# Analyze TypeScript errors with AI insights
npm run analyze:ts

# Generate documentation for code files
npm run docs:generate -- [file-path]
```

### Claude Utilities

Source the utilities: `. ./wt_tasks/claude-utils.sh`

```bash
# Analyze TypeScript compilation errors
analyze_ts_errors

# Review staged git changes
review_changes

# Generate comprehensive test cases
generate_tests src/components/TaskCard.tsx

# Explain complex code sections
explain_code src/store/useTaskStore.ts 45 65

# Get refactoring suggestions
suggest_refactor src/main/index.ts

# Generate JSDoc and markdown documentation
generate_docs src/lib/utils.ts

# Analyze a GitHub PR
analyze_pr 123

# Type check only changed files
type_check_changes

# Generate conventional commit message
generate_commit
```

## Integration Patterns

### 1. Pre-commit Hook with Claude

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
# Run standard checks
npm run typecheck || exit 1
npm run lint || exit 1

# AI review of changes
echo "🤖 Claude reviewing staged changes..."
npm run lint:claude

# Ask for confirmation if issues found
echo "Continue with commit? (y/N)"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    exit 1
fi
```

### 2. Build Script Integration

Add to your CI pipeline:

```yaml
# .github/workflows/ai-review.yml
- name: AI Code Review
  run: |
    git diff HEAD~1..HEAD | claude -p 'Review this diff for potential issues. Focus on security, performance, and maintainability.' --output-format json > ai-review.json

- name: Upload AI Review
  uses: actions/upload-artifact@v3
  with:
    name: ai-review
    path: ai-review.json
```

### 3. Error Analysis Pipeline

```bash
# Pipe TypeScript errors to Claude
npm run typecheck 2>&1 | claude -p 'Categorize these TypeScript errors by type and suggest fix priorities' > ts-analysis.md

# Pipe ESLint output to Claude
npm run lint 2>&1 | claude -p 'Summarize ESLint issues and suggest automated fixes' > lint-analysis.md
```

### 4. Interactive Development

```bash
# Quick code explanation
cat src/complex-function.ts | claude -p 'Explain this code step by step'

# Get test suggestions
cat src/utils/helpers.ts | claude -p 'Generate unit tests for these utility functions' > tests/helpers.test.ts

# Code review of specific files
git diff HEAD~1 -- src/components/ | claude -p 'Review these component changes'
```

## Advanced Usage

### Custom Prompts for Specific Tasks

```bash
# TypeScript error analysis
alias ts-fix="npm run typecheck 2>&1 | claude -p 'For each TypeScript error, provide: 1) Root cause 2) Exact fix with code 3) Prevention strategy' --output-format text"

# Security review
alias security-check="git diff --cached | claude -p 'Security audit: find potential vulnerabilities in this code' --output-format json"

# Performance analysis
alias perf-check="git diff --cached | claude -p 'Analyze for performance issues and suggest optimizations' --output-format text"
```

### JSON Output Processing

```bash
# Get structured analysis
git diff --cached | claude -p 'Analyze code changes' --output-format json > analysis.json

# Process with jq
cat analysis.json | jq '.messages[].content' | grep -i "security"
```

### Streaming for Large Files

```bash
# Real-time analysis of large logs
tail -f debug.log | claude -p 'Monitor this log for errors and anomalies' --output-format stream-json
```

## Task-Specific Workflows

### TypeScript Error Resolution

```bash
# 1. Analyze all errors
npm run analyze:ts > ts-insights.md

# 2. Focus on specific error types
npm run typecheck 2>&1 | grep "TS2307" | claude -p 'Fix these module resolution errors' --output-format text

# 3. Generate fixes
cat problematic-file.ts | claude -p 'Fix TypeScript errors in this file, maintain functionality' --output-format text > fixed-file.ts
```

### Test Development

```bash
# Generate comprehensive test suite
./wt_tasks/claude-utils.sh generate_tests src/components/TaskCard.tsx > tests/TaskCard.test.tsx

# Create test data
claude -p 'Generate realistic test data for a task management app' --output-format json > fixtures/test-data.json
```

### Documentation Generation

```bash
# API documentation
./wt_tasks/claude-utils.sh generate_docs src/lib/api.ts > docs/api.md

# Architecture overview
find src -name "*.ts" -type f | head -10 | xargs cat | claude -p 'Generate architecture documentation for this TypeScript codebase' > docs/architecture.md
```

### Code Migration

```bash
# Migrate to new patterns
cat old-component.tsx | claude -p 'Migrate this React class component to functional component with hooks' --output-format text > new-component.tsx

# Update imports
find src -name "*.ts" -exec claude -p 'Update import statements to use new module structure' {} \;
```

## Best Practices

### 1. Prompt Engineering

- **Be specific**: "Fix TS2307 errors" vs "Fix TypeScript errors"
- **Provide context**: Include file purpose and project structure
- **Set constraints**: "Maintain existing functionality", "Follow project patterns"

### 2. Output Formatting

- Use `--output-format text` for human consumption
- Use `--output-format json` for further processing
- Use `--output-format stream-json` for real-time feedback

### 3. Error Handling

```bash
# Check Claude availability
if ! command -v claude &> /dev/null; then
    echo "Claude CLI not available, falling back to manual process"
    exit 1
fi

# Handle API limits
claude -p "analyze code" --output-format text || echo "Claude request failed, continuing..."
```

### 4. Security Considerations

- Review AI suggestions before applying
- Don't pipe sensitive data to external APIs
- Use local models when available for sensitive code

## Troubleshooting

### Common Issues

1. **Claude CLI not found**
   ```bash
   # Install Claude CLI
   curl -fsSL https://claude.ai/install.sh | sh
   ```

2. **Authentication errors**
   ```bash
   # Re-authenticate
   claude auth login
   ```

3. **Rate limiting**
   ```bash
   # Add delays between requests
   sleep 1 && claude -p "prompt"
   ```

4. **Large file handling**
   ```bash
   # Chunk large files
   split -l 100 large-file.ts chunk_
   for chunk in chunk_*; do
       cat "$chunk" | claude -p "analyze this code chunk"
   done
   ```

## Examples

### Daily Development Workflow

```bash
# Morning: Review overnight changes
git log --since="yesterday" --oneline | claude -p 'Summarize these git commits' > daily-summary.md

# Before committing: AI review
npm run review:staged

# Commit with AI assistance
npm run commit:ai -- -t current-task-id

# Before PR: Comprehensive analysis
git diff main...HEAD | claude -p 'Review this PR for merge readiness' > pr-analysis.md
```

### Debugging Session

```bash
# Analyze error logs
tail -100 error.log | claude -p 'Find patterns and root causes in these errors'

# Explain stack traces
cat crash-report.txt | claude -p 'Explain this error and suggest fixes'

# Generate debugging steps
echo "App crashes on user login" | claude -p 'Generate debugging checklist for this issue'
```

This integration makes Claude a powerful development companion, providing instant insights and assistance throughout your coding workflow!