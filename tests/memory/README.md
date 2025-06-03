# TaskMaster Memory Testing Framework (2025)

## Overview

This directory contains the comprehensive memory testing framework for TaskMaster Electron application, implementing 2025 best practices for memory leak detection, heap analysis, and performance monitoring.

## Key Features

- **MemLab Integration**: Facebook's advanced memory leak detection framework
- **Chrome DevTools Protocol**: Direct access to V8 heap profiling
- **Automated CI/CD Testing**: Memory tests run automatically in pipelines
- **Cross-Process Monitoring**: Tracks both main and renderer process memory
- **Visual Reporting**: Comprehensive reports with leak traces and recommendations

## Test Suites

### 1. Memory Leak Detection (`app-memory.leak.test.ts`)
- Basic navigation memory patterns
- Task creation/deletion lifecycle
- React Fiber leak detection
- Event listener cleanup
- DOM node accumulation
- Long-running session stability
- Cross-process memory monitoring

### 2. Memory Test Utilities (`memory-test-utils.ts`)
- Heap snapshot capture and analysis
- Memory metrics collection
- Trend analysis with regression
- Leak clustering and reporting
- Chrome DevTools Protocol integration

### 3. Memory Test Configuration (`memory-test.config.ts`)
- Environment-specific thresholds
- MemLab scenario definitions
- Performance monitoring settings
- CDP configuration

## Running Memory Tests

### Basic Memory Test
```bash
npm run test:memory
```

### Detailed Memory Test with GC Exposure
```bash
npm run test:memory:detailed
```

### Run Specific Memory Test
```bash
npx playwright test tests/e2e/app-memory.leak.test.ts -g "should not have memory leaks"
```

### Generate Memory Report
```bash
npm run test:memory -- --reporter=html
```

## Understanding Memory Metrics

### Key Metrics Monitored
- **JS Heap Size**: JavaScript heap memory usage
- **Total Heap Size**: Total allocated heap size
- **External Memory**: Memory used by C++ objects
- **DOM Nodes**: Number of DOM elements
- **Event Listeners**: Active event listener count
- **Detached Nodes**: DOM nodes not connected to the document

### Thresholds

| Environment | Max Heap | Max Growth | Max Detached Nodes | Max Listeners |
|-------------|----------|------------|-------------------|---------------|
| Development | 300MB    | 50MB       | 200               | 100           |
| CI          | 200MB    | 20MB       | 100               | 50            |
| Production  | 150MB    | 10MB       | 50                | 30            |

## MemLab Usage

### Running MemLab Analysis
```bash
# Run with a specific scenario
memlab run --scenario tests/scenarios/navigation.js

# View heap snapshot
memlab view-heap --snapshot test-results/memlab/s3.heapsnapshot

# Analyze specific leak
memlab analyze --snapshot test-results/memlab/
```

### Writing Custom Scenarios
```javascript
module.exports = {
  url: () => 'app://taskmaster',
  
  action: async (page) => {
    // Perform actions that might cause leaks
    await page.click('[data-testid="add-task"]');
    await page.fill('input', 'Test Task');
    await page.click('[data-testid="save"]');
  },
  
  back: async (page) => {
    // Return to initial state
    await page.click('[data-testid="cancel"]');
  },
  
  // Custom leak detection
  leakFilter: (node) => {
    return node.name === 'DetachedHTMLElement';
  }
};
```

## Debugging Memory Issues

### 1. Using Chrome DevTools
- Open Electron with DevTools: `npm run start:dev`
- Navigate to Memory tab
- Take heap snapshots before/after actions
- Compare snapshots to find retained objects

### 2. Analyzing Heap Snapshots
```bash
# Capture heap snapshot
npm run test:memory -- --project=electron-main --grep "heap snapshot"

# View in Chrome DevTools
# 1. Open Chrome DevTools
# 2. Go to Memory tab
# 3. Load snapshot from test-results/memlab/
```

### 3. Memory Timeline Recording
- Use Performance tab in DevTools
- Enable Memory checkbox
- Record during problematic actions
- Look for growing heap pattern

## CI/CD Integration

### GitHub Actions Configuration
```yaml
- name: Run Memory Tests
  run: |
    npm run test:memory:detailed
    
- name: Upload Memory Reports
  uses: actions/upload-artifact@v4
  with:
    name: memory-reports
    path: test-results/memory-reports/
```

### Memory Test Gates
- Tests fail if critical leaks detected
- Warnings for memory growth > thresholds
- Reports uploaded as CI artifacts

## Best Practices

### 1. Writing Memory-Safe Code
- Always remove event listeners on cleanup
- Use WeakMap/WeakSet for object references
- Clear timers and intervals
- Dispose of large objects explicitly
- Avoid circular references

### 2. React-Specific Guidelines
- Clean up effects in useEffect return
- Cancel async operations on unmount
- Use useMemo/useCallback appropriately
- Avoid storing component references

### 3. Electron-Specific Guidelines
- Properly dispose of BrowserWindows
- Clear IPC listeners when not needed
- Manage webContents lifecycle
- Monitor both processes

## Troubleshooting

### Common Issues

#### "Cannot find Chrome DevTools Protocol"
```bash
# Ensure Electron is built with CDP support
npm run build
```

#### "Heap snapshot too large"
```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm run test:memory
```

#### "GC not triggering"
```bash
# Run with GC exposure
NODE_OPTIONS='--expose-gc' npm run test:memory:detailed
```

## Advanced Configuration

### Custom Memory Thresholds
```typescript
// tests/config/memory-test.config.ts
export const customThresholds = {
  maxHeapSize: 400 * 1024 * 1024, // 400MB
  maxHeapGrowth: 100 * 1024 * 1024, // 100MB
  // ... other thresholds
};
```

### Custom Leak Detectors
```typescript
const customLeakFilter: ILeakFilter = {
  leakFilter: (node) => {
    // Your custom leak detection logic
    return node.retainedSize > 1024 * 1024 && 
           node.name.includes('MyComponent');
  }
};
```

## Contributing

When adding new memory tests:
1. Follow existing test patterns
2. Use descriptive test names
3. Include cleanup in afterEach
4. Document expected behavior
5. Set appropriate timeouts
6. Add to CI test matrix

## Resources

- [MemLab Documentation](https://facebook.github.io/memlab/)
- [Chrome DevTools Memory Profiling](https://developer.chrome.com/docs/devtools/memory-problems/)
- [Electron Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance)
- [V8 Memory Management](https://v8.dev/blog/trash-talk)