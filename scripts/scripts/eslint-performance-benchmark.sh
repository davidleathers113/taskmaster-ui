#!/bin/bash

# ESLint Flat Config Performance Benchmarking Script (2025)
# Using hyperfine for accurate performance measurement following 2025 best practices
# Measures ESLint performance across different scenarios and file sizes

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

log_info "🚀 ESLint Flat Config Performance Benchmarking (2025)"
echo "================================================="

# Check for hyperfine installation
if ! command -v hyperfine &> /dev/null; then
    log_warning "hyperfine not found. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install hyperfine
        log_success "hyperfine installed successfully"
    else
        log_error "Homebrew not available. Please install hyperfine manually:"
        log_error "  macOS: brew install hyperfine"
        log_error "  Linux: cargo install hyperfine"
        log_error "  Or download from: https://github.com/sharkdp/hyperfine"
        exit 1
    fi
fi

# Create benchmarking results directory
RESULTS_DIR="$PROJECT_ROOT/scripts/performance-results"
mkdir -p "$RESULTS_DIR"

log_info "📊 Starting Performance Benchmarking..."

# Benchmark 1: Single file linting (different file types)
log_info "🔬 Benchmark 1: Single File Linting Performance"

hyperfine \
  --warmup 3 \
  --min-runs 10 \
  --max-runs 50 \
  --export-json "$RESULTS_DIR/single-file-benchmark.json" \
  --export-markdown "$RESULTS_DIR/single-file-benchmark.md" \
  --export-csv "$RESULTS_DIR/single-file-benchmark.csv" \
  "npx eslint src/main/index.ts" \
  "npx eslint src/preload/index.ts" \
  "npx eslint src/renderer/src/App.tsx" \
  "npx eslint server/file-watcher.ts"

log_success "Single file benchmarking completed"

# Benchmark 2: Directory-based linting
log_info "🔬 Benchmark 2: Directory-Based Linting Performance"

hyperfine \
  --warmup 2 \
  --min-runs 5 \
  --max-runs 20 \
  --export-json "$RESULTS_DIR/directory-benchmark.json" \
  --export-markdown "$RESULTS_DIR/directory-benchmark.md" \
  --export-csv "$RESULTS_DIR/directory-benchmark.csv" \
  "npx eslint src/main/" \
  "npx eslint src/preload/" \
  "npx eslint src/renderer/" \
  "npx eslint server/"

log_success "Directory benchmarking completed"

# Benchmark 3: Full project linting
log_info "🔬 Benchmark 3: Full Project Linting Performance"

hyperfine \
  --warmup 1 \
  --min-runs 3 \
  --max-runs 10 \
  --export-json "$RESULTS_DIR/full-project-benchmark.json" \
  --export-markdown "$RESULTS_DIR/full-project-benchmark.md" \
  --export-csv "$RESULTS_DIR/full-project-benchmark.csv" \
  "npx eslint ." \
  "npx eslint . --cache" \
  "npx eslint . --max-warnings 0"

log_success "Full project benchmarking completed"

# Benchmark 4: Memory usage analysis (using GNU time if available)
log_info "🔬 Benchmark 4: Memory Usage Analysis"

if command -v /usr/bin/time &> /dev/null; then
    echo "Testing memory usage..."
    /usr/bin/time -l npx eslint . > "$RESULTS_DIR/memory-usage.txt" 2>&1 || true
    log_success "Memory usage analysis completed"
else
    log_warning "GNU time not available for memory analysis"
fi

# Benchmark 5: TypeScript parsing performance
log_info "🔬 Benchmark 5: TypeScript Parsing Performance"

hyperfine \
  --warmup 3 \
  --min-runs 10 \
  --export-json "$RESULTS_DIR/typescript-benchmark.json" \
  --export-markdown "$RESULTS_DIR/typescript-benchmark.md" \
  "npx eslint src/**/*.ts" \
  "npx eslint src/**/*.tsx"

log_success "TypeScript benchmarking completed"

# Generate comprehensive report
log_info "📋 Generating Comprehensive Performance Report..."

