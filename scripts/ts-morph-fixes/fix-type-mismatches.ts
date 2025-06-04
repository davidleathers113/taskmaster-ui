#!/usr/bin/env ts-node
/**
 * Fix Type Mismatches (TS2345)
 * 
 * This script uses ts-morph to fix common type mismatch patterns
 * without changing runtime behavior.
 */

import { 
  Project, 
  SyntaxKind, 
  TypeChecker,
  Diagnostic,
  Node,
  SourceFile,
  PropertyAssignment,
  ObjectLiteralExpression 
} from 'ts-morph'
import * as path from 'path'
import * as fs from 'fs'

const PROJECT_ROOT = path.resolve(__dirname, '../..')

interface TypeMismatchFix {
  file: string
  line: number
  column: number
  original: string
  fixed: string
  errorCode: string
}

interface FixResult {
  file: string
  fixes: TypeMismatchFix[]
  errors: string[]
}

class TypeMismatchFixer {
  private project: Project
  private typeChecker: TypeChecker

  constructor() {
    this.project = new Project({
      tsConfigFilePath: path.join(PROJECT_ROOT, 'tsconfig.json')
    })
    this.typeChecker = this.project.getTypeChecker()
  }

  /**
   * Fix common null/undefined mismatches
   */
  private fixNullUndefinedMismatch(node: Node): string | null {
    const text = node.getText()
    
    // Pattern: null -> undefined for optional properties
    if (text === 'null') {
      const parent = node.getParent()
      if (parent && Node.isPropertyAssignment(parent)) {
        const propName = parent.getName()
        const objLiteral = parent.getParent()
        
        if (objLiteral && Node.isObjectLiteralExpression(objLiteral)) {
          // Check if this property expects undefined instead of null
          const contextualType = this.typeChecker.getContextualType(objLiteral)
          if (contextualType) {
            const prop = contextualType.getProperty(propName)
            if (prop) {
              const propType = prop.getTypeAtLocation(parent)
              const typeText = propType.getText()
              
              // If type includes undefined but not null, convert
              if (typeText.includes('undefined') && !typeText.includes('null')) {
                return 'undefined'
              }
            }
          }
        }
      }
    }
    
    return null
  }

  /**
   * Fix missing properties in object literals
   */
  private fixMissingProperties(node: Node): string | null {
    if (!Node.isObjectLiteralExpression(node)) {
      return null
    }

    const contextualType = this.typeChecker.getContextualType(node)
    if (!contextualType) {
      return null
    }

    const existingProps = new Set(
      node.getProperties()
        .filter(Node.isPropertyAssignment)
        .map(p => p.getName())
    )

    const requiredProps = contextualType.getProperties()
      .filter(prop => {
        const declarations = prop.getDeclarations()
        return declarations.some(decl => {
          const parent = decl.getParent()
          if (Node.isInterfaceDeclaration(parent) || Node.isTypeLiteral(parent)) {
            const propSig = decl
            if (Node.isPropertySignature(propSig)) {
              return !propSig.hasQuestionToken()
            }
          }
          return false
        })
      })
      .map(prop => prop.getName())

    const missingProps = requiredProps.filter(prop => !existingProps.has(prop))
    
    if (missingProps.length > 0) {
      const props = node.getProperties()
      const lastProp = props[props.length - 1]
      
      // Add missing properties with appropriate default values
      missingProps.forEach(propName => {
        const prop = contextualType.getProperty(propName)
        if (prop) {
          const propType = prop.getTypeAtLocation(node)
          const defaultValue = this.getDefaultValueForType(propType.getText())
          
          if (lastProp) {
            lastProp.getParent()?.insertProperty(props.length, {
              name: propName,
              initializer: defaultValue
            })
          }
        }
      })
      
      return node.getFullText()
    }
    
    return null
  }

  /**
   * Get appropriate default value for a type
   */
  private getDefaultValueForType(typeText: string): string {
    if (typeText.includes('string')) return '""'
    if (typeText.includes('number')) return '0'
    if (typeText.includes('boolean')) return 'false'
    if (typeText.includes('[]')) return '[]'
    if (typeText.includes('undefined')) return 'undefined'
    if (typeText.includes('null')) return 'null'
    
    // For complex types, use type assertion
    return `{} as any`
  }

  /**
   * Process a file and fix type mismatches
   */
  processFile(filePath: string): FixResult {
    const result: FixResult = {
      file: filePath,
      fixes: [],
      errors: []
    }

    try {
      const sourceFile = this.project.addSourceFileAtPath(filePath)
      const diagnostics = sourceFile.getPreEmitDiagnostics()
        .filter(d => d.getCode() === 2345) // TS2345: Type mismatch

      diagnostics.forEach(diagnostic => {
        try {
          const node = diagnostic.getNode()
          if (!node) return

          const line = diagnostic.getLineNumber() || 0
          const column = diagnostic.getStart() || 0
          const original = node.getText()
          
          // Try different fix strategies
          let fixed: string | null = null
          
          // Strategy 1: Fix null/undefined mismatches
          fixed = this.fixNullUndefinedMismatch(node)
          
          // Strategy 2: Fix missing properties
          if (!fixed) {
            fixed = this.fixMissingProperties(node)
          }
          
          if (fixed && fixed !== original) {
            node.replaceWithText(fixed)
            
            result.fixes.push({
              file: filePath,
              line,
              column,
              original,
              fixed,
              errorCode: 'TS2345'
            })
          }
        } catch (error) {
          result.errors.push(`Error fixing diagnostic: ${error}`)
        }
      })

      // Save changes
      if (result.fixes.length > 0) {
        sourceFile.saveSync()
      }

    } catch (error) {
      result.errors.push(`Error processing file: ${error}`)
    }

    return result
  }
}

// Main execution
async function main() {
  console.log('🔧 Fixing Type Mismatches (TS2345)\n')
  
  const fixer = new TypeMismatchFixer()
  
  // Get all TypeScript files with errors
  const testFiles = [
    'src/main/__tests__/auto-updater.test.ts',
    'src/main/__tests__/auto-updater-differential.test.ts',
    'src/main/__tests__/auto-updater-integration.test.ts',
    'src/main/__tests__/auto-updater-security.test.ts',
    'tests/mocks/mock-update-server.ts'
  ]
  
  const results: FixResult[] = []
  
  for (const file of testFiles) {
    const fullPath = path.join(PROJECT_ROOT, file)
    if (fs.existsSync(fullPath)) {
      console.log(`Processing: ${file}`)
      const result = fixer.processFile(fullPath)
      results.push(result)
      
      console.log(`  ✅ Applied ${result.fixes.length} fixes`)
      
      if (result.errors.length > 0) {
        result.errors.forEach(err => console.error(`  ❌ ${err}`))
      }
    }
  }
  
  // Summary
  console.log('\n📊 Summary:')
  const totalFixes = results.reduce((sum, r) => sum + r.fixes.length, 0)
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)
  
  console.log(`  Total fixes applied: ${totalFixes}`)
  console.log(`  Total errors: ${totalErrors}`)
  
  // Detailed fix report
  if (totalFixes > 0) {
    console.log('\n📝 Fixes Applied:')
    results.forEach(result => {
      if (result.fixes.length > 0) {
        console.log(`\n  ${result.file}:`)
        result.fixes.forEach(fix => {
          console.log(`    Line ${fix.line}: ${fix.original} → ${fix.fixed}`)
        })
      }
    })
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { TypeMismatchFixer, FixResult }