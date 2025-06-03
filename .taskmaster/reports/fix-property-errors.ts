#!/usr/bin/env ts-node
/**
 * Fix Property Does Not Exist Errors Script
 * 
 * Uses ts-morph to safely fix TS2339 errors by adding type definitions,
 * fixing mock types, and adding proper interface declarations.
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
import { Project, SourceFile, Node, SyntaxKind, InterfaceDeclaration, TypeAliasDeclaration } from "ts-morph";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PropertyError extends UnusedVariableError {
  propertyName?: string;
  objectType?: string;
  suggestedFix?: 'add-property' | 'fix-mock' | 'add-interface' | 'fix-typo';
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
 * Extracts property name and suggested fix from TS2339 error message
 */
function analyzePropertyError(error: UnusedVariableError): PropertyError {
  const message = error.message;
  
  // Extract property name from error message
  const propertyMatch = message.match(/Property '([^']+)' does not exist/);
  const typeMatch = message.match(/does not exist on type '([^']+)'/);
  
  const propertyName = propertyMatch?.[1];
  const objectType = typeMatch?.[1];
  
  let suggestedFix: PropertyError['suggestedFix'] = 'add-property';
  
  // Determine fix strategy based on file type and error context
  if (error.file.includes('test') || error.file.includes('mock') || error.file.includes('__tests__')) {
    suggestedFix = 'fix-mock';
  } else if (message.includes('Did you mean')) {
    suggestedFix = 'fix-typo';
  } else if (objectType && (objectType.includes('{}') || objectType === 'any')) {
    suggestedFix = 'add-interface';
  }
  
  return {
    ...error,
    propertyName,
    objectType,
    suggestedFix
  };
}

/**
 * Adds property to existing interface or type
 */
