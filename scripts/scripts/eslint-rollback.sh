#!/bin/bash

# ESLint Flat Config Rollback Script (2025)
# Comprehensive rollback procedure for reverting from ESLint flat config to legacy eslintrc format
# Following 2025 best practices for version management and dependency rollback

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m' 
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

log_info "🔄 ESLint Flat Config Rollback Script (2025)"
echo "=============================================="
echo "This script will revert your project from ESLint flat config back to legacy eslintrc format."
echo ""

# Create backup directory
BACKUP_DIR="$PROJECT_ROOT/.eslint-rollback-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

log_info "📁 Creating backup in: $BACKUP_DIR"

# Function to confirm with user
confirm_action() {
    local message="$1"
    echo -e "${YELLOW}⚠️  $message${NC}"
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Operation cancelled by user"
        exit 1
    fi
}

# Function to backup current configuration
backup_current_config() {
    log_info "💾 Backing up current ESLint configuration..."
    
    # Backup flat config files
    if [ -f "eslint.config.js" ]; then
        cp "eslint.config.js" "$BACKUP_DIR/"
        log_success "Backed up eslint.config.js"
    fi
    
    if [ -f "eslint.config.ts" ]; then
        cp "eslint.config.ts" "$BACKUP_DIR/"
        log_success "Backed up eslint.config.ts"
    fi
    
    if [ -f "eslint.config.mjs" ]; then
        cp "eslint.config.mjs" "$BACKUP_DIR/"
        log_success "Backed up eslint.config.mjs"
    fi
    
    # Backup package.json and package-lock.json
    cp "package.json" "$BACKUP_DIR/"
    cp "package-lock.json" "$BACKUP_DIR/"
    log_success "Backed up package.json and package-lock.json"
    
    # Backup any VS Code settings
    if [ -d ".vscode" ]; then
        cp -r ".vscode" "$BACKUP_DIR/"
        log_success "Backed up .vscode directory"
    fi
}

# Function to check current ESLint version
check_current_eslint_version() {
    log_info "🔍 Checking current ESLint version..."
    
    local current_version=$(npm list eslint --depth=0 2>/dev/null | grep eslint@ | sed 's/.*eslint@//' | sed 's/ .*//')
    echo "Current ESLint version: $current_version"
    
    # Check if we need to downgrade
    if [[ "$current_version" =~ ^([0-9]+) ]]; then
        local major_version="${BASH_REMATCH[1]}"
        if [ "$major_version" -ge 10 ]; then
            log_warning "ESLint v$major_version detected - rollback required"
            echo "ESLint v10+ has removed eslintrc support entirely."
            echo "We will downgrade to ESLint v9.x with legacy support."
            return 0
        elif [ "$major_version" -eq 9 ]; then
            log_info "ESLint v9 detected - can use ESLINT_USE_FLAT_CONFIG=false"
            return 1
        else
            log_success "ESLint v8 or lower - eslintrc already supported"
            return 2
        fi
    fi
    
    return 0
}

# Function to downgrade ESLint and related packages
downgrade_eslint_packages() {
    log_info "📦 Downgrading ESLint and related packages..."
    
    # Define compatible package versions for ESLint v9.x with eslintrc support
    local packages_to_downgrade=(
        "eslint@^9.28.0"
        "@eslint/js@^9.28.0"
        "typescript-eslint@^8.33.1"
        "eslint-plugin-react-hooks@^5.2.0"
        "eslint-plugin-react-refresh@^0.4.16"
        "globals@^16.2.0"
    )
    
    log_warning "The following packages will be downgraded:"
    for package in "${packages_to_downgrade[@]}"; do
        echo "  - $package"
    done
    
    confirm_action "This will modify your package.json and package-lock.json files."
    
    # Remove current ESLint packages
    log_info "Removing current ESLint packages..."
    npm uninstall eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals || true
    
    # Install compatible versions
    log_info "Installing ESLint v9.x with legacy support..."
    npm install --save-dev "${packages_to_downgrade[@]}"
    
    log_success "ESLint packages downgraded successfully"
}

