# ESLint Flat Config Rollback Guide (2025)

This comprehensive guide provides step-by-step procedures for rolling back from ESLint flat config to the legacy eslintrc format, following 2025 best practices and addressing the challenges introduced by ESLint v10.0.0's removal of eslintrc support.

## 🚨 Critical Information for 2025

**ESLint v10.0.0 Release Impact**: As of 2025, ESLint v10.0.0 has been released and has **completely removed** support for the legacy eslintrc configuration system. This fundamentally changes rollback strategies and requires careful version management.

### Rollback Scenarios by ESLint Version

| ESLint Version | Rollback Strategy | Complexity | Recommendation |
|----------------|-------------------|------------|----------------|
| v10.0.0+ | **Version Downgrade Required** | High | Downgrade to v9.x |
| v9.x | `ESLINT_USE_FLAT_CONFIG=false` | Medium | Environment Variable |
| v8.x and below | Native eslintrc Support | Low | Direct Configuration |

## 📋 Prerequisites

Before starting the rollback process:

1. **Create a complete backup** of your current project
2. **Document your current flat config** for future reference
3. **Verify plugin compatibility** with target ESLint version
4. **Check team coordination** to ensure everyone is aware of the rollback
5. **Review dependencies** that may depend on flat config features

## 🤖 Automated Rollback (Recommended)

### Quick Start

```bash
# Run the automated rollback script
./scripts/eslint-rollback.sh
```

The automated script handles:
- ✅ Backup creation with timestamp
- ✅ ESLint version detection and downgrading
- ✅ Legacy configuration recreation
- ✅ Package.json script updates
- ✅ VS Code settings configuration
- ✅ Dependency management
- ✅ Rollback testing and validation

### What the Script Does

1. **Backup Phase**
   - Creates timestamped backup directory
   - Saves current flat config files
   - Backs up package.json and package-lock.json
   - Preserves VS Code settings

2. **Version Management Phase**
   - Detects current ESLint version
   - Downgrades to compatible version if needed
   - Updates related packages (typescript-eslint, plugins)
   - Manages dependency conflicts

3. **Configuration Recreation Phase**
   - Generates .eslintrc.cjs from flat config
   - Maps flat config rules to legacy format
   - Preserves all override patterns
   - Maintains project-specific customizations

4. **Environment Setup Phase**
   - Updates package.json scripts
   - Configures lint-staged for legacy format
   - Sets up VS Code for eslintrc
   - Adds environment variables for legacy mode

5. **Validation Phase**
   - Tests rollback configuration
   - Validates rule application
   - Checks plugin compatibility
   - Creates restoration script

## 🔧 Manual Rollback Procedures

### Step 1: Backup Current Configuration

```bash
# Create backup directory
mkdir -p .eslint-rollback-backup-$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=".eslint-rollback-backup-$(date +%Y%m%d-%H%M%S)"

# Backup flat config files
cp eslint.config.js "$BACKUP_DIR/" 2>/dev/null || true
cp eslint.config.ts "$BACKUP_DIR/" 2>/dev/null || true
cp eslint.config.mjs "$BACKUP_DIR/" 2>/dev/null || true

# Backup package files
cp package.json "$BACKUP_DIR/"
cp package-lock.json "$BACKUP_DIR/"

# Backup VS Code settings
cp -r .vscode "$BACKUP_DIR/" 2>/dev/null || true
```

### Step 2: Version Management

#### For ESLint v10.0.0+

```bash
# Uninstall current ESLint packages
npm uninstall eslint @eslint/js typescript-eslint

# Install compatible ESLint v9.x
npm install --save-dev eslint@^9.28.0 @eslint/js@^9.28.0 typescript-eslint@^8.33.1

# Update related packages
npm install --save-dev eslint-plugin-react-hooks@^5.2.0 eslint-plugin-react-refresh@^0.4.16
```

#### For ESLint v9.x

```bash
# Set environment variable to use legacy config
export ESLINT_USE_FLAT_CONFIG=false

# Add to your shell profile (.bashrc, .zshrc, etc.)
echo 'export ESLINT_USE_FLAT_CONFIG=false' >> ~/.bashrc
```

### Step 3: Create Legacy Configuration

Create `.eslintrc.cjs` with the following template:

```javascript
// .eslintrc.cjs - Legacy ESLint Configuration
module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: [
    '@typescript-eslint',
    'react-hooks',
    'react-refresh',
  ],
  ignorePatterns: [
    'dist/**',
    'out/**',
    'node_modules/**',
    // ... add all patterns from your flat config
  ],
  rules: {
    // Migrate rules from your flat config
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    // ... add all rules from your flat config
  },
  overrides: [
    // Migrate all file-specific overrides from your flat config
    {
      files: ['src/main/**/*.{js,ts}'],
      env: { node: true },
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-floating-promises': 'error',
      },
    },
    // ... add all other overrides
  ],
};
```

### Step 4: Update Package.json Scripts

