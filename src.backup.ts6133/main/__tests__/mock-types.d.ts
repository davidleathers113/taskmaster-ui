/**
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
