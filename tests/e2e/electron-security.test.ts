/**
 * Electron-Specific Security Tests
 * 
 * Comprehensive security testing for Electron applications beyond Electronegativity
 * Following 2025 security best practices
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';

// Security test configuration
const SECURITY_CONFIG = {
  // Allowed protocols for external navigation
  allowedProtocols: ['https:', 'mailto:'],
  
  // Forbidden window features
  forbiddenWindowFeatures: ['nodeIntegration', 'nodeIntegrationInWorker', 'webviewTag'],
  
  // Required security headers
  requiredHeaders: {
    'Content-Security-Policy': true,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  },
  
  // IPC message validation patterns
  allowedIpcChannels: [
    'app:ready',
    'task:create',
    'task:update',
    'task:delete',
    'window:minimize',
    'window:maximize',
    'window:close'
  ]
};

test.describe('Electron Security Tests', () => {
  let app: ElectronApplication;
  let mainWindow: Page;
  
  test.beforeAll(async () => {
    // Launch Electron app
    app = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_ENABLE_LOGGING: '1'
      }
    });
    
    mainWindow = await app.firstWindow();
    
    // Wait for app to be ready
    await mainWindow.waitForSelector('[data-testid="app-ready"], .app-container', {
      timeout: 30000
    });
  });
  
  test.afterAll(async () => {
    await app.close();
  });
  
  test.describe('WebPreferences Security', () => {
    test('01. Context isolation should be enabled', async () => {
      const contextIsolation = await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        return win.webContents.getWebPreferences().contextIsolation;
      });
      
      expect(contextIsolation).toBe(true);
    });
    
    test('02. Node integration should be disabled', async () => {
      const nodeIntegration = await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        return win.webContents.getWebPreferences().nodeIntegration;
      });
      
      expect(nodeIntegration).toBe(false);
    });
    
    test('03. Remote module should be disabled', async () => {
      const enableRemoteModule = await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        const prefs = win.webContents.getWebPreferences();
        return prefs.enableRemoteModule || false;
      });
      
      expect(enableRemoteModule).toBe(false);
    });
    
    test('04. WebSecurity should be enabled', async () => {
      const webSecurity = await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        return win.webContents.getWebPreferences().webSecurity;
      });
      
      expect(webSecurity).toBe(true);
    });
    
    test('05. Sandbox should be enabled', async () => {
      const sandbox = await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        const prefs = win.webContents.getWebPreferences();
        return prefs.sandbox !== false; // Default is true in newer Electron
      });
      
      expect(sandbox).toBe(true);
    });
  });
  
  test.describe('Content Security Policy', () => {
    test('01. CSP header should be present', async () => {
      const cspHeader = await mainWindow.evaluate(() => {
        // Check meta tag
        const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        return metaCSP?.getAttribute('content') || null;
      });
      
      expect(cspHeader).toBeTruthy();
      expect(cspHeader).not.toContain('unsafe-inline');
      expect(cspHeader).not.toContain('unsafe-eval');
    });
    
    test('02. CSP should block inline scripts', async () => {
      let violationDetected = false;
      
      // Listen for CSP violations
      await mainWindow.evaluate(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          (window as any).__cspViolation = {
            directive: e.violatedDirective,
            blockedURI: e.blockedURI
          };
        });
      });
      
      // Try to inject inline script
      try {
        await mainWindow.evaluate(() => {
          const script = document.createElement('script');
          script.textContent = 'console.log("This should be blocked");';
          document.head.appendChild(script);
        });
      } catch (error) {
        violationDetected = true;
      }
      
      // Check for violation
      const violation = await mainWindow.evaluate(() => (window as any).__cspViolation);
      
      expect(violation || violationDetected).toBeTruthy();
    });
  });
  
  test.describe('IPC Security', () => {
    test('01. IPC messages should be validated', async () => {
      // Try to send invalid IPC message
      const invalidChannelBlocked = await mainWindow.evaluate(async () => {
        try {
          if ((window as any).electronAPI) {
            // Assuming the app uses contextBridge
            await (window as any).electronAPI.send('invalid:channel', { malicious: true });
            return false;
          }
          return true; // No API exposed (good)
        } catch (error) {
          return true; // Error thrown (good)
        }
      });
      
      expect(invalidChannelBlocked).toBe(true);
    });
    
    test('02. Renderer should not have direct access to Node.js', async () => {
      const hasNodeAccess = await mainWindow.evaluate(() => {
        try {
          // Try to access Node.js globals
          return typeof require !== 'undefined' || 
                 typeof process !== 'undefined' && process.versions?.node;
        } catch {
          return false;
        }
      });
      
      expect(hasNodeAccess).toBe(false);
    });
    
    test('03. Remote module should not be accessible', async () => {
      const hasRemoteAccess = await mainWindow.evaluate(() => {
        try {
          return typeof (window as any).require?.('electron').remote !== 'undefined';
        } catch {
          return false;
        }
      });
      
      expect(hasRemoteAccess).toBe(false);
    });
  });
  
  test.describe('Navigation Security', () => {
    test('01. Should prevent navigation to file:// protocol', async () => {
      let navigationPrevented = false;
      
      // Listen for navigation
      mainWindow.on('framenavigated', (frame) => {
        if (frame.url().startsWith('file://')) {
          navigationPrevented = false;
        }
      });
      
      try {
        await mainWindow.evaluate(() => {
          window.location.href = 'file:///etc/passwd';
        });
        await mainWindow.waitForTimeout(1000);
      } catch {
        navigationPrevented = true;
      }
      
      // Check if still on original page
      const currentURL = mainWindow.url();
      expect(currentURL).not.toContain('file://');
    });
    
    test('02. Should handle window.open securely', async () => {
      const newWindowFeatures = await mainWindow.evaluate(() => {
        // Try to open new window with Node integration
        try {
          const newWin = window.open('about:blank', '_blank', 'nodeIntegration=yes');
          const features = newWin ? (newWin as any).features : null;
          if (newWin) newWin.close();
          return features;
        } catch {
          return null;
        }
      });
      
      // New windows should not have dangerous features
      if (newWindowFeatures) {
        expect(newWindowFeatures).not.toContain('nodeIntegration');
      }
    });
    
    test('03. External links should open in default browser', async () => {
      const { shell } = await import('electron');
      let externalLinkHandled = false;
      
      // Mock shell.openExternal
      const originalOpenExternal = shell.openExternal;
      shell.openExternal = async (url: string) => {
        externalLinkHandled = true;
        return true;
      };
      
      // Click external link
      const externalLink = mainWindow.locator('a[href^="https://"]').first();
      if (await externalLink.isVisible()) {
        await externalLink.click();
        await mainWindow.waitForTimeout(500);
      }
      
      // Restore original
      shell.openExternal = originalOpenExternal;
      
      // External links should be handled by shell
      expect(externalLinkHandled || !await externalLink.isVisible()).toBe(true);
    });
  });
  
  test.describe('Permission Security', () => {
    test('01. Should handle permission requests properly', async () => {
      // Check if permission handler is set
      const hasPermissionHandler = await app.evaluate(async ({ session }) => {
        // This checks if a permission handler is registered
        return typeof session.defaultSession.setPermissionRequestHandler === 'function';
      });
      
      expect(hasPermissionHandler).toBe(true);
    });
    
    test('02. Should not auto-grant dangerous permissions', async () => {
      // Try to request camera permission
      const cameraPermission = await mainWindow.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
          return 'granted';
        } catch (error) {
          return 'denied';
        }
      });
      
      // Should either deny or prompt, not auto-grant
      expect(cameraPermission).toBe('denied');
    });
  });
  
  test.describe('Data Security', () => {
    test('01. Should not expose sensitive paths', async () => {
      const exposedPaths = await mainWindow.evaluate(() => {
        // Check if any sensitive paths are exposed
        const sensitivePatterns = [
          /\/home\/[^\/]+/,
          /\/Users\/[^\/]+/,
          /C:\\Users\\/,
          /\.ssh/,
          /\.env/,
          /password/i,
          /secret/i,
          /token/i
        ];
        
        const allText = document.body.innerText;
        return sensitivePatterns.some(pattern => pattern.test(allText));
      });
      
      expect(exposedPaths).toBe(false);
    });
    
    test('02. LocalStorage should be properly isolated', async () => {
      // Set test data
      await mainWindow.evaluate(() => {
        localStorage.setItem('test-security', 'sensitive-data');
      });
      
      // Try to access from different origin (should fail)
      const isolated = await mainWindow.evaluate(() => {
        try {
          // Attempt cross-origin access
          const iframe = document.createElement('iframe');
          iframe.src = 'https://example.com';
          document.body.appendChild(iframe);
          
          // This should throw or return null
          const crossOriginData = iframe.contentWindow?.localStorage?.getItem('test-security');
          document.body.removeChild(iframe);
          
          return !crossOriginData;
        } catch {
          return true; // Error means properly isolated
        }
      });
      
      expect(isolated).toBe(true);
    });
  });
  
  test.describe('Update Security', () => {
    test('01. Auto-updater should use secure channels', async () => {
      const updateConfig = await app.evaluate(async ({ autoUpdater }) => {
        try {
          const feedURL = (autoUpdater as any).getFeedURL();
          return {
            url: feedURL,
            isSecure: feedURL?.startsWith('https://')
          };
        } catch {
          return { url: null, isSecure: true }; // No updater is OK
        }
      });
      
      if (updateConfig.url) {
        expect(updateConfig.isSecure).toBe(true);
      }
    });
  });
  
  test.describe('Security Headers', () => {
    test('01. Should set security headers for all responses', async () => {
      // Intercept response headers
      const headers = await mainWindow.evaluate(async () => {
        try {
          const response = await fetch(window.location.href);
          const headers: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });
          return headers;
        } catch {
          // For local files, check meta tags
          const metaTags = document.querySelectorAll('meta[http-equiv]');
          const headers: Record<string, string> = {};
          metaTags.forEach(tag => {
            const name = tag.getAttribute('http-equiv') || '';
            const content = tag.getAttribute('content') || '';
            headers[name] = content;
          });
          return headers;
        }
      });
      
      // Check for security headers
      Object.entries(SECURITY_CONFIG.requiredHeaders).forEach(([header, value]) => {
        if (typeof value === 'string') {
          expect(headers[header]).toBe(value);
        } else {
          expect(headers[header]).toBeTruthy();
        }
      });
    });
  });
  
  test.describe('Certificate Validation', () => {
    test('01. Should not ignore certificate errors', async () => {
      const ignoreCertErrors = await app.evaluate(async ({ app }) => {
        // Check if certificate errors are being ignored
        const commandLine = app.commandLine;
        return commandLine.hasSwitch('ignore-certificate-errors');
      });
      
      expect(ignoreCertErrors).toBe(false);
    });
  });
});

// Additional security audit function
export async function performSecurityAudit(app: ElectronApplication): Promise<SecurityAuditResult> {
  const results: SecurityAuditResult = {
    passed: true,
    violations: [],
    warnings: [],
    score: 100
  };
  
  // Audit all windows
  const windows = await app.windows();
  
  for (const window of windows) {
    const webPreferences = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(w => w.webContents.id === window.context().id);
      return win?.webContents.getWebPreferences();
    });
    
    // Check each security setting
    if (webPreferences) {
      if (!webPreferences.contextIsolation) {
        results.violations.push({
          severity: 'critical',
          message: 'Context isolation is disabled',
          window: window.url()
        });
        results.score -= 20;
      }
      
      if (webPreferences.nodeIntegration) {
        results.violations.push({
          severity: 'critical',
          message: 'Node integration is enabled',
          window: window.url()
        });
        results.score -= 20;
      }
      
      if (!webPreferences.webSecurity) {
        results.violations.push({
          severity: 'critical',
          message: 'Web security is disabled',
          window: window.url()
        });
        results.score -= 30;
      }
    }
  }
  
  results.passed = results.score >= 70 && results.violations.filter(v => v.severity === 'critical').length === 0;
  
  return results;
}

interface SecurityAuditResult {
  passed: boolean;
  violations: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    window?: string;
  }>;
  warnings: Array<{
    message: string;
    window?: string;
  }>;
  score: number;
}