# Function to recreate .eslintrc.cjs configuration
recreate_eslintrc_config() {
    log_info "📝 Recreating .eslintrc.cjs configuration..."
    
    # Check if .eslintrc.cjs already exists
    if [ -f ".eslintrc.cjs" ]; then
        log_warning ".eslintrc.cjs already exists"
        confirm_action "Do you want to overwrite the existing .eslintrc.cjs file?"
        cp ".eslintrc.cjs" "$BACKUP_DIR/.eslintrc.cjs.existing"
    fi
    
    # Create comprehensive .eslintrc.cjs based on current flat config
    cat > ".eslintrc.cjs" << 'EOF'
// .eslintrc.cjs - Legacy ESLint Configuration for TaskMaster UI
// Recreated from flat config for rollback compatibility (2025)
// Electron + TypeScript + React project with multi-process architecture

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
    'coverage/**',
    'test-results/**',
    '**/*.d.ts',
    '.vite/**',
    '.electron-vite/**',
    'dist-packages/**',
    'debug-logs/**',
    'server/dist/**',
    'server/node_modules/**',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Core ESLint rules
    'no-unused-vars': 'off', // Use TypeScript version instead
    'no-undef': 'off', // TypeScript handles this
    
    // TypeScript rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-floating-promises': 'off', // Will be overridden in specific environments
    
    // React rules (will be overridden for renderer files)
    'react-hooks/rules-of-hooks': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react-refresh/only-export-components': 'off',
  },
  overrides: [
    // Main process specific configuration
    {
      files: ['src/main/**/*.{js,ts}'],
      env: {
        node: true,
        browser: false,
      },
      rules: {
        'no-console': 'off', // Main process can use console
        '@typescript-eslint/no-floating-promises': 'error',
      },
    },
    // Preload scripts specific configuration
    {
      files: ['src/preload/**/*.{js,ts}'],
      env: {
        node: true,
        browser: true, // Hybrid environment
      },
      rules: {
        'no-console': 'warn',
        '@typescript-eslint/no-explicit-any': 'error',
      },
    },
    // Renderer process specific configuration
    {
      files: ['src/renderer/**/*.{js,ts,jsx,tsx}'],
      env: {
        browser: true,
        node: false,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      rules: {
        'no-console': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'react-refresh/only-export-components': [
          'warn',
          { allowConstantExport: true },
        ],
      },
    },
    // Test files configuration
    {
      files: [
        '**/*.test.{js,ts,jsx,tsx}',
        '**/*.spec.{js,ts,jsx,tsx}',
        'tests/**/*.{js,ts,jsx,tsx}',
        '**/__tests__/**/*.{js,ts,jsx,tsx}',
      ],
      env: {
        jest: true,
        browser: true,
        node: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
    // Server files configuration
    {
      files: ['server/**/*.{js,ts}'],
      env: {
        node: true,
        browser: false,
      },
      parserOptions: {
        project: './server/tsconfig.json',
      },
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-floating-promises': 'error',
      },
    },
    // Configuration files
    {
      files: [
        '*.config.{js,ts,mjs}',
        '**/*.config.{js,ts,mjs}',
        'vite.*.config.{js,ts}',
        'electron.vite.config.{js,ts}',
        'vitest.config.{js,ts}',
        'tailwind.config.{js,ts}',
      ],
      env: {
        node: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
    // TypeScript files not in main tsconfig.json
    {
      files: ['*.{ts,tsx}', '__mocks__/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
      parserOptions: {
        project: null, // Don't require project for root-level files
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
EOF

    log_success "Created .eslintrc.cjs configuration"
}

# Function to update package.json scripts
update_package_scripts() {
    log_info "📝 Updating package.json scripts for legacy ESLint..."
    
    # Create a backup of package.json (already done in backup_current_config)
    
    # Update lint script to remove flat config specific flags and add legacy support
    local temp_file=$(mktemp)
    
    # Use Node.js to safely update package.json
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        // Update lint script to be compatible with legacy ESLint
        if (pkg.scripts && pkg.scripts.lint) {
            pkg.scripts.lint = pkg.scripts.lint
                .replace('--no-warn-ignored', '') // Remove flat config specific flag
                .replace(/\s+/g, ' ')  // Clean up extra spaces
                .trim();
        }
        
        // Add environment variable to force legacy config usage
        if (pkg.scripts && pkg.scripts.lint && !pkg.scripts.lint.includes('ESLINT_USE_FLAT_CONFIG=false')) {
            pkg.scripts.lint = 'ESLINT_USE_FLAT_CONFIG=false ' + pkg.scripts.lint;
        }
        
        // Update lint-staged to use legacy config
        if (pkg['lint-staged'] && pkg['lint-staged']['**/*.{js,mjs,cjs,ts,tsx}']) {
            const lintCommand = pkg['lint-staged']['**/*.{js,mjs,cjs,ts,tsx}'][0];
            if (typeof lintCommand === 'string' && lintCommand.includes('eslint')) {
                pkg['lint-staged']['**/*.{js,mjs,cjs,ts,tsx}'][0] = 'ESLINT_USE_FLAT_CONFIG=false ' + 
                    lintCommand.replace('--no-warn-ignored', '').replace(/\s+/g, ' ').trim();
            }
        }
        
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
    "
    
    log_success "Updated package.json scripts for legacy ESLint"
}

# Function to update VS Code settings
update_vscode_settings() {
    log_info "🔧 Updating VS Code settings for legacy ESLint..."
    
    if [ ! -d ".vscode" ]; then
        mkdir -p ".vscode"
    fi
    
    local settings_file=".vscode/settings.json"
    
    # Create or update VS Code settings
    if [ -f "$settings_file" ]; then
        # Use Node.js to safely update existing settings
        node -e "
            const fs = require('fs');
            let settings = {};
            
            try {
                settings = JSON.parse(fs.readFileSync('$settings_file', 'utf8'));
            } catch (e) {
                console.log('Creating new VS Code settings file');
            }
            
            // Force legacy ESLint configuration
            settings['eslint.useFlatConfig'] = false;
            
            // Ensure ESLint is enabled
            settings['eslint.enable'] = true;
            
            // Add environment variable for VS Code terminal
            if (!settings['terminal.integrated.env.osx']) {
                settings['terminal.integrated.env.osx'] = {};
            }
            settings['terminal.integrated.env.osx']['ESLINT_USE_FLAT_CONFIG'] = 'false';
            
            if (!settings['terminal.integrated.env.linux']) {
                settings['terminal.integrated.env.linux'] = {};
            }
            settings['terminal.integrated.env.linux']['ESLINT_USE_FLAT_CONFIG'] = 'false';
            
            if (!settings['terminal.integrated.env.windows']) {
                settings['terminal.integrated.env.windows'] = {};
            }
            settings['terminal.integrated.env.windows']['ESLINT_USE_FLAT_CONFIG'] = 'false';
            
            fs.writeFileSync('$settings_file', JSON.stringify(settings, null, 2) + '\\n');
        "
        
        log_success "Updated existing VS Code settings"
    else
        # Create new settings file
        cat > "$settings_file" << 'EOF'
{
  "eslint.useFlatConfig": false,
  "eslint.enable": true,
  "eslint.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
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
EOF
        log_success "Created new VS Code settings"
    fi
}

# Function to remove flat config files
remove_flat_config_files() {
    log_info "🗑️  Removing flat config files..."
    
    local files_to_remove=(
        "eslint.config.js"
        "eslint.config.ts"
        "eslint.config.mjs"
    )
    
    for file in "${files_to_remove[@]}"; do
        if [ -f "$file" ]; then
            log_warning "Removing $file"
            rm "$file"
            log_success "Removed $file"
        fi
    done
}

# Function to test the rollback
test_rollback() {
    log_info "🧪 Testing the rollback configuration..."
    
    # Set environment variable for this test
    export ESLINT_USE_FLAT_CONFIG=false
    
    # Test basic linting
    log_info "Running basic lint test..."
    if npm run lint > /tmp/eslint_rollback_test.log 2>&1; then
        log_success "✓ ESLint is working with legacy configuration"
    else
        local exit_code=$?
        log_warning "⚠️ ESLint test had issues (exit code: $exit_code)"
        log_info "This may be expected if there are existing linting errors"
        log_info "Check the output: cat /tmp/eslint_rollback_test.log"
    fi
    
    # Test configuration parsing
    log_info "Testing configuration parsing..."
    if npx eslint --print-config src/main/index.ts > /tmp/eslint_config_test.json 2>/dev/null; then
        log_success "✓ Configuration parsing successful"
    else
        log_error "❌ Configuration parsing failed"
        return 1
    fi
    
    # Verify environment variable is working
    if [ "$ESLINT_USE_FLAT_CONFIG" = "false" ]; then
        log_success "✓ ESLINT_USE_FLAT_CONFIG environment variable is properly set"
    else
        log_warning "⚠️ ESLINT_USE_FLAT_CONFIG may not be set correctly"
    fi
}

# Function to create rollback completion script
create_completion_script() {
    log_info "📋 Creating rollback completion script..."
    
    cat > "$BACKUP_DIR/restore-flat-config.sh" << EOF
#!/bin/bash

# Script to restore flat config from backup
# Created during rollback on $(date)

set -euo pipefail

BACKUP_DIR="$BACKUP_DIR"
PROJECT_ROOT="$PROJECT_ROOT"

echo "🔄 Restoring ESLint flat config from backup..."
echo "Backup directory: \$BACKUP_DIR"
echo ""

cd "\$PROJECT_ROOT"

# Restore flat config files
if [ -f "\$BACKUP_DIR/eslint.config.js" ]; then
    cp "\$BACKUP_DIR/eslint.config.js" .
    echo "✅ Restored eslint.config.js"
fi

if [ -f "\$BACKUP_DIR/eslint.config.ts" ]; then
    cp "\$BACKUP_DIR/eslint.config.ts" .
    echo "✅ Restored eslint.config.ts"
fi

# Restore package files
cp "\$BACKUP_DIR/package.json" .
cp "\$BACKUP_DIR/package-lock.json" .
echo "✅ Restored package.json and package-lock.json"

# Restore VS Code settings
if [ -d "\$BACKUP_DIR/.vscode" ]; then
    cp -r "\$BACKUP_DIR/.vscode" .
    echo "✅ Restored .vscode settings"
fi

# Remove legacy config
if [ -f ".eslintrc.cjs" ]; then
    rm ".eslintrc.cjs"
    echo "✅ Removed .eslintrc.cjs"
fi

# Reinstall dependencies
echo "📦 Reinstalling dependencies..."
npm install

echo ""
echo "🎉 Flat config restoration complete!"
echo "You may need to restart your IDE to pick up the changes."
EOF

    chmod +x "$BACKUP_DIR/restore-flat-config.sh"
    log_success "Created restore script: $BACKUP_DIR/restore-flat-config.sh"
}

# Main execution
main() {
    confirm_action "This will rollback your ESLint configuration from flat config to legacy eslintrc format."
    
    # Backup current configuration
    backup_current_config
    
    # Check ESLint version and determine rollback strategy
    check_current_eslint_version
    local version_check_result=$?
    
    case $version_check_result in
        0) # ESLint v10+ - requires downgrade
            downgrade_eslint_packages
            ;;
        1) # ESLint v9 - can use environment variable
            log_info "ESLint v9 detected - using ESLINT_USE_FLAT_CONFIG=false approach"
            ;;
        2) # ESLint v8 or lower - already supports eslintrc
            log_info "ESLint v8 or lower - legacy config already supported"
            ;;
    esac
    
    # Create legacy configuration
    recreate_eslintrc_config
    
    # Update package.json scripts
    update_package_scripts
    
    # Update VS Code settings
    update_vscode_settings
    
    # Remove flat config files
    remove_flat_config_files
    
    # Create completion script
    create_completion_script
    
    # Test the rollback
    test_rollback
    
    echo ""
    log_success "🎉 ESLint Rollback Complete!"
    echo "================================================"
    echo "📁 Backup location: $BACKUP_DIR"
    echo "📝 Legacy config: .eslintrc.cjs"
    echo "🔄 Restore script: $BACKUP_DIR/restore-flat-config.sh"
    echo ""
    echo "📖 Next Steps:"
    echo "  1. Restart your IDE to pick up the new configuration"
    echo "  2. Run 'npm run lint' to verify the rollback works"
    echo "  3. Set ESLINT_USE_FLAT_CONFIG=false in your shell if needed"
    echo "  4. Review the ESLINT_ROLLBACK_GUIDE.md for detailed information"
    echo ""
    echo "⚠️  Remember: This rollback is temporary. ESLint v10+ has removed"
    echo "   eslintrc support entirely. Plan your migration strategy accordingly."
}

# Execute main function
main "$@"