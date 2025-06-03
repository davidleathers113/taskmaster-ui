#!/usr/bin/env ts-node
/**
 * Fix Null/Undefined Errors Script
 * 
 * Uses ts-morph to safely add null checks and optional chaining
 * for TS2532, TS18047, TS18048 errors using AST manipulation.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { 
  createProject, 
  addSourceFilesToProject,
  groupErrorsByFile,
  type UnusedVariableError,
  type TsMorphConfig 
} from "./ts-morph-utils";
import { Project, SourceFile, Node, SyntaxKind, PropertyAccessExpression, ElementAccessExpression } from "ts-morph";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface NullUndefinedError extends UnusedVariableError {
  type: 'possibly-null' | 'possibly-undefined' | 'object-undefined';
}

interface FixResult {
  filesProcessed: number;
  issuesFixed: number;
  remainingIssues: number;
  processedFiles: string[];
  errors: string[];
  fixTypes: Record<string, number>;
}

/**
 * Determines the type of null/undefined error from the message
 */
function categorizeNullError(error: UnusedVariableError): NullUndefinedError {
  const message = error.message.toLowerCase();
  
  if (message.includes('possibly null')) {
    return { ...error, type: 'possibly-null' };
  } else if (message.includes('possibly undefined') && message.includes('object is')) {
    return { ...error, type: 'object-undefined' };
  } else if (message.includes('possibly undefined')) {
    return { ...error, type: 'possibly-undefined' };
  }
  
  // Default based on error code
  if (error.code === 'TS2532') {
    return { ...error, type: 'object-undefined' };
  } else if (error.code === 'TS18047') {
    return { ...error, type: 'possibly-null' };
  } else if (error.code === 'TS18048') {
    return { ...error, type: 'possibly-undefined' };
  }
  
  return { ...error, type: 'possibly-undefined' };
}

/**
 * Adds optional chaining to property access expressions
 */
function addOptionalChaining(sourceFile: SourceFile, line: number, column: number): boolean {
  const position = sourceFile.getPositionAtLineAndColumn(line, column);
  const node = sourceFile.getDescendantAtPos(position);
  
  if (!node) return false;
  
  // Find the property access or element access expression
  let targetNode = node;
  while (targetNode && !Node.isPropertyAccessExpression(targetNode) && !Node.isElementAccessExpression(targetNode)) {
    targetNode = targetNode.getParent();
  }
  
  if (!targetNode) return false;
  
  try {
    if (Node.isPropertyAccessExpression(targetNode)) {
      const expression = targetNode.getExpression();
      const name = targetNode.getName();
      
      // Replace with optional chaining
      targetNode.replaceWithText(`${expression.getText()}?.${name}`);
      return true;
    } else if (Node.isElementAccessExpression(targetNode)) {
      const expression = targetNode.getExpression();
      const argumentExpression = targetNode.getArgumentExpression();
      
      // Replace with optional chaining
      targetNode.replaceWithText(`${expression.getText()}?.[${argumentExpression?.getText() || ''}]`);
      return true;
    }
  } catch (error) {
    console.warn(`Failed to add optional chaining: ${error}`);
    return false;
  }
  
  return false;
}

/**
 * Adds null check using logical AND operator
 */
function addNullCheck(sourceFile: SourceFile, line: number, column: number): boolean {
  const position = sourceFile.getPositionAtLineAndColumn(line, column);
  const node = sourceFile.getDescendantAtPos(position);
  
  if (!node) return false;
  
  // Find the expression that needs null checking
  let targetExpression = node;
  while (targetExpression && !Node.isExpression(targetExpression)) {
    targetExpression = targetExpression.getParent();
  }
  
  if (!targetExpression || !Node.isExpression(targetExpression)) return false;
  
  try {
    const expressionText = targetExpression.getText();
    
    // Skip if already has null check
    if (expressionText.includes('?.') || expressionText.includes('&&')) {
      return false;
    }
    
    // Determine the variable being accessed
    let variableName = '';
    if (Node.isPropertyAccessExpression(targetExpression)) {
      variableName = targetExpression.getExpression().getText();
    } else if (Node.isElementAccessExpression(targetExpression)) {
      variableName = targetExpression.getExpression().getText();
    } else if (Node.isIdentifier(targetExpression)) {
      variableName = targetExpression.getText();
    }
    
    if (!variableName) return false;
    
    // Add null check: variable && variable.property
    const nullCheckedExpression = `${variableName} && ${expressionText}`;
    targetExpression.replaceWithText(nullCheckedExpression);
    return true;
  } catch (error) {
    console.warn(`Failed to add null check: ${error}`);
    return false;
  }
}

