#!/bin/bash

# Quick ESLint Performance Test (2025) - Simplified Version
# For immediate performance validation while comprehensive benchmarking runs

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Quick ESLint Performance Test (2025)"
echo "========================================"

# Test 1: Simple timing test
echo "📊 Test 1: Basic Timing Test"
echo "Command: npx eslint src/main/index.ts"
time npx eslint src/main/index.ts --max-warnings 999 || echo "Linting completed with warnings/errors (expected)"
echo ""

# Test 2: Cache performance comparison
echo "📊 Test 2: Cache Performance Test"
echo "Without cache:"
time npx eslint src/renderer/src/App.tsx --max-warnings 999 --no-cache || echo "Completed"
echo ""
echo "With cache:"
time npx eslint src/renderer/src/App.tsx --max-warnings 999 --cache || echo "Completed"
echo ""

# Test 3: File count impact
echo "📊 Test 3: File Count Impact"
echo "Single file:"
time npx eslint src/renderer/src/App.tsx --max-warnings 999 || echo "Completed"
echo ""
echo "Directory:"
time npx eslint src/renderer/src/components/ --max-warnings 999 || echo "Completed"
echo ""

# Test 4: Rule performance impact
echo "📊 Test 4: Rule Performance with TIMING"
echo "Running with TIMING=1 to show rule performance breakdown:"
TIMING=1 npx eslint src/renderer/src/App.tsx --max-warnings 999 || echo "Completed"

echo ""
echo "✅ Quick performance tests completed!"
echo "📋 Key insights:"
echo "  - Basic ESLint execution time measured"
echo "  - Cache impact demonstrated"  
echo "  - File count scaling observed"
echo "  - Rule-level performance profiled"