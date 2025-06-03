#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create type definitions for mocked electron modules
const mockTypesContent = `/**
 * Mock Types for Electron Testing (2025)
 * 
 * Type definitions for mocked Electron modules to fix TS2339 errors
 * in test files. These extend the actual types with mock methods.
 */

import { Mock } from 'vitest';
import type { 
  AppUpdater, 
  UpdateCheckResult, 
  UpdateInfo,
  AppUpdaterEvents,
  CancellationToken
} from 'electron-updater';
import type { App, BrowserWindow } from 'electron';

// Extend UpdateInfo with test-specific properties
export interface MockUpdateInfo extends UpdateInfo {
  size?: number;
  minimumVersion?: string;
}

// Mock function types
export type MockedFunction<T extends (...args: any[]) => any> = Mock<T> & T;

// Extended AutoUpdater type with mock methods
export interface MockAutoUpdater extends AppUpdater {
  checkForUpdates: MockedFunction<() => Promise<UpdateCheckResult | null>>;
  checkForUpdatesAndNotify: MockedFunction<() => Promise<UpdateCheckResult | undefined>>;
  downloadUpdate: MockedFunction<(cancellationToken?: CancellationToken) => Promise<string[]>>;
  quitAndInstall: MockedFunction<(isSilent?: boolean, isForceRunAfter?: boolean) => void>;
  
  // Event methods with mock properties
  on: MockedFunction<<U extends keyof AppUpdaterEvents>(
    event: U,
    listener: AppUpdaterEvents[U]
  ) => AppUpdater>;
  
  once: MockedFunction<<U extends keyof AppUpdaterEvents>(
    event: U,
    listener: AppUpdaterEvents[U]
  ) => AppUpdater>;
  
  emit: MockedFunction<(event: string, ...args: any[]) => boolean>;
  removeListener: MockedFunction<(event: string, listener: (...args: any[]) => void) => AppUpdater>;
  removeAllListeners: MockedFunction<(event?: string) => AppUpdater>;
  
  // Configuration methods
  setFeedURL: MockedFunction<(options: any) => void>;
  getFeedURL: MockedFunction<() => string>;
  
  // Logger property that can be null
  logger: {
    transports: {
      file: { level: string };
      console: { level: string };
    };
    info: MockedFunction<(...args: any[]) => void>;
    warn: MockedFunction<(...args: any[]) => void>;
    error: MockedFunction<(...args: any[]) => void>;
  } | null;
}

// Extended App type with mock methods
export interface MockApp extends App {
  getVersion: MockedFunction<() => string>;
  getPath: MockedFunction<(name: string) => string>;
  quit: MockedFunction<() => void>;
  relaunch: MockedFunction<(options?: any) => void>;
  
  // Event methods with mock properties
  on: MockedFunction<(event: string, listener: Function) => App>;
  once: MockedFunction<(event: string, listener: Function) => App>;
}

// Extended BrowserWindow type
export interface MockBrowserWindow {
  getAllWindows: MockedFunction<() => BrowserWindow[]>;
  getFocusedWindow: MockedFunction<() => BrowserWindow | null>;
}

// Helper to cast autoUpdater to MockAutoUpdater in tests
export function asMockAutoUpdater(updater: any): MockAutoUpdater {
  return updater as MockAutoUpdater;
}

// Helper to cast app to MockApp in tests  
export function asMockApp(app: any): MockApp {
  return app as MockApp;
}

// Declare global mock types
declare global {
  const mockAutoUpdater: MockAutoUpdater;
  const mockApp: MockApp;
}
`;

// Write the mock types file
const mockTypesPath = path.join(process.cwd(), 'src/main/__tests__/mock-types.d.ts');
fs.writeFileSync(mockTypesPath, mockTypesContent);
console.log('Created mock-types.d.ts');

// Create a script to add type imports to test files
const testFiles = [
  'src/main/__tests__/auto-updater.test.ts',
  'src/main/__tests__/auto-updater-differential.test.ts',
  'src/main/__tests__/auto-updater-integration.test.ts',
  'src/main/__tests__/auto-updater-security.test.ts'
];

testFiles.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Add import at the top after other imports
    if (!content.includes('./mock-types')) {
      const importStatement = "import type { MockAutoUpdater, asMockAutoUpdater } from './mock-types'\n";
      
      // Find the last import statement
      const importRegex = /^import .* from .*/gm;
      let lastImportMatch = null;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        lastImportMatch = match;
      }
      
      if (lastImportMatch) {
        const insertPosition = lastImportMatch.index + lastImportMatch[0].length;
        content = content.slice(0, insertPosition) + '\n' + importStatement + content.slice(insertPosition);
      }
    }
    
    // Replace autoUpdater usage with typed version
    content = content.replace(
      /(\s+)(autoUpdater\.)([a-zA-Z]+)\.mock/g,
      '$1(autoUpdater as MockAutoUpdater).$3.mock'
    );
    
    // Handle logger null checks
    content = content.replace(
      /autoUpdater\.logger\./g,
      'autoUpdater.logger?.'
    );
    
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${filePath}`);
  }
});

// Also fix the UpdateInfo type issues
const fixUpdateInfo = `
// Add these lines after imports in files that use UpdateInfo:
// import type { MockUpdateInfo } from './mock-types'
// Then cast updateInfo to MockUpdateInfo when accessing size or minimumVersion
`;

console.log('\nAdditional manual fixes needed:');
console.log(fixUpdateInfo);

console.log('\nMock type fixes applied! Run "npm run typecheck" to verify.');