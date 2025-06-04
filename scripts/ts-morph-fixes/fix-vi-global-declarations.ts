#!/usr/bin/env node
// Fix vi global declaration conflicts - remove redundant global vi declarations
import { Project, SyntaxKind, Node } from 'ts-morph'
import path from 'path'

const projectRoot = path.resolve(__dirname, '../..')
const project = new Project({
  tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true
})

let fixCount = 0

console.log('🔧 Fixing vi global declaration conflicts...\n')

// Get all test files
const testFiles = project.addSourceFilesAtPaths([
  path.join(projectRoot, 'src/**/__tests__/**/*.{ts,tsx}'),
  path.join(projectRoot, 'src/**/*.test.{ts,tsx}'),
  path.join(projectRoot, 'src/**/*.spec.{ts,tsx}')
])

testFiles.forEach(sourceFile => {
  const filePath = sourceFile.getFilePath()
  let hasChanges = false
  
  // Check if file imports vi from vitest
  const hasVitestImport = sourceFile.getImportDeclarations().some(imp => {
    return imp.getModuleSpecifierValue() === 'vitest' && 
           imp.getNamedImports().some(n => n.getName() === 'vi')
  })
  
  if (hasVitestImport) {
    console.log(`📄 Processing ${path.relative(projectRoot, filePath)}...`)
    
    // Find and remove global vi declarations
    const moduleDeclarations = sourceFile.getModules()
    
    moduleDeclarations.forEach(mod => {
      if (mod.getName() === 'global') {
        const body = mod.getBody()
        if (body && Node.isModuleBlock(body)) {
          const statements = body.getStatements()
          
          // Look for vi declarations to remove
          statements.forEach(stmt => {
            if (Node.isVariableStatement(stmt)) {
              const declarations = stmt.getDeclarations()
              declarations.forEach(decl => {
                if (decl.getName() === 'vi') {
                  stmt.remove()
                  hasChanges = true
                  fixCount++
                  console.log('  ✅ Removed global vi declaration')
                }
              })
            }
          })
        }
      }
    })
    
    // Also check for declare global blocks
    const declareGlobalBlocks = sourceFile.getDescendantsOfKind(SyntaxKind.ModuleDeclaration)
      .filter(mod => mod.getName() === 'global' && mod.hasModifier(SyntaxKind.DeclareKeyword))
    
    declareGlobalBlocks.forEach(globalBlock => {
      const body = globalBlock.getBody()
      if (body && Node.isModuleBlock(body)) {
        const statements = body.getStatements()
        
        statements.forEach(stmt => {
          const text = stmt.getText()
          // Remove lines that declare vi globally
          if (text.includes('const vi:') && text.includes('typeof import')) {
            stmt.remove()
            hasChanges = true
            fixCount++
            console.log('  ✅ Removed global vi type declaration')
          }
        })
      }
    })
    
    if (hasChanges) {
      sourceFile.saveSync()
    }
  }
})

console.log(`\n✨ Fixed ${fixCount} vi declaration conflicts`)
console.log('Running TypeScript check to verify...')