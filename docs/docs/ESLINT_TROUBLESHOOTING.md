# ESLint Flat Config Troubleshooting Guide (2025) - TaskMaster UI

## 🔧 TaskMaster UI - ESLint Flat Config Support Guide

This guide provides comprehensive troubleshooting solutions for ESLint flat config issues specific to the TaskMaster UI project's multi-process Electron + TypeScript + React architecture.

## 📋 Quick Reference

| Issue Type | Severity | Common Symptoms | Quick Fix |
|------------|----------|-----------------|-----------|
| VS Code Integration | High | No lint errors shown | Update settings.json |
| TypeScript Parsing | High | Project compilation errors | Check tsconfig.json paths |
| React Hooks Plugin | Medium | Hook rules not applied | Verify plugin configuration |
| Electron Process Rules | Medium | Wrong rules applied | Check file patterns |
| Performance Issues | Low | Slow linting | Optimize file patterns |

## 🚨 Critical Issues & Solutions

## 📋 Quick Diagnostic Checklist

Before diving into specific issues, run this diagnostic checklist:

```bash
# 1. Check ESLint version
npx eslint --version

# 2. Check configuration detection
npx eslint --print-config src/main/index.ts

# 3. Verify environment variables
echo $ESLINT_USE_FLAT_CONFIG

# 4. Test basic linting
npx eslint src/main/index.ts

# 5. Check plugin versions
npm list eslint-plugin-react-hooks eslint-plugin-react-refresh typescript-eslint
```

## 🔧 Common Issues and Solutions

### 1. Configuration File Detection Issues

#### Issue: "No configuration file found"

**Symptoms:**
```
Error: Could not find config file.
```

**Diagnosis:**
```bash
# Check for config files
ls -la eslint.config.* .eslintrc.*

# Check current directory
pwd

# Verify file permissions
ls -la eslint.config.js
```

**Solutions:**

**For Flat Config (ESLint v9+):**
```bash
# Ensure flat config file exists
touch eslint.config.js

# Verify the file has proper syntax
node -c eslint.config.js
```

**For Legacy Config (ESLint v8-v9 with legacy mode):**
```bash
# Create .eslintrc.cjs if missing
touch .eslintrc.cjs

# Set environment variable
export ESLINT_USE_FLAT_CONFIG=false

# Test configuration
npx eslint --print-config package.json
```

#### Issue: "Configuration file is invalid"

**Symptoms:**
```
Error: ESLint configuration is invalid
```

**Diagnosis:**
```bash
# Validate flat config syntax
node -e "console.log(require('./eslint.config.js'))"

# Validate legacy config syntax  
node -e "console.log(require('./.eslintrc.cjs'))"
```

**Solutions:**

**Common Syntax Errors:**
```javascript
// ❌ Wrong: CommonJS in flat config
module.exports = [...];

// ✅ Correct: ES modules in flat config
export default [...];

// ❌ Wrong: Missing return statement
export default () => {
  [...];
};

// ✅ Correct: Proper export
export default [...];
```

### 2. Plugin Compatibility Issues

#### Issue: "TypeError: context.getScope is not a function"

**Symptoms:**
```
TypeError: context.getScope is not a function
    at rule.create
```

**Diagnosis:**
```bash
# Check plugin versions
npm list eslint-plugin-react-hooks eslint-plugin-react-refresh

# Verify ESLint version compatibility
npm info eslint-plugin-react-hooks engines
```

**Solutions:**

**For ESLint v9+ with Flat Config:**
```bash
# Update to compatible plugin versions
npm install --save-dev eslint-plugin-react-hooks@^5.2.0
npm install --save-dev eslint-plugin-react-refresh@^0.4.16
```

**For ESLint v8-v9 Legacy Mode:**
```bash
# Use legacy-compatible plugin versions
npm install --save-dev eslint-plugin-react-hooks@^4.6.2
npm install --save-dev eslint-plugin-react-refresh@^0.4.16
```

**Plugin Version Compatibility Matrix:**

| ESLint Version | React Hooks Plugin | React Refresh Plugin | TypeScript ESLint |
|----------------|--------------------|--------------------- |-------------------|
| v10.0.0+ | v5.2.0+ | v0.4.16+ | v8.33.1+ |
| v9.x (flat) | v5.2.0+ | v0.4.16+ | v8.33.1+ |
| v9.x (legacy) | v4.6.2+ | v0.4.16+ | v7.18.0+ |
| v8.x | v4.6.2+ | v0.4.16+ | v6.21.0+ |

#### Issue: "Plugin 'X' not found"

**Symptoms:**
```
Error: Cannot find plugin 'react-hooks'
```

**Diagnosis:**
```bash
# Check if plugin is installed
npm list eslint-plugin-react-hooks

# Verify plugin name in config
grep -r "react-hooks" eslint.config.js .eslintrc.cjs
```

**Solutions:**

**For Flat Config:**
```javascript
// ❌ Wrong: Plugin name without prefix
import reactHooks from 'react-hooks';

// ✅ Correct: Full plugin name
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    plugins: {
      'react-hooks': reactHooks, // Use short name in config
    },
  },
];
```

