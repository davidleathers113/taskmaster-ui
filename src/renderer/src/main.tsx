import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { SuspenseWrapper } from './components/ui/SuspenseWrapper'
import './styles/globals.css'

// ============================================
// 🔥 Enhanced electron-vite HMR Support - 2025 Best Practices 🔥
// ============================================

// HMR State Preservation and Enhanced Error Handling
let hmrErrorCount = 0;
const MAX_HMR_ERRORS = 5;

if (import.meta.hot) {
  // Accept updates for this module
  import.meta.hot.accept()
  
  // Accept updates for the App module specifically to preserve state
  import.meta.hot.accept('./App.tsx', (newModule) => {
    if (newModule) {
      console.log('🔄 [HMR] App module updated successfully');
      hmrErrorCount = 0; // Reset error count on successful update
    }
  })
  
  // Enhanced error handling for HMR failures
  import.meta.hot.on('vite:error', (payload) => {
    hmrErrorCount++;
    console.error(`🚨 [HMR Error ${hmrErrorCount}/${MAX_HMR_ERRORS}]`, payload);
    
    if (hmrErrorCount >= MAX_HMR_ERRORS) {
      console.warn('🔄 [HMR] Too many errors, suggesting full reload');
      if (confirm('HMR has encountered multiple errors. Would you like to reload the page?')) {
        window.location.reload();
      }
    }
  })
  
  // Log HMR events for debugging
  import.meta.hot.on('vite:beforeUpdate', () => {
    console.log('🔥 [HMR] Preparing to update...');
  })
  
  import.meta.hot.on('vite:afterUpdate', () => {
    console.log('✅ [HMR] Update completed successfully');
  })
  
  // HMR Development Utilities
  if (import.meta.env.DEV) {
    // Add global HMR debugging helpers
    (window as any).__HMR_DEBUG__ = {
      getErrorCount: () => hmrErrorCount,
      resetErrorCount: () => { hmrErrorCount = 0; },
      forceReload: () => window.location.reload(),
      triggerUpdate: () => import.meta.hot?.invalidate(),
    };
    
    console.log('🔥 [HMR] Enhanced hot reloading enabled');
    console.log('🛠️  [HMR] Debug helpers available at window.__HMR_DEBUG__');
  }
}

// Error handler for app-level errors
const handleAppError = (error: Error, errorInfo: React.ErrorInfo) => {
  // In development, log detailed error information
  if (import.meta.env.DEV) {
    console.group('🚨 App-Level Error');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.groupEnd();
  }
  
  // In production, you might want to send this to an error reporting service
  // Example: Sentry, LogRocket, etc.
  if (import.meta.env.PROD) {
    // reportToErrorService(error, errorInfo);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary 
      level="app" 
      onError={handleAppError}
    >
      <SuspenseWrapper 
        level="app" 
        name="TaskMaster Application"
      >
        <App />
      </SuspenseWrapper>
    </ErrorBoundary>
  </React.StrictMode>,
)