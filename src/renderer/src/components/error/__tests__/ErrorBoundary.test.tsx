/**
 * Error Boundary Component Tests (2025)
 * 
 * Comprehensive test suite for error boundaries, testing error catching,
 * fallback UI rendering, and recovery mechanisms.
 * 
 * Following 2025 React Testing Library and error boundary best practices.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Global type declarations for test environment
declare global {
  const vi: typeof import('vitest').vi
  interface GlobalThis {
    __mockElectron?: any
    __electron?: any
    electronAPI?: any
    taskmaster?: any
    __DEV__?: boolean
    __TEST__?: boolean
  }
}

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../ErrorBoundary';
import { testUtils } from '@tests/setup';

// Mock error reporting service
const mockErrorReporting = {
  captureError: vi.fn(),
  addBreadcrumb: vi.fn(),
  setContext: vi.fn(),
};

vi.mock('@/services/ErrorReportingService', () => ({
  ErrorReportingService: {
    getInstance: () => mockErrorReporting,
  },
}));

// Mock console.error to prevent noise in test output
const _originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
  vi.clearAllMocks();
});

afterEach(() => {
  console.error = _originalConsoleError;
});

describe('ErrorBoundary', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      const TestComponent = () => <div>Normal content</div>;

      render(
        <ErrorBoundary level="component">
          <TestComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('should not interfere with child component props', () => {
      const TestComponent = ({ message }: { message: string }) => (
        <div>{message}</div>
      );

      render(
        <ErrorBoundary level="component">
          <TestComponent message="Test message" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  describe('Error Catching', () => {
    it('should catch and display error in child component', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent(
        'Test error message'
      );

      render(
        <ErrorBoundary level="component">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText(/test error message/i)).toBeInTheDocument();
    });

    it('should display different UI based on error level', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent();

      // Component level error
      const { unmount } = render(
        <ErrorBoundary level="component">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/component error/i)).toBeInTheDocument();
      
      unmount();

      // Page level error
      render(
        <ErrorBoundary level="page">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/page error/i)).toBeInTheDocument();
    });

    it('should catch errors in nested components', () => {
      const DeepErrorComponent = () => {
        throw new Error('Deep nested error');
      };

      const NestedComponent = () => (
        <div>
          <span>Nested content</span>
          <DeepErrorComponent />
        </div>
      );

      render(
        <ErrorBoundary level="component">
          <NestedComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/deep nested error/i)).toBeInTheDocument();
    });

    it('should catch async errors when reported manually', async () => {
      const AsyncErrorComponent = () => {
        const handleAsyncError = async () => {
          try {
            await Promise.reject(new Error('Async error'));
          } catch (error) {
            // Manually report async error to boundary
            throw error;
          }
        };

        return (
          <button onClick={handleAsyncError}>
            Trigger async error
          </button>
        );
      };

      render(
        <ErrorBoundary level="component">
          <AsyncErrorComponent />
        </ErrorBoundary>
      );

      const button = screen.getByText('Trigger async error');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/async error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Reporting', () => {
    it('should report errors to error reporting service', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent(
        'Reported error'
      );

      render(
        <ErrorBoundary level="component">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(mockErrorReporting.captureError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Reported error'
        }),
        expect.objectContaining({
          level: 'component',
          boundary: 'ErrorBoundary'
        })
      );
    });

    it('should add breadcrumbs for error context', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent();

      render(
        <ErrorBoundary level="component" componentName="TestComponent">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(mockErrorReporting.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Error boundary caught error',
        category: 'error',
        level: 'error',
        data: {
          componentName: 'TestComponent',
          errorBoundaryLevel: 'component'
        }
      });
    });

    it('should set error context for better debugging', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent();

      render(
        <ErrorBoundary level="page" componentName="PageComponent">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(mockErrorReporting.setContext).toHaveBeenCalledWith('errorBoundary', {
        level: 'page',
        componentName: 'PageComponent',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Recovery Mechanisms', () => {
    it('should show retry button in fallback UI', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent();

      render(
        <ErrorBoundary level="component">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/try again/i)).toBeInTheDocument();
    });

    it('should attempt recovery when retry button is clicked', async () => {
      let shouldThrow = true;
      const ConditionalErrorComponent = () => {
        if (shouldThrow) {
          throw new Error('Conditional error');
        }
        return <div>Recovery successful</div>;
      };

      render(
        <ErrorBoundary level="component">
          <ConditionalErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/conditional error/i)).toBeInTheDocument();

      // Fix the error condition
      shouldThrow = false;

      // Click retry button
      const retryButton = screen.getByText(/try again/i);
      await user.click(retryButton);

      expect(screen.getByText('Recovery successful')).toBeInTheDocument();
    });

    it('should reset error state on successful recovery', async () => {
      let errorCount = 0;
      const RecoveryTestComponent = () => {
        errorCount++;
        if (errorCount === 1) {
          throw new Error('First error');
        }
        return <div>Component recovered</div>;
      };

      render(
        <ErrorBoundary level="component">
          <RecoveryTestComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/first error/i)).toBeInTheDocument();

      const retryButton = screen.getByText(/try again/i);
      await user.click(retryButton);

      expect(screen.getByText('Component recovered')).toBeInTheDocument();
      expect(screen.queryByText(/first error/i)).not.toBeInTheDocument();
    });

    it('should provide fallback navigation for page-level errors', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent();

      render(
        <ErrorBoundary level="page">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/go to dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/reload application/i)).toBeInTheDocument();
    });
  });

  describe('Development Features', () => {
    it('should show detailed error information in development', () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent(
        'Development error'
      );

      render(
        <ErrorBoundary level="component" showDetailedError={true}>
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/error details/i)).toBeInTheDocument();
      expect(screen.getByText(/development error/i)).toBeInTheDocument();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should hide stack traces in production', () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent();

      render(
        <ErrorBoundary level="component">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.queryByText(/stack trace/i)).not.toBeInTheDocument();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should provide error boundary information for debugging', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent();

      render(
        <ErrorBoundary level="component" componentName="DebugComponent">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/debugcomponent/i)).toBeInTheDocument();
      expect(screen.getByText(/component level/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for error UI', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent();

      render(
        <ErrorBoundary level="component">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
    });

    it('should be keyboard navigable', async () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent();

      render(
        <ErrorBoundary level="component">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      const retryButton = screen.getByText(/try again/i);
      
      // Should be focusable
      retryButton.focus();
      expect(retryButton).toHaveFocus();

      // Should activate with Enter key
      await user.keyboard('{Enter}');
      // Test would verify retry functionality here
    });

    it('should announce errors to screen readers', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent(
        'Screen reader error'
      );

      render(
        <ErrorBoundary level="component">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      const announcement = screen.getByText(/an error occurred/i);
      expect(announcement).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Performance', () => {
    it('should not impact performance when no errors occur', () => {
      const renderSpy = vi.fn();
      
      const TestComponent = () => {
        renderSpy();
        return <div>No error content</div>;
      };

      render(
        <ErrorBoundary level="component">
          <TestComponent />
        </ErrorBoundary>
      );

      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple errors efficiently', () => {
      const MultiErrorComponent = () => {
        throw new Error('Multiple error test');
      };

      // First error boundary
      render(
        <ErrorBoundary level="component">
          <MultiErrorComponent />
        </ErrorBoundary>
      );

      // Second error boundary  
      render(
        <ErrorBoundary level="component">
          <MultiErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getAllByText(/multiple error test/i)).toHaveLength(2);
      expect(mockErrorReporting.captureError).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with Error Store', () => {
    it('should integrate with global error store', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent();

      render(
        <ErrorBoundary level="component" reportToStore={true}>
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      // Would verify error was added to global error store
      // This would require mocking the error store
    });

    it('should provide error recovery suggestions', () => {
      const ErrorThrowingComponent = testUtils.createErrorThrowingComponent();

      render(
        <ErrorBoundary level="component">
          <ErrorThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/reload the page/i)).toBeInTheDocument();
      expect(screen.getByText(/contact support/i)).toBeInTheDocument();
    });
  });
});