#!/usr/bin/env ts-node
/**
 * Fix Unused Variables Script (TypeScript version)
 * 
 * Uses ts-morph utilities to safely remove unused variables and imports
 * from TypeScript files based on compiler error reports.
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { 
  fixUnusedVariablesInProject, 
  groupErrorsByFile,
  type UnusedVariableError,
  type FixResult
} from "./ts-morph-utils";

interface TrackingReport {
  detailedErrors: {
    TS6133?: UnusedVariableError[];
    [key: string]: UnusedVariableError[] | undefined;
  };
}

// ────────────────────────────────────────────────────────────
// 1. Load tracking report
// ────────────────────────────────────────────────────────────
const trackingReport: TrackingReport = JSON.parse(
  readFileSync(join(__dirname, "typescript-errors-tracking.json"), "utf8")
);

const unusedVariableErrors = trackingReport.detailedErrors.TS6133 ?? [];
console.log(`Found ${unusedVariableErrors.length} TS6133 (unused variable) errors`);

// ────────────────────────────────────────────────────────────
// 2. Group errors by file using utility function
// ────────────────────────────────────────────────────────────
const errorsByFile = groupErrorsByFile(unusedVariableErrors);

// ────────────────────────────────────────────────────────────
// 3. Check for --dry-run flag and fix unused variables
// ────────────────────────────────────────────────────────────
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-n');

if (dryRun) {
  console.log('🔍 Running in DRY RUN mode - no files will be modified\n');
}

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

writeFileSync(
  join(__dirname, "fix-unused-variables-report.json"),
  JSON.stringify(fixReport, null, 2)
);

console.log("\n📊 Summary:");
console.log(`   Files processed: ${filesProcessed}`);
console.log(`   Issues fixed:    ${issuesFixed}`);
console.log(`   Remaining:       ${remainingIssues}`);
if (errors.length > 0) {
  console.log(`   Errors:          ${errors.length}`);
  errors.forEach(error => console.log(`     - ${error}`));
}
console.log("\n✅ Fix report saved to fix-unused-variables-report.json");
console.log(
  "\n⚠️  Note: Some unused variables may need manual review (side‑effects, destructuring, interface‑required)."
);
console.log('   Run "npm run typecheck" to verify.');