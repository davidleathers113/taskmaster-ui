/**
 * Window Manager for Electron Main Process
 * 
 * This module provides centralized window management functionality
 * including creation, destruction, and lifecycle management.
 */

import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { join } from 'path';

export interface WindowConfig extends BrowserWindowConstructorOptions {
  id?: string;
  isDevelopment?: boolean;
  preloadScript?: string;
}

export interface ManagedWindow {
  id: string;
  window: BrowserWindow;
  config: WindowConfig;
  createdAt: number;
}

class WindowManager {
  private static instance: WindowManager;
  private windows = new Map<string, ManagedWindow>();
  private windowCounter = 0;

  private constructor() {}

  public static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  public createWindow(config: WindowConfig): BrowserWindow {
    const windowId = config.id || `window-${++this.windowCounter}`;
    
    const defaultConfig: BrowserWindowConstructorOptions = {
      width: 1200,
      height: 800,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: config.preloadScript || join(__dirname, '../preload/preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    };

    const finalConfig = { ...defaultConfig, ...config };
    const window = new BrowserWindow(finalConfig);

    const managedWindow: ManagedWindow = {
      id: windowId,
      window,
      config,
      createdAt: Date.now(),
    };

    this.windows.set(windowId, managedWindow);
    this.setupWindowListeners(managedWindow);

    return window;
  }

  public destroyWindow(windowId: string): boolean {
    const managedWindow = this.windows.get(windowId);
    if (!managedWindow) {
      return false;
    }

    if (!managedWindow.window.isDestroyed()) {
      managedWindow.window.destroy();
    }

    this.windows.delete(windowId);
    return true;
  }

  public getWindow(windowId: string): BrowserWindow | null {
    const managedWindow = this.windows.get(windowId);
    return managedWindow ? managedWindow.window : null;
  }

  public getAllWindows(): ManagedWindow[] {
    return Array.from(this.windows.values());
  }

  public getWindowCount(): number {
    return this.windows.size;
  }

  public findWindowById(id: string): ManagedWindow | null {
    return this.windows.get(id) || null;
  }

  public findWindowByBrowserWindow(browserWindow: BrowserWindow): ManagedWindow | null {
    for (const managedWindow of this.windows.values()) {
      if (managedWindow.window === browserWindow) {
        return managedWindow;
      }
    }
    return null;
  }

  public closeAllWindows(): void {
    const windowIds = Array.from(this.windows.keys());
    windowIds.forEach(id => this.destroyWindow(id));
  }

  private setupWindowListeners(managedWindow: ManagedWindow): void {
    const { window, id } = managedWindow;

    window.once('ready-to-show', () => {
      window.show();
    });

    window.on('closed', () => {
      this.windows.delete(id);
    });

    window.on('unresponsive', () => {
      console.warn(`Window ${id} became unresponsive`);
    });

    window.on('responsive', () => {
      console.log(`Window ${id} became responsive again`);
    });
  }
}

// Export singleton instance functions
const windowManager = WindowManager.getInstance();

export function createWindow(config: WindowConfig = {}): BrowserWindow {
  return windowManager.createWindow(config);
}

export function destroyWindow(windowId: string): boolean {
  return windowManager.destroyWindow(windowId);
}

export function getWindow(windowId: string): BrowserWindow | null {
  return windowManager.getWindow(windowId);
}

export function getAllWindows(): ManagedWindow[] {
  return windowManager.getAllWindows();
}

export function getWindowCount(): number {
  return windowManager.getWindowCount();
}

export function closeAllWindows(): void {
  windowManager.closeAllWindows();
}

export { WindowManager };
export default windowManager;