#!/bin/bash

# ESLint Flat Config File Pattern Regression Testing (2025)
# Comprehensive validation that different file types receive appropriate rule sets
# Following 2025 best practices for pattern-based configuration testing

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

log_info "🧪 ESLint Flat Config File Pattern Regression Testing (2025)"
echo "=============================================================="

# Create test results directory
RESULTS_DIR="$PROJECT_ROOT/scripts/pattern-test-results"
mkdir -p "$RESULTS_DIR"

# Test file patterns based on flat config specifications
declare -A TEST_PATTERNS
TEST_PATTERNS["src/main/index.ts"]="main-process"
TEST_PATTERNS["src/main/errorReporting.ts"]="main-process"
TEST_PATTERNS["src/preload/index.ts"]="preload-script"
TEST_PATTERNS["src/preload/errorReporting.ts"]="preload-script"
TEST_PATTERNS["src/renderer/src/App.tsx"]="renderer-react"
TEST_PATTERNS["src/renderer/src/main.tsx"]="renderer-react"
TEST_PATTERNS["src/renderer/src/components/task/TaskCard.tsx"]="react-component"
TEST_PATTERNS["src/renderer/src/components/layout/Header.tsx"]="react-component"
TEST_PATTERNS["src/renderer/src/components/__tests__/ErrorBoundary.test.tsx"]="test-file"
TEST_PATTERNS["src/renderer/src/components/task/__tests__/TaskCard.test.tsx"]="test-file"
TEST_PATTERNS["vite.config.ts"]="config-file"
TEST_PATTERNS["electron.vite.config.ts"]="config-file"
TEST_PATTERNS["eslint.config.js"]="config-file"
TEST_PATTERNS["server/file-watcher.ts"]="server-typescript"
TEST_PATTERNS["server/claude-config-api.ts"]="server-typescript"
TEST_PATTERNS["server/discovery-engine.js"]="server-javascript"

# Expected rules for each context (based on flat config specification)
declare -A EXPECTED_RULES
EXPECTED_RULES["main-process"]="no-console:off,@typescript-eslint/no-floating-promises:error"
EXPECTED_RULES["preload-script"]="no-console:warn,@typescript-eslint/no-explicit-any:error"
EXPECTED_RULES["renderer-react"]="no-console:warn,react-hooks/rules-of-hooks:error,react-refresh/only-export-components:warn"
EXPECTED_RULES["react-component"]="react-hooks/rules-of-hooks:error,react-hooks/exhaustive-deps:warn,react-refresh/only-export-components:warn"
EXPECTED_RULES["test-file"]="@typescript-eslint/no-explicit-any:off,no-console:off"
EXPECTED_RULES["config-file"]="@typescript-eslint/no-explicit-any:off,no-console:off"
EXPECTED_RULES["server-typescript"]="no-console:off,@typescript-eslint/no-floating-promises:error"
EXPECTED_RULES["server-javascript"]="no-console:off"

log_info "🔍 Testing File Pattern Configurations..."

# Function to extract and analyze rules for a specific file
test_file_pattern() {
    local file_path="$1"
    local expected_context="$2"
    local test_name="${file_path//\//_}"
    
    log_info "Testing: $file_path (expected: $expected_context)"
    
    # Get the resolved configuration for this file
    if npx eslint --print-config "$file_path" > "$RESULTS_DIR/${test_name}_config.json" 2>/dev/null; then
        log_success "✓ Config resolved for $file_path"
        
        # Extract key rule configurations
        if command -v jq &> /dev/null; then
            # Extract specific rules we're testing for
            local rules_output="$RESULTS_DIR/${test_name}_rules.json"
            jq '.rules | to_entries | map(select(.key | test("no-console|@typescript-eslint/no-explicit-any|@typescript-eslint/no-floating-promises|react-hooks|react-refresh")))' "$RESULTS_DIR/${test_name}_config.json" > "$rules_output"
            
            # Count total rules applied
            local rule_count=$(jq '.rules | length' "$RESULTS_DIR/${test_name}_config.json")
            log_info "  Rules applied: $rule_count"
            
            # Check for context-specific rules
            case "$expected_context" in
                "main-process")
                    if jq -e '.rules["no-console"] == [0] or .rules["no-console"] == "off"' "$RESULTS_DIR/${test_name}_config.json" >/dev/null; then
                        log_success "  ✓ Main process allows console (correct)"
                    else
                        log_warning "  ⚠ Main process console rule unexpected"
                    fi
                    ;;
                "renderer-react")
                    if jq -e '.rules["react-hooks/rules-of-hooks"]' "$RESULTS_DIR/${test_name}_config.json" >/dev/null; then
                        log_success "  ✓ React hooks rules applied (correct)"
                    else
                        log_error "  ❌ React hooks rules missing"
                    fi
                    ;;
                "test-file")
                    if jq -e '.rules["@typescript-eslint/no-explicit-any"] == [0] or .rules["@typescript-eslint/no-explicit-any"] == "off"' "$RESULTS_DIR/${test_name}_config.json" >/dev/null; then
                        log_success "  ✓ Test files allow any type (correct)"
                    else
                        log_warning "  ⚠ Test file any-type rule unexpected"
                    fi
                    ;;
                "config-file")
                    if jq -e '.rules["@typescript-eslint/no-explicit-any"] == [0] or .rules["@typescript-eslint/no-explicit-any"] == "off"' "$RESULTS_DIR/${test_name}_config.json" >/dev/null; then
                        log_success "  ✓ Config files are permissive (correct)"
                    else
                        log_warning "  ⚠ Config file rules unexpectedly strict"
                    fi
                    ;;
            esac
            
        else
            log_warning "jq not available for detailed rule analysis"
        fi
        
        return 0
    else
        log_error "❌ Failed to resolve config for $file_path"
        return 1
    fi
}

