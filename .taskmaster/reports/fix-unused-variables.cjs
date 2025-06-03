#!/usr/bin/env node
const { Project, SyntaxKind } = require("ts-morph");
const fs = require("fs");
const path = require("path");

// ────────────────────────────────────────────────────────────
// 1.  Load tracking report as before
// ────────────────────────────────────────────────────────────
const trackingReport = JSON.parse(
  fs.readFileSync(path.join(__dirname, "typescript-errors-tracking.json"), "utf8"),
);

const unusedVariableErrors = trackingReport.detailedErrors["TS6133"] ?? [];
console.log(`Found ${unusedVariableErrors.length} TS6133 (unused variable) errors`);

// ────────────────────────────────────────────────────────────
// 2.  Group errors by file (unchanged)
// ────────────────────────────────────────────────────────────
const errorsByFile = {};
for (const err of unusedVariableErrors) {
  (errorsByFile[err.file] ??= []).push(err);
}

// ────────────────────────────────────────────────────────────
// 3.  Set up a ts‑morph Project and add *only* the files we
//     actually need to touch (faster than loading tsconfig)
// ────────────────────────────────────────────────────────────
const project = new Project({
  // makes sure parsing respects the repo's tsconfig
  tsConfigFilePath: path.join(process.cwd(), "tsconfig.json"),
  skipAddingFilesFromTsConfig: true,
});

Object.keys(errorsByFile).forEach((relativePath) => {
  const absPath = path.join(process.cwd(), relativePath);
  if (fs.existsSync(absPath)) project.addSourceFileAtPath(absPath);
});

// ────────────────────────────────────────────────────────────
// 4.  Walk each file, remove unused imports & variables
// ────────────────────────────────────────────────────────────
let totalFixed = 0;

for (const [filePath, errors] of Object.entries(errorsByFile)) {
  const sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) {
    console.warn(`File not found in project: ${filePath}`);
    continue;
  }

  let fileFixed = 0;

  for (const err of errors) {
    // Extract the identifier from the compiler's message
    const m = err.message.match(/'([^']+)'/);
    if (!m) continue;
    const unused = m[1];

    // ── 4‑A.  Imports ──────────────────────────────────────
    sourceFile.getImportDeclarations().forEach((imp) => {
      // default import
      if (imp.getDefaultImport()?.getText() === unused) {
        if (
          imp.getNamedImports().length === 0 &&
          !imp.getNamespaceImport()
        ) {
          imp.remove(); // whole line
        } else {
          imp.removeDefaultImport(); // keep the rest
        }
        fileFixed++;
        return;
      }

      // namespace import  (import * as X from "…")
      if (imp.getNamespaceImport()?.getText() === unused) {
        if (
          imp.getDefaultImport() == null &&
          imp.getNamedImports().length === 0
        ) {
          imp.remove();
        } else {
          imp.removeNamespaceImport();
        }
        fileFixed++;
        return;
      }

      // named import  (import { foo, bar } from "…")
      const spec = imp
        .getNamedImports()
        .find((n) => n.getNameNode().getText() === unused);
      if (spec) {
        spec.remove();
        if (
          imp.getNamedImports().length === 0 &&
          !imp.getDefaultImport() &&
          !imp.getNamespaceImport()
        ) {
          imp.remove(); // nothing left → drop the entire statement
        }
        fileFixed++;
      }
    });

    // ── 4‑B.  Local variable declarations ──────────────────
    sourceFile.getVariableDeclarations().forEach((decl) => {
      if (decl.getName() !== unused) return;

      const stmt = decl.getVariableStatement();
      decl.remove(); // precise removal of just this identifier
      if (stmt && stmt.getDeclarations().length === 0) {
        stmt.remove(); // if nothing left, drop the statement
      }
      fileFixed++;
    });
  }

  if (fileFixed) {
    sourceFile.saveSync(); // write immediately (cheap, keeps counters accurate)
    console.log(`✅ Fixed ${fileFixed} issues in ${filePath}`);
    totalFixed += fileFixed;
  }
}

// ────────────────────────────────────────────────────────────
// 5.  Persist all changes (safety net) & write report
// ────────────────────────────────────────────────────────────
project.saveSync(); // flush any remaining unsaved files

const fixReport = {
  timestamp: new Date().toISOString(),
  filesProcessed: Object.keys(errorsByFile).length,
  issuesFixed: totalFixed,
  remainingIssues: unusedVariableErrors.length - totalFixed,
  processedFiles: Object.keys(errorsByFile),
};

fs.writeFileSync(
  path.join(__dirname, "fix-unused-variables-report.json"),
  JSON.stringify(fixReport, null, 2),
);

console.log("\n📊 Summary:");
console.log(`   Files processed: ${Object.keys(errorsByFile).length}`);
console.log(`   Issues fixed:    ${totalFixed}`);
console.log(`   Remaining:       ${unusedVariableErrors.length - totalFixed}`);
console.log("\n✅ Fix report saved to fix-unused-variables-report.json");
console.log(
  "\n⚠️  Note: Some unused variables may need manual review (side‑effects, destructuring, interface‑required).",
);
console.log('   Run "npm run typecheck" to verify.');