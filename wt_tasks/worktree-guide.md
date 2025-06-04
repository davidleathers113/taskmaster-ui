# TaskMaster UI Worktree Development Guide

## Overview

This guide explains the advanced Git worktree setup for parallel development on the TaskMaster UI project. The system enables multiple developers (or AI agents) to work on different aspects of the codebase simultaneously without conflicts.

## Quick Start

```bash
# 1. Set up all worktrees
./wt_tasks/setup-worktrees.sh

# 2. Launch Claude in each worktree
./wt_tasks/launch-claude-terminals.sh

# 3. Monitor progress
./wt_tasks/monitor-progress.sh

# 4. Create PR when done
cd ../taskmaster-ui_worktrees/[task-name]
./wt_tasks/create-pr-report.sh -t [task-id] -m "your commit message"
```

## System Architecture

```
taskmaster-ui/                    # Main repository
├── wt_tasks/                     # Worktree configuration
│   ├── wt_config.json           # Task definitions
│   ├── setup-worktrees.sh       # Setup script
│   ├── launch-claude-terminals.sh # Terminal launcher
│   ├── create-pr-report.sh      # PR helper
│   ├── monitor-progress.sh      # Progress tracker
│   └── *.md                     # Task descriptions
│
taskmaster-ui_worktrees/          # Parallel worktrees
├── ts-module-errors/            # Fix module imports
├── ts-type-safety/              # Fix type safety
├── test-failure-analysis/       # Analyze tests
├── eslint-analysis/             # Analyze ESLint
└── ci-cd-setup/                 # Setup CI/CD
```

## Configuration (wt_config.json)

The configuration file controls all aspects of the worktree system:

### Key Sections

1. **Repository Settings**
   - Base repository path
   - Base branch for all work

2. **Task Definitions**
   - Unique ID for each task
   - Human-readable names
   - Categories and priorities
   - Parallel safety flags
   - Phase grouping

3. **Terminal Settings**
   - Window positioning
   - Claude prompt templates
   - Port allocations

4. **Coordination**
   - Shared directories
   - Progress tracking
   - Conflict resolution

## Working with Worktrees

### Understanding Phases

Tasks are organized into phases to minimize conflicts:

- **Phase 1**: Core fixes (TypeScript errors)
- **Phase 2**: Quality improvements (Tests, ESLint)
- **Phase 3**: Documentation and tooling

### Port Allocation

Each worktree gets unique ports to avoid conflicts:

| Task | Electron Main | Electron Renderer | Server |
|------|--------------|-------------------|---------|
| ts-module-errors | 5170 | 5270 | 3100 |
| ts-type-safety | 5171 | 5271 | 3101 |
| test-failure-analysis | 5172 | 5272 | 3102 |
| eslint-analysis | 5173 | 5273 | 3103 |
| ci-cd-setup | 5174 | 5274 | 3104 |

### Shared Files

These files are automatically copied to each worktree:
- `CLAUDE.md` - Project guidelines
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint rules
- `package.json` - Dependencies
- Build configurations

## Development Workflow

### 1. Starting Work

```bash
# Go to your assigned worktree
cd ../taskmaster-ui_worktrees/[your-task]

# Check your task description
cat TASK.md

# See current TypeScript errors
npm run typecheck

# Start development
npm run dev
```

### 2. Making Changes

Follow the conventional commit format:
- `fix(scope): description` for bug fixes
- `feat(scope): description` for features
- `test(scope): description` for tests
- `docs(scope): description` for documentation

### 3. Committing Work

```bash
# Use the PR report helper
./wt_tasks/create-pr-report.sh \
  -t [task-id] \
  -s [scope] \
  -m "description of changes" \
  -d "detailed PR description"

# Or commit manually
git add .
git commit -m "fix(renderer): resolve module import errors"
```

### 4. Creating Pull Requests

```bash
# Push to remote
git push -u origin [branch-name]

# Create PR with generated report
gh pr create --title "fix(renderer): resolve module imports" \
  --body-file PR_REPORT_[task-id].md
```

## Coordination Between Worktrees

### Progress Tracking

Update `wt_tasks/progress.md` regularly:
- Mark tasks as started/completed
- Note any blockers
- Document conflicts found

### Avoiding Conflicts

1. **Stay in your lane**: Focus on your assigned error types
2. **Communicate**: Update progress tracker
3. **Small commits**: Make frequent, focused commits
4. **Test often**: Run checks after each change

### Handling Conflicts

If you encounter conflicts:

1. **Stop and assess**: Don't force changes
2. **Check progress tracker**: See who else is working on related files
3. **Coordinate**: Use the progress file to communicate
4. **Merge carefully**: Test thoroughly after merging

## Best Practices

### 1. TypeScript Fixes

- Fix one error type at a time
- Run `npm run typecheck` after each fix
- Don't introduce new errors
- Follow existing patterns

### 2. Test Fixes

- Understand why tests fail first
- Fix root causes, not symptoms
- Update tests to match new code
- Add missing test coverage

### 3. ESLint Fixes

- Use `--fix` for automatic fixes
- Group similar fixes together
- Update config if rules are outdated
- Document any disabled rules

### 4. Documentation

- Keep it concise and clear
- Include code examples
- Update when implementation changes
- Focus on "why" not just "how"

## Monitoring and Reporting

### Real-time Monitoring

```bash
# Check all worktree status
./wt_tasks/monitor-progress.sh

# See quick reference
./wt_tasks/quick-reference.sh

# Check specific worktree
cd ../taskmaster-ui_worktrees/[task]
git status
npm run typecheck 2>&1 | grep -c "error TS"
```

### Progress Metrics

Track these metrics:
- TypeScript errors fixed
- ESLint problems resolved
- Tests passing
- Files modified
- Commits created

## Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check if port is in use
   lsof -i :5170
   
   # Use environment variable
   ELECTRON_MAIN_PORT=5180 npm run dev
   ```

2. **Module not found**
   ```bash
   # Reinstall dependencies
   npm ci
   
   # Clear cache
   npm cache clean --force
   ```

3. **Git worktree errors**
   ```bash
   # Prune broken worktrees
   git worktree prune
   
   # List all worktrees
   git worktree list
   ```

## Cleanup

When your task is complete:

```bash
# From main repository
./cleanup-worktrees.sh

# Or manually
git worktree remove ../taskmaster-ui_worktrees/[task]
git branch -d [branch-name]
```

## Advanced Usage

### Running Multiple Instances

```bash
# Set unique ports per instance
INSTANCE=1 npm run dev  # Uses base ports + INSTANCE
INSTANCE=2 npm run dev  # Uses base ports + INSTANCE
```

### Custom Task Configuration

Create a new task in `wt_config.json`:
```json
{
  "id": "custom-task",
  "name": "Custom Development Task",
  "description": "Description here",
  "branchPrefix": "feature/",
  "category": "feature",
  "priority": "medium",
  "parallelSafe": true
}
```

Then run setup again:
```bash
./wt_tasks/setup-worktrees.sh
```

## Resources

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [ESLint Rules](https://eslint.org/docs/rules/)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review error logs in each worktree
3. Consult the main CLAUDE.md file
4. Update this guide with solutions found