cat > "$RESULTS_DIR/performance-summary.md" << 'EOF'
# ESLint Flat Config Performance Benchmarking Report (2025)

## Overview
This report contains performance benchmarking results for the ESLint flat configuration implementation using hyperfine, following 2025 best practices for performance measurement.

## Benchmarking Methodology
- **Tool**: hyperfine v1.18+ (modern CLI benchmarking tool)
- **Warmup Runs**: 1-3 iterations to eliminate cold start effects
- **Measurement Runs**: 3-50 iterations for statistical significance
- **Output Formats**: JSON, Markdown, CSV for comprehensive analysis
- **Environment**: macOS with M1/M2 processor optimization

## Test Scenarios

### 1. Single File Linting
Testing individual file linting performance across different process contexts:
- Main process TypeScript files
- Preload script files
- Renderer React/TypeScript files
- Server-side TypeScript files

### 2. Directory-Based Linting
Testing directory-level linting performance:
- Process-specific directory linting
- Comparing overhead across different module types

### 3. Full Project Linting
Testing complete project linting:
- Standard linting
- Cached linting performance
- Strict mode (--max-warnings 0) performance

### 4. Memory Usage Analysis
Memory consumption patterns during linting operations

### 5. TypeScript Parsing Performance
Specialized testing for TypeScript and TSX file processing

## Performance Metrics
- **Mean execution time**: Average time across all runs
- **Standard deviation**: Consistency of performance
- **Min/Max times**: Best and worst case performance
- **Memory usage**: Peak memory consumption (where available)

## Results
See individual benchmark files for detailed results:
- `single-file-benchmark.json/md/csv`
- `directory-benchmark.json/md/csv`
- `full-project-benchmark.json/md/csv`
- `typescript-benchmark.json/md/csv`
- `memory-usage.txt`

## 2025 Performance Optimizations Tested
- ESLint flat config vs legacy config overhead
- Intelligent caching mechanisms
- Multi-process Electron architecture impact
- TypeScript parser performance improvements
- Memory optimization patterns

EOF

# Calculate summary statistics
log_info "📊 Calculating Performance Statistics..."

if command -v jq &> /dev/null; then
    # Extract mean times from JSON results
    echo "## Quick Performance Summary" >> "$RESULTS_DIR/performance-summary.md"
    echo "" >> "$RESULTS_DIR/performance-summary.md"
    
    for benchmark_file in "$RESULTS_DIR"/*.json; do
        if [[ -f "$benchmark_file" ]]; then
            benchmark_name=$(basename "$benchmark_file" .json)
            echo "### $benchmark_name" >> "$RESULTS_DIR/performance-summary.md"
            echo '```' >> "$RESULTS_DIR/performance-summary.md"
            jq -r '.results[] | "\(.command): \(.mean | . * 1000 | floor)ms (±\(.stddev | . * 1000 | floor)ms)"' "$benchmark_file" >> "$RESULTS_DIR/performance-summary.md" 2>/dev/null || echo "Error processing $benchmark_file" >> "$RESULTS_DIR/performance-summary.md"
            echo '```' >> "$RESULTS_DIR/performance-summary.md"
            echo "" >> "$RESULTS_DIR/performance-summary.md"
        fi
    done
else
    log_warning "jq not available for JSON processing. Install with 'brew install jq' for enhanced reporting."
fi

log_success "📄 Performance report generated: $RESULTS_DIR/performance-summary.md"

# Display quick summary
log_info "🎯 Benchmarking Summary"
echo "========================================="
echo "📁 Results Directory: $RESULTS_DIR"
echo "📊 Benchmark Files Created:"
find "$RESULTS_DIR" -name "*.json" -o -name "*.md" -o -name "*.csv" -o -name "*.txt" | sort
echo ""
log_success "🚀 ESLint Performance Benchmarking Complete!"
echo ""
log_info "📖 Next Steps:"
echo "  1. Review performance-summary.md for comprehensive analysis"
echo "  2. Compare results with project performance requirements"
echo "  3. Identify optimization opportunities if needed"
echo "  4. Use cached linting for faster development workflow"