**For Legacy Config:**
```javascript
// ✅ Correct: Plugin registration
module.exports = {
  plugins: [
    'react-hooks', // ESLint automatically adds 'eslint-plugin-' prefix
  ],
};
```

### 3. TypeScript Integration Issues

#### Issue: "Parsing error: Cannot read file"

**Symptoms:**
```
Parsing error: Cannot read file '/path/to/tsconfig.json'
```

**Diagnosis:**
```bash
# Check tsconfig.json exists
ls -la tsconfig.json

# Validate tsconfig.json syntax
npx tsc --noEmit --project tsconfig.json

# Check parser configuration
grep -A 10 -B 10 "project.*tsconfig" eslint.config.js
```

**Solutions:**

**For Multi-Project Setup:**
```javascript
// ✅ Correct: Conditional project config
export default [
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
  {
    files: ['server/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './server/tsconfig.json',
      },
    },
  },
  {
    files: ['*.ts', '*.js'], // Root level files
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: null, // Don't require project for root files
      },
    },
  },
];
```

#### Issue: "Type information not available"

**Symptoms:**
```
Warning: Parsing error: Cannot read file '/undefined/tsconfig.json'
```

**Diagnosis:**
```bash
# Check current working directory
pwd

# Verify relative paths
ls -la tsconfig.json server/tsconfig.json

# Test parser directly
npx @typescript-eslint/parser src/main/index.ts
```

**Solutions:**

**Use Absolute Paths:**
```javascript
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    languageOptions: {
      parserOptions: {
        project: path.join(__dirname, 'tsconfig.json'),
      },
    },
  },
];
```

### 4. File Pattern Matching Issues

#### Issue: "Files not being linted"

**Symptoms:**
- ESLint runs but skips certain files
- No output for files that should be linted

**Diagnosis:**
```bash
# Test specific file
npx eslint src/renderer/src/App.tsx --debug

# Check ignore patterns
npx eslint --print-config src/renderer/src/App.tsx | grep -A 10 ignores

# List files ESLint would process
npx eslint src/ --dry-run
```

**Solutions:**

**Check Ignore Patterns:**
```javascript
export default [
  {
    ignores: [
      'dist/**',
      'out/**',
      '**/*.d.ts', // This might be too broad
      // Check if your files match ignore patterns
    ],
  },
];
```

**File Pattern Debugging:**
```bash
# Test file matching
npx eslint src/**/*.tsx --dry-run

# Check specific patterns
npx eslint "src/renderer/**/*.{js,ts,jsx,tsx}" --dry-run
```

#### Issue: "Wrong rules applied to files"

**Symptoms:**
- React rules applied to Node.js files
- Node.js rules applied to browser files

**Diagnosis:**
```bash
# Check resolved configuration for specific file
npx eslint --print-config src/main/index.ts > main-config.json
npx eslint --print-config src/renderer/src/App.tsx > renderer-config.json

# Compare configurations
diff main-config.json renderer-config.json
```

**Solutions:**

**Fix File Pattern Specificity:**
```javascript
export default [
  // Order matters! More specific patterns should come last
  
  // General TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
    },
  },
  
  // Main process specific (more specific)
  {
    files: ['src/main/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  
  // Renderer process specific (most specific)
  {
    files: ['src/renderer/**/*.{js,ts,jsx,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
```

### 5. Environment and Build Integration Issues

#### Issue: "ESLint fails in CI/CD"

**Symptoms:**
```
Error: Command failed with exit code 1
npm ERR! code ELIFECYCLE
```

**Diagnosis:**
```bash
# Test in CI-like environment
CI=true npm run lint

# Check environment variables
env | grep ESLINT

# Test with specific node version
node --version
npm --version
```

**Solutions:**

**CI Configuration:**
```yaml
# .github/workflows/ci.yml
- name: Lint
  run: |
    export ESLINT_USE_FLAT_CONFIG=false  # If using legacy mode
    npm run lint
  env:
    NODE_ENV: test
    CI: true
```

**Package.json Scripts:**
```json
{
  "scripts": {
    "lint": "eslint . --max-warnings 0 --no-warn-ignored --fix",
    "lint:ci": "eslint . --max-warnings 0 --no-warn-ignored --format=json --output-file=eslint-results.json"
  }
}
```

#### Issue: "Pre-commit hooks not working"

**Symptoms:**
- Git commits succeed despite linting errors
- Husky hooks don't run ESLint

**Diagnosis:**
```bash
# Test Husky setup
npx husky list

# Check lint-staged configuration
npx lint-staged --debug

# Test pre-commit hook manually
.husky/pre-commit
```

**Solutions:**

**Husky + lint-staged Configuration:**
```json
// package.json
{
  "lint-staged": {
    "**/*.{js,mjs,cjs,ts,tsx}": [
      "eslint --max-warnings 0 --no-warn-ignored --fix"
    ]
  }
}
```

**For Legacy Mode:**
```json
{
  "lint-staged": {
    "**/*.{js,mjs,cjs,ts,tsx}": [
      "ESLINT_USE_FLAT_CONFIG=false eslint --max-warnings 0 --fix"
    ]
  }
}
```

