#!/bin/bash

# Resolve conflicts by preferring the incoming branch changes for test files
# This script handles the common pattern where vi type declarations are causing conflicts

# Function to resolve conflicts in a file
resolve_conflicts() {
    local file=$1
    echo "Resolving conflicts in: $file"
    
    # Create a temporary file
    temp_file="${file}.tmp"
    
    # Process the file
    sed -E '
        # Remove vi declaration conflicts
        /<<<<<<< HEAD/{
            N
            s/<<<<<<< HEAD\n[[:space:]]*const vi: typeof import\(.vitest.\)\.vi//
            N
            s/\n=======\n>>>>>>>[^\n]*//
        }
        # For other conflicts, keep the incoming changes
        /<<<<<<< HEAD/,/>>>>>>>/d
    ' "$file" > "$temp_file"
    
    # Move the temp file back
    mv "$temp_file" "$file"
}

# Test files with conflicts
test_files=(
    "src/main/__tests__/auto-updater-differential.test.ts"
    "src/main/__tests__/auto-updater-integration.test.ts"
    "src/main/__tests__/auto-updater-security.test.ts"
    "src/main/__tests__/auto-updater.test.ts"
    "src/main/__tests__/baseline.test.ts"
    "src/main/__tests__/cross-process-communication.test.ts"
    "src/main/__tests__/ipc-security.test.ts"
    "src/main/__tests__/lifecycle.test.ts"
    "src/main/__tests__/memory-leak-detection.test.ts"
    "src/main/__tests__/memory-leaks.test.ts"
    "src/main/__tests__/mocked-apis.test.ts"
    "src/main/__tests__/mocked-electron-apis.test.ts"
    "src/preload/__tests__/preload-security.test.ts"
    "src/renderer/src/components/error/__tests__/ErrorBoundary.test.tsx"
    "src/renderer/src/components/task/__tests__/TaskCard.test.tsx"
    "src/renderer/src/hooks/useErrorBoundary.ts"
    "src/renderer/src/store/__tests__/errorHandling.test.ts"
    "src/renderer/src/store/__tests__/useTaskStore.test.ts"
)

# Process test files
for file in "${test_files[@]}"; do
    if [ -f "$file" ]; then
        resolve_conflicts "$file"
    fi
done
