# Shared Files Configuration Guide

## Overview

This document explains the shared files configuration for TaskMaster UI worktrees. Each worktree receives a copy of essential development files to ensure it can function independently while maintaining consistency across all development environments.

## What Gets Shared

### Configuration Files (Build & Development)
- `package.json` & `package-lock.json` - Dependencies and scripts
- `tsconfig.json` & `tsconfig.node.json` - TypeScript configuration
- `eslint.config.js` - Code linting rules
- `electron.vite.config.ts` - Main Electron build config
- `vite.config.ts`, `vite.main.config.ts`, `vite.preload.config.ts` - Vite configurations
- `vitest.config.ts` & `vitest-setup.ts` - Testing configuration
- `playwright.config.ts` - E2E testing setup
- `postcss.config.js` & `tailwind.config.js` - CSS processing
- `electron-builder.yml` & `dev-app-update.yml` - App packaging

### Project Documentation
- `CLAUDE.md` - Claude Code instructions and project guidelines
- `README.md` - Project overview and setup instructions
- `.env.example` - Environment variable template
- `.gitignore` - Git ignore patterns

### Development Tools & Scripts
- `run-dev.sh`, `run-app.sh`, `build-electron.sh` - Shell scripts
- `wt_tasks/` - All worktree management tools
- `scripts/` - Development and CI scripts
- `docs/` - Project documentation

### Testing Infrastructure
- `tests/config/` - Test configuration files
- `tests/setup/` - Test setup utilities
- `tests/mocks/` - Mock implementations
- `tests/fixtures/` - Test data
- `tests/utils/` - Testing utilities
- `__mocks__/` - Jest/Vitest mocks

### Resources & Assets
- `resources/` - Application icons and assets

## Total Size Impact

Each worktree gets approximately **1.2MB** of shared files:
- Configuration files: ~50KB
- Dependencies manifest: ~1.1MB (package-lock.json)
- Documentation: ~30KB
- Scripts and tools: ~20KB
- Test infrastructure: minimal (mostly empty directories)

## Why Each File is Shared

### Critical for Development
| File | Purpose | Why Shared |
|------|---------|------------|
| `package.json` | Dependencies & scripts | Each worktree needs to run npm commands |
| `tsconfig.json` | TypeScript config | Consistent compilation settings |
| `eslint.config.js` | Linting rules | Consistent code quality standards |
| `electron.vite.config.ts` | Build system | Required for development server |

### Essential for Testing
| File | Purpose | Why Shared |
|------|---------|------------|
| `vitest.config.ts` | Unit test config | Enables `npm test` in worktrees |
| `playwright.config.ts` | E2E test config | Enables E2E testing |
| `tests/` directories | Test infrastructure | Provides mocks and utilities |

### Convenience & Consistency
| File | Purpose | Why Shared |
|------|---------|------------|
| `CLAUDE.md` | Development guidelines | Ensures consistent AI assistance |
| `run-*.sh` scripts | Quick development | Enables script execution |
| `docs/` | Documentation | Reference materials |

## What's NOT Shared

### Source Code
- `src/` directory - Each worktree works on different parts
- `node_modules/` - Installed separately in each worktree
- `dist/`, `out/` - Build outputs are separate

### Local State
- `.env` files (except `.env.example`)
- `debug-logs/` - Debug outputs
- Individual git state

### Generated Files
- `coverage/` - Test coverage reports
- `test-results/` - Test outputs
- `.taskmaster/` - TaskMaster state

## Verification

Use the verification script to check the configuration:

```bash
./wt_tasks/verify-shared-files.sh
```

This script:
- ✅ Verifies all configured files exist
- ✅ Checks total size impact
- ✅ Validates essential development files
- ✅ Suggests potential additions
- ✅ Tests worktree readiness

## Customization

### Adding Files

To add files to the shared configuration:

1. Edit `wt_tasks/wt_config.json`:
   ```json
   "sharedFiles": [
     "existing-file.json",
     "new-file.js",
     "new-directory"
   ]
   ```

2. Verify the addition:
   ```bash
   ./wt_tasks/verify-shared-files.sh
   ```

3. Test with a sample worktree:
   ```bash
   ./wt_tasks/setup-worktrees.sh
   ```

### Removing Files

To remove files from sharing:

1. Remove from `sharedFiles` array in config
2. Consider impact on worktree functionality
3. Update documentation if needed

### Special Cases

#### Large Directories
For large directories, consider if the entire directory is needed:
```json
// Instead of sharing all of node_modules
"node_modules"

// Share only specific subdirectories
"node_modules/@types",
"node_modules/typescript"
```

#### Environment-Specific Files
Some files should NOT be shared:
- `.env` (contains secrets)
- `dist/` (build outputs)
- `coverage/` (test results)

## Troubleshooting

### Common Issues

1. **Missing Files Error**
   ```
   ✗ some-file.json (not found)
   ```
   - Check if the file exists in the main repository
   - Verify the file path in the configuration
   - Consider if the file is actually needed

2. **Large Size Impact**
   ```
   Total overhead per worktree: 10M
   ```
   - Review if all files are necessary
   - Consider excluding large binary files
   - Use `.gitignore` patterns for generated files

3. **Permission Errors**
   ```
   Failed to copy file: script.sh
   ```
   - Check file permissions in source
   - Ensure target directory is writable
   - Verify script is executable

### Best Practices

1. **Minimize Size**: Only share files actually needed for development
2. **Test Changes**: Always run verification after config changes
3. **Document Decisions**: Update this guide when adding/removing files
4. **Version Control**: Keep shared file lists in sync across branches

## Performance Considerations

### Disk Usage
- Each worktree adds ~1.2MB (minimal impact)
- 5 worktrees = ~6MB total overhead
- Much less than full repository clones

### Network Impact
- Only initial setup downloads shared files
- Updates require re-copying changed files
- No ongoing network usage

### Development Speed
- ✅ Each worktree is fully functional immediately
- ✅ No dependency installation delays
- ✅ Consistent tool configuration
- ✅ Independent development environments

This shared files system ensures each worktree is a complete, functional development environment while maintaining consistency and minimizing overhead.