#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

// Import our shared ts-morph utilities
const { 
  fixUnusedVariablesInProject, 
  groupErrorsByFile 
} = require("./ts-morph-utils.ts");

// ────────────────────────────────────────────────────────────
// 1.  Load tracking report as before
// ────────────────────────────────────────────────────────────
const trackingReport = JSON.parse(
  fs.readFileSync(path.join(__dirname, "typescript-errors-tracking.json"), "utf8"),
);

const unusedVariableErrors = trackingReport.detailedErrors["TS6133"] ?? [];
console.log(`Found ${unusedVariableErrors.length} TS6133 (unused variable) errors`);

// ────────────────────────────────────────────────────────────
// 2.  Group errors by file using utility function
// ────────────────────────────────────────────────────────────
const errorsByFile = groupErrorsByFile(unusedVariableErrors);

// ────────────────────────────────────────────────────────────
// 3.  Use shared utility to fix all unused variables
// ────────────────────────────────────────────────────────────
const fixResult = fixUnusedVariablesInProject(errorsByFile, {
  projectRoot: process.cwd(),
  enableLogging: true,
  skipTsConfig: true
});

const { filesProcessed, issuesFixed, remainingIssues, processedFiles, errors } = fixResult;

// ────────────────────────────────────────────────────────────
// 4.  Write report and display results
// ────────────────────────────────────────────────────────────
const fixReport = {
  timestamp: new Date().toISOString(),
  filesProcessed,
  issuesFixed,
  remainingIssues,
  processedFiles,
  errors
};

fs.writeFileSync(
  path.join(__dirname, "fix-unused-variables-report.json"),
  JSON.stringify(fixReport, null, 2),
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
  "\n⚠️  Note: Some unused variables may need manual review (side‑effects, destructuring, interface‑required).",
);
console.log('   Run "npm run typecheck" to verify.');