function addPropertyToInterface(sourceFile: SourceFile, interfaceName: string, propertyName: string, propertyType: string = 'any'): boolean {
  try {
    // Find existing interface
    const existingInterface = sourceFile.getInterface(interfaceName);
    if (existingInterface) {
      existingInterface.addProperty({
        name: propertyName,
        type: propertyType
      });
      return true;
    }
    
    // Find existing type alias
    const existingType = sourceFile.getTypeAlias(interfaceName);
    if (existingType && existingType.getTypeNode()?.getKind() === SyntaxKind.TypeLiteral) {
      // Add property to type literal
      const typeLiteral = existingType.getTypeNode();
      if (Node.isTypeLiteralNode(typeLiteral)) {
        existingType.replaceWithText(`type ${interfaceName} = {
  ${typeLiteral.getProperties().map(p => p.getText()).join(';\n  ')};
  ${propertyName}: ${propertyType};
}`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.warn(`Failed to add property to interface: ${error}`);
    return false;
  }
}

/**
 * Creates a new interface declaration
 */
function createInterface(sourceFile: SourceFile, interfaceName: string, propertyName: string, propertyType: string = 'any'): boolean {
  try {
    // Check if interface already exists
    if (sourceFile.getInterface(interfaceName)) {
      return false;
    }
    
    // Add interface at the top of the file (after imports)
    const imports = sourceFile.getImportDeclarations();
    const insertIndex = imports.length > 0 ? imports[imports.length - 1].getChildIndex() + 1 : 0;
    
    sourceFile.insertInterface(insertIndex, {
      name: interfaceName,
      isExported: true,
      properties: [{
        name: propertyName,
        type: propertyType
      }]
    });
    
    return true;
  } catch (error) {
    console.warn(`Failed to create interface: ${error}`);
    return false;
  }
}

/**
 * Fixes mock-related property errors by extending mock types
 */
function fixMockProperty(sourceFile: SourceFile, error: PropertyError): boolean {
  const { propertyName, objectType } = error;
  
  if (!propertyName || !objectType) return false;
  
  try {
    // Look for mock declarations or jest.fn() calls
    const mockPattern = new RegExp(`(jest\\.fn\\(\\)|vi\\.fn\\(\\)|mock\\w*|Mock\\w*)`, 'i');
    const text = sourceFile.getFullText();
    
    if (mockPattern.test(text)) {
      // For test files, add property to mock objects
      const position = sourceFile.getPositionAtLineAndColumn(error.line, error.column);
      const node = sourceFile.getDescendantAtPos(position);
      
      if (!node) return false;
      
      // Find the mock object or function call
      let mockNode = node;
      while (mockNode && !Node.isObjectLiteralExpression(mockNode) && !Node.isCallExpression(mockNode)) {
        mockNode = mockNode.getParent();
      }
      
      if (Node.isObjectLiteralExpression(mockNode)) {
        // Add property to object literal
        mockNode.addProperty({
          name: propertyName,
          initializer: 'jest.fn()' // Default mock function
        });
        return true;
      } else if (Node.isCallExpression(mockNode)) {
        // Replace with object that includes the property
        const existingArgs = mockNode.getArguments().map(arg => arg.getText()).join(', ');
        mockNode.replaceWithText(`Object.assign(${mockNode.getText()}, { ${propertyName}: jest.fn() })`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.warn(`Failed to fix mock property: ${error}`);
    return false;
  }
}

/**
 * Attempts to fix property name typos using simple heuristics
 */
function fixPropertyTypo(sourceFile: SourceFile, error: PropertyError): boolean {
  const { propertyName, line, column } = error;
  
  if (!propertyName) return false;
  
  try {
    // Extract suggested property name from error message
    const suggestionMatch = error.message.match(/Did you mean '([^']+)'/);
    const suggestedName = suggestionMatch?.[1];
    
    if (!suggestedName) return false;
    
    const position = sourceFile.getPositionAtLineAndColumn(line, column);
    const node = sourceFile.getDescendantAtPos(position);
    
    if (!node) return false;
    
    // Find the property access expression
    let propertyAccess = node;
    while (propertyAccess && !Node.isPropertyAccessExpression(propertyAccess)) {
      propertyAccess = propertyAccess.getParent();
    }
    
    if (Node.isPropertyAccessExpression(propertyAccess)) {
      const nameNode = propertyAccess.getNameNode();
      if (nameNode.getText() === propertyName) {
        nameNode.replaceWithText(suggestedName);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.warn(`Failed to fix property typo: ${error}`);
    return false;
  }
}

/**
 * Fixes property errors in a single source file
 */
function fixPropertyErrorsInFile(
  sourceFile: SourceFile, 
  errors: PropertyError[]
): number {
  let fixCount = 0;
  
  // Sort errors by line number (process from bottom to top to avoid position shifts)
  const sortedErrors = errors.sort((a, b) => b.line - a.line);
  
  for (const error of sortedErrors) {
    let fixed = false;
    
    try {
      switch (error.suggestedFix) {
        case 'fix-mock':
          fixed = fixMockProperty(sourceFile, error);
          break;
          
        case 'fix-typo':
          fixed = fixPropertyTypo(sourceFile, error);
          break;
          
        case 'add-interface':
          if (error.objectType && error.propertyName) {
            fixed = createInterface(sourceFile, error.objectType, error.propertyName);
          }
          break;
          
        case 'add-property':
          if (error.objectType && error.propertyName) {
            fixed = addPropertyToInterface(sourceFile, error.objectType, error.propertyName);
          }
          break;
      }
      
      if (fixed) {
        fixCount++;
      }
    } catch (error) {
      console.warn(`Failed to fix property error at line ${error.line}: ${error}`);
    }
  }
  
  return fixCount;
}

/**
 * Processes multiple files to fix property errors
 */
function fixPropertyErrorsInProject(
  errorsByFile: Record<string, PropertyError[]>,
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
      const fixedCount = fixPropertyErrorsInFile(sourceFile, fileErrors);
      
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
          console.log(`✅ Fixed ${fixedCount} property issues in ${filePath}`);
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

  // Get property-related errors
  const propertyErrors = trackingReport.detailedErrors.TS2339 || [];

  console.log(`Found ${propertyErrors.length} TS2339 (Property Does Not Exist) errors\n`);

  if (propertyErrors.length === 0) {
    console.log('No property errors to fix!');
    return;
  }

  // Analyze and categorize errors
  const analyzedErrors = propertyErrors.map(analyzePropertyError);
  
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
  const fixResult = fixPropertyErrorsInProject(errorsByFile, {
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
    join(__dirname, "fix-property-errors-report.json"),
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
  console.log("\n✅ Report saved to fix-property-errors-report.json");
  console.log('\n⚠️  Note: Some property errors may require manual type definitions.');
  console.log('   Run "npm run typecheck" to verify fixes.');
}

main().catch(console.error);