### 6. IDE Integration Issues

#### Issue: "VS Code ESLint extension not working"

**Symptoms:**
- No ESLint errors shown in VS Code
- Auto-fix not working
- Extension shows disabled status

**Diagnosis:**
```bash
# Check VS Code settings
cat .vscode/settings.json

# Check ESLint extension status in VS Code
# Command Palette: "ESLint: Show Output Channel"
```

**Solutions:**

**VS Code Settings for Flat Config:**
```json
{
  "eslint.useFlatConfig": true,
  "eslint.enable": true,
  "eslint.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

**VS Code Settings for Legacy Config:**
```json
{
  "eslint.useFlatConfig": false,
  "eslint.enable": true,
  "terminal.integrated.env.osx": {
    "ESLINT_USE_FLAT_CONFIG": "false"
  },
  "terminal.integrated.env.linux": {
    "ESLINT_USE_FLAT_CONFIG": "false"
  },
  "terminal.integrated.env.windows": {
    "ESLINT_USE_FLAT_CONFIG": "false"
  }
}
```

**Restart Sequence:**
1. Reload VS Code window (`Cmd/Ctrl + R`)
2. Restart ESLint server (Command Palette: "ESLint: Restart ESLint Server")
3. Check ESLint output channel for errors

## 🔍 Advanced Debugging Techniques

### ESLint Debug Mode

```bash
# Enable debug output
DEBUG=eslint:* npx eslint src/main/index.ts

# Focus on specific areas
DEBUG=eslint:cli-engine npx eslint src/

# Check configuration resolution
DEBUG=eslint:config* npx eslint src/main/index.ts
```

### Configuration Analysis

```bash
# Dump complete configuration
npx eslint --print-config src/main/index.ts > debug-config.json

# Compare configurations between files
npx eslint --print-config src/main/index.ts > main.json
npx eslint --print-config src/renderer/src/App.tsx > renderer.json
diff main.json renderer.json
```

### Performance Debugging

```bash
# Profile ESLint performance
time npx eslint src/

# Analyze with hyperfine
hyperfine "npx eslint src/" --warmup 3 --min-runs 10

# Check memory usage
/usr/bin/time -v npx eslint src/
```

## 📊 Version Compatibility Matrix

### ESLint Core Versions

| Version | Flat Config | Legacy Config | Removal Date |
|---------|-------------|---------------|-------------|
| v8.x | ❌ | ✅ | Still Supported |
| v9.x | ✅ (Default) | ✅ (with flag) | 2025 Q1 |
| v10.x+ | ✅ (Only) | ❌ | Removed |

### Plugin Compatibility

| Plugin | ESLint v8 | ESLint v9 | ESLint v10+ |
|--------|-----------|-----------|-------------|
| typescript-eslint v6 | ✅ | ⚠️ | ❌ |
| typescript-eslint v7 | ✅ | ✅ | ⚠️ |
| typescript-eslint v8 | ❌ | ✅ | ✅ |
| react-hooks v4 | ✅ | ✅ | ⚠️ |
| react-hooks v5 | ❌ | ✅ | ✅ |

## 🚨 Emergency Procedures

### Complete ESLint Reset

```bash
# Backup current state
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup

# Remove all ESLint packages
npm uninstall eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh

# Clean npm cache
npm cache clean --force

# Reinstall from known good versions
npm install --save-dev eslint@^9.28.0 @eslint/js@^9.28.0 typescript-eslint@^8.33.1

# Regenerate lock file
rm package-lock.json
npm install
```

### Rollback to Working State

```bash
# If you have backups from rollback script
ls -la .eslint-rollback-backup-*/

# Restore from most recent backup
BACKUP_DIR=$(ls -1d .eslint-rollback-backup-* | tail -1)
./\${BACKUP_DIR}/restore-flat-config.sh
```

## 📞 Getting Help

### Internal Resources

1. **Check existing documentation**: `/docs` directory
2. **Review backup files**: `.eslint-rollback-backup-*` directories  
3. **Consult rollback guide**: `docs/ESLINT_ROLLBACK_GUIDE.md`

### External Resources

1. **ESLint Discussions**: [GitHub Discussions](https://github.com/eslint/eslint/discussions)
2. **TypeScript ESLint**: [Official Documentation](https://typescript-eslint.io/)
3. **Stack Overflow**: Search for `[eslint] flat-config` or `[eslint] v9`

### Diagnostic Information to Collect

When seeking help, provide:

```bash
# System information
node --version
npm --version
npx eslint --version

# Configuration dump
npx eslint --print-config src/main/index.ts

# Package versions
npm list eslint typescript-eslint eslint-plugin-react-hooks

# Environment variables
env | grep -i eslint

# Error output with debug
DEBUG=eslint:* npx eslint problematic-file.ts 2>&1
```

---

**Last Updated**: 2025-06-02  
**ESLint Version Coverage**: v8.x - v10.x  
**Maintenance Status**: Active - Covers 2025 ecosystem changes