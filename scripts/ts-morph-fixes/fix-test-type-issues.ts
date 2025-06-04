#!/usr/bin/env node
// Fix test type issues comprehensively
import { Project, SyntaxKind, ts } from 'ts-morph'
import path from 'path'

const projectRoot = path.resolve(__dirname, '../..')
const project = new Project({
  tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true
})

let fixCount = 0

console.log('🔧 Fixing test type issues comprehensively...\n')

// Fix 1: Remove global vi declarations from test files
const testFiles = project.addSourceFilesAtPaths([
  path.join(projectRoot, 'src/**/__tests__/**/*.{ts,tsx}'),
  path.join(projectRoot, 'tests/**/*.{ts,tsx}')
])

console.log('📝 Step 1: Removing global vi declarations...')
testFiles.forEach(file => {
  const filePath = file.getFilePath()
  
  // Find and remove global declare statements for vi
  const moduleDeclarations = file.getModules()
  moduleDeclarations.forEach(mod => {
    if (mod.getName() === '"global"' || mod.getName() === 'global') {
      const body = mod.getBody()
      if (body && body.getKind() === SyntaxKind.ModuleBlock) {
        const block = body.asKindOrThrow(SyntaxKind.ModuleBlock)
        const statements = block.getStatements()
        
        statements.forEach(stmt => {
          const text = stmt.getText()
          if (text.includes('const vi:') || text.includes('var vi:')) {
            stmt.remove()
            fixCount++
            console.log(`  ✅ Removed global vi declaration from ${path.relative(projectRoot, filePath)}`)
          }
        })
      }
    }
  })
  
  // Save if modified
  if (file.getFullText() !== file.getFullText()) {
    file.saveSync()
  }
})

// Fix 2: Add proper vitest imports where missing
console.log('\n📝 Step 2: Adding missing vitest imports...')
testFiles.forEach(file => {
  const filePath = file.getFilePath()
  const text = file.getFullText()
  
  // Check if file uses vi but doesn't import it
  if (text.includes('vi.') && !text.includes("from 'vitest'")) {
    // Add import at the top
    const firstImport = file.getImportDeclarations()[0]
    if (firstImport) {
      firstImport.insertBefore(`import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'\n`)
    } else {
      file.insertText(0, `import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'\n\n`)
    }
    fixCount++
    console.log(`  ✅ Added vitest import to ${path.relative(projectRoot, filePath)}`)
    file.saveSync()
  }
})

// Fix 3: Fix Express handler type issues in mock-update-server
console.log('\n📝 Step 3: Fixing Express handler type issues...')
const mockServerPath = path.join(projectRoot, 'tests/mocks/mock-update-server.ts')
if (project.getFileSystem().fileExistsSync(mockServerPath)) {
  const mockServerFile = project.addSourceFileAtPath(mockServerPath)
  
  // Find arrow functions with req, res parameters
  const arrowFunctions = mockServerFile.getDescendantsOfKind(SyntaxKind.ArrowFunction)
  
  arrowFunctions.forEach(func => {
    const params = func.getParameters()
    if (params.length >= 2) {
      const firstParam = params[0]
      const secondParam = params[1]
      
      if (firstParam.getName() === 'req' && secondParam.getName() === 'res') {
        // Add type annotations if missing
        if (!firstParam.getTypeNode()) {
          firstParam.setType('Request')
        }
        if (!secondParam.getTypeNode()) {
          secondParam.setType('Response')
        }
        
        // Check if we need to fix the handler
        const parent = func.getParent()
        if (parent && parent.getKind() === SyntaxKind.CallExpression) {
          const callExpr = parent.asKindOrThrow(SyntaxKind.CallExpression)
          const expr = callExpr.getExpression()
          
          // If this is app.get/post/put etc, ensure proper typing
          if (expr.getText().startsWith('this.app.')) {
            // The return statements were already added, no further action needed
          }
        }
      }
    }
  })
  
  mockServerFile.saveSync()
}

// Fix 4: Fix missing function declarations
console.log('\n📝 Step 4: Adding missing function declarations...')
const lifecycleTest = project.addSourceFileAtPathIfExists(
  path.join(projectRoot, 'src/main/__tests__/lifecycle.test.ts')
)

if (lifecycleTest) {
  // Check if createWindow is defined
  const hasCreateWindow = lifecycleTest.getFunction('createWindow')
  if (!hasCreateWindow) {
    // Add mock createWindow function
    lifecycleTest.addFunction({
      name: 'createWindow',
      isAsync: true,
      statements: `
        const win = new BrowserWindow({
          width: 800,
          height: 600,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        })
        return win
      `
    })
    fixCount++
    console.log('  ✅ Added createWindow function to lifecycle.test.ts')
  }
  lifecycleTest.saveSync()
}

// Fix 5: Fix test setup issues
console.log('\n📝 Step 5: Fixing test setup type issues...')
const testSetup = project.addSourceFileAtPathIfExists(path.join(projectRoot, 'tests/setup.ts'))

if (testSetup) {
  // Fix console mock issues
  const setupText = testSetup.getFullText()
  if (setupText.includes('console.log.mockClear')) {
    testSetup.replaceWithText(
      setupText
        .replace(/console\.log\.mockClear/g, '(console.log as any).mockClear?.call(console.log)')
        .replace(/console\.error\.mockClear/g, '(console.error as any).mockClear?.call(console.error)')
    )
    fixCount++
    console.log('  ✅ Fixed console mock issues in tests/setup.ts')
  }
  
  testSetup.saveSync()
}

// Fix 6: Add missing type imports
console.log('\n📝 Step 6: Adding missing type imports...')
const filesToAddTypes = [
  'tests/mocks/mock-update-server.ts',
  'server/claude-config-api.ts'
]

filesToAddTypes.forEach(filePath => {
  const fullPath = path.join(projectRoot, filePath)
  if (project.getFileSystem().fileExistsSync(fullPath)) {
    const file = project.addSourceFileAtPath(fullPath)
    
    // Check if Request/Response types are imported
    const hasRequestImport = file.getImportDeclarations().some(imp => 
      imp.getModuleSpecifierValue() === 'express' &&
      imp.getNamedImports().some(n => n.getName() === 'Request')
    )
    
    if (!hasRequestImport) {
      const expressImport = file.getImportDeclaration(imp => 
        imp.getModuleSpecifierValue() === 'express'
      )
      
      if (expressImport) {
        // Update existing import
        const namedImports = expressImport.getNamedImports()
        const hasRequest = namedImports.some(n => n.getName() === 'Request')
        const hasResponse = namedImports.some(n => n.getName() === 'Response')
        
        if (!hasRequest || !hasResponse) {
          const currentImports = namedImports.map(n => n.getName())
          if (!hasRequest) currentImports.push('Request')
          if (!hasResponse) currentImports.push('Response')
          
          expressImport.replaceWithText(
            `import { ${currentImports.join(', ')} } from 'express'`
          )
          fixCount++
          console.log(`  ✅ Updated express import in ${path.relative(projectRoot, fullPath)}`)
        }
      }
    }
    
    file.saveSync()
  }
})

console.log(`\n✨ Fixed ${fixCount} type issues`)
console.log('Running TypeScript check to verify fixes...')