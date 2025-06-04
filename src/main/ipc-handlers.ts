/**
 * IPC Handlers for Electron Main Process
 * 
 * This module provides centralized IPC handler management including
 * setup, cleanup, and security validation.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';

export interface IPCHandler {
  channel: string;
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any;
  isSetup: boolean;
  setupTime?: number;
}

export interface IPCHandlerOptions {
  validateOrigin?: boolean;
  requireSecureContext?: boolean;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

class IPCHandlerManager {
  private static instance: IPCHandlerManager;
  private handlers = new Map<string, IPCHandler>();
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  private constructor() {}

  public static getInstance(): IPCHandlerManager {
    if (!IPCHandlerManager.instance) {
      IPCHandlerManager.instance = new IPCHandlerManager();
    }
    return IPCHandlerManager.instance;
  }

  public setupHandler(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any,
    options: IPCHandlerOptions = {}
  ): void {
    if (this.handlers.has(channel)) {
      console.warn(`IPC handler for channel '${channel}' is already setup`);
      return;
    }

    const wrappedHandler = this.wrapHandler(handler, options);
    
    ipcMain.handle(channel, wrappedHandler);
    
    this.handlers.set(channel, {
      channel,
      handler: wrappedHandler,
      isSetup: true,
      setupTime: Date.now(),
    });
  }

  public removeHandler(channel: string): boolean {
    const handler = this.handlers.get(channel);
    if (!handler) {
      return false;
    }

    ipcMain.removeHandler(channel);
    this.handlers.delete(channel);
    return true;
  }

  public getHandler(channel: string): IPCHandler | undefined {
    return this.handlers.get(channel);
  }

  public getAllHandlers(): IPCHandler[] {
    return Array.from(this.handlers.values());
  }

  public getHandlerCount(): number {
    return this.handlers.size;
  }

  public clearAllHandlers(): void {
    for (const channel of this.handlers.keys()) {
      this.removeHandler(channel);
    }
  }

  private wrapHandler(
    originalHandler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any,
    options: IPCHandlerOptions
  ) {
    return async (event: IpcMainInvokeEvent, ...args: any[]): Promise<any> => {
      try {
        // Rate limiting
        if (options.rateLimit) {
          const isAllowed = this.checkRateLimit(event.sender.id.toString(), options.rateLimit);
          if (!isAllowed) {
            throw new Error('Rate limit exceeded');
          }
        }

        // Origin validation
        if (options.validateOrigin) {
          const isValidOrigin = this.validateOrigin(event);
          if (!isValidOrigin) {
            throw new Error('Invalid origin');
          }
        }

        // Secure context validation
        if (options.requireSecureContext) {
          const isSecure = this.validateSecureContext(event);
          if (!isSecure) {
            throw new Error('Secure context required');
          }
        }

        return await originalHandler(event, ...args);
      } catch (error) {
        console.error('IPC handler error:', error);
        throw error;
      }
    };
  }

  private checkRateLimit(
    clientId: string,
    rateLimit: { maxRequests: number; windowMs: number }
  ): boolean {
    const now = Date.now();
    const clientData = this.rateLimitStore.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      this.rateLimitStore.set(clientId, {
        count: 1,
        resetTime: now + rateLimit.windowMs,
      });
      return true;
    }

    if (clientData.count >= rateLimit.maxRequests) {
      return false;
    }

    clientData.count++;
    return true;
  }

  private validateOrigin(event: IpcMainInvokeEvent): boolean {
    // In a real application, you would validate against allowed origins
    // For now, we'll allow all origins from the same protocol
    const senderFrame = event.senderFrame;
    return senderFrame.url.startsWith('file://') || senderFrame.url.startsWith('http://localhost');
  }

  private validateSecureContext(event: IpcMainInvokeEvent): boolean {
    // Check if the sender is in a secure context
    const senderFrame = event.senderFrame;
    return senderFrame.url.startsWith('https://') || senderFrame.url.startsWith('file://');
  }
}

// Default handlers
const defaultHandlers = {
  'app:get-version': async () => {
    const { app } = await import('electron');
    return app.getVersion();
  },
  
  'app:get-name': async () => {
    const { app } = await import('electron');
    return app.getName();
  },

  'app:get-path': async (event: IpcMainInvokeEvent, name: string) => {
    const { app } = await import('electron');
    return app.getPath(name as any);
  },

  'window:minimize': async (event: IpcMainInvokeEvent) => {
    const window = event.sender.getOwnerBrowserWindow();
    window?.minimize();
  },

  'window:maximize': async (event: IpcMainInvokeEvent) => {
    const window = event.sender.getOwnerBrowserWindow();
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  },

  'window:close': async (event: IpcMainInvokeEvent) => {
    const window = event.sender.getOwnerBrowserWindow();
    window?.close();
  },
};

// Export singleton instance functions
const handlerManager = IPCHandlerManager.getInstance();

export function setupIpcHandlers(): void {
  // Setup default handlers
  for (const [channel, handler] of Object.entries(defaultHandlers)) {
    handlerManager.setupHandler(channel, handler, {
      validateOrigin: true,
      rateLimit: { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
    });
  }
}

export function cleanupIpcHandlers(): void {
  handlerManager.clearAllHandlers();
}

export function setupHandler(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any,
  options?: IPCHandlerOptions
): void {
  handlerManager.setupHandler(channel, handler, options);
}

export function removeHandler(channel: string): boolean {
  return handlerManager.removeHandler(channel);
}

export function getHandler(channel: string): IPCHandler | undefined {
  return handlerManager.getHandler(channel);
}

export function getAllHandlers(): IPCHandler[] {
  return handlerManager.getAllHandlers();
}

export function getHandlerCount(): number {
  return handlerManager.getHandlerCount();
}

export { IPCHandlerManager };
export default handlerManager;