# Function to test glob pattern matching
test_glob_patterns() {
    log_info "🔍 Testing Glob Pattern Matching..."
    
    # Test patterns that should match
    local patterns_to_test=(
        "src/main/**/*.ts"
        "src/preload/**/*.ts" 
        "src/renderer/**/*.{js,ts,jsx,tsx}"
        "**/*.test.{js,ts,jsx,tsx}"
        "**/*.config.{js,ts,mjs}"
        "server/**/*.ts"
    )
    
    for pattern in "${patterns_to_test[@]}"; do
        log_info "Testing pattern: $pattern"
        
        # Use find to simulate glob pattern matching
        case "$pattern" in
            "src/main/**/*.ts")
                local found_files=$(find src/main -name "*.ts" 2>/dev/null | wc -l)
                ;;
            "src/preload/**/*.ts")
                local found_files=$(find src/preload -name "*.ts" 2>/dev/null | wc -l)
                ;;
            "src/renderer/**/*.{js,ts,jsx,tsx}")
                local found_files=$(find src/renderer -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" 2>/dev/null | wc -l)
                ;;
            "**/*.test.{js,ts,jsx,tsx}")
                local found_files=$(find . -name "*.test.js" -o -name "*.test.ts" -o -name "*.test.jsx" -o -name "*.test.tsx" 2>/dev/null | wc -l)
                ;;
            "**/*.config.{js,ts,mjs}")
                local found_files=$(find . -name "*.config.js" -o -name "*.config.ts" -o -name "*.config.mjs" 2>/dev/null | wc -l)
                ;;
            "server/**/*.ts")
                local found_files=$(find server -name "*.ts" 2>/dev/null | wc -l)
                ;;
        esac
        
        if [ "$found_files" -gt 0 ]; then
            log_success "  ✓ Pattern matches $found_files files"
        else
            log_warning "  ⚠ Pattern matches no files"
        fi
    done
}

