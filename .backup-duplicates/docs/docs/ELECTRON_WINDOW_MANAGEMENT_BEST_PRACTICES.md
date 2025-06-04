# Electron Window Management Best Practices for Testing

## Overview

When testing Electron applications, proper window management is crucial to prevent memory leaks, ensure test isolation, and maintain system stability. This guide provides comprehensive best practices for managing multiple Electron windows during testing.

## Quick Solutions

### Closing All Open Test Windows

If you have multiple test windows open, use this snippet to close them all:

```javascript
// Get all open windows and close them
const { BrowserWindow } = require('electron');
BrowserWindow.getAllWindows().forEach(window => {
  window.destroy();
});
```

## Best Practices

### 1. Use Test Lifecycle Hooks

Always use `beforeEach` and `afterEach` hooks to manage window lifecycle:

```javascript
let mainWindow;

beforeEach(() => {
  // Create a new window for each test
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false // Don't show windows during tests
  });
});

afterEach(() => {
  // Clean up the window after each test
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
    mainWindow = null;
  }
});
```

### 2. Implement a Window Manager

Create a centralized window manager for better control:

```javascript
class TestWindowManager {
  constructor() {
    this.windows = new Set();
  }
  
  createWindow(options = {}) {
    const defaultOptions = {
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    };
    
    const win = new BrowserWindow({ ...defaultOptions, ...options });
    this.windows.add(win);
    
    win.on('closed', () => {
      this.windows.delete(win);
    });
    
    return win;
  }
  
  destroyAll() {
    this.windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.destroy();
      }
    });
    this.windows.clear();
  }
  
  getWindowCount() {
    return this.windows.size;
  }
}

// Usage in tests
const windowManager = new TestWindowManager();

beforeEach(() => {
  // Windows can be created through the manager
});

afterEach(() => {
  windowManager.destroyAll();
});
```

### 3. Track Multiple Windows

When dealing with multiple windows, maintain proper tracking:

```javascript
const testWindows = [];

function createTestWindow(options) {
  const window = new BrowserWindow(options);
  testWindows.push(window);
  
  window.on('closed', () => {
    const index = testWindows.indexOf(window);
    if (index > -1) {
      testWindows.splice(index, 1);
    }
  });
  
  return window;
}

function cleanupAllTestWindows() {
  testWindows.forEach(window => {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  });
  testWindows.length = 0;
}
```

### 4. Add Failsafe Cleanup

Implement multiple levels of cleanup to ensure no windows are left open:

```javascript
// In your test setup file
process.on('exit', () => {
  BrowserWindow.getAllWindows().forEach(window => {
    window.destroy();
  });
});

// For test runners like Jest
afterAll(() => {
  BrowserWindow.getAllWindows().forEach(window => {
    window.destroy();
  });
});

// Handle unexpected exits
process.on('SIGINT', () => {
  BrowserWindow.getAllWindows().forEach(window => {
    window.destroy();
  });
  process.exit(0);
});
```

### 5. Remove Event Listeners

Prevent memory leaks by properly removing event listeners:

```javascript
function createManagedWindow() {
  const window = new BrowserWindow({ show: false });
  const listeners = new Map();
  
  // Helper to add tracked listeners
  window.addTrackedListener = (event, handler) => {
    window.on(event, handler);
    listeners.set(event, handler);
  };
  
  // Clean up all listeners on close
  window.on('closed', () => {
    listeners.forEach((handler, event) => {
      window.removeListener(event, handler);
    });
    listeners.clear();
  });
  
  return window;
}
```

### 6. Handle Async Cleanup

For async cleanup operations, use the `before-quit` event:

```javascript
app.on('before-quit', async (event) => {
  event.preventDefault();
  
  try {
    // Perform async cleanup
    await Promise.all(
      BrowserWindow.getAllWindows().map(async (window) => {
        // Save any state if needed
        await saveWindowState(window);
        window.destroy();
      })
    );
  } finally {
    // Quit after cleanup
    app.quit();
  }
});
```

### 7. Implement Timeout Protection

Add timeout protection to prevent windows from staying open indefinitely:

```javascript
function createTimeLimitedWindow(options = {}, timeout = 30000) {
  const window = new BrowserWindow(options);
  
  // Auto-destroy after timeout
  const timeoutId = setTimeout(() => {
    if (!window.isDestroyed()) {
      console.warn(`Window ${window.id} auto-destroyed after ${timeout}ms timeout`);
      window.destroy();
    }
  }, timeout);
  
  window.on('closed', () => {
    clearTimeout(timeoutId);
  });
  
  return window;
}
```

### 8. Test-Specific Considerations

Handle test failures gracefully:

```javascript
let windowCreated = false;
let testWindow = null;

test('window functionality', () => {
  try {
    testWindow = new BrowserWindow();
    windowCreated = true;
    // ... test code
  } catch (error) {
    // Ensure cleanup even on test failure
    if (windowCreated && testWindow && !testWindow.isDestroyed()) {
      testWindow.destroy();
    }
    throw error;
  }
});

afterEach(() => {
  if (windowCreated && testWindow && !testWindow.isDestroyed()) {
    testWindow.destroy();
  }
  windowCreated = false;
  testWindow = null;
});
```

### 9. Memory Management

Force garbage collection and monitor memory usage:

```javascript
afterEach(() => {
  // Clean up windows
  cleanupAllWindows();
  
  // Force garbage collection if available
  // Run tests with: node --expose-gc
  if (global.gc) {
    global.gc();
  }
});

// Monitor memory usage
function logMemoryUsage(label) {
  const usage = process.memoryUsage();
  console.log(`${label} Memory Usage:`, {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  });
}
```

### 10. Global Window Override for Testing

Override BrowserWindow globally to track all windows:

```javascript
// In test setup
const originalBrowserWindow = BrowserWindow;
const allTestWindows = new WeakSet();

global.BrowserWindow = class extends originalBrowserWindow {
  constructor(options) {
    super(options);
    allTestWindows.add(this);
    
    // Log window creation in tests
    console.log(`Test window created: ${this.id}`);
    
    this.on('closed', () => {
      console.log(`Test window closed: ${this.id}`);
    });
  }
};

// Restore after tests
afterAll(() => {
  global.BrowserWindow = originalBrowserWindow;
});
```

## Complete Example

Here's a complete example implementing these best practices:

```javascript
const { BrowserWindow, app } = require('electron');

class ElectronTestHelper {
  constructor() {
    this.windows = new Map();
    this.cleanupHandlers = [];
  }
  
  createWindow(id, options = {}) {
    if (this.windows.has(id)) {
      throw new Error(`Window with id ${id} already exists`);
    }
    
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        ...options.webPreferences
      },
      ...options
    });
    
    this.windows.set(id, window);
    
    // Auto-cleanup on close
    window.on('closed', () => {
      this.windows.delete(id);
    });
    
    // Timeout protection (5 minutes for tests)
    const timeout = setTimeout(() => {
      if (!window.isDestroyed()) {
        console.warn(`Window ${id} auto-destroyed after timeout`);
        window.destroy();
      }
    }, 300000);
    
    window.on('closed', () => clearTimeout(timeout));
    
    return window;
  }
  
  getWindow(id) {
    return this.windows.get(id);
  }
  
  destroyWindow(id) {
    const window = this.windows.get(id);
    if (window && !window.isDestroyed()) {
      window.destroy();
      this.windows.delete(id);
    }
  }
  
  destroyAllWindows() {
    this.windows.forEach((window, id) => {
      if (!window.isDestroyed()) {
        window.destroy();
      }
    });
    this.windows.clear();
  }
  
  registerCleanupHandler(handler) {
    this.cleanupHandlers.push(handler);
  }
  
  async cleanup() {
    // Run all cleanup handlers
    for (const handler of this.cleanupHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error('Cleanup handler failed:', error);
      }
    }
    
    // Destroy all windows
    this.destroyAllWindows();
    
    // Clear handlers
    this.cleanupHandlers = [];
  }
}

// Usage
const testHelper = new ElectronTestHelper();

beforeEach(() => {
  // Fresh state for each test
});

afterEach(async () => {
  await testHelper.cleanup();
});

// In tests
test('multiple windows', () => {
  const mainWindow = testHelper.createWindow('main', {
    width: 800,
    height: 600
  });
  
  const secondaryWindow = testHelper.createWindow('secondary', {
    width: 400,
    height: 300
  });
  
  // Test logic...
  
  // Windows will be automatically cleaned up
});
```

## Debugging Tips

1. **Log Window Creation/Destruction**: Add logging to track window lifecycle
2. **Use Window IDs**: Assign unique IDs to windows for easier tracking
3. **Monitor Memory**: Use `process.memoryUsage()` to track memory usage
4. **Check Window Count**: Regularly log `BrowserWindow.getAllWindows().length`
5. **Enable Debug Mode**: Set environment variable `ELECTRON_ENABLE_LOGGING=1`

## Common Pitfalls to Avoid

1. **Global Window References**: Avoid storing windows in global variables
2. **Missing Event Cleanup**: Always remove event listeners when windows close
3. **Async Operations**: Ensure async operations complete before window destruction
4. **Circular References**: Be careful with closures that reference windows
5. **Test Isolation**: Each test should create its own windows

## CI/CD Considerations

When running tests in CI/CD environments:

1. Use `xvfb` on Linux for headless testing
2. Set `show: false` for all test windows
3. Implement strict timeouts
4. Log window states for debugging
5. Force cleanup between test suites

## Conclusion

Proper window management is essential for reliable Electron testing. By following these best practices, you can prevent memory leaks, ensure test isolation, and maintain a stable testing environment. Always remember: every window created must be destroyed, and every listener attached must be removed.