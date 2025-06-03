#!/usr/bin/env ts-node
/**
 * Fix Unused Variables Script (TypeScript version with Dry-Run Support)
 * 
 * Uses ts-morph utilities to safely remove unused variables and imports
 * from TypeScript files based on compiler error reports.
 * 
 * Usage:
 *   npx tsx fix-unused-variables-safe.ts           # Apply fixes
 *   npx tsx fix-unused-variables-safe.ts --dry-run # Preview changes only
 *   npx tsx fix-unused-variables-safe.ts -n        # Preview changes only
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { 
  fixUnusedVariablesInProject, 
  groupErrorsByFile,
  type UnusedVariableError,
  type FixResult
} from "./ts-morph-utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TrackingReport {
  detailedErrors: {
    TS6133?: UnusedVariableError[];
    [key: string]: UnusedVariableError[] | undefined;
  };
}

function showUsage() {
  console.log(`
Usage: npx tsx fix-unused-variables-safe.ts [OPTIONS]

Options:
  --dry-run, -n    Preview changes without modifying files
  --help, -h       Show this help message

Examples:
  npx tsx fix-unused-variables-safe.ts           # Apply fixes
  npx tsx fix-unused-variables-safe.ts --dry-run # Preview only
`);
}

// ────────────────────────────────────────────────────────────
// Parse command line arguments
// ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  showUsage();
  process.exit(0);
}

// ────────────────────────────────────────────────────────────
// 1. Load tracking report
// ────────────────────────────────────────────────────────────
const trackingReport: TrackingReport = JSON.parse(
  readFileSync(join(__dirname, "typescript-errors-tracking.json"), "utf8")
);

const unusedVariableErrors = trackingReport.detailedErrors.TS6133 ?? [];
console.log(`Found ${unusedVariableErrors.length} TS6133 (unused variable) errors`);

if (dryRun) {
  console.log('🔍 Running in DRY RUN mode - no files will be modified\n');
} else {
  console.log('🔧 Running in APPLY mode - files will be modified\n');
}

// ────────────────────────────────────────────────────────────
// 2. Group errors by file using utility function
// ────────────────────────────────────────────────────────────
const errorsByFile = groupErrorsByFile(unusedVariableErrors);

// ────────────────────────────────────────────────────────────
// 3. Use shared utility to fix all unused variables
// ────────────────────────────────────────────────────────────
const fixResult: FixResult = fixUnusedVariablesInProject(errorsByFile, {
  projectRoot: process.cwd(),
  enableLogging: true,
  skipTsConfig: true,
  dryRun
});

const { filesProcessed, issuesFixed, remainingIssues, processedFiles, errors, previewChanges } = fixResult;

// ────────────────────────────────────────────────────────────
// 4. Write report and display results
// ────────────────────────────────────────────────────────────
const fixReport = {
  timestamp: new Date().toISOString(),
  filesProcessed,
  issuesFixed,
  remainingIssues,
  processedFiles,
  errors,
  dryRun,
  previewChanges
};

const reportFileName = dryRun ? "fix-unused-variables-dry-run-report.json" : "fix-unused-variables-report.json";
writeFileSync(
  join(__dirname, reportFileName),
  JSON.stringify(fixReport, null, 2)
);

console.log(`\n📊 Summary ${dryRun ? '(DRY RUN)' : ''}:`);
console.log(`   Files processed: ${filesProcessed}`);
console.log(`   Issues ${dryRun ? 'would be fixed' : 'fixed'}:    ${issuesFixed}`);
console.log(`   Remaining:       ${remainingIssues}`);

if (dryRun && previewChanges && previewChanges.length > 0) {
  console.log('\n🔍 Preview of changes:');
  previewChanges.forEach(({ file, changes }) => {
    console.log(`\n📁 ${file}:`);
    changes.slice(0, 5).forEach(change => console.log(`   ${change}`));
    if (changes.length > 5) {
      console.log(`   ... and ${changes.length - 5} more changes`);
    }
  });
}

if (errors.length > 0) {
  console.log(`\n❌ Errors: ${errors.length}`);
  errors.forEach(error => console.log(`     - ${error}`));
}

console.log(`\n✅ ${dryRun ? 'Dry run' : 'Fix'} report saved to ${reportFileName}`);

if (dryRun) {
  console.log('\n🚀 To apply these changes, run the script without --dry-run:');
  console.log('   npx tsx fix-unused-variables-safe.ts');
} else {
  console.log('\n⚠️  Note: Some unused variables may need manual review (side‑effects, destructuring, interface‑required).');
}

console.log('   Run "npm run typecheck" to verify.');

// Exit with appropriate code
process.exit(errors.length > 0 ? 1 : 0);