#!/usr/bin/env python3
import re
import os

# Additional files to resolve
additional_files = {
    "src/renderer/src/hooks/useErrorBoundary.ts": "test",  # prefer test branch version
    "src/renderer/src/store/__tests__/errorHandling.test.ts": "test",
    "src/renderer/src/store/__tests__/useTaskStore.test.ts": "test",
    "startup.sh": "test",
    "test-results/results.json": "test",
    "tests/setup/preload.setup.ts": "test",
    "wt_tasks/progress.md": "test"
}

def resolve_generic_conflicts(file_path, preference="test"):
    """Resolve conflicts by preferring one side."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        if '<<<<<<< HEAD' not in content:
            print(f"No conflicts found in: {file_path}")
            return
        
        # For test preference, keep content after =======
        if preference == "test":
            pattern = r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> test/test-failure-analysis'
            content = re.sub(pattern, lambda m: m.group(2), content, flags=re.DOTALL)
        
        with open(file_path, 'w') as f:
            f.write(content)
        
        print(f"Resolved conflicts in: {file_path}")
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

# Process additional files
for file_path, preference in additional_files.items():
    if os.path.exists(file_path):
        resolve_generic_conflicts(file_path, preference)