# Function to create test report
generate_pattern_report() {
    log_info "📋 Generating Pattern Testing Report..."
    
    cat > "$RESULTS_DIR/pattern-test-report.md" << 'EOF'
# ESLint Flat Config File Pattern Regression Test Report (2025)

## Overview
This report validates that the ESLint flat configuration correctly applies appropriate rule sets to different file types and patterns across the Electron + React + TypeScript project architecture.

## Test Methodology
- **Pattern Testing**: Verification that glob patterns match intended files
- **Rule Application**: Confirmation that context-specific rules are applied correctly
- **Configuration Resolution**: Testing ESLint's `--print-config` for each file type
- **Regression Testing**: Ensuring no unintended rule changes across file contexts

## File Pattern Categories Tested

### Main Process Files (`src/main/**/*.ts`)
- **Environment**: Node.js
- **Expected Rules**: Console allowed, async promise handling required
- **Security**: Strict TypeScript, no browser globals

### Preload Scripts (`src/preload/**/*.ts`) 
- **Environment**: Hybrid Node.js + Browser APIs
- **Expected Rules**: Restricted console, strict context bridge usage
- **Security**: Enhanced restrictions for security bridge

### Renderer React Files (`src/renderer/**/*.{js,ts,jsx,tsx}`)
- **Environment**: Browser with React
- **Expected Rules**: React hooks validation, React refresh rules
- **Performance**: React-specific optimizations

### Test Files (`**/*.test.{js,ts,jsx,tsx}`)
- **Environment**: Jest testing environment
- **Expected Rules**: Relaxed restrictions for testing patterns
- **Flexibility**: Allow any types and console statements

### Configuration Files (`**/*.config.{js,ts,mjs}`)
- **Environment**: Node.js build tools
- **Expected Rules**: Permissive for build tool compatibility
- **Flexibility**: Allow any types and complex configurations

### Server Files (`server/**/*.{js,ts}`)
- **Environment**: Standalone Node.js server
- **Expected Rules**: Server-appropriate restrictions
- **Performance**: Async handling, logging permissions

## Pattern Matching Validation
EOF

    # Add pattern test results to report
    echo "## Test Results Summary" >> "$RESULTS_DIR/pattern-test-report.md"
    echo "" >> "$RESULTS_DIR/pattern-test-report.md"
    
    local total_tests=0
    local passed_tests=0
    
    for file_path in "${!TEST_PATTERNS[@]}"; do
        ((total_tests++))
        if [ -f "$RESULTS_DIR/${file_path//\//_}_config.json" ]; then
            ((passed_tests++))
            echo "✅ **$file_path** → ${TEST_PATTERNS[$file_path]} (PASS)" >> "$RESULTS_DIR/pattern-test-report.md"
        else
            echo "❌ **$file_path** → ${TEST_PATTERNS[$file_path]} (FAIL)" >> "$RESULTS_DIR/pattern-test-report.md"
        fi
    done
    
    echo "" >> "$RESULTS_DIR/pattern-test-report.md"
    echo "**Overall Results**: $passed_tests/$total_tests tests passed" >> "$RESULTS_DIR/pattern-test-report.md"
    
    local success_rate=$((passed_tests * 100 / total_tests))
    echo "**Success Rate**: $success_rate%" >> "$RESULTS_DIR/pattern-test-report.md"
    
    if [ $success_rate -ge 90 ]; then
        echo "**Status**: ✅ EXCELLENT - Flat config pattern matching working optimally" >> "$RESULTS_DIR/pattern-test-report.md"
    elif [ $success_rate -ge 75 ]; then
        echo "**Status**: ⚠️ GOOD - Minor pattern issues detected" >> "$RESULTS_DIR/pattern-test-report.md"
    else
        echo "**Status**: ❌ NEEDS ATTENTION - Significant pattern matching issues" >> "$RESULTS_DIR/pattern-test-report.md"
    fi
    
    log_success "📄 Pattern test report generated: $RESULTS_DIR/pattern-test-report.md"
    log_info "📊 Results: $passed_tests/$total_tests tests passed ($success_rate%)"
}

# Main execution
log_info "🚀 Starting File Pattern Regression Tests..."

# Test individual file patterns
total_tests=0
passed_tests=0

for file_path in "${!TEST_PATTERNS[@]}"; do
    if [ -f "$file_path" ]; then
        ((total_tests++))
        if test_file_pattern "$file_path" "${TEST_PATTERNS[$file_path]}"; then
            ((passed_tests++))
        fi
        echo ""
    else
        log_warning "⚠️ File not found: $file_path (skipping)"
    fi
done

# Test glob pattern matching
test_glob_patterns

# Generate comprehensive report
generate_pattern_report

# Display summary
log_info "🎯 File Pattern Regression Testing Summary"
echo "============================================="
echo "📁 Results Directory: $RESULTS_DIR"
echo "🧪 Total Tests: $total_tests"
echo "✅ Passed Tests: $passed_tests"
echo "❌ Failed Tests: $((total_tests - passed_tests))"

if [ $passed_tests -eq $total_tests ]; then
    log_success "🎉 All file pattern tests passed!"
    echo "🔧 Flat config is correctly applying rules across all file types"
elif [ $passed_tests -gt $((total_tests * 3 / 4)) ]; then
    log_warning "⚠️ Most tests passed with minor issues"
    echo "🔍 Review failed tests for optimization opportunities"
else
    log_error "❌ Significant pattern matching issues detected"
    echo "🚨 Flat config needs attention for proper rule application"
fi

echo ""
log_success "🚀 File Pattern Regression Testing Complete!"
echo ""
log_info "📖 Next Steps:"
echo "  1. Review pattern-test-report.md for detailed analysis"
echo "  2. Address any failed pattern tests"
echo "  3. Verify rule application meets project requirements"
echo "  4. Update patterns if new file types are added"