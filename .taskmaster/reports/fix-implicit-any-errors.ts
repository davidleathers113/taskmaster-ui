#!/usr/bin/env ts-node
/**
 * Fix Implicit Any Errors Script
 * 
 * Uses ts-morph to safely add type annotations for TS7006 errors
 * by analyzing parameter usage and inferring appropriate types.
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
import { Project, SourceFile, Node, SyntaxKind, ParameterDeclaration, FunctionDeclaration, ArrowFunction, MethodDeclaration, ScriptTarget, ModuleResolutionKind } from "ts-morph";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ImplicitAnyError extends UnusedVariableError {
  parameterName?: string;
  inferredType?: string;
  context?: 'function-param' | 'method-param' | 'arrow-function' | 'callback' | 'event-handler';
}

interface FixResult {
  filesProcessed: number;
  issuesFixed: number;
  remainingIssues: number;
  processedFiles: string[];
  errors: string[];
  inferredTypes: Record<string, number>;
  dryRun?: boolean;
  previewChanges?: Array<{
    file: string;
    changes: string[];
  }>;
}

/**
 * Common type mappings based on parameter names and usage patterns
 */
const TYPE_INFERENCE_PATTERNS: Record<string, string> = {
  // Event handlers
  'event': 'Event',
  'e': 'Event',
  'evt': 'Event',
  'mouseEvent': 'MouseEvent',
  'clickEvent': 'MouseEvent',
  'keyEvent': 'KeyboardEvent',
  'keyboardEvent': 'KeyboardEvent',
  
  // Common callback parameters
  'error': 'Error | null',
  'err': 'Error | null',
  'callback': '(...args: any[]) => void',
  'cb': '(...args: any[]) => void',
  'done': '() => void',
  'next': '() => void',
  
  // Request/Response (Express-style)
  'req': 'any', // Could be Request but depends on framework
  'res': 'any', // Could be Response but depends on framework
  'request': 'any',
  'response': 'any',
  
  // Data parameters
  'data': 'any',
  'result': 'any',
  'results': 'any[]',
  'item': 'any',
  'items': 'any[]',
  'value': 'any',
  'values': 'any[]',
  
  // IDs and indices
  'id': 'string | number',
  'index': 'number',
  'idx': 'number',
  'i': 'number',
  'j': 'number',
  'k': 'number',
  
  // Boolean flags
  'flag': 'boolean',
  'enabled': 'boolean',
  'disabled': 'boolean',
  'visible': 'boolean',
  'hidden': 'boolean',
  
  // Strings
  'name': 'string',
  'title': 'string',
  'message': 'string',
  'text': 'string',
  'content': 'string',
  'url': 'string',
  'path': 'string',
  
  // Options and config
  'options': 'any',
  'opts': 'any',
  'config': 'any',
  'settings': 'any',
  'params': 'any'
};

/**
 * Analyzes parameter usage to infer its type
 */
