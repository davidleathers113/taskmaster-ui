/**
 * CI/CD Test Scenario 3: Incorrect Imports and Module Resolution Issues
 * This file contains various import errors that TypeScript should catch
 */

// Test 1: Importing non-existent modules
// ❌ ERROR: Cannot find module '@/non-existent-module'
import { something } from '@/non-existent-module';

// ❌ ERROR: Cannot find module '../../../../../../../deep/nested/wrong/path'
import { DeepNested } from '../../../../../../../deep/nested/wrong/path';

// Test 2: Incorrect import paths (wrong aliases)
// ❌ ERROR: Cannot find module '@wrong-alias/components/Task'
import { TaskComponent } from '@wrong-alias/components/Task';

// Test 3: Importing from files with wrong extensions
// ❌ ERROR: Cannot find module './helpers.js' (when allowImportingTsExtensions is true)
import { helper } from './helpers.js';

// Test 4: Circular dependency issues
// ❌ ERROR: This can cause issues with initialization order
import { CircularDep } from './circular-dep-a';

// Test 5: Missing type imports
// ❌ ERROR: 'Task' only refers to a type, but is being used as a value here
import { Task } from '@types/index';
const myTask = new Task(); // Task is an interface, not a class

// Test 6: Default vs named import mismatch
// ❌ ERROR: Module has no default export
import React from 'react'; // This is actually correct
import DefaultTask from '@types/index'; // This would fail if index.ts has no default export

// Test 7: Import side effects without proper declaration
// ❌ ERROR: Cannot find module './styles.css' or its corresponding type declarations
import './styles.css';

// Test 8: Importing internal node modules incorrectly
// ❌ ERROR: Cannot find module 'fs' (in browser/renderer context)
import * as fs from 'fs';

// Test 9: Case sensitivity issues (works on Windows, fails on Linux/Mac)
// ❌ ERROR: Cannot find module '@Components/TaskCard' (should be @components)
import { TaskCard } from '@Components/TaskCard';

// Test 10: Re-export issues
// ❌ ERROR: Module has no exported member 'NonExistentExport'
export { NonExistentExport } from '@components/index';

// Test 11: Dynamic imports with wrong paths
export async function loadDynamicModule() {
  // ❌ ERROR: Cannot find module './dynamic-non-existent'
  const module = await import('./dynamic-non-existent');
  return module;
}

// Test 12: Type-only imports used as values
import type { FilterOptions } from '@types/index';

export function useFilter() {
  // ❌ ERROR: 'FilterOptions' only refers to a type, but is being used as a value
  const defaultOptions = new FilterOptions();
  return defaultOptions;
}

// Test 13: Missing peer dependencies types
// ❌ ERROR: Cannot find module 'some-uninstalled-package' or its corresponding type declarations
import { SomeFeature } from 'some-uninstalled-package';

// Test 14: Importing from build artifacts that don't exist in dev
// ❌ ERROR: Cannot find module '../../../dist/utils'
import { distUtil } from '../../../dist/utils';

// Test 15: Electron context mismatch imports
// In renderer process, trying to import main process modules
// ❌ ERROR: Module not found (context isolation)
import { BrowserWindow } from 'electron';