#!/usr/bin/env ts-node
/**
 * Fix Import/Module Resolution Errors Script
 * 
 * Uses ts-morph to safely fix TS2307, TS2304 module resolution errors
 * by updating import paths, adding missing imports, and fixing module declarations.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { 
  createProject, 
  addSourceFilesToProject,
  groupErrorsByFile,
  type UnusedVariableError,
  type TsMorphConfig 
} from "./ts-morph-utils";
import { Project, SourceFile, Node, SyntaxKind, ScriptTarget, ModuleResolutionKind } from "ts-morph";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ImportError extends UnusedVariableError {
  moduleName?: string;
  identifier?: string;
  suggestedFix?: 'fix-path' | 'add-import' | 'add-declaration' | 'install-types';
  suggestedPath?: string;
}

interface FixResult {
  filesProcessed: number;
  issuesFixed: number;
  remainingIssues: number;
  processedFiles: string[];
  errors: string[];
  fixTypes: Record<string, number>;
  dryRun?: boolean;
  previewChanges?: Array<{
    file: string;
    changes: string[];
  }>;
}

/**
 * Common module path corrections and type package suggestions
 */
const MODULE_CORRECTIONS: Record<string, string> = {
  '@/': './src/renderer/src/',
  '@components/': './src/renderer/src/components/',
  '@lib/': './src/renderer/src/lib/',
  '@hooks/': './src/renderer/src/hooks/',
  '@types/': './src/renderer/src/types/',
  '@store/': './src/renderer/src/store/',
};

const TYPE_PACKAGES: Record<string, string> = {
  'electron': '@types/node',
  'react': '@types/react',
  'jest': '@types/jest',
  'node': '@types/node',
  'express': '@types/express',
  'lodash': '@types/lodash',
};

/**
 * Analyzes import error and determines fix strategy
 */
function analyzeImportError(error: UnusedVariableError): ImportError {
  const message = error.message;
  
  // Extract module name from error message
  let moduleName: string | undefined;
  let identifier: string | undefined;
  
  const moduleMatch = message.match(/Cannot find module ['"']([^'"]+)['"']/);
  const nameMatch = message.match(/Cannot find name ['"']([^'"]+)['"']/);
  
  if (moduleMatch) {
    moduleName = moduleMatch[1];
  } else if (nameMatch) {
    identifier = nameMatch[1];
  }
  
  let suggestedFix: ImportError['suggestedFix'] = 'add-declaration';
  let suggestedPath: string | undefined;
  
  if (moduleName) {
    // Check for path alias corrections
    for (const [alias, realPath] of Object.entries(MODULE_CORRECTIONS)) {
      if (moduleName.startsWith(alias)) {
        suggestedFix = 'fix-path';
        suggestedPath = moduleName.replace(alias, realPath);
        break;
      }
    }
    
    // Check for missing type packages
    if (!suggestedPath && TYPE_PACKAGES[moduleName]) {
      suggestedFix = 'install-types';
      suggestedPath = TYPE_PACKAGES[moduleName];
    }
    
    // Check if it's a relative path issue
    if (!suggestedPath && (moduleName.startsWith('./') || moduleName.startsWith('../'))) {
      suggestedFix = 'fix-path';
    }
  } else if (identifier) {
    // For missing identifiers, try to add import
    suggestedFix = 'add-import';
  }
  
  return {
    ...error,
    moduleName,
    identifier,
    suggestedFix,
    suggestedPath
  };
}

/**
 * Finds possible file paths for a module
 */
function findModulePath(currentFile: string, moduleName: string, projectRoot: string): string | null {
  const currentDir = dirname(resolve(projectRoot, currentFile));
  
  // Try different extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.d.ts'];
  const basePaths = [
    resolve(currentDir, moduleName),
    resolve(projectRoot, 'src', moduleName),
    resolve(projectRoot, 'src/renderer/src', moduleName),
    resolve(projectRoot, moduleName)
  ];
  
  for (const basePath of basePaths) {
    // Try exact path
    if (existsSync(basePath)) {
      return relative(currentDir, basePath);
    }
    
    // Try with extensions
    for (const ext of extensions) {
      const fullPath = basePath + ext;
      if (existsSync(fullPath)) {
        return relative(currentDir, fullPath).replace(/\\/g, '/');
      }
    }
    
    // Try as directory with index file
    for (const ext of extensions) {
      const indexPath = join(basePath, 'index' + ext);
      if (existsSync(indexPath)) {
        return relative(currentDir, basePath).replace(/\\/g, '/');
      }
    }
  }
  
  return null;
}

/**
 * Fixes import path in a source file
 */
function fixImportPath(sourceFile: SourceFile, error: ImportError): boolean {
  const { moduleName, suggestedPath } = error;
  
  if (!moduleName) return false;
  
  try {
    // Find the import declaration
    const importDecl = sourceFile.getImportDeclarations()
      .find(imp => imp.getModuleSpecifierValue() === moduleName);
    
    if (!importDecl) return false;
    
    let newPath = suggestedPath;
    
    // If no suggested path, try to find the correct path
    if (!newPath) {
      const currentFile = sourceFile.getFilePath();
      const projectRoot = process.cwd();
      newPath = findModulePath(currentFile, moduleName, projectRoot);
    }
    
    if (!newPath) return false;
    
    // Update the import path
    importDecl.setModuleSpecifier(newPath);
    return true;
  } catch (error) {
    console.warn(`Failed to fix import path: ${error}`);
    return false;
  }
}

/**
 * Adds missing import for an identifier
 */
function addMissingImport(sourceFile: SourceFile, error: ImportError): boolean {
  const { identifier } = error;
  
  if (!identifier) return false;
  
  try {
    // Common imports for identifiers
    const commonImports: Record<string, { module: string; isDefault?: boolean }> = {
      'React': { module: 'react', isDefault: true },
      'useState': { module: 'react' },
      'useEffect': { module: 'react' },
      'useCallback': { module: 'react' },
      'useMemo': { module: 'react' },
      'describe': { module: 'vitest' },
      'it': { module: 'vitest' },
      'expect': { module: 'vitest' },
      'test': { module: 'vitest' },
      'beforeEach': { module: 'vitest' },
      'afterEach': { module: 'vitest' },
      'vi': { module: 'vitest' },
      'jest': { module: '@jest/globals' },
    };
    
    const importInfo = commonImports[identifier];
    if (!importInfo) return false;
    
    // Check if import already exists
    const existingImport = sourceFile.getImportDeclarations()
      .find(imp => imp.getModuleSpecifierValue() === importInfo.module);
    
    if (existingImport) {
      // Add to existing import
      if (importInfo.isDefault) {
        if (!existingImport.getDefaultImport()) {
          existingImport.setDefaultImport(identifier);
        }
      } else {
        const namedImports = existingImport.getNamedImports();
        const hasImport = namedImports.some(ni => ni.getName() === identifier);
        if (!hasImport) {
          existingImport.addNamedImport(identifier);
        }
      }
    } else {
      // Add new import
      if (importInfo.isDefault) {
        sourceFile.addImportDeclaration({
          moduleSpecifier: importInfo.module,
          defaultImport: identifier
        });
      } else {
        sourceFile.addImportDeclaration({
          moduleSpecifier: importInfo.module,
          namedImports: [identifier]
        });
      }
    }
    
    return true;
  } catch (error) {
    console.warn(`Failed to add missing import: ${error}`);
    return false;
  }
}

/**
 * Adds type declaration for missing modules
 */
function addTypeDeclaration(sourceFile: SourceFile, error: ImportError): boolean {
  const { moduleName, identifier } = error;
  
  try {
    // Add declare statement at the top of the file
    const declares = sourceFile.getStatements().filter(stmt => 
      Node.isTypeAliasDeclaration(stmt) || Node.isInterfaceDeclaration(stmt) || stmt.getText().startsWith('declare')
    );
    
    const insertIndex = declares.length > 0 ? 
      declares[declares.length - 1].getChildIndex() + 1 : 
      sourceFile.getImportDeclarations().length;
    
    if (moduleName) {
      // Add module declaration
      sourceFile.insertStatements(insertIndex, [`declare module '${moduleName}';`]);
    } else if (identifier) {
      // Add global declaration
      sourceFile.insertStatements(insertIndex, [`declare const ${identifier}: any;`]);
    }
    
    return true;
  } catch (error) {
    console.warn(`Failed to add type declaration: ${error}`);
    return false;
  }
}

/**
 * Fixes import errors in a single source file
 */
function fixImportErrorsInFile(
  sourceFile: SourceFile, 
  errors: ImportError[]
): number {
  let fixCount = 0;
  
  for (const error of errors) {
    let fixed = false;
    
    try {
      switch (error.suggestedFix) {
        case 'fix-path':
          fixed = fixImportPath(sourceFile, error);
          break;
          
        case 'add-import':
          fixed = addMissingImport(sourceFile, error);
          break;
          
        case 'add-declaration':
          fixed = addTypeDeclaration(sourceFile, error);
          break;
          
        case 'install-types':
          // This would require external package installation
          console.log(`⚠️  Manual action needed: Install ${error.suggestedPath} for ${error.moduleName}`);
          break;
      }
      
      if (fixed) {
        fixCount++;
      }
    } catch (error) {
      console.warn(`Failed to fix import error at line ${error.line}: ${error}`);
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
 * Processes multiple files to fix import errors
 */
function fixImportErrorsInProject(
  errorsByFile: Record<string, ImportError[]>,
  config: TsMorphConfig = {}
): FixResult {
  const { dryRun = false } = config;
  
  // ✅ PROPER PATTERN: Branch early based on dry-run flag
  if (dryRun) {
    return previewImportErrorsInProject(errorsByFile, config);
  } else {
    return applyImportErrorsInProject(errorsByFile, config);
  }
}

/**
 * Safe preview function that doesn't modify original AST
 * Uses in-memory file system for true safety
 */
function previewImportErrorsInProject(
  errorsByFile: Record<string, ImportError[]>,
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
  const fixTypes: Record<string, number> = {};
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
      const fixedCount = fixImportErrorsInFile(previewFile, fileErrors);
      
      if (fixedCount > 0) {
        // Generate diff from preview changes
        const newContent = previewFile.getFullText();
        const changes = generateChangeDiff(originalContent, newContent);
        previewChanges.push({ file: filePath, changes });
        
        totalFixed += fixedCount;
        processedFiles.push(filePath);
        
        // Track fix types
        fileErrors.forEach(error => {
          if (error.suggestedFix) {
            fixTypes[error.suggestedFix] = (fixTypes[error.suggestedFix] || 0) + 1;
          }
        });
        
        if (enableLogging) {
          console.log(`🔍 [DRY RUN] Would fix ${fixedCount} import issues in ${filePath}`);
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
    fixTypes,
    dryRun: true,
    previewChanges
  };
}

/**
 * Apply function that actually modifies files with proper memory management
 * Uses forgetNodesCreatedInBlock to prevent memory leaks
 */
function applyImportErrorsInProject(
  errorsByFile: Record<string, ImportError[]>,
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

  // ✅ CRITICAL FIX: Use forgetNodesCreatedInBlock for memory management
  return project.forgetNodesCreatedInBlock(() => {
    sourceFiles.forEach((sourceFile) => {
      const filePath = sourceFile.getFilePath().replace(projectRoot + "/", "");
      const fileErrors = errorsByFile[filePath] || [];
      
      if (fileErrors.length === 0) return;

      try {
        const fixedCount = fixImportErrorsInFile(sourceFile, fileErrors);
        
        if (fixedCount > 0) {
          sourceFile.saveSync();
          totalFixed += fixedCount;
          processedFiles.push(filePath);
          
          // Track fix types
          fileErrors.forEach(error => {
            if (error.suggestedFix) {
              fixTypes[error.suggestedFix] = (fixTypes[error.suggestedFix] || 0) + 1;
            }
          });
          
          if (enableLogging) {
            console.log(`✅ Fixed ${fixedCount} import issues in ${filePath}`);
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
      fixTypes,
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

  // Get import/module related errors
  const importErrors = [
    ...(trackingReport.detailedErrors.TS2307 || []),
    ...(trackingReport.detailedErrors.TS2304 || [])
  ];

  console.log(`Found ${importErrors.length} import/module resolution errors:`);
  console.log(`  TS2307 (Cannot Find Module): ${trackingReport.detailedErrors.TS2307?.length || 0}`);
  console.log(`  TS2304 (Cannot Find Name): ${trackingReport.detailedErrors.TS2304?.length || 0}\n`);

  if (importErrors.length === 0) {
    console.log('No import errors to fix!');
    return;
  }

  // Analyze errors
  const analyzedErrors = importErrors.map(analyzeImportError);
  
  // Show breakdown by fix type
  const fixTypeBreakdown: Record<string, number> = {};
  analyzedErrors.forEach(error => {
    if (error.suggestedFix) {
      fixTypeBreakdown[error.suggestedFix] = (fixTypeBreakdown[error.suggestedFix] || 0) + 1;
    }
  });
  
  console.log('Error breakdown by fix strategy:');
  Object.entries(fixTypeBreakdown).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} errors`);
  });
  console.log();

  // Group errors by file
  const errorsByFile = groupErrorsByFile(analyzedErrors);

  // Fix errors using ts-morph
  const fixResult = fixImportErrorsInProject(errorsByFile, {
    projectRoot: process.cwd(),
    enableLogging: true,
    skipTsConfig: true
  });

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    originalErrorBreakdown: fixTypeBreakdown,
    ...fixResult
  };

  writeFileSync(
    join(__dirname, "fix-import-errors-report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("\n📊 Summary:");
  console.log(`   Files processed: ${fixResult.filesProcessed}`);
  console.log(`   Issues fixed:    ${fixResult.issuesFixed}`);
  console.log(`   Remaining:       ${fixResult.remainingIssues}`);
  console.log('\n🔧 Fixes applied:');
  Object.entries(fixResult.fixTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} fixes`);
  });
  if (fixResult.errors.length > 0) {
    console.log(`\n❌ Errors: ${fixResult.errors.length}`);
    fixResult.errors.forEach(error => console.log(`     - ${error}`));
  }
  console.log("\n✅ Report saved to fix-import-errors-report.json");
  console.log('\n⚠️  Note: Some import fixes may require manual package installation.');
  console.log('   Run "npm run typecheck" to verify fixes.');
}

main().catch(console.error);