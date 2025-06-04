#!/usr/bin/env node
// Fix TS2451 errors - vi redeclaration issues
// This removes duplicate imports and declarations

import { Project, SyntaxKind } from 'ts-morph'
import path from 'path'
import { existsSync } from 'fs'

const projectRoot = path.resolve(__dirname, '../..')
const project = new Project({
  tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true
})

// Find all test files
const testFilePatterns = [
  'src/**/__tests__/**/*.ts',
  'src/**/__tests__/**/*.tsx',
  'tests/**/*.ts',
  'tests/**/*.tsx'
]

let fixCount = 0
const processedFiles: string[] = []

console.log('🔧 Fixing vi redeclaration issues (TS2451)...\n')

// Process test files
testFilePatterns.forEach(pattern => {
  const files = project.addSourceFilesAtPaths(path.join(projectRoot, pattern))
  
  files.forEach(sourceFile => {
    const filePath = sourceFile.getFilePath()
    if (processedFiles.includes(filePath)) return
    processedFiles.push(filePath)
    
    console.log(`📄 Processing ${path.relative(projectRoot, filePath)}...`)
    
    let hasChanges = false
    
    // Find all import declarations
    const importDeclarations = sourceFile.getImportDeclarations()
    const vitestImports = importDeclarations.filter(imp => 
      imp.getModuleSpecifierValue() === 'vitest'
    )
    
    // Remove duplicate vitest imports
    if (vitestImports.length > 1) {
      // Keep the first comprehensive import, remove others
      const firstImport = vitestImports[0]
      const namedImports = new Set<string>()
      
      vitestImports.forEach(imp => {
        imp.getNamedImports().forEach(named => {
          namedImports.add(named.getName())
        })
      })
      
      // Update first import with all named imports
      if (namedImports.size > 0) {
        firstImport.replaceWithText(
          `import { ${Array.from(namedImports).join(', ')} } from 'vitest'`
        )
      }
      
      // Remove other imports
      for (let i = 1; i < vitestImports.length; i++) {
        vitestImports[i].remove()
        fixCount++
        hasChanges = true
        console.log(`  ✅ Removed duplicate vitest import`)
      }
    }
    
    // Check for global vi declarations
    const variableStatements = sourceFile.getVariableStatements()
    const viDeclarations = variableStatements.filter(stmt => {
      const declarations = stmt.getDeclarations()
      return declarations.some(decl => decl.getName() === 'vi')
    })
    
    // Remove global vi declarations if we have vitest import
    if (vitestImports.length > 0 && viDeclarations.length > 0) {
      viDeclarations.forEach(decl => {
        decl.remove()
        fixCount++
        hasChanges = true
        console.log(`  ✅ Removed global vi declaration`)
      })
    }
    
    // Check for duplicate function declarations
    const functionDeclarations = sourceFile.getFunctions()
    const functionNames = new Map<string, any[]>()
    
    functionDeclarations.forEach(func => {
      const name = func.getName()
      if (name) {
        if (!functionNames.has(name)) {
          functionNames.set(name, [])
        }
        functionNames.get(name)!.push(func)
      }
    })
    
    // Remove duplicate function declarations
    functionNames.forEach((funcs, name) => {
      if (funcs.length > 1) {
        // Keep the first one, remove others
        for (let i = 1; i < funcs.length; i++) {
          funcs[i].remove()
          fixCount++
          hasChanges = true
          console.log(`  ✅ Removed duplicate function '${name}'`)
        }
      }
    })
    
    // Check for duplicate const declarations
    const varDeclarations = sourceFile.getVariableDeclarations()
    const varNames = new Map<string, any[]>()
    
    varDeclarations.forEach(varDecl => {
      const name = varDecl.getName()
      if (!varNames.has(name)) {
        varNames.set(name, [])
      }
      varNames.get(name)!.push(varDecl)
    })
    
    // Remove duplicate variable declarations
    varNames.forEach((vars, name) => {
      if (vars.length > 1 && name !== 'vi') { // vi handled above
        // Keep the first one, remove others
        for (let i = 1; i < vars.length; i++) {
          const statement = vars[i].getVariableStatement()
          if (statement) {
            statement.remove()
            fixCount++
            hasChanges = true
            console.log(`  ✅ Removed duplicate variable '${name}'`)
          }
        }
      }
    })
    
    // Save if we made changes
    if (hasChanges) {
      sourceFile.saveSync()
    }
  })
})

console.log(`\n✨ Fixed ${fixCount} redeclaration issues`)
console.log('Run validation script to ensure no test regressions occurred.')