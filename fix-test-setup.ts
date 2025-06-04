#!/usr/bin/env node
/**
 * Fix Test Setup Files Using ts-morph
 * 
 * This script uses ts-morph to update test setup files
 * to use the new comprehensive Electron mocks
 */

import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const project = new Project({
  tsConfigFilePath: resolve(__dirname, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true
});

// Update main.setup.ts
function updateMainSetup() {
  const filePath = resolve(__dirname, 'tests/setup/main.setup.ts');
  const sourceFile = project.addSourceFileAtPath(filePath);
  
  // Remove old imports and add new ones
  const imports = sourceFile.getImportDeclarations();
  imports.forEach(imp => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    if (moduleSpecifier === 'vitest') {
      // Keep vitest import
    } else {
      imp.remove();
    }
  });
  
  // Add new imports at the top
  sourceFile.insertStatements(0, [
    `import { vi, beforeEach, afterEach, afterAll } from 'vitest';`,
    `import { 
  createElectronMock, 
  resetElectronMocks, 
  createMockBrowserWindow,
  mockScenarios 
} from '../mocks/electron';`,
    `import { TestWindowManager, ensureAllWindowsClosed } from '../utils/window-manager';`,
    `import { globalCleanup, registerDefaultCleanupHandlers } from '../utils/failsafe-cleanup';`
  ]);
  
  // Replace the mock setup with new implementation
  const mockSetupStart = sourceFile.getFirstDescendantByKind(SyntaxKind.VariableStatement);
  if (mockSetupStart) {
    const mockSetupEnd = sourceFile.getStatements().find(s => 
      s.getText().includes('vi.mock(\'electron\'')
    );
    
    if (mockSetupEnd) {
      const startPos = mockSetupStart.getPos();
      const endPos = mockSetupEnd.getEnd();
      
      sourceFile.replaceText([startPos, endPos], `
// Create Electron mock instance
const electronMock = createElectronMock();

// Mock electron module
vi.mock('electron', () => electronMock);

// Register default cleanup handlers
registerDefaultCleanupHandlers();

// Initialize test window manager
const windowManager = new TestWindowManager({
  defaultTimeout: 30000,
  maxWindows: 10,
  showWindows: false,
  enableLogging: process.env.DEBUG === 'true'
});

// Register window manager cleanup
globalCleanup.registerHandler('test-window-manager', async () => {
  await windowManager.destroyAllWindows();
}, { priority: 5, runOnce: false });
`);
    }
  }
  
  // Update beforeEach/afterEach hooks
  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const callExpr = node.asKindOrThrow(SyntaxKind.CallExpression);
      const expr = callExpr.getExpression();
      
      if (expr.getText() === 'beforeEach') {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          args[0].replaceWithText(`() => {
  // Reset all mocks
  resetElectronMocks(electronMock);
  
  // Clear window manager
  windowManager.destroyAllWindows();
  
  // Record memory usage
  memoryUsageBefore = process.memoryUsage();
}`);
        }
      }
      
      if (expr.getText() === 'afterEach') {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          args[0].replaceWithText(`async () => {
  // Clean up windows
  await windowManager.destroyAllWindows();
  await ensureAllWindowsClosed();
  
  // Check memory leaks
  const memoryUsageAfter = process.memoryUsage();
  const heapGrowth = memoryUsageAfter.heapUsed - memoryUsageBefore.heapUsed;
  
  if (heapGrowth > 10 * 1024 * 1024) {
    console.warn(\`Memory leak detected: \${Math.round(heapGrowth / 1024 / 1024)}MB\`);
  }
  
  // Reset mocks
  vi.clearAllMocks();
}`);
        }
      }
    }
  });
  
  // Add memory tracking variable
  sourceFile.insertStatements(sourceFile.getStatements().length - 10, 
    'let memoryUsageBefore: NodeJS.MemoryUsage;'
  );
  
  // Add exports at the end
  sourceFile.addExportDeclarations([
    { namedExports: ['electronMock', 'windowManager', 'mockScenarios'] }
  ]);
  
  sourceFile.saveSync();
  console.log('✅ Updated main.setup.ts');
}

// Update renderer.setup.ts
function updateRendererSetup() {
  const filePath = resolve(__dirname, 'tests/setup/renderer.setup.ts');
  const sourceFile = project.addSourceFileAtPath(filePath);
  
  // Update imports
  const imports = sourceFile.getImportDeclarations();
  const hasElectronMockImport = imports.some(imp => 
    imp.getModuleSpecifierValue().includes('mocks/electron')
  );
  
  if (!hasElectronMockImport) {
    sourceFile.insertStatements(2, 
      `import { createMockIpcRenderer } from '../mocks/electron';`
    );
  }
  
  // Replace mock setup
  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.VariableStatement) {
      const varStmt = node.asKindOrThrow(SyntaxKind.VariableStatement);
      const varDecl = varStmt.getDeclarations()[0];
      
      if (varDecl && varDecl.getName() === 'mockElectronAPI') {
        varStmt.replaceWithText(`
// Create IPC renderer mock
const ipcRendererMock = createMockIpcRenderer();

// Mock window.electron API
const mockElectronAPI = {
  ipcRenderer: ipcRendererMock,
  platform: 'darwin' as const,
  versions: {
    node: '18.0.0',
    chrome: '110.0.0',
    electron: '20.0.0'
  },
  // TaskMaster specific APIs
  tasks: {
    getTasks: vi.fn().mockResolvedValue([]),
    updateTask: vi.fn().mockResolvedValue({ success: true }),
    createTask: vi.fn().mockResolvedValue({ success: true, id: '1' }),
    deleteTask: vi.fn().mockResolvedValue({ success: true })
  },
  projects: {
    getProjects: vi.fn().mockResolvedValue([]),
    addProject: vi.fn().mockResolvedValue({ success: true }),
    removeProject: vi.fn().mockResolvedValue({ success: true })
  },
  claude: {
    getConfig: vi.fn().mockResolvedValue({}),
    updateConfig: vi.fn().mockResolvedValue({ success: true }),
    testConnection: vi.fn().mockResolvedValue({ success: true })
  }
};`);
      }
    }
  });
  
  // Update window setup
  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = node.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      if (propAccess.getText() === 'window.electronAPI') {
        const parent = propAccess.getParent();
        if (parent && parent.getKind() === SyntaxKind.CallExpression) {
          parent.replaceWithText(`
Object.defineProperty(window, 'electron', {
  value: mockElectronAPI,
  writable: true,
  configurable: true
});`);
        }
      }
    }
  });
  
  // Add exports
  if (!sourceFile.getExportDeclaration(d => 
    d.getNamedExports().some(e => e.getName() === 'ipcRendererMock')
  )) {
    sourceFile.addExportDeclarations([
      { namedExports: ['ipcRendererMock', 'mockElectronAPI'] }
    ]);
  }
  
  sourceFile.saveSync();
  console.log('✅ Updated renderer.setup.ts');
}

