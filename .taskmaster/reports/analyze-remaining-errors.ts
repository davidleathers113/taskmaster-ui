#!/usr/bin/env ts-node
/**
 * Analyze Remaining TypeScript Errors Script (TypeScript version)
 * 
 * Runs TypeScript compiler to analyze current errors and provides
 * categorized fixing strategies.
 */

import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";

interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

interface ErrorCategory {
  name: string;
  strategy: string;
}

interface ErrorSummary {
  code: string;
  name: string;
  strategy: string;
  count: number;
  files: string[];
  examples: Array<{
    file: string;
    line: number;
    message: string;
  }>;
}

interface FixStrategy {
  errorCount: number;
  errorCodes: string[];
}

interface AnalysisReport {
  timestamp: string;
  totalErrors: number;
  errorsByCode: ErrorSummary[];
  fixStrategies: Record<string, FixStrategy>;
}

// ────────────────────────────────────────────────────────────
// 1. Run TypeScript compiler and capture errors
// ────────────────────────────────────────────────────────────
console.log('Running TypeScript compiler to analyze remaining errors...\n');
const errors = execSync('npm run typecheck 2>&1 || true', { encoding: 'utf8' });

// ────────────────────────────────────────────────────────────
// 2. Parse errors using regex (acceptable for parsing error output)
// ────────────────────────────────────────────────────────────
const errorRegex = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;
const parsedErrors: TypeScriptError[] = [];
let match: RegExpExecArray | null;

while ((match = errorRegex.exec(errors)) !== null) {
  parsedErrors.push({
    file: match[1],
    line: parseInt(match[2]),
    column: parseInt(match[3]),
    code: match[4],
    message: match[5]
  });
}

// ────────────────────────────────────────────────────────────
// 3. Define error categories and strategies
// ────────────────────────────────────────────────────────────
const errorCategories: Record<string, ErrorCategory> = {
  'TS6133': { name: 'Unused Variables', strategy: 'Remove or use the variable' },
  'TS2339': { name: 'Property Does Not Exist', strategy: 'Add type definitions or fix mock types' },
  'TS18047': { name: 'Possibly Null', strategy: 'Add null checks' },
  'TS18048': { name: 'Possibly Undefined', strategy: 'Add undefined checks' },
  'TS7006': { name: 'Implicit Any', strategy: 'Add explicit type annotations' },
  'TS2307': { name: 'Cannot Find Module', strategy: 'Fix import paths or add type declarations' },
  'TS2532': { name: 'Object Possibly Undefined', strategy: 'Add undefined checks (from noUncheckedIndexedAccess)' },
  'TS2322': { name: 'Type Not Assignable', strategy: 'Fix type mismatch' },
  'TS2554': { name: 'Wrong Argument Count', strategy: 'Fix function calls' },
  'TS2345': { name: 'Argument Type Mismatch', strategy: 'Fix argument types' },
  'TS2540': { name: 'Cannot Assign to Readonly', strategy: 'Avoid assigning to readonly properties' },
  'TS2551': { name: 'Property Typo', strategy: 'Fix property name' },
  'TS7017': { name: 'No Index Signature', strategy: 'Add index signature or use proper type' },
  'TS2349': { name: 'Not Callable', strategy: 'Fix function type' },
  'TS2769': { name: 'No Overload Matches', strategy: 'Fix function arguments' },
  'TS2683': { name: 'Cannot Assign to This', strategy: 'Refactor to avoid this assignment' },
  'TS7030': { name: 'Not All Paths Return', strategy: 'Add return statements' },
  'TS1005': { name: 'Syntax Error', strategy: 'Fix syntax' },
  'TS1128': { name: 'Declaration Expected', strategy: 'Fix syntax' },
  'TS2304': { name: 'Cannot Find Name', strategy: 'Import or declare the name' }
};

// ────────────────────────────────────────────────────────────
// 4. Group and analyze errors
// ────────────────────────────────────────────────────────────
const errorsByCode: Record<string, TypeScriptError[]> = {};
parsedErrors.forEach(error => {
  if (!errorsByCode[error.code]) {
    errorsByCode[error.code] = [];
  }
  errorsByCode[error.code].push(error);
});

