import { contextBridge, ipcRenderer } from 'electron';

// ============================================
// 🔍 PRELOAD SCRIPT DEBUG LOGGING - 2025 🔍
// ============================================
const PRELOAD_DEBUG = true;
const DEBUG_PREFIX = '🔌 [PRELOAD DEBUG]';
const SUCCESS_PREFIX = '✅ [PRELOAD SUCCESS]';
const ERROR_PREFIX = '❌ [PRELOAD ERROR]';

const preloadLog = (message: string, data?: any) => {
  if (!PRELOAD_DEBUG) return;
  console.log(`${DEBUG_PREFIX} ${message}`);
  if (data) {
    console.log('  📊 Data:', data);
  }
};

console.log('\n' + '='.repeat(60));
console.log('🔌 TASKMASTER PRELOAD SCRIPT INITIALIZING 🔌');
console.log('='.repeat(60));

preloadLog('Environment', {
  contextIsolation: true,
  nodeIntegration: false,
  processType: process.type,
  sandboxed: process.sandboxed,
  contextId: (process as any).contextId,
  isMainFrame: (process as any).isMainFrame,
});

// 2025 Security Best Practices - Secure Preload Script
// This preload script uses contextBridge to safely expose APIs to the renderer process
// while maintaining context isolation and preventing privilege escalation attacks

// Define the API interface that will be exposed to the renderer process
interface ElectronAPI {
  // App information
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  getAppDataPath: () => Promise<string>;
  
  // File system operations (limited and secure)
  getDocumentsPath: () => Promise<string>;
  
  // Dialog operations
  showError: (title: string, content: string) => Promise<void>;
  
  // Auto-updater events
  onDownloadProgress: (callback: (progress: any) => void) => void;
  removeDownloadProgressListener: () => void;
  
  // Development utilities
  isDev: boolean;
  
  // Testing utilities (available in test environment)
  invoke?: any;
  on?: any;
  off?: any;
}

// Security: Input validation and sanitization
const sanitizeString = (input: any): string => {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  // Basic sanitization - remove potentially dangerous characters
  return input.replace(/[<>]/g, '').trim();
};

// Security: Rate limiting for IPC calls
class RateLimiter {
  private calls: Map<string, number[]> = new Map();
  private readonly maxCalls = 10;
  private readonly timeWindow = 1000; // 1 second

  public canMakeCall(key: string): boolean {
    const now = Date.now();
    const callTimes = this.calls.get(key) || [];
    
    // Remove calls outside the time window
    const recentCalls = callTimes.filter(time => now - time < this.timeWindow);
    
    if (recentCalls.length >= this.maxCalls) {
      return false;
    }
    
    recentCalls.push(now);
    this.calls.set(key, recentCalls);
    return true;
  }
}

const rateLimiter = new RateLimiter();

// Security: Wrapped IPC invoke with rate limiting and error handling
const secureIpcInvoke = async (channel: string, ...args: any[]): Promise<any> => {
  if (!rateLimiter.canMakeCall(channel)) {
    throw new Error(`Rate limit exceeded for ${channel}`);
  }
  
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    console.error(`IPC call failed for ${channel}:`, error);
    throw error;
  }
};

// Store auto-updater callback for cleanup
let downloadProgressCallback: ((event: any, progress: any) => void) | null = null;

// Define the secure API that will be exposed to the renderer
const electronAPI: ElectronAPI = {
  // App information APIs
  getVersion: () => secureIpcInvoke('app:get-version'),
  
  getPlatform: () => secureIpcInvoke('app:get-platform'),
  
  getAppDataPath: () => secureIpcInvoke('app:get-app-data-path'),
  
  // File system APIs (limited to safe operations)
  getDocumentsPath: () => secureIpcInvoke('fs:get-documents-path'),
  
  // Dialog APIs with input validation
  showError: async (title: string, content: string) => {
    const sanitizedTitle = sanitizeString(title);
    const sanitizedContent = sanitizeString(content);
    return secureIpcInvoke('dialog:show-error', sanitizedTitle, sanitizedContent);
  },
  
  // Auto-updater APIs
  onDownloadProgress: (callback: (progress: any) => void) => {
    // Security: Remove any existing listener first
    if (downloadProgressCallback) {
      ipcRenderer.removeListener('download-progress', downloadProgressCallback);
    }
    
    // Create new listener with validation
    downloadProgressCallback = (_event: any, progress: any) => {
      // Security: Validate progress object structure
      if (progress && typeof progress === 'object' && 
          typeof progress.percent === 'number' && 
          typeof progress.transferred === 'number' && 
          typeof progress.total === 'number') {
        callback(progress);
      }
    };
    
    ipcRenderer.on('download-progress', downloadProgressCallback);
  },
  
  removeDownloadProgressListener: () => {
    if (downloadProgressCallback) {
      ipcRenderer.removeListener('download-progress', downloadProgressCallback);
      downloadProgressCallback = null;
    }
  },
  
  // Development flag
  isDev: process.env.NODE_ENV === 'development'
};

// Security: Expose the API through contextBridge
// This is the only way the renderer process can access Electron APIs
// and it maintains complete context isolation
try {
  preloadLog('Attempting to expose electronAPI via contextBridge...');
  
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  
  console.log(`${SUCCESS_PREFIX} electronAPI successfully exposed to renderer!`);
  preloadLog('Exposed API methods', Object.keys(electronAPI));
  
  // Test that the API was exposed correctly
  if (typeof window !== 'undefined') {
    // We're in the preload context, window exists but electronAPI won't be visible here
    preloadLog('Window object exists in preload context');
  }
  
} catch (error) {
  console.error(`${ERROR_PREFIX} Failed to expose electronAPI via contextBridge!`);
  console.error('Error details:', error);
  console.error('Stack trace:', (error as Error).stack);
}

// Security: Additional type safety for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Security: Log preload script initialization (only in development)
if (process.env.NODE_ENV === 'development' || PRELOAD_DEBUG) {
  console.log(`${SUCCESS_PREFIX} TaskMaster preload script initialized with secure contextBridge API`);
  console.log('📋 Available API methods:', Object.keys(electronAPI).join(', '));
}

// Security: Prevent any direct access to Node.js or Electron modules
// The contextBridge is the only authorized communication channel
// Context isolation ensures the renderer cannot access:
// - require() function
// - process object
// - Buffer global
// - Any Node.js built-in modules
// - Direct Electron module access

// Security: Clean up on window unload
window.addEventListener('beforeunload', () => {
  if (downloadProgressCallback) {
    ipcRenderer.removeListener('download-progress', downloadProgressCallback);
  }
});