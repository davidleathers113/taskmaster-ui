#!/usr/bin/env node
// Fix TS7030 errors - Express handlers missing return statements
// This is a safe fix that won't affect runtime behavior

import { Project, SyntaxKind } from 'ts-morph'
import path from 'path'

const projectRoot = path.resolve(__dirname, '../..')
const project = new Project({
  tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true
})

// Target files with Express route handlers
const targetFiles = [
  'tests/mocks/mock-update-server.ts',
  'server/claude-config-api.ts',
  'server/claude-config-api.js'
]

let fixCount = 0

console.log('🔧 Fixing Express handler return statements (TS7030)...\n')

targetFiles.forEach(filePath => {
  const fullPath = path.join(projectRoot, filePath)
  
  try {
    // Skip if file doesn't exist
    if (!project.getFileSystem().fileExistsSync(fullPath)) {
      console.log(`⏭️  Skipping ${filePath} (file not found)`)
      return
    }
    
    const sourceFile = project.addSourceFileAtPath(fullPath)
    console.log(`📄 Processing ${filePath}...`)
    
    // Find arrow functions that are route handlers
    const arrowFunctions = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction)
    
    arrowFunctions.forEach(func => {
      // Check if this is likely a route handler (has req, res parameters)
      const params = func.getParameters()
      if (params.length >= 2) {
        const firstParam = params[0].getName()
        const secondParam = params[1].getName()
        
        if (firstParam === 'req' && secondParam === 'res') {
          // Check if function already returns something
          const body = func.getBody()
          
          if (body && body.getKind() === SyntaxKind.Block) {
            const block = body.asKindOrThrow(SyntaxKind.Block)
            const statements = block.getStatements()
            const lastStatement = statements[statements.length - 1]
            
            // Check if last statement is a return
            const hasReturn = lastStatement?.getKind() === SyntaxKind.ReturnStatement
            
            if (!hasReturn) {
              // Check if any res.send/json/status calls exist
              const resCallExists = block.getDescendantsOfKind(SyntaxKind.CallExpression)
                .some(call => {
                  const text = call.getText()
                  return text.includes('res.send') || 
                         text.includes('res.json') || 
                         text.includes('res.status') ||
                         text.includes('res.end')
                })
              
              if (resCallExists) {
                // Add return statement at the end
                block.addStatements('return')
                fixCount++
                console.log(`  ✅ Added return statement to handler at line ${func.getStartLineNumber()}`)
              }
            }
          }
        }
      }
    })
    
    // Also check regular function expressions
    const functionExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression)
    
    functionExpressions.forEach(func => {
      const params = func.getParameters()
      if (params.length >= 2) {
        const firstParam = params[0].getName()
        const secondParam = params[1].getName()
        
        if (firstParam === 'req' && secondParam === 'res') {
          const body = func.getBody()
          if (body) {
            const statements = body.getStatements()
            const lastStatement = statements[statements.length - 1]
            
            const hasReturn = lastStatement?.getKind() === SyntaxKind.ReturnStatement
            
            if (!hasReturn) {
              const resCallExists = body.getDescendantsOfKind(SyntaxKind.CallExpression)
                .some(call => {
                  const text = call.getText()
                  return text.includes('res.send') || 
                         text.includes('res.json') || 
                         text.includes('res.status') ||
                         text.includes('res.end')
                })
              
              if (resCallExists) {
                body.addStatements('return')
                fixCount++
                console.log(`  ✅ Added return statement to handler at line ${func.getStartLineNumber()}`)
              }
            }
          }
        }
      }
    })
    
    // Save the file if we made changes
    if (fixCount > 0) {
      sourceFile.saveSync()
    }
    
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error)
  }
})

console.log(`\n✨ Fixed ${fixCount} Express handlers with missing return statements`)
console.log('Run validation script to ensure no test regressions occurred.')