/**
 * Adds undefined check using nullish coalescing
 */
function addUndefinedCheck(sourceFile: SourceFile, line: number, column: number): boolean {
  const position = sourceFile.getPositionAtLineAndColumn(line, column);
  const node = sourceFile.getDescendantAtPos(position);
  
  if (!node) return false;
  
  // Find the expression that needs undefined checking
  let targetExpression = node;
  while (targetExpression && !Node.isExpression(targetExpression)) {
    targetExpression = targetExpression.getParent();
  }
  
  if (!targetExpression || !Node.isExpression(targetExpression)) return false;
  
  try {
    const expressionText = targetExpression.getText();
    
    // Skip if already has nullish coalescing
    if (expressionText.includes('??') || expressionText.includes('?.')) {
      return false;
    }
    
    // Determine appropriate fallback based on context
    let fallback = 'undefined';
    const parent = targetExpression.getParent();
    
    if (Node.isArrayAccessExpression(parent) || Node.isElementAccessExpression(parent)) {
      fallback = '[]';
    } else if (Node.isPropertyAccessExpression(parent)) {
      fallback = '{}';
    } else if (Node.isCallExpression(parent)) {
      fallback = '(() => {})';
    }
    
    // Add nullish coalescing: expression ?? fallback
    const undefinedCheckedExpression = `(${expressionText} ?? ${fallback})`;
    targetExpression.replaceWithText(undefinedCheckedExpression);
    return true;
  } catch (error) {
    console.warn(`Failed to add undefined check: ${error}`);
    return false;
  }
}

/**
 * Fixes null/undefined errors in a single source file
 */
function fixNullUndefinedErrorsInFile(
  sourceFile: SourceFile, 
  errors: NullUndefinedError[]
): number {
  let fixCount = 0;
  const fixTypes: Record<string, number> = {};
  
  // Sort errors by line number (process from bottom to top to avoid position shifts)
  const sortedErrors = errors.sort((a, b) => b.line - a.line);
  
  for (const error of sortedErrors) {
    let fixed = false;
    
    try {
      switch (error.type) {
        case 'possibly-null':
          // Try optional chaining first, fallback to null check
          fixed = addOptionalChaining(sourceFile, error.line, error.column) ||
                  addNullCheck(sourceFile, error.line, error.column);
          break;
          
        case 'possibly-undefined':
          // Try optional chaining first, fallback to undefined check
          fixed = addOptionalChaining(sourceFile, error.line, error.column) ||
                  addUndefinedCheck(sourceFile, error.line, error.column);
          break;
          
        case 'object-undefined':
          // For TS2532 (noUncheckedIndexedAccess), prefer optional chaining
          fixed = addOptionalChaining(sourceFile, error.line, error.column);
          break;
      }
      
      if (fixed) {
        fixCount++;
        fixTypes[error.type] = (fixTypes[error.type] || 0) + 1;
      }
    } catch (error) {
      console.warn(`Failed to fix error at line ${error.line}: ${error}`);
    }
  }
  
  return fixCount;
}

/**
 * Processes multiple files to fix null/undefined errors
 */
