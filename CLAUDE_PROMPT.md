<<<<<<< HEAD
# Claude Initialization Prompt for test-failure-analysis

Welcome to TaskMaster UI worktree for **Test Suite Failure Analysis**!

## Task Context
- **Task**: Test Suite Failure Analysis (test-failure-analysis)
- **Description**: Analyze 40 failing tests out of 51 total, categorize failure patterns, and document testing strategy
- **Branch**: test/test-failure-analysis
- **Phase**: 2
- **Priority**: Medium
=======
# Claude Initialization Prompt for ts-type-safety

Welcome to TaskMaster UI worktree for **TypeScript Type Safety Errors**!

## Task Context
- **Task**: TypeScript Type Safety Errors (ts-type-safety)
- **Description**: Fix TS7006 (implicit any), TS2532 (null/undefined), TS2345 (type assignment), TS2322 (type incompatibility) - 121+ errors
- **Branch**: fix/ts-type-safety
- **Phase**: 1
- **Priority**: High
>>>>>>> origin/main

## Project Context
This is an Electron + React application using:
- electron-vite for build system
- TypeScript with strict mode
- Zustand for state management
- Tailwind CSS for styling
<<<<<<< HEAD
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
=======
- Vitest and Playwright for testing

## Available MCP Tools
1. **tree-sitter** - For code analysis and finding patterns
2. **taskmaster-ai** - For task tracking and progress  
3. **github** - For creating PRs and managing branches
4. **sequential-thinking** - For planning complex fixes

## Target Error Types
- **TS7006**: Implicit any parameter
- **TS2532**: Object possibly null/undefined
- **TS2345**: Type assignment error
- **TS2322**: Type incompatibility

## Instructions
1. Start by reading the TASK.md file to understand specific requirements
2. Use `npm run typecheck` to see current TypeScript errors
3. Use `npm run lint` to see ESLint problems
4. Focus on TS7006, TS2532, TS2345, TS2322 errors assigned to this worktree
5. Commit frequently with conventional commit messages
6. Update the progress tracking file after each batch of fixes
7. Create a PR when the task is complete
>>>>>>> origin/main

## TaskMaster Integration
- Tasks are in `.taskmaster/tasks/tasks.json`
- Use TaskMaster MCP tools to track progress
<<<<<<< HEAD
- Project root for TaskMaster: `/Users/davidleathers/taskmaster-ui_worktrees/test-failure-analysis`

**Remember**: Focus on analysis and documentation, not necessarily fixing all tests. Understand the patterns first.
=======
- Project root for TaskMaster: `/Users/davidleathers/taskmaster-ui_worktrees/ts-type-safety`

**Remember**: Quality over speed. Each fix should be verified to not introduce new errors.
>>>>>>> origin/main

---
**To start**: Copy this prompt and send it to Claude when you open the terminal in this worktree directory.