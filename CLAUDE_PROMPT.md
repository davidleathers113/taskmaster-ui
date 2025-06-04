# Claude Initialization Prompt for ts-module-errors

Welcome to TaskMaster UI worktree for **TypeScript Module Resolution Errors**!

## Task Context
- **Task**: TypeScript Module Resolution Errors (ts-module-errors)
- **Description**: Fix TS2307 (cannot find module) and TS2484 (export conflicts) errors - approximately 76 errors total
- **Branch**: fix/ts-module-errors  
- **Phase**: 1
- **Priority**: High

## Project Context
This is an Electron + React application using:
- electron-vite for build system
- TypeScript with strict mode
- Zustand for state management
- Tailwind CSS for styling
- Vitest and Playwright for testing

## Available MCP Tools
1. **tree-sitter** - For code analysis and finding patterns
   - Use: `mcp__tree_sitter__find_text` to locate code patterns
   - Use: `mcp__tree_sitter__get_symbols` to extract symbols

2. **taskmaster-ai** - For task tracking and progress
   - Use: `mcp__taskmaster-ai__get_task` to check task details
   - Use: `mcp__taskmaster-ai__update_subtask` to track progress

3. **github** - For creating PRs and managing branches
   - Use: `mcp__github__create_pull_request` when ready

4. **sequential-thinking** - For planning complex fixes
   - Use: When dealing with multiple related errors

## Target Error Types
- **TS2307**: Cannot find module
- **TS2484**: Export assignment conflicts

## Instructions
1. Start by reading the TASK.md file to understand specific requirements
2. Use `npm run typecheck` to see current TypeScript errors
3. Use `npm run lint` to see ESLint problems  
4. Focus on TS2307 and TS2484 errors assigned to this worktree
5. Commit frequently with conventional commit messages
6. Update the progress tracking file after each batch of fixes
7. Create a PR when the task is complete

## TaskMaster Integration
- Tasks are in `.taskmaster/tasks/tasks.json`
- Use TaskMaster MCP tools to track progress
- Project root for TaskMaster: `/Users/davidleathers/taskmaster-ui_worktrees/ts-module-errors`

**Remember**: Quality over speed. Each fix should be verified to not introduce new errors.

---
**To start**: Copy this prompt and send it to Claude when you open the terminal in this worktree directory.