function inferParameterType(parameter: ParameterDeclaration): string {
  const paramName = parameter.getName();
  
  // Check common naming patterns first
  const commonType = TYPE_INFERENCE_PATTERNS[paramName.toLowerCase()];
  if (commonType) {
    return commonType;
  }
  
  // Analyze parameter usage within the function
  const func = parameter.getParent();
  if (!func || (!Node.isFunctionDeclaration(func) && !Node.isArrowFunction(func) && !Node.isMethodDeclaration(func))) {
    return 'any';
  }
  
  const body = func.getBody();
  if (!body) return 'any';
  
  // Look for specific usage patterns
  const usagePatterns = {
    string: [
      new RegExp(`${paramName}\\.length`, 'g'),
      new RegExp(`${paramName}\\.substring`, 'g'),
      new RegExp(`${paramName}\\.indexOf`, 'g'),
      new RegExp(`${paramName}\\.toLowerCase`, 'g'),
      new RegExp(`${paramName}\\.toUpperCase`, 'g'),
    ],
    number: [
      new RegExp(`${paramName} \\+ \\d`, 'g'),
      new RegExp(`${paramName} - \\d`, 'g'),
      new RegExp(`${paramName} \\* \\d`, 'g'),
      new RegExp(`${paramName} / \\d`, 'g'),
      new RegExp(`Math\\.[^(]+\\(${paramName}`, 'g'),
    ],
    array: [
      new RegExp(`${paramName}\\.push`, 'g'),
      new RegExp(`${paramName}\\.pop`, 'g'),
      new RegExp(`${paramName}\\.map`, 'g'),
      new RegExp(`${paramName}\\.filter`, 'g'),
      new RegExp(`${paramName}\\.forEach`, 'g'),
      new RegExp(`${paramName}\\[\\d+\\]`, 'g'),
    ],
    object: [
      new RegExp(`${paramName}\\.[a-zA-Z_$][a-zA-Z0-9_$]*`, 'g'),
      new RegExp(`Object\\.keys\\(${paramName}\\)`, 'g'),
      new RegExp(`Object\\.values\\(${paramName}\\)`, 'g'),
    ],
    function: [
      new RegExp(`${paramName}\\(`, 'g'),
    ],
    boolean: [
      new RegExp(`if\\s*\\(\\s*${paramName}\\s*\\)`, 'g'),
      new RegExp(`!${paramName}`, 'g'),
      new RegExp(`${paramName} \\|\\|`, 'g'),
      new RegExp(`${paramName} &&`, 'g'),
    ]
  };
  
  const bodyText = body.getText();
  
  // Count pattern matches to determine most likely type
  const typeScores: Record<string, number> = {};
  
  Object.entries(usagePatterns).forEach(([type, patterns]) => {
    typeScores[type] = 0;
    patterns.forEach(pattern => {
      const matches = bodyText.match(pattern);
      typeScores[type] += matches ? matches.length : 0;
    });
  });
  
  // Return the type with the highest score
  const bestType = Object.entries(typeScores).reduce((best, [type, score]) => 
    score > best.score ? { type, score } : best, 
    { type: 'any', score: 0 }
  );
  
  switch (bestType.type) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'array': return 'any[]';
    case 'object': return 'any';
    case 'function': return '(...args: any[]) => any';
    default: return 'any';
  }
}

/**
 * Analyzes implicit any error and determines fix strategy
 */
function analyzeImplicitAnyError(error: UnusedVariableError): ImplicitAnyError {
  const message = error.message;
  
  // Extract parameter name from error message
  const paramMatch = message.match(/Parameter '([^']+)'/);
  const parameterName = paramMatch?.[1];
  
  let context: ImplicitAnyError['context'] = 'function-param';
  
  // Determine context based on error message and file content
  if (message.includes('callback') || message.includes('handler')) {
    context = 'callback';
  } else if (message.includes('event')) {
    context = 'event-handler';
  } else if (message.includes('arrow function')) {
    context = 'arrow-function';
  } else if (message.includes('method')) {
    context = 'method-param';
  }
  
  return {
    ...error,
    parameterName,
    context
  };
}

/**
 * Adds type annotation to a parameter
 */
function addTypeAnnotation(sourceFile: SourceFile, error: ImplicitAnyError): boolean {
  const { line, column, parameterName } = error;
  
  if (!parameterName) return false;
  
  try {
    // Use compiler node to get position from line and column
    const position = sourceFile.compilerNode.getPositionOfLineAndCharacter(line - 1, column - 1);
    const node = sourceFile.getDescendantAtPos(position);
    
    if (!node) return false;
    
    // Find the parameter declaration
    let parameter: ParameterDeclaration | undefined;
    
    // Search upwards for a parameter node
    let current = node;
    while (current && !parameter) {
      if (Node.isParameterDeclaration(current) && current.getName() === parameterName) {
        parameter = current;
        break;
      }
      current = current.getParent();
    }
    
    if (!parameter) {
      // Try to find parameter by name in nearby function
      const func = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ||
                   node.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
                   node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
      
      if (func) {
        const params = func.getParameters();
        parameter = params.find(p => p.getName() === parameterName);
      }
    }
    
    if (!parameter) return false;
    
    // Skip if parameter already has a type annotation
    if (parameter.getTypeNode()) return false;
    
    // Infer type for the parameter
    const inferredType = inferParameterType(parameter);
    
    // Add type annotation
    parameter.setType(inferredType);
    
    // Store the inferred type for reporting
    error.inferredType = inferredType;
    
    return true;
  } catch (error) {
    console.warn(`Failed to add type annotation: ${error}`);
    return false;
  }
}

/**
 * Fixes implicit any errors in a single source file
 */
