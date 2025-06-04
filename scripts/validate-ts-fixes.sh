#!/bin/bash
# Validation script to detect test regressions after TypeScript fixes

echo "TypeScript Fix Validation Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to count errors
count_errors() {
    local output="$1"
    local pattern="$2"
    echo "$output" | grep -c "$pattern" || echo "0"
}

# Step 1: Get baseline metrics
echo "📊 Getting baseline metrics..."

# TypeScript errors
echo -n "  TypeScript errors: "
TS_BASELINE=$(npm run typecheck 2>&1 | grep -c "error TS" || echo "0")
echo "$TS_BASELINE"

# ESLint errors
echo -n "  ESLint errors: "
ESLINT_OUTPUT=$(npm run lint 2>&1)
ESLINT_ERRORS=$(echo "$ESLINT_OUTPUT" | grep -oP '\d+ errors' | awk '{print $1}' | head -1 || echo "0")
ESLINT_WARNINGS=$(echo "$ESLINT_OUTPUT" | grep -oP '\d+ warnings' | awk '{print $1}' | head -1 || echo "0")
echo "$ESLINT_ERRORS (warnings: $ESLINT_WARNINGS)"

# Test results (if tests can run)
echo -n "  Running tests: "
TEST_OUTPUT=$(npm test -- --run 2>&1 || true)
PASSING_TESTS=$(echo "$TEST_OUTPUT" | grep -oP '\d+ passed' | awk '{print $1}' | tail -1 || echo "0")
FAILING_TESTS=$(echo "$TEST_OUTPUT" | grep -oP '\d+ failed' | awk '{print $1}' | tail -1 || echo "0")
TOTAL_TESTS=$((PASSING_TESTS + FAILING_TESTS))

if [ "$TOTAL_TESTS" -gt 0 ]; then
    PASS_RATE=$((PASSING_TESTS * 100 / TOTAL_TESTS))
    echo "$PASSING_TESTS/$TOTAL_TESTS passed (${PASS_RATE}%)"
else
    echo "Tests not running due to compilation errors"
    PASS_RATE=0
fi

echo ""
echo "📝 Baseline Summary:"
echo "  - TypeScript errors: $TS_BASELINE"
echo "  - ESLint errors: $ESLINT_ERRORS"
echo "  - Test pass rate: ${PASS_RATE}%"
echo ""

# Function to validate after fixes
validate_fixes() {
    local fix_name="$1"
    echo "🔍 Validating after: $fix_name"
    
    # Get new metrics
    local ts_current=$(npm run typecheck 2>&1 | grep -c "error TS" || echo "0")
    local eslint_output=$(npm run lint 2>&1)
    local eslint_current=$(echo "$eslint_output" | grep -oP '\d+ errors' | awk '{print $1}' | head -1 || echo "0")
    
    # Run tests if possible
    local test_output=$(npm test -- --run 2>&1 || true)
    local passing_current=$(echo "$test_output" | grep -oP '\d+ passed' | awk '{print $1}' | tail -1 || echo "0")
    local failing_current=$(echo "$test_output" | grep -oP '\d+ failed' | awk '{print $1}' | tail -1 || echo "0")
    local total_current=$((passing_current + failing_current))
    
    if [ "$total_current" -gt 0 ]; then
        local pass_rate_current=$((passing_current * 100 / total_current))
    else
        local pass_rate_current=0
    fi
    
    # Compare results
    echo "  TypeScript: $TS_BASELINE → $ts_current"
    echo "  ESLint: $ESLINT_ERRORS → $eslint_current"
    echo "  Test pass rate: ${PASS_RATE}% → ${pass_rate_current}%"
    
    # Check for regressions
    local has_regression=false
    
    if [ "$ts_current" -gt "$TS_BASELINE" ]; then
        echo -e "  ${RED}⚠️  TypeScript errors increased!${NC}"
        has_regression=true
    fi
    
    if [ "$pass_rate_current" -lt "$PASS_RATE" ] && [ "$PASS_RATE" -gt 0 ]; then
        echo -e "  ${RED}⚠️  Test pass rate decreased!${NC}"
        has_regression=true
    fi
    
    if [ "$has_regression" = true ]; then
        echo -e "  ${RED}❌ REGRESSION DETECTED - Fix should be reverted${NC}"
        return 1
    else
        echo -e "  ${GREEN}✅ No regressions detected${NC}"
        
        # Update baselines for next validation
        TS_BASELINE=$ts_current
        ESLINT_ERRORS=$eslint_current
        PASS_RATE=$pass_rate_current
        PASSING_TESTS=$passing_current
        FAILING_TESTS=$failing_current
        TOTAL_TESTS=$total_current
        
        return 0
    fi
}

# Example usage (uncomment when running specific fixes):
# validate_fixes "Express handler return statements"
# validate_fixes "Type mismatch corrections"
# validate_fixes "Mock factory implementations"

echo ""
echo "🎯 Validation script ready!"
echo "Call validate_fixes function after each batch of fixes"
echo ""

# Export the function for use in other scripts
export -f validate_fixes
export TS_BASELINE ESLINT_ERRORS PASS_RATE