```json
{
  "scripts": {
    "lint": "ESLINT_USE_FLAT_CONFIG=false eslint . --max-warnings 0 --fix"
  },
  "lint-staged": {
    "**/*.{js,mjs,cjs,ts,tsx}": [
      "ESLINT_USE_FLAT_CONFIG=false eslint --max-warnings 0 --fix"
    ]
  }
}
```

### Step 5: Configure VS Code

Update `.vscode/settings.json`:

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

### Step 6: Remove Flat Config Files

```bash
# Remove flat config files
rm eslint.config.js 2>/dev/null || true
rm eslint.config.ts 2>/dev/null || true
rm eslint.config.mjs 2>/dev/null || true
```

### Step 7: Test the Rollback

```bash
# Test basic linting
ESLINT_USE_FLAT_CONFIG=false npm run lint

# Test configuration parsing
ESLINT_USE_FLAT_CONFIG=false npx eslint --print-config src/main/index.ts

# Test specific file types
ESLINT_USE_FLAT_CONFIG=false npx eslint src/renderer/src/App.tsx
```

## 🔍 Validation Checklist

After completing the rollback, verify:

- [ ] `.eslintrc.cjs` file exists and is valid
- [ ] `npm run lint` works without errors
- [ ] All file types are linted correctly
- [ ] VS Code ESLint extension works
- [ ] Pre-commit hooks function properly
- [ ] CI/CD pipelines pass
- [ ] All team members can use the configuration
- [ ] Plugin compatibility is maintained

## 🚨 Troubleshooting Common Issues

### Issue: "TypeError: context.getScope is not a function"

**Cause**: Plugin incompatibility with the rolled-back ESLint version.

**Solution**:
```bash
# Check plugin versions
npm list eslint-plugin-react-hooks eslint-plugin-react-refresh

# Downgrade incompatible plugins
npm install --save-dev eslint-plugin-react-hooks@^4.6.0
```

### Issue: "Cannot read config file"

**Cause**: Invalid .eslintrc.cjs syntax or missing dependencies.

**Solution**:
```bash
# Validate configuration syntax
npx eslint --print-config src/main/index.ts

# Check for missing parser/plugins
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### Issue: Environment Variable Not Working

**Cause**: `ESLINT_USE_FLAT_CONFIG=false` not properly set.

**Solution**:
```bash
# Add to shell profile
echo 'export ESLINT_USE_FLAT_CONFIG=false' >> ~/.bashrc
source ~/.bashrc

# Or add to package.json scripts permanently
"lint": "ESLINT_USE_FLAT_CONFIG=false eslint . --fix"
```

### Issue: VS Code Not Using Legacy Config

**Cause**: VS Code settings not properly configured.

**Solution**:
1. Restart VS Code completely
2. Check `.vscode/settings.json` has `"eslint.useFlatConfig": false`
3. Verify ESLint extension is enabled
4. Check VS Code terminal environment variables

## 📊 Performance Impact Analysis

### Expected Changes After Rollback

| Metric | Flat Config | Legacy Config | Impact |
|--------|-------------|---------------|---------|
| Startup Time | Fast | Slower | +10-20% |
| Configuration Loading | Optimized | Traditional | +5-15% |
| Memory Usage | Lower | Higher | +5-10% |
| Plugin Loading | Lazy | Eager | +15-25% |

### Monitoring Performance

```bash
# Benchmark linting performance
time npm run lint

# Compare with hyperfine
hyperfine "npm run lint" --warmup 3
```

## 🔄 Restoration Process

To restore flat config from backup:

```bash
# Use the generated restoration script
./path/to/backup/restore-flat-config.sh

# Or manually restore
cp backup/eslint.config.js .
cp backup/package.json .
cp backup/package-lock.json .
npm install
```

## 📈 Migration Strategy for Future

### Short-term (2025)

1. **Use rollback temporarily** for immediate compatibility
2. **Plan migration timeline** with team coordination
3. **Update development workflows** for legacy config
4. **Monitor plugin updates** for flat config compatibility

### Long-term (2025-2026)

1. **Migrate to flat config** as the standard approach
2. **Update team training** for flat config best practices
3. **Establish flat config guidelines** for new projects
4. **Phase out legacy config usage**

## 🔗 Related Documentation

- [ESLint Troubleshooting Guide](./ESLINT_TROUBLESHOOTING.md)
- [ESLint Flat Config Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide)
- [Plugin Migration Documentation](https://eslint.org/docs/latest/extend/plugin-migration-flat-config)

## 📞 Support and Resources

### Internal Resources

- **Primary Contact**: Development Team Lead
- **Documentation**: `/docs` directory
- **Backup Location**: `.eslint-rollback-backup-*` directories
- **Restoration Scripts**: Generated during rollback process

### External Resources

- [ESLint Official Documentation](https://eslint.org/docs/latest/)
- [TypeScript ESLint Documentation](https://typescript-eslint.io/)
- [React ESLint Plugin Documentation](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks)

---

**Last Updated**: 2025-06-02  
**ESLint Version Compatibility**: v8.x, v9.x (legacy mode), v10.x (downgrade required)  
**Maintenance Status**: Active - Updated for 2025 ESLint ecosystem changes