function fixImplicitAnyErrorsInFile(
  sourceFile: SourceFile, 
  errors: ImplicitAnyError[]
): number {
  let fixCount = 0;
  
  // Process errors (order doesn't matter as much since we're just adding types)
  for (const error of errors) {
    try {
      const fixed = addTypeAnnotation(sourceFile, error);
      
      if (fixed) {
        fixCount++;
      }
    } catch (error) {
      console.warn(`Failed to fix implicit any error at line ${error.line}: ${error}`);
    }
  }
  
  return fixCount;
}

/**
 * Generates a simple diff between original and new content
 */
function generateChangeDiff(original: string, modified: string): string[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const changes: string[] = [];
  
  const maxLines = Math.max(originalLines.length, modifiedLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i] || '';
    const modifiedLine = modifiedLines[i] || '';
    
    if (originalLine !== modifiedLine) {
      if (originalLine && !modifiedLine) {
        changes.push(`- Line ${i + 1}: ${originalLine.trim()}`);
      } else if (!originalLine && modifiedLine) {
        changes.push(`+ Line ${i + 1}: ${modifiedLine.trim()}`);
      } else {
        changes.push(`~ Line ${i + 1}: ${originalLine.trim()} → ${modifiedLine.trim()}`);
      }
    }
  }
  
  return changes;
}

/**
 * Processes multiple files to fix implicit any errors
 */
function fixImplicitAnyErrorsInProject(
  errorsByFile: Record<string, ImplicitAnyError[]>,
  config: TsMorphConfig = {}
): FixResult {
  const { dryRun = false } = config;
  
  // ✅ PROPER PATTERN: Branch early based on dry-run flag
  if (dryRun) {
    return previewImplicitAnyErrorsInProject(errorsByFile, config);
  } else {
    return applyImplicitAnyErrorsInProject(errorsByFile, config);
  }
}

/**
 * Safe preview function that doesn't modify original AST
 * Uses in-memory file system for true safety
 */
