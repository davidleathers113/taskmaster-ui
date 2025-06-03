#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the raw TypeScript errors
const rawErrors = fs.readFileSync(path.join(__dirname, 'typescript-errors-raw.txt'), 'utf8');

// Parse errors using regex
const errorRegex = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;
const errors = [];

let match;
while ((match = errorRegex.exec(rawErrors)) !== null) {
  errors.push({
    file: match[1],
    line: parseInt(match[2]),
    column: parseInt(match[3]),
    code: match[4],
    message: match[5]
  });
}

// Categorize errors by code
const errorsByCode = {};
const errorCategories = {
  'TS6133': { name: 'Unused Variables', description: 'Variable is declared but never used' },
  'TS2339': { name: 'Property Does Not Exist', description: 'Property does not exist on type' },
  'TS18047': { name: 'Possibly Null', description: 'Expression is possibly null or undefined' },
  'TS7006': { name: 'Implicit Any', description: 'Parameter implicitly has an any type' },
  'TS2307': { name: 'Cannot Find Module', description: 'Cannot find module or type declarations' },
  'TS2683': { name: 'Cannot Assign to This', description: 'Cannot assign to this because it is not a variable' },
  'TS2554': { name: 'Wrong Argument Count', description: 'Expected X arguments, but got Y' },
  'TS2345': { name: 'Type Mismatch', description: 'Argument type is not assignable' },
  'TS2451': { name: 'Duplicate Identifier', description: 'Cannot redeclare block-scoped variable' },
  'TS7017': { name: 'No Index Signature', description: 'Element implicitly has any type because type has no index signature' },
  'TS2540': { name: 'Readonly Property', description: 'Cannot assign to property because it is read-only' },
  'TS2769': { name: 'No Overload Matches', description: 'No overload matches this call' },
  'TS7034': { name: 'Implicit Any Array', description: 'Variable implicitly has any[] type' },
  'TS7005': { name: 'Implicit Any Array', description: 'Variable implicitly has any[] type' },
  'TS2741': { name: 'Missing Property', description: 'Property is missing in type' },
  'TS7031': { name: 'Implicit Any Binding', description: 'Binding element implicitly has any type' },
  'TS2304': { name: 'Cannot Find Name', description: 'Cannot find name' },
  'TS2349': { name: 'Not Callable', description: 'Expression is not callable' },
  'TS2551': { name: 'Property Typo', description: 'Property does not exist, did you mean...' },
  'TS6192': { name: 'Unused Imports', description: 'All imports in declaration are unused' }
};

// Group errors by code
errors.forEach(error => {
  if (!errorsByCode[error.code]) {
    errorsByCode[error.code] = [];
  }
  errorsByCode[error.code].push(error);
});

// Group errors by file
const errorsByFile = {};
errors.forEach(error => {
  if (!errorsByFile[error.file]) {
    errorsByFile[error.file] = [];
  }
  errorsByFile[error.file].push(error);
});

// Calculate statistics
const stats = {
  totalErrors: errors.length,
  errorsByCode: Object.entries(errorsByCode)
    .map(([code, errors]) => ({
      code,
      name: errorCategories[code]?.name || 'Unknown',
      description: errorCategories[code]?.description || 'Unknown error type',
      count: errors.length,
      percentage: ((errors.length / errors.length) * 100).toFixed(2) + '%'
    }))
    .sort((a, b) => b.count - a.count),
  filesByErrorCount: Object.entries(errorsByFile)
    .map(([file, errors]) => ({
      file: file.replace('src/', ''),
      errorCount: errors.length,
      errorCodes: [...new Set(errors.map(e => e.code))].sort()
    }))
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 20) // Top 20 files with most errors
};

// Create tracking report
const trackingReport = {
  timestamp: new Date().toISOString(),
  summary: {
    totalErrors: stats.totalErrors,
    uniqueErrorCodes: Object.keys(errorsByCode).length,
    affectedFiles: Object.keys(errorsByFile).length,
    topCategories: [
      'TS6133 (Unused Variables)',
      'TS2339 (Property Does Not Exist)', 
      'TS18047 (Possibly Null)',
      'TS7006 (Implicit Any)',
      'TS2307 (Cannot Find Module)',
      'TS2683 (Cannot Assign to This)'
    ]
  },
  errorCategories: stats.errorsByCode,
  topFilesWithErrors: stats.filesByErrorCount,
  detailedErrors: errorsByCode,
  fixingStrategy: {
    phase1: {
      name: 'Quick Wins - Automated Fixes',
      targets: ['TS6133', 'TS6192', 'TS18047'],
      approach: 'Use ESLint auto-fix and TypeScript compiler options'
    },
    phase2: {
      name: 'Type Definitions',
      targets: ['TS2339', 'TS7006', 'TS7017', 'TS7031'],
      approach: 'Add missing type definitions and interfaces'
    },
    phase3: {
      name: 'Module Resolution',
      targets: ['TS2307', 'TS2304'],
      approach: 'Fix import paths and add missing modules'
    },
    phase4: {
      name: 'Complex Refactoring',
      targets: ['TS2345', 'TS2451', 'TS2540', 'TS2554', 'TS2769'],
      approach: 'Refactor code structure and fix API usage'
    }
  }
};

// Write tracking report
fs.writeFileSync(
  path.join(__dirname, 'typescript-errors-tracking.json'),
  JSON.stringify(trackingReport, null, 2)
);

// Generate markdown summary
const markdownSummary = `# TypeScript Error Tracking Report

Generated: ${new Date().toISOString()}

## Summary
- **Total Errors**: ${stats.totalErrors}
- **Unique Error Codes**: ${Object.keys(errorsByCode).length}
- **Affected Files**: ${Object.keys(errorsByFile).length}

## Error Categories
${stats.errorsByCode.map(cat => 
  `### ${cat.code}: ${cat.name} (${cat.count} errors)
- **Description**: ${cat.description}
- **Count**: ${cat.count}
- **Example files**: ${errorsByCode[cat.code].slice(0, 3).map(e => e.file.replace('src/', '')).join(', ')}`
).join('\n\n')}

## Top Files with Errors
${stats.filesByErrorCount.slice(0, 10).map((file, index) => 
  `${index + 1}. **${file.file}** - ${file.errorCount} errors
   - Error codes: ${file.errorCodes.join(', ')}`
).join('\n')}

## Fixing Strategy
1. **Phase 1 - Quick Wins**: Fix TS6133 (unused vars), TS6192 (unused imports), TS18047 (null checks)
2. **Phase 2 - Type Definitions**: Add missing types for TS2339, TS7006, TS7017, TS7031
3. **Phase 3 - Module Resolution**: Fix imports for TS2307, TS2304
4. **Phase 4 - Complex Refactoring**: Handle TS2345, TS2451, TS2540, TS2554, TS2769
`;

fs.writeFileSync(
  path.join(__dirname, 'typescript-errors-summary.md'),
  markdownSummary
);

console.log('TypeScript error tracking report generated successfully!');
console.log(`Total errors: ${stats.totalErrors}`);
console.log(`Files affected: ${Object.keys(errorsByFile).length}`);
console.log('\nTop error categories:');
stats.errorsByCode.slice(0, 5).forEach(cat => {
  console.log(`  ${cat.code} (${cat.name}): ${cat.count} errors`);
});