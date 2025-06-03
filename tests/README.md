# TaskMaster Desktop Test Suite (2025)

## Overview

This comprehensive test suite provides robust testing coverage for TaskMaster Desktop, an Electron application built with React, TypeScript, and Zustand. The testing infrastructure follows 2025 best practices for modern web applications.

## Testing Framework

- **Vitest**: Modern, fast testing framework with excellent TypeScript support
- **React Testing Library**: User-centric testing for React components
- **jsdom**: Browser environment simulation for component testing
- **Coverage**: v8 provider with comprehensive reporting

## Test Structure

```
tests/
├── setup.ts                    # Global test configuration
└── README.md                   # This file

src/renderer/src/
├── store/__tests__/
│   ├── errorHandling.test.ts   # Error handling system tests (existing)
│   └── useTaskStore.test.ts    # Core Zustand store tests (new)
├── components/
│   ├── task/__tests__/
│   │   └── TaskCard.test.tsx   # TaskCard component tests (new)
│   └── error/__tests__/
│       └── ErrorBoundary.test.tsx # Error boundary tests (new)
```

## Test Categories

### 1. Store Tests (`/store/__tests__/`)

**useTaskStore.test.ts** - Core state management testing:
- ✅ Task CRUD operations (create, read, update, delete)
- ✅ Subtask management
- ✅ Filtering and querying
- ✅ View mode management
- ✅ User settings management
- ✅ Bulk operations
- ✅ Data import/export
- ✅ Dependencies and relationships
- ✅ Performance testing
- ✅ React hook integration

**errorHandling.test.ts** - Error handling system:
- ✅ Error store operations
- ✅ Backup service functionality
- ✅ Error-handled store wrapper
- ✅ Integration workflows
- ✅ Performance under high error volume

### 2. Component Tests (`/components/*/__tests__/`)

**TaskCard.test.tsx** - Task card component:
- ✅ Rendering task information
- ✅ User interactions (click, dropdown, status toggle)
- ✅ Accessibility compliance
- ✅ Visual states (selected, loading, error)
- ✅ Performance optimization
- ✅ Error boundary integration

**ErrorBoundary.test.tsx** - Error boundary component:
- ✅ Error catching and display
- ✅ Error reporting integration
- ✅ Recovery mechanisms
- ✅ Development vs production behavior
- ✅ Accessibility features
- ✅ Performance impact assessment

## Available Test Commands

```bash
# Run all tests
npm test

# Run tests once (CI mode)
npm run test:run

# Run with coverage
npm run test:coverage

# Run with UI dashboard
npm run test:ui

# Watch mode for development
npm run test:watch

# Debug mode
npm run test:debug

# Specific test categories
npm run test:store      # Store tests only
npm run test:components # Component tests only

# CI pipeline
npm run test:ci         # Full CI test suite with JUnit output
```

## Coverage Targets

The test suite maintains high coverage standards:

### Global Thresholds
- **Statements**: 70%
- **Branches**: 65%
- **Functions**: 70%
- **Lines**: 70%

### Critical Component Thresholds
- **Store modules**: 85% (statements/functions), 80% (branches)
- **Error boundaries**: 90% (statements/functions), 85% (branches)

## Testing Utilities

### Mock Infrastructure

**tests/setup.ts** provides comprehensive mocking:
- ✅ Browser APIs (ResizeObserver, IntersectionObserver, matchMedia)
- ✅ Storage APIs (localStorage, sessionStorage, IndexedDB)
- ✅ Electron APIs (IPC, file system, app controls)
- ✅ Animation frameworks (Framer Motion)
- ✅ Performance APIs

### Test Utilities

```typescript
import { testUtils } from '@tests/setup';

// Create mock data
const mockTask = testUtils.createMockTask({
  title: 'Test Task',
  priority: 'high'
});

const mockSettings = testUtils.createMockUserSettings({
  ui: { theme: 'dark' }
});

// Helper functions
await testUtils.waitForAsync(100);
testUtils.simulateKeyPress('Enter');
const ErrorComponent = testUtils.createErrorThrowingComponent('Error message');
```

## Best Practices Implemented

### 2025 Testing Standards
- ✅ User-centric testing approach
- ✅ Accessibility-first testing
- ✅ Performance monitoring in tests
- ✅ Error boundary integration
- ✅ Comprehensive mocking strategies
- ✅ TypeScript-first testing

### React Testing Library Patterns
- ✅ Query by user-visible elements
- ✅ Test user interactions, not implementation
- ✅ Async testing with proper waits
- ✅ Accessibility assertions
- ✅ Keyboard navigation testing

### Electron-Specific Testing
- ✅ IPC communication mocking
- ✅ File system operation mocking
- ✅ Cross-process communication testing
- ✅ Security context testing

## Development Workflow

### Adding New Tests

1. **Component Tests**: Place in `src/renderer/src/components/[category]/__tests__/`
2. **Store Tests**: Place in `src/renderer/src/store/__tests__/`
3. **Integration Tests**: Place in `tests/integration/`
4. **E2E Tests**: Place in `tests/e2e/` (future)

### Test File Naming
- Component tests: `ComponentName.test.tsx`
- Store tests: `storeName.test.ts`
- Integration tests: `featureName.integration.test.ts`
- E2E tests: `workflow.e2e.test.ts`

### Writing Quality Tests

```typescript
describe('Feature Name', () => {
  // Setup
  beforeEach(() => {
    // Reset state, clear mocks
  });

  describe('Specific Behavior', () => {
    it('should behave correctly when condition is met', async () => {
      // Arrange
      const user = userEvent.setup();
      
      // Act
      render(<Component />);
      await user.click(screen.getByRole('button'));
      
      // Assert
      expect(screen.getByText('Expected result')).toBeInTheDocument();
    });
  });
});
```

## Continuous Integration

The test suite integrates with CI/CD pipelines:

```bash
# CI validation command
npm run ci:validate
# Runs: typecheck + lint + build + test:ci + security:audit
```

### CI Configuration
- ✅ Parallel test execution
- ✅ Coverage reporting
- ✅ JUnit XML output
- ✅ Performance monitoring
- ✅ Security scanning integration

## Troubleshooting

### Common Issues

**Tests timing out**:
```bash
# Increase timeout in vitest.config.ts
testTimeout: 10000
```

**Mock issues**:
```bash
# Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

**Path resolution**:
```bash
# Verify aliases in vitest.config.ts match electron-vite config
```

### Debug Mode

```bash
# Run specific test with debugging
npm run test:debug -- TaskCard.test.tsx
```

## Future Enhancements

### Planned Additions
- [ ] E2E tests with Playwright
- [ ] Visual regression testing
- [ ] Performance benchmarking
- [ ] Accessibility automation
- [ ] Cross-platform testing

### Integration Opportunities
- [ ] GitHub Actions integration
- [ ] Codecov reporting
- [ ] Automated test generation
- [ ] Mutation testing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Electron Testing Guide](https://www.electronjs.org/docs/latest/development/testing)
- [Accessibility Testing](https://testing-library.com/docs/guide-accessibility/)

---

This test suite represents a VITAL component of the TaskMaster Desktop project, ensuring code quality, preventing regressions, and maintaining user experience standards through comprehensive automated testing.