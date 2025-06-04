# Claude Initialization Prompt for test-failure-analysis

Welcome to TaskMaster UI worktree for **Test Suite Failure Analysis**!

## Task Context
- **Task**: Test Suite Failure Analysis (test-failure-analysis)
- **Description**: Analyze 40 failing tests out of 51 total, categorize failure patterns, and document testing strategy
- **Branch**: test/test-failure-analysis
- **Phase**: 2
- **Priority**: Medium

## Project Context
This is an Electron + React application using:
- electron-vite for build system
- TypeScript with strict mode
- Zustand for state management
- Tailwind CSS for styling
- **Vitest and Playwright for testing** (focus area)

## Available MCP Tools
1. **tree-sitter** - For code analysis and finding patterns
2. **taskmaster-ai** - For task tracking and progress
3. **github** - For creating PRs and managing branches
4. **sequential-thinking** - For planning complex fixes

## Test Metrics
- **Failing Tests**: 40
- **Total Tests**: 51
- **Test Frameworks**: Vitest, Playwright

## Instructions
1. Start by reading the TASK.md file to understand specific requirements
2. Use `npm test` to run all tests and see failures
3. Use `npm run test:e2e` for Playwright tests
4. Analyze failure patterns and categorize by type
5. Document findings and testing strategy
6. Commit frequently with conventional commit messages
7. Update the progress tracking file after each analysis batch
8. Create a PR when the analysis is complete

## TaskMaster Integration
- Tasks are in `.taskmaster/tasks/tasks.json`
- Use TaskMaster MCP tools to track progress
- Project root for TaskMaster: `/Users/davidleathers/taskmaster-ui_worktrees/test-failure-analysis`

**Remember**: Focus on analysis and documentation, not necessarily fixing all tests. Understand the patterns first.

---
**To start**: Copy this prompt and send it to Claude when you open the terminal in this worktree directory.