// ────────────────────────────────────────────────────────────
// 5. Generate analysis report
// ────────────────────────────────────────────────────────────
const report: AnalysisReport = {
  timestamp: new Date().toISOString(),
  totalErrors: parsedErrors.length,
  errorsByCode: Object.entries(errorsByCode)
    .map(([code, errors]): ErrorSummary => ({
      code,
      name: errorCategories[code]?.name || 'Unknown',
      strategy: errorCategories[code]?.strategy || 'Manual review needed',
      count: errors.length,
      files: [...new Set(errors.map(e => e.file))].sort(),
      examples: errors.slice(0, 3).map(e => ({
        file: e.file.replace('src/', ''),
        line: e.line,
        message: e.message
      }))
    }))
    .sort((a, b) => b.count - a.count),
  fixStrategies: {}
};

// ────────────────────────────────────────────────────────────
// 6. Group by fix strategy
// ────────────────────────────────────────────────────────────
const fixStrategies: Record<string, string[]> = {
  'Mock Type Fixes': ['TS2339'],
  'Null/Undefined Checks': ['TS18047', 'TS18048', 'TS2532'],
  'Type Annotations': ['TS7006', 'TS2322', 'TS2345'],
  'Syntax Fixes': ['TS1005', 'TS1128'],
  'Import/Module Fixes': ['TS2307', 'TS2304'],
  'Other Fixes': ['TS2554', 'TS2540', 'TS2551', 'TS7017', 'TS2349', 'TS2769', 'TS2683', 'TS7030', 'TS6133']
};

const strategySummary: Record<string, FixStrategy> = {};
Object.entries(fixStrategies).forEach(([strategy, codes]) => {
  const errorCount = codes.reduce((sum, code) => sum + (errorsByCode[code]?.length || 0), 0);
  if (errorCount > 0) {
    strategySummary[strategy] = {
      errorCount,
      errorCodes: codes.filter(code => errorsByCode[code])
    };
  }
});

report.fixStrategies = strategySummary;

// ────────────────────────────────────────────────────────────
// 7. Write reports
// ────────────────────────────────────────────────────────────
writeFileSync(
  join(__dirname, "remaining-errors-analysis.json"),
  JSON.stringify(report, null, 2)
);

// Generate markdown summary
const markdown = `# Remaining TypeScript Errors Analysis

Generated: ${new Date().toISOString()}

## Summary
- **Total Errors**: ${report.totalErrors}
- **Error Types**: ${Object.keys(errorsByCode).length}

## Fix Strategies

${Object.entries(strategySummary)
  .sort((a, b) => b[1].errorCount - a[1].errorCount)
  .map(([strategy, data]) => `### ${strategy} (${data.errorCount} errors)
Error codes: ${data.errorCodes.join(', ')}`)
  .join('\n\n')}

## Error Details by Type

${report.errorsByCode.slice(0, 10).map(cat => `### ${cat.code}: ${cat.name} (${cat.count} errors)
**Strategy**: ${cat.strategy}
**Files affected**: ${cat.files.length}
**Examples**:
${cat.examples.map(ex => `- ${ex.file}:${ex.line} - ${ex.message}`).join('\n')}`).join('\n\n')}

## Recommended Fix Order
1. **Mock Type Fixes** - Update test mocks with proper typing
2. **Null/Undefined Checks** - Add guards for nullable values
3. **Type Annotations** - Add explicit types where needed
4. **Syntax Fixes** - Fix any syntax errors
5. **Import/Module Fixes** - Resolve module issues
`;

writeFileSync(
  join(__dirname, "remaining-errors-analysis.md"),
  markdown
);

// ────────────────────────────────────────────────────────────
// 8. Console output
// ────────────────────────────────────────────────────────────
console.log('Analysis complete!\n');
console.log('Summary:');
console.log(`Total errors: ${report.totalErrors}`);
console.log('\nFix strategies:');
Object.entries(strategySummary)
  .sort((a, b) => b[1].errorCount - a[1].errorCount)
  .forEach(([strategy, data]) => {
    console.log(`  ${strategy}: ${data.errorCount} errors`);
  });
console.log('\nReports saved to:');
console.log('  - remaining-errors-analysis.json');
console.log('  - remaining-errors-analysis.md');