function fixNullUndefinedErrorsInProject(
  errorsByFile: Record<string, NullUndefinedError[]>,
  config: TsMorphConfig = {}
): FixResult {
  const { enableLogging = false, projectRoot = process.cwd() } = config;
  
  const project = createProject(config);
  const filePaths = Object.keys(errorsByFile);
  const sourceFiles = addSourceFilesToProject(project, filePaths, projectRoot);
  
  let totalFixed = 0;
  const processedFiles: string[] = [];
  const errors: string[] = [];
  const fixTypes: Record<string, number> = {};

  sourceFiles.forEach((sourceFile) => {
    const filePath = sourceFile.getFilePath().replace(projectRoot + "/", "");
    const fileErrors = errorsByFile[filePath] || [];
    
    if (fileErrors.length === 0) return;

    try {
      // Categorize errors by type
      const categorizedErrors = fileErrors.map(categorizeNullError);
      const fixedCount = fixNullUndefinedErrorsInFile(sourceFile, categorizedErrors);
      
      if (fixedCount > 0) {
        sourceFile.saveSync();
        totalFixed += fixedCount;
        processedFiles.push(filePath);
        
        // Track fix types
        categorizedErrors.forEach(error => {
          fixTypes[error.type] = (fixTypes[error.type] || 0) + 1;
        });
        
        if (enableLogging) {
          console.log(`✅ Fixed ${fixedCount} null/undefined issues in ${filePath}`);
        }
      }
    } catch (error) {
      const errorMsg = `Error processing ${filePath}: ${error}`;
      errors.push(errorMsg);
      
      if (enableLogging) {
        console.error(`❌ ${errorMsg}`);
      }
    }
  });

  // Save all changes
  project.saveSync();

  const totalErrors = Object.values(errorsByFile).flat().length;
  
  return {
    filesProcessed: processedFiles.length,
    issuesFixed: totalFixed,
    remainingIssues: totalErrors - totalFixed,
    processedFiles,
    errors,
    fixTypes
  };
}

// ────────────────────────────────────────────────────────────
// Main execution
// ────────────────────────────────────────────────────────────
async function main() {
  console.log('Loading TypeScript error tracking data...\n');
  
  const trackingReport = JSON.parse(
    readFileSync(join(__dirname, "typescript-errors-tracking.json"), "utf8")
  );

  // Get null/undefined related errors
  const nullUndefinedErrors = [
    ...(trackingReport.detailedErrors.TS2532 || []),
    ...(trackingReport.detailedErrors.TS18047 || []),
    ...(trackingReport.detailedErrors.TS18048 || [])
  ];

  console.log(`Found ${nullUndefinedErrors.length} null/undefined errors:`);
  console.log(`  TS2532 (Object Possibly Undefined): ${trackingReport.detailedErrors.TS2532?.length || 0}`);
  console.log(`  TS18047 (Possibly Null): ${trackingReport.detailedErrors.TS18047?.length || 0}`);
  console.log(`  TS18048 (Possibly Undefined): ${trackingReport.detailedErrors.TS18048?.length || 0}\n`);

  if (nullUndefinedErrors.length === 0) {
    console.log('No null/undefined errors to fix!');
    return;
  }

  // Group errors by file
  const errorsByFile = groupErrorsByFile(nullUndefinedErrors);

  // Fix errors using ts-morph
  const fixResult = fixNullUndefinedErrorsInProject(errorsByFile, {
    projectRoot: process.cwd(),
    enableLogging: true,
    skipTsConfig: true
  });

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    ...fixResult
  };

  writeFileSync(
    join(__dirname, "fix-null-undefined-report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("\n📊 Summary:");
  console.log(`   Files processed: ${fixResult.filesProcessed}`);
  console.log(`   Issues fixed:    ${fixResult.issuesFixed}`);
  console.log(`   Remaining:       ${fixResult.remainingIssues}`);
  console.log('\n🔧 Fix types:');
  Object.entries(fixResult.fixTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} fixes`);
  });
  if (fixResult.errors.length > 0) {
    console.log(`\n❌ Errors: ${fixResult.errors.length}`);
    fixResult.errors.forEach(error => console.log(`     - ${error}`));
  }
  console.log("\n✅ Report saved to fix-null-undefined-report.json");
  console.log('\n⚠️  Note: Manual review recommended for complex expressions.');
  console.log('   Run "npm run typecheck" to verify fixes.');
}

main().catch(console.error);