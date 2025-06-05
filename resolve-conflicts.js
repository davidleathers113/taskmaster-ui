const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Pattern to resolve test file conflicts - keep the version without "const vi" declaration
function resolveTestFileConflicts(content) {
  // Remove the vi declaration conflict - prefer the version without it
  content = content.replace(
    /<<<<<<< HEAD\n\s*const vi: typeof import\('vitest'\)\.vi\n=======\n>>>>>>>[^\n]+/g,
    ''
  );
  
  // For other conflicts in test files, prefer the incoming branch changes
  content = content.replace(
    /<<<<<<< HEAD\n([^=]*)=======\n([^>]*)>>>>>>>[^\n]+/g,
    (match, ours, theirs) => theirs
  );
  
  return content;
}

// Files to process
const testFiles = [
  'src/main/__tests__/*.test.ts',
  'src/preload/__tests__/*.test.ts', 
  'src/renderer/src/components/error/__tests__/*.test.tsx',
  'src/renderer/src/components/task/__tests__/*.test.tsx',
  'src/renderer/src/store/__tests__/*.test.ts',
  'tests/setup/preload.setup.ts'
];

// Process each test file
testFiles.forEach(pattern => {
  const files = glob.sync(pattern, { cwd: __dirname });
  
  files.forEach(file => {
    const filePath = path.join(__dirname, file);
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('<<<<<<<')) {
        content = resolveTestFileConflicts(content);
        fs.writeFileSync(filePath, content);
        console.log(`Resolved conflicts in: ${file}`);
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message);
    }
  });
});

// Handle specific files
const specificFiles = {
  'startup.sh': (content) => {
    // For startup.sh, prefer the incoming changes
    return content.replace(/<<<<<<< HEAD\n([^=]*)=======\n([^>]*)>>>>>>>[^\n]+/g, (m, o, t) => t);
  },
  'test-results/results.json': (content) => {
    // For JSON, prefer the incoming valid JSON
    return content.replace(/<<<<<<< HEAD\n([^=]*)=======\n([^>]*)>>>>>>>[^\n]+/g, (m, o, t) => t);
  },
  'src/renderer/src/hooks/useErrorBoundary.ts': (content) => {
    // For useErrorBoundary, prefer incoming changes
    return content.replace(/<<<<<<< HEAD\n([^=]*)=======\n([^>]*)>>>>>>>[^\n]+/g, (m, o, t) => t);
  },
  'wt_tasks/progress.md': (content) => {
    // For progress.md, prefer incoming changes
    return content.replace(/<<<<<<< HEAD\n([^=]*)=======\n([^>]*)>>>>>>>[^\n]+/g, (m, o, t) => t);
  }
};

// Process specific files
Object.entries(specificFiles).forEach(([file, resolver]) => {
  const filePath = path.join(__dirname, file);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('<<<<<<<')) {
      content = resolver(content);
      fs.writeFileSync(filePath, content);
      console.log(`Resolved conflicts in: ${file}`);
    }
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
});