// Update preload.setup.ts
function updatePreloadSetup() {
  const filePath = resolve(__dirname, 'tests/setup/preload.setup.ts');
  const sourceFile = project.addSourceFileAtPath(filePath);
  
  // Update imports
  sourceFile.insertStatements(1, 
    `import { createMockIpcRenderer } from '../mocks/electron';`
  );
  
  // Replace IPC renderer mock
  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.VariableStatement) {
      const varStmt = node.asKindOrThrow(SyntaxKind.VariableStatement);
      const varDecl = varStmt.getDeclarations()[0];
      
      if (varDecl && varDecl.getName() === 'mockIpcRenderer') {
        varStmt.replaceWithText(`
// Create IPC renderer mock
const ipcRendererMock = createMockIpcRenderer();`);
      }
    }
  });
  
  // Update mock references
  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.Identifier && 
        node.getText() === 'mockIpcRenderer') {
      node.replaceWithText('ipcRendererMock');
    }
  });
  
  // Update exports
  const exportDecl = sourceFile.getExportDeclarations()[0];
  if (exportDecl) {
    exportDecl.replaceWithText(
      `export { mockContextBridge, ipcRendererMock };`
    );
  }
  
  sourceFile.saveSync();
  console.log('✅ Updated preload.setup.ts');
}

// Fix TypeScript errors in test files
async function fixTypeScriptErrors() {
  // Get all test files with errors
  const testFiles = project.addSourceFilesAtPaths([
    'src/**/__tests__/*.test.ts',
    'src/**/__tests__/*.test.tsx',
    'tests/**/*.test.ts'
  ]);
  
  let fixedCount = 0;
  
  for (const file of testFiles) {
    let hasChanges = false;
    
    // Fix TS2322: null assignments to CancellationToken
    file.forEachDescendant(node => {
      if (node.getKind() === SyntaxKind.BinaryExpression) {
        const binExpr = node.asKindOrThrow(SyntaxKind.BinaryExpression);
        const left = binExpr.getLeft();
        const right = binExpr.getRight();
        
        if (right.getText() === 'null' && 
            left.getText().includes('CancellationToken')) {
          right.replaceWithText('undefined');
          hasChanges = true;
        }
      }
    });
    
    // Fix TS2349: Non-callable expressions
    file.forEachDescendant(node => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const callExpr = node.asKindOrThrow(SyntaxKind.CallExpression);
        const expr = callExpr.getExpression();
        
        // Fix mock function calls
        if (expr.getText().includes('.mockReturnValue') &&
            callExpr.getParent()?.getKind() === SyntaxKind.CallExpression) {
          const parent = callExpr.getParent() as any;
          parent.replaceWithText(
            `(${expr.getText().replace('.mockReturnValue', '')} as jest.Mock).mockReturnValue${callExpr.getArguments()[0].getText()}()`
          );
          hasChanges = true;
        }
      }
    });
    
    // Fix TS6133: Unused variables
    file.forEachDescendant(node => {
      if (node.getKind() === SyntaxKind.Parameter) {
        const param = node.asKindOrThrow(SyntaxKind.Parameter);
        const name = param.getName();
        
        if (name && !param.getText().startsWith('_')) {
          const isUsed = param.findReferencesAsNodes().length > 1;
          if (!isUsed) {
            param.replaceWithText(`_${name}`);
            hasChanges = true;
          }
        }
      }
    });
    
    // Fix TS7017: globalThis index signature
    file.forEachDescendant(node => {
      if (node.getKind() === SyntaxKind.ElementAccessExpression) {
        const elemAccess = node.asKindOrThrow(SyntaxKind.ElementAccessExpression);
        const expr = elemAccess.getExpression();
        
        if (expr.getText() === 'globalThis') {
          elemAccess.replaceWithText(
            `(globalThis as any)[${elemAccess.getArgumentExpression()?.getText()}]`
          );
          hasChanges = true;
        }
      }
    });
    
    if (hasChanges) {
      await file.save();
      fixedCount++;
    }
  }
  
  console.log(`✅ Fixed TypeScript errors in ${fixedCount} test files`);
}

// Main execution
async function main() {
  console.log('🔧 Fixing test setup files with ts-morph...\n');
  
  try {
    updateMainSetup();
    updateRendererSetup();
    updatePreloadSetup();
    await fixTypeScriptErrors();
    
    console.log('\n✨ All test setup files updated successfully!');
  } catch (error) {
    console.error('❌ Error updating test files:', error);
    process.exit(1);
  }
}

main();