function previewImplicitAnyErrorsInProject(
  errorsByFile: Record<string, ImplicitAnyError[]>,
  config: TsMorphConfig = {}
): FixResult {
  const { enableLogging = false, projectRoot = process.cwd() } = config;
  
  // ✅ Create preview project with in-memory file system
  // CRITICAL: Must specify compiler options for proper type resolution
  const previewProject = createProject({
    ...config,
    useInMemoryFileSystem: true,
    compilerOptions: {
      ...config.compilerOptions,
      target: ScriptTarget.ES2020,
      lib: ["lib.es2020.d.ts"],
      moduleResolution: ModuleResolutionKind.NodeJs
    }
  });
  
  const filePaths = Object.keys(errorsByFile);
  
  let totalFixed = 0;
  const processedFiles: string[] = [];
  const errors: string[] = [];
  const inferredTypes: Record<string, number> = {};
  const previewChanges: Array<{ file: string; changes: string[] }> = [];

  // Process files directly without creating originalProject
  filePaths.forEach((filePath) => {
    const fileErrors = errorsByFile[filePath] || [];
    
    if (fileErrors.length === 0) return;

    try {
      // Read original content directly from filesystem
      const absolutePath = join(projectRoot, filePath);
      if (!existsSync(absolutePath)) {
        if (enableLogging) {
          console.warn(`Warning: File not found: ${filePath}`);
        }
        return;
      }
      
      const originalContent = readFileSync(absolutePath, 'utf-8');
      const previewFile = previewProject.createSourceFile(filePath, originalContent);
      
      // Apply changes to preview copy (safe!)
      const fixedCount = fixImplicitAnyErrorsInFile(previewFile, fileErrors);
      
      if (fixedCount > 0) {
        // Generate diff from preview changes
        const newContent = previewFile.getFullText();
        const changes = generateChangeDiff(originalContent, newContent);
        previewChanges.push({ file: filePath, changes });
        
        totalFixed += fixedCount;
        processedFiles.push(filePath);
        
        // Track inferred types
        fileErrors.forEach(error => {
          if (error.inferredType) {
            inferredTypes[error.inferredType] = (inferredTypes[error.inferredType] || 0) + 1;
          }
        });
        
        if (enableLogging) {
          console.log(`🔍 [DRY RUN] Would fix ${fixedCount} implicit any issues in ${filePath}`);
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

  const totalErrors = Object.values(errorsByFile).flat().length;
  
  return {
    filesProcessed: processedFiles.length,
    issuesFixed: totalFixed,
    remainingIssues: totalErrors - totalFixed,
    processedFiles,
    errors,
    inferredTypes,
    dryRun: true,
    previewChanges
  };
}

/**
 * Apply function that actually modifies files with proper memory management
 * Uses forgetNodesCreatedInBlock to prevent memory leaks
 */
function applyImplicitAnyErrorsInProject(
  errorsByFile: Record<string, ImplicitAnyError[]>,
  config: TsMorphConfig = {}
): FixResult {
  const { enableLogging = false, projectRoot = process.cwd() } = config;
  
  const project = createProject(config);
  const filePaths = Object.keys(errorsByFile);
  const sourceFiles = addSourceFilesToProject(project, filePaths, projectRoot);
  
  let totalFixed = 0;
  const processedFiles: string[] = [];
  const errors: string[] = [];
  const inferredTypes: Record<string, number> = {};

  // ✅ CRITICAL FIX: Use forgetNodesCreatedInBlock for memory management
  return project.forgetNodesCreatedInBlock(() => {
    sourceFiles.forEach((sourceFile) => {
      const filePath = sourceFile.getFilePath().replace(projectRoot + "/", "");
      const fileErrors = errorsByFile[filePath] || [];
      
      if (fileErrors.length === 0) return;

      try {
        const fixedCount = fixImplicitAnyErrorsInFile(sourceFile, fileErrors);
        
        if (fixedCount > 0) {
          sourceFile.saveSync();
          totalFixed += fixedCount;
          processedFiles.push(filePath);
          
          // Track inferred types
          fileErrors.forEach(error => {
            if (error.inferredType) {
              inferredTypes[error.inferredType] = (inferredTypes[error.inferredType] || 0) + 1;
            }
          });
          
          if (enableLogging) {
            console.log(`✅ Fixed ${fixedCount} implicit any issues in ${filePath}`);
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
      inferredTypes,
      dryRun: false
    };
  });
}

// ────────────────────────────────────────────────────────────
// Main execution
// ────────────────────────────────────────────────────────────
async function main() {
  console.log('Loading TypeScript error tracking data...\n');
  
  const trackingReport = JSON.parse(
    readFileSync(join(__dirname, "typescript-errors-tracking.json"), "utf8")
  );

  // Get implicit any errors
  const implicitAnyErrors = trackingReport.detailedErrors.TS7006 || [];

  console.log(`Found ${implicitAnyErrors.length} TS7006 (Implicit Any) errors\n`);

  if (implicitAnyErrors.length === 0) {
    console.log('No implicit any errors to fix!');
    return;
  }

  // Analyze errors
  const analyzedErrors = implicitAnyErrors.map(analyzeImplicitAnyError);
  
  // Show breakdown by context
  const contextBreakdown: Record<string, number> = {};
  analyzedErrors.forEach(error => {
    if (error.context) {
      contextBreakdown[error.context] = (contextBreakdown[error.context] || 0) + 1;
    }
  });
  
  console.log('Error breakdown by context:');
  Object.entries(contextBreakdown).forEach(([context, count]) => {
    console.log(`  ${context}: ${count} errors`);
  });
  console.log();

  // Group errors by file
  const errorsByFile = groupErrorsByFile(analyzedErrors);

  // Fix errors using ts-morph
  const fixResult = fixImplicitAnyErrorsInProject(errorsByFile, {
    projectRoot: process.cwd(),
    enableLogging: true,
    skipTsConfig: true
  });

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    originalContextBreakdown: contextBreakdown,
    ...fixResult
  };

  writeFileSync(
    join(__dirname, "fix-implicit-any-report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("\n📊 Summary:");
  console.log(`   Files processed: ${fixResult.filesProcessed}`);
  console.log(`   Issues fixed:    ${fixResult.issuesFixed}`);
  console.log(`   Remaining:       ${fixResult.remainingIssues}`);
  console.log('\n🎯 Inferred types:');
  Object.entries(fixResult.inferredTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} parameters`);
  });
  if (fixResult.errors.length > 0) {
    console.log(`\n❌ Errors: ${fixResult.errors.length}`);
    fixResult.errors.forEach(error => console.log(`     - ${error}`));
  }
  console.log("\n✅ Report saved to fix-implicit-any-report.json");
  console.log('\n⚠️  Note: Inferred types may need manual refinement for better specificity.');
  console.log('   Run "npm run typecheck" to verify fixes.');
}

main().catch(console.error);