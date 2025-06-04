#!/usr/bin/env ts-node
/**
 * Shared ts-morph Utility Module
 * 
 * This module provides common utilities for TypeScript AST manipulation
 * using ts-morph, following 2025 best practices for performance and safety.
 */

import { Project, SourceFile, Node, ImportDeclaration, ScriptTarget, ModuleResolutionKind } from "ts-morph";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface TsMorphConfig {
  tsConfigPath?: string;
  projectRoot?: string;
  skipTsConfig?: boolean;
  enableLogging?: boolean;
  dryRun?: boolean;
  // ts-morph Project constructor options
  useInMemoryFileSystem?: boolean;
  skipLoadingLibFiles?: boolean;
  compilerOptions?: any;
  fileSystem?: any;
}

export interface UnusedVariableError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

export interface FixResult {
  filesProcessed: number;
  issuesFixed: number;
  remainingIssues: number;
  processedFiles: string[];
  errors: string[];
  dryRun?: boolean;
  previewChanges?: Array<{
    file: string;
    changes: string[];
  }>;
}

/**
 * Creates a properly configured ts-morph Project instance
 */
export function createProject(config: TsMorphConfig = {}): Project {
  const {
    tsConfigPath = join(process.cwd(), "tsconfig.json"),
    skipTsConfig = true,
    useInMemoryFileSystem,
    skipLoadingLibFiles,
    compilerOptions,
    fileSystem
  } = config;

  const projectConfig: any = {
    skipAddingFilesFromTsConfig: skipTsConfig
  };

  // Only add tsconfig if it exists and we're not skipping it
  if (!skipTsConfig && existsSync(tsConfigPath)) {
    projectConfig.tsConfigFilePath = tsConfigPath;
  }

  // Add ts-morph specific options
  if (useInMemoryFileSystem !== undefined) {
    projectConfig.useInMemoryFileSystem = useInMemoryFileSystem;
  }
  if (skipLoadingLibFiles !== undefined) {
    projectConfig.skipLoadingLibFiles = skipLoadingLibFiles;
  }
  if (compilerOptions !== undefined) {
    projectConfig.compilerOptions = compilerOptions;
  }
  if (fileSystem !== undefined) {
    projectConfig.fileSystem = fileSystem;
  }

  return new Project(projectConfig);
}

/**
 * Safely adds source files to a project, handling missing files gracefully
 */
export function addSourceFilesToProject(
  project: Project, 
  filePaths: string[], 
  projectRoot: string = process.cwd()
): SourceFile[] {
  const addedFiles: SourceFile[] = [];
  
  for (const relativePath of filePaths) {
    const absolutePath = join(projectRoot, relativePath);
    
    if (existsSync(absolutePath)) {
      try {
        const sourceFile = project.addSourceFileAtPath(absolutePath);
        addedFiles.push(sourceFile);
      } catch (error) {
        console.warn(`Warning: Could not add file ${relativePath}: ${error}`);
      }
    } else {
      console.warn(`Warning: File not found: ${relativePath}`);
    }
  }
  
  return addedFiles;
}

/**
 * Extracts variable name from TypeScript compiler error message
 */
export function extractUnusedVariableName(errorMessage: string): string | null {
  const match = errorMessage.match(/'([^']+)'/);
  return match ? match[1] : null;
}

/**
 * Removes unused imports from a source file using AST manipulation
 */
export function removeUnusedImports(sourceFile: SourceFile, unusedNames: string[]): number {
  let fixCount = 0;
  const unusedSet = new Set(unusedNames);

  sourceFile.getImportDeclarations().forEach((importDecl) => {
    // Handle default import
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport && unusedSet.has(defaultImport.getText())) {
      if (importDecl.getNamedImports().length === 0 && !importDecl.getNamespaceImport()) {
        importDecl.remove(); // Remove entire import
      } else {
        importDecl.removeDefaultImport(); // Keep the rest
      }
      fixCount++;
      return;
    }

    // Handle namespace import (import * as X from "...")
    const namespaceImport = importDecl.getNamespaceImport();
    if (namespaceImport && unusedSet.has(namespaceImport.getText())) {
      if (!defaultImport && importDecl.getNamedImports().length === 0) {
        importDecl.remove();
      } else {
        importDecl.removeNamespaceImport();
      }
      fixCount++;
      return;
    }

    // Handle named imports
    const namedImports = importDecl.getNamedImports();
    const importsToRemove = namedImports.filter(namedImport => 
      unusedSet.has(namedImport.getNameNode().getText())
    );

    importsToRemove.forEach(namedImport => {
      namedImport.remove();
      fixCount++;
    });

    // Remove entire import declaration if no imports left
    if (
      importDecl.getNamedImports().length === 0 &&
      !importDecl.getDefaultImport() &&
      !importDecl.getNamespaceImport()
    ) {
      importDecl.remove();
    }
  });

  return fixCount;
}

/**
 * Removes unused variable declarations from a source file
 */
export function removeUnusedVariables(sourceFile: SourceFile, unusedNames: string[]): number {
  let fixCount = 0;
  const unusedSet = new Set(unusedNames);

  sourceFile.getVariableDeclarations().forEach((variableDecl) => {
    if (unusedSet.has(variableDecl.getName())) {
      const statement = variableDecl.getVariableStatement();
      variableDecl.remove(); // Remove this specific declaration
      
      // If the statement has no more declarations, remove the entire statement
      if (statement && statement.getDeclarations().length === 0) {
        statement.remove();
      }
      
      fixCount++;
    }
  });

  return fixCount;
}

/**
 * Fixes unused variable/import errors in a single source file
 */
export function fixUnusedVariablesInFile(
  sourceFile: SourceFile, 
  errors: UnusedVariableError[]
): number {
  let totalFixed = 0;
  
  // Extract all unused names from errors for this file
  const unusedNames = errors
    .map(err => extractUnusedVariableName(err.message))
    .filter((name): name is string => name !== null);

  if (unusedNames.length === 0) {
    return 0;
  }

  // Fix imports first
  totalFixed += removeUnusedImports(sourceFile, unusedNames);
  
  // Then fix variable declarations
  totalFixed += removeUnusedVariables(sourceFile, unusedNames);

  return totalFixed;
}

/**
 * Processes multiple files to fix unused variable errors
 */
export function fixUnusedVariablesInProject(
  errorsByFile: Record<string, UnusedVariableError[]>,
  config: TsMorphConfig = {}
): FixResult {
  const { dryRun = false } = config;
  
  // ✅ PROPER PATTERN: Branch early based on dry-run flag
  if (dryRun) {
    return previewUnusedVariablesInProject(errorsByFile, config);
  } else {
    return applyUnusedVariablesInProject(errorsByFile, config);
  }
}

/**
 * Safe preview function that doesn't modify original AST
 * Uses in-memory file system for true safety
 */
function previewUnusedVariablesInProject(
  errorsByFile: Record<string, UnusedVariableError[]>,
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
      const fixedCount = fixUnusedVariablesInFile(previewFile, fileErrors);
      
      if (fixedCount > 0) {
        // Generate diff from preview changes
        const newContent = previewFile.getFullText();
        const changes = generateChangeDiff(originalContent, newContent);
        previewChanges.push({ file: filePath, changes });
        
        totalFixed += fixedCount;
        processedFiles.push(filePath);
        
        if (enableLogging) {
          console.log(`🔍 [DRY RUN] Would fix ${fixedCount} issues in ${filePath}`);
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
    dryRun: true,
    previewChanges
  };
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
 * Apply function that actually modifies files with proper memory management
 * Uses forgetNodesCreatedInBlock to prevent memory leaks
 */
function applyUnusedVariablesInProject(
  errorsByFile: Record<string, UnusedVariableError[]>,
  config: TsMorphConfig = {}
): FixResult {
  const { enableLogging = false, projectRoot = process.cwd() } = config;
  
  const project = createProject(config);
  const filePaths = Object.keys(errorsByFile);
  const sourceFiles = addSourceFilesToProject(project, filePaths, projectRoot);
  
  let totalFixed = 0;
  const processedFiles: string[] = [];
  const errors: string[] = [];

  // ✅ CRITICAL FIX: Use forgetNodesCreatedInBlock for memory management
  return project.forgetNodesCreatedInBlock(() => {
    sourceFiles.forEach((sourceFile) => {
      const filePath = sourceFile.getFilePath().replace(projectRoot + "/", "");
      const fileErrors = errorsByFile[filePath] || [];
      
      if (fileErrors.length === 0) return;

      try {
        // Apply actual changes to the AST
        const fixedCount = fixUnusedVariablesInFile(sourceFile, fileErrors);
        
        if (fixedCount > 0) {
          sourceFile.saveSync();
          totalFixed += fixedCount;
          processedFiles.push(filePath);
          
          if (enableLogging) {
            console.log(`✅ Fixed ${fixedCount} unused variable issues in ${filePath}`);
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
      dryRun: false
    };
  });
}

/**
 * Utility function to group errors by file path
 */
export function groupErrorsByFile(errors: UnusedVariableError[]): Record<string, UnusedVariableError[]> {
  const errorsByFile: Record<string, UnusedVariableError[]> = {};
  
  for (const error of errors) {
    if (!errorsByFile[error.file]) {
      errorsByFile[error.file] = [];
    }
    errorsByFile[error.file].push(error);
  }
  
  return errorsByFile;
}

/**
 * Memory optimization: Use forgetNodesCreatedInBlock for large operations
 */
export function performLargeOperation<T>(
  project: Project,
  operation: () => T
): T {
  return project.forgetNodesCreatedInBlock(() => {
    return operation();
  });
}

/**
 * Type guard utilities for common AST node checks
 */
export const NodeChecks = {
  isExportedFunction: (node: Node): boolean => {
    return Node.isFunctionDeclaration(node) && node.hasExportKeyword();
  },
  
  isExportedClass: (node: Node): boolean => {
    return Node.isClassDeclaration(node) && node.hasExportKeyword();
  },
  
  isExportedInterface: (node: Node): boolean => {
    return Node.isInterfaceDeclaration(node) && node.hasExportKeyword();
  },
  
  isUnusedImport: (importDecl: ImportDeclaration): boolean => {
    // This would need additional logic to check if import is actually used
    // For now, just check if it exists
    return importDecl.getDefaultImport() !== undefined ||
           importDecl.getNamespaceImport() !== undefined ||
           importDecl.getNamedImports().length > 0;
  }
};

/**
 * Common error patterns for TypeScript compilation issues
 */
export const ErrorPatterns = {
  UNUSED_VARIABLE: /TS6133/,
  UNUSED_IMPORT: /TS6192/,
  POSSIBLY_NULL: /TS18047/,
  POSSIBLY_UNDEFINED: /TS18048/,
  IMPLICIT_ANY: /TS7006/,
  CANNOT_FIND_MODULE: /TS2307/,
  PROPERTY_NOT_EXIST: /TS2339/,
  
  isUnusedVariableError: (error: UnusedVariableError): boolean => {
    return ErrorPatterns.UNUSED_VARIABLE.test(error.code);
  },
  
  isPossiblyNullError: (error: UnusedVariableError): boolean => {
    return ErrorPatterns.POSSIBLY_NULL.test(error.code);
  }
};

export default {
  createProject,
  addSourceFilesToProject,
  extractUnusedVariableName,
  removeUnusedImports,
  removeUnusedVariables,
  fixUnusedVariablesInFile,
  fixUnusedVariablesInProject,
  groupErrorsByFile,
  performLargeOperation,
  NodeChecks,
  ErrorPatterns
};