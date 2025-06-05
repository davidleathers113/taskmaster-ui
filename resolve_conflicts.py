#!/usr/bin/env python3
import re
import sys
import os

def resolve_conflicts(file_path):
    """Resolve merge conflicts in test files."""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Pattern to match the vi declaration conflict
    vi_conflict_pattern = r'<<<<<<< HEAD\n\s*const vi: typeof import\(\'vitest\'\)\.vi\n=======\n>>>>>>> test/test-failure-analysis'
    
    # Remove the vi declaration conflict (keep the version without it)
    content = re.sub(vi_conflict_pattern, '', content)
    
    # For remaining conflicts, generally prefer the incoming branch (test/test-failure-analysis)
    # This pattern captures conflicts and keeps the content after =======
    general_conflict_pattern = r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> test/test-failure-analysis'
    
    def keep_theirs(match):
        return match.group(2)
    
    content = re.sub(general_conflict_pattern, keep_theirs, content, flags=re.DOTALL)
    
    # Write back the resolved content
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"Resolved conflicts in: {file_path}")

# List of files with conflicts
conflict_files = [
    "src/main/__tests__/auto-updater-differential.test.ts",
    "src/main/__tests__/auto-updater-integration.test.ts",
    "src/main/__tests__/auto-updater-security.test.ts",
    "src/main/__tests__/auto-updater.test.ts",
    "src/main/__tests__/baseline.test.ts",
    "src/main/__tests__/cross-process-communication.test.ts",
    "src/main/__tests__/ipc-security.test.ts",
    "src/main/__tests__/lifecycle.test.ts",
    "src/main/__tests__/memory-leak-detection.test.ts",
    "src/main/__tests__/memory-leaks.test.ts",
    "src/main/__tests__/mocked-apis.test.ts",
    "src/main/__tests__/mocked-electron-apis.test.ts",
    "src/preload/__tests__/preload-security.test.ts",
    "src/renderer/src/components/error/__tests__/ErrorBoundary.test.tsx",
    "src/renderer/src/components/task/__tests__/TaskCard.test.tsx",
]

# Process each file
for file_path in conflict_files:
    if os.path.exists(file_path):
        try:
            resolve